package com.isaacyepez.syntaaxpanel;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.logging.Level;

/** El hilo que habla con el panel: latido cada 15 s (cada 1,5 s con el panel abierto) y respuestas a las tareas. */
final class Agente {
    private final SyntaaxPanel plugin;
    private final Consola consola;
    private final Metricas metricas;
    private final Tareas tareas;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ExecutorService trabajo = Executors.newSingleThreadExecutor(r -> new Thread(r, "SyntaaxPanel-tareas"));
    private volatile boolean corriendo;
    private volatile String ultimoError = "Todavía no se ha conectado.";
    private volatile String ultimoBien = null;
    private boolean avisado;
    private Thread hilo;

    Agente(SyntaaxPanel plugin, Consola consola, Metricas metricas) {
        this.plugin = plugin;
        this.consola = consola;
        this.metricas = metricas;
        this.tareas = new Tareas(plugin);
    }

    void arrancar() {
        corriendo = true;
        hilo = new Thread(this::bucle, "SyntaaxPanel-latido");
        hilo.setDaemon(true);
        hilo.start();
    }

    void parar() {
        corriendo = false;
        if (hilo != null) hilo.interrupt();
        trabajo.shutdownNow();
    }

    private void bucle() {
        while (corriendo) {
            long espera = 15000;
            try {
                JsonObject cuerpo = new JsonObject();
                cuerpo.addProperty("version", plugin.getPluginMeta().getVersion());
                cuerpo.add("metricas", metricas.ultima());
                cuerpo.add("mundos", metricas.mundos());
                JsonArray lineas = new JsonArray();
                consola.sacar().forEach(lineas::add);
                cuerpo.add("consola", lineas);
                HttpResponse<String> r = enviar("agente/latido", cuerpo);
                if (r.statusCode() == 401) {
                    ultimoError = "Falta conectar el plugin: pide un código en el panel («Conexión») y escribe «panel conectar CÓDIGO».";
                    if (!avisado) plugin.getLogger().warning(ultimoError);
                    avisado = true;
                    espera = 30000;
                } else if (r.statusCode() != 200) {
                    ultimoError = "El panel respondió " + r.statusCode() + ".";
                } else {
                    avisado = false;
                    ultimoError = null;
                    ultimoBien = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"));
                    JsonObject d = JsonParser.parseString(r.body()).getAsJsonObject();
                    if (d.has("activo") && d.get("activo").getAsBoolean()) espera = 1500;
                    for (JsonElement t : d.getAsJsonArray("tareas")) {
                        JsonObject tarea = t.getAsJsonObject();
                        trabajo.submit(() -> cumplir(tarea));
                    }
                }
            } catch (InterruptedException e) {
                return;
            } catch (Exception e) {
                ultimoError = "Sin conexión con el panel: " + e.getMessage();
                plugin.getLogger().log(Level.FINE, ultimoError, e);
            }
            try {
                Thread.sleep(espera);
            } catch (InterruptedException e) {
                return;
            }
        }
    }

    private void cumplir(JsonObject tarea) {
        JsonObject res = new JsonObject();
        res.addProperty("id", tarea.get("id").getAsLong());
        try {
            JsonObject datos = tarea.has("datos") && tarea.get("datos").isJsonObject() ? tarea.getAsJsonObject("datos") : new JsonObject();
            res.add("datos", tareas.ejecutar(tarea.get("tipo").getAsString(), datos));
            res.addProperty("ok", true);
        } catch (Exception e) {
            res.addProperty("ok", false);
            res.addProperty("error", e.getMessage() == null ? e.toString() : e.getMessage());
        }
        try {
            enviar("agente/resultado", res);
        } catch (Exception e) {
            plugin.getLogger().warning("No se pudo mandar el resultado de una tarea al panel: " + e.getMessage());
        }
    }

    String emparejar(String codigo) {
        try {
            JsonObject c = new JsonObject();
            c.addProperty("codigo", codigo);
            c.addProperty("token", plugin.getConfig().getString("token"));
            c.addProperty("version", plugin.getPluginMeta().getVersion());
            HttpResponse<String> r = enviar("agente/emparejar", c);
            if (r.statusCode() == 200) {
                hilo.interrupt();
                arrancar();
                return "Listo: el servidor quedó conectado al panel.";
            }
            JsonObject d = JsonParser.parseString(r.body()).getAsJsonObject();
            return "No se pudo conectar: " + (d.has("error") ? d.get("error").getAsString() : "respuesta " + r.statusCode());
        } catch (Exception e) {
            return "No se pudo conectar: " + e.getMessage();
        }
    }

    String estado() {
        return ultimoError == null ? "Conectado al panel. Último latido a las " + ultimoBien + "." : ultimoError;
    }

    private HttpResponse<String> enviar(String ruta, JsonObject cuerpo) throws Exception {
        String base = plugin.getConfig().getString("url", "https://syntaaxmc.isaacyepez.com/admin/api/");
        HttpRequest req = HttpRequest.newBuilder(URI.create(base + ruta))
            .timeout(Duration.ofSeconds(30))
            .header("Content-Type", "application/json")
            .header("User-Agent", "SyntaaxPanel/" + plugin.getPluginMeta().getVersion())
            .header("X-Syntaax-Token", plugin.getConfig().getString("token", ""))
            .POST(HttpRequest.BodyPublishers.ofString(cuerpo.toString()))
            .build();
        return http.send(req, HttpResponse.BodyHandlers.ofString());
    }
}
