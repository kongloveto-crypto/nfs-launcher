package xyz.nfs.launcher;

import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Registro de quedas (pedido do Bruno, 08/11), como o do PC (pc/src/main/crashLog.js): quando o jogo volta à tela inicial
 * com erro, ou o Android conta que um processo do app caiu com o jogo na frente, guarda só o tipo, o motivo, o código,
 * o jogo e a hora. Fica em files/quedas.json, aparece em Configurações > Avançado (com botão de copiar) e nunca é
 * enviado a lugar nenhum. Sem dados pessoais.
 */
final class CrashLog {
    private CrashLog() { }

    static final int MAX = 30;
    private static final String FILE = "quedas.json";
    private static final String SEEN = "exitSeen"; // hora da última saída de processo já lida

    private static File file(Context c) { return new File(c.getFilesDir(), FILE); }

    static synchronized JSONArray load(Context c) {
        try (InputStream in = new FileInputStream(file(c))) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] b = new byte[8192];
            for (int n; (n = in.read(b)) > 0; ) out.write(b, 0, n);
            return new JSONArray(new String(out.toByteArray(), StandardCharsets.UTF_8));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static void save(Context c, JSONArray a) {
        File f = file(c), tmp = new File(c.getFilesDir(), FILE + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(a.toString().getBytes(StandardCharsets.UTF_8));
            out.getFD().sync();
        } catch (IOException e) {
            return;
        }
        if (!tmp.renameTo(f)) tmp.delete();
    }

    static synchronized void add(Context c, long when, String kind, String reason, int code, String game) {
        try {
            JSONArray a = load(c);
            a.put(new JSONObject().put("when", when).put("kind", kind).put("reason", reason).put("code", code)
                    .put("game", game == null ? "" : game));
            JSONArray out = new JSONArray();
            for (int i = Math.max(0, a.length() - MAX); i < a.length(); i++) out.put(a.get(i));
            save(c, out);
        } catch (Exception ignored) { } // o registro nunca atrapalha o app
    }

    /** O jogo voltou à tela inicial com erro (código do motor: -1 = a página do jogo caiu, 500+ = servidor, outros = rede). */
    static void gameError(Context c, int code, String game) {
        String reason = code == -1 ? "crash" : code >= 500 ? "server" : "network";
        add(c, System.currentTimeMillis(), "jogo", reason, code, game);
    }

    /**
     * Lê o que o Android guardou sobre processos do app que morreram desde a última leitura (Android 11+). Só entra
     * queda de verdade (falha, travamento, falta de memória) com o processo na frente ou visível: o Android liberar a
     * tela inicial enquanto o jogo roda é normal e não conta.
     */
    static void readExits(Context c, SharedPreferences prefs, String game) {
        try {
            ActivityManager am = c.getSystemService(ActivityManager.class);
            if (am == null) return;
            long seen = prefs.getLong(SEEN, 0), newest = seen;
            List<ApplicationExitInfo> list = am.getHistoricalProcessExitReasons(c.getPackageName(), 0, 30);
            List<ApplicationExitInfo> fresh = new ArrayList<>();
            for (ApplicationExitInfo x : list) {
                if (x.getTimestamp() <= seen) continue;
                newest = Math.max(newest, x.getTimestamp());
                fresh.add(x);
            }
            prefs.edit().putLong(SEEN, newest).apply();
            if (seen == 0) return; // primeira vez: só marca o ponto de partida (o que veio antes não é desta versão)
            for (int i = fresh.size() - 1; i >= 0; i--) { // mais antiga primeiro
                ApplicationExitInfo x = fresh.get(i);
                String reason = reasonOf(x.getReason());
                if (reason == null) continue;
                boolean crash = "crash".equals(reason) || "native".equals(reason) || "anr".equals(reason);
                if (!crash && x.getImportance() > ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE) continue;
                add(c, x.getTimestamp(), kindOf(c, x.getProcessName()), reason, x.getStatus(), game);
            }
        } catch (Exception ignored) { }
    }

    private static String reasonOf(int r) {
        switch (r) {
            case ApplicationExitInfo.REASON_CRASH: return "crash";
            case ApplicationExitInfo.REASON_CRASH_NATIVE: return "native";
            case ApplicationExitInfo.REASON_ANR: return "anr";
            case ApplicationExitInfo.REASON_LOW_MEMORY: return "memory";
            case ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE: return "resources";
            case ApplicationExitInfo.REASON_INITIALIZATION_FAILURE: return "init";
            default: return null; // fechado pelo jogador, pelo próprio app ou pelo sistema sem problema
        }
    }

    private static String kindOf(Context c, String proc) {
        String p = proc == null ? "" : proc;
        if (p.endsWith(":nfs")) return "tela";
        if (p.contains("privileged_process")) return "GPU";
        if (p.contains("sandboxed_process")) return "jogo";
        return "motor";
    }

    /** Linhas para a tela, mais nova primeiro. */
    static List<String> lines(Context c, boolean en) {
        List<String> out = new ArrayList<>();
        JSONArray a = load(c);
        SimpleDateFormat f = new SimpleDateFormat("dd/MM HH:mm", Locale.US);
        for (int i = a.length() - 1; i >= 0 && out.size() < 15; i--) {
            JSONObject o = a.optJSONObject(i);
            if (o == null) continue;
            StringBuilder s = new StringBuilder(f.format(new Date(o.optLong("when"))));
            s.append(" · ").append(kindText(o.optString("kind"), en)).append(" · ").append(reasonText(o.optString("reason"), en));
            int code = o.optInt("code", 0);
            if (code != 0) s.append(" · ").append(en ? "code " : "código ").append(code);
            String g = o.optString("game");
            if (!g.isEmpty()) s.append(" · ").append(g);
            out.add(s.toString());
        }
        return out;
    }

    private static String kindText(String k, boolean en) {
        switch (k) {
            case "jogo": return en ? "game page" : "página do jogo";
            case "GPU": return en ? "graphics" : "parte gráfica";
            case "tela": return en ? "home screen" : "tela inicial";
            case "motor": return en ? "engine" : "motor";
            default: return k;
        }
    }

    private static String reasonText(String r, boolean en) {
        switch (r) {
            case "crash": return en ? "crashed" : "caiu";
            case "native": return en ? "engine failure" : "falha do motor";
            case "anr": return en ? "stopped responding" : "parou de responder";
            case "memory": return en ? "out of memory" : "faltou memória";
            case "resources": return en ? "used too much battery or CPU" : "gastou bateria ou processador demais";
            case "init": return en ? "did not open" : "não abriu";
            case "server": return en ? "server error" : "erro do servidor";
            case "network": return en ? "connection lost" : "conexão caiu";
            default: return r;
        }
    }
}
