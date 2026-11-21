package com.isaacyepez.syntaaxpanel;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.Property;

/** Copia lo que escribe la consola del servidor para mandarlo al panel, con las IP de los jugadores tapadas. */
final class Consola extends AbstractAppender {
    private static final int MAXIMO = 2000;
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm:ss").withZone(ZoneId.systemDefault());
    private static final Pattern ANSI = Pattern.compile("\u001B\\[[;\\d]*[A-Za-z]|§[0-9a-fk-orx]");
    // «Isaac[/181.53.1.2:51234] logged in» y cualquier IPv4 suelta; IPv6 después de una barra.
    private static final Pattern IP4 = Pattern.compile("\\b\\d{1,3}(\\.\\d{1,3}){3}\\b");
    private static final Pattern IP6 = Pattern.compile("/[0-9a-fA-F]*:[0-9a-fA-F:]+");

    private final ConcurrentLinkedQueue<String> pendientes = new ConcurrentLinkedQueue<>();
    private final AtomicInteger cuantas = new AtomicInteger();

    Consola() {
        super("SyntaaxPanel", null, null, false, Property.EMPTY_ARRAY);
    }

    @Override
    public void append(LogEvent e) {
        StringBuilder s = new StringBuilder("[").append(HORA.format(Instant.ofEpochMilli(e.getTimeMillis())))
            .append(' ').append(e.getLevel().name()).append("]: ");
        String origen = e.getLoggerName();
        if (origen != null && !origen.isEmpty() && !origen.contains(".") && !origen.equals("Minecraft")) s.append('[').append(origen).append("] ");
        s.append(e.getMessage() == null ? "" : e.getMessage().getFormattedMessage());
        if (e.getThrown() != null) s.append(" (").append(e.getThrown()).append(')');
        String linea = IP6.matcher(IP4.matcher(ANSI.matcher(s).replaceAll("")).replaceAll("•.•.•.•")).replaceAll("/•••");
        pendientes.add(linea.length() > 4000 ? linea.substring(0, 4000) : linea);
        if (cuantas.incrementAndGet() > MAXIMO && pendientes.poll() != null) cuantas.decrementAndGet();
    }

    /** Las líneas que faltan por mandar (hasta 500 por latido). */
    List<String> sacar() {
        List<String> l = new ArrayList<>();
        String x;
        while (l.size() < 500 && (x = pendientes.poll()) != null) {
            cuantas.decrementAndGet();
            l.add(x);
        }
        return l;
    }
}
