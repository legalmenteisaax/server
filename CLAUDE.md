# Servidor de Minecraft · PC y celular

## Qué es
El servidor de Minecraft de Isaac, alojado en su PC con Windows (IsaacPC). Antes estaba en Tarohosting; la carpeta de ese servidor está en el PC. Se entra desde el PC (Minecraft Java) y desde el celular (Minecraft Bedrock, el de iPhone y Android).

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
El `.gitignore` deja fuera todo menos lo que nombra: el mundo, los `.jar`, los registros, las listas de jugadores (`ops.json`, `whitelist.json`, `usercache.json`, `banned-*.json`) y las claves: la de Floodgate (`plugins/floodgate/key.pem`), la de playit y `rcon.password` de `server.properties`. Para guardar algo nuevo en Git se agrega una excepción con `!` en el `.gitignore`, revisando antes que no lleve claves.

## Orden de trabajo
1. Revisar la carpeta de Tarohosting: tipo de servidor, versión, plugins, mundos y `online-mode` en `server.properties` (`true` = cuentas originales, `false` = no premium).
2. Copia completa de la carpeta original, sin tocarla.
3. Java y Paper en la versión que toca.
4. Geyser y Floodgate. Probar en la casa, desde el PC y el celular.
5. playit.gg. Probar desde datos móviles.
6. Iniciar con doble clic y copia automática del mundo.

## Estructura
- `docs/bitacora.md` → qué se hizo en cada sesión, errores con su causa y solución, y qué falta.
- `scripts/` → lo que se haga para iniciar el servidor y sacar copias (por hacer).
