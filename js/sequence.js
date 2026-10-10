/* Secuencia visual obligatoria de cada alternativa (Three.js, sin archivos de modelo externos). Sistema reutilizable:
     1) objeto protagonista (sin personaje)  →  2) primer plano de las manos usándolo  →  3) personaje completo usándolo  →  4) cuadro educativo.
   Este archivo es el motor común: cámara, línea de tiempo, entorno (suelo, fondo, personaje), luces, cuadro, controles y progreso.
   Cada alternativa es un "módulo" (js/seq-modules.js: teléfono, radio, linterna) que aporta su modelo 3D, sus manos, su demostración y sus poses.

   Reglas que implementa el motor:
   · el mismo modelo 3D se usa en las tres etapas; las poses se mezclan sin cortes (el objeto nunca desaparece);
   · la secuencia completa se ve la primera vez; si el usuario vuelve a la alternativa se muestra directamente el plano completo con el cuadro,
     y puede repetir el acercamiento (botón del cuadro) o la secuencia entera (botón «Repetir secuencia» o los pasos de la barra de progreso);
   · nunca cambia de pantalla por sí sola: solo el botón «Finalizar recorrido» muestra la despedida;
   · con «reducir movimiento» no hay transiciones: los pasos son planos fijos que el usuario elige.

   Alcance real: el personaje completo es la ilustración de referencia (imagen plana en un plano 3D, con un ligero movimiento del cuerpo entero), no un modelo
   articulado. Las manos y los antebrazos del primer plano son piezas 3D estilizadas hechas con geometría simple; en el plano completo se ve la mano que sostiene
   el objeto a la altura de la muñeca de la ilustración. La luz de la linterna es un foco sencillo sin sombras. */
window.FFSeq = (function () {
  "use strict";
  var clamp01 = function (t) { return Math.max(0, Math.min(1, t)); };
  var smooth = function (t) { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var step = function (t) { return t > 0 ? 1 : 0; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  /* personajes y fondos de cada contexto. wrist = punto (en el plano del personaje) donde la ilustración tiene la mano. */
  var CTX3D = {
    rural: { img: "assets/characters/cauca.png", bg: "assets/scenes/cauca-back.svg", w: 2.85, wrist: [0.39, 1.48, 0.12], skin: 0xe0a578, sleeve: "plaid", bracelet: false, ground: 0x5d7547 },
    urbano: { img: "assets/characters/cali.png", bg: "assets/scenes/cali-back.svg", w: 2.7, wrist: [0.62, 1.19, 0.12], skin: 0xd9996a, sleeve: "floral", bracelet: true, ground: 0x6c6877 }
  };
  var TIMES = { hero: 2.6, toClose: 1.2, toWide: 2.0, cardAfter: 1.6 };
  var modules = {};

  function markup(J, SQ) {
    return '<div class="seq-stage"><canvas class="seq-canvas" aria-hidden="true"></canvas></div>' +
      '<p class="sr-only" role="status" aria-live="polite" id="seq-status"></p>' +
      '<div class="seq-hud"><ol class="seq-steps" aria-label="Progreso de la secuencia">' + SQ.steps.map(function (s, i) {
        return '<li data-i="' + (i + 1) + '"><button type="button" class="seq-step" aria-label="Ir al paso ' + (i + 1) + ": " + esc(s) + '"><i></i><span>' + esc(s) + "</span></button></li>";
      }).join("") + '</ol><button type="button" class="seq-skip">' + esc(SQ.skip) + "</button></div>" +
      '<button type="button" class="seq-hot" role="switch" aria-checked="false" hidden><span class="ring"></span><span class="lbl">Interruptor</span></button>' +
      '<section class="seq-card" aria-label="Información de la alternativa" hidden></section>' +
      '<section class="seq-bye" role="dialog" aria-labelledby="seq-bye-title" hidden><h2 id="seq-bye-title">Gracias por recorrer esta escena</h2><p>' + esc(J.bye) + "</p>" +
      '<div class="seq-actions"><a class="seq-menu" href="#selector">Volver al menú principal</a><button type="button" class="seq-repeat">Repetir secuencia</button></div></section>';
  }

  function start(root, cfg) {
    var J = cfg.journey, FC = cfg.contexts, SQ = cfg.seq, reduce = !!cfg.reduce, topics = J.objects;
    var ctxId = cfg.context || J.defaultContext, topicId = cfg.topic || topics[0].id;
    root.innerHTML = markup(J, SQ);
    var $ = function (s) { return root.querySelector(s); };
    var canvas = $(".seq-canvas"), statusEl = $("#seq-status"), skipBtn = $(".seq-skip"), hot = $(".seq-hot"), card = $(".seq-card"), bye = $(".seq-bye");
    var stepLis = [].slice.call(root.querySelectorAll(".seq-steps li"));
    var alive = true, live = { light: false, airplane: false, kick: -1e9 }, shown = { card: false, stage: 0 };
    var unmountTuner = null;

    function topic() { return topics.filter(function (o) { return o.id === topicId; })[0] || topics[0]; }
    function say(m) { statusEl.textContent = m; }
    function setStep(n) {
      if (n === shown.stage) return; shown.stage = n;
      stepLis.forEach(function (li, i) { li.classList.toggle("done", i + 1 < n); li.classList.toggle("active", i + 1 === n); });
      say("Paso " + n + " de 4: " + SQ.steps[n - 1]);
    }

    /* ---------- cuadro educativo (etapa 4) ---------- */
    function netHTML(o) {
      if (!o.net) return "";
      var row = function (label, v) { return '<div class="' + (v[0] ? "yes" : "no") + '"><dt>' + label + "</dt><dd>" + esc(v[1]) + "</dd></div>"; };
      return '<dl class="seq-net">' + row("Internet", o.net.internet) + row("Red celular", o.net.cellular) + "</dl>";
    }
    function controlsHTML(o) {
      var h = "";
      if (o.toggle) h += '<button type="button" class="seq-toggle" data-act="light" role="switch" aria-checked="' + live.light + '"><span class="knob" aria-hidden="true"></span><span class="lbl">' + (live.light ? "Apagar la linterna" : "Encender la linterna") + "</span></button>";
      if (o.airplane) h += '<button type="button" class="seq-toggle" data-act="air" role="switch" aria-checked="' + live.airplane + '"><span class="knob" aria-hidden="true"></span><span class="lbl">' + (live.airplane ? "Desactivar el modo avión" : "Activar el modo avión") + "</span></button>";
      if (o.tuner) {
        var D = window.FF.tuner;
        h += '<section class="seq-tuner tuner" data-tuner><h3>' + esc(D.title) + "</h3>" +
          '<div class="tn-row"><button type="button" class="tn-power" role="switch" aria-checked="false"><span class="knob" aria-hidden="true"></span><span class="lbl">Encender la radio</span></button>' +
          '<div class="tn-bands" role="group" aria-label="Banda"><button type="button" data-band="AM" aria-pressed="true">AM</button><button type="button" data-band="FM" aria-pressed="false">FM</button></div></div>' +
          '<div class="tn-dial" aria-hidden="true"><span class="tn-scale"></span><i class="tn-needle"></i></div>' +
          '<input class="tn-range" type="range" min="0" max="100" step="1" value="8" aria-label="Dial de sintonía" disabled>' +
          '<div class="tn-meter" aria-hidden="true"><i></i></div>' +
          '<p class="tn-out" role="status" aria-live="polite"></p><p class="tn-note">' + esc(D.note) + "</p></section>";
      }
      return h;
    }
    function renderCard(focusAct) {
      var o = topic(), c = FC[ctxId];
      var pick = '<div class="seq-pick"><div class="seq-ctx" role="group" aria-label="Contexto">' + Object.keys(FC).map(function (k) {
        return '<button type="button" data-act="ctx" data-v="' + k + '" aria-pressed="' + (k === ctxId) + '">' + esc(FC[k].label) + " · " + esc(FC[k].who) + "</button>";
      }).join("") + "</div>";
      if (topics.length > 1) pick += '<div class="seq-topics" role="group" aria-label="Tema">' + topics.map(function (x) {
        return '<button type="button" data-act="topic" data-v="' + x.id + '" aria-pressed="' + (x.id === topicId) + '">' + esc(x.label) + "</button>";
      }).join("") + "</div>";
      pick += "</div>";
      card.innerHTML = pick + '<p class="seq-id">' + esc(J.kicker) + '</p><h2 id="seq-title">' + esc(o.name) + "</h2>" +
        "<h3>Cómo ayuda</h3><p>" + esc(o.what) + "</p>" +
        "<h3>" + esc(c.label) + ": cómo usarlo</h3><p>" + esc(o.how[ctxId]) + "</p>" +
        netHTML(o) + "<h3>Condiciones y límites</h3><p>" + esc(o.limit) + "</p>" +
        '<div class="seq-actions">' + controlsHTML(o) +
        '<button type="button" class="seq-again" data-act="again">Repetir el acercamiento</button>' +
        '<button type="button" class="seq-finish" data-act="finish">Finalizar recorrido <span aria-hidden="true">→</span></button></div>';
      card.setAttribute("aria-labelledby", "seq-title");
      if (unmountTuner) { unmountTuner(); unmountTuner = null; }
      if (o.tuner && window.FFTuner) unmountTuner = window.FFTuner.mount(card);
      if (focusAct) { var f = card.querySelector('[data-act="' + focusAct.act + '"]' + (focusAct.v ? '[data-v="' + focusAct.v + '"]' : "")); if (f) f.focus({ preventScroll: true }); }
    }

    /* ---------- sin WebGL: versión plana (mismo cuadro y mismos controles) ---------- */
    var renderer = null;
    try {
      if (!window.THREE || !window.FFHub || !window.FFHub.models || !modules[J.module]) throw new Error("sin three");
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
      if (!renderer.getContext()) throw new Error("sin webgl");
    } catch (e) { renderer = null; }

    if (!renderer) return startFlat();

    function startFlat() {
      var flat = document.createElement("div"); flat.className = "seq-flat" + (J.module === "torch" ? " dark" : "");
      flat.innerHTML = '<img class="sf-bg" alt=""><img class="sf-char" alt=""><img class="sf-obj" alt="" src="' + J.flatImg + '"><div class="sf-dark"></div>';
      root.querySelector(".seq-stage").appendChild(flat); root.classList.add("seq-flatmode");
      $(".seq-hud").hidden = true;
      function paint() {
        var c = CTX3D[ctxId]; flat.querySelector(".sf-bg").src = c.bg; var im = flat.querySelector(".sf-char"); im.src = c.img; im.alt = FC[ctxId].who + ", " + FC[ctxId].role;
        root.classList.toggle("seq-on", live.light);
      }
      card.hidden = false; renderCard(); paint(); setStep(4);
      if (cfg.onTopic) cfg.onTopic(topicId);
      card.addEventListener("click", function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return; var a = b.getAttribute("data-act");
        if (a === "ctx") { ctxId = b.getAttribute("data-v"); renderCard({ act: "ctx", v: ctxId }); paint(); }
        else if (a === "topic") { topicId = b.getAttribute("data-v"); renderCard({ act: "topic", v: topicId }); if (cfg.onTopic) cfg.onTopic(topicId); }
        else if (a === "light") { live.light = !live.light; renderCard({ act: "light" }); paint(); }
        else if (a === "air") { live.airplane = !live.airplane; renderCard({ act: "air" }); }
        else if (a === "again") { /* sin 3D no hay acercamiento */ }
        else if (a === "finish") { card.hidden = true; bye.hidden = false; var m = bye.querySelector(".seq-menu"); if (m) m.focus(); }
      });
      $(".seq-again").hidden = true;
      bye.querySelector(".seq-repeat").addEventListener("click", function () { bye.hidden = true; card.hidden = false; });
      return { stop: function () { root.innerHTML = ""; root.classList.remove("seq-flatmode", "seq-on"); }, flat: true };
    }

    /* ---------- 3D: escena común ---------- */
    var M = window.FFHub.models, toon = M.toon, basic = M.basic, rbox = M.rbox, canvasTex = M.canvasTex;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
    var ambient = new THREE.AmbientLight(0x8fa0cc, 0.2); scene.add(ambient);
    var heroKey = new THREE.DirectionalLight(0xffe2b0, 1.1); heroKey.position.set(3, 5, 6); scene.add(heroKey);
    var heroFill = new THREE.HemisphereLight(0xcfe0ff, 0x2a2230, 0.75); scene.add(heroFill);
    var V = function (x, y, z) { return new THREE.Vector3(x, y, z); };

    /* materiales compartidos de las manos (el color de piel y la manga cambian con el contexto) */
    var skin = toon(0xd9996a), gold = toon(0xd9a441);
    var plaid = canvasTex(256, 256, function (x, w, h) {
      x.fillStyle = "#ece6d8"; x.fillRect(0, 0, w, h);
      x.fillStyle = "rgba(120,108,100,.5)"; for (var i = 0; i < 4; i++) { x.fillRect(i * 64 + 6, 0, 22, h); x.fillRect(0, i * 64 + 6, w, 22); }
      x.fillStyle = "rgba(70,60,56,.45)"; for (var j = 0; j < 4; j++) { x.fillRect(j * 64 + 14, 0, 6, h); x.fillRect(0, j * 64 + 14, w, 6); }
    });
    plaid.wrapS = plaid.wrapT = THREE.RepeatWrapping; plaid.repeat.set(2, 2);
    var floral = canvasTex(256, 160, function (x, w, h) {
      x.fillStyle = "#2a1f2e"; x.fillRect(0, 0, w, h);
      var cols = ["#e85d8c", "#8a5cc2", "#f08a4b", "#f5b335", "#4b7bd6", "#d7342a", "#3fa76a"];
      for (var i = 0; i < 46; i++) { var cx = (i * 53) % w, cy = (i * 37) % h, r = 7 + (i % 4) * 3, c = cols[i % cols.length];
        for (var k = 0; k < 5; k++) { var a = k * 1.2566; x.fillStyle = c; x.beginPath(); x.arc(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9, r * 0.62, 0, 6.3); x.fill(); }
        x.fillStyle = "#f6e6a8"; x.beginPath(); x.arc(cx, cy, r * 0.4, 0, 6.3); x.fill(); }
    });
    var sleeveMat = toon(0xffffff, { map: floral });
    var armVariants = { plaid: [], floral: [] }, bracelets = [];
    function limb(a, b, r, mat) {
      var dir = b.clone().sub(a), len = dir.length();
      var m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(len - 2 * r, 0.01), 6, 12), mat);
      m.position.copy(a).addScaledVector(dir, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize()); return m;
    }
    /* antebrazo desde la muñeca `w` hacia `dir`: manga de cuadros (zona rural) o antebrazo con brazalete y manga floral (zona urbana) */
    function makeArm(w, dir, parent) {
      var d = dir.clone().normalize(), E = w.clone().addScaledVector(d, 1.6), g = new THREE.Group(); parent.add(g);
      var wristSkin = limb(w, w.clone().addScaledVector(d, 0.5), 0.2, skin); g.add(wristSkin);
      var tube = limb(w.clone().addScaledVector(d, 0.38), E, 0.27, sleeveMat); armVariants.plaid.push(tube); g.add(tube);
      var fore = limb(w.clone().addScaledVector(d, 0.45), E, 0.2, skin); armVariants.floral.push(fore); g.add(fore);
      var br = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 24), gold); br.position.copy(w).addScaledVector(d, 0.42); br.quaternion.setFromUnitVectors(V(0, 0, 1), d); bracelets.push(br); g.add(br);
      var puff = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 14), sleeveMat); puff.scale.set(1, 0.85, 1); puff.position.copy(E).addScaledVector(d, 0.1); armVariants.floral.push(puff); g.add(puff);
      return g;
    }
    /* dedo "elástico": un cilindro entre dos puntos (base y punta) con la punta redondeada; sirve para pulgares que tocan la pantalla o giran una perilla */
    function digit(r) {
      var g = new THREE.Group(), cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, 1, 12), skin), tip = new THREE.Mesh(new THREE.SphereGeometry(r * 1.12, 14, 12), skin), base = new THREE.Mesh(new THREE.SphereGeometry(r * 1.08, 12, 10), skin);
      g.add(cyl); g.add(tip); g.add(base); g.userData = { cyl: cyl, tip: tip, base: base, up: V(0, 1, 0), q: new THREE.Quaternion(), d: V(0, 0, 0) };
      return g;
    }
    function aim(g, a, b) {
      var u = g.userData; u.d.copy(b).sub(a); var len = Math.max(u.d.length(), 0.001);
      u.cyl.position.copy(a).addScaledVector(u.d, 0.5); u.cyl.scale.set(1, len, 1); u.cyl.quaternion.setFromUnitVectors(u.up, u.d.clone().normalize());
      u.tip.position.copy(b); u.base.position.copy(a);
    }

    /* entorno: suelo, fondo, personaje (aparece solo en el plano completo) */
    var env = new THREE.Group(); scene.add(env); var envMats = [];
    function envMat(m) { m.transparent = true; m.opacity = 0; envMats.push(m); return m; }
    var groundMat = envMat(new THREE.MeshLambertMaterial({ color: 0x3a3440 }));
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.z = 6; env.add(ground);
    var bgMat = envMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    var bg = new THREE.Mesh(new THREE.PlaneGeometry(36, 24), bgMat); bg.position.set(0, 9.5, -9); env.add(bg);
    var charGroup = new THREE.Group(); env.add(charGroup);
    var charMat = envMat(new THREE.MeshLambertMaterial({ transparent: true, alphaTest: 0.05, emissive: new THREE.Color(0xffffff) }));
    var charPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 4.4), charMat); charPlane.position.y = 2.2; charGroup.add(charPlane);
    env.visible = false;
    var texCache = {};
    function loadChar(img, done) {
      if (texCache[img]) return done(texCache[img]);
      new THREE.TextureLoader().load(img, function (tx) { texCache[img] = tx; if (alive) done(tx); });
    }
    function loadBg(svg, done) {
      if (texCache[svg]) return done(texCache[svg]);
      var im = new Image(); im.onload = function () {
        if (!alive) return; var c = document.createElement("canvas"); c.width = 1500; c.height = 1000; c.getContext("2d").drawImage(im, 0, 0, 1500, 1000);
        texCache[svg] = new THREE.CanvasTexture(c); done(texCache[svg]);
      }; im.src = svg;
    }

    /* módulo de la alternativa */
    var ctx3d = { THREE: THREE, M: M, scene: scene, env: env, envMat: envMat, skin: skin, gold: gold, sleeveMat: sleeveMat, limb: limb, makeArm: makeArm, digit: digit, aim: aim, V: V, camera: camera,
      toon: toon, basic: basic, rbox: rbox, canvasTex: canvasTex, reduce: reduce, charGroup: charGroup, charMat: charMat, root: root,
      setLight: function (v) { setLight(v); }, setAirplane: function (v) { setAirplane(v); } };
    var mod = modules[J.module](ctx3d);
    var dark = !!mod.dark;
    var rig = new THREE.Group(); rig.add(mod.root); scene.add(rig);
    renderer.setClearColor(dark ? 0x0a0d16 : 0x14303a, 1);
    if (dark) scene.fog = new THREE.Fog(0x0a0d16, 14, 30);
    var LIGHT = dark ? { key: 0.12, fill: 0.22, amb: 0.16, emi: 0.5 } : { key: 0.55, fill: 0.55, amb: 0.5, emi: 0.38 };
    var HEROL = dark ? { key: 1.1, fill: 0.75, amb: 0.2 } : { key: 0.62, fill: 0.42, amb: 0.2 };

    var C3 = CTX3D[ctxId], wristLocal = V(0, 0, 0);
    function applyContext() {
      C3 = CTX3D[ctxId]; wristLocal.set(C3.wrist[0], C3.wrist[1], C3.wrist[2]);
      skin.color.setHex(C3.skin); skin.userData.base.setHex(C3.skin);
      sleeveMat.map = C3.sleeve === "plaid" ? plaid : floral; sleeveMat.needsUpdate = true;
      armVariants.plaid.forEach(function (m) { m.visible = C3.sleeve === "plaid"; }); armVariants.floral.forEach(function (m) { m.visible = C3.sleeve !== "plaid"; });
      bracelets.forEach(function (m) { m.visible = C3.bracelet; });
      charPlane.scale.x = C3.w / 2.7;
      groundMat.color.setHex(dark ? 0x3a3440 : C3.ground);
      bgMat.color.setHex(dark ? 0x4a4a62 : 0xffffff);
      var want = ctxId;
      loadChar(C3.img, function (tx) { if (ctxId !== want) return; charMat.map = tx; charMat.emissiveMap = tx; charMat.needsUpdate = true; });
      loadBg(C3.bg, function (tx) { if (ctxId !== want) return; bgMat.map = tx; bgMat.needsUpdate = true; });
      frameWide(); if (mod.setContext) mod.setContext(ctxId, C3);
    }

    /* ---------- cámaras ---------- */
    var camWide = { p: V(0, 2.7, 11.4), l: V(0, 2.1, 0) }, aspect = 1, portrait = false, camHero = null, camClose = null;
    function pickCams() { var c = mod.cams(portrait, aspect, Math.tan(camera.fov * Math.PI / 360)); camHero = c.hero; camClose = c.close; }
    function frameWide() {
      portrait = aspect < 0.9; var fov = portrait ? 42 : 30; camera.fov = fov; camera.updateProjectionMatrix();
      var tn = Math.tan(fov * Math.PI / 360);
      if (portrait) { var Hv = 4.4 / 0.34, D = Hv / (2 * tn); camWide.l.set(0.5, 2.2 - (0.5 - 0.31) * Hv, 0); camWide.p.set(0.5, camWide.l.y + 1.8, D); }
      else { var Hv2 = 4.4 / 0.74, D2 = Hv2 / (2 * tn), Wv = Hv2 * aspect, shift = aspect > 1.15 ? (0.5 - 0.33) * Wv : 0; camWide.l.set(0.3 + shift, 2.05, 0); camWide.p.set(0.3 + shift, 2.7, D2); }
      pickCams();
    }
    function resize() {
      var w = root.clientWidth || 1, h = root.clientHeight || 1; renderer.setSize(w, h, false); aspect = w / h;
      frameWide(); camera.aspect = aspect; camera.updateProjectionMatrix();
    }
    var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null; if (ro) ro.observe(root); else window.addEventListener("resize", resize);

    /* ---------- línea de tiempo ---------- */
    var E = reduce ? step : smooth, t = 0, tl = null, holdT = false;
    function plan(skipHero) {
      var H = skipHero ? 0 : TIMES.hero, A = mod.duration(topicId), c0 = H + TIMES.toClose, c1 = c0 + A, w1 = c1 + TIMES.toWide;
      tl = { H: H, c0: c0, c1: c1, w1: w1, card: c1 + TIMES.cardAfter, A: A, fromWide: !!skipHero };
    }
    function resetLive() { live.light = false; live.airplane = false; if (mod.reset) mod.reset(); }
    function hideCard() { card.hidden = true; hot.hidden = true; }
    function restart(skipHero) {
      bye.hidden = true; hideCard(); shown.card = false; plan(skipHero); resetLive(); t = 0; skipBtn.hidden = false; setStep(skipHero ? 2 : 1);
      holdT = false;
      if (reduce) { holdT = true; t = skipHero ? tl.c1 - 0.001 : Math.max(0.05, tl.H * 0.8); setStep(skipHero ? 2 : 1); }
    }
    var pendingFocus = null;
    function toEnd() { /* plano completo con el cuadro ya visible (visita repetida o «saltar») */
      plan(true); resetLive(); if (mod.finish) mod.finish(); t = tl.card + 0.01; bye.hidden = true; holdT = reduce; skipBtn.hidden = true;
    }
    function goStep(n) {
      if (n === 1) restart(false);
      else if (n === 2) restart(true);
      else if (n === 3) { t = tl.c1 + (reduce ? 0.25 : 0.0); bye.hidden = true; hideCard(); shown.card = false; skipBtn.hidden = false; holdT = reduce; if (mod.finish) mod.finish(); setStep(3); }
      else { toEnd(); }
    }
    function showCard() {
      if (shown.card || !bye.hidden) return; shown.card = true;
      card.hidden = false; renderCard(pendingFocus); pendingFocus = null; skipBtn.hidden = true; setStep(4);
      hot.hidden = !mod.hotWorld;
      if (cfg.onTopic) cfg.onTopic(topicId);
      if (cfg.onIntro) cfg.onIntro();
    }

    /* ---------- controles ---------- */
    function setLight(v) { live.light = !!v; live.kick = performance.now(); root.classList.toggle("seq-on", live.light); syncHot(); if (shown.card) { var b = card.querySelector('[data-act="light"]'); if (b) { b.setAttribute("aria-checked", live.light); b.querySelector(".lbl").textContent = live.light ? "Apagar la linterna" : "Encender la linterna"; } } }
    function setAirplane(v) {
      live.airplane = !!v; live.kick = performance.now();
      var b = card.querySelector('[data-act="air"]'); if (b) { b.setAttribute("aria-checked", live.airplane); b.querySelector(".lbl").textContent = live.airplane ? "Desactivar el modo avión" : "Activar el modo avión"; }
    }
    function syncHot() { hot.setAttribute("aria-checked", live.light ? "true" : "false"); hot.setAttribute("aria-label", "Interruptor de la linterna: " + (live.light ? "encendida. Púlsalo para apagar" : "apagada. Púlsalo para encender")); }
    hot.addEventListener("click", function () { setLight(!live.light); });
    skipBtn.addEventListener("click", function () { toEnd(); });
    stepLis.forEach(function (li) { li.querySelector("button").addEventListener("click", function () { goStep(+li.getAttribute("data-i")); }); });
    bye.querySelector(".seq-repeat").addEventListener("click", function () { restart(false); });
    function swapContext(id) { ctxId = id; pendingFocus = { act: "ctx", v: id }; applyContext(); restart(true); say(FC[id].label + ", con " + FC[id].who); }
    function swapTopic(id) { topicId = id; pendingFocus = { act: "topic", v: id }; if (mod.setTopic) mod.setTopic(id); restart(true); say("Tema: " + topic().name); }
    card.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return; var a = b.getAttribute("data-act"), v = b.getAttribute("data-v");
      if (a === "ctx" && v !== ctxId) { swapContext(v); }
      else if (a === "topic" && v !== topicId) { swapTopic(v); }
      else if (a === "light") setLight(!live.light);
      else if (a === "air") setAirplane(!live.airplane);
      else if (a === "again") { pendingFocus = { act: "again" }; restart(true); }
      else if (a === "finish") { hideCard(); bye.hidden = false; say("Despedida"); var m = bye.querySelector(".seq-menu"); if (m) m.focus(); }
    });

    /* ---------- bucle ---------- */
    var info = { t: 0, tl: null, stage: "hero", kIn: 0, kOut: 0, ta: 0, A: 0, fromWide: false, rise: 0, leftK: 1, armsK: 1, envA: 0, sweep: 0, speakK: 0, wrist: V(0, 0, 0), live: live, aspect: 1, portrait: false, reduce: reduce, dt: 0, ctx: ctxId, topic: topicId, camera: camera };
    var raf = 0, last = performance.now(), api = { hold: false }, pv = V(0, 0, 0), v1 = V(0, 0, 0), u3 = V(0, 0, 0), pw = { p: V(0, 0, 0), q: new THREE.Quaternion(), s: 1 }, ph = { p: V(0, 0, 0), q: new THREE.Quaternion(), s: 1 }, pc = { p: V(0, 0, 0), q: new THREE.Quaternion(), s: 1 };
    function copyPose(d, s) { d.p.copy(s.p); d.q.copy(s.q); d.s = s.s; }
    function place(a, b, k) {
      var q = rig.quaternion.copy(a.q).slerp(b.q, k), s = lerp(a.s, b.s, k); rig.scale.setScalar(s);
      pv.lerpVectors(a.p, b.p, k).sub(u3.copy(mod.pivot).multiplyScalar(s).applyQuaternion(q)); rig.position.copy(pv);
    }
    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min((now - last) / 1000, 0.033); last = now; if (!holdT && !api.hold) t += dt;
      var H = tl.H, c0 = tl.c0, c1 = tl.c1, w1 = tl.w1;
      var kIn = H >= 0 ? E((t - H) / TIMES.toClose) : 1, kOut = E((t - c1) / TIMES.toWide);
      var stage = t < H ? "hero" : t < c1 ? "close" : "wide";
      if (stage === "hero") setStep(1); else if (stage === "close") setStep(2); else if (t < tl.card) setStep(3);
      var sweep = t > w1 && !reduce ? (t - w1) * 0.55 : 0;
      var envA = t < c1 ? (tl.fromWide ? 1 - E(kIn * 1.3) : 0) : E((t - (c1 + 0.2)) / 1.6);
      var speakK = t >= tl.card ? 1 : 0;

      charGroup.updateMatrixWorld(true); wristLocal.set(C3.wrist[0], C3.wrist[1], C3.wrist[2]); info.wrist.copy(charGroup.localToWorld(u3.copy(wristLocal)));
      info.t = t; info.tl = tl; info.stage = stage; info.kIn = kIn; info.kOut = kOut; info.ta = clamp01((t - c0) / tl.A) * tl.A; info.A = tl.A; info.fromWide = tl.fromWide;
      info.rise = tl.fromWide ? 1 : E((t - H) / 1.0); info.envA = envA; info.sweep = sweep; info.speakK = speakK; info.aspect = aspect; info.portrait = portrait; info.dt = dt; info.ctx = ctxId; info.topic = topicId;
      info.leftK = t < c1 ? (tl.fromWide ? E(kIn * 1.4) : 1) : 1 - E((t - c1) / 0.9);
      info.armsK = t < c1 + (w1 - c1) * 0.45 ? 1 : 0;

      /* objeto: hero → primer plano → plano completo (siempre el mismo modelo, mezclado sin cortes) */
      copyPose(pw, mod.pose.wide(info));
      if (t < H) { copyPose(ph, mod.pose.hero(t, info)); place(ph, ph, 0); }
      else if (t < c1) { copyPose(pc, mod.pose.close(info)); if (tl.fromWide) place(pw, pc, kIn); else { copyPose(ph, mod.pose.hero(H, info)); place(ph, pc, kIn); } }
      else { copyPose(pc, mod.pose.close(info)); place(pc, pw, kOut); }

      /* cámara */
      if (t < H) { camera.position.copy(camHero.p); v1.copy(camHero.l); }
      else if (t < c1) {
        var cf = tl.fromWide ? camWide : camHero;
        camera.position.lerpVectors(cf.p, camClose.p, kIn); v1.lerpVectors(cf.l, camClose.l, kIn);
        if (!tl.fromWide && !reduce) camera.position.x += Math.sin(t * 0.6) * 0.04 * kIn;
      } else { camera.position.lerpVectors(camClose.p, camWide.p, kOut); v1.lerpVectors(camClose.l, camWide.l, kOut); }
      camera.lookAt(v1);

      /* entorno y luces (la misma luz de la etapa 1 pasa de forma continua al plano completo) */
      env.visible = envA > 0.01; envMats.forEach(function (m) { m.opacity = envA; });
      heroKey.intensity = lerp(HEROL.key, LIGHT.key, envA); heroFill.intensity = lerp(HEROL.fill, LIGHT.fill, envA); ambient.intensity = lerp(HEROL.amb, LIGHT.amb, envA);
      charMat.emissiveIntensity = LIGHT.emi;
      var breathe = reduce ? 0 : Math.sin(t * 1.4) * 0.006;
      charGroup.scale.set(1 - breathe * 0.3, 1 + breathe, 1);
      /* gestos del personaje al explicar: balanceo del cuerpo entero (la ilustración es plana: no hay brazos articulados) */
      charGroup.position.y = reduce ? 0 : Math.abs(Math.sin(t * 2.6)) * 0.03 * speakK;
      charGroup.rotation.set(0, 0, reduce ? 0 : Math.sin(t * 1.3) * 0.022 * speakK);

      if (mod.frame) mod.frame(info);
      if (mod.charAdjust) mod.charAdjust(charGroup, info);

      if (t >= tl.card) showCard();
      if (!hot.hidden && mod.hotWorld) {
        mod.hotWorld(u3); u3.project(camera); var w = root.clientWidth, h = root.clientHeight, s = 64;
        hot.style.left = ((u3.x + 1) / 2 * w - s / 2) + "px"; hot.style.top = ((1 - u3.y) / 2 * h - s / 2) + "px"; hot.style.width = s + "px"; hot.style.height = s + "px";
      }
      renderer.render(scene, camera);
    }

    /* arranque: primera vez → secuencia completa; visita repetida → plano completo con el cuadro (se puede repetir) */
    applyContext(); resize();
    if (mod.setTopic) mod.setTopic(topicId);
    syncHot();
    if (cfg.introSeen) { toEnd(); setStep(4); }
    else restart(false);
    raf = requestAnimationFrame(frame);

    api.seek = function (s) { t = s; };
    api.tick = function (n) { /* avanza n fotogramas a mano (pruebas con la pestaña en segundo plano) */
      for (var i = 0; i < (n || 1); i++) { cancelAnimationFrame(raf); last = performance.now() - 33; frame(performance.now()); }
    };
    api.step = goStep;
    Object.defineProperties(api, {
      time: { get: function () { return t; } }, plan: { get: function () { return tl; } }, live: { get: function () { return live; } },
      context: { get: function () { return ctxId; } }, topic: { get: function () { return topicId; } }, stage: { get: function () { return info.stage; } }
    });
    api.stop = function () {
      alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); else window.removeEventListener("resize", resize);
      if (unmountTuner) unmountTuner();
      scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (mt) { if (mt.map) mt.map.dispose(); mt.dispose(); }); } });
      Object.keys(texCache).forEach(function (k) { texCache[k].dispose(); });
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {}
      root.innerHTML = ""; root.classList.remove("seq-on", "seq-flatmode");
    };
    api.setContext = swapContext; api.setTopic = swapTopic; api.setLight = setLight; api.setAirplane = setAirplane;
    start.current = api;
    return api;
  }

  return { start: start, modules: modules, get current() { return start.current; } };
})();
