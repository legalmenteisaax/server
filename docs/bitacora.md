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
- **Rango del celular**: `.Isaac075095` quedó en `propietario`. Tiene además un prefijo propio «Bedrock» con el mismo peso (1000) que el de «Propietario».
- Error: la copia de los plugins salió con 324 archivos menos. Causa: un archivo bloqueado (la base de LuckPerms) dejaba abierta una entrada del zip y fallaban todos los siguientes. Solución: leer cada archivo a memoria antes de crear la entrada; la base de LuckPerms se copia con `lp export`.
- Error: LuckPerms no encuentra `.Isaac075095` por nombre (el punto no es válido). Solución: usar el UUID `00000000-0000-0000-0009-01f659d197bf`.
- Error: el servidor y playit se cerraron a las 17:37 y a las 18:04, seguramente al cerrar sus ventanas; el watchdog los prendió. Ahora corren sin ventana.
- Ojo: PowerShell 5.1 lee los `.ps1` sin BOM como ANSI. `bandeja.ps1` y `prueba-bandeja.ps1` van en UTF-8 con BOM por las tildes.
- Falta: Isaac quita el acceso de DriveBackupV2 en su cuenta de Google (las copias de su Drive siguen ahí). Decidir qué hacer con los 5 `.jar` de Fabric/Forge que no cargan. EssentialsX todavía no tiene versión para 26.2. P2 a P4 en la nube.

## 20 nov 2026 · Página pública (fase P2)
- Publicada en https://syntaaxmc.isaacyepez.com (carpeta `public_html/syntaaxmc`). Los archivos están en `sitio/` y se suben con `scripts/subir-sitio.mjs`. Identidad de ¡saax con la letra Montserrat guardada en el propio sitio (sin Google Fonts) y reglas de seguridad (CSP) que solo dejan correr código del sitio.
- Dominio: se borró el CNAME `syntaaxmc` → `molecule-limitation.tun.ply.gg` (el túnel viejo; Java no lo usaba) y Hostinger puso el ALIAS al crear el subdominio. El SRV de Java quedó igual y sigue funcionando.
- Error: el subdominio quedó en `public_html/public_html/syntaaxmc`. Causa: el campo `directory` de `hosting_websites_add-domain` es relativo a `public_html` y se le pasó `public_html/syntaaxmc`. Solución: se quitó el subdominio y se volvió a crear con `syntaaxmc`. Quedó la carpeta vacía `public_html/public_html/syntaaxmc`: hay que borrarla desde el Administrador de archivos de Hostinger, porque la API no borra archivos.
- Error: `estado.php` decía «Apagado» con el servidor prendido. Causa: playit cierra la conexión si el saludo no trae el nombre del túnel, y se mandaba `syntaaxmc.isaacyepez.com:25565`. Java moderno, al seguir el SRV, manda `molecule-darkness.tun.ply.gg:44997`. Solución: saludar con el destino del SRV. Por lo mismo, consultar el túnel por la IP (`147.185.221.217:44997`) da «apagado» aunque funcione: no es una falla del túnel.
- Hostinger sí sale por puertos poco comunes (probado con portquiz.net en 44997 y 25565).
- `estado.php` hace 2 intentos (IPv4 e IPv6), guarda la respuesta 30 segundos y sigue mostrando «en línea» 3 minutos si una consulta suelta falla.
- Falta: probar el botón «Agregar a Minecraft» en un iPhone de verdad, borrar la carpeta vacía y las fases P3 y P4.
