package xyz.nfs.launcher;

import android.content.Context;
import android.content.SharedPreferences;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Texturas HD do NFSU2 no celular (1.6.4, igual ao PC, src/main/gameSettings.js): o jogo só carrega o pacote de mapa
 * (TEXPACKS/detailed.pak, onde o motor entrega as texturas) com "ui_textures" em map ou uhud no settings.ini dele.
 * Com a opção ligada, troca SÓ essa linha para "ui_textures = map"; desligada, desfaz só o que o app trocou.
 * Vale para os dois NFSU2 (o do site principal e o Modded), cada um no seu arquivo. Roda com o jogo fechado (antes de abrir o motor), guarda cópia do arquivo antes e nunca mexe com
 * NFSU2_MAP_TEXTURES escrito pelo jogador nem com "map"/"uhud" que ele já tinha. Nunca lança erro.
 */
final class GameSettings {
    private static final String UI_LINE = "ui_textures = map";
    private static final Pattern KEY = Pattern.compile("^\\s*ui_textures\\s*=\\s*([^\\s#;]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern MAP_KEY = Pattern.compile("^\\s*NFSU2_MAP_TEXTURES\\s*=", Pattern.CASE_INSENSITIVE);
    private static final String BACKUP = "settings.ini-antes-das-texturas-HD.txt";
    private static final String PREV = "texUiPrev"; // linha que o app trocou ("" = não havia); ausente = nada trocado

    private GameSettings() { }

    private static boolean active(String l) { return !l.matches("^\\s*[#;].*"); }

    private static void walk(File dir, List<File> out) {
        File[] kids = dir.listFiles();
        if (kids == null) return;
        for (File k : kids) {
            if (k.isDirectory()) { if (!k.getName().equals("Paths")) walk(k, out); } // Paths: o banco do navegador, nunca tocado
            else out.add(k);
        }
    }

    private static boolean isSettings(File f) {
        byte[] head = new byte[16];
        try (FileInputStream in = new FileInputStream(f)) {
            return in.read(head) == 16 && new String(head, StandardCharsets.ISO_8859_1).equals("# NFSU2 settings");
        } catch (IOException e) { return false; }
    }

    /**
     * Cada NFSU2 (nfsu2.xyz e o Modded, 09/11) tem o seu settings.ini, numa pasta do navegador (SaveCopy.siteDirs):
     * a linha é tratada em cada um, e o que o app trocou fica guardado por pasta ("texUiPrev:000").
     */
    static void run(Context c, boolean on) {
        try {
            SharedPreferences prefs = c.getSharedPreferences("nfs", Context.MODE_PRIVATE);
            Map<String, String> dirs = SaveCopy.siteDirs(c);
            // Até a 1.6.6 havia um só (o do NFSU2): o que o app tinha trocado passa para a pasta dele.
            if (prefs.contains(PREV)) {
                List<String> u2 = new ArrayList<>();
                for (Map.Entry<String, String> e : dirs.entrySet()) if ("nfsu2".equals(e.getValue())) u2.add(e.getKey());
                if (u2.size() == 1) prefs.edit().putString(PREV + ":" + u2.get(0), prefs.getString(PREV, "")).remove(PREV).commit();
            }
            for (File o : SaveCopy.originDirs(c)) {
                if (!dirs.containsKey(o.getName())) continue;
                try { runDir(c, prefs, o, on); } catch (Exception | OutOfMemoryError ignored) { }
            }
        } catch (Exception | OutOfMemoryError ignored) { }
    }

    private static void runDir(Context c, SharedPreferences prefs, File origin, boolean on) throws IOException {
        String key = PREV + ":" + origin.getName();
        String prev = prefs.contains(key) ? prefs.getString(key, "") : null;
        if (!on && prev == null) return; // desligada e nada trocado: nem procura
        List<File> files = new ArrayList<>();
        walk(new File(origin, "t"), files);
        List<File> found = new ArrayList<>();
        for (File f : files) if (f.length() >= 20 && f.length() <= 200000 && isSettings(f)) found.add(f);
        if (found.size() != 1) return; // nenhum (jogo nunca aberto) ou mais de um: não escreve nada
        File file = found.get(0);
        String text = new String(Files.readAllBytes(file.toPath()), StandardCharsets.ISO_8859_1);
        String nl = text.contains("\r\n") ? "\r\n" : "\n";
        List<String> lines = new ArrayList<>(java.util.Arrays.asList(text.split("\r?\n", -1)));
        int i = -1;
        for (int k = 0; k < lines.size(); k++) if (active(lines.get(k)) && KEY.matcher(lines.get(k)).find()) { i = k; break; }
        String val = "";
        if (i >= 0) { Matcher m = KEY.matcher(lines.get(i)); if (m.find()) val = m.group(1).toLowerCase(java.util.Locale.ROOT); }
        boolean uiOn = val.equals("map") || val.equals("uhud");
        for (String l : lines) if (active(l) && MAP_KEY.matcher(l).find()) return; // mapa escolhido pelo jogador
        String newPrev;
        if (on) {
            if (uiOn) return;
            newPrev = i >= 0 ? lines.get(i) : "";
            if (i >= 0) lines.set(i, UI_LINE);
            else {
                while (!lines.isEmpty() && lines.get(lines.size() - 1).isEmpty()) lines.remove(lines.size() - 1);
                lines.add(UI_LINE);
                lines.add("");
            }
        } else {
            if (!val.equals("map")) { prefs.edit().remove(key).commit(); return; } // o jogador mudou depois: fica o dele
            newPrev = null;
            if (prev.isEmpty()) lines.remove(i); else lines.set(i, prev);
        }
        // A cópia do NFSU2 continua com o nome de antes; a do Modded ganha o número da pasta.
        File backup = new File(c.getFilesDir(), "nfsu2".equals(SaveCopy.siteDirs(c).get(origin.getName())) ? BACKUP : origin.getName() + "-" + BACKUP);
        Files.write(backup.toPath(), text.getBytes(StandardCharsets.ISO_8859_1));
        // Grava ao lado e troca de uma vez: um arquivo pela metade nunca fica no lugar do settings.ini.
        File tmp = new File(file.getParentFile(), file.getName() + ".nfs-novo");
        Files.write(tmp.toPath(), String.join(nl, lines).getBytes(StandardCharsets.ISO_8859_1));
        Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        if (newPrev == null) prefs.edit().remove(key).commit(); else prefs.edit().putString(key, newPrev).commit();
    }
}
