/* Práctica de escritura del SMS. Se monta sobre el bloque [data-sms] del cuadro de la secuencia (js/sequence.js).
   Un teléfono simulado con campo de mensaje, teclado en pantalla (tocar o hacer clic) y teclado del computador (letras, Retroceso, Enter).
   Cada tecla se anima al pulsarla (también cuando se pulsa en el teclado físico), se puede borrar, y «Enviar» deja el mensaje en la conversación simulada.
   Es solo una simulación: no envía nada. Los textos están en FF.sms (js/data.js). */
window.FFSms = (function () {
  "use strict";
  var ROWS = ["qwertyuiop", "asdfghjklñ", "zxcvbnm"];
  var PRINTABLE = /^[\p{L}\p{N} .,;:¿?¡!'"()\-]$/u;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };

  function html() {
    var D = window.FF.sms;
    var keys = ROWS.map(function (row, r) {
      var k = row.split("").map(function (c) { return '<button type="button" class="sms-key" data-k="' + c + '" aria-label="' + c + '">' + c + "</button>"; }).join("");
      if (r === 2) k += '<button type="button" class="sms-key wide" data-k="Backspace" aria-label="Borrar la última letra">⌫</button>';
      return '<div class="sms-row r' + r + '">' + k + "</div>";
    }).join("") +
      '<div class="sms-row r3"><button type="button" class="sms-key" data-k="," aria-label="coma">,</button>' +
      '<button type="button" class="sms-key space" data-k=" " aria-label="Espacio">espacio</button>' +
      '<button type="button" class="sms-key" data-k="." aria-label="punto">.</button></div>';
    return '<section class="seq-sms" data-sms aria-label="' + esc(D.title) + '"><h3>' + esc(D.title) + "</h3>" +
      '<p class="sms-hint">' + esc(D.hint) + "</p>" +
      '<div class="sms-phone"><div class="sms-head">' + esc(D.to) + "</div>" +
      '<div class="sms-thread" role="log" aria-label="Conversación"></div>' +
      '<div class="sms-compose"><div class="sms-field empty" tabindex="0" role="textbox" aria-readonly="true" aria-label="Mensaje">' +
      '<span class="sms-text"></span><i class="sms-caret" aria-hidden="true"></i><span class="sms-ph" aria-hidden="true">' + esc(D.placeholder) + "</span></div>" +
      '<button type="button" class="sms-send" aria-label="Enviar mensaje"><span aria-hidden="true">➤</span></button></div>' +
      '<div class="sms-suggest" role="group" aria-label="' + esc(D.suggestLabel) + '">' +
      D.suggestions.map(function (s) { return '<button type="button" class="sms-chip" data-s="' + esc(s) + '">' + esc(s) + "</button>"; }).join("") + "</div>" +
      '<div class="sms-keys">' + keys + "</div></div>" +
      '<div class="sms-foot"><p class="sms-status" role="status" aria-live="polite"></p><button type="button" class="sms-reset">' + esc(D.reset) + "</button></div>" +
      '<p class="sms-note">' + esc(D.note) + "</p></section>";
  }

  function mount(root) {
    var box = root.querySelector("[data-sms]"); if (!box) return function () {};
    var D = window.FF.sms, $ = function (s) { return box.querySelector(s); };
    var field = $(".sms-field"), textEl = $(".sms-text"), thread = $(".sms-thread"), statusEl = $(".sms-status"), suggest = $(".sms-suggest"), keysEl = $(".sms-keys");
    var keyEls = {}; [].forEach.call(box.querySelectorAll(".sms-key"), function (b) { keyEls[b.getAttribute("data-k")] = b; });
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var text = "", sent = [], timers = [], typing = null, hold = null, alive = true;

    function later(fn, ms) { var id = setTimeout(function () { timers = timers.filter(function (x) { return x !== id; }); if (alive) fn(); }, ms); timers.push(id); return id; }
    function say(m) { statusEl.textContent = m; }
    function render() {
      textEl.textContent = cap(text); field.classList.toggle("empty", !text);
      suggest.classList.toggle("off", !!text); field.setAttribute("aria-valuetext", text ? cap(text) : "vacío");
    }
    function press(k) {
      var b = keyEls[k]; if (!b) return;
      b.classList.add("press"); later(function () { b.classList.remove("press"); }, 130);
    }
    function stopTyping() { if (typing) { clearInterval(typing); typing = null; } }
    function add(ch) { if (text.length >= D.max) return; text += ch; render(); }
    function del() { if (!text) return; text = text.slice(0, -1); render(); if (!text) say(D.cleared); }
    function act(k) { if (k === "Backspace") del(); else add(k); }

    function send() {
      stopTyping();
      var msg = cap(text.trim());
      if (!msg) { say(D.empty); field.classList.remove("nope"); void field.offsetWidth; field.classList.add("nope"); return; }
      var again = sent.indexOf(msg.toLowerCase()) >= 0; sent.push(msg.toLowerCase());
      var b = document.createElement("div"); b.className = "sms-bub sending";
      b.innerHTML = "<span>" + esc(msg) + "</span><small>" + esc(D.sending) + "</small>"; thread.appendChild(b); thread.scrollTop = thread.scrollHeight;
      text = ""; render();
      later(function () { b.classList.remove("sending"); b.querySelector("small").textContent = D.sent; thread.scrollTop = thread.scrollHeight; say(again ? D.again : D.sentSay); }, reduce ? 0 : 650);
    }
    function typeIn(str) {
      stopTyping(); text = ""; render(); var i = 0;
      if (reduce) { text = str; render(); return; }
      typing = setInterval(function () {
        if (!alive || i >= str.length) { stopTyping(); return; }
        var ch = str.charAt(i++).toLowerCase(); add(str.charAt(i - 1)); press(ch);
      }, 55);
    }
    function reset() { stopTyping(); text = ""; sent = []; thread.innerHTML = ""; render(); say(""); }

    /* teclado en pantalla: la tecla actúa al tocarla (sin esperar al clic) y se anima; Retroceso mantenido repite */
    function stopHold() { if (hold) { clearTimeout(hold.t); clearInterval(hold.i); hold = null; } }
    keysEl.addEventListener("pointerdown", function (e) {
      var b = e.target.closest(".sms-key"); if (!b) return; e.preventDefault(); stopTyping();
      var k = b.getAttribute("data-k"); press(k); act(k);
      if (k === "Backspace") { stopHold(); hold = { t: setTimeout(function () { hold.i = setInterval(function () { del(); press("Backspace"); }, 70); }, 450) }; }
    });
    ["pointerup", "pointercancel"].forEach(function (n) { window.addEventListener(n, stopHold); });
    keysEl.addEventListener("click", function (e) {   // activación con el teclado (Enter o espacio sobre una tecla enfocada)
      var b = e.target.closest(".sms-key"); if (!b || e.detail !== 0) return;
      var k = b.getAttribute("data-k"); press(k); act(k);
    });
    $(".sms-send").addEventListener("pointerdown", function (e) { e.preventDefault(); });
    $(".sms-send").addEventListener("click", send);
    suggest.addEventListener("pointerdown", function (e) { if (e.target.closest(".sms-chip")) e.preventDefault(); });
    suggest.addEventListener("click", function (e) { var c = e.target.closest(".sms-chip"); if (c) typeIn(c.getAttribute("data-s")); });
    $(".sms-reset").addEventListener("click", reset);

    /* teclado del computador */
    function onKey(e) {
      if (!alive || !box.isConnected || box.offsetParent === null) return;   // el cuadro está oculto
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      var t = e.target, tag = t && t.tagName, k = e.key;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      if (k === "Enter") { if (tag === "BUTTON") return; e.preventDefault(); send(); return; }
      if (k === " " && tag === "BUTTON") return;
      if (k !== "Backspace" && !(k.length === 1 && PRINTABLE.test(k))) return;
      e.preventDefault(); stopTyping();
      if (tag === "BUTTON" || (t && t.getAttribute && t.getAttribute("role") === "switch")) t.blur();   // evita que un espacio vuelva a activar el botón enfocado
      if (k === "Backspace") { del(); press("Backspace"); return; }
      if (k === " " && !text) return;
      add(k); press(k.toLowerCase());
    }
    document.addEventListener("keydown", onKey);
    render();
    return function unmount() {
      alive = false; stopTyping(); stopHold(); timers.forEach(clearTimeout); timers = [];
      document.removeEventListener("keydown", onKey); ["pointerup", "pointercancel"].forEach(function (n) { window.removeEventListener(n, stopHold); });
    };
  }

  return { html: html, mount: mount };
})();
