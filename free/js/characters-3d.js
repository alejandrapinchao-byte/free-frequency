/* Original GLB geometry/textures + lightweight rigid joints (the supplied files
   have no skeleton or animation clips). No baked lighting or PNG billboards. */
window.FFCharacters = (function () {
  "use strict";
  var files = { rural: "assets/models/rural/chicorural/chico_rural.glb", urbano: "assets/models/urbano/chicacaleña/chica_calena.glb" };
  function dispose(root) {
    var geometries = new Set(), materials = new Set(), textures = new Set();
    root.traverse(function (o) { if (o.geometry) geometries.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { materials.add(m); Object.keys(m).forEach(function (k) { if (m[k] && m[k].isTexture) textures.add(m[k]); }); }); });
    geometries.forEach(function (g) { g.dispose(); }); materials.forEach(function (m) { m.dispose(); }); textures.forEach(function (t) { if (t.image && t.image.close) t.image.close(); t.dispose(); });
  }
  var Y = new THREE.Vector3(0, 1, 0);
  /* mano izquierda (la que sostiene el objeto): dirección del brazo, giro sobre su eje (para orientar la palma) y cuánto se cierran los dedos */
  var HOLD = {
    phone: { d: [.3, -.35, .8], roll: -Math.PI / 2, curl: 1.1 },        // los dedos quedan sobre el borde izquierdo del teléfono
    llamadas: { d: [.55, .6, .3], roll: -Math.PI / 2, curl: 1.1 },      // el teléfono junto a la cabeza
    cobertura: { d: [.45, .8, .35], roll: -Math.PI / 2, curl: 1.1 },
    radio: { d: [-.15, -.5, .8], roll: Math.PI / 2, curl: 1.1 },        // la mano se cierra sobre el asa
    torch: { d: [.3, -.35, .8], roll: 0, curl: 1.1 }                    // los dedos rodean el mango
  };  function load(zone, parent) {
    return new Promise(function (resolve, reject) {
      new THREE.GLTFLoader().load(files[zone], function (gltf) {
        // Both exports contain an unrelated second scene with a default cube.
        var model = gltf.scenes.find(function (s) { return s.name.indexOf("modelo") !== -1; }) || gltf.scene;
        gltf.scenes.forEach(function (s) { if (s !== model) dispose(s); });
        var holder = new THREE.Group(); holder.name = "Character3D_" + zone; holder.add(model);
        model.updateMatrixWorld(true);
        var head; model.traverse(function (o) { if (/Cabeza$/i.test(o.name)) head = o; });
        var bounds = new THREE.Box3().setFromObject(model), scale = 4.4 / (bounds.max.y - bounds.min.y);
        var cx = head ? head.getWorldPosition(new THREE.Vector3()).x : bounds.getCenter(new THREE.Vector3()).x;
        model.scale.multiplyScalar(scale); model.position.add(new THREE.Vector3(-cx * scale, -bounds.min.y * scale, 0));
        holder.updateMatrixWorld(true);
        var ramp = new THREE.DataTexture(new Uint8Array([65, 155, 255]), 3, 1, THREE.RedFormat);
        ramp.magFilter = ramp.minFilter = THREE.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
        ramp.name = "Toon: sombra / medio tono / luz";
        var materials = new Map(), skin, shirt;
        function toon(source) {
          if (materials.has(source)) return materials.get(source);
          var m = new THREE.MeshToonMaterial({ color: source.color ? source.color.clone() : 0xffffff, map: source.map || null, gradientMap: ramp });
          ["alphaMap", "alphaTest", "opacity", "transparent", "side", "depthWrite", "normalMap", "normalMapType", "bumpMap", "bumpScale", "displacementMap", "displacementScale", "displacementBias", "aoMap", "aoMapIntensity", "emissiveMap", "emissiveIntensity"].forEach(function (key) { if (source[key] !== undefined) m[key] = source[key]; });
          if (source.normalScale) m.normalScale.copy(source.normalScale);
          if (source.emissive) m.emissive.copy(source.emissive);
          m.name = source.name; m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent;
          if (/Piel/i.test(m.name)) skin = m;
          if (/Camisa a cuadros|Blusa/i.test(m.name)) shirt = m;
          materials.set(source, m); return m;
        }
        model.traverse(function (o) { if (!o.isMesh) return; o.material = Array.isArray(o.material) ? o.material.map(toon) : toon(o.material); o.castShadow = o.receiveShadow = true; });
        materials.forEach(function (_, source) { source.dispose(); });
        // Reparent whole arm pieces around shoulder pivots, retaining their
        // world transforms, original geometry, UVs and texture references.
        function arm(side) {
          var candidates = [], handPieces = [];
          model.traverse(function (o) { var n = o.name.toLowerCase(); if (/brazo|manga|mano|puño|pulsera/.test(n) && n.indexOf(side) !== -1) candidates.push(o); if (n.indexOf("mano") !== -1 && n.indexOf(side) !== -1) handPieces.push(o); });
          var roots = candidates.filter(function (o) { var p = o.parent; while (p) { if (candidates.indexOf(p) !== -1) return false; p = p.parent; } return true; });
          if (!roots.length) return null;
          var box = new THREE.Box3(); roots.forEach(function (o) { box.union(new THREE.Box3().setFromObject(o)); });
          var positive = side === "izquierd", x = positive ? box.min.x + .04 : box.max.x - .04, y = (box.min.y + box.max.y) / 2;
          /* Articulación del hombro: dentro de la manga abullonada, a ¾ de su radio desde el extremo interior (no en ese extremo, que queda
             metido en el torso junto al cuello). Así, al bajar el brazo, la manga gira sobre sí misma y se queda a la altura del hombro,
             en vez de colgar desde el pecho y dejar el brazo saliendo a la altura de la cintura. */
          var sleeve = new THREE.Box3(); candidates.forEach(function (o) { if (/manga/i.test(o.name)) sleeve.union(new THREE.Box3().setFromObject(o)); });
          if (!sleeve.isEmpty()) { var R = (sleeve.max.y - sleeve.min.y) / 2; x = positive ? sleeve.min.x + .75 * R : sleeve.max.x - .75 * R; y = (sleeve.min.y + sleeve.max.y) / 2; }
          var pivot = new THREE.Group(); pivot.name = "Shoulder_" + side; pivot.position.set(x, y, 0); holder.add(pivot); holder.updateMatrixWorld(true);
          roots.forEach(function (o) { pivot.attach(o); });
          var hb = new THREE.Box3(); handPieces.forEach(function (o) { hb.union(new THREE.Box3().setFromObject(o)); });
          var grip = new THREE.Object3D(); grip.name = "Grip_" + side;
          var point = hb.isEmpty() ? box.getCenter(new THREE.Vector3()) : hb.getCenter(new THREE.Vector3());
          grip.position.copy(pivot.worldToLocal(point)); pivot.add(grip);
          /* cada dedo gira desde su nudillo (el extremo más cercano a la muñeca) para poder cerrar la mano sobre el objeto */
          var fingers = [];
          handPieces.forEach(function (o) {
            var b = new THREE.Box3().setFromObject(o), g = new THREE.Group();
            g.position.copy(pivot.worldToLocal(new THREE.Vector3(positive ? b.min.x : b.max.x, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2)));
            pivot.add(g); g.attach(o); fingers.push({ g: g, thumb: /pulgar/i.test(o.name) });
          });
          return { pivot: pivot, grip: grip, fingers: fingers, axis: new THREE.Vector3(positive ? 1 : -1, 0, 0), sign: positive ? 1 : -1 };
        }
        var left = arm("izquierd"), right = arm("derech"), headRest = head ? head.quaternion.clone() : null;
        parent.add(holder); var q = new THREE.Quaternion(), direction = new THREE.Vector3(), waveDir = new THREE.Vector3(), twist = new THREE.Quaternion(), fw = 0, last = null;
        var api = { root: holder, materials: Array.from(materials.values()), skin: skin, shirt: shirt, ready: true,
          update: function (time, topic, kind, reduce, speaking, opacity, farewell) {
            var t = reduce ? 0 : time, dt = last === null ? 0 : Math.max(0, Math.min(.1, time - last)); last = time;
            fw = reduce ? (farewell ? 1 : 0) : fw + ((farewell ? 1 : 0) - fw) * Math.min(1, dt * 2.6);
            [left, right].forEach(function (a) { if (!a) return;
              var roll = 0, curl = .35;
              if (a === left) {
                var h = HOLD[topic === "llamadas" || topic === "cobertura" ? topic : kind === "radio" ? "radio" : kind === "torch" ? "torch" : "phone"];
                direction.set(h.d[0], h.d[1], h.d[2]); roll = h.roll; curl = h.curl;
              } else {
                direction.set(-.22, -1, .1 + (speaking ? Math.sin(t * 1.3) * .06 : 0));
                if (fw > .001) {   // despedida: el brazo libre sube y se mueve de lado a lado con la mano abierta
                  var k = Math.max(0, Math.min(1, (fw - .3) / .7)); k = k * k * (3 - 2 * k);
                  direction.lerp(waveDir.set(-.75 - Math.sin(t * 6.4) * .25, .75 + Math.cos(t * 6.4) * .12, .55), k); curl = .35 * (1 - k);
                }
              }
              direction.normalize(); a.pivot.quaternion.setFromUnitVectors(a.axis, direction);
              if (roll) a.pivot.quaternion.premultiply(twist.setFromAxisAngle(direction, roll * a.sign));
              a.fingers.forEach(function (f) { f.g.quaternion.setFromAxisAngle(Y, -a.sign * curl * (f.thumb ? .6 : 1)); });
            });            if (head) { q.setFromEuler(new THREE.Euler(Math.sin(t * 1.1) * .015, Math.sin(t * .65) * .035, Math.sin(t * 1.3) * .01)); head.quaternion.copy(headRest).multiply(q); }
            api.materials.forEach(function (m) { var fading = opacity < .999; if (m.transparent !== (m.userData.baseTransparent || fading)) { m.transparent = m.userData.baseTransparent || fading; m.needsUpdate = true; } m.opacity = m.userData.baseOpacity * opacity; });
            holder.updateMatrixWorld(true);
          },
          wrist: function (out) { if (left) left.grip.getWorldPosition(out); else holder.getWorldPosition(out); return out; },
          dispose: function () { holder.removeFromParent(); dispose(holder); }
        };
        api.update(0, "sms", "phone", true, false, 0, false); resolve(api);
      }, undefined, reject);
    });
  }
  return { load: load, HOLD: HOLD };
})();
