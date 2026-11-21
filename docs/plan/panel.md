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
Revisado el 19 nov 2026: `syntaaxmc.isaacyepez.com` es un CNAME a `molecule-limitation.tun.ply.gg` (el túnel viejo de playit). Java entra por el registro SRV `_minecraft._tcp.syntaaxmc.isaacyepez.com` → `molecule-darkness.tun.ply.gg:44997`. Para la página, el nombre pasa a apuntar a Hostinger y el SRV se queda igual, así que Java sigue entrando con la misma dirección. Hecho el 20 nov 2026: el CNAME se borró y Hostinger puso un ALIAS a `syntaaxmc.isaacyepez.com.cdn.hstgr.net`.

## Fases
- **P1 (PC):** íconos, bandeja y consola; plugins al día; DriveBackupV2 fuera. Hecha el 19 nov 2026 (ver la bitácora). Para apagar o reiniciar, el plugin puede usar `scripts/apagado.flag`: mientras exista, ni la bandeja ni el watchdog prenden el servidor.
- **P2 (nube):** página pública con el botón. Hecha el 20 nov 2026: https://syntaaxmc.isaacyepez.com.
- **P3 (nube, luego PC):** plugin SyntaaxPanel con estado y gráficas en `/admin/`. Se prueba primero con un Paper 26.2 en la nube (Java 25). Primera parte hecha el 20 nov 2026: entrada con Face ID, estado, gráfica de jugadores (muestras cada 5 minutos desde Hostinger) y dispositivos. Falta el plugin SyntaaxPanel.
- **P4:** consola, plugins y editor de configuración en `/admin/`.

## P3b y P4: el panel completo (pedido el 21 nov 2026)
Isaac pidió: menú desplegable para elegir la sección; lista interactiva de jugadores que han entrado, con botones para operador, rangos de LuckPerms, expulsar, banear y lista blanca (todo queda guardado y aplica cuando vuelvan a entrar); configurar los rangos; consola, rendimiento y plugins; un apartado de archivos para ver y editar cualquier archivo; y un apartado de sugerencias.

### Cómo funciona
- **Plugin SyntaaxPanel** (Java, en `plugin/`): cada 15 segundos, o cada 1,5 segundos con el panel abierto, le manda a Hostinger un latido con las métricas (TPS, MSPT, memoria, CPU, jugadores conectados) y las líneas nuevas de la consola, y recibe las tareas pendientes. Las cumple y devuelve el resultado. El PC solo hace salidas HTTPS.
- **Conexión**: el panel muestra un código de 10 minutos y en la consola del servidor se escribe `panel conectar CÓDIGO`. El plugin crea su token al azar; Hostinger guarda solo su SHA-256.
- **Jugadores y rangos**: los datos salen de Paper (jugadores que han entrado) y de LuckPerms. Operador, baneo y lista blanca se cambian con la API de Paper (por UUID, sirve con los de Bedrock que empiezan con punto). Los rangos, con comandos `lp` por UUID. Todo queda guardado en el servidor y aplica al volver a entrar.
- **Archivos**: solo dentro de la carpeta del servidor. No se leen claves (`*.pem`, `*.key`, la carpeta de playit, `secretos/`, la configuración del propio plugin). En YAML, properties, JSON y TOML, los valores de campos con password, secret, token o key salen como «••••••» y se conservan al guardar. Antes de guardar se hace una copia en `plugins/SyntaaxPanel/copias/`, se revisa que el YAML o JSON siga válido y que el archivo no haya cambiado desde que se abrió. Texto hasta 1 MB, imágenes hasta 2 MB.
- **Consola**: las IP de los jugadores salen tapadas (Ley 1581).
- **Reiniciar** es `stop`: la bandeja lo vuelve a prender en unos 5 segundos. **Apagar** crea `scripts/apagado.flag` antes de `stop`.
