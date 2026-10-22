/* Toon shader de los objetos (teléfono, radio y linterna): port a Three.js de toon_shader_substance_painter_12_1_5.glsl (Substance Painter).
   Mismas reglas que el original, calculadas con la normal N, la dirección a la cámara V y la dirección a la luz L:
     · contorno: si N·V < mix(unlit_outline_thickness 0.4, lit_outline_thickness 0.1, N·L) el píxel queda negro (en Substance no se pinta);
     · color base (textura y color del material) en tres escalones según N·L: > 0.75 pleno · > 0.5 × 0.5 · > 0.1 × 0.1 · si no, negro.
   Se aplica sobre MeshToonMaterial (onBeforeCompile) para conservar sus propiedades (color, map, emissive, opacity…). El «use_curvature» del original no se usa:
   no hay mapa de curvatura. La luz del original está fija en (10, 10, 10); aquí es una dirección fija respecto a la cámara (arriba a la derecha, de frente), así los escalones no cambian al girar la escena. */
window.FFToon = (function () {
  "use strict";
  var CODE = [
    "{",
    "  const float unlit_outline_thickness = 0.4;",
    "  const float lit_outline_thickness = 0.1;",
    "  vec3 ffN = normalize( normal );",
    "  vec3 ffV = normalize( vViewPosition );",
    "  vec3 ffL = normalize( vec3( 0.3, 0.42, 0.86 ) );",
    "  float ffNdV = dot( ffN, ffV );",
    "  float ffNdL = max( 0.0, dot( ffN, ffL ) );",
    "  vec3 ffColor = diffuseColor.rgb;",
    "  if ( ffNdL > 0.75 ) { ffColor = ffColor; }",
    "  else if ( ffNdL > 0.5 ) { ffColor = ffColor * 0.5; }",
    "  else if ( ffNdL > 0.1 ) { ffColor = ffColor * 0.1; }",
    "  else { ffColor = vec3( 0.0 ); }",
    "  if ( ffNdV < mix( unlit_outline_thickness, lit_outline_thickness, ffNdL ) ) ffColor = vec3( 0.0 );",
    "  outgoingLight = ffColor + totalEmissiveRadiance;",
    "}",
    "#include <output_fragment>"
  ].join("\n");

  function apply(m) {
    if (!m || m.userData.ffToon) return m;
    m.userData.ffToon = true;
    m.onBeforeCompile = function (shader) { shader.fragmentShader = shader.fragmentShader.replace("#include <output_fragment>", CODE); };
    m.customProgramCacheKey = function () { return "ff-toon-substance"; };
    m.needsUpdate = true;
    return m;
  }
  return { apply: apply };
})();

