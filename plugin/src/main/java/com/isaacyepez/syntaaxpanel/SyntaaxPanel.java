package com.isaacyepez.syntaaxpanel;

import java.security.SecureRandom;
import java.util.Base64;
import org.apache.logging.log4j.LogManager;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * SyntaaxPanel: conecta este servidor con el panel de https://syntaaxmc.isaacyepez.com/admin/.
 * Solo hace salidas HTTPS (latidos con métricas y consola, y respuestas a las tareas del panel).
 */
public final class SyntaaxPanel extends JavaPlugin {
    private Consola consola;
    private Metricas metricas;
    private Agente agente;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        if (getConfig().getString("token", "").length() < 32) {
            byte[] b = new byte[32];
            new SecureRandom().nextBytes(b);
            getConfig().set("token", Base64.getUrlEncoder().withoutPadding().encodeToString(b));
            saveConfig();
        }
        consola = new Consola();
        consola.start();
        ((org.apache.logging.log4j.core.Logger) LogManager.getRootLogger()).addAppender(consola);
        metricas = new Metricas();
        getServer().getScheduler().runTaskTimer(this, metricas::tomar, 20L, 20L);
        agente = new Agente(this, consola, metricas);
        agente.arrancar();
    }

    @Override
    public void onDisable() {
        if (agente != null) agente.parar();
        if (consola != null) {
            ((org.apache.logging.log4j.core.Logger) LogManager.getRootLogger()).removeAppender(consola);
            consola.stop();
        }
    }

    @Override
    public boolean onCommand(CommandSender quien, Command comando, String alias, String[] args) {
        if (args.length == 2 && args[0].equalsIgnoreCase("conectar")) {
            quien.sendMessage("Conectando con el panel…");
            getServer().getScheduler().runTaskAsynchronously(this, () -> {
                // También va al registro: la consola de la bandeja manda por RCON y no ve respuestas que llegan después.
                String r = agente.emparejar(args[1]);
                getLogger().info(r);
                quien.sendMessage(r);
            });
            return true;
        }
        if (args.length == 1 && args[0].equalsIgnoreCase("estado")) {
            quien.sendMessage(agente.estado());
            return true;
        }
        return false;
    }
}
