/* Free Frequency — contenido. Todo texto se edita aquí.
   El menú principal ofrece EXACTAMENTE tres objetos 3D: teléfono celular, radio portátil AM/FM y linterna. Cada uno abre un recorrido.
   Todos los recorridos usan la misma secuencia visual (js/sequence.js): 1) objeto protagonista → 2) primer plano de las manos usándolo →
   3) personaje completo usándolo → 4) explicación educativa. Cada recorrido existe en dos contextos (zona rural con Mateo, zona urbana con Valeria)
   y tiene uno o varios "temas" (`objects`): cada tema es una acción con su propia demostración en el primer plano y su propio cuadro.
   Tema: what (cómo ayuda), net (qué conexión necesita: [depende?, texto]; se omite si no aplica), limit (condiciones y límites), how.rural / how.urbano (cómo usarlo en cada contexto).

   FUENTES REVISADAS (octubre de 2026) — conviene volver a consultarlas antes de publicar:
   · Línea única de emergencias 123; llamadas gratuitas a líneas de emergencia aun sin saldo; recomendación de usar mensajes de texto o mensajería
     cuando la voz está congestionada: MinTIC (mintic.gov.co) y CRC, Comisión de Regulación de Comunicaciones (comunicado citado por Mobile Time).
   · Kit con radio, linterna y pilas: UNGRD, Simulacro Nacional de Respuesta a Emergencias (portal.gestiondelriesgo.gov.co/simulacro).
   · Restablecimiento de contacto entre familiares: Cruz Roja Colombiana (cruzrojacolombiana.org).
   NO se citan alcances de radios, frecuencias ni garantías de conectividad. Los textos son generales y prudentes. */
window.FF = {
  /* contextos: personaje y escena de fondo */
  contexts: {
    rural: { label: "Zona rural", who: "Mateo", role: "Joven caucano", scene: "cauca" },
    urbano: { label: "Zona urbana", who: "Valeria", role: "Joven caleña", scene: "cali" }
  },
  seq: { steps: ["Objeto", "Manos", "Personaje", "Información"], skip: "Saltar introducción" },

  /* Menú principal: los tres objetos 3D (el modelo se construye en js/hub.js) */
  menu: [
    { id: "telefono", model: "phone", name: "Teléfono celular", img: "assets/objects/celular.svg",
      text: "Permite enviar SMS, realizar llamadas breves e intentar reconectarse a una red disponible. Estas opciones requieren cobertura celular para funcionar y pueden fallar durante una emergencia." },
    { id: "radio", model: "radio", name: "Radio AM/FM", img: "assets/objects/radio.svg",
      text: "Permite escuchar noticias e indicaciones de las autoridades cuando las redes celulares o internet fallan. Una radio portátil con pilas puede funcionar durante un corte de electricidad, siempre que exista una emisora disponible." },
    { id: "linterna", model: "torch", name: "Linterna", img: "assets/objects/linterna.svg",
      text: "Permite iluminar espacios oscuros, facilitar el desplazamiento y hacer más visibles los obstáculos cuando falla la electricidad. Puede ayudar a orientarse sin depender de la señal celular." }
  ],

  territories: {
    telefono: {
      id: "telefono", module: "phone", defaultContext: "rural",
      name: "Teléfono celular", short: "Teléfono", flatImg: "assets/objects/celular.svg",
      kicker: "Teléfono celular · Señal débil o inexistente",
      bye: "Gracias por recorrer el teléfono. Ninguna de estas opciones garantiza la comunicación: dependen de que haya red disponible.",
      objects: [
        {
          id: "sms", name: "Mensajes SMS", label: "SMS", sms: true,
          what: "Un SMS usa la red celular, no internet, y puede salir cuando una llamada no entra. Los mensajes de WhatsApp y similares sí necesitan datos o internet.",
          net: { internet: [0, "No la necesita para SMS"], cellular: [1, "Sí: necesita cobertura celular"] },
          limit: "Que el mensaje salga no garantiza que llegue ni que lo lean; con la red congestionada puede demorar.",
          how: {
            rural: "Ve a un punto abierto y seguro donde a veces entre señal, escribe un mensaje corto con dónde estás y envíalo una sola vez.",
            urbano: "Tras un sismo la red puede saturarse: escribe un mensaje corto, como «Estoy bien», envíalo una vez y espera sin reenviarlo."
          }
        },
        {
          id: "llamadas", name: "Llamadas breves", label: "Llamadas",
          what: "Una llamada corta, con lo esencial, deja la línea libre para otras personas. En una emergencia real, el 123 es la línea única y su llamada es gratuita, incluso sin saldo.",
          net: { internet: [0, "No la necesita"], cellular: [1, "Sí: necesita cobertura celular"] },
          limit: "Si la red está congestionada, la llamada puede no completarse; llamar al 123 no garantiza que entre.",
          how: {
            rural: "Si entra la señal, di lo esencial en pocas palabras: la cobertura puede cortarse en cualquier momento.",
            urbano: "Con muchas personas llamando a la vez puede no entrar: espera unos minutos antes de insistir y deja la línea libre."
          }
        },
        {
          id: "cobertura", name: "Búsqueda de cobertura", label: "Cobertura",
          what: "Con señal débil, buscar un punto abierto y seguro puede ayudar a que entre cobertura, aunque sea por momentos. Muévete solo si es seguro hacerlo.",
          net: { internet: [0, "No la necesita"], cellular: [1, "Sí: depende de que haya red disponible"] },
          limit: "Si la red está caída, no habrá señal en ningún punto. No te arriesgues en zonas inestables para buscarla.",
          how: {
            rural: "Busca un punto despejado y seguro, como una loma abierta; la señal puede entrar solo por momentos.",
            urbano: "Acércate a un espacio abierto y seguro, lejos de estructuras dañadas; en la ciudad la red también puede estar saturada."
          }
        },
        {
          id: "avion", name: "Modo avión", label: "Modo avión", airplane: true,
          what: "Corta la conexión celular y ahorra batería. Al desactivarlo, el teléfono vuelve a buscar una red, lo que a veces ayuda a reconectar.",
          net: { internet: [0, "Mientras está activo, no hay conexión"], cellular: [0, "Mientras está activo, no hay conexión"] },
          limit: "Con el modo avión activo no entran ni salen llamadas ni SMS. Reconectar no está garantizado: depende de que haya red.",
          how: {
            rural: "Actívalo un momento para ahorrar batería cuando no puedas conectarte y desactívalo para volver a buscar red.",
            urbano: "Actívalo y desactívalo para intentar reconectar; mientras esté activo no entran llamadas ni mensajes."
          }
        }
      ]
    },

    radio: {
      id: "radio", module: "radio", defaultContext: "urbano",
      name: "Radio portátil AM/FM", short: "Radio", flatImg: "assets/objects/radio.svg",
      kicker: "Radio AM/FM · Redes congestionadas",
      bye: "Gracias por recorrer la radio. Recuerda que solo recibe y que depende de que haya emisoras al aire en tu zona.",
      objects: [
        {
          id: "radio", name: "Radio AM/FM", label: "Radio", tuner: true,
          what: "Recibe emisoras AM y FM sin internet ni red celular. Tras un sismo puede dar acceso a noticias e indicaciones de las autoridades. Solo recibe: no transmite.",
          net: { internet: [0, "No la necesita"], cellular: [0, "No la necesita"] },
          limit: "Necesita pilas y que haya una emisora al aire en tu zona. No sirve para pedir ayuda ni para responder, y no hay garantía de recepción.",
          how: {
            rural: "Gira el dial despacio, en AM y en FM: la recepción cambia con el lugar, así que prueba en un punto despejado y seguro.",
            urbano: "Busca una emisora de noticias y escucha con calma las indicaciones de las autoridades; si se oye mal, cambia de lugar con seguridad."
          }
        }
      ]
    },

    linterna: {
      id: "linterna", module: "torch", defaultContext: "urbano",
      name: "Linterna", short: "Linterna", flatImg: "assets/objects/linterna.svg",
      kicker: "Emergencias · Falta de iluminación",
      bye: "Una linterna a la mano ayuda a ver y a orientarte cuando falla la electricidad. Recuerda que no sustituye las indicaciones de las autoridades.",
      objects: [
        {
          id: "escena", name: "Linterna", label: "Linterna", toggle: true,
          what: "Permite iluminar espacios oscuros, reconocer obstáculos y orientarse cuando falla la electricidad. También puede ayudar a señalar la propia ubicación mediante la luz.",
          limit: "Necesita pilas o batería cargada. Conviene conservar la energía y utilizarla con cuidado cerca de zonas inestables. La linterna no sustituye las indicaciones de las autoridades ni garantiza que otras personas puedan verla.",
          how: {
            rural: "Apunta el haz al suelo para ver el camino y los obstáculos; ahorra la pila y úsala con cuidado en laderas o terrenos inestables.",
            urbano: "Apunta el haz al suelo para ver escombros y obstáculos; úsala con cuidado cerca de estructuras dañadas."
          }
        }
      ]
    }
  },

  /* Práctica de escritura del SMS (js/smspad.js): teclado en pantalla y teclado del computador. Simulación: no envía nada. */
  sms: {
    title: "Escribe tu mensaje",
    hint: "Toca las teclas o, en computador, escribe con tu teclado. Enter envía y Retroceso borra.",
    to: "Para: Familia",
    placeholder: "Escribe un mensaje corto…",
    suggestLabel: "Sugerencias",
    suggestions: ["Estoy bien", "Estamos a salvo", "Estoy en un lugar seguro"],
    max: 60,
    empty: "Escribe primero un mensaje corto.",
    typed: "Mensaje en el campo: ",
    deleted: "Borrado.",
    cleared: "Campo vacío.",
    sending: "Enviando…",
    sent: "Enviado · red celular, sin internet",
    sentSay: "Mensaje enviado en la simulación. Que salga no garantiza que llegue.",
    again: "Ya enviaste este mensaje: espera sin reenviarlo, así no saturas la red.",
    note: "Simulación: no se envía nada real. En la vida real, el SMS necesita cobertura celular y no hay garantía de que llegue.",
    reset: "Reiniciar práctica"
  },

  /* Sintonizador ilustrativo de la radio (no usa frecuencias ni emisoras reales). pos = posición en el dial (0–100). */
  tuner: {
    title: "Sintoniza la radio",
    note: "Simulación ilustrativa: no usa frecuencias ni emisoras reales. En la vida real depende de que haya emisoras al aire en tu zona.",
    off: "La radio está apagada. Enciéndela (necesita pilas) y mueve el dial.",
    noise: "Solo ruido: aquí no hay emisora. Sigue moviendo el dial.",
    near: "Se oye algo entre el ruido… acércate un poco más.",
    start: { on: false, band: "AM", pos: 8 },
    demo: { band: "AM", pos: 24 },   // posición en que termina la demostración del primer plano
    bands: {
      AM: [
        { pos: 24, kind: "info", name: "Emisora de ejemplo", msg: "Boletín de ejemplo: «Mantenga la calma y siga las indicaciones de las autoridades.»" },
        { pos: 71, kind: "music", name: "Otra emisora de ejemplo", msg: "Programa musical de ejemplo: no trae información de la emergencia. Sigue buscando." }
      ],
      FM: [
        { pos: 38, kind: "info", name: "Emisora de ejemplo", msg: "Boletín de ejemplo: «Escuche con calma y espere nuevas indicaciones oficiales.»" },
        { pos: 82, kind: "music", name: "Otra emisora de ejemplo", msg: "Programa musical de ejemplo: no trae información de la emergencia. Sigue buscando." }
      ]
    }
  },

  /* Sección final */
  final: {
    title: "Prepárate antes de que falle la señal",
    lead: "Ninguna de estas tres alternativas lo resuelve todo. Funcionan mejor combinadas y probadas con tiempo.",
    columns: [
      {
        title: "Antes",
        items: [
          "Ten a mano una radio portátil y una linterna con pilas.",
          "Averigua en qué puntos de tu zona suele haber señal y qué emisoras se oyen."
        ]
      },
      {
        title: "Durante",
        items: [
          "Prefiere SMS y llamadas breves; el 123 es solo para emergencias reales.",
          "Escucha la radio para recibir información oficial y alumbra el suelo para moverte con cuidado."
        ]
      },
      {
        title: "Después",
        items: [
          "Avisa que estás bien con un mensaje corto.",
          "Para buscar a un familiar, acude a la Cruz Roja Colombiana y su servicio de restablecimiento de contacto."
        ]
      }
    ],
    sources: "Contenido revisado con información de MinTIC, la CRC, la UNGRD y la Cruz Roja Colombiana. Consulta siempre sus canales oficiales; esta experiencia es educativa y no reemplaza las indicaciones de las autoridades."
  }
};
