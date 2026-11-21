package com.isaacyepez.syntaaxpanel;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import java.lang.management.ManagementFactory;
import org.bukkit.Bukkit;
import org.bukkit.World;
import org.bukkit.entity.Player;

/** Cada segundo, en el hilo principal, toma una foto del rendimiento para el siguiente latido. */
final class Metricas {
    private volatile JsonObject ultima = new JsonObject();
    private volatile JsonArray mundos = new JsonArray();

    void tomar() {
        JsonObject m = new JsonObject();
        m.addProperty("tps", Math.round(Math.min(20.0, Bukkit.getTPS()[0]) * 10) / 10.0);
        m.addProperty("mspt", Math.round(Bukkit.getAverageTickTime() * 10) / 10.0);
        Runtime r = Runtime.getRuntime();
        m.addProperty("ram_mb", (r.totalMemory() - r.freeMemory()) / 1048576);
        m.addProperty("ram_max_mb", r.maxMemory() / 1048576);
        if (ManagementFactory.getOperatingSystemMXBean() instanceof com.sun.management.OperatingSystemMXBean so) {
            double cpu = so.getProcessCpuLoad();
            if (cpu >= 0) m.addProperty("cpu", Math.round(cpu * 1000) / 10.0);
        }
        JsonArray enLinea = new JsonArray();
        for (Player p : Bukkit.getOnlinePlayers()) {
            JsonObject j = new JsonObject();
            j.addProperty("uuid", p.getUniqueId().toString());
            j.addProperty("nombre", p.getName());
            j.addProperty("bedrock", Tareas.esBedrock(p.getUniqueId()));
            j.addProperty("mundo", p.getWorld().getName());
            j.addProperty("ping", p.getPing());
            enLinea.add(j);
        }
        m.add("en_linea", enLinea);
        m.addProperty("max", Bukkit.getMaxPlayers());
        JsonArray ms = new JsonArray();
        for (World w : Bukkit.getWorlds()) {
            JsonObject j = new JsonObject();
            j.addProperty("nombre", w.getName());
            j.addProperty("chunks", w.getLoadedChunks().length);
            j.addProperty("entidades", w.getEntityCount());
            j.addProperty("jugadores", w.getPlayerCount());
            ms.add(j);
        }
        ultima = m;
        mundos = ms;
    }

    JsonObject ultima() { return ultima; }

    JsonArray mundos() { return mundos; }
}
