// Sube sitio/ a public_html/syntaaxmc en Hostinger (https://syntaaxmc.isaacyepez.com) con el protocolo TUS,
// el mismo del administrador de archivos. Las credenciales duran unas 6 horas: salen de
// hosting_files_generate-upload-url (usuario u810585570, dominio isaacyepez.com) y llegan por las variables
// SUBIR_URL, SUBIR_AUTH y SUBIR_REST. Uso, desde la raíz del repositorio:
//   node scripts/subir-sitio.mjs            → sube todo sitio/
//   node scripts/subir-sitio.mjs index.html → sube solo esos archivos
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const sitio = resolve(import.meta.dirname, "../sitio");
const carpeta = "syntaaxmc";
const { SUBIR_URL: url, SUBIR_AUTH: auth, SUBIR_REST: rest } = process.env;
if (!url || !auth || !rest) throw new Error("Faltan SUBIR_URL, SUBIR_AUTH o SUBIR_REST.");

const todos = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? todos(join(dir, e.name)) : [join(dir, e.name)]);
const pedidos = process.argv.slice(2);
const archivos = (pedidos.length ? pedidos.map((a) => resolve(sitio, a)) : todos(sitio))
  .map((a) => [relative(sitio, a).replaceAll("\\", "/"), a]);

for (const [ruta, archivo] of archivos) {
  const datos = readFileSync(archivo);
  const destino = `${url}/${carpeta}/${ruta.split("/").map(encodeURIComponent).join("/")}?override=true`;
  const h = { "X-Auth": auth, "X-Auth-Rest": rest, "Tus-Resumable": "1.0.0" };
  const crear = await fetch(destino, { method: "POST", headers: { ...h, "Upload-Length": String(datos.length), "Upload-Offset": "0" } });
  if (crear.status !== 201) throw new Error(`${ruta}: crear respondió ${crear.status} ${await crear.text()}`);
  const enviar = await fetch(destino, { method: "PATCH", headers: { ...h, "Content-Type": "application/offset+octet-stream", "Upload-Offset": "0" }, body: datos });
  if (enviar.status !== 204) throw new Error(`${ruta}: enviar respondió ${enviar.status} ${await enviar.text()}`);
  console.log(`✓ ${ruta} (${datos.length} bytes)`);
}
