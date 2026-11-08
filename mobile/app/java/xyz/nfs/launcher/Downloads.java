package xyz.nfs.launcher;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

/**
 * Downloads do app (desde a 1.6.4, igual ao PC, src/main/github.js e downloader.js): só do repositório do NFS Launcher
 * no GitHub. As listas (atualizacao.json, texturas.json) vêm do ramo principal; os arquivos, só das releases dele.
 * Cada arquivo baixa para ".parte" e continua de onde parou; só fica no lugar com o tamanho e o SHA-256 publicados.
 */
final class Downloads {
    static final String REPO = "vtrspeedman-cell/nfs-launcher";
    static final String RAW = "https://raw.githubusercontent.com/" + REPO + "/main/mobile/";
    static final String RELEASES_URL = "https://github.com/" + REPO + "/releases";
    private static final String ASSETS = RELEASES_URL + "/download/";
    private static final Pattern ASSET_PATH = Pattern.compile("^[A-Za-z0-9._-]{1,64}/[A-Za-z0-9._-]{1,120}$");
    static final Pattern SHA = Pattern.compile("^[0-9a-fA-F]{64}$");
    private static final String UA = "Mozilla/5.0 (Linux; Android) NFSLauncher";

    private Downloads() { }

    /** Endereço de um arquivo das releases deste repositório, com a extensão pedida (nada de outro site). */
    static boolean okAsset(String url, String ext) {
        if (url == null || !url.startsWith(ASSETS)) return false;
        String rest = url.substring(ASSETS.length());
        return ASSET_PATH.matcher(rest).matches() && !rest.contains("..") && rest.toLowerCase(Locale.ROOT).endsWith(ext);
    }

    private static HttpURLConnection open(String address, int timeoutMs) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(address).openConnection();
        c.setConnectTimeout(timeoutMs);
        c.setReadTimeout(timeoutMs);
        c.setInstanceFollowRedirects(true); // as releases mandam para o servidor de arquivos do GitHub (sempre https)
        c.setRequestProperty("User-Agent", UA);
        return c;
    }

    /** Texto curto (as listas JSON). */
    static String text(String address, int maxBytes) throws IOException {
        HttpURLConnection c = open(address + "?t=" + (System.currentTimeMillis() / 60000), 8000); // sem cópia velha no caminho
        try {
            if (c.getResponseCode() != 200) throw new IOException("http " + c.getResponseCode());
            try (InputStream in = c.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[16384];
                for (int n; (n = in.read(buf)) > 0; ) {
                    out.write(buf, 0, n);
                    if (out.size() > maxBytes) throw new IOException("grande demais");
                }
                return new String(out.toByteArray(), StandardCharsets.UTF_8);
            }
        } finally { c.disconnect(); }
    }

    interface Progress { void on(long done, long total); }

    static final class Failed extends IOException {
        final String code; // http, size, sha, cancel
        Failed(String code) { super(code); this.code = code; }
    }

    static File partOf(File dest) { return new File(dest.getPath() + ".parte"); }
    static File shaOf(File dest) { return new File(dest.getPath() + ".sha256"); }

    /** SHA-256 guardado ao lado do arquivo (conferido ao baixar), se o arquivo ainda tem o mesmo tamanho. */
    static String savedSha(File dest) {
        try {
            String[] s = new String(Files.readAllBytes(shaOf(dest).toPath()), StandardCharsets.UTF_8).trim().split(" ");
            return s.length == 2 && SHA.matcher(s[0]).matches() && dest.length() == Long.parseLong(s[1]) ? s[0].toLowerCase(Locale.ROOT) : null;
        } catch (Exception e) { return null; }
    }

    static void remove(File dest) {
        //noinspection ResultOfMethodCallIgnored
        dest.delete();
        //noinspection ResultOfMethodCallIgnored
        partOf(dest).delete();
        //noinspection ResultOfMethodCallIgnored
        shaOf(dest).delete();
    }

    static String hash(File f) throws IOException {
        try (InputStream in = new FileInputStream(f)) {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] buf = new byte[1 << 16];
            for (int n; (n = in.read(buf)) > 0; ) md.update(buf, 0, n);
            StringBuilder sb = new StringBuilder();
            for (byte b : md.digest()) sb.append(String.format(Locale.ROOT, "%02x", b));
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) { throw new IOException(e); }
    }

    /** Baixa url em dest (continua o ".parte"), confere tamanho e SHA-256 e só então põe no lugar. */
    static void fetch(String url, File dest, long size, String sha256, AtomicBoolean cancel, Progress p) throws IOException {
        File part = partOf(dest);
        File dir = dest.getParentFile();
        if (dir != null && !dir.isDirectory() && !dir.mkdirs()) throw new IOException("pasta");
        long have = part.isFile() ? part.length() : 0;
        if (have > size) { //noinspection ResultOfMethodCallIgnored
            part.delete(); have = 0; }
        if (have < size) {
            HttpURLConnection c = open(url, 15000);
            try {
                if (have > 0) c.setRequestProperty("Range", "bytes=" + have + "-");
                int code = c.getResponseCode();
                if (code == 200) have = 0; // o servidor mandou o arquivo inteiro: começa de novo
                else if (code != 206) throw new Failed("http");
                try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(part, have > 0)) {
                    byte[] buf = new byte[1 << 16];
                    long last = 0;
                    for (int n; (n = in.read(buf)) > 0; ) {
                        if (cancel != null && cancel.get()) throw new Failed("cancel");
                        if (have + n > size) throw new Failed("size");
                        out.write(buf, 0, n);
                        have += n;
                        long now = System.currentTimeMillis();
                        if (p != null && now - last > 300) { last = now; p.on(have, size); }
                    }
                }
            } finally { c.disconnect(); }
        }
        if (part.length() != size) throw new Failed(part.length() > size ? "size" : "short");
        String got = hash(part);
        if (!got.equalsIgnoreCase(sha256)) { //noinspection ResultOfMethodCallIgnored
            part.delete(); throw new Failed("sha"); }
        //noinspection ResultOfMethodCallIgnored
        shaOf(dest).delete();
        //noinspection ResultOfMethodCallIgnored
        dest.delete();
        if (!part.renameTo(dest)) throw new IOException("renomear");
        Files.write(shaOf(dest).toPath(), (got + " " + size).getBytes(StandardCharsets.UTF_8));
        if (p != null) p.on(size, size);
    }
}
