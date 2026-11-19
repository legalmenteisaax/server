# Panel de SyntaaxMC (19 nov 2026)

## Lo que pidió Isaac
1. Las ventanas del servidor (Java) y de playit: al minimizarlas pasan a segundo plano, con ícono propio.
2. Una página en `syntaaxmc.isaacyepez.com` con un botón que agrega el servidor a Minecraft en el celular.
3. Una subpágina de administrador: plugins, archivos de configuración, estado, métricas y gráficas.
4. Todo con la identidad de isaacyepez.com (¡saax): negro metalizado `#121417`, gris niebla `#d9dce1`, naranja fundido `#ff5a1f` y la letra Montserrat (ver `marca.css` e `index.html` del repositorio `saax-links`).
5. Plugins al día.
6. Quitar DriveBackupV2.

## Cómo se arma
Tres piezas. El PC nunca queda abierto a internet: solo hace salidas HTTPS a Hostinger.

### Bandeja (en el PC)
- Un programa en PowerShell con Windows Forms, que viene con Windows. Un `.exe` propio sin firma lo bloquearía el Control inteligente de aplicaciones.
- Arranca Java y playit sin ventana y pone un ícono junto al reloj, con el estado (servidor y túnel).
- Menú: Abrir consola, Abrir panel, Reiniciar, Apagar.
- La consola es una ventana propia con la identidad de ¡saax: muestra lo que escribe Java, deja mandar comandos y enseña el estado del túnel. Al minimizarla vuelve a la bandeja. La ventana de playit ya no hace falta.
- Arranca con la tarea programada al iniciar sesión, no desde Claude: lo que abre Claude se cierra cuando termina su sesión.
- Íconos en `recursos/iconos/`.

### Plugin SyntaaxPanel (en el PC, dentro de Paper)
- Cada 30 segundos manda a Hostinger el estado: TPS, MSPT, jugadores, RAM, mundos y plugins con su versión.
- Cada pocos segundos pregunta si hay comandos o cambios de configuración pendientes.
- Su token vive en `plugins/SyntaaxPanel/config.yml` del PC y en el `config.php` del servidor, nunca en Git.

### Sitio (Hostinger, PHP y MySQL, como ¡platax)
- `/`: estado (en línea o apagado, jugadores), botón «Agregar a Minecraft» con `minecraft://?addExternalServer=SyntaaxMC|molecule-hardship.tun.ply.gg:19132` y la dirección de Java para copiar.
- `/admin/`, con passkeys (Face ID o Windows Hello), como ¡platax:
  - Estado y gráficas con ECharts: jugadores, TPS y RAM en el tiempo.
  - Consola: mandar comandos y ver la respuesta.
  - Plugins: versión instalada y si hay una más nueva en Modrinth o Hangar.
  - Configuración: los archivos de cada plugin en formularios.

## Seguridad
- Las claves no salen del PC. El plugin no manda `plugins/floodgate/key.pem`, el token de Geyser con playit, `rcon.password` ni ningún campo cuyo nombre tenga token, password, secret o key. En el panel salen como «••••» y no se editan.
- Cada cambio de configuración: copia del archivo, se aplica, se recarga y, si algo falla, vuelve la copia.
- Los comandos delicados (`op`, `deop`, `stop`, `ban`, `whitelist off`) piden confirmación.

## Dominio
Revisado el 19 nov 2026: `syntaaxmc.isaacyepez.com` es un CNAME a `molecule-limitation.tun.ply.gg` (el túnel viejo de playit). Java entra por el registro SRV `_minecraft._tcp.syntaaxmc.isaacyepez.com` → `molecule-darkness.tun.ply.gg:44997`. Para la página, el nombre pasa a apuntar a Hostinger y el SRV se queda igual, así que Java sigue entrando con la misma dirección.

## Fases
- **P1 (PC):** íconos, bandeja y consola; plugins al día; DriveBackupV2 fuera.
- **P2 (nube):** página pública con el botón.
- **P3 (nube, luego PC):** plugin SyntaaxPanel con estado y gráficas en `/admin/`. Se prueba primero con un Paper 1.21.11 en la nube.
- **P4:** consola, plugins y editor de configuración en `/admin/`.
