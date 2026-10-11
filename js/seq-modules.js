/* Módulos de la secuencia (js/sequence.js): cada alternativa aporta su modelo 3D, sus manos, su demostración en el primer plano y sus poses.
   Contrato de un módulo (se crea con el contexto 3D `X` que le da el motor):
     root      grupo con el objeto y las manos (el motor lo mueve por las poses y lo usa en las tres etapas)
     pivot     punto de `root` que las poses colocan en el espacio
     dark      true si la escena es oscura (linterna)
     cams(portrait, aspect, tan) → { hero, close }   cámaras de las etapas 1 y 2
     duration(topicId) → segundos que dura la acción del primer plano
     pose.hero(t,info) / pose.close(info) / pose.wide(info) → { p, q, s }
     frame(info)   anima manos, pantalla, luz… según info.stage ("hero" | "close" | "wide"), info.ta (tiempo de la acción) y info.live (estado de los controles)
     reset() / finish() / setTopic(id) / setContext(id) / charAdjust(grupoPersonaje, info) / hotWorld(out)   opcionales */
(function () {
  "use strict";
  var clamp01 = function (t) { return Math.max(0, Math.min(1, t)); };
  var smooth = function (t) { t = clamp01(t); return t * t * (3 - 2 * t); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  function newPose(X) { return { p: X.V(0, 0, 0), q: new X.THREE.Quaternion(), s: 1 }; }

  /* ======================================================= LINTERNA ======================================================= */
  FFSeq.modules.torch = function (X) {
    var THREE = X.THREE, V = X.V, M = X.M, skin = X.skin, rbox = X.rbox;
    var glows = [], beamHolder = {};
    var torch = M.buildTorch(glows, beamHolder), tu = torch.userData, beam = beamHolder.beam, lensMat = glows[0];
    var root = new THREE.Group(); root.add(torch);
    var spot = new THREE.SpotLight(0xfff0c8, 0, 16, 0.5, 0.7, 1.1); X.scene.add(spot); X.scene.add(spot.target);

    /* mano: palma por detrás del mango, dedos que lo rodean y antebrazo (manga según el contexto) */
    function buildHand(opt) {
      var g = new THREE.Group(), arms = new THREE.Group(); g.add(arms);
      /* palma ilustrada por detrás del mango (sin pulgar: el pulgar se dibuja aparte) y los dedos plegados al frente */
      var palm = X.handSprite({ skip: ["thumb"] }, 0.0019); palm.position.set(opt.sg * -0.2, opt.y - 0.32, -0.5); palm.rotation.z = opt.sg * -0.72; palm.scale.x *= -opt.sg; g.add(palm);
      opt.fingers.forEach(function (fy, i) {
        var f = X.bandSprite(0.78, 0.15); f.position.set(opt.sg * 0.0, fy, 0.38); f.rotation.z = opt.sg * 0.06 * (i - 1); g.add(f);
      });
      X.makeArm(V(0, opt.y - 0.07, -0.62), opt.arm, arms);
      return { group: g, arms: arms };
    }
    var rightHand = buildHand({ sg: 1, y: 1.12, fingers: [0.92, 1.06, 1.2, 1.34], arm: V(-0.42, -0.5, -0.76) });
    var leftHand = buildHand({ sg: -1, y: 0.55, fingers: [0.38, 0.52, 0.66], arm: V(0.42, -0.5, -0.76) });
    var hands = new THREE.Group(); hands.add(rightHand.group); hands.add(leftHand.group); torch.add(hands);
    /* pulgar: gira alrededor de su base y baja sobre el interruptor */
    var thumbBase = V(-0.14, 1.5, -0.28), swTop = V(0.42, 1.76, 0.02), u0 = swTop.clone().sub(thumbBase).normalize();
    var thumbPivot = new THREE.Group(); thumbPivot.position.copy(thumbBase); rightHand.group.add(thumbPivot);
    var thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.46, 6, 12), skin); thumb.position.y = 0.33; thumbPivot.add(thumb);
    var qBase = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), u0), pressAxis = u0.clone().cross(V(0, 1, 0)).normalize();
    var probe = u0.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(pressAxis, 0.2)).y < u0.y ? 1 : -1;
    var qTmp = new THREE.Quaternion();

    /* obstáculos cercanos que la luz deja ver */
    function obstacle(geo, color, x, y, z, ry) { var m = new THREE.Mesh(geo, X.envMat(new THREE.MeshLambertMaterial({ color: color }))); m.position.set(x, y, z); m.rotation.y = ry || 0; X.env.add(m); return m; }
    obstacle(new THREE.BoxGeometry(0.8, 0.6, 0.7), 0xc8a46a, 1.8, 0.3, 1.9, 0.5);
    obstacle(new THREE.BoxGeometry(1.5, 0.12, 0.3), 0x9a6a46, 2.4, 0.06, 1.1, -0.35);
    obstacle(new THREE.DodecahedronGeometry(0.28), 0xb9b2a6, 1.0, 0.2, 2.5, 0.3);
    obstacle(new THREE.DodecahedronGeometry(0.2), 0xa39d92, 1.3, 0.14, 2.9, 1.1);
    obstacle(new THREE.CylinderGeometry(0.25, 0.28, 0.7, 14), 0xd7653a, 3.0, 0.35, 2.3, 0);
    obstacle(new THREE.BoxGeometry(0.5, 0.35, 0.5), 0x8d8f9c, -1.9, 0.18, 1.2, 0.2);

    /* poses */
    var SCALE_WIDE = 0.3, W_IN_TORCH = V(0, 1.05, -0.62), poseA = newPose(X), poseB = newPose(X), poseC = newPose(X);
    var CLOSE_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, -0.5, -0.55)), beamDir = V(0, 0, 0), up = V(0, 1, 0), zz = V(0, 0, 0), xx = V(0, 0, 0), mx = new THREE.Matrix4();
    var pressed = false, level = 0, press = 0, q1 = new THREE.Quaternion(), u3 = V(0, 0, 0), v1 = V(0, 0, 0);

    var mod = {
      root: root, pivot: V(0, 0, 0), dark: true,
      cams: function (portrait, aspect, tn) {
        var d = Math.max(3.4 / (2 * tn * aspect), 4.6 / (2 * tn));   // distancia para que quepan la linterna y las dos manos en vertical
        return { hero: { p: V(0, 1.6, 6.6), l: V(0, 1.55, 0) },
          close: portrait ? { p: V(0.9, 1.9, d), l: V(0.5, 1.5, 0) } : { p: V(0.45, 2.0, 3.7), l: V(-0.2, 1.55, 0) } };
      },
      duration: function () { return 3.2; },
      pose: {
        hero: function (time) { poseA.p.set(0, 0.05, 0); poseA.q.setFromEuler(new THREE.Euler(0, time * 0.7, 0)); poseA.s = 1.12; return poseA; },
        close: function () { poseB.p.set(-0.1, 0.25, 0); poseB.q.copy(CLOSE_Q); poseB.s = 1; return poseB; },
        wide: function (info) {
          var sw = info.sweep, wr = info.wrist;
          beamDir.set(0.35 + 0.42 * Math.sin(sw), -0.62 + 0.05 * Math.sin(sw * 2), 0.85).normalize();
          zz.copy(up).addScaledVector(beamDir, -up.dot(beamDir)).normalize().negate(); xx.copy(beamDir).cross(zz).normalize();
          poseC.q.setFromRotationMatrix(mx.makeBasis(xx, beamDir.clone(), zz)); poseC.s = SCALE_WIDE;
          poseC.p.copy(wr).sub(u3.copy(W_IN_TORCH).multiplyScalar(SCALE_WIDE).applyQuaternion(poseC.q));   // el agarre del modelo queda en la muñeca de la ilustración
          return poseC;
        }
      },
      reset: function () { pressed = false; level = 0; },
      finish: function () { pressed = true; X.setLight(true); level = X.reduce ? 1 : level; },
      hotWorld: function (out) { return tu.sw.getWorldPosition(out); },
      charAdjust: function (cg, info) {
        X.charMat.emissiveIntensity = 0.5 - 0.25 * level;
        cg.rotation.x = X.reduce ? 0 : -0.04 * level; cg.rotation.y = X.reduce ? 0 : 0.16 * Math.sin(info.sweep) * level;
      },
      frame: function (info) {
        var live = info.live, st = info.stage;
        hands.visible = st !== "hero"; hands.position.y = -2.6 * (1 - info.rise);
        rightHand.arms.visible = leftHand.arms.visible = info.armsK > 0;
        leftHand.group.scale.setScalar(Math.max(0.001, info.leftK)); leftHand.group.visible = info.leftK > 0.01;
        /* acción: el pulgar baja sobre el interruptor y la linterna se enciende */
        if (!pressed && ((st === "close" && info.ta >= 1.2) || st === "wide")) { pressed = true; X.setLight(true); }
        var pk = performance.now() - live.kick, target = pk < 140 ? 1 : 0;
        press += (target - press) * Math.min(1, info.dt * 18);
        tu.sw.position.x = 0.42 - 0.05 * press;
        qTmp.setFromAxisAngle(pressAxis, probe * 0.22 * press); thumbPivot.quaternion.copy(qTmp).multiply(qBase);
        level += ((live.light ? 1 : 0) - level) * (X.reduce ? 1 : Math.min(1, info.dt * 10));
        lensMat.color.copy(lensMat.userData.base).multiplyScalar(0.28 + level * 0.9);
        beam.visible = level > 0.02; beam.material.opacity = level * 0.6;
        var wideK = st === "wide" ? info.kOut : (info.fromWide ? 1 - info.kIn : 0);
        beam.scale.set(lerp(1, 3.4, wideK), lerp(1, 4.4, wideK), lerp(1, 3.4, wideK));
        tu.lens.getWorldPosition(u3); spot.position.copy(u3);
        torch.getWorldQuaternion(q1); v1.set(0, 1, 0).applyQuaternion(q1); spot.target.position.copy(u3).addScaledVector(v1, 6);
        spot.intensity = level * (info.envA > 0.3 ? 2.6 : 0.9);
      }
    };
    return mod;
  };

  /* ======================================================= TELÉFONO ======================================================= */
  FFSeq.modules.phone = function (X) {
    var THREE = X.THREE, V = X.V, M = X.M, skin = X.skin, rbox = X.rbox;
    var glows = [], phone = M.buildPhone(glows), ud = phone.userData;
    ud.dock.visible = false; ud.body.rotation.x = 0; phone.position.set(0, -1.36, 0);
    var root = new THREE.Group(); root.add(phone);

    /* pantalla dibujada en un canvas (se redibuja solo cuando cambia el estado) */
    var cv = document.createElement("canvas"); cv.width = 256; cv.height = 548; var g = cv.getContext("2d");
    var tex = new THREE.CanvasTexture(cv); ud.screen.material.map = tex; ud.screen.material.needsUpdate = true;
    var topicId = "sms", lastKey = "";
    function rr(x, y, w, h, r, c) { g.fillStyle = c; g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill(); }
    function txt(s, x, y, size, color, align, weight) { g.fillStyle = color; g.font = (weight || "bold") + " " + size + "px Arial, sans-serif"; g.textAlign = align || "left"; g.fillText(s, x, y); }
    function bars(n, x0, y0, color) { for (var i = 0; i < 4; i++) { var bh = 6 + i * 5; g.fillStyle = i < n ? color : "rgba(120,120,130,.35)"; g.fillRect(x0 + i * 9, y0 - bh, 6, bh); } }
    function plane(cx, cy, s, color) { g.save(); g.translate(cx, cy); g.scale(s, s); g.fillStyle = color; g.beginPath(); g.moveTo(0, -12); g.lineTo(3, -12); g.lineTo(11, 0); g.lineTo(11, 3); g.lineTo(2, 1); g.lineTo(2, 8); g.lineTo(6, 11); g.lineTo(6, 13); g.lineTo(0, 11); g.lineTo(-6, 13); g.lineTo(-6, 11); g.lineTo(-2, 8); g.lineTo(-2, 1); g.lineTo(-11, 3); g.lineTo(-11, 0); g.lineTo(-3, -12); g.closePath(); g.fill(); g.restore(); }
    function circ(x, y, r, c) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
    function statusBar(nBars, air) { g.fillStyle = "#1e2236"; g.fillRect(0, 0, 256, 40); txt("9:41", 18, 26, 15, "#f6efe2", "left"); if (air) plane(226, 21, 0.7, "#ffb627"); else bars(nBars, 206, 30, "#ffb627"); }

    /* teclado: posiciones (px del canvas) */
    var ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"], ROWY = [336, 382, 428], ROWX0 = [20, 32, 56];
    function keyPos(ch) {
      if (ch === " ") return [128, 474];
      for (var r = 0; r < 3; r++) { var i = ROWS[r].indexOf(ch); if (i >= 0) return [ROWX0[r] + i * 24, ROWY[r]]; }
      return [128, 400];
    }
    var MSG = "estoy bien", SMS_TAPS = [];
    MSG.split("").forEach(function (ch, i) { var p = keyPos(ch); SMS_TAPS.push({ t: 0.5 + i * 0.24, x: p[0], y: p[1], ch: ch }); });
    SMS_TAPS.push({ t: 3.3, x: 218, y: 274, send: true });
    var SCRIPTS = {
      sms: { A: 5.0, taps: SMS_TAPS },
      llamadas: { A: 5.4, taps: [{ t: 1.0, x: 128, y: 126 }, { t: 4.5, x: 128, y: 472 }] },
      cobertura: { A: 5.0, taps: [{ t: 0.9, x: 128, y: 432 }] },
      avion: { A: 5.0, taps: [{ t: 1.0, x: 196, y: 204 }, { t: 3.3, x: 196, y: 204 }] }
    };
    function tapped(id, ta, i) { var tp = SCRIPTS[id].taps[i]; return ta >= tp.t + 0.04; }
    function pressedAt(id, ta) { var T = SCRIPTS[id].taps, k = -1; for (var i = 0; i < T.length; i++) if (Math.abs(ta - T[i].t) < 0.11) k = i; return k; }

    function drawScreen(id, ta, live) {
      var A = SCRIPTS[id].A, pk = pressedAt(id, ta), i;
      g.clearRect(0, 0, 256, 548); g.fillStyle = "#f6efe2"; g.fillRect(0, 0, 256, 548);
      if (id === "sms") {
        statusBar(1, false); rr(0, 40, 256, 52, 0, "#e9dfc8"); txt("Mensaje nuevo", 16, 64, 17, "#23251f", "left"); txt("Para: Familia", 16, 84, 13, "#6a6556", "left", "normal");
        var typed = 0; for (i = 0; i < MSG.length; i++) if (tapped("sms", ta, i)) typed = i + 1;
        var sent = ta >= SMS_TAPS[SMS_TAPS.length - 1].t + 0.15;
        if (sent) { rr(60, 120, 180, 56, 18, "#f08a4b"); txt(MSG[0].toUpperCase() + MSG.slice(1) + ".", 150, 156, 22, "#fff", "center"); txt("Enviado · red celular, sin internet", 238, 196, 12, "#6a6556", "right", "normal"); }
        else { rr(14, 110, 228, 84, 14, "#fff"); txt((MSG.slice(0, typed)) + (Math.floor(ta * 3) % 2 ? "|" : ""), 26, 160, 24, "#23251f", "left"); circ(218, 274, 20, pk >= 0 && SMS_TAPS[pk].send ? "#d7652a" : "#f08a4b"); txt("➤", 218, 281, 18, "#fff", "center"); }
        rr(0, 304, 256, 244, 0, "#d3d8e2");
        ROWS.forEach(function (row, r) { row.split("").forEach(function (ch, k) { var on = pk >= 0 && SMS_TAPS[pk].ch === ch; rr(ROWX0[r] + k * 24 - 10, ROWY[r] - 17, 21, 34, 5, on ? "#ffb627" : "#fff"); txt(ch, ROWX0[r] + k * 24, ROWY[r] + 6, 16, "#23251f", "center", "normal"); }); });
        rr(56, 454, 144, 40, 8, pk >= 0 && SMS_TAPS[pk].ch === " " ? "#ffb627" : "#fff");
      } else if (id === "llamadas") {
        var st2 = ta < 1.3 ? 0 : ta < 2.9 ? 1 : ta < 4.6 ? 2 : 3;
        statusBar(2, false);
        if (st2 === 0) {
          rr(0, 40, 256, 52, 0, "#e9dfc8"); txt("Llamadas", 16, 74, 20, "#23251f", "left");
          ["Familia", "Vecinos", "Puesto de salud"].forEach(function (nm, k) { var y = 108 + k * 66, on = k === 0 && pk === 0; rr(10, y, 236, 56, 14, on ? "#ffb627" : "#fff"); circ(40, y + 28, 18, ["#2f5d3a", "#2c7a9a", "#a64630"][k]); txt(nm, 70, y + 35, 18, "#23251f", "left"); });
          txt("Una llamada breve deja la línea libre", 128, 360, 13, "#6a6556", "center", "normal");
        } else {
          g.fillStyle = "#1f2238"; g.fillRect(0, 40, 256, 508); circ(128, 190, 52, "#2f5d3a"); txt("F", 128, 208, 52, "#f6efe2", "center");
          txt("Familia", 128, 290, 26, "#f6efe2", "center");
          var line = st2 === 1 ? "Llamando…" : st2 === 2 ? "En llamada · 00:0" + Math.min(9, Math.floor(ta - 2.9) + 1) : "Llamada finalizada";
          txt(line, 128, 326, 17, "#cfd8e8", "center", "normal");
          txt(st2 === 3 ? "Línea libre para otras personas" : "Lo esencial, en pocas palabras", 128, 358, 13, "#ffb627", "center", "normal");
          if (st2 < 3) { circ(128, 472, 30, pk === 1 ? "#a8261e" : "#d7342a"); txt("✕", 128, 483, 26, "#fff", "center"); }
        }
      } else if (id === "cobertura") {
        var phase = ta < 0.9 ? 0 : ta < 3.4 ? 1 : 2, nb = 0;
        if (phase === 1) nb = 1 + Math.floor(ta * 4) % 4; if (phase === 2) nb = (Math.sin(ta * 7) > 0.2 ? 2 : 1);
        statusBar(phase === 0 ? 0 : phase === 2 ? 1 : 0, false);
        rr(0, 40, 256, 52, 0, "#e9dfc8"); txt("Red celular", 16, 74, 20, "#23251f", "left");
        for (i = 0; i < 4; i++) { var bh = 28 + i * 24, lit = phase === 0 ? false : phase === 1 ? i === (Math.floor(ta * 5) % 4) : i < nb; g.fillStyle = lit ? (phase === 2 ? "#2f5d3a" : "#f08a4b") : "rgba(120,120,130,.3)"; g.fillRect(58 + i * 36, 250 - bh, 26, bh); }
        txt(phase === 0 ? "Sin servicio" : phase === 1 ? "Buscando red…" : "Señal débil", 128, 306, 24, "#23251f", "center");
        txt(phase === 2 ? "Puede ir y venir; sin garantía" : phase === 1 ? "Espera unos segundos" : "Toca para buscar red", 128, 336, 14, "#6a6556", "center", "normal");
        rr(48, 400, 160, 62, 20, pk === 0 ? "#d7652a" : "#f08a4b"); txt("Buscar red", 128, 439, 21, "#fff", "center");
      } else {
        var air = ta >= A - 0.001 ? live.airplane : (ta >= 1.15 && ta < 3.45), searching = ta >= A - 0.001 ? false : ta >= 3.45;
        statusBar(air ? 0 : (searching ? 1 : 2), air);
        rr(0, 40, 256, 52, 0, "#e9dfc8"); txt("Ajustes rápidos", 16, 74, 20, "#23251f", "left");
        rr(10, 108, 112, 62, 14, "#fff"); txt("Wi-Fi", 22, 146, 17, "#23251f", "left"); rr(134, 108, 112, 62, 14, "#fff"); txt("Datos", 146, 146, 17, "#23251f", "left");
        rr(10, 180, 236, 50, 14, pk >= 0 ? "#fff1d6" : "#fff"); plane(36, 205, 0.95, "#f08a4b"); txt("Modo avión", 62, 212, 18, "#23251f", "left");
        rr(168, 190, 56, 30, 15, air ? "#f08a4b" : "#c9c2ad"); circ(air ? 209 : 183, 205, 11, "#fff");
        txt(air ? "Modo avión activado" : searching ? "Buscando red…" : "Red celular disponible", 128, 300, 20, "#23251f", "center");
        txt(air ? "Sin llamadas ni SMS mientras esté activo" : searching ? "El teléfono vuelve a buscar una red" : "Activa el modo avión para ahorrar batería", 128, 328, 13, "#6a6556", "center", "normal");
        if (air) plane(128, 420, 3.4, "rgba(240,138,75,.9)");
      }
      tex.needsUpdate = true;
    }

    /* manos: dos palmas a los lados, cuatro puntas de dedos asomando por el borde opuesto y dos pulgares que se estiran hasta la tecla */
    function scr(px, py) { return V((px / 256 - 0.5) * 1.04, (0.5 - py / 548) * 2.22, 0); }
    function buildHand(sg) {
      var h = new THREE.Group(), arms = new THREE.Group(); h.add(arms);
      /* mano ilustrada (sin pulgar) que sujeta el costado del teléfono: la palma queda fuera y los dedos tocan el borde de la pantalla */
      var hand = X.handSprite({ skip: ["thumb"] }, 0.0023); hand.position.set(sg * 0.88, -1.72, 0.16); hand.rotation.z = sg * 0.22; hand.scale.x *= -sg; h.add(hand);
      X.makeArm(V(sg * 0.9, -1.1, -0.34), V(sg * 0.3, -1, 0.9), arms);
      var th = X.digit(0.095); h.add(th);
      return { group: h, arms: arms, thumb: th, base: V(sg * 0.7, -0.82, 0.02), rest: V(sg * 0.36, -0.96, 0.42), sg: sg, tip: V(0, 0, 0), dy: 0 };
    }
    var HL = buildHand(-1), HR = buildHand(1);
    var hands = new THREE.Group(); hands.add(HL.group); hands.add(HR.group); root.add(hands);
    function driveThumb(H, id, ta, active) {
      var T = SCRIPTS[id].taps, k = -1, i, want = V(H.rest.x, H.rest.y, H.rest.z), z = H.rest.z, a = 0, dyT = 0;
      if (active) for (i = 0; i < T.length; i++) {
        var left = T[i].x < 128;
        var mine = id === "sms" ? (T[i].ch === " " ? H.sg > 0 : T[i].send ? H.sg > 0 : (left ? H.sg < 0 : H.sg > 0)) : (H.sg > 0);
        if (mine && ta < T[i].t + 0.16) { k = i; break; }
      }
      if (k >= 0) {
        var d0 = T[k].t - ta; a = smooth(1 - clamp01((d0 - 0.08) / 0.5));
        var p = scr(T[k].x, T[k].y); want.set(lerp(H.rest.x, p.x, a), lerp(H.rest.y, p.y, a), 0);
        z = lerp(H.rest.z, 0.36, a); if (Math.abs(d0) < 0.09) z = 0.215;
        dyT = clamp01((p.y + 0.5) * 0.55) * 0.9 * a;
      }
      H.dy += (dyT - H.dy) * 0.3; H.group.position.y = H.dy;
      H.tip.set(want.x, want.y - H.dy, z);   // la mano sube con el dedo: la punta se calcula relativa a ella
      X.aim(H.thumb, H.base, H.tip);
    }

    var poseH = newPose(X), poseC = newPose(X), poseW = newPose(X), euler = new THREE.Euler();
    var mod = {
      root: root, pivot: V(0, 0, 0), dark: false,
      cams: function (portrait, aspect, tn) {
        var d = Math.max(3.2 / (2 * tn * aspect), 4.6 / (2 * tn));
        return { hero: { p: V(0, 1.6, 6.6), l: V(0, 1.5, 0) }, close: portrait ? { p: V(0, 1.7, d), l: V(0, 0.8, 0) } : { p: V(0, 1.75, 5.2), l: V(0, 0.85, 0) } };
      },
      duration: function (id) { return SCRIPTS[id || topicId].A; },
      setTopic: function (id) { topicId = id; lastKey = ""; },
      reset: function () { lastKey = ""; },
      pose: {
        hero: function (t) { poseH.p.set(0, 1.55, 0); poseH.q.setFromEuler(euler.set(0.05, Math.sin(t * 0.8) * 0.55, 0)); poseH.s = 1.15; return poseH; },
        close: function (info) { poseC.p.set(0, 1.35, 0); poseC.q.setFromEuler(euler.set(-0.18 + Math.sin(info.t * 0.9) * 0.01, 0, 0)); poseC.s = 1; return poseC; },
        wide: function (info) {
          var raise = topicId === "cobertura" ? (0.5 + 0.5 * Math.sin(info.t * 1.1)) * 0.3 * info.speakK : 0;
          poseW.p.set(info.wrist.x + 0.02, info.wrist.y + 0.1 + raise + Math.sin(info.t * 2.2) * 0.02 * info.speakK, info.wrist.z + 0.2);
          poseW.q.setFromEuler(euler.set(-0.1 - raise * 0.6, 0.22, Math.sin(info.t * 1.3) * 0.03 * info.speakK)); poseW.s = 0.3; return poseW;
        }
      },
      frame: function (info) {
        var st = info.stage, ta = st === "close" ? info.ta : (st === "wide" ? info.A : 0);
        hands.visible = st !== "hero"; hands.position.y = -2.6 * (1 - info.rise);
        HL.arms.visible = HR.arms.visible = info.armsK > 0;
        HL.group.scale.setScalar(Math.max(0.001, info.leftK)); HL.group.visible = info.leftK > 0.01;
        driveThumb(HL, topicId, ta, st === "close"); driveThumb(HR, topicId, ta, st === "close");
        var key = topicId + "|" + Math.round(ta * 12) + "|" + (ta >= info.A - 0.001 ? info.live.airplane : 0);
        if (key !== lastKey) { lastKey = key; drawScreen(topicId, ta, info.live); }
      }
    };
    return mod;
  };

  /* ======================================================== RADIO ======================================================== */
  FFSeq.modules.radio = function (X) {
    var THREE = X.THREE, V = X.V, M = X.M, skin = X.skin, rbox = X.rbox;
    var glows = [], radio = M.buildRadio(glows), ud = radio.userData, dialMat = ud.dial.material;
    radio.position.set(0, -1.1, 0);
    var root = new THREE.Group(); root.add(radio);
    var K1 = V(0.42, -0.54, 0.64), K2 = V(1.0, -0.54, 0.64);   // centro de las perillas (cara frontal), con el origen en el centro del cuerpo de la radio
    var PIN = 0.31;

    /* mano derecha: pulgar e índice en pinza sobre la perilla (se mueve con ella) · mano izquierda: sostiene el costado izquierdo de la radio */
    var rh = new THREE.Group(), rarms = new THREE.Group(); rh.add(rarms);
    /* mano ilustrada con los dedos recogidos (el pulgar y el índice son los dedos que giran la perilla) */
    var rpalm = X.handSprite({ skip: ["thumb", "index"], curl: true }, 0.0028); rpalm.position.set(1.66, -0.7, 0.9); rpalm.rotation.z = 0.7; rh.add(rpalm);
    X.makeArm(V(1.55, -0.4, 1.0), V(0.5, -0.4, 1.0), rarms);
    var dThumb = X.digit(0.1), dIndex = X.digit(0.09); rh.add(dThumb); rh.add(dIndex);
    var tbase = V(1.3, -0.82, 0.9), ibase = V(1.35, -0.02, 0.95), tp = V(0, 0, 0), ip = V(0, 0, 0);
    var lh = new THREE.Group(), larms = new THREE.Group(); lh.add(larms);
    var lpalm = X.handSprite({ skip: ["thumb"] }, 0.0024); lpalm.position.set(-2.2, -0.1, 0.7); lpalm.rotation.z = -Math.PI / 2; lpalm.scale.x *= -1; lh.add(lpalm);
    X.makeArm(V(-1.9, -0.5, 0.05), V(-0.7, -0.6, 0.9), larms);
    var hands = new THREE.Group(); hands.add(rh); hands.add(lh); root.add(hands);
    /* en el plano completo: el puño que agarra el asa (la radio cuelga de la mano) */
    var grip = new THREE.Group(); root.add(grip);
    var fist = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), skin); fist.scale.set(1.3, 0.75, 0.95); fist.position.set(0, 1.62, 0); grip.add(fist);
    var gthumb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), skin); gthumb.position.set(0.1, 1.55, 0.36); grip.add(gthumb);

    var st = window.FFTuner ? window.FFTuner.state : { on: false, pos: 8, band: "AM" }, demoSet = { on: false, pos: -1 }, scriptDone = false;
    var th1 = 0, th2 = 0, kpos = V(0, 0, 0), poseH = newPose(X), poseC = newPose(X), poseW = newPose(X), euler = new THREE.Euler();
    function pinch(a) {
      tp.set(K2.x + Math.cos(a) * PIN, K2.y + Math.sin(a) * PIN, 0.76); ip.set(K2.x + Math.cos(a + Math.PI) * PIN, K2.y + Math.sin(a + Math.PI) * PIN, 0.76);
      X.aim(dThumb, tbase, tp); X.aim(dIndex, ibase, ip);
    }

    var mod = {
      root: root, pivot: V(0, 0, 0), dark: false,
      cams: function (portrait, aspect, tn) {
        var d = Math.max(5.8 / (2 * tn * aspect), 3.8 / (2 * tn));
        return { hero: { p: V(0, 1.6, 6.6), l: V(0, 1.45, 0) }, close: portrait ? { p: V(0.3, 2.0, d), l: V(0.3, 0.9, 0) } : { p: V(0.5, 1.9, 5.9), l: V(0.35, 1.0, 0) } };
      },
      duration: function () { return 5.0; },
      reset: function () { demoSet.on = false; demoSet.pos = -1; scriptDone = false; if (window.FFTuner) window.FFTuner.reset(); },
      finish: function () { scriptDone = true; if (window.FFTuner) window.FFTuner.set({ on: true, band: window.FF.tuner.demo.band, pos: window.FF.tuner.demo.pos }); },
      pose: {
        hero: function (t) { poseH.p.set(0, 1.5, 0); poseH.q.setFromEuler(euler.set(0.12, Math.sin(t * 0.8) * 0.5, 0)); poseH.s = 0.9; return poseH; },
        close: function (info) { poseC.p.set(0.25, 1.3, 0); poseC.q.setFromEuler(euler.set(-0.12, -0.12 + Math.sin(info.t * 0.8) * 0.01, 0)); poseC.s = 1; return poseC; },
        wide: function (info) {
          var s = 0.2; poseW.s = s;
          poseW.p.set(info.wrist.x, info.wrist.y - 1.53 * s - 0.04 + Math.sin(info.t * 2.2) * 0.02 * info.speakK, info.wrist.z + 0.2);
          poseW.q.setFromEuler(euler.set(0, 0.2, Math.sin(info.t * 1.3) * 0.05 * info.speakK)); return poseW;
        }
      },
      frame: function (info) {
        var s = info.stage, ta = info.ta, F = window.FFTuner, D = window.FF.tuner, pos, on, k;
        hands.visible = s !== "hero"; hands.position.y = -2.6 * (1 - info.rise);
        rarms.visible = larms.visible = info.armsK > 0;
        rh.scale.setScalar(Math.max(0.001, info.leftK)); lh.scale.setScalar(Math.max(0.001, info.leftK)); hands.visible = hands.visible && info.leftK > 0.01;
        var gk = s === "wide" ? info.kOut : (info.fromWide ? 1 - info.kIn : 0); grip.scale.setScalar(Math.max(0.001, gk)); grip.visible = gk > 0.01;

        /* demostración: la mano derecha enciende la radio (perilla izquierda) y luego gira la de sintonía mientras la aguja recorre el dial */
        var knob = 2, th1v = th1;
        if (s === "close" && F) {
          if (ta < 0.8) { k = smooth(ta / 0.8); kpos.lerpVectors(K2, K1, k); knob = 1; }
          else if (ta < 1.5) { kpos.copy(K1); knob = 1; th1v = lerp(0, 0.9, smooth((ta - 0.8) / 0.7)); }
          else if (ta < 2.3) { k = smooth((ta - 1.5) / 0.8); kpos.lerpVectors(K1, K2, k); th1v = 0.9; knob = 1; }
          else { kpos.copy(K2); th1v = 0.9; }
          if (ta >= 1.2 && !demoSet.on) { demoSet.on = true; F.set({ on: true, band: "AM", pos: D.start.pos }); }
          if (ta >= 2.3) {
            pos = ta < 3.6 ? lerp(8, 70, smooth((ta - 2.3) / 1.3)) : ta < 4.6 ? lerp(70, D.demo.pos, smooth((ta - 3.6) / 1.0)) : D.demo.pos;
            pos = Math.round(pos); if (pos !== demoSet.pos) { demoSet.pos = pos; F.set({ pos: pos }); }
          }
          th1 = th1v;
          if (ta >= info.A - 0.001) scriptDone = true;
        } else {
          if (s === "wide" && !scriptDone && F) { scriptDone = true; F.set({ on: true, band: D.demo.band, pos: D.demo.pos }); }
          kpos.copy(K2); th1 = st.on ? 0.9 : 0;
        }
        th2 = (st.pos - 8) / 100 * 4.2;
        ud.knobs[0].rotation.z = th1; ud.knobs[1].rotation.z = th2;
        ud.needle.position.x = 0.15 + st.pos * 0.011;
        var lit = st.on ? 1 : 0; dialMat.color.copy(dialMat.userData.base).multiplyScalar(0.4 + 0.6 * lit);
        rh.position.set(kpos.x - K2.x, kpos.y - K2.y, 0);
        pinch(-0.6 + (knob === 1 ? th1 : th2));
      }
    };
    return mod;
  };
})();
