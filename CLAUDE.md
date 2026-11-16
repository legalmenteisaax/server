# Servidor de Minecraft · PC y celular

## Qué es
El servidor de Minecraft de Isaac, alojado en su PC con Windows (IsaacPC). Antes estaba en Tarohosting; la carpeta de ese servidor está en el PC. Se entra desde el PC (Minecraft Java) y desde el celular (Minecraft Bedrock, el de iPhone y Android).

## Lo que hay para recuperar (revisado el 16 nov 2026)
El servidor se llamaba **SyntaaxMC**: **Paper 1.21.11** (lo dice el `level.dat` de la copia del End), que pide Java 21. El plugin **DriveBackupV2** subía copias al Google Drive de Isaac, carpeta `backups` («backups SyntaaxMC»). Queda una copia de cada cosa:

| Copia | Fecha | Tamaño |
| --- | --- | --- |
| `world` (mundo principal, con los inventarios en `playerdata`) | 10 ago 2026 | 428 MB |
| `plugins` (los plugins con su configuración y sus datos) | 10 ago 2026 | 245 MB |
| `world_nether` | 3 ago 2026 | 11 MB |
| `world_the_end` | 3 ago 2026 | 0,1 MB |
| `worlds` (dos archivos de paquetes de Bedrock; no se usa) | 10 ago 2026 | 1 KB |

No están en las copias: el `.jar` del servidor (se baja de PaperMC), `server.properties` (se rehace si la carpeta del PC no lo trae) ni las listas de jugadores. El Nether y el End quedaron una semana más viejos que el mundo principal. Isaac ya descargó la copia al PC. Desde la nube solo se pueden bajar archivos de Drive de hasta 10 MB, así que esas copias se abren en el PC.

## Decisiones (16 nov 2026)
- **Paper** como servidor: es el de Java, más rápido que el oficial y acepta plugins. Si la carpeta de Tarohosting trae otro (Vanilla, Spigot, Forge o Fabric), se revisa con Isaac antes de cambiarlo: los mods de Forge y Fabric no se ven en el celular.
- **Geyser** (deja entrar a Minecraft Bedrock) y **Floodgate** (los del celular entran sin cuenta de Java). Si la versión del servidor queda atrás de la del celular, se agrega **ViaVersion**.
- **playit.gg** para que entren amigos desde otras casas: es un túnel gratis, no hay que abrir puertos en el router, sirve aunque el operador de internet use CGNAT (común en Colombia) y no muestra la IP de la casa. Java usa TCP 25565 y Bedrock UDP 19132.
- La versión de Java la pide la de Minecraft (Temurin, instalado con `winget`).
- Copia del mundo antes de cada cambio grande: subir de versión cambia el mundo y no se puede volver atrás.
- El servidor solo está abierto mientras el PC esté prendido y el programa corriendo.

## Dónde se trabaja
Todo lo que toca el servidor se hace en el PC, con Claude Code en la carpeta del servidor: instalar Java, el firewall de Windows, playit y dejarlo corriendo. Una sesión en la nube no ve el PC (las carpetas de Control remoto salen como no disponibles para la nube).

## Lo que no va a GitHub
El `.gitignore` deja fuera todo menos lo que nombra: el mundo, la conexión de DriveBackupV2 con Google (está dentro de `plugins/DriveBackupV2/`), los `.jar`, los registros, las listas de jugadores (`ops.json`, `whitelist.json`, `usercache.json`, `banned-*.json`) y las claves: la de Floodgate (`plugins/floodgate/key.pem`), la de playit y `rcon.password` de `server.properties`. Para guardar algo nuevo en Git se agrega una excepción con `!` en el `.gitignore`, revisando antes que no lleve claves.

## Orden de trabajo
1. Revisar la carpeta descargada en el PC: la lista de plugins y si hay `server.properties`, con su `online-mode` (`true` = cuentas originales, `false` = no premium). Mantener la versión 1.21.11 mientras se recupera; subir de versión después, con copia.
2. Copia completa de la carpeta original, sin tocarla.
3. Java y Paper en la versión que toca.
4. Geyser y Floodgate. Probar en la casa, desde el PC y el celular.
5. playit.gg. Probar desde datos móviles.
6. Iniciar con doble clic y copia automática del mundo.

## Estructura
- `docs/bitacora.md` → qué se hizo en cada sesión, errores con su causa y solución, y qué falta.
- `scripts/` → lo que se haga para iniciar el servidor y sacar copias (por hacer).
