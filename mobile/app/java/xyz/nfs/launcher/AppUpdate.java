package xyz.nfs.launcher;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.net.ConnectivityManager;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Versão nova do app pelo GitHub (pedido do Bruno, 08/11; igual ao PC): lê mobile/atualizacao.json do repositório e
 * baixa o APK só das releases dele, conferindo o SHA-256. No Wi-Fi baixa sozinho com a tela inicial na frente; nos dados
 * móveis, só pelo botão. Durante o jogo, nada. Instalar só pelo botão "Atualizar agora" (o Android confirma; o app fecha
 * e a nova versão entra por cima, com os saves, o login e as texturas).
 */
final class AppUpdate {
    static final String URL = Downloads.RAW + "atualizacao.json";
    static final long MAX_APK = 600L * 1024 * 1024;
    static final String ACTION_INSTALLED = "xyz.nfs.launcher.INSTALADO";

    static final class Info {
        final String version, url, sha256, notesPt, notesEn;
        final long size;
        Info(String v, String u, long s, String h, String pt, String en) { version = v; url = u; size = s; sha256 = h; notesPt = pt; notesEn = en; }
    }

    private AppUpdate() { }

    /** A versão publicada, se for maior que a instalada e com arquivo, tamanho e SHA-256 válidos; senão null. */
    static Info parse(String json, String current) {
        try {
            JSONObject o = new JSONObject(json);
            String v = o.optString("versao"), url = o.optString("arquivo"), sha = o.optString("sha256");
            long size = o.optLong("tamanho", 0);
            if (!v.matches("^\\d{1,4}\\.\\d{1,4}\\.\\d{1,4}$") || MainActivity.compareVersions(v, current) <= 0) return null;
            if (!Downloads.okAsset(url, ".apk") || size <= 0 || size > MAX_APK || !Downloads.SHA.matcher(sha).matches()) return null;
            JSONObject n = o.optJSONObject("novidades");
            return new Info(v, url, size, sha.toLowerCase(java.util.Locale.ROOT),
                    n == null ? "" : n.optString("pt"), n == null ? "" : n.optString("en"));
        } catch (Exception e) { return null; }
    }

    static Info check(String current) throws IOException { return parse(Downloads.text(URL, 64 * 1024), current); }

    static File dir(Context c) { return new File(c.getCacheDir(), "atualizacao"); }
    static File fileOf(Context c, Info u) { return new File(dir(c), "NFS-Launcher-Android-" + u.version + ".apk"); }

    /** Já baixado e conferido. */
    static boolean ready(Context c, Info u) { return u != null && u.sha256.equals(Downloads.savedSha(fileOf(c, u))); }

    /** Tira da pasta as versões que não são esta (inclusive a instalada, que já não serve). */
    static void clean(Context c, Info keep) {
        File[] kids = dir(c).listFiles();
        if (kids == null) return;
        String name = keep == null ? "" : fileOf(c, keep).getName();
        for (File k : kids) if (!k.getName().startsWith(name) || name.isEmpty()) //noinspection ResultOfMethodCallIgnored
            k.delete();
    }

    /** Rede sem cobrança por uso (Wi-Fi): pode baixar sozinho. */
    static boolean freeNetwork(Context c) {
        ConnectivityManager cm = c.getSystemService(ConnectivityManager.class);
        return cm != null && cm.getActiveNetwork() != null && !cm.isActiveNetworkMetered();
    }

    /** Entrega o APK conferido ao instalador do Android. A resposta volta para a MainActivity (ACTION_INSTALLED). */
    static void install(Activity a, Info u) throws IOException {
        File f = fileOf(a, u);
        if (!ready(a, u)) throw new IOException("arquivo");
        PackageInstaller pi = a.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams p = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        p.setAppPackageName(a.getPackageName());
        p.setSize(f.length());
        p.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        int id = pi.createSession(p);
        try (PackageInstaller.Session s = pi.openSession(id)) {
            try (InputStream in = new FileInputStream(f); OutputStream out = s.openWrite("app.apk", 0, f.length())) {
                byte[] buf = new byte[1 << 16];
                for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
                s.fsync(out);
            }
            Intent back = new Intent(a, MainActivity.class).setAction(ACTION_INSTALLED);
            PendingIntent pend = PendingIntent.getActivity(a, id, back, PendingIntent.FLAG_MUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            s.commit(pend.getIntentSender());
        } catch (IOException | RuntimeException e) {
            try { pi.abandonSession(id); } catch (Exception ignored) { }
            throw e;
        }
    }
}
