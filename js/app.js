/* Free Frequency — estado, rutas y comportamiento. Contenido en data.js, componentes en components.js,
   secuencia visual de cada alternativa en sequence.js + seq-modules.js, menú 3D en hub.js */
(function () {
  "use strict";
  var D = window.FF, C = window.FFC, T = D.territories;
  var ORDER = ["telefono", "radio", "linterna"];   // recorridos, en el orden de las pestañas
  var $ = function (s) { return document.querySelector(s); };
  var views = { home: $("#view-home"), select: $("#view-select"), seq: $("#view-seq"), final: $("#view-final") };
  var tabs = $("#tabs"), sweep = $("#sweep");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Progreso guardado: temas vistos ("telefono:sms") y recorridos cuya secuencia de presentación ya se vio ("intro:telefono") */
  var visited = {};
  try { visited = JSON.parse(localStorage.getItem("ff-visited") || "{}"); } catch (e) {}
  function saveVisited() { try { localStorage.setItem("ff-visited", JSON.stringify(visited)); } catch (e) {} }
  var choice = {};   // último contexto y tema elegidos por recorrido (mientras dura la visita)

  var colors = { telefono: "#2f5d3a", radio: "#a64630", linterna: "#3a3260", home: "#14303a", select: "#14303a", final: "#f6ecd6" };

  /* ---------- Menú principal 3D (js/hub.js): se crea al entrar y se libera al salir ---------- */
  var hub = null;
  function count(id) { return T[id].objects.filter(function (o) { return visited[id + ":" + o.id]; }).length; }
  function hubProgress(id) { return count(id) + " de " + T[id].objects.length + " temas explorados"; }
  function startHub() {
    stopHub();
    hub = window.FFHub.start($("#hub"), D.menu, hubProgress, function (id) { location.hash = "#" + id; }, reduce);
  }
  function stopHub() { if (hub) { hub.stop(); hub = null; } }

  /* ---------- Secuencia de la alternativa (js/sequence.js) ---------- */
  var seqRun = null, seqId = null;
  function startSeq(id) {
    stopSeq();
    var ch = choice[id] || {};
    seqId = id;
    seqRun = window.FFSeq.start($("#seq"), {
      journey: T[id], contexts: D.contexts, seq: D.seq, reduce: reduce, context: ch.context, topic: ch.topic, introSeen: !!visited["intro:" + id],
      onTopic: function (tid) { visited[id + ":" + tid] = true; saveVisited(); renderTabs(); },
      onIntro: function () { if (!visited["intro:" + id]) { visited["intro:" + id] = true; saveVisited(); } }
    });
    $("#seq-h1").textContent = T[id].name + ": " + T[id].kicker;
  }
  function stopSeq() {
    if (seqRun) { if (seqRun.context) choice[seqId] = { context: seqRun.context, topic: seqRun.topic }; seqRun.stop(); seqRun = null; }
  }

  /* ---------- Rutas con transición de "barrido de señal" ---------- */
  function parse() {
    var r = (location.hash || "#inicio").slice(1);
    if (T[r]) return { view: "seq", territory: r };
    if (r === "selector") return { view: "select" };
    if (r === "preparacion") return { view: "final" };
    return { view: "home" };
  }

  /* Navegación direccional: la vista que sale se aleja o se acerca según el sentido (adelante, atrás, lateral) y un barrido de color
     nace en el punto donde el usuario hizo clic. Dura ~0,65 s y nunca bloquea: si el usuario navega de nuevo, la animación se salta y
     se aplica el destino al instante. */
  var order = { home: 0, select: 1, seq: 2, final: 3 };
  var click = { x: 50, y: 55 };
  document.addEventListener("pointerdown", function (e) { click.x = e.clientX / innerWidth * 100; click.y = e.clientY / innerHeight * 100; }, true);
  var cur = null, tr = null;

  function dirOf(from, to) {
    if (from.view === "seq" && to.view === "seq") return ORDER.indexOf(to.territory) > ORDER.indexOf(from.territory) ? "side-r" : "side-l";
    var d = order[to.view] - order[from.view];
    return d > 0 ? "fwd" : d < 0 ? "back" : "none";
  }
  function clearTransitionClasses() {
    Object.keys(views).forEach(function (k) {
      var c = views[k].classList;
      ["leave-fwd", "leave-back", "leave-side-r", "leave-side-l"].forEach(function (n) { c.remove(n); });
    });
  }

  function onRoute(first) {
    var dest = parse(), interrupted = !!tr;
    if (tr) tr.cancel();
    if (cur && dest.view === cur.view && dest.territory === cur.territory) return;
    var dir = (first || reduce || interrupted || !cur) ? "none" : dirOf(cur, dest);
    if (dir === "none") { apply(dest, "none"); return; }

    var out = views[cur.view], key = dest.territory || dest.view, side = dir.indexOf("side") === 0;
    var at = click.x.toFixed(1) + "% " + click.y.toFixed(1) + "%";
    out.classList.add("leave-" + dir);
    sweep.style.background = colors[key];
    sweep.style.display = "block";
    var a2 = null, dead = false;
    var a1 = sweep.animate([{ clipPath: "circle(0% at " + at + ")" }, { clipPath: "circle(150% at " + at + ")" }],
      { duration: side ? 280 : 340, easing: "cubic-bezier(.65,0,.25,1)", fill: "forwards" });
    var cleanup = function () {
      sweep.getAnimations().forEach(function (a) { a.cancel(); });
      sweep.style.display = "none"; clearTransitionClasses(); tr = null;
    };
    tr = { cancel: function () { dead = true; a1.cancel(); if (a2) a2.cancel(); cleanup(); } };
    a1.onfinish = function () {
      if (dead) return;
      apply(dest, dir);
      a2 = sweep.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease-out", fill: "forwards" });
      a2.onfinish = function () { if (!dead) cleanup(); };
    };
  }
  window.addEventListener("hashchange", function () { onRoute(false); });

  function apply(dest, dir) {
    cur = { view: dest.view, territory: dest.territory || null };
    clearTransitionClasses();
    if (dest.view !== "select") stopHub();
    if (dest.view !== "seq") stopSeq();
    document.body.setAttribute("data-view", dest.view);
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== dest.view; });
    if (dest.view === "select") startHub();
    else if (dest.view === "seq") startSeq(dest.territory);
    else if (dest.view === "final") { views.final.innerHTML = C.Final(D.final, T, visited); setupReveal(); }
    renderTabs();
    window.scrollTo(0, 0);
    if (dir && dir !== "none") {
      var v = views[dest.view]; v.classList.add("enter-" + dir);
      setTimeout(function () { v.classList.remove("enter-" + dir); }, 850);
    }
  }

  /* Pestañas con el avance de cada recorrido */
  function renderTabs() {
    if (!cur) return;
    tabs.innerHTML = ORDER.map(function (id) {
      var on = cur.territory === id;
      return '<a href="#' + id + '"' + (on ? ' class="on" aria-current="page"' : "") + '><span class="full">' + T[id].name + '</span><span class="short">' + T[id].short + "</span>" +
        '<small aria-label="' + count(id) + " de " + T[id].objects.length + ' explorados">' + count(id) + "/" + T[id].objects.length + "</small></a>";
    }).join("") + '<a href="#preparacion"' + (cur.view === "final" ? ' class="on" aria-current="page"' : "") + ">Preparación</a>";
  }

  /* Sección final: los bloques aparecen al llegar a ellos con el scroll del usuario (sin forzar desplazamiento) */
  var io = null;
  function setupReveal() {
    if (io) io.disconnect();
    if (reduce || !("IntersectionObserver" in window)) return;
    var els = views.final.querySelectorAll(".final-in > p, .final-in > h1, .cols section, .learned, .final-links");
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.1 });
    Array.prototype.forEach.call(els, function (el, i) { el.classList.add("rv"); el.style.setProperty("--rd", (i % 3) * 90 + "ms"); io.observe(el); });
  }

  /* Portada: parallax de los personajes */
  views.home.addEventListener("pointermove", function (e) {
    if (reduce) return;
    views.home.style.setProperty("--hx", ((e.clientX / innerWidth) - 0.5).toFixed(3));
  });

  onRoute(true);
})();
