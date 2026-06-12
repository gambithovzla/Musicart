// Dossiers de demostración escritos y verificados a mano.
// Sirven para desarrollar y demostrar la app sin claves de IA.
// Los dossiers reales se generan con `npm run dossier` (pipeline con grounding).

import type { Fact } from "../src/lib/types";

export type SeedFixture = {
  artist: { name: string };
  album: {
    title: string;
    year: number;
    releaseDate: string;
    label: string;
    durationMin: number;
    difficulty: number; // 1-5
    impact: number; // 1-100 (impacto cultural honesto)
  };
  facts: Fact[];
  dossier: {
    intro: string;
    artistStory: string;
    whyItMatters: string;
    questions: string[];
  };
  tracks: { position: number; title: string; note?: string }[];
};

export const FIXTURES: SeedFixture[] = [
  {
    artist: { name: "John Mayer" },
    album: {
      title: "Continuum",
      year: 2006,
      releaseDate: "2006-09-12",
      label: "Aware / Columbia",
      durationMin: 49,
      difficulty: 2,
      impact: 70,
    },
    facts: [
      { fact: "Lanzado el 12 de septiembre de 2006 por Aware/Columbia.", source: "wikipedia:es" },
      { fact: "Producido por John Mayer y Steve Jordan.", source: "wikipedia:en" },
      { fact: "Grabado con Pino Palladino (bajo) y Steve Jordan (batería), la banda del John Mayer Trio.", source: "wikipedia:en" },
      { fact: "Ganó el Grammy a Mejor Álbum Pop Vocal en 2007.", source: "wikipedia:en" },
      { fact: "'Waiting on the World to Change' ganó el Grammy a Mejor Interpretación Pop Vocal Masculina en 2007.", source: "wikipedia:en" },
      { fact: "'Gravity' apareció primero en el disco en vivo Try! del John Mayer Trio (2005).", source: "wikipedia:en" },
      { fact: "'Bold as Love' es una versión de Jimi Hendrix, del álbum Axis: Bold as Love (1967).", source: "wikipedia:en" },
    ],
    dossier: {
      intro:
        "En 2006, John Mayer tenía 28 años y un problema poco común: lo había conseguido todo demasiado pronto. Dos discos multiplatino, giras agotadas y una etiqueta que empezaba a pesarle — la del chico guapo que escribía canciones bonitas para la radio. Continuum es su respuesta: se encerró con Pino Palladino y Steve Jordan, la sección rítmica de su trío de blues, y produjo él mismo un disco que no busca el single fácil sino otra cosa: capturar el momento exacto en que la juventud empieza a terminarse. Aquí se habla del paso del tiempo, de errores que ya no se pueden deshacer, de relaciones que se apagan en cámara lenta. Suena cálido, contenido, casi clásico — soul y blues tocados con una precisión quirúrgica. Escúchalo entero, de principio a fin: está secuenciado como un arco, de la apatía generacional de la primera canción a la soledad asumida de la última.",
      artistStory:
        "Mayer llegó a la fama en 2001 como cantautor acústico de éxito inmediato, y para 2005 estaba haciendo algo inesperado para una estrella pop: tocar blues en clubes pequeños con el John Mayer Trio, junto a dos leyendas de sesión — Pino Palladino y Steve Jordan. Esa escuela cambió su manera de tocar y de escribir. Cuando volvió al estudio, ya no quería demostrar que podía hacer hits: quería hacer un disco que sobreviviera. Continuum ganó el Grammy a Mejor Álbum Pop Vocal en 2007, y la crítica que lo había despachado como ídolo adolescente tuvo que mirarlo de nuevo: el guitarrista serio había estado ahí todo el tiempo.",
      whyItMatters:
        "Continuum es uno de los grandes discos sobre crecer — no sobre ser joven ni sobre ser viejo, sino sobre el tránsito incómodo entre ambos. Veinte años después se sigue citando como referencia de producción: el tono de guitarra de 'Slow Dancing in a Burning Room' o 'Gravity' es material de estudio en escuelas de música. Pero su verdadera importancia es emocional: es el disco al que se vuelve cuando la vida empieza a hacer preguntas que no tienen respuesta rápida.",
      questions: [
        "¿Qué canción te tocó una fibra que no esperabas?",
        "El disco habla del miedo a que el tiempo pase demasiado rápido. ¿En qué momento de tu vida te alcanzó esa sensación?",
        "¿Lo volverías a escuchar entero, o te quedas con canciones sueltas?",
      ],
    },
    tracks: [
      { position: 1, title: "Waiting on the World to Change", note: "La apertura: apatía generacional convertida en soul. Ganó el Grammy a Mejor Interpretación Pop Vocal Masculina en 2007." },
      { position: 2, title: "I Don't Trust Myself (With Loving You)" },
      { position: 3, title: "Belief" },
      { position: 4, title: "Gravity", note: "Considerada una de las mejores canciones de su carrera. Nació en los conciertos del John Mayer Trio y ya aparecía en el disco en vivo Try! (2005). Tres acordes, espacio, y una súplica: que la gravedad no gane." },
      { position: 5, title: "The Heart of Life" },
      { position: 6, title: "Vultures" },
      { position: 7, title: "Stop This Train", note: "El corazón temático del disco: no quiero envejecer, pero tampoco puedo bajarme del tren. Si manejas mientras la escuchas, prepárate." },
      { position: 8, title: "Slow Dancing in a Burning Room", note: "Muchos fans la consideran su obra maestra: una relación que se incendia en cámara lenta, y los dos lo saben." },
      { position: 9, title: "Bold as Love", note: "Versión de Jimi Hendrix (Axis: Bold as Love, 1967). Mayer rindiendo cuentas con su héroe." },
      { position: 10, title: "Dreaming with a Broken Heart" },
      { position: 11, title: "In Repair" },
      { position: 12, title: "I'm Gonna Find Another You", note: "El cierre: un blues breve y elegante para aceptar la derrota con la frente en alto." },
    ],
  },
  {
    artist: { name: "Fleetwood Mac" },
    album: {
      title: "Rumours",
      year: 1977,
      releaseDate: "1977-02-04",
      label: "Warner Bros.",
      durationMin: 40,
      difficulty: 1,
      impact: 95,
    },
    facts: [
      { fact: "Lanzado el 4 de febrero de 1977 por Warner Bros.", source: "wikipedia:es" },
      { fact: "Ganó el Grammy a Álbum del Año en 1978.", source: "wikipedia:en" },
      { fact: "'Dreams' fue el único sencillo número 1 de la banda en Estados Unidos.", source: "wikipedia:en" },
      { fact: "Durante la grabación, las dos parejas de la banda (Buckingham/Nicks y los McVie) estaban separándose, y Mick Fleetwood atravesaba un divorcio.", source: "wikipedia:en" },
      { fact: "Es uno de los álbumes más vendidos de la historia, con más de 40 millones de copias.", source: "wikipedia:en" },
      { fact: "'The Chain' es la única canción del disco acreditada a los cinco miembros.", source: "wikipedia:en" },
      { fact: "'Songbird' fue grabada en el auditorio Zellerbach de Berkeley.", source: "wikipedia:en" },
    ],
    dossier: {
      intro:
        "Imagina grabar un disco con tu ex. Ahora imagina que en la banda hay dos parejas rotas, que el baterista atraviesa un divorcio, y que nadie puede irse porque la música que están haciendo juntos es la mejor de sus vidas. Eso es Rumours. En 1976, Fleetwood Mac entró al estudio en plena implosión sentimental: Lindsey Buckingham y Stevie Nicks terminando a gritos, John y Christine McVie sin dirigirse la palabra fuera de los ensayos. Y de ese incendio salieron once canciones perfectas donde cada uno le canta al otro delante de todos. 'Go Your Own Way' es Lindsey acusando a Stevie; 'Dreams' es Stevie respondiéndole con una elegancia letal. El resultado ganó el Grammy a Álbum del Año y vendió más de 40 millones de copias. No existe otro disco donde el dolor privado se haya vuelto pop tan luminoso.",
      artistStory:
        "Fleetwood Mac había nacido como banda de blues británico en los sesenta, pero para 1975 era otra cosa: dos californianos — Buckingham y Nicks — se habían unido al núcleo de Mick Fleetwood y los McVie, y el primer disco de esa formación los hizo estrellas. El éxito llegó junto con el colapso personal: dinero nuevo, giras infinitas, excesos y relaciones desintegrándose. En lugar de separarse, decidieron grabar. La regla no escrita era brutal: lo que sintieras, lo decías en una canción, y tu ex la tocaba contigo.",
      whyItMatters:
        "Rumours es el estándar de oro del pop-rock adulto: la prueba de que la música más accesible puede nacer del conflicto más crudo. Medio siglo después sigue sonando fresco — 'Dreams' volvió a ser número 1 en streaming en 2020 gracias a un video viral, y generaciones que no habían nacido en 1977 lo descubrieron intacto. Es también una lección sobre el arte: a veces la obra existe precisamente porque sus autores no pudieron resolver su vida.",
      questions: [
        "¿De qué lado te pusiste: el reproche de 'Go Your Own Way' o la serenidad de 'Dreams'?",
        "¿Se nota el dolor detrás de melodías tan luminosas, o el pop lo disimula todo?",
        "¿Hay algo en tu vida que hiciste mejor precisamente porque estabas roto?",
      ],
    },
    tracks: [
      { position: 1, title: "Second Hand News" },
      { position: 2, title: "Dreams", note: "El único número 1 de la banda en EE.UU. Stevie Nicks responde a Lindsey sin levantar la voz: la venganza más elegante de la historia del pop." },
      { position: 3, title: "Never Going Back Again" },
      { position: 4, title: "Don't Stop", note: "Christine McVie mirando hacia adelante en pleno divorcio. El optimismo como acto de voluntad." },
      { position: 5, title: "Go Your Own Way", note: "Lindsey Buckingham le canta a Stevie Nicks — y ella tiene que hacer los coros. Escucha la batería: pura rabia contenida." },
      { position: 6, title: "Songbird", note: "Christine McVie sola con un piano, grabada en el auditorio Zellerbach de Berkeley. Un respiro de ternura en medio de la guerra." },
      { position: 7, title: "The Chain", note: "La única canción firmada por los cinco: la cadena que no pudieron romper. El bajo del final es uno de los momentos más famosos del rock." },
      { position: 8, title: "You Make Loving Fun" },
      { position: 9, title: "I Don't Want to Know" },
      { position: 10, title: "Oh Daddy" },
      { position: 11, title: "Gold Dust Woman", note: "Stevie Nicks cierra el disco entre fantasmas y excesos: la cara oscura del sueño californiano." },
    ],
  },
  {
    artist: { name: "Rosalía" },
    album: {
      title: "El Mal Querer",
      year: 2018,
      releaseDate: "2018-11-02",
      label: "Sony",
      durationMin: 30,
      difficulty: 3,
      impact: 85,
    },
    facts: [
      { fact: "Lanzado el 2 de noviembre de 2018 por Sony.", source: "wikipedia:es" },
      { fact: "Álbum conceptual inspirado en 'Flamenca', una novela occitana del siglo XIII; cada canción es un capítulo de una relación tóxica.", source: "wikipedia:es" },
      { fact: "Coproducido por Rosalía y El Guincho (Pablo Díaz-Reixa).", source: "wikipedia:es" },
      { fact: "Nació como el trabajo de fin de grado de Rosalía en la ESMUC (Escola Superior de Música de Catalunya).", source: "wikipedia:es" },
      { fact: "Ganó el Latin Grammy a Álbum del Año en 2019.", source: "wikipedia:es" },
      { fact: "Ganó el Grammy a Mejor Álbum de Rock, Urbano o Alternativo Latino en 2020.", source: "wikipedia:en" },
      { fact: "'Malamente' ganó dos Latin Grammys en 2018.", source: "wikipedia:es" },
      { fact: "'Bagdad' interpola 'Cry Me a River' de Justin Timberlake.", source: "wikipedia:en" },
    ],
    dossier: {
      intro:
        "Una estudiante de flamenco presenta su trabajo de fin de grado y, sin que nadie lo planeara, cambia el rumbo del pop en español. El Mal Querer es eso: el proyecto universitario de Rosalía en la ESMUC convertido en fenómeno mundial. La idea es tan ambiciosa que parece imposible en treinta minutos: adaptar 'Flamenca', una novela occitana del siglo XIII sobre una mujer encerrada por un marido celoso, y contarla en once capítulos donde el cante jondo se funde con producción electrónica, palmas convertidas en beats y armonías de R&B. Cada canción lleva su capítulo en el título — Augurio, Boda, Celos, Disputa... — y el arco va de la promesa del amor a la liberación. Escúchalo en orden, sin saltarte nada: es una historia, y el final solo pesa si hiciste el viaje completo.",
      artistStory:
        "Antes del estallido, Rosalía pasó más de una década formándose en el flamenco — un mundo con reglas estrictas donde una catalana sin apellido gitano tenía todo por demostrar. Su primer disco, acústico y ortodoxo, fue la carta de presentación. Para el segundo quiso otra cosa: junto a El Guincho construyó un sonido donde la tradición no se conserva en vitrina sino que se remezcla sin pedir permiso. La polémica fue inmediata — ¿apropiación o evolución? — pero los premios y la influencia zanjaron la discusión a su manera: Latin Grammy a Álbum del Año en 2019 y Grammy en 2020.",
      whyItMatters:
        "El Mal Querer demostró que se puede ser radicalmente local y globalmente masivo a la vez: flamenco del siglo XXI que sonó en estadios de todo el mundo sin traducirse ni diluirse. Abrió la puerta a una generación de artistas en español que ya no piden permiso para experimentar. Y es uno de los mejores ejemplos modernos de álbum conceptual: media hora exacta donde nada sobra y todo cuenta una sola historia.",
      questions: [
        "¿Sentiste el arco de la historia — del augurio del inicio al poder del final?",
        "¿Qué te provocó el choque entre lo ancestral (las palmas, el cante) y lo moderno (los beats, el autotune)?",
        "¿Conoces otra obra que reinvente una tradición sin destruirla?",
      ],
    },
    tracks: [
      { position: 1, title: "Malamente (Cap.1: Augurio)", note: "La premonición: algo malo viene y ella lo sabe. Ganó dos Latin Grammys en 2018 y fue la puerta de entrada del mundo a Rosalía." },
      { position: 2, title: "Que No Salga la Luna (Cap.2: Boda)" },
      { position: 3, title: "Pienso en Tu Mirá (Cap.3: Celos)", note: "Los celos como violencia que se disfraza de amor: 'me da miedo cuando sales'. Una de las letras más escalofriantes del disco." },
      { position: 4, title: "De Aquí No Sales (Cap.4: Disputa)" },
      { position: 5, title: "Reniego (Cap.5: Lamento)" },
      { position: 6, title: "Preso (Cap.6: Clausura)" },
      { position: 7, title: "Bagdad (Cap.7: Liturgia)", note: "Interpola 'Cry Me a River' de Justin Timberlake y la convierte en una plegaria. El momento más inesperado del disco." },
      { position: 8, title: "Di Mi Nombre (Cap.8: Éxtasis)", note: "El deseo como último territorio propio dentro de la jaula." },
      { position: 9, title: "Nana (Cap.9: Concepción)" },
      { position: 10, title: "Maldición (Cap.10: Cordura)" },
      { position: 11, title: "A Ningún Hombre (Cap.11: Poder)", note: "El final del arco: 'a ningún hombre consiento que dicte mi sentencia'. La emancipación, a capela y sin adornos." },
    ],
  },
];
