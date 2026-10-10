/* Componentes reutilizables: cada función recibe datos y devuelve HTML. Sin estado propio.
   (La secuencia de cada alternativa y su cuadro los genera js/sequence.js.) */
window.FFC = (function () {
  "use strict";

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  /* Sección final */
  function Final(F, territories, visited) {
    var seen = Object.keys(territories).map(function (id) {
      var t = territories[id];
      return '<div><h3>' + esc(t.name) + "</h3><ul class=\"seen\">" + t.objects.map(function (o) {
        return '<li class="' + (visited[id + ":" + o.id] ? "on" : "") + '"><i></i>' + esc(o.name) + "</li>";
      }).join("") + "</ul></div>";
    }).join("");
    return '<div class="final-in"><p class="kicker">Preparación y aprendizajes</p>' +
      '<h1 id="final-title">' + esc(F.title) + "</h1><p class=\"lede big\">" + esc(F.lead) + "</p>" +
      '<div class="cols">' + F.columns.map(function (c, i) {
        return '<section><span class="num">0' + (i + 1) + "</span><h3>" + esc(c.title) + "</h3><ul>" +
          c.items.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></section>";
      }).join("") + "</div>" +
      '<div class="learned"><h3 class="learned-title">Lo que descubriste</h3><div class="learned-grid">' + seen + "</div></div>" +
      '<p class="sources">' + esc(F.sources) + "</p>" +
      '<div class="final-links">' + Object.keys(territories).map(function (id) { return '<a href="#' + id + '">Volver a: ' + esc(territories[id].short) + '</a>'; }).join("") + '<a href="#selector">Menú principal</a><a href="#inicio">Ir al inicio</a></div></div>';
  }

  return { Final: Final };
})();
