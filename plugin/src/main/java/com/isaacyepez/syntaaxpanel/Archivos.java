package com.isaacyepez.syntaaxpanel;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.yaml.snakeyaml.Yaml;

/**
 * El apartado «Archivos» del panel: solo dentro de la carpeta del servidor. No se leen claves y, en archivos de
 * configuración, los valores de campos secretos salen tapados y se conservan al guardar.
 */
final class Archivos {
    static final String MASCARA = "••••••";
    private static final long MAX_TEXTO = 1_048_576;
    private static final long MAX_IMAGEN = 2_097_152;
    private static final Set<String> IMAGENES = Set.of("png", "jpg", "jpeg", "gif", "webp");
    private static final Set<String> CLAVES = Set.of("pem", "key", "p12", "pfx", "jks", "keystore");
    // Nombre de campo secreto: termina en password, secret, token o api-key (no «key» a secas: hay muchos inofensivos).
    private static final Pattern SECRETO = Pattern.compile("(?i).*(password|passwd|secret|token|api[-_.]?key|private[-_]?key)\"?'?$");
    private static final Pattern LINEA_YAML = Pattern.compile("^(\\s*(?:-\\s+)?)([\"']?[^\\s:#][^:#]*?[\"']?)(\\s*:\\s+)(.+?)(\\s*)$");
    private static final Pattern LINEA_IGUAL = Pattern.compile("^(\\s*)([^#!;\\s=:][^=:]*?)(\\s*[=:]\\s*)(.*?)(\\s*)$");
    private static final Pattern LINEA_JSON = Pattern.compile("^(\\s*)(\"[^\"]+\")(\\s*:\\s*)(\"(?:[^\"\\\\]|\\\\.)*\")(\\s*,?\\s*)$");

    private final SyntaaxPanel plugin;

    Archivos(SyntaaxPanel plugin) {
        this.plugin = plugin;
    }

    /** La carpeta del servidor (la que tiene plugins/). */
    Path raiz() throws IOException {
        return plugin.getDataFolder().toPath().toAbsolutePath().getParent().getParent().toRealPath();
    }

    private Path resolver(String ruta) throws IOException {
        Path base = raiz();
        Path p = base.resolve(ruta.replace('\\', '/').replaceAll("^/+", "")).normalize();
        if (!p.startsWith(base)) throw new IllegalArgumentException("Esa ruta está fuera de la carpeta del servidor.");
        if (Files.exists(p) && !p.toRealPath().startsWith(base)) throw new IllegalArgumentException("Esa ruta está fuera de la carpeta del servidor.");
        return p;
    }

    private String relativa(Path p) throws IOException {
        return raiz().relativize(p).toString().replace('\\', '/');
    }

    /** Lo que nunca se abre desde el panel: llaves, el túnel, los secretos y la configuración de este plugin. */
    private boolean bloqueado(String rel) {
        String r = rel.toLowerCase(Locale.ROOT);
        String ext = r.contains(".") ? r.substring(r.lastIndexOf('.') + 1) : "";
        return CLAVES.contains(ext) || r.equals("playit") || r.startsWith("playit/") || r.equals("secretos") || r.startsWith("secretos/")
            || r.equals("plugins/syntaaxpanel/config.yml");
    }

    JsonElement listar(String ruta) throws IOException {
        Path dir = resolver(ruta);
        if (!Files.isDirectory(dir)) throw new IllegalArgumentException("Esa carpeta no existe.");
        if (!relativa(dir).isEmpty() && bloqueado(relativa(dir))) throw new SecurityException("Esta carpeta tiene claves y no se abre desde el panel.");
        JsonArray a = new JsonArray();
        List<Path> hijos;
        try (Stream<Path> s = Files.list(dir)) {
            hijos = new ArrayList<>(s.toList());
        }
        hijos.sort((x, y) -> {
            boolean dx = Files.isDirectory(x), dy = Files.isDirectory(y);
            if (dx != dy) return dx ? -1 : 1;
            return x.getFileName().toString().compareToIgnoreCase(y.getFileName().toString());
        });
        for (Path h : hijos.subList(0, Math.min(hijos.size(), 1000))) {
            JsonObject j = new JsonObject();
            String rel = relativa(h);
            j.addProperty("nombre", h.getFileName().toString());
            j.addProperty("ruta", rel);
            j.addProperty("carpeta", Files.isDirectory(h));
            j.addProperty("tamano", Files.isDirectory(h) ? 0 : Files.size(h));
            j.addProperty("modificado", Files.getLastModifiedTime(h).toMillis() / 1000);
            j.addProperty("bloqueado", bloqueado(rel));
            a.add(j);
        }
        JsonObject r = new JsonObject();
        r.addProperty("ruta", relativa(dir));
        r.add("elementos", a);
        r.addProperty("total", hijos.size());
        return r;
    }

    JsonElement leer(String ruta) throws Exception {
        Path p = resolver(ruta);
        String rel = relativa(p);
        if (bloqueado(rel)) throw new SecurityException("Este archivo tiene claves y no se abre desde el panel.");
        if (!Files.isRegularFile(p)) throw new IllegalArgumentException("Ese archivo no existe.");
        long tam = Files.size(p);
        String ext = extension(p);
        JsonObject r = new JsonObject();
        r.addProperty("ruta", rel);
        r.addProperty("tamano", tam);
        r.addProperty("modificado", Files.getLastModifiedTime(p).toMillis() / 1000);
        if (IMAGENES.contains(ext) && tam <= MAX_IMAGEN) {
            r.addProperty("tipo", "imagen");
            r.addProperty("mime", "image/" + (ext.equals("jpg") ? "jpeg" : ext));
            r.addProperty("base64", Base64.getEncoder().encodeToString(Files.readAllBytes(p)));
            return r;
        }
        if (tam > MAX_TEXTO) {
            r.addProperty("tipo", "grande");
            return r;
        }
        byte[] bytes = Files.readAllBytes(p);
        String texto = comoTexto(bytes);
        if (texto == null) {
            r.addProperty("tipo", "binario");
            return r;
        }
        String tapado = tapar(texto, ext);
        r.addProperty("tipo", "texto");
        r.addProperty("contenido", tapado);
        r.addProperty("tapado", !tapado.equals(texto));
        r.addProperty("hash", hash(bytes));
        return r;
    }

    JsonElement guardar(String ruta, String nuevo, String hashLeido) throws Exception {
        Path p = resolver(ruta);
        String rel = relativa(p);
        if (bloqueado(rel)) throw new SecurityException("Este archivo tiene claves y no se edita desde el panel.");
        if (!Files.isRegularFile(p)) throw new IllegalArgumentException("Ese archivo no existe.");
        byte[] actual = Files.readAllBytes(p);
        if (!hash(actual).equals(hashLeido)) throw new IllegalStateException("El archivo cambió en el servidor desde que lo abriste. Ábrelo otra vez.");
        String original = comoTexto(actual);
        if (original == null) throw new IllegalArgumentException("Ese archivo no es de texto.");
        String ext = extension(p);
        String texto = destapar(nuevo, original, ext);
        if (texto.getBytes(StandardCharsets.UTF_8).length > MAX_TEXTO) throw new IllegalArgumentException("El archivo pasa de 1 MB.");
        validar(texto, ext);
        Path copia = raiz().resolve("plugins").resolve(plugin.getDataFolder().getName()).resolve("copias")
            .resolve(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"))).resolve(rel);
        Files.createDirectories(copia.getParent());
        Files.write(copia, actual);
        Path temporal = p.resolveSibling(p.getFileName() + ".panel-tmp");
        Files.writeString(temporal, texto, StandardCharsets.UTF_8);
        Files.move(temporal, p, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        plugin.getLogger().info("Panel: se editó " + rel + " (copia en " + relativa(copia) + ")");
        JsonObject r = new JsonObject();
        r.addProperty("hash", hash(Files.readAllBytes(p)));
        r.addProperty("copia", relativa(copia));
        return r;
    }

    // ---------- ayudas ----------

    private static String extension(Path p) {
        String n = p.getFileName().toString().toLowerCase(Locale.ROOT);
        return n.contains(".") ? n.substring(n.lastIndexOf('.') + 1) : "";
    }

    private static String hash(byte[] b) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(b));
    }

    /** UTF-8 válido y sin bytes nulos; si no, es binario. */
    private static String comoTexto(byte[] b) {
        for (int i = 0; i < Math.min(b.length, 8192); i++) if (b[i] == 0) return null;
        try {
            return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(b)).toString();
        } catch (CharacterCodingException e) {
            return null;
        }
    }

    private static Pattern patron(String ext) {
        return switch (ext) {
            case "yml", "yaml" -> LINEA_YAML;
            case "properties", "conf", "cfg", "toml", "ini", "env" -> LINEA_IGUAL;
            case "json" -> LINEA_JSON;
            default -> null;
        };
    }

    private static String limpio(String clave) {
        return clave.replaceAll("[\"'\\s]", "");
    }

    /** Cambia por «••••••» el valor de los campos secretos. */
    static String tapar(String texto, String ext) {
        Pattern pat = patron(ext);
        if (pat == null) return texto;
        String[] lineas = texto.split("\n", -1);
        for (int i = 0; i < lineas.length; i++) {
            Matcher m = pat.matcher(lineas[i].replace("\r", ""));
            if (m.matches() && SECRETO.matcher(limpio(m.group(2))).matches() && !m.group(4).isBlank()) {
                String valor = ext.equals("json") ? "\"" + MASCARA + "\"" : MASCARA;
                lineas[i] = m.group(1) + m.group(2) + m.group(3) + valor + m.group(5) + (lineas[i].endsWith("\r") ? "\r" : "");
            }
        }
        return String.join("\n", lineas);
    }

    /** Donde el texto nuevo todavía dice «••••••», vuelve a poner el valor original del mismo campo. */
    static String destapar(String nuevo, String original, String ext) {
        Pattern pat = patron(ext);
        if (pat == null || !nuevo.contains(MASCARA)) return nuevo;
        Map<String, List<String>> valores = new HashMap<>();
        for (String l : original.split("\n", -1)) {
            Matcher m = pat.matcher(l.replace("\r", ""));
            if (m.matches()) valores.computeIfAbsent(m.group(1) + limpio(m.group(2)), k -> new ArrayList<>()).add(m.group(4));
        }
        Map<String, Integer> vistos = new HashMap<>();
        String[] lineas = nuevo.split("\n", -1);
        for (int i = 0; i < lineas.length; i++) {
            Matcher m = pat.matcher(lineas[i].replace("\r", ""));
            if (!m.matches()) continue;
            String clave = m.group(1) + limpio(m.group(2));
            int n = vistos.merge(clave, 1, Integer::sum) - 1;
            if (!m.group(4).contains(MASCARA)) continue;
            List<String> v = valores.get(clave);
            if (v == null || n >= v.size()) throw new IllegalArgumentException("No se encontró el valor original de «" + limpio(m.group(2)) + "». Escribe el valor completo o deja el campo como estaba.");
            lineas[i] = m.group(1) + m.group(2) + m.group(3) + v.get(n) + m.group(5) + (lineas[i].endsWith("\r") ? "\r" : "");
        }
        return String.join("\n", lineas);
    }

    private static void validar(String texto, String ext) {
        try {
            switch (ext) {
                case "yml", "yaml" -> new Yaml().loadAll(texto).forEach(x -> { });
                case "json" -> JsonParser.parseString(texto);
                default -> { }
            }
        } catch (Exception e) {
            String m = e.getMessage() == null ? e.toString() : e.getMessage();
            throw new IllegalArgumentException("No se guardó: el " + ext.toUpperCase(Locale.ROOT) + " tiene un error. " + m.lines().limit(4).reduce((a, b) -> a + " " + b).orElse(m));
        }
    }
}
