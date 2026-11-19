// SyntaaxMC: movimiento de ¡saax, botones de copiar, aviso si Minecraft no abre y estado del servidor.
(function () {
  "use strict";
  document.documentElement.classList.add("js");
  var quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Movimiento compartido de ¡saax (marca.js de isaacyepez.com).
  function movimiento() {
    var revs = Array.prototype.slice.call(document.querySelectorAll("[data-rev]"));
    var cards = Array.prototype.slice.call(document.querySelectorAll(".m-card"));
    revs.forEach(function (el, i) { el.style.setProperty("--d", Math.min(i * 0.06, 0.3) + "s"); });
    if (quieto) return;
    var pend = false;
    function lim(x) { return Math.max(0, Math.min(1, x)); }
    function mover() {
      pend = false;
      var h = window.innerHeight, zona = h * 0.28;
      var fondo = document.documentElement.scrollHeight - h - window.scrollY;
      revs.forEach(function (el) {
        var top = el.getBoundingClientRect().top;
        // En una página corta lo último no alcanza a subir tanto: su zona se achica para que al llegar al final se vea entero.
        var z = Math.max(1, Math.min(zona, h - (top - fondo)));
        el.style.setProperty("--v", lim((h - top) / z).toFixed(3));
      });
      cards.forEach(function (c) {
        var r = c.getBoundingClientRect();
        var p = ((r.top + r.height / 2) - h / 2) / h;
        c.style.setProperty("--p", Math.max(-1, Math.min(1, p)).toFixed(3));
      });
    }
    window.addEventListener("scroll", function () { if (!pend) { pend = true; requestAnimationFrame(mover); } }, { passive: true });
    window.addEventListener("resize", mover);
    mover();
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    cards.forEach(function (c) {
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty("--mx", (e.clientX - r.left) + "px");
        c.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
  }

  // Botones «Copiar».
  function copiar() {
    document.querySelectorAll("[data-copiar]").forEach(function (b) {
      b.addEventListener("click", function () {
        var texto = b.getAttribute("data-copiar");
        var etiqueta = b.querySelector("span");
        var listo = function () {
          etiqueta.textContent = "Copiado";
          b.classList.add("listo");
          setTimeout(function () { etiqueta.textContent = "Copiar"; b.classList.remove("listo"); }, 1600);
        };
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(texto).then(listo, function () { seleccionar(b); });
        } else {
          seleccionar(b);
        }
      });
    });
  }
  function seleccionar(b) {
    var code = b.parentNode.querySelector("code");
    if (!code) return;
    var r = document.createRange();
    r.selectNodeContents(code);
    var s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  // Si al tocar el botón la página sigue a la vista, Minecraft no se abrió: se muestran los datos a mano.
  function agregar() {
    var a = document.getElementById("agregar");
    var aviso = document.getElementById("no-abrio");
    if (!a || !aviso) return;
    a.addEventListener("click", function () {
      var salio = false;
      var marcar = function () { salio = true; };
      document.addEventListener("visibilitychange", marcar, { once: true });
      window.addEventListener("pagehide", marcar, { once: true });
      window.addEventListener("blur", marcar, { once: true });
      setTimeout(function () {
        if (!salio && document.visibilityState === "visible") aviso.hidden = false;
      }, 1800);
    });
  }

  // Estado: en línea con cuántos jugadores, o apagado. Se revisa cada minuto.
  function estado() {
    var el = document.getElementById("estado");
    if (!el || !window.fetch) return;
    var txt = el.querySelector("span");
    function pedir() {
      fetch("estado.php", { cache: "no-store" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) {
          if (d.en_linea) {
            el.className = "estado on";
            txt.textContent = d.jugadores === 1 ? "En línea · 1 jugador" : "En línea · " + d.jugadores + " jugadores";
          } else {
            el.className = "estado off";
            txt.textContent = "Apagado";
          }
          el.hidden = false;
        })
        .catch(function () { el.hidden = true; });
    }
    pedir();
    setInterval(function () { if (document.visibilityState === "visible") pedir(); }, 60000);
  }

  function iniciar() { movimiento(); copiar(); agregar(); estado(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
