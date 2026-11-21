// Panel de SyntaaxMC: entrar con Face ID / Windows Hello (passkeys) y, con el menú desplegable, las secciones:
// resumen, jugadores, rangos, consola, rendimiento, plugins, archivos, conexión, dispositivos y sugerencias.
(function () {
  "use strict";
  var app = document.getElementById("app");
  var rango = "24h";
  var ultimo = null;

  // ---------- utilidades ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function api(ruta, cuerpo, metodo) {
    var o = { method: metodo || (cuerpo ? "POST" : "GET"), credentials: "same-origin", headers: {} };
    if (cuerpo) { o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(cuerpo); }
    return fetch("api/" + ruta, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.error || "No se pudo conectar con el panel."); e.estado = r.status; throw e; }
        return d;
      });
    }, function () { throw new Error("Sin conexión. Revisa el internet e intenta de nuevo."); });
  }
  function aBytes(s) { return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), function (c) { return c.charCodeAt(0); }); }
  function aTexto(b) { return btoa(String.fromCharCode.apply(null, new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function metodo() {
    var ua = navigator.userAgent;
    if (/iPhone|iPad/.test(ua)) return "Face ID";
    if (/Windows/.test(ua)) return "Windows Hello";
    if (/Macintosh/.test(ua)) return "Touch ID";
    if (/Android/.test(ua)) return "tu huella";
    return "tu llave";
  }
  function nombreDispositivo() {
    var ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return "iPhone";
    if (/iPad/.test(ua)) return "iPad";
    if (/Windows/.test(ua)) return "PC con Windows";
    if (/Macintosh/.test(ua)) return "Mac";
    if (/Android/.test(ua)) return "Android";
    return "Este dispositivo";
  }
  function errorPasskey(e) {
    throw new Error(e.name === "NotAllowedError" ? "Se canceló o se agotó el tiempo. Intenta de nuevo."
      : e.name === "InvalidStateError" ? "Este dispositivo ya está registrado." : "No se pudo usar la llave (" + e.message + ").");
  }
  var fHora = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });
  var fHoraCorta = new Intl.DateTimeFormat("es-CO", { hour: "numeric" });
  var fDia = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric" });
  var fFecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  function hora(t) { return fHora.format(new Date(t * 1000)); }
  function dia(t) { return fDia.format(new Date(t * 1000)).replace(",", ""); }
  function fecha(t) { return fFecha.format(new Date(t * 1000)); }
  function jugadores(n) { return n === 1 ? "1 jugador" : n + " jugadores"; }
  function mostrarError(donde, e) {
    var el = app.querySelector(donde);
    if (el) { el.textContent = e.message; el.hidden = false; }
  }
  var ICONO_LLAVE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/></svg>';

  // ---------- arranque ----------
  function arrancar() {
    limpiar();
    api("estado").then(function (e) {
      if (e.sesion) return panel();
      return e.instalado ? pantallaEntrar() : pantallaInstalar();
    }).catch(function (e) {
      app.innerHTML = '<section class="card acceso"><p class="tag"><b>Panel</b></p><h1>Syntaax<em>MC</em></h1><p class="error"></p></section>';
      mostrarError(".error", e);
    });
  }

  // ---------- primer dispositivo ----------
  function pantallaInstalar() {
    app.innerHTML =
      '<section class="card acceso"><p class="tag"><b>Panel de SyntaaxMC</b></p>' +
      "<h1>Primer dispositivo</h1>" +
      '<p class="nota">Escribe el código que te mostró el PC del servidor. Sirve una sola vez.</p>' +
      '<form id="instalar">' +
      '<label class="campo"><span>Código</span><input name="codigo" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX"></label>' +
      '<label class="campo"><span>Nombre de este dispositivo</span><input name="nombre" required maxlength="80" value="' + esc(nombreDispositivo()) + '"></label>' +
      '<button class="boton ancho">Continuar</button></form>' +
      '<p class="error" hidden></p></section>';
    app.querySelector("#instalar").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var datos = { codigo: f.codigo.value, nombre: f.nombre.value };
      f.querySelector("button").disabled = true;
      // Safari pide que la llave se cree justo al tocar un botón: primero se piden las opciones y después se muestra ese botón.
      prepararLlave(datos).then(function (opciones) {
        app.querySelector(".acceso").innerHTML =
          '<p class="tag"><b>Panel de SyntaaxMC</b></p><h1>Crea tu llave</h1>' +
          '<p class="nota">Toca el botón y confirma con ' + esc(metodo()) + ". Así vas a entrar de ahora en adelante.</p>" +
          '<button class="boton ancho" id="crear">' + ICONO_LLAVE + " Crear llave con " + esc(metodo()) + "</button>" +
          '<p class="error" hidden></p>';
        app.querySelector("#crear").addEventListener("click", function () {
          crearLlave(opciones, datos).then(arrancar, function (e) {
            mostrarError(".error", e);
            prepararLlave(datos).then(function (o) { opciones = o; }, function () {});
          });
        });
      }, function (e) {
        f.querySelector("button").disabled = false;
        mostrarError(".error", e);
      });
    });
  }
  function prepararLlave(datos) {
    return api("registro/opciones", datos).then(function (o) {
      o.challenge = aBytes(o.challenge);
      o.user.id = aBytes(o.user.id);
      o.excludeCredentials = o.excludeCredentials.map(function (c) { return { type: c.type, id: aBytes(c.id) }; });
      return o;
    });
  }
  function crearLlave(opciones, datos) {
    return navigator.credentials.create({ publicKey: opciones }).catch(errorPasskey).then(function (c) {
      return api("registro/verificar", {
        codigo: datos.codigo, nombre: datos.nombre,
        credencial: { id: c.id, clientDataJSON: aTexto(c.response.clientDataJSON), attestationObject: aTexto(c.response.attestationObject) }
      });
    });
  }

  // ---------- entrar ----------
  function pantallaEntrar() {
    var opciones = api("entrar/opciones", {});
    opciones.catch(function () {});
    app.innerHTML =
      '<section class="card acceso"><p class="tag"><b>Panel</b></p><h1>Syntaax<em>MC</em></h1>' +
      '<p class="nota">Administración del servidor.</p>' +
      '<button class="boton ancho" id="entrar">' + ICONO_LLAVE + " Entrar con " + esc(metodo()) + "</button>" +
      '<p class="error" hidden></p></section>';
    app.querySelector("#entrar").addEventListener("click", function () {
      opciones.then(function (o) {
        return navigator.credentials.get({ publicKey: { challenge: aBytes(o.challenge), rpId: o.rpId, userVerification: o.userVerification, allowCredentials: [], timeout: o.timeout } });
      }).catch(errorPasskey).then(function (c) {
        var r = c.response;
        return api("entrar/verificar", { credencial: { id: c.id, clientDataJSON: aTexto(r.clientDataJSON), authenticatorData: aTexto(r.authenticatorData), signature: aTexto(r.signature) } });
      }).then(arrancar, function (e) {
        mostrarError(".error", e);
        opciones = api("entrar/opciones", {});
        opciones.catch(function () {});
      });
    });
  }

  // ---------- relojes y ayudas del panel ----------
  var relojes = [];
  function cada(fn, ms) { relojes.push(setInterval(function () { if (document.visibilityState === "visible") fn(); }, ms)); }
  function limpiar() { relojes.forEach(clearInterval); relojes = []; }
  function tamano(b) {
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(b < 10240 ? 1 : 0).replace(".", ",") + " KB";
    return (b / 1048576).toFixed(1).replace(".", ",") + " MB";
  }
  function haceCuanto(t) {
    var s = Math.max(0, Math.round(Date.now() / 1000 - t));
    if (s < 60) return "hace " + s + " s";
    if (s < 3600) return "hace " + Math.round(s / 60) + " min";
    if (s < 86400) return "hace " + Math.round(s / 3600) + " h";
    return fecha(t);
  }
  function confirmar(texto) { return window.confirm(texto); }
  /** Pide algo al plugin del servidor y espera la respuesta (hasta 40 segundos). */
  function tarea(tipo, datos) {
    return api("tareas", { tipo: tipo, datos: datos || {} }).then(function (r) {
      var inicio = Date.now();
      return new Promise(function (ok, mal) {
        (function pedir() {
          api("tareas/" + r.id).then(function (t) {
            if (t.estado === "hecha") ok(t.datos);
            else if (t.estado === "error") mal(new Error(t.error || "No se pudo."));
            else if (Date.now() - inicio > 40000) mal(new Error("El servidor no respondió a tiempo."));
            else setTimeout(pedir, 700);
          }, mal);
        })();
      });
    });
  }
  function nodo(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
  function tarjeta(html, ancha) { var c = nodo('<section class="card' + (ancha ? " ancha" : "") + '">' + html + "</section>"); contenido().appendChild(c); return c; }
  function contenido() { return app.querySelector("#contenido"); }
  function aviso(donde, texto, clase) { if (!donde) return; donde.textContent = texto; donde.className = "mensaje" + (clase ? " " + clase : ""); }
  /** Prefijos de rango con colores de Minecraft (&6, &l...). */
  function pintarPrefijo(el, texto) {
    el.textContent = "";
    var color = "", partes = String(texto).split(/[&§]([0-9a-fk-or])/i);
    el.appendChild(document.createTextNode(partes[0]));
    for (var i = 1; i < partes.length; i += 2) {
      var c = partes[i].toLowerCase();
      if (/[0-9a-f]/.test(c)) color = "c" + c; else if (c === "r") color = "";
      if (partes[i + 1]) { var s = document.createElement("span"); if (color) s.className = color; s.textContent = partes[i + 1]; el.appendChild(s); }
    }
  }
  var ICONO_CARPETA = '<svg class="icono-arch" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  var ICONO_ARCHIVO = '<svg class="icono-arch" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
  var ICONO_CANDADO = '<svg class="icono-arch" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/></svg>';

  // ---------- el panel: barra con menú desplegable y la sección elegida ----------
  var SECCIONES = [
    ["resumen", "Resumen"], ["jugadores", "Jugadores"], ["rangos", "Rangos"], ["consola", "Consola"],
    ["rendimiento", "Rendimiento"], ["plugins", "Plugins"], ["archivos", "Archivos"], null,
    ["conexion", "Conexión"], ["dispositivos", "Dispositivos"], ["sugerencias", "Sugerencias"]
  ];
  var rutaArchivos = "";

  function panel() {
    app.innerHTML =
      '<header class="barra ancha"><span class="marca">Syntaax<em>MC</em><small>Panel</small></span>' +
      '<button class="menu-boton" id="menu-boton" aria-expanded="false" aria-controls="menu"><span></span>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
      '<nav class="menu" id="menu" hidden>' + SECCIONES.map(function (s) {
        return s ? '<a href="#/' + s[0] + '">' + s[1] + "</a>" : "<hr>";
      }).join("") + '<hr><a href="#salir" id="salir">Salir</a></nav></header>' +
      '<div class="seccion" id="contenido"></div>';
    var boton = app.querySelector("#menu-boton"), menu = app.querySelector("#menu");
    function abrir(si) { menu.hidden = !si; boton.setAttribute("aria-expanded", String(si)); }
    boton.addEventListener("click", function (e) { e.stopPropagation(); abrir(menu.hidden); });
    document.addEventListener("click", function (e) { if (!menu.contains(e.target)) abrir(false); });
    menu.addEventListener("click", function () { abrir(false); });
    app.querySelector("#salir").addEventListener("click", function (e) { e.preventDefault(); limpiar(); api("salir", {}).then(arrancar, arrancar); });
    window.onhashchange = mostrarSeccion;
    mostrarSeccion();
  }

  function mostrarSeccion() {
    if (!app.querySelector("#contenido")) return;
    var id = (location.hash.match(/^#\/([a-z]+)/) || [])[1] || "resumen";
    if (!SECCION[id]) id = "resumen";
    limpiar();
    app.querySelectorAll("#menu a[href^='#/']").forEach(function (a) {
      if (a.getAttribute("href") === "#/" + id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    var s = SECCIONES.filter(function (x) { return x && x[0] === id; })[0];
    app.querySelector("#menu-boton span").textContent = s[1];
    contenido().innerHTML = "";
    window.scrollTo(0, 0);
    SECCION[id]();
  }

  /** Las secciones que usan el plugin primero revisan que el servidor esté conectado. */
  function conServidor(fn) {
    var espera = tarjeta('<p class="nota">Conectando con el servidor…</p>', true);
    api("servidor").then(function (s) {
      espera.remove();
      if (!s.conectado) {
        tarjeta('<p class="tag"><b>Falta conectar el servidor</b></p><p class="nota">Esta sección necesita el plugin SyntaaxPanel en el PC del servidor.</p>' +
          '<p><a class="boton" href="#/conexion">Ver cómo conectarlo</a></p>', true);
      } else if (!s.en_linea) {
        tarjeta('<p class="tag"><b>Servidor sin conexión</b></p><p class="nota">El servidor está apagado o sin internet. Última señal: ' +
          esc(s.latido ? haceCuanto(s.latido) : "nunca") + ".</p>", true);
      } else fn(s);
    }, function (e) { if (!sesionTerminada(e)) { espera.querySelector(".nota").textContent = e.message; } });
  }

  function sesionTerminada(e) {
    if (e.estado === 401) { limpiar(); arrancar(); return true; }
    return false;
  }

  var SECCION = {};

  // ---------- Resumen ----------
  SECCION.resumen = function () {
    contenido().appendChild(nodo('<section class="card ahora" id="ahora"><p class="tag"><b>Ahora</b><span id="revisado"></span></p>' +
      '<div class="grande" id="estado"><i class="punto"></i><span>Revisando…</span></div>' +
      '<div class="cifras"><div class="cifra"><b id="c-pct">–</b><span id="c-pct-t">En línea</span></div>' +
      '<div class="cifra"><b id="c-pico">–</b><span id="c-pico-t">Pico de jugadores</span></div></div></section>'));
    contenido().appendChild(nodo('<section class="card" id="c-grafica"><p class="tag"><b>Jugadores conectados</b></p>' +
      '<div class="filtros" role="group" aria-label="Rango"><button type="button" data-rango="24h">24 horas</button><button type="button" data-rango="7d">7 días</button></div>' +
      '<div id="grafica"></div></section>'));
    var plug = tarjeta('<div class="aviso-servidor"><div><p class="tag"><b>Plugin del servidor</b></p><p class="nota" id="plug">Revisando…</p></div>' +
      '<a class="secundario" href="#/conexion">Conexión</a></div>', true);
    api("servidor").then(function (s) {
      plug.querySelector("#plug").textContent = !s.conectado ? "Sin conectar: conéctalo para ver lag, consola, jugadores y archivos."
        : s.en_linea ? "Conectado · versión " + s.version + " · última señal " + haceCuanto(s.latido) + "."
        : "Sin señal desde " + (s.latido ? haceCuanto(s.latido) : "que se conectó") + ".";
    }, function () {});
    app.querySelectorAll("[data-rango]").forEach(function (b) {
      b.addEventListener("click", function () { rango = b.getAttribute("data-rango"); cargarResumen(); });
    });
    cargarResumen();
    cada(cargarResumen, 60000);
  };

  function cargarResumen() {
    app.querySelectorAll("[data-rango]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-rango") === rango)); });
    var g = app.querySelector("#grafica");
    if (g) g.classList.add("cargando");
    api("resumen?rango=" + rango).then(function (d) {
      if (!app.querySelector("#ahora")) return;
      ultimo = d;
      pintarAhora(d);
      pintarJugadores(d);
    }, function (e) {
      if (!sesionTerminada(e) && g) { g.classList.remove("cargando"); g.innerHTML = '<p class="vacio"></p>'; g.firstChild.textContent = e.message; }
    });
  }

  function pintarAhora(d) {
    var a = d.ahora;
    var caja = app.querySelector("#ahora");
    caja.classList.toggle("on", a.en_linea);
    caja.classList.toggle("off", !a.en_linea);
    app.querySelector("#estado span").textContent = a.en_linea ? "En línea · " + a.jugadores + " de " + a.max : "Apagado";
    app.querySelector("#revisado").textContent = "Revisado " + hora(a.revisado);
    var periodo = d.rango === "7d" ? "en 7 días" : "en 24 horas";
    app.querySelector("#c-pct").textContent = d.en_linea_pct === null ? "–" : String(d.en_linea_pct).replace(".", ",") + " %";
    app.querySelector("#c-pct-t").textContent = "En línea " + periodo;
    app.querySelector("#c-pico").textContent = d.pico ? String(d.pico.jugadores) : "–";
    app.querySelector("#c-pico-t").textContent = d.pico ? "Pico, " + (d.rango === "7d" ? fecha(d.pico.t) : hora(d.pico.t)) : "Pico de jugadores";
  }

  function pintarJugadores(d) {
    var caja = app.querySelector("#grafica");
    caja.classList.remove("cargando");
    if (!d.serie.length) { caja.innerHTML = '<p class="vacio">Todavía no hay datos. El panel anota el estado cada 5 minutos.</p>'; return; }
    caja.innerHTML = "";
    var siete = d.rango === "7d";
    grafica(caja, {
      serie: d.serie, hasta: d.hasta, desde: d.hasta - (siete ? 168 : 24) * 3600, paso: siete ? 3600 : 300, siete: siete,
      franja: true, minimo: 4, entero: true, valor: function (v) { return v === null ? "Apagado" : jugadores(v); },
      etiqueta: "Jugadores conectados " + (siete ? "en los últimos 7 días" : "en las últimas 24 horas")
    });
    caja.insertAdjacentHTML("beforeend", '<div class="leyenda"><span><i class="i-on"></i>En línea</span><span><i class="i-off"></i>Apagado</span></div>' +
      '<details class="tabla"><summary>Ver tabla</summary><table><thead><tr><th>' + (siete ? "Día" : "Hora") +
      "</th><th>Máximo</th><th>En línea</th></tr></thead><tbody></tbody></table></details>");
    var grupos = {};
    d.serie.forEach(function (p) {
      var f = new Date(p[0] * 1000);
      if (siete) f.setHours(0, 0, 0, 0); else f.setMinutes(0, 0, 0);
      var k = f.getTime() / 1000;
      var gr = grupos[k] || (grupos[k] = { max: null, on: 0, n: 0 });
      gr.n++;
      if (p[1] !== null) { gr.on++; gr.max = Math.max(gr.max || 0, p[1]); }
    });
    var cuerpo = caja.querySelector("tbody");
    Object.keys(grupos).sort().reverse().forEach(function (k) {
      var gr = grupos[k], tr = document.createElement("tr");
      [siete ? dia(+k) : hora(+k), gr.max === null ? "–" : String(gr.max), Math.round(100 * gr.on / gr.n) + " %"].forEach(function (v) {
        var td = document.createElement("td"); td.textContent = v; tr.appendChild(td);
      });
      cuerpo.appendChild(tr);
    });
  }

  // ---------- gráfica de una sola serie, con guía y globo al tocar ----------
  var NS = "http://www.w3.org/2000/svg";
  function el(nombre, attrs, padre) {
    var n = document.createElementNS(NS, nombre);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (padre) padre.appendChild(n);
    return n;
  }
  function grafica(caja, o) {
    var cont = nodo('<div class="grafica"><div class="globo" hidden><b></b><span></span></div></div>');
    caja.appendChild(cont);
    var globo = cont.querySelector(".globo");
    var W = Math.max(260, cont.clientWidth), H = o.alto || 200;
    var m = { izq: 34, der: 8, arr: 12, aba: o.franja ? 40 : 26 };
    var desde = o.desde, hasta = o.hasta, paso = o.paso;
    var maxV = 0;
    o.serie.forEach(function (p) { if (p[1] !== null && p[1] > maxV) maxV = p[1]; });
    var yMax = o.fijo || Math.max(o.minimo || 1, maxV <= 10 ? Math.ceil(maxV / 2) * 2 : maxV <= 100 ? Math.ceil(maxV / 10) * 10 : Math.ceil(maxV / 100) * 100);
    var x = function (t) { return m.izq + (t - desde) / (hasta - desde) * (W - m.izq - m.der); };
    var alto = H - m.arr - m.aba;
    var y = function (v) { return m.arr + alto - Math.min(v, yMax) / yMax * alto; };
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": o.etiqueta || "" });
    cont.insertBefore(svg, globo);
    [0, yMax / 2, yMax].forEach(function (v) {
      el("line", { class: "g-rejilla", x1: m.izq, x2: W - m.der, y1: y(v), y2: y(v) }, svg);
      el("text", { class: "g-eje", x: m.izq - 8, y: y(v) + 3.5, "text-anchor": "end" }, svg).textContent = o.entero ? String(Math.round(v)) : String(+v.toFixed(1)).replace(".", ",");
    });
    var tramos = [], actual = [];
    o.serie.forEach(function (p, i) {
      var previo = o.serie[i - 1];
      if (p[1] === null || (previo && p[0] - previo[0] > paso * 2.5)) { if (actual.length) tramos.push(actual); actual = []; }
      if (p[1] !== null) actual.push(p);
    });
    if (actual.length) tramos.push(actual);
    tramos.forEach(function (tr) {
      var linea = tr.map(function (p, i) { return (i ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1); }).join("");
      if (tr.length === 1) linea += "h2";
      var base = y(0).toFixed(1);
      el("path", { class: "g-area", d: linea + "L" + x(tr[tr.length - 1][0]).toFixed(1) + " " + base + "L" + x(tr[0][0]).toFixed(1) + " " + base + "Z" }, svg);
      el("path", { class: "g-linea", d: linea }, svg);
    });
    var fy = H - m.aba + 10;
    if (o.franja) {
      el("rect", { class: "g-pista", x: m.izq, y: fy, width: W - m.izq - m.der, height: 6, rx: 3 }, svg);
      o.serie.forEach(function (p, i) {
        var sig = o.serie[i + 1];
        var fin = sig && sig[0] - p[0] <= paso * 2.5 ? sig[0] : p[0] + paso;
        el("rect", { class: p[1] === null ? "g-off" : "g-on", x: x(p[0]).toFixed(1), y: fy, width: Math.max(1.5, x(Math.min(fin, hasta)) - x(p[0])).toFixed(1), height: 6 }, svg);
      });
    }
    var marcas = [], t0 = new Date(desde * 1000);
    if (o.siete) {
      t0.setHours(24, 0, 0, 0);
      for (var t = t0.getTime() / 1000; t < hasta; t += 86400) marcas.push([t, dia(t)]);
    } else {
      var cadaH = (hasta - desde) <= 3600 ? 0.25 : 6;
      t0.setMinutes(cadaH < 1 ? Math.ceil((t0.getMinutes() + 1) / 15) * 15 : 0, 0, 0);
      if (cadaH >= 1) t0.setHours(Math.ceil((t0.getHours() + 1) / 6) * 6);
      for (var t2 = t0.getTime() / 1000; t2 < hasta; t2 += cadaH * 3600) marcas.push([t2, cadaH < 1 ? hora(t2) : fHoraCorta.format(new Date(t2 * 1000))]);
    }
    marcas.forEach(function (mk) { el("text", { class: "g-eje", x: x(mk[0]).toFixed(1), y: H - 8, "text-anchor": "middle" }, svg).textContent = mk[1]; });
    var guia = el("line", { class: "g-guia", y1: m.arr, y2: o.franja ? fy + 6 : y(0), visibility: "hidden" }, svg);
    var marca = el("circle", { class: "g-marca", r: 4.5, visibility: "hidden" }, svg);
    var zona = el("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" }, svg);
    if (!o.serie.length) return;
    function mover(ev) {
      var r = svg.getBoundingClientRect();
      var t = desde + ((ev.clientX - r.left) * W / r.width - m.izq) / (W - m.izq - m.der) * (hasta - desde);
      var mejor = o.serie[0];
      o.serie.forEach(function (p) { if (Math.abs(p[0] - t) < Math.abs(mejor[0] - t)) mejor = p; });
      var gx = x(mejor[0]);
      guia.setAttribute("x1", gx); guia.setAttribute("x2", gx); guia.setAttribute("visibility", "visible");
      if (mejor[1] !== null) { marca.setAttribute("cx", gx); marca.setAttribute("cy", y(mejor[1])); marca.setAttribute("visibility", "visible"); }
      else marca.setAttribute("visibility", "hidden");
      globo.querySelector("b").textContent = o.valor(mejor[1]);
      globo.querySelector("span").textContent = o.siete ? dia(mejor[0]) + ", " + hora(mejor[0]) : hora(mejor[0]);
      globo.hidden = false;
      globo.style.left = Math.min(Math.max(gx * r.width / W, 60), r.width - 60) + "px";
      globo.style.top = "-14px";
    }
    zona.addEventListener("pointermove", mover);
    zona.addEventListener("pointerdown", mover);
    // Con el mouse se esconde al salir; con el dedo se queda hasta el siguiente toque.
    zona.addEventListener("pointerleave", function (ev) {
      if (ev.pointerType === "mouse") { guia.setAttribute("visibility", "hidden"); marca.setAttribute("visibility", "hidden"); globo.hidden = true; }
    });
  }

  var redibujo = null;
  window.addEventListener("resize", function () {
    clearTimeout(redibujo);
    redibujo = setTimeout(function () { if (ultimo && app.querySelector("#grafica")) pintarJugadores(ultimo); }, 150);
  });

  // ---------- Jugadores ----------
  SECCION.jugadores = function () {
    conServidor(function () {
      var c = tarjeta('<p class="tag"><b>Jugadores que han entrado</b><span id="cuantos"></span></p>' +
        '<div class="buscar"><input type="search" id="buscar" placeholder="Buscar por nombre" autocomplete="off"></div>' +
        '<div class="chips" role="group" aria-label="Filtro">' +
        [["todos", "Todos"], ["linea", "En línea"], ["op", "Operadores"], ["bedrock", "Celular"], ["ban", "Baneados"]].map(function (f, i) {
          return '<button type="button" data-f="' + f[0] + '" aria-pressed="' + (i === 0) + '">' + f[1] + "</button>";
        }).join("") + '</div><ul class="filas" id="lista"><li class="nota">Cargando…</li></ul>' +
        '<p class="nota">Lo que cambies aquí queda guardado en el servidor y aplica cuando el jugador vuelva a entrar.</p>', true);
      var estado = { lista: [], grupos: [], filtro: "todos", abierto: null };
      function pintar() {
        var q = c.querySelector("#buscar").value.trim().toLowerCase();
        var lista = estado.lista.filter(function (j) {
          if (q && j.nombre.toLowerCase().indexOf(q) < 0) return false;
          return estado.filtro === "todos" || (estado.filtro === "linea" && j.en_linea) || (estado.filtro === "op" && j.op)
            || (estado.filtro === "bedrock" && j.bedrock) || (estado.filtro === "ban" && j.baneado);
        });
        c.querySelector("#cuantos").textContent = lista.length + " de " + estado.lista.length;
        var ul = c.querySelector("#lista");
        ul.innerHTML = "";
        if (!lista.length) ul.innerHTML = '<li class="nota">Nadie con ese filtro.</li>';
        lista.forEach(function (j) { ul.appendChild(filaJugador(j, estado)); });
      }
      estado.pintar = pintar;
      c.querySelector("#buscar").addEventListener("input", pintar);
      c.querySelectorAll("[data-f]").forEach(function (b) {
        b.addEventListener("click", function () {
          estado.filtro = b.getAttribute("data-f");
          c.querySelectorAll("[data-f]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          pintar();
        });
      });
      Promise.all([tarea("jugadores"), tarea("grupos").catch(function () { return []; })]).then(function (r) {
        estado.lista = r[0]; estado.grupos = r[1];
        pintar();
      }, function (e) { if (!sesionTerminada(e)) c.querySelector("#lista").innerHTML = '<li class="nota"></li>', c.querySelector("#lista li").textContent = e.message; });
    });
  };

  function filaJugador(j, estado) {
    var li = nodo('<li class="fila"><button class="cabeza" type="button"><span class="inicial"></span><span class="que"><b></b><small></small></span>' +
      '<span class="marcas"></span></button></li>');
    li.querySelector(".inicial").textContent = j.nombre.replace(/^\./, "").charAt(0).toUpperCase() || "?";
    li.querySelector("b").textContent = j.nombre;
    li.querySelector("small").textContent = j.en_linea ? "Conectado ahora" : "Última vez: " + fecha(j.ultima);
    var marcas = li.querySelector(".marcas");
    function marca(texto, clase) { var s = document.createElement("span"); s.className = "m " + (clase || ""); s.textContent = texto; marcas.appendChild(s); }
    if (j.en_linea) marca("En línea", "on");
    if (j.op) marca("OP", "op");
    if (j.baneado) marca("Baneado", "ban");
    if (j.bedrock) marca("Celular");
    if (j.rango && j.rango !== "default") marca(j.rango);
    li.querySelector(".cabeza").addEventListener("click", function () {
      estado.abierto = estado.abierto === j.uuid ? null : j.uuid;
      estado.pintar();
    });
    if (estado.abierto !== j.uuid) return li;
    var d = nodo('<div class="detalle">' +
      '<div class="linea"><span class="etiqueta">Rango</span><select aria-label="Rango"></select><button class="mini" data-a="rango_poner">Poner</button></div>' +
      '<div class="acciones"></div><p class="mensaje" aria-live="polite"></p>' +
      '<p class="nota">Primera vez: ' + esc(fecha(j.primera)) + (j.bedrock ? " · Entra desde el celular (Bedrock)" : " · Java") + "</p></div>");
    var sel = d.querySelector("select");
    (estado.grupos.length ? estado.grupos : [{ nombre: j.rango || "default" }]).forEach(function (g) {
      var o = document.createElement("option"); o.value = g.nombre; o.textContent = g.nombre; if (g.nombre === j.rango) o.selected = true; sel.appendChild(o);
    });
    if (!estado.grupos.length) { sel.disabled = true; d.querySelector("[data-a=rango_poner]").disabled = true; }
    var acc = d.querySelector(".acciones");
    function boton(texto, accion, peligro) {
      var b = document.createElement("button"); b.className = "secundario" + (peligro ? " peligro" : ""); b.textContent = texto; b.setAttribute("data-a", accion); acc.appendChild(b);
    }
    boton(j.op ? "Quitar operador" : "Hacer operador", j.op ? "deop" : "op");
    boton(j.lista_blanca ? "Sacar de lista blanca" : "Agregar a lista blanca", j.lista_blanca ? "lista_blanca_no" : "lista_blanca_si");
    if (j.en_linea) boton("Expulsar", "expulsar", true);
    boton(j.baneado ? "Desbanear" : "Banear", j.baneado ? "desbanear" : "banear", !j.baneado);
    var msg = d.querySelector(".mensaje");
    d.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-a]");
      if (!b) return;
      var accion = b.getAttribute("data-a"), datos = { uuid: j.uuid, accion: accion };
      if (accion === "rango_poner") datos.grupo = sel.value;
      if (accion === "op" && !confirmar("¿Hacer operador a " + j.nombre + "? Podrá usar todos los comandos.")) return;
      if (accion === "banear" || accion === "expulsar") {
        var motivo = prompt((accion === "banear" ? "Motivo del baneo de " : "Motivo para expulsar a ") + j.nombre + " (opcional)", "");
        if (motivo === null) return;
        datos.motivo = motivo;
      }
      d.querySelectorAll("button,select").forEach(function (x) { x.disabled = true; });
      aviso(msg, "Aplicando…");
      tarea("jugador", datos).then(function (nuevo) {
        for (var k in nuevo) j[k] = nuevo[k];
        estado.pintar();
        var m = app.querySelector(".fila .detalle .mensaje");
        aviso(m, "Listo. Queda guardado en el servidor.", "bien");
      }, function (e) {
        d.querySelectorAll("button,select").forEach(function (x) { x.disabled = false; });
        aviso(msg, e.message, "mal");
      });
    });
    li.appendChild(d);
    return li;
  }

  // ---------- Rangos (LuckPerms) ----------
  SECCION.rangos = function () {
    conServidor(function () {
      var c = tarjeta('<p class="tag"><b>Rangos</b><span>LuckPerms</span></p>' +
        '<form class="linea" id="crear"><input name="nombre" placeholder="Nombre del rango nuevo (ej. vip)" maxlength="36" autocomplete="off" required>' +
        '<button class="boton">Crear rango</button></form><p class="mensaje" id="m-crear" aria-live="polite"></p>' +
        '<ul class="filas" id="lista"><li class="nota">Cargando…</li></ul>' +
        '<p class="nota">El peso ordena los rangos: el más alto manda. El prefijo admite colores de Minecraft como &amp;6 o &amp;l.</p>', true);
      var estado = { grupos: [], abierto: null };
      function pintar() {
        var ul = c.querySelector("#lista");
        ul.innerHTML = "";
        estado.grupos.forEach(function (g) { ul.appendChild(filaRango(g, estado)); });
      }
      estado.pintar = pintar;
      estado.aplicar = function (datos, msg) {
        aviso(msg, "Aplicando…");
        return tarea("grupo", datos).then(function (grupos) { estado.grupos = grupos; pintar(); }, function (e) { aviso(msg, e.message, "mal"); throw e; });
      };
      c.querySelector("#crear").addEventListener("submit", function (ev) {
        ev.preventDefault();
        var n = ev.target.nombre.value.trim().toLowerCase();
        estado.abierto = n;
        estado.aplicar({ accion: "crear", grupo: n }, c.querySelector("#m-crear")).then(function () { ev.target.reset(); aviso(c.querySelector("#m-crear"), "Rango creado.", "bien"); }, function () {});
      });
      tarea("grupos").then(function (g) { estado.grupos = g; pintar(); }, function (e) {
        if (!sesionTerminada(e)) { c.querySelector("#lista").innerHTML = '<li class="nota"></li>'; c.querySelector("#lista li").textContent = e.message; }
      });
    });
  };

  function filaRango(g, estado) {
    var li = nodo('<li class="fila"><button class="cabeza" type="button"><span class="inicial"></span><span class="que"><b></b><small></small></span>' +
      '<span class="marcas"></span></button></li>');
    li.querySelector(".inicial").textContent = g.nombre.charAt(0).toUpperCase();
    li.querySelector("b").textContent = g.nombre + (g.visible ? " · " + g.visible : "");
    var sm = li.querySelector("small");
    if (g.prefijo) { var p = document.createElement("span"); p.className = "prefijo"; pintarPrefijo(p, g.prefijo); sm.appendChild(p); sm.appendChild(document.createTextNode(" · ")); }
    sm.appendChild(document.createTextNode("peso " + g.peso + (g.miembros >= 0 ? " · " + g.miembros + (g.miembros === 1 ? " jugador" : " jugadores") : "")));
    var mk = document.createElement("span"); mk.className = "m"; mk.textContent = g.permisos.length + " permisos"; li.querySelector(".marcas").appendChild(mk);
    li.querySelector(".cabeza").addEventListener("click", function () { estado.abierto = estado.abierto === g.nombre ? null : g.nombre; estado.pintar(); });
    if (estado.abierto !== g.nombre) return li;
    var d = nodo('<div class="detalle">' +
      campoRango("prefijo", "Prefijo", g.prefijo, "&6[VIP] ") + campoRango("sufijo", "Sufijo", g.sufijo, "") +
      campoRango("visible", "Nombre visible", g.visible, "") + campoRango("peso", "Peso", String(g.peso), "", "number") +
      '<div><span class="etiqueta">Permisos</span><ul class="permisos"></ul></div>' +
      '<form class="linea" data-form="permiso"><input name="nodo" placeholder="essentials.fly" autocomplete="off" required>' +
      '<button class="mini" value="permiso_poner">Permitir</button><button class="mini" value="permiso_negar">Negar</button></form>' +
      '<div><span class="etiqueta">Hereda los permisos de</span><div class="acciones" data-padres></div></div>' +
      '<div class="linea"><select aria-label="Rango para heredar"></select><button class="mini" data-a="padre_agregar">Agregar</button></div>' +
      '<p class="mensaje" aria-live="polite"></p>' +
      (g.nombre === "default" ? '<p class="nota">«default» es el rango de todos los jugadores; no se puede borrar.</p>' : '<button class="secundario peligro" data-a="borrar">Borrar rango</button>') + "</div>");
    var msg = d.querySelector(".mensaje");
    var ul = d.querySelector(".permisos");
    if (!g.permisos.length) ul.innerHTML = '<li><span class="nota">Sin permisos propios.</span></li>';
    g.permisos.forEach(function (p) {
      var it = nodo('<li><span></span><button class="mini" data-a="permiso_quitar">Quitar</button></li>');
      it.querySelector("span").textContent = p.nodo + (p.valor ? "" : " (negado)");
      if (!p.valor) it.querySelector("span").className = "no";
      it.querySelector("button").setAttribute("data-valor", p.nodo);
      ul.appendChild(it);
    });
    var padres = d.querySelector("[data-padres]");
    if (!g.padres.length) padres.innerHTML = '<span class="nota">Ninguno.</span>';
    g.padres.forEach(function (n) {
      var b = nodo('<button class="mini" data-a="padre_quitar" title="Quitar"></button>'); b.textContent = n + " ×"; b.setAttribute("data-valor", n); padres.appendChild(b);
    });
    var sel = d.querySelector("select");
    estado.grupos.forEach(function (o) {
      if (o.nombre === g.nombre || g.padres.indexOf(o.nombre) >= 0) return;
      var op = document.createElement("option"); op.value = o.nombre; op.textContent = o.nombre; sel.appendChild(op);
    });
    d.querySelectorAll("[data-campo]").forEach(function (f) {
      var vista = f.querySelector(".prefijo");
      if (vista) { var inp = f.querySelector("input"); pintarPrefijo(vista, inp.value); inp.addEventListener("input", function () { pintarPrefijo(vista, inp.value); }); }
      f.addEventListener("submit", function (ev) {
        ev.preventDefault();
        estado.aplicar({ accion: f.getAttribute("data-campo"), grupo: g.nombre, valor: f.querySelector("input").value }, msg).catch(function () {});
      });
    });
    d.querySelector("[data-form=permiso]").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var accion = (ev.submitter && ev.submitter.value) || "permiso_poner";
      estado.aplicar({ accion: accion, grupo: g.nombre, valor: ev.target.nodo.value.trim() }, msg).catch(function () {});
    });
    d.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-a]");
      if (!b) return;
      var accion = b.getAttribute("data-a"), valor = b.getAttribute("data-valor") || (accion === "padre_agregar" ? sel.value : "");
      if (accion === "padre_agregar" && !valor) return;
      if (accion === "borrar" && !confirmar("¿Borrar el rango «" + g.nombre + "»? Los jugadores que lo tengan lo pierden.")) return;
      if (accion === "borrar") estado.abierto = null;
      estado.aplicar({ accion: accion, grupo: g.nombre, valor: valor }, msg).catch(function () {});
    });
    li.appendChild(d);
    return li;
  }

  function campoRango(campo, titulo, valor, ejemplo, tipo) {
    return '<form class="linea" data-campo="' + campo + '"><span class="etiqueta">' + titulo + "</span>" +
      '<input value="' + esc(valor) + '" placeholder="' + esc(ejemplo) + '"' + (tipo ? ' type="' + tipo + '" inputmode="numeric"' : "") + ' maxlength="100" autocomplete="off">' +
      '<button class="mini">Guardar</button>' + (campo === "prefijo" || campo === "sufijo" ? '<span class="prefijo" aria-hidden="true"></span>' : "") + "</form>";
  }

  // ---------- Consola ----------
  SECCION.consola = function () {
    conServidor(function () {
      var c = tarjeta('<p class="tag"><b>Consola</b><span id="en-vivo">En vivo</span></p><div class="terminal" id="term" tabindex="0" aria-label="Consola del servidor"></div>' +
        '<form class="enviar" id="enviar"><input name="cmd" placeholder="Comando, por ejemplo: list" autocomplete="off" autocapitalize="off" spellcheck="false" required>' +
        '<button class="boton">Enviar</button></form><p class="mensaje" id="m-cmd" aria-live="polite"></p>' +
        '<div class="chips"><button type="button" data-cmd="list">Quién está</button><button type="button" data-cmd="save-all">Guardar mundo</button>' +
        '<button type="button" data-cmd="time set day">Hacer de día</button><button type="button" data-cmd="weather clear">Quitar lluvia</button></div>', true);
      var s = tarjeta('<p class="tag"><b>Servidor</b></p><p class="nota">Reiniciar lo apaga y la bandeja del PC lo prende otra vez en unos segundos. ' +
        'Apagar lo deja apagado: para prenderlo hay que usar la bandeja del PC.</p>' +
        '<div class="acciones"><button class="secundario" data-s="reiniciar">Reiniciar</button><button class="secundario peligro" data-s="apagar">Apagar</button></div>' +
        '<p class="mensaje" aria-live="polite"></p>', true);
      var term = c.querySelector("#term"), ultimoId = 0;
      function agregar(lineas) {
        var abajo = term.scrollHeight - term.scrollTop - term.clientHeight < 40;
        lineas.forEach(function (l) {
          ultimoId = Math.max(ultimoId, l.id);
          var d = document.createElement("div");
          if (/ WARN\]/.test(l.texto)) d.className = "warn"; else if (/ (ERROR|FATAL)\]/.test(l.texto)) d.className = "error";
          d.textContent = l.texto;
          term.appendChild(d);
        });
        while (term.childNodes.length > 1500) term.removeChild(term.firstChild);
        if (abajo || lineas.length && ultimoId === lineas[lineas.length - 1].id && term.childNodes.length === lineas.length) term.scrollTop = term.scrollHeight;
      }
      function traer() { api("consola" + (ultimoId ? "?desde=" + ultimoId : "")).then(agregar, function (e) { sesionTerminada(e); }); }
      traer();
      cada(traer, 2000);
      var PELIGRO = /^\/?(stop|op|deop|ban|ban-ip|pardon|kill|kick|reload|restart|whitelist\s+off|lp\s+.*delete)/i;
      function mandar(texto) {
        var msg = c.querySelector("#m-cmd");
        if (PELIGRO.test(texto) && !confirmar("¿Mandar «" + texto + "»? Es un comando delicado.")) return Promise.resolve();
        aviso(msg, "Mandando…");
        return tarea("comando", { texto: texto }).then(function () { aviso(msg, "Enviado: " + texto, "bien"); setTimeout(traer, 800); }, function (e) { aviso(msg, e.message, "mal"); });
      }
      c.querySelector("#enviar").addEventListener("submit", function (ev) {
        ev.preventDefault();
        var t = ev.target.cmd.value.trim();
        if (t) mandar(t).then(function () { ev.target.reset(); });
      });
      c.querySelectorAll("[data-cmd]").forEach(function (b) { b.addEventListener("click", function () { mandar(b.getAttribute("data-cmd")); }); });
      s.querySelectorAll("[data-s]").forEach(function (b) {
        b.addEventListener("click", function () {
          var a = b.getAttribute("data-s"), msg = s.querySelector(".mensaje");
          if (!confirmar(a === "apagar" ? "¿Apagar el servidor? Para prenderlo de nuevo tendrás que usar la bandeja del PC." : "¿Reiniciar el servidor? Los jugadores se desconectan un momento.")) return;
          aviso(msg, "Enviando…");
          tarea("servidor", { accion: a }).then(function () {
            aviso(msg, a === "apagar" ? "Se está apagando." : "Se está reiniciando. Vuelve a esta sección en un minuto.", "bien");
          }, function (e) { aviso(msg, e.message, "mal"); });
        });
      });
    });
  };

  // ---------- Rendimiento ----------
  var rangoMet = "1h";
  SECCION.rendimiento = function () {
    conServidor(function (srv) {
      var a = tarjeta('<p class="tag"><b>Ahora</b><span id="act"></span></p><div class="tiles">' +
        '<div class="cifra"><b id="t-tps">–</b><span>TPS (lag; 20 es perfecto)</span></div><div class="cifra"><b id="t-mspt">–</b><span>Milisegundos por tick</span></div>' +
        '<div class="cifra"><b id="t-ram">–</b><span id="t-ram-t">Memoria</span><div class="barrita"><i id="t-ram-b"></i></div></div><div class="cifra"><b id="t-cpu">–</b><span>Procesador (CPU)</span></div>' +
        '</div><table class="simple" id="mundos"><thead><tr><th>Mundo</th><th>Chunks</th><th>Entidades</th><th>Jugadores</th></tr></thead><tbody></tbody></table>', true);
      var h = tarjeta('<p class="tag"><b>Historial</b></p><div class="filtros" role="group" aria-label="Rango">' +
        '<button type="button" data-r="1h">1 hora</button><button type="button" data-r="24h">24 horas</button><button type="button" data-r="7d">7 días</button></div>' +
        '<div class="graficas" id="graficas"></div>', true);
      function ahora(s) {
        var e = (s.estado || {}), m = e.metricas || {};
        a.querySelector("#act").textContent = s.latido ? "Actualizado " + haceCuanto(s.latido) : "";
        var tps = a.querySelector("#t-tps");
        tps.textContent = m.tps !== undefined ? String(m.tps).replace(".", ",") : "–";
        tps.className = m.tps >= 19 ? "bien" : m.tps >= 15 ? "medio" : "mal";
        a.querySelector("#t-mspt").textContent = m.mspt !== undefined ? String(m.mspt).replace(".", ",") + " ms" : "–";
        a.querySelector("#t-ram").textContent = m.ram_mb !== undefined ? (m.ram_mb / 1024).toFixed(1).replace(".", ",") + " GB" : "–";
        a.querySelector("#t-ram-t").textContent = m.ram_max_mb ? "Memoria de " + (m.ram_max_mb / 1024).toFixed(1).replace(".", ",") + " GB" : "Memoria";
        a.querySelector("#t-ram-b").style.width = m.ram_max_mb ? Math.min(100, 100 * m.ram_mb / m.ram_max_mb) + "%" : "0";
        a.querySelector("#t-cpu").textContent = m.cpu !== undefined ? String(m.cpu).replace(".", ",") + " %" : "–";
        var tb = a.querySelector("#mundos tbody");
        tb.innerHTML = "";
        (e.mundos || []).forEach(function (w) {
          var tr = document.createElement("tr");
          [w.nombre, w.chunks, w.entidades, w.jugadores].forEach(function (v) { var td = document.createElement("td"); td.textContent = String(v); tr.appendChild(td); });
          tb.appendChild(tr);
        });
      }
      ahora(srv);
      cada(function () { api("servidor").then(ahora, function () {}); }, 5000);
      function historial() {
        h.querySelectorAll("[data-r]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-r") === rangoMet)); });
        api("metricas?rango=" + rangoMet).then(function (d) {
          var g = h.querySelector("#graficas");
          g.innerHTML = "";
          if (!d.serie.length) { g.innerHTML = '<p class="vacio">Todavía no hay datos. Se anota una muestra por minuto.</p>'; return; }
          var horas = { "1h": 1, "24h": 24, "7d": 168 }[d.rango];
          var ramMax = 0;
          d.serie.forEach(function (p) { if (p[4] > ramMax) ramMax = p[4]; });
          [["TPS", 1, { fijo: 20, fmt: function (v) { return String(v).replace(".", ",") + " TPS"; } }],
           ["Memoria (MB)", 3, { fijo: ramMax || null, entero: true, fmt: function (v) { return Math.round(v) + " MB"; } }],
           ["Procesador (%)", 5, { minimo: 10, fmt: function (v) { return String(v).replace(".", ",") + " %"; } }],
           ["Milisegundos por tick", 2, { minimo: 50, fmt: function (v) { return String(v).replace(".", ",") + " ms"; } }]].forEach(function (s) {
            var caja = nodo('<div><h3></h3></div>'); caja.querySelector("h3").textContent = s[0]; g.appendChild(caja);
            grafica(caja, {
              serie: d.serie.map(function (p) { return [p[0], p[s[1]]]; }), hasta: d.hasta, desde: d.hasta - horas * 3600, paso: d.paso,
              siete: d.rango === "7d", fijo: s[2].fijo, minimo: s[2].minimo, entero: s[2].entero, alto: 160,
              valor: function (v) { return v === null ? "Sin datos" : s[2].fmt(v); }, etiqueta: s[0]
            });
          });
        }, function (e) { sesionTerminada(e); });
      }
      h.querySelectorAll("[data-r]").forEach(function (b) { b.addEventListener("click", function () { rangoMet = b.getAttribute("data-r"); historial(); }); });
      historial();
      cada(historial, 60000);
    });
  };

  // ---------- Plugins ----------
  SECCION.plugins = function () {
    conServidor(function () {
      var c = tarjeta('<p class="tag"><b>Plugins</b><span id="cuantos"></span></p><ul class="filas" id="lista"><li class="nota">Cargando…</li></ul>', true);
      var abierto = null, lista = [];
      function pintar() {
        var ul = c.querySelector("#lista");
        ul.innerHTML = "";
        lista.forEach(function (p) {
          var li = nodo('<li class="fila"><button class="cabeza" type="button"><span class="inicial"></span><span class="que"><b></b><small></small></span><span class="marcas"></span></button></li>');
          li.querySelector(".inicial").textContent = p.nombre.charAt(0).toUpperCase();
          li.querySelector("b").textContent = p.nombre;
          li.querySelector("small").textContent = "v" + p.version + (p.autores ? " · " + p.autores : "");
          var m = document.createElement("span"); m.className = "m " + (p.activo ? "on" : "ban"); m.textContent = p.activo ? "Activo" : "Apagado";
          li.querySelector(".marcas").appendChild(m);
          li.querySelector(".cabeza").addEventListener("click", function () { abierto = abierto === p.nombre ? null : p.nombre; pintar(); });
          if (abierto === p.nombre) {
            var d = nodo('<div class="detalle"><p class="nota"></p><div class="acciones"></div></div>');
            d.querySelector(".nota").textContent = p.descripcion || "Sin descripción.";
            if (p.carpeta) {
              var b = nodo('<button class="secundario">Ver su configuración</button>');
              b.addEventListener("click", function () { rutaArchivos = p.carpeta; location.hash = "#/archivos"; });
              d.querySelector(".acciones").appendChild(b);
            }
            if (/^https:\/\//.test(p.web)) {
              var w = nodo('<a class="secundario" target="_blank" rel="noopener noreferrer">Página del plugin</a>'); w.href = p.web; d.querySelector(".acciones").appendChild(w);
            }
            li.appendChild(d);
          }
          ul.appendChild(li);
        });
      }
      tarea("plugins").then(function (l) { lista = l; c.querySelector("#cuantos").textContent = l.length + " instalados"; pintar(); }, function (e) {
        if (!sesionTerminada(e)) { c.querySelector("#lista").innerHTML = '<li class="nota"></li>'; c.querySelector("#lista li").textContent = e.message; }
      });
    });
  };

  // ---------- Archivos ----------
  SECCION.archivos = function () {
    conServidor(function () {
      var c = tarjeta('<p class="tag"><b>Archivos del servidor</b><span id="cuantos"></span></p><div class="ruta" id="ruta"></div>' +
        '<ul class="filas" id="lista"><li class="nota">Cargando…</li></ul><p class="nota">Las llaves, la carpeta de playit y la configuración del plugin del panel no se abren desde aquí. ' +
        'En la configuración, las contraseñas y tokens salen como •••••• y se conservan al guardar.</p>', true);
      var visor = null;
      function ir(ruta) {
        rutaArchivos = ruta;
        if (visor) { visor.remove(); visor = null; }
        var migas = c.querySelector("#ruta");
        migas.innerHTML = "";
        var partes = ruta ? ruta.split("/") : [];
        [["Servidor", ""]].concat(partes.map(function (p, i) { return [p, partes.slice(0, i + 1).join("/")]; })).forEach(function (m, i) {
          if (i) { var sep = document.createElement("span"); sep.textContent = "›"; migas.appendChild(sep); }
          var b = document.createElement("button"); b.type = "button"; b.textContent = m[0]; b.addEventListener("click", function () { ir(m[1]); }); migas.appendChild(b);
        });
        var ul = c.querySelector("#lista");
        ul.innerHTML = '<li class="nota">Cargando…</li>';
        tarea("archivos_listar", { ruta: ruta }).then(function (d) {
          ul.innerHTML = "";
          c.querySelector("#cuantos").textContent = d.total + (d.total === 1 ? " elemento" : " elementos");
          if (!d.elementos.length) ul.innerHTML = '<li class="nota">Carpeta vacía.</li>';
          d.elementos.forEach(function (e) {
            var li = nodo('<li class="fila' + (e.carpeta ? " carpeta" : "") + '"><button class="cabeza" type="button">' +
              (e.bloqueado ? ICONO_CANDADO : e.carpeta ? ICONO_CARPETA : ICONO_ARCHIVO) + '<span class="que"><b></b><small></small></span></button></li>');
            li.querySelector("b").textContent = e.nombre;
            li.querySelector("small").textContent = (e.carpeta ? "Carpeta" : tamano(e.tamano)) + " · " + fecha(e.modificado) + (e.bloqueado ? " · protegido" : "");
            li.querySelector(".cabeza").addEventListener("click", function () { if (e.carpeta && !e.bloqueado) ir(e.ruta); else abrir(e); });
            ul.appendChild(li);
          });
          if (d.total > d.elementos.length) ul.insertAdjacentHTML("beforeend", '<li class="nota">Se muestran los primeros 1000.</li>');
        }, function (e) { if (!sesionTerminada(e)) { ul.innerHTML = '<li class="nota"></li>'; ul.firstChild.textContent = e.message; } });
      }
      function abrir(e) {
        if (visor) visor.remove();
        visor = tarjeta('<p class="tag"><b></b><span></span></p><div id="cuerpo"><p class="nota">Abriendo…</p></div><p class="mensaje" aria-live="polite"></p>', true);
        visor.querySelector(".tag b").textContent = e.ruta;
        visor.querySelector(".tag span").textContent = e.carpeta ? "Carpeta" : tamano(e.tamano);
        visor.scrollIntoView({ behavior: "smooth", block: "start" });
        var cuerpo = visor.querySelector("#cuerpo"), msg = visor.querySelector(".mensaje");
        if (e.bloqueado) { cuerpo.innerHTML = '<p class="nota">' + (e.carpeta ? "Esta carpeta" : "Este archivo") + ' tiene claves y no se abre desde el panel.</p>'; return; }
        tarea("archivo_leer", { ruta: e.ruta }).then(function (d) {
          if (d.tipo === "imagen") {
            cuerpo.innerHTML = '<img class="vista-img" alt="">';
            cuerpo.querySelector("img").src = "data:" + d.mime + ";base64," + d.base64;
            cuerpo.querySelector("img").alt = e.nombre;
          } else if (d.tipo === "texto") {
            cuerpo.innerHTML = (d.tapado ? '<p class="nota">Los valores secretos salen como •••••• y se conservan al guardar.</p>' : "") +
              '<textarea class="editor" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>' +
              '<div class="acciones"><button class="boton" data-g>Guardar</button><button class="secundario" data-c>Cerrar</button></div>';
            var ed = cuerpo.querySelector("textarea"), hash = d.hash, original = d.contenido;
            ed.value = d.contenido;
            ed.addEventListener("keydown", function (ev) {
              if (ev.key === "Tab") { ev.preventDefault(); var s = ed.selectionStart; ed.setRangeText("  ", s, ed.selectionEnd, "end"); }
            });
            cuerpo.querySelector("[data-c]").addEventListener("click", function () {
              if (ed.value !== original && !confirmar("Tienes cambios sin guardar. ¿Cerrar igual?")) return;
              visor.remove(); visor = null;
            });
            cuerpo.querySelector("[data-g]").addEventListener("click", function () {
              if (ed.value === original) { aviso(msg, "No hay cambios."); return; }
              if (!confirmar("¿Guardar " + e.nombre + "? Antes se hace una copia del archivo actual.")) return;
              aviso(msg, "Guardando…");
              tarea("archivo_guardar", { ruta: e.ruta, contenido: ed.value, hash: hash }).then(function (r) {
                hash = r.hash; original = ed.value;
                aviso(msg, "Guardado. Copia del anterior en " + r.copia + ". Algunos plugins necesitan reiniciar el servidor para tomar el cambio.", "bien");
              }, function (er) { aviso(msg, er.message, "mal"); });
            });
          } else {
            cuerpo.innerHTML = '<p class="nota"></p>';
            cuerpo.firstChild.textContent = d.tipo === "grande" ? "Pesa más de 1 MB: no se abre en el panel." : "Es un archivo binario (no es texto): no se puede abrir aquí.";
          }
        }, function (er) { if (!sesionTerminada(er)) { cuerpo.innerHTML = '<p class="nota"></p>'; cuerpo.firstChild.textContent = er.message; } });
      }
      ir(rutaArchivos || "");
    });
  };

  // ---------- Conexión con el plugin ----------
  SECCION.conexion = function () {
    var e = tarjeta('<p class="tag"><b>Estado</b></p><div class="grande" id="c-est"><i class="punto"></i><span>Revisando…</span></div><p class="nota" id="c-det"></p>', true);
    tarjeta('<p class="tag"><b>Instalar o volver a conectar</b></p><ol class="pasos-lista">' +
      '<li>En el PC, descarga el plugin: <a class="secundario" href="api/descargar/plugin">Descargar SyntaaxPanel.jar</a></li>' +
      "<li>Cópialo en <code>C:\\Minecraft\\server\\plugins</code> y reinicia el servidor desde la bandeja (Reiniciar).</li>" +
      '<li>Toca «Generar código» y escribe en la consola del servidor (la de la bandeja): <code>panel conectar CÓDIGO</code>. El código vence en 10 minutos.</li></ol>' +
      '<p><button class="boton" id="generar">Generar código</button></p><div id="codigo"></div><p class="mensaje" aria-live="polite"></p>', true);
    function estado() {
      api("servidor").then(function (s) {
        var caja = e.querySelector("#c-est");
        caja.className = "grande " + (s.en_linea ? "on" : "off");
        caja.querySelector("span").textContent = !s.conectado ? "Sin conectar" : s.en_linea ? "Conectado" : "Sin señal";
        e.querySelector("#c-det").textContent = !s.conectado ? "El plugin SyntaaxPanel todavía no se ha conectado a este panel."
          : "Plugin versión " + s.version + " · última señal " + (s.latido ? haceCuanto(s.latido) : "nunca") + ".";
      }, function (er) { sesionTerminada(er); });
    }
    estado();
    cada(estado, 5000);
    app.querySelector("#generar").addEventListener("click", function () {
      var msg = app.querySelector("#codigo + .mensaje");
      api("conexion/codigo", {}).then(function (r) {
        var cod = app.querySelector("#codigo");
        cod.innerHTML = '<p class="codigo-grande"></p><p class="nota">Escribe en la consola del servidor:</p><p><code class="prefijo"></code></p>';
        cod.querySelector(".codigo-grande").textContent = r.codigo;
        cod.querySelector("code").textContent = "panel conectar " + r.codigo;
        aviso(msg, "Vence en " + r.minutos + " minutos y sirve una sola vez.");
      }, function (er) { if (!sesionTerminada(er)) aviso(msg, er.message, "mal"); });
    });
  };

  // ---------- Dispositivos ----------
  SECCION.dispositivos = function () {
    tarjeta('<p class="tag"><b>Dispositivos</b><span>Entran con su llave</span></p><ul class="lista" id="dispositivos"></ul>' +
      '<button class="secundario" id="agregar">Agregar este dispositivo</button><p class="error" id="error-disp" hidden></p>', true);
    app.querySelector("#agregar").addEventListener("click", agregarDispositivo);
    cargarDispositivos();
  };

  function cargarDispositivos() {
    api("dispositivos").then(function (lista) {
      var ul = app.querySelector("#dispositivos");
      if (!ul) return;
      ul.innerHTML = "";
      lista.forEach(function (dv) {
        var li = document.createElement("li");
        li.innerHTML = '<div><b></b><small></small></div><button class="secundario peligro">Quitar</button>';
        li.querySelector("b").textContent = dv.nombre;
        if (dv.este) li.querySelector("b").insertAdjacentHTML("beforeend", '<span class="chip">Este</span>');
        li.querySelector("small").textContent = dv.ultimo_uso ? "Último uso: " + fecha(dv.ultimo_uso) : "Agregado: " + fecha(dv.creada);
        li.querySelector("button").addEventListener("click", function () {
          if (!confirmar("¿Quitar «" + dv.nombre + "»? Ese dispositivo ya no podrá entrar al panel.")) return;
          api("dispositivos/" + dv.id, null, "DELETE").then(function () { return dv.este ? arrancar() : cargarDispositivos(); }, function (e) {
            if (!sesionTerminada(e)) mostrarError("#error-disp", e);
          });
        });
        ul.appendChild(li);
      });
    }, function (e) { if (!sesionTerminada(e)) mostrarError("#error-disp", e); });
  }

  function agregarDispositivo() {
    var nombre = prompt("Nombre de este dispositivo", nombreDispositivo());
    if (!nombre) return;
    var datos = { nombre: nombre.slice(0, 80) };
    // En iPhone la llave tiene que crearse con un toque: el botón cambia a «Crear llave» cuando las opciones están listas.
    var boton = app.querySelector("#agregar");
    boton.disabled = true;
    prepararLlave(datos).then(function (o) {
      boton.disabled = false;
      boton.textContent = "Crear llave con " + metodo();
      boton.removeEventListener("click", agregarDispositivo);
      boton.addEventListener("click", function crear() {
        boton.removeEventListener("click", crear);
        crearLlave(o, datos).then(function () {
          boton.textContent = "Agregar este dispositivo";
          boton.addEventListener("click", agregarDispositivo);
          cargarDispositivos();
        }, function (e) {
          boton.textContent = "Agregar este dispositivo";
          boton.addEventListener("click", agregarDispositivo);
          mostrarError("#error-disp", e);
        });
      });
    }, function (e) { boton.disabled = false; if (!sesionTerminada(e)) mostrarError("#error-disp", e); });
  }

  // ---------- Sugerencias ----------
  SECCION.sugerencias = function () {
    var c = tarjeta('<p class="tag"><b>Sugerencias para el panel</b></p><p class="nota">Ideas que te propongo. Marca las que quieres: quedan guardadas para la próxima sesión de trabajo.</p>' +
      '<div class="filas" id="lista"></div>', true);
    api("sugerencias").then(function (lista) {
      var cont = c.querySelector("#lista");
      lista.forEach(function (s) {
        var it = nodo('<div class="sugerencia"><h3></h3><p></p><div class="acciones"><button class="secundario voto" data-v="si">Me interesa</button>' +
          '<button class="secundario voto" data-v="no">Ahora no</button></div></div>');
        it.querySelector("h3").textContent = s.titulo;
        it.querySelector("p").textContent = s.texto;
        function marcar(v) { it.querySelectorAll(".voto").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === v)); }); }
        marcar(s.voto);
        it.querySelectorAll(".voto").forEach(function (b) {
          b.addEventListener("click", function () {
            var v = s.voto === b.getAttribute("data-v") ? "" : b.getAttribute("data-v");
            api("sugerencias/voto", { id: s.id, voto: v }).then(function () { s.voto = v || null; marcar(s.voto); }, function (e) { sesionTerminada(e); });
          });
        });
        cont.appendChild(it);
      });
    }, function (e) { sesionTerminada(e); });
  };

  arrancar();
})();
