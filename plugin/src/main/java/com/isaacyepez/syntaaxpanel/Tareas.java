package com.isaacyepez.syntaaxpanel;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import io.papermc.paper.ban.BanListType;
import io.papermc.paper.plugin.configuration.PluginMeta;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import net.kyori.adventure.text.Component;
import net.luckperms.api.LuckPerms;
import net.luckperms.api.LuckPermsProvider;
import net.luckperms.api.model.group.Group;
import net.luckperms.api.model.user.User;
import net.luckperms.api.node.NodeType;
import net.luckperms.api.node.matcher.NodeMatcher;
import net.luckperms.api.node.types.InheritanceNode;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

/** Lo que el panel le puede pedir al servidor. Cada tipo valida sus datos antes de tocar algo. */
final class Tareas {
    private static final Pattern GRUPO = Pattern.compile("[a-z0-9_\\-]{1,36}");
    private static final Pattern PERMISO = Pattern.compile("[A-Za-z0-9_.\\-*]{1,200}");
    private final SyntaaxPanel plugin;
    private final Archivos archivos;

    Tareas(SyntaaxPanel plugin) {
        this.plugin = plugin;
        this.archivos = new Archivos(plugin);
    }

    /** Los jugadores de Bedrock (Floodgate) tienen un UUID que empieza con ceros. */
    static boolean esBedrock(UUID u) {
        return u.getMostSignificantBits() == 0;
    }

    JsonElement ejecutar(String tipo, JsonObject d) throws Exception {
        return switch (tipo) {
            case "comando" -> comando(texto(d, "texto", 1000));
            case "jugadores" -> jugadores();
            case "jugador" -> jugador(d);
            case "grupos" -> grupos();
            case "grupo" -> grupo(d);
            case "plugins" -> plugins();
            case "archivos_listar" -> archivos.listar(texto(d, "ruta", 1000, true));
            case "archivo_leer" -> archivos.leer(texto(d, "ruta", 1000));
            case "archivo_guardar" -> archivos.guardar(texto(d, "ruta", 1000), texto(d, "contenido", 2_000_000, true), texto(d, "hash", 100));
            case "servidor" -> servidor(texto(d, "accion", 20));
            default -> throw new IllegalArgumentException("Tarea desconocida: " + tipo);
        };
    }

    static String texto(JsonObject d, String campo, int max) {
        return texto(d, campo, max, false);
    }

    static String texto(JsonObject d, String campo, int max, boolean vacio) {
        String v = d.has(campo) && d.get(campo).isJsonPrimitive() ? d.get(campo).getAsString() : "";
        if (!vacio && v.isBlank()) throw new IllegalArgumentException("Falta «" + campo + "».");
        if (v.length() > max) throw new IllegalArgumentException("«" + campo + "» es demasiado largo.");
        return v;
    }

    private <T> T principal(Callable<T> c) throws Exception {
        if (Bukkit.isPrimaryThread()) return c.call();
        try {
            return Bukkit.getScheduler().callSyncMethod(plugin, c).get(15, TimeUnit.SECONDS);
        } catch (java.util.concurrent.ExecutionException e) {
            // Que el panel vea el mensaje en español, no el nombre de la excepción de Java.
            throw e.getCause() instanceof Exception x ? x : e;
        }
    }

    private LuckPerms lp() {
        if (Bukkit.getPluginManager().getPlugin("LuckPerms") == null) throw new IllegalStateException("LuckPerms no está instalado.");
        return LuckPermsProvider.get();
    }

    private JsonElement comando(String texto) throws Exception {
        String c = texto.startsWith("/") ? texto.substring(1) : texto;
        boolean ok = principal(() -> Bukkit.dispatchCommand(Bukkit.getConsoleSender(), c));
        plugin.getLogger().info("Comando desde el panel: " + c);
        JsonObject r = new JsonObject();
        r.addProperty("ok", ok);
        return r;
    }

    // ---------- jugadores ----------

    private JsonElement jugadores() throws Exception {
        List<JsonObject> lista = principal(() -> {
            List<JsonObject> l = new ArrayList<>();
            for (OfflinePlayer p : Bukkit.getOfflinePlayers()) l.add(datosJugador(p));
            return l;
        });
        JsonArray a = new JsonArray();
        lista.stream().sorted(Comparator.comparing((JsonObject j) -> !j.get("en_linea").getAsBoolean())
                .thenComparing(j -> -j.get("ultima").getAsLong()))
            .limit(2000).forEach(j -> { agregarRangos(j); a.add(j); });
        return a;
    }

    private JsonObject datosJugador(OfflinePlayer p) {
        JsonObject j = new JsonObject();
        j.addProperty("uuid", p.getUniqueId().toString());
        j.addProperty("nombre", p.getName() == null ? "(sin nombre)" : p.getName());
        j.addProperty("bedrock", esBedrock(p.getUniqueId()));
        j.addProperty("en_linea", p.isOnline());
        j.addProperty("op", p.isOp());
        j.addProperty("baneado", p.isBanned());
        j.addProperty("lista_blanca", p.isWhitelisted());
        j.addProperty("primera", p.getFirstPlayed() / 1000);
        j.addProperty("ultima", (p.isOnline() ? System.currentTimeMillis() : p.getLastSeen()) / 1000);
        return j;
    }

    private void agregarRangos(JsonObject j) {
        if (Bukkit.getPluginManager().getPlugin("LuckPerms") == null) return;
        try {
            User u = LuckPermsProvider.get().getUserManager().loadUser(UUID.fromString(j.get("uuid").getAsString())).get(5, TimeUnit.SECONDS);
            j.addProperty("rango", u.getPrimaryGroup());
            JsonArray g = new JsonArray();
            u.getNodes(NodeType.INHERITANCE).forEach(n -> g.add(n.getGroupName()));
            j.add("rangos", g);
        } catch (Exception e) {
            j.addProperty("rango", "?");
        }
    }

    private JsonElement jugador(JsonObject d) throws Exception {
        UUID u = UUID.fromString(texto(d, "uuid", 40));
        String accion = texto(d, "accion", 30);
        String motivo = texto(d, "motivo", 200, true).replaceAll("[\\r\\n]", " ");
        switch (accion) {
            case "op", "deop" -> principal(() -> { Bukkit.getOfflinePlayer(u).setOp(accion.equals("op")); return null; });
            case "lista_blanca_si", "lista_blanca_no" -> principal(() -> { Bukkit.getOfflinePlayer(u).setWhitelisted(accion.endsWith("si")); return null; });
            case "expulsar" -> principal(() -> {
                Player p = Bukkit.getPlayer(u);
                if (p == null) throw new IllegalStateException("No está conectado.");
                p.kick(Component.text(motivo.isBlank() ? "Expulsado por un administrador." : motivo));
                return null;
            });
            case "banear" -> principal(() -> {
                OfflinePlayer p = Bukkit.getOfflinePlayer(u);
                p.ban(motivo.isBlank() ? "Baneado por un administrador." : motivo, (java.util.Date) null, "Panel");
                if (p.getPlayer() != null) p.getPlayer().kick(Component.text(motivo.isBlank() ? "Baneado." : motivo));
                return null;
            });
            case "desbanear" -> principal(() -> {
                Bukkit.getBanList(BanListType.PROFILE).pardon(Bukkit.getOfflinePlayer(u).getPlayerProfile());
                return null;
            });
            case "rango_poner", "rango_agregar", "rango_quitar" -> {
                String g = grupoValido(texto(d, "grupo", 36));
                String modo = switch (accion) { case "rango_poner" -> "set"; case "rango_agregar" -> "add"; default -> "remove"; };
                lpComando("lp user " + u + " parent " + modo + " " + g);
            }
            default -> throw new IllegalArgumentException("Acción desconocida: " + accion);
        }
        plugin.getLogger().info("Panel: " + accion + " a " + u);
        JsonObject j = principal(() -> datosJugador(Bukkit.getOfflinePlayer(u)));
        agregarRangos(j);
        return j;
    }

    /** Los comandos de LuckPerms se guardan en segundo plano: se espera un momento antes de leer otra vez. */
    private void lpComando(String c) throws Exception {
        principal(() -> Bukkit.dispatchCommand(Bukkit.getConsoleSender(), c));
        Thread.sleep(700);
    }

    private String grupoValido(String g) {
        String n = g.toLowerCase();
        if (!GRUPO.matcher(n).matches()) throw new IllegalArgumentException("Nombre de rango inválido: usa letras, números, - o _.");
        return n;
    }

    // ---------- rangos (grupos de LuckPerms) ----------

    private JsonElement grupos() throws Exception {
        LuckPerms lp = lp();
        lp.getGroupManager().loadAllGroups().get(10, TimeUnit.SECONDS);
        JsonArray a = new JsonArray();
        List<Group> lista = new ArrayList<>(lp.getGroupManager().getLoadedGroups());
        lista.sort(Comparator.comparingInt((Group g) -> -g.getWeight().orElse(0)).thenComparing(Group::getName));
        for (Group g : lista) {
            JsonObject j = new JsonObject();
            j.addProperty("nombre", g.getName());
            j.addProperty("visible", g.getDisplayName() == null ? "" : g.getDisplayName());
            j.addProperty("peso", g.getWeight().orElse(0));
            String pre = g.getCachedData().getMetaData().getPrefix();
            String suf = g.getCachedData().getMetaData().getSuffix();
            j.addProperty("prefijo", pre == null ? "" : pre);
            j.addProperty("sufijo", suf == null ? "" : suf);
            JsonArray permisos = new JsonArray();
            g.getNodes(NodeType.PERMISSION).stream().sorted(Comparator.comparing(n -> n.getPermission())).forEach(n -> {
                JsonObject p = new JsonObject();
                p.addProperty("nodo", n.getPermission());
                p.addProperty("valor", n.getValue());
                permisos.add(p);
            });
            j.add("permisos", permisos);
            JsonArray padres = new JsonArray();
            g.getNodes(NodeType.INHERITANCE).forEach(n -> padres.add(n.getGroupName()));
            j.add("padres", padres);
            try {
                Map<UUID, Collection<InheritanceNode>> m = lp.getUserManager()
                    .searchAll(NodeMatcher.key(InheritanceNode.builder(g.getName()).build())).get(5, TimeUnit.SECONDS);
                j.addProperty("miembros", m.size());
            } catch (Exception e) {
                j.addProperty("miembros", -1);
            }
            a.add(j);
        }
        return a;
    }

    private JsonElement grupo(JsonObject d) throws Exception {
        lp();
        String accion = texto(d, "accion", 30);
        String g = grupoValido(texto(d, "grupo", 36));
        String valor = texto(d, "valor", 200, true).replaceAll("[\"\\r\\n\\\\]", "");
        String c = switch (accion) {
            case "crear" -> "lp creategroup " + g;
            case "borrar" -> {
                if (g.equals("default")) throw new IllegalArgumentException("El rango «default» no se puede borrar: es el de todos.");
                yield "lp deletegroup " + g;
            }
            case "peso" -> "lp group " + g + " setweight " + Integer.parseInt(valor.trim());
            case "visible" -> "lp group " + g + " setdisplayname \"" + valor + "\"";
            case "prefijo" -> valor.isEmpty() ? "lp group " + g + " meta removeprefix 100" : "lp group " + g + " meta setprefix 100 \"" + valor + "\"";
            case "sufijo" -> valor.isEmpty() ? "lp group " + g + " meta removesuffix 100" : "lp group " + g + " meta setsuffix 100 \"" + valor + "\"";
            case "permiso_poner", "permiso_negar" -> {
                if (!PERMISO.matcher(valor).matches()) throw new IllegalArgumentException("Permiso inválido.");
                yield "lp group " + g + " permission set " + valor + (accion.equals("permiso_poner") ? " true" : " false");
            }
            case "permiso_quitar" -> {
                if (!PERMISO.matcher(valor).matches()) throw new IllegalArgumentException("Permiso inválido.");
                yield "lp group " + g + " permission unset " + valor;
            }
            case "padre_agregar" -> "lp group " + g + " parent add " + grupoValido(valor);
            case "padre_quitar" -> "lp group " + g + " parent remove " + grupoValido(valor);
            default -> throw new IllegalArgumentException("Acción desconocida: " + accion);
        };
        lpComando(c);
        plugin.getLogger().info("Panel: " + c);
        return grupos();
    }

    // ---------- plugins y servidor ----------

    private JsonElement plugins() throws Exception {
        return principal(() -> {
            JsonArray a = new JsonArray();
            Plugin[] ps = Bukkit.getPluginManager().getPlugins();
            java.util.Arrays.sort(ps, Comparator.comparing(p -> p.getName().toLowerCase()));
            for (Plugin p : ps) {
                PluginMeta m = p.getPluginMeta();
                JsonObject j = new JsonObject();
                j.addProperty("nombre", m.getName());
                j.addProperty("version", m.getVersion());
                j.addProperty("activo", p.isEnabled());
                j.addProperty("descripcion", m.getDescription() == null ? "" : m.getDescription());
                j.addProperty("autores", String.join(", ", m.getAuthors()));
                j.addProperty("web", m.getWebsite() == null ? "" : m.getWebsite());
                Path carpeta = p.getDataFolder().toPath();
                j.addProperty("carpeta", Files.isDirectory(carpeta) ? "plugins/" + carpeta.getFileName() : "");
                a.add(j);
            }
            return a;
        });
    }

    /** Reiniciar = detener (la bandeja del PC lo vuelve a prender). Apagar = dejar antes scripts/apagado.flag. */
    private JsonElement servidor(String accion) throws Exception {
        if (!accion.equals("reiniciar") && !accion.equals("apagar")) throw new IllegalArgumentException("Acción desconocida: " + accion);
        if (accion.equals("apagar")) {
            Path flag = archivos.raiz().resolve("scripts").resolve("apagado.flag");
            Files.createDirectories(flag.getParent());
            if (!Files.exists(flag)) Files.createFile(flag);
        }
        plugin.getLogger().info("Panel: " + accion + " el servidor.");
        Bukkit.getScheduler().runTaskLater(plugin, () -> Bukkit.shutdown(), 60L);
        JsonObject r = new JsonObject();
        r.addProperty("ok", true);
        return r;
    }
}
