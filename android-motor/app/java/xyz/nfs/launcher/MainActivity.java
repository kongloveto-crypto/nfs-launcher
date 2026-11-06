package xyz.nfs.launcher;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Process;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.trusted.ScreenOrientation;
import androidx.browser.trusted.TrustedWebActivityDisplayMode;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * NFS Launcher para Android, app ÚNICO: esta tela fica dentro do próprio navegador do app (o "motor", Chromium
 * compilado para o NFS Launcher). Roda num processo separado (":nfs") para não pesar no processo do jogo.
 * - Tela inicial local (assets/nfs/home.html): abertura, CDs, START, Português/English, Dicas (só NFSU2),
 *   Configurações e o aviso de versão nova.
 * - START abre o site do jogo no motor do próprio app como Trusted Web Activity: tela cheia, sem barra nenhuma.
 * - Bolha por cima do jogo (BubbleService, permissão "Sobrepor a outros apps"): Guia (NFSU2), Reiniciar e Voltar ao início.
 * - Guia nativo leve (GuideView); sem mapa no celular.
 */
public class MainActivity extends Activity {

    static final class Game {
        final String id, shortName, name, url, startUrl, disc; // startUrl: o START com o convite da equipe; em inglês, url
        final boolean tips;
        Game(String id, String shortName, String name, String url, String startUrl, String disc, boolean tips) {
            this.id = id; this.shortName = shortName; this.name = name; this.url = url; this.startUrl = startUrl; this.disc = disc; this.tips = tips;
        }
        String host() { return Uri.parse(url).getHost(); }
    }
    // Catálogo: o mesmo do app de PC (src/main/config.js), exportado na montagem para assets/nfs/catalog.json.
    static Game[] GAMES = new Game[0];
    static String DEFAULT_GAME = "nfsu2";
    static Game gameOf(String id) {
        for (Game g : GAMES) if (g.id.equals(id)) return g;
        return GAMES[0];
    }
    static final String ASSETS = "nfs/"; // tudo do app fica em assets/nfs/, longe dos arquivos do navegador

    static String readAsset(Context c, String name) throws IOException {
        try (InputStream in = c.getAssets().open(ASSETS + name)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private void loadCatalog() {
        try {
            JSONObject o = new JSONObject(readAsset(this, "catalog.json"));
            DEFAULT_GAME = o.optString("defaultGame", "nfsu2");
            JSONArray a = o.getJSONArray("games");
            Game[] list = new Game[a.length()];
            for (int i = 0; i < a.length(); i++) {
                JSONObject g = a.getJSONObject(i);
                list[i] = new Game(g.getString("id"), g.getString("short"), g.getString("name"), g.getString("url"),
                        g.optString("startUrl", g.getString("url")), g.getString("disc"), g.optBoolean("tips"));
            }
            if (list.length > 0) GAMES = list;
        } catch (Exception ignored) { }
        if (GAMES.length == 0) {
            GAMES = new Game[]{ new Game("nfsu2", "NFSU2", "Need for Speed: Underground 2", "https://nfsu2.xyz", "https://nfsu2.xyz/#crew=U2BR", "games/nfsu2.png", true) };
        }
    }
    static final String VERSION = "1.6.3"; // também dá o nome do APK (quick.sh/build.sh leem daqui)
    static final long LOW_DISK_BYTES = 3L * 1024 * 1024 * 1024; // o maior jogo baixa cerca de 3 GB
    // Tela de entrada do motor (o mesmo pacote deste app). Pelo nome exato: o motor não recebe links de fora.
    static final String MOTOR_ENTRY = "com.google.android.apps.chrome.IntentDispatcher";
    // Aviso de versão nova: lê só os NOMES da pasta pública do Drive (a mesma do PC) e só o APK conta; o .exe nunca.
    static final String FOLDER_ID = "1rVrBR33DFZT8ANuwn2IJtMsOhn-m7pk8";
    static final String FOLDER_URL = "https://drive.google.com/drive/folders/" + FOLDER_ID;
    static final String LIST_URL = "https://drive.google.com/embeddedfolderview?id=" + FOLDER_ID;
    static final Pattern APK_NAME = Pattern.compile("NFS-Launcher-Android-(\\d{1,4}\\.\\d{1,4}\\.\\d{1,4})\\.apk");
    static final long UPDATE_EVERY_MS = 3600000; // de hora em hora, só com a tela inicial na frente
    static final long RETRY_MS = 5000;           // tela de erro: tenta de novo a cada 5 s
    static final int REQ_IMAGE = 41;
    static final int MAX_IMAGE_BYTES = 30 * 1024 * 1024; // imagem original até 30 MB (como no PC)

    private SharedPreferences prefs;
    private FrameLayout root;
    private WebView home;
    private GuideView guide;           // guia aberto dentro do app (fora do jogo)
    private String pendingGame = null; // START esperando a volta da tela de permissão
    private final Handler ui = new Handler(Looper.getMainLooper());
    private boolean resumed;
    private boolean dnsFailed;         // nem o DNS seguro abriu o jogo
    private String error = null;       // tipo do erro mostrado (offline, server, crash, other)
    private String updateStatus = "";
    private String updateVersion = "";
    private long updateCheckedAt = 0;
    private int customRev = 0;
    private String pickGame, pickKind; // imagem sendo escolhida na personalização

    private float dp(float v) { return v * getResources().getDisplayMetrics().density; }
    private String lang() { return prefs.getString("lang", "pt"); }
    private String tr(String pt, String en) { return "en".equals(lang()) ? en : pt; }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.parseColor("#0B0D17")));
        getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        prefs = getSharedPreferences("nfs", MODE_PRIVATE);
        loadCatalog();
        // Nova execução: "DNS normal só desta vez" acaba e o DNS seguro que já funcionou é tentado de novo.
        if (state == null && !getIntent().hasExtra("error")) prefs.edit().remove("dnsTry").remove("dnsQueue").commit();
        handleIntent(getIntent());
        // Uma vez ao abrir, fora da tela: guarda o save se ele mudou (só lê os arquivos do jogo).
        if (state == null) {
            Context app = getApplicationContext();
            new Thread(() -> { SaveCopy.run(app); ui.post(this::refreshHome); }).start();
        }
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0B0D17"));
        home = newLocalView();
        root.addView(home, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        home.loadUrl("file:///android_asset/" + ASSETS + "home.html");
        setContentView(root);
        immersive();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    /** O jogo pediu para voltar: com erro (o motor manda o código) ou "Reiniciar o jogo" (bolha). */
    private void handleIntent(Intent i) {
        if (i == null) return;
        if (i.hasExtra("error")) {
            String kind = errorKind(i.getIntExtra("error", 0));
            i.removeExtra("error");
            error = kind;
            // Falhou com DNS seguro: tenta o próximo; se nenhum abrir, volta ao DNS normal e pede para conferir a rede.
            String active = offersDns(kind) ? activeDns() : "";
            if (!active.isEmpty()) {
                String next = prefs.getString("dnsTry", "").isEmpty()
                        ? (DNS_FIRST.equals(active) ? DNS_SECOND : DNS_FIRST) : prefs.getString("dnsQueue", "");
                if (next.isEmpty()) {
                    useDns("none", "");
                    dnsFailed = true;
                } else {
                    useDns(next, "");
                    error = null;
                    pendingGame = prefs.getString("game", DEFAULT_GAME);
                }
            }
        }
        if (i.getBooleanExtra("restart", false)) {
            i.removeExtra("restart");
            pendingGame = prefs.getString("game", DEFAULT_GAME);
        }
    }

    // ───────────────────────── DNS seguro ─────────────────────────
    // Como no PC: por botão na tela de erro, Cloudflare e depois Google. O motor aplica ao abrir (lê "dnsTry" ou o arquivo
    // nfs-dns) e grava o arquivo quando o jogo abre, e aí ele fica ligado nas próximas vezes. "none" = DNS normal só desta vez.
    static final String DNS_FIRST = "cloudflare";
    static final String DNS_SECOND = "google";
    static boolean offersDns(String kind) { return "offline".equals(kind) || "other".equals(kind); }
    private String savedDns() {
        try {
            String s = new String(Files.readAllBytes(new File(getFilesDir(), "nfs-dns").toPath()), StandardCharsets.UTF_8).trim();
            return DNS_FIRST.equals(s) || DNS_SECOND.equals(s) ? s : "";
        } catch (IOException e) { return ""; }
    }
    private String activeDns() {
        String t = prefs.getString("dnsTry", "");
        if ("none".equals(t)) return "";
        return t.isEmpty() ? savedDns() : t;
    }
    private void useDns(String id, String queue) {
        prefs.edit().putString("dnsTry", id).putString("dnsQueue", queue).commit(); // commit: o motor lê em outro processo
    }
    private void trySecureDns() {
        ui.removeCallbacks(retryTick);
        error = null;
        dnsFailed = false;
        useDns(DNS_FIRST, DNS_SECOND);
        refreshHome();
        launchGame(prefs.getString("game", DEFAULT_GAME));
    }

    // Mesma classificação do PC (src/main/connError.js): uma frase simples, nunca o código técnico.
    static String errorKind(int code) {
        if (code == -1) return "crash";
        if (code >= 500) return "server";
        return code == -21 || code == -105 || code == -106 || code == -109 || code == -137 ? "offline" : "other";
    }

    /**
     * Um jogo por vez: fecha qualquer jogo aberto. Tira da lista de apps abertos as outras telas do app (menos a
     * {@code keepTaskId}) e encerra os processos do navegador (página, GPU), deixando só o desta tela (":nfs").
     * @return se havia algum processo do navegador rodando.
     */
    static boolean closeGame(Context c, int keepTaskId) {
        ActivityManager am = c.getSystemService(ActivityManager.class);
        if (am == null) return false;
        try {
            for (ActivityManager.AppTask t : am.getAppTasks()) {
                if (t.getTaskInfo().taskId != keepTaskId) t.finishAndRemoveTask();
            }
        } catch (Exception ignored) { }
        boolean any = false;
        List<ActivityManager.RunningAppProcessInfo> ps = am.getRunningAppProcesses();
        if (ps != null) {
            for (ActivityManager.RunningAppProcessInfo p : ps) {
                if (p.pid != Process.myPid() && !p.processName.endsWith(":nfs")) {
                    Process.killProcess(p.pid);
                    any = true;
                }
            }
        }
        return any;
    }

    @Override
    protected void onResume() {
        super.onResume();
        resumed = true;
        immersive();
        stopService(new Intent(this, BubbleService.class)); // voltou ao app: a bolha só existe durante o jogo
        // A tela inicial está na frente: nenhum jogo pode ficar rodando por trás (menos o que acabou de ser aberto,
        // enquanto a tela dele ainda está entrando).
        if (SystemClock.uptimeMillis() - launchedAt > 5000) closeGame(this, getTaskId());
        home.onResume();
        home.evaluateJavascript("window.audioOn && audioOn(true); window.showHome && showHome()", null);
        if (pendingGame != null) { String g = pendingGame; pendingGame = null; launchGame(g); }
        refreshHome();
        // Versão nova: ao abrir, ao voltar à tela inicial e de hora em hora com ela na frente (durante o jogo, nada).
        if (SystemClock.uptimeMillis() - updateCheckedAt > 60000 || updateCheckedAt == 0) checkUpdate();
        ui.removeCallbacks(hourlyCheck);
        ui.postDelayed(hourlyCheck, UPDATE_EVERY_MS);
        scheduleRetry();
    }

    @Override
    protected void onPause() {
        super.onPause();
        resumed = false;
        ui.removeCallbacks(hourlyCheck);
        ui.removeCallbacks(retryTick);
        // Saiu da tela inicial: sem áudio local e sem a página rodando por baixo do jogo.
        home.evaluateJavascript("window.audioOn && audioOn(false)", null);
        home.onPause();
    }

    private void refreshHome() { if (home != null) home.evaluateJavascript("window.refresh && refresh()", null); }

    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) immersive(); }

    // ───────────────────────── Versão nova ─────────────────────────
    private final Runnable hourlyCheck = new Runnable() {
        @Override public void run() {
            checkUpdate();
            ui.postDelayed(this, UPDATE_EVERY_MS);
        }
    };

    static String download(String address, int maxBytes) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(address).openConnection();
        c.setConnectTimeout(8000);
        c.setReadTimeout(8000);
        c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) NFSLauncher");
        try (InputStream in = c.getInputStream()) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            for (int n; out.size() < maxBytes && (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } finally {
            c.disconnect();
        }
    }

    // Compara versões número a número ("1.10.0" é maior que "1.9.9").
    static int compareVersions(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < 3; i++) {
            int d = Integer.parseInt(x[i]) - Integer.parseInt(y[i]);
            if (d != 0) return d;
        }
        return 0;
    }

    // A versão de APK mais nova da lista da pasta, se for maior que a instalada; senão null.
    static String newerApk(String html, String current) {
        String best = null;
        Matcher m = APK_NAME.matcher(html);
        while (m.find()) if (best == null || compareVersions(m.group(1), best) > 0) best = m.group(1);
        return best != null && compareVersions(best, current) > 0 ? best : null;
    }

    private void checkUpdate() {
        if ("checking".equals(updateStatus)) return;
        updateCheckedAt = SystemClock.uptimeMillis();
        boolean had = "new".equals(updateStatus);
        if (!had) updateStatus = "checking"; // o botão de baixar não some enquanto verifica de novo
        refreshHome();
        new Thread(() -> {
            String status, version = updateVersion;
            try {
                String v = newerApk(download(LIST_URL, 512 * 1024), VERSION);
                status = v != null ? "new" : "none";
                if (v != null) version = v;
            } catch (Exception e) {
                status = had ? "new" : "error";
            }
            String s = status, ver = version;
            ui.post(() -> { updateStatus = s; updateVersion = ver; refreshHome(); });
        }).start();
    }

    private void openUpdates() {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(FOLDER_URL)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (ActivityNotFoundException e) {
            toast(tr("Nenhum navegador encontrado neste celular.", "No browser found on this phone."));
        }
    }

    // Abre Download/NFS Launcher no app de arquivos; quem não abrir pasta direto cai na lista de downloads.
    private void openSaves() {
        Uri dir = Uri.parse("content://com.android.externalstorage.documents/document/primary%3ADownload%2FNFS%20Launcher");
        try {
            startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(dir, "vnd.android.document/directory")
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION));
        } catch (ActivityNotFoundException | SecurityException e) {
            try {
                startActivity(new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (ActivityNotFoundException e2) {
                toast(tr("Abra o app de arquivos: Download/NFS Launcher.", "Open the files app: Download/NFS Launcher."));
            }
        }
    }

    // ───────────────────────── Erro ao abrir o jogo ─────────────────────────
    // Quem falhou volta para cá; a cada 5 s vê se o site responde e, respondendo, abre o jogo sozinho.
    private final Runnable retryTick = () -> {
        String url = gameOf(prefs.getString("game", DEFAULT_GAME)).url;
        new Thread(() -> {
            boolean ok = false;
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(4000);
                c.setReadTimeout(4000);
                c.setRequestMethod("HEAD");
                ok = c.getResponseCode() < 500;
                c.disconnect();
            } catch (Exception ignored) { }
            boolean back = ok;
            ui.post(() -> {
                if (error == null || !resumed) return;
                if (back) retryNow(); else scheduleRetry();
            });
        }).start();
    };
    private void scheduleRetry() {
        ui.removeCallbacks(retryTick);
        if (error != null && !"crash".equals(error) && resumed) ui.postDelayed(retryTick, RETRY_MS);
    }
    private void retryNow() {
        error = null;
        ui.removeCallbacks(retryTick);
        refreshHome();
        launchGame(prefs.getString("game", DEFAULT_GAME));
    }

    // ───────────────────────── Personalização ─────────────────────────
    // Fundo da tela inicial e capa (CD) de cada jogo. A imagem escolhida é REFEITA pelo app (como no PC) e o motor
    // lê os mesmos arquivos para a tela de carregar.
    private File customFile(String game, String kind) {
        return new File(new File(getFilesDir(), "custom"), game + "-" + kind + ("bg".equals(kind) ? ".jpg" : ".png"));
    }
    private boolean validCustom(String game, String kind) {
        if (!"bg".equals(kind) && !"disc".equals(kind)) return false;
        for (Game g : GAMES) if (g.id.equals(game)) return true;
        return false;
    }
    private void pickImage(String game, String kind) {
        pickGame = game; pickKind = kind;
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*")
                .putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/png", "image/jpeg"});
        try { startActivityForResult(i, REQ_IMAGE); }
        catch (ActivityNotFoundException e) { toast(tr("Nenhum app de arquivos encontrado.", "No files app found.")); }
    }
    @Override
    protected void onActivityResult(int req, int result, Intent data) {
        super.onActivityResult(req, result, data);
        if (req != REQ_IMAGE || result != RESULT_OK || data == null || data.getData() == null) return;
        Uri uri = data.getData();
        String game = pickGame, kind = pickKind;
        new Thread(() -> {
            boolean ok = saveImage(uri, game, kind);
            ui.post(() -> {
                if (ok) customRev++;
                toast(ok ? tr("Imagem salva.", "Image saved.") : tr("Não deu para usar essa imagem. Use PNG ou JPG de até 30 MB.", "Could not use this image. Use a PNG or JPG up to 30 MB."));
                refreshHome();
            });
        }).start();
    }
    // Fundo: cabe em 1920×1080 (sem aumentar). Capa: quadrado do meio em 320×320.
    private boolean saveImage(Uri uri, String game, String kind) {
        try {
            byte[] raw;
            try (InputStream in = getContentResolver().openInputStream(uri)) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[65536];
                for (int n; (n = in.read(buf)) > 0; ) {
                    out.write(buf, 0, n);
                    if (out.size() > MAX_IMAGE_BYTES) return false;
                }
                raw = out.toByteArray();
            }
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(raw, 0, raw.length, o);
            if (o.outWidth <= 0 || o.outHeight <= 0) return false;
            boolean bg = "bg".equals(kind);
            int maxW = bg ? 1920 : 320, maxH = bg ? 1080 : 320;
            o.inSampleSize = 1;
            while (o.outWidth / (o.inSampleSize * 2) >= maxW && o.outHeight / (o.inSampleSize * 2) >= maxH) o.inSampleSize *= 2;
            o.inJustDecodeBounds = false;
            Bitmap b = BitmapFactory.decodeByteArray(raw, 0, raw.length, o);
            if (b == null) return false;
            Bitmap done;
            if (bg) {
                float s = Math.min(1f, Math.min((float) maxW / b.getWidth(), (float) maxH / b.getHeight()));
                done = Bitmap.createScaledBitmap(b, Math.max(1, Math.round(b.getWidth() * s)), Math.max(1, Math.round(b.getHeight() * s)), true);
            } else {
                int side = Math.min(b.getWidth(), b.getHeight());
                Bitmap sq = Bitmap.createBitmap(b, (b.getWidth() - side) / 2, (b.getHeight() - side) / 2, side, side);
                done = Bitmap.createScaledBitmap(sq, 320, 320, true);
            }
            File f = customFile(game, kind);
            File dir = f.getParentFile();
            if (dir != null && !dir.isDirectory() && !dir.mkdirs()) return false;
            File tmp = new File(f.getPath() + ".tmp");
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                if (!done.compress(bg ? Bitmap.CompressFormat.JPEG : Bitmap.CompressFormat.PNG, 85, out)) return false;
            }
            return tmp.renameTo(f);
        } catch (Exception | OutOfMemoryError e) {
            return false;
        }
    }

    private void immersive() {
        getWindow().setDecorFitsSystemWindows(false);
        WindowInsetsController c = getWindow().getInsetsController();
        if (c != null) {
            c.hide(WindowInsets.Type.systemBars());
            c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (guide != null) { closeGuide(); return; }
        home.evaluateJavascript("window.goBack ? goBack() : 'exit'", v -> { if ("\"exit\"".equals(v)) finish(); });
    }

    // ───────────────────────── Tela inicial (página local) ─────────────────────────
    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private WebView newLocalView() {
        WebView w = new WebView(this);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // idioma e letra das dicas (como no PC)
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false); // som da abertura, como no PC
        w.addJavascriptInterface(new HomeBridge(), "launcher");
        w.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return true; }
        });
        w.setWebChromeClient(new WebChromeClient());
        w.setOverScrollMode(View.OVER_SCROLL_NEVER);
        w.setBackgroundColor(Color.parseColor("#0B0D17"));
        return w;
    }

    private JSONObject state() {
        JSONObject o = new JSONObject();
        try {
            o.put("lang", lang());
            o.put("game", prefs.getString("game", DEFAULT_GAME));
            o.put("bubble", prefs.getBoolean("bubble", true));
            o.put("sounds", true); // sempre ligados, como no PC, mesmo para quem tinha desligado
            o.put("prepareGame", prefs.getBoolean("prepareGame", false));
            if (error != null) {
                o.put("error", error);
                o.put("dnsFailed", dnsFailed);
                o.put("dnsOffer", offersDns(error) && !dnsFailed && activeDns().isEmpty());
            }
            JSONArray arr = new JSONArray();
            JSONObject custom = new JSONObject();
            for (Game g : GAMES) {
                JSONObject j = new JSONObject();
                j.put("id", g.id); j.put("short", g.shortName); j.put("name", g.name);
                j.put("disc", g.disc); j.put("tips", g.tips);
                arr.put(j);
                JSONObject c = new JSONObject();
                c.put("bg", customFile(g.id, "bg").exists());
                c.put("disc", customFile(g.id, "disc").exists());
                custom.put(g.id, c);
            }
            o.put("games", arr);
            o.put("custom", custom);
            o.put("customRev", customRev);
            JSONObject u = new JSONObject();
            u.put("status", updateStatus);
            u.put("version", updateVersion);
            o.put("update", u);
            o.put("version", VERSION);
            long free = getFilesDir().getUsableSpace();
            if (free > 0 && free < LOW_DISK_BYTES) o.put("lowDiskGb", Math.round(free / 107374182.4) / 10.0);
            o.put("lastCopy", SaveCopy.lastCopy(this));
        } catch (Exception ignored) { }
        return o;
    }

    final class HomeBridge {
        @JavascriptInterface public String state() { return MainActivity.this.state().toString(); }
        @JavascriptInterface public void start(String id) { runOnUiThread(() -> startGame(id)); }
        @JavascriptInterface public void setLang(String l) {
            if (!"pt".equals(l) && !"en".equals(l)) return;
            prefs.edit().putString("lang", l).apply();
            runOnUiThread(() -> home.evaluateJavascript("window.refresh && refresh()", null));
        }
        @JavascriptInterface public void setOption(String key, boolean on) {
            if (!"bubble".equals(key) && !"prepareGame".equals(key)) return;
            prefs.edit().putBoolean(key, on).commit(); // commit: o processo do jogo lê este arquivo ao abrir
            runOnUiThread(MainActivity.this::refreshHome);
        }
        @JavascriptInterface public void setFont(double f) { prefs.edit().putFloat("font", (float) f).apply(); }
        @JavascriptInterface public void checkUpdate() { runOnUiThread(MainActivity.this::checkUpdate); }
        @JavascriptInterface public void openUpdates() { runOnUiThread(MainActivity.this::openUpdates); }
        @JavascriptInterface public void openSaves() { runOnUiThread(MainActivity.this::openSaves); }
        @JavascriptInterface public void openAppSettings() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
                } catch (ActivityNotFoundException ignored) { }
            });
        }
        @JavascriptInterface public void retry() { runOnUiThread(MainActivity.this::retryNow); }
        @JavascriptInterface public void trySecureDns() { runOnUiThread(MainActivity.this::trySecureDns); }
        @JavascriptInterface public void clearError() {
            runOnUiThread(() -> { error = null; dnsFailed = false; ui.removeCallbacks(retryTick); refreshHome(); });
        }
        @JavascriptInterface public void pickImage(String game, String kind) {
            if (validCustom(game, kind)) runOnUiThread(() -> MainActivity.this.pickImage(game, kind));
        }
        @JavascriptInterface public void resetImage(String game, String kind) {
            if (!validCustom(game, kind)) return;
            runOnUiThread(() -> { if (customFile(game, kind).delete()) customRev++; refreshHome(); });
        }
        @JavascriptInterface public String customImage(String game, String kind) {
            if (!validCustom(game, kind)) return "";
            try {
                byte[] b = Files.readAllBytes(customFile(game, kind).toPath());
                return "data:image/" + ("bg".equals(kind) ? "jpeg" : "png") + ";base64," + Base64.encodeToString(b, Base64.NO_WRAP);
            } catch (IOException e) { return ""; }
        }
        @JavascriptInterface public void openGuide(String id) {
            if (id == null || !id.matches("^[gt]\\d{1,2}$")) return;
            runOnUiThread(() -> openGuideInApp(id));
        }
        @JavascriptInterface public void quit() {
            runOnUiThread(() -> { closeGame(MainActivity.this, getTaskId()); finishAndRemoveTask(); });
        }
    }

    private void toast(String t) { Toast.makeText(this, t, Toast.LENGTH_SHORT).show(); }

    // ───────────────────────── START ─────────────────────────
    private void startGame(String id) {
        Game g = gameOf(id);
        prefs.edit().putString("game", g.id).apply(); // o próximo START já vem com este jogo marcado
        boolean wantBubble = prefs.getBoolean("bubble", true);
        if (wantBubble && !Settings.canDrawOverlays(this) && !prefs.getBoolean("overlayAsked", false)) {
            new AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                    .setTitle(tr("Bolha de dicas", "Tips bubble"))
                    .setMessage(tr("Para mostrar a bolha (guia e voltar ao início) por cima do jogo, o Android pede a permissão "
                                    + "\"Sobrepor a outros apps\". Ligue para o NFS Launcher e volte. Em celulares Xiaomi, ligue "
                                    + "também \"Exibir janelas pop-up enquanto executa em segundo plano\".",
                            "To show the bubble (guide and back to home) over the game, Android asks for the \"Display over "
                                    + "other apps\" permission. Turn it on for NFS Launcher and come back."))
                    .setPositiveButton(tr("Permitir", "Allow"), (d, w) -> {
                        prefs.edit().putBoolean("overlayAsked", true).apply();
                        pendingGame = g.id;
                        try {
                            startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())));
                        } catch (ActivityNotFoundException e) { pendingGame = null; launchGame(g.id); }
                    })
                    .setNegativeButton(tr("Agora não", "Not now"), (d, w) -> {
                        prefs.edit().putBoolean("overlayAsked", true).apply();
                        launchGame(g.id);
                    })
                    .show();
            return;
        }
        launchGame(g.id);
    }

    private void launchGame(String id) {
        Game g = gameOf(id);
        closeGuide();
        // A tela de carregar do motor lê estes valores em outro processo: precisam estar no arquivo antes de abrir.
        prefs.edit().putString("game", g.id).putString("gameName", g.name).commit();
        home.evaluateJavascript("window.showLoading && showLoading('" + g.id + "')", null);
        // Só um jogo por vez: o anterior é encerrado por completo antes (e o motor espera ele sair).
        boolean wasOpen = closeGame(this, getTaskId());
        root.postDelayed(() -> {
            if (prefs.getBoolean("bubble", true) && Settings.canDrawOverlays(this)) {
                startService(new Intent(this, BubbleService.class).putExtra(BubbleService.EXTRA_TIPS, g.tips));
            }
            launchInMotor(g);
        }, wasOpen ? 500 : 0);
    }

    /**
     * Abre o site como Trusted Web Activity no motor deste mesmo app (sem barra nenhuma, tela cheia imersiva).
     * O motor confia neste app (mesmo pacote e mesma assinatura) no lugar do arquivo de autorização do site.
     */
    private CustomTabsServiceConnection motorConn;
    private long launchedAt = -10000;
    private void launchInMotor(Game g) {
        launchedAt = SystemClock.uptimeMillis();
        if (motorConn != null) { try { unbindService(motorConn); } catch (Exception ignored) { } motorConn = null; }
        motorConn = new CustomTabsServiceConnection() {
            @Override
            public void onCustomTabsServiceConnected(@NonNull ComponentName name, @NonNull CustomTabsClient client) {
                client.warmup(0);
                CustomTabsSession session = client.newSession(null);
                if (session == null) { motorFailed(); return; }
                Intent twa = new TrustedWebActivityIntentBuilder(Uri.parse("en".equals(lang()) ? g.url : g.startUrl))
                        .setScreenOrientation(ScreenOrientation.LANDSCAPE) // jogos de corrida: deitado
                        .setDisplayMode(new TrustedWebActivityDisplayMode.ImmersiveMode(false,
                                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES))
                        .setDefaultColorSchemeParams(new CustomTabColorSchemeParams.Builder()
                                .setToolbarColor(Color.parseColor("#0B0D17"))
                                .setNavigationBarColor(Color.BLACK).build())
                        .build(session)
                        .getIntent();
                twa.setComponent(new ComponentName(getPackageName(), MOTOR_ENTRY));
                try { startActivity(twa); } catch (ActivityNotFoundException e) { motorFailed(); }
            }
            @Override public void onServiceDisconnected(ComponentName name) { }
        };
        if (!CustomTabsClient.bindCustomTabsService(this, getPackageName(), motorConn)) { motorConn = null; motorFailed(); }
    }

    private void motorFailed() {
        stopService(new Intent(this, BubbleService.class));
        home.evaluateJavascript("window.showHome && showHome()", null);
        toast(tr("Não consegui abrir o jogo. Feche o app e tente de novo.", "Could not open the game. Close the app and try again."));
    }

    // ───────────────────────── Guia dentro do app ─────────────────────────
    private void openGuideInApp(String id) {
        closeGuide();
        guide = new GuideView(this, new GuideView.Host() {
            @Override public void dragBy(float dx, float dy) {
                FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) guide.getLayoutParams();
                lp.leftMargin = GuideView.inside(lp.leftMargin + (int) dx, lp.width, root.getWidth());
                lp.topMargin = GuideView.inside(lp.topMargin + (int) dy, lp.height, root.getHeight());
                guide.setLayoutParams(lp);
            }
            @Override public void closeGuide() { MainActivity.this.closeGuide(); }
            @Override public void resize(int w, int h) { // A+/A−: a caixa acompanha a escala e continua na tela
                if (guide == null) return;
                FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) guide.getLayoutParams();
                lp.width = w; lp.height = h;
                lp.leftMargin = GuideView.inside(lp.leftMargin, w, root.getWidth());
                lp.topMargin = GuideView.inside(lp.topMargin, h, root.getHeight());
                guide.setLayoutParams(lp);
            }
        }, id);
        int[] size = GuideView.size(this); // ~1/6 da tela na escala padrão; o texto rola dentro
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(size[0], size[1], Gravity.TOP | Gravity.START);
        lp.leftMargin = (root.getWidth() - size[0]) / 2;
        lp.topMargin = (int) dp(60);
        root.addView(guide, lp);
    }
    private void closeGuide() { if (guide != null) { root.removeView(guide); guide = null; } }

    @Override
    protected void onDestroy() {
        ui.removeCallbacksAndMessages(null);
        if (motorConn != null) { try { unbindService(motorConn); } catch (Exception ignored) { } motorConn = null; }
        if (home != null) home.destroy();
        super.onDestroy();
    }
}
