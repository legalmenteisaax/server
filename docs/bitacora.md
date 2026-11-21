# Bitácora

## 16 nov 2026 · Arranque
- Isaac quiere pasar a su PC el servidor de Minecraft que tenía en Tarohosting y que funcione en PC y celular.
- Se decidió Paper + Geyser + Floodgate, y playit.gg para entrar desde otras casas (ver `CLAUDE.md`).
- Se armó este repositorio (estaba vacío): `CLAUDE.md`, esta bitácora y un `.gitignore` que deja fuera todo menos lo que nombra.
- Bloqueo: la sesión era en la nube y la carpeta del servidor está en el PC. Las carpetas de Control remoto de IsaacPC salen como no disponibles para la nube. El montaje sigue en Claude Code en el PC.
- Falta: todo el orden de trabajo de `CLAUDE.md`, desde el paso 1.

## 16 nov 2026 · Copias en Google Drive
- Isaac contó que usaba un plugin de copias y que había bajado la carpeta de su Drive.
- En su Drive está la carpeta `backups` («backups SyntaaxMC») del plugin DriveBackupV2: mundo principal y plugins del 10 ago 2026; Nether y End del 3 ago 2026. Tabla en `CLAUDE.md`.
- El `level.dat` del End dice Paper con Minecraft 1.21.11.
- Error: la copia de los plugins (245 MB) no bajó a la nube. Causa: la conexión con Drive solo baja archivos de hasta 10 MB. Solución: se abren en el PC.
- Falta: armar el servidor en el PC con esas copias.

## 19 nov 2026 · Panel de SyntaaxMC (nube)
- La sesión del PC («Recuperación del servidor (PC)») ya montó el servidor: Java entra con `syntaaxmc.isaacyepez.com` y el celular con `molecule-hardship.tun.ply.gg`, puerto 19132. Isaac entró desde el celular. Ese trabajo todavía no está en este repositorio.
- En la foto del celular: el marcador aún dice `syntaax.tarohosting.com`, FancyNpcs avisa que hay versión nueva (2.11.0 → 2.12.1) y en el celular Isaac sale con rango «default» porque Floodgate lo trata como otro jugador (`.Isaac075095`).
- Isaac pidió: bandeja con íconos propios para Java y playit, página con botón para agregar el servidor, subpágina de administrador con plugins, configuración, métricas y gráficas, identidad de isaacyepez.com, plugins al día y quitar DriveBackupV2. Plan en `docs/plan/panel.md`.
- Se revisó el dominio: el SRV de Java apunta a `molecule-darkness.tun.ply.gg:44997`, así que el nombre puede pasar a Hostinger sin cortar a Java.
- Se hicieron los íconos (`recursos/iconos/`).
- Falta: fase P1 en el PC y P2 a P4 en la nube.

## 19 nov 2026 · Fase P1 en el PC
- El servidor corre **Paper 26.2** (build 135) con Java 25, no 1.21.11: se subió de versión durante la recuperación. Las pruebas de P3 deben usar 26.2.
- Copia antes de empezar en `C:\MinecraftBackups\`: `world-2026-11-19_18-28.zip` (406,8 MB, validada) y `config-pre-panel-2026-11-19_18-30-completo.zip` (plugins y configuración). Los rangos, exportados aparte en `plugins/LuckPerms/pre-panel-2026-11-19.json.gz`.
- **Bandeja** (`scripts/bandeja.ps1`, con `scripts/comun.ps1`): arranca Java y playit sin ventana y pone dos íconos junto al reloj, servidor y túnel, que pasan a `-ok` o `-error` según el ping cada 20 s. Menú: Abrir consola, Abrir panel (`https://syntaaxmc.isaacyepez.com/admin/`), Reiniciar y Apagar/Encender. La consola lee `logs/latest.log` y manda comandos por RCON; escribir `stop` ahí equivale a Apagar. Si Java o playit se cierran, la bandeja los vuelve a prender (Java, como mucho una vez cada 90 s).
- `scripts/apagado.flag` manda: mientras exista, nadie prende el servidor. Lo ponen Apagar y el mantenimiento; el panel web puede usar lo mismo.
- La abre el acceso directo `SyntaaxMC-Bandeja.lnk` de la carpeta Inicio al iniciar sesión, y la tarea `SyntaaxMC-Watchdog` (cada 5 min) si se cerró. Los dos accesos viejos, que abrían las ventanas, quedaron en `C:\MinecraftBackups\inicio-viejo-2026-11-19\`.
- **Watchdog** (`scripts/watchdog.ps1`): mantiene la PC despierta, reinicia playit si el túnel falla dos veces seguidas y, sin bandeja, prende lo que falte y la abre.
- Prueba sin ventanas: `scripts/prueba-bandeja.ps1` (pings, RCON, íconos y sintaxis).
- **Plugins**: 11 actualizados y DriveBackupV2 fuera (detalle en `docs/plugins.md`). Reinicio de 18:59 a 19:01, 125 s caído; arrancó sin errores nuevos.
- **Dirección**: TAB (animación `web`, que va en el marcador y la lista, y la barra de jefe) y DiscordSRV (estado y `,ip`) dicen `syntaaxmc.isaacyepez.com`. `,ip` da para Bedrock `molecule-hardship.tun.ply.gg`, puerto 19132.
- **Rango del celular**: `.Isaac075095` quedó en `propietario`. Se le quitó el prefijo propio «Bedrock» (pesaba lo mismo que «Propietario» y lo tapaba), a pedido de Isaac.
- Error: la copia de los plugins salió con 324 archivos menos. Causa: un archivo bloqueado (la base de LuckPerms) dejaba abierta una entrada del zip y fallaban todos los siguientes. Solución: leer cada archivo a memoria antes de crear la entrada; la base de LuckPerms se copia con `lp export`.
- Error: LuckPerms no encuentra `.Isaac075095` por nombre (el punto no es válido). Solución: usar el UUID `00000000-0000-0000-0009-01f659d197bf`.
- Error: el servidor y playit se cerraron a las 17:37 y a las 18:04, seguramente al cerrar sus ventanas; el watchdog los prendió. Ahora corren sin ventana.
- Ojo: PowerShell 5.1 lee los `.ps1` sin BOM como ANSI. `bandeja.ps1` y `prueba-bandeja.ps1` van en UTF-8 con BOM por las tildes.
- Isaac ya le quitó a DriveBackupV2 el acceso a su cuenta de Google (las copias de su Drive siguen ahí). También borró desde hPanel la carpeta repetida `public_html/public_html/syntaaxmc`.
- Falta: decidir qué hacer con los 5 `.jar` de Fabric/Forge que no cargan. EssentialsX todavía no tiene versión para 26.2. P2 a P4 en la nube.

## 20 nov 2026 · Página pública (fase P2)
- Publicada en https://syntaaxmc.isaacyepez.com (carpeta `public_html/syntaaxmc`). Los archivos están en `sitio/` y se suben con `scripts/subir-sitio.mjs`. Identidad de ¡saax con la letra Montserrat guardada en el propio sitio (sin Google Fonts) y reglas de seguridad (CSP) que solo dejan correr código del sitio.
- Dominio: se borró el CNAME `syntaaxmc` → `molecule-limitation.tun.ply.gg` (el túnel viejo; Java no lo usaba) y Hostinger puso el ALIAS al crear el subdominio. El SRV de Java quedó igual y sigue funcionando.
- Error: el subdominio quedó en `public_html/public_html/syntaaxmc`. Causa: el campo `directory` de `hosting_websites_add-domain` es relativo a `public_html` y se le pasó `public_html/syntaaxmc`. Solución: se quitó el subdominio y se volvió a crear con `syntaaxmc`. Quedó la carpeta vacía `public_html/public_html/syntaaxmc`: hay que borrarla desde el Administrador de archivos de Hostinger, porque la API no borra archivos.
- Error: `estado.php` decía «Apagado» con el servidor prendido. Causa: playit cierra la conexión si el saludo no trae el nombre del túnel, y se mandaba `syntaaxmc.isaacyepez.com:25565`. Java moderno, al seguir el SRV, manda `molecule-darkness.tun.ply.gg:44997`. Solución: saludar con el destino del SRV. Por lo mismo, consultar el túnel por la IP (`147.185.221.217:44997`) da «apagado» aunque funcione: no es una falla del túnel.
- Hostinger sí sale por puertos poco comunes (probado con portquiz.net en 44997 y 25565).
- `estado.php` hace 2 intentos (IPv4 e IPv6), guarda la respuesta 30 segundos y sigue mostrando «en línea» 3 minutos si una consulta suelta falla.
- Falta: probar el botón «Agregar a Minecraft» en un iPhone de verdad, borrar la carpeta vacía y las fases P3 y P4.

## 20 nov 2026 · Skills, textos y tarjeta en isaacyepez.com
- Se instalaron `humanizer` y `stop-slop` en `.claude/skills/` (copias de las de `general`). El `.gitignore` las deja entrar.
- Textos de la página revisados con las dos skills. Isaac vio redundancias: «agregar» salía cuatro veces en la tarjeta del celular, «dirección» cuatro veces en la del PC, la frase de arriba repetía las tarjetas y el pie repetía el estado. Ahora cada tarjeta tiene el nombre de la plataforma (Celular, PC), la dirección y un solo paso a mano. Se quitó el aviso «si no se abrió»: lo cubre ese paso.
- `estado.php` deja que isaacyepez.com lea el estado (CORS solo para ese origen).
- isaacyepez.com (repositorio `saax-links`): tarjeta ancha de SyntaaxMC debajo de ¡QRx y Artículos, con el estado en vivo cuando está en línea. Se partió de la versión en vivo, que tenía dos líneas del ícono que no estaban en el repositorio; ya están.
- El enlace «Administrar» al panel está listo (guardado aparte) y se publica cuando exista `/admin/`.
- Falta: el panel (P3).

## 20 nov 2026 · Panel de administración, primera parte (fase P3)
- En línea en https://syntaaxmc.isaacyepez.com/admin/ y con el enlace «Administrar» en el pie de la página pública.
- Entrada con passkey (Face ID o Windows Hello), adaptada de ¡platax (`sitio/admin/api/webauthn.php`). Hay un solo dueño: no hay usuarios, solo dispositivos. Sesión de 30 días en la cookie `__Host-syntaax`. Límite: 5 códigos fallidos y 20 entradas fallidas por IP cada 15 minutos.
- Primer dispositivo: con un código de instalación que la sesión del PC generó y dejó en `C:\Minecraft\server\secretos\codigo-panel.txt`. A la nube solo llegó su SHA-256; el código no pasó por ningún chat. Sirve mientras no haya ninguna passkey. Para otro dispositivo hay que entrar primero con uno registrado.
- Lo que muestra: estado de ahora, % del tiempo en línea, pico de jugadores, gráfica de 24 horas o 7 días con franja de en línea/apagado, tabla y la lista de dispositivos (quitar y agregar).
- Base de datos `u810585570_syntaaxmc` (tablas en `admin/api/esquema.sql`, se crean solas). Su clave solo está en `admin/api/config.php` de Hostinger; `config.ejemplo.php` muestra la forma. Si se pierde, se cambia la clave en hPanel y se rehace ese archivo.
- Tarea programada de Hostinger cada 5 minutos (`admin/api/cron.php`, uid `q2kbWmx0BM`): anota si el servidor respondió y cuántos jugadores había, y borra muestras de más de 90 días.
- La consulta del estado pasó a `sitio/privado/mc.php` (la web no la sirve), compartida por `estado.php` y el panel.
- `scripts/subir-sitio.mjs` ya no sube la configuración local de pruebas; la real se sube con `SUBIR_CONFIG=<archivo>`. Reintenta 3 veces si Hostinger corta.
- Probado aquí con MariaDB y una llave simulada: código malo rechazado, código con guiones y minúsculas aceptado, panel, globo de la gráfica (mouse y dedo), 7 días, salir y entrar, el mismo dispositivo dos veces, y las reglas de acceso (sin sesión, sin origen, `config.php` y `privado/` cerrados). En Hostinger se revisaron las mismas reglas.
- Error: el código de Isaac salió «no es correcto» la primera vez. Causa: el SHA-256 del PC llegó y se cargó tarde, porque las credenciales de subida (duran unas 6 horas) se vencieron. Solución: credenciales nuevas y se subió `config.php` con el SHA-256.
- Falta: que Isaac registre su iPhone y, para la siguiente parte, el plugin SyntaaxPanel (lag, memoria, consola, plugins y configuración).

## 21 nov 2026 · Primer dispositivo del panel
- Isaac no estaba cerca del PC y pidió el código desde el iPhone. Se generó uno nuevo en la nube (12 signos sin 0, O, 1, I ni L), se cambió su SHA-256 en `config.php` de Hostinger y se le pasó por este chat, con su permiso. El de `secretos/codigo-panel.txt` del PC quedó sin valor: falta borrarlo en el PC.
- Isaac registró su iPhone y entró al panel. Desde ahí, el código de instalación ya no sirve (comprobado: el panel pide entrar primero con un dispositivo registrado).
- Pendiente: agregar el PC como segundo dispositivo, para no depender solo del iPhone.
