// Panel de SyntaaxMC: entrar con Face ID / Windows Hello (passkeys), estado del servidor, gráfica de jugadores y dispositivos.
(function () {
  "use strict";
  var app = document.getElementById("app");
  var temporizador = null;
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
    clearInterval(temporizador);
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

  // ---------- panel ----------
  function panel() {
    app.innerHTML =
      '<header class="barra ancha"><span class="marca">Syntaax<em>MC</em><small>Panel</small></span>' +
      '<button class="secundario" id="salir">Salir</button></header>' +
      '<section class="card ahora" id="ahora"><p class="tag"><b>Ahora</b><span id="revisado"></span></p>' +
      '<div class="grande" id="estado"><i class="punto"></i><span>Revisando…</span></div>' +
      '<div class="cifras"><div class="cifra"><b id="c-pct">–</b><span id="c-pct-t">En línea</span></div>' +
      '<div class="cifra"><b id="c-pico">–</b><span id="c-pico-t">Pico de jugadores</span></div></div></section>' +
      '<section class="card" id="c-grafica"><p class="tag"><b>Jugadores conectados</b></p>' +
      '<div class="filtros" role="group" aria-label="Rango"><button type="button" data-rango="24h">24 horas</button><button type="button" data-rango="7d">7 días</button></div>' +
      '<div id="grafica"></div></section>' +
      '<section class="card"><p class="tag"><b>Dispositivos</b><span>Entran con su llave</span></p>' +
      '<ul class="lista" id="dispositivos"></ul>' +
      '<button class="secundario" id="agregar">' + "Agregar este dispositivo</button>" +
      '<p class="error" id="error-disp" hidden></p></section>' +
      '<section class="card pronto"><p class="tag"><b>Con el plugin del PC</b><span>Próximo</span></p>' +
      "<ul><li>Lag (TPS) y memoria</li><li>Consola para mandar comandos</li><li>Plugins y su configuración</li></ul></section>";
    app.querySelector("#salir").addEventListener("click", function () { api("salir", {}).then(arrancar, arrancar); });
    app.querySelectorAll("[data-rango]").forEach(function (b) {
      b.addEventListener("click", function () { rango = b.getAttribute("data-rango"); cargarResumen(); });
    });
    app.querySelector("#agregar").addEventListener("click", agregarDispositivo);
    cargarResumen();
    cargarDispositivos();
    temporizador = setInterval(function () { if (document.visibilityState === "visible") cargarResumen(); }, 60000);
  }

  function sesionTerminada(e) {
    if (e.estado === 401) { arrancar(); return true; }
    return false;
  }

  function cargarResumen() {
    app.querySelectorAll("[data-rango]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-rango") === rango)); });
    var g = app.querySelector("#grafica");
    if (g) g.classList.add("cargando");
    api("resumen?rango=" + rango).then(function (d) {
      ultimo = d;
      pintarAhora(d);
      pintarGrafica(d);
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

  // ---------- gráfica: una sola serie (jugadores) y debajo una franja de en línea / apagado ----------
  var NS = "http://www.w3.org/2000/svg";
  function el(nombre, attrs, padre) {
    var n = document.createElementNS(NS, nombre);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (padre) padre.appendChild(n);
    return n;
  }

  function pintarGrafica(d) {
    var caja = app.querySelector("#grafica");
    caja.classList.remove("cargando");
    if (!d.serie.length) {
      caja.innerHTML = '<p class="vacio">Todavía no hay datos. El panel anota el estado cada 5 minutos.</p>';
      return;
    }
    caja.innerHTML = '<div class="grafica"><div class="globo" hidden><b></b><span></span></div></div>' +
      '<div class="leyenda"><span><i class="i-on"></i>En línea</span><span><i class="i-off"></i>Apagado</span></div>' +
      '<details class="tabla"><summary>Ver tabla</summary><table><thead><tr><th>' + (d.rango === "7d" ? "Día" : "Hora") +
      "</th><th>Máximo</th><th>En línea</th></tr></thead><tbody></tbody></table></details>";
    var cont = caja.querySelector(".grafica");
    var globo = cont.querySelector(".globo");
    var W = Math.max(280, cont.clientWidth), H = 210;
    var m = { izq: 26, der: 8, arr: 12, aba: 40 };
    var paso = d.rango === "7d" ? 3600 : 300;
    var hasta = d.hasta, desde = hasta - (d.rango === "7d" ? 168 : 24) * 3600;
    var maxJ = 0;
    d.serie.forEach(function (p) { if (p[1] !== null && p[1] > maxJ) maxJ = p[1]; });
    var yMax = Math.max(4, maxJ <= 10 ? Math.ceil(maxJ / 2) * 2 : Math.ceil(maxJ / 5) * 5);
    var x = function (t) { return m.izq + (t - desde) / (hasta - desde) * (W - m.izq - m.der); };
    var alto = H - m.arr - m.aba;
    var y = function (v) { return m.arr + alto - v / yMax * alto; };
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Jugadores conectados " + (d.rango === "7d" ? "en los últimos 7 días" : "en las últimas 24 horas") });
    cont.insertBefore(svg, globo);

    [0, yMax / 2, yMax].forEach(function (v) {
      el("line", { class: "g-rejilla", x1: m.izq, x2: W - m.der, y1: y(v), y2: y(v) }, svg);
      el("text", { class: "g-eje", x: m.izq - 8, y: y(v) + 3.5, "text-anchor": "end" }, svg).textContent = String(v);
    });

    // Tramos seguidos: se cortan donde el servidor estuvo apagado o donde faltan muestras.
    var tramos = [], actual = [];
    d.serie.forEach(function (p, i) {
      var previo = d.serie[i - 1];
      var salto = previo && p[0] - previo[0] > paso * 2.5;
      if (p[1] === null || salto) { if (actual.length) tramos.push(actual); actual = []; }
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

    // Franja de en línea / apagado.
    var fy = H - m.aba + 10;
    el("rect", { class: "g-pista", x: m.izq, y: fy, width: W - m.izq - m.der, height: 6, rx: 3 }, svg);
    d.serie.forEach(function (p, i) {
      var sig = d.serie[i + 1];
      var fin = sig && sig[0] - p[0] <= paso * 2.5 ? sig[0] : p[0] + paso;
      el("rect", { class: p[1] === null ? "g-off" : "g-on", x: x(p[0]).toFixed(1), y: fy, width: Math.max(1.5, x(Math.min(fin, hasta)) - x(p[0])).toFixed(1), height: 6 }, svg);
    });

    // Etiquetas de tiempo: cada 6 horas o cada día, en la hora del dispositivo.
    var marcas = [];
    var t0 = new Date(desde * 1000);
    if (d.rango === "7d") {
      t0.setHours(24, 0, 0, 0);
      for (var t = t0.getTime() / 1000; t < hasta; t += 86400) marcas.push([t, dia(t)]);
    } else {
      t0.setMinutes(0, 0, 0);
      t0.setHours(Math.ceil((t0.getHours() + 1) / 6) * 6);
      for (var t2 = t0.getTime() / 1000; t2 < hasta; t2 += 6 * 3600) marcas.push([t2, fHoraCorta.format(new Date(t2 * 1000))]);
    }
    marcas.forEach(function (mk) {
      el("text", { class: "g-eje", x: x(mk[0]).toFixed(1), y: H - 8, "text-anchor": "middle" }, svg).textContent = mk[1];
    });

    // Guía y globo: siguen al dedo o al mouse y se pegan a la muestra más cercana.
    var guia = el("line", { class: "g-guia", y1: m.arr, y2: fy + 6, visibility: "hidden" }, svg);
    var marca = el("circle", { class: "g-marca", r: 4.5, visibility: "hidden" }, svg);
    var zona = el("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" }, svg);
    function mover(ev) {
      var r = svg.getBoundingClientRect();
      var px = (ev.clientX - r.left) * W / r.width;
      var t = desde + (px - m.izq) / (W - m.izq - m.der) * (hasta - desde);
      var mejor = d.serie[0];
      d.serie.forEach(function (p) { if (Math.abs(p[0] - t) < Math.abs(mejor[0] - t)) mejor = p; });
      var gx = x(mejor[0]);
      guia.setAttribute("x1", gx); guia.setAttribute("x2", gx); guia.setAttribute("visibility", "visible");
      if (mejor[1] !== null) { marca.setAttribute("cx", gx); marca.setAttribute("cy", y(mejor[1])); marca.setAttribute("visibility", "visible"); }
      else marca.setAttribute("visibility", "hidden");
      globo.querySelector("b").textContent = mejor[1] === null ? "Apagado" : jugadores(mejor[1]);
      globo.querySelector("span").textContent = d.rango === "7d" ? dia(mejor[0]) + ", " + hora(mejor[0]) : hora(mejor[0]);
      globo.hidden = false;
      var izq = gx * r.width / W;
      globo.style.left = Math.min(Math.max(izq, 60), r.width - 60) + "px";
      globo.style.top = "-14px";
    }
    function ocultar() { guia.setAttribute("visibility", "hidden"); marca.setAttribute("visibility", "hidden"); globo.hidden = true; }
    zona.addEventListener("pointermove", mover);
    zona.addEventListener("pointerdown", mover);
    // Con el mouse se esconde al salir; con el dedo se queda hasta el siguiente toque.
    zona.addEventListener("pointerleave", function (ev) { if (ev.pointerType === "mouse") ocultar(); });

    // Tabla: por hora (24 horas) o por día (7 días).
    var grupos = {};
    d.serie.forEach(function (p) {
      var f = new Date(p[0] * 1000);
      if (d.rango === "7d") f.setHours(0, 0, 0, 0); else f.setMinutes(0, 0, 0);
      var k = f.getTime() / 1000;
      var gr = grupos[k] || (grupos[k] = { max: null, on: 0, n: 0 });
      gr.n++;
      if (p[1] !== null) { gr.on++; gr.max = Math.max(gr.max || 0, p[1]); }
    });
    var cuerpo = caja.querySelector("tbody");
    Object.keys(grupos).sort().reverse().forEach(function (k) {
      var gr = grupos[k];
      var tr = document.createElement("tr");
      [d.rango === "7d" ? dia(+k) : hora(+k), gr.max === null ? "–" : String(gr.max), Math.round(100 * gr.on / gr.n) + " %"].forEach(function (v) {
        var td = document.createElement("td"); td.textContent = v; tr.appendChild(td);
      });
      cuerpo.appendChild(tr);
    });
  }

  var redibujo = null;
  window.addEventListener("resize", function () {
    clearTimeout(redibujo);
    redibujo = setTimeout(function () { if (ultimo && app.querySelector("#grafica")) pintarGrafica(ultimo); }, 150);
  });

  // ---------- dispositivos ----------
  function cargarDispositivos() {
    api("dispositivos").then(function (lista) {
      var ul = app.querySelector("#dispositivos");
      ul.innerHTML = "";
      lista.forEach(function (dv) {
        var li = document.createElement("li");
        li.innerHTML = '<div><b></b><small></small></div><button class="secundario peligro">Quitar</button>';
        li.querySelector("b").textContent = dv.nombre;
        if (dv.este) li.querySelector("b").insertAdjacentHTML("beforeend", '<span class="chip">Este</span>');
        li.querySelector("small").textContent = dv.ultimo_uso ? "Último uso: " + fecha(dv.ultimo_uso) : "Agregado: " + fecha(dv.creada);
        li.querySelector("button").addEventListener("click", function () {
          if (!confirm("¿Quitar «" + dv.nombre + "»? Ese dispositivo ya no podrá entrar al panel.")) return;
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

  arrancar();
})();
