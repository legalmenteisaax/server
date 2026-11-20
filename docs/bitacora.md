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

## 20 nov 2026 · Página pública (fase P2)
- Publicada en https://syntaaxmc.isaacyepez.com (carpeta `public_html/syntaaxmc`). Los archivos están en `sitio/` y se suben con `scripts/subir-sitio.mjs`. Identidad de ¡saax con la letra Montserrat guardada en el propio sitio (sin Google Fonts) y reglas de seguridad (CSP) que solo dejan correr código del sitio.
- Dominio: se borró el CNAME `syntaaxmc` → `molecule-limitation.tun.ply.gg` (el túnel viejo; Java no lo usaba) y Hostinger puso el ALIAS al crear el subdominio. El SRV de Java quedó igual y sigue funcionando.
- Error: el subdominio quedó en `public_html/public_html/syntaaxmc`. Causa: el campo `directory` de `hosting_websites_add-domain` es relativo a `public_html` y se le pasó `public_html/syntaaxmc`. Solución: se quitó el subdominio y se volvió a crear con `syntaaxmc`. Quedó la carpeta vacía `public_html/public_html/syntaaxmc`: hay que borrarla desde el Administrador de archivos de Hostinger, porque la API no borra archivos.
- Error: `estado.php` decía «Apagado» con el servidor prendido. Causa: playit cierra la conexión si el saludo no trae el nombre del túnel, y se mandaba `syntaaxmc.isaacyepez.com:25565`. Java moderno, al seguir el SRV, manda `molecule-darkness.tun.ply.gg:44997`. Solución: saludar con el destino del SRV. Por lo mismo, consultar el túnel por la IP (`147.185.221.217:44997`) da «apagado» aunque funcione: no es una falla del túnel.
- Hostinger sí sale por puertos poco comunes (probado con portquiz.net en 44997 y 25565).
- `estado.php` hace 2 intentos (IPv4 e IPv6), guarda la respuesta 30 segundos y sigue mostrando «en línea» 3 minutos si una consulta suelta falla.
- Falta: probar el botón «Agregar a Minecraft» en un iPhone de verdad, borrar la carpeta vacía y las fases P3 y P4.
