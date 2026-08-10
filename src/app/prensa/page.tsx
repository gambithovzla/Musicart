// LA IMPRENTA — el libro de estilo de Musicart, en vivo.
//
// Esta página existe por dos razones:
//
//  1. Para el dueño: poder VER el sistema visual entero de un vistazo, en las
//     dos ediciones, sin tener que ir pantalla por pantalla.
//  2. Para quien toque la UI después (humano o IA): tener delante las reglas y
//     sus ejemplos. El riesgo de un sistema con carácter es que la siguiente
//     sesión, por inercia, vuelva a meter una tarjeta redondeada con borde
//     blanco al 10% — que es la plantilla contra la que se hizo todo esto.
//
// No lleva datos reales ni toca la base: son especímenes. Por eso puede
// renderizarse siempre, aunque no haya nada más levantado.

import type { Metadata } from "next";
import { GaleriaCanon } from "../salon/GaleriaCanon";
import { SelloPuntaje } from "../salon/SelloPuntaje";
import type { SalonAlbum } from "@/lib/canon/consulta";

export const metadata: Metadata = {
  title: "La imprenta · Musicart",
  description: "El libro de estilo de Musicart.",
  robots: { index: false, follow: false },
};

const REGLAS = [
  {
    n: "I",
    titulo: "Cero esquinas redondeadas",
    texto:
      "La tinta no tiene esquinas blandas. Lo único redondo es lo que de verdad es un círculo, y lleva la clase «circulo».",
  },
  {
    n: "II",
    titulo: "Cero tarjetas",
    texto:
      "La estructura la hacen reglas, aire y jerarquía tipográfica. Lo que debe destacarse se enmarca; no flota dentro de una caja gris.",
  },
  {
    n: "III",
    titulo: "Tinta sobre papel, en dos ediciones",
    texto:
      "No hay «modo claro» y «modo oscuro»: hay una edición de día en papel prensa y una de noche en tinta clara. Misma revista, dos tiradas.",
  },
  {
    n: "IV",
    titulo: "La tipografía es la interfaz",
    texto:
      "Display para titulares y cifras, versalitas espaciadas para los rótulos, monoespaciada para todo lo que es dato. Tres oficios, tres letras.",
  },
  {
    n: "V",
    titulo: "Los botones son sellos",
    texto:
      "Rectangulares, entintados, con sombra dura sin difuminar. Al pulsarlos se hunden contra el papel, como un tipo móvil.",
  },
  {
    n: "VI",
    titulo: "Nada de emojis",
    texto:
      "Los adornos son tipográficos. Un emoji dentro de un botón es lo que se pone cuando no se ha decidido qué es esa cosa.",
  },
  {
    n: "VII",
    titulo: "Lo que se numera, se numera",
    texto:
      "Secciones con folio, discos con posición, láminas con pie de figura. Una publicación se ordena; una app solo se scrollea.",
  },
];

const ESPECIMENES: SalonAlbum[] = [
  {
    id: "1",
    title: "The Dark Side of the Moon",
    artist: "Pink Floyd",
    year: 1973,
    coverUrl: null,
    score: 100,
    piso: "Inmortales",
    evidencia: [],
    generos: [],
    country: "GB",
    albumId: null,
    bloqueado: false,
  },
  {
    id: "2",
    title: "Siembra",
    artist: "Willie Colón & Rubén Blades",
    year: 1978,
    coverUrl: null,
    score: 96,
    piso: "Hitos",
    evidencia: [],
    generos: [],
    country: "PA",
    albumId: null,
    bloqueado: false,
  },
  {
    id: "3",
    title: "Kind of Blue",
    artist: "Miles Davis",
    year: 1959,
    coverUrl: null,
    score: 92,
    piso: "Hitos",
    evidencia: [],
    generos: [],
    country: "US",
    albumId: null,
    bloqueado: false,
  },
  {
    id: "4",
    title: "La Leyenda del Tiempo",
    artist: "Camarón de la Isla",
    year: 1979,
    coverUrl: null,
    score: 78,
    piso: "Notables",
    evidencia: [],
    generos: [],
    country: "ES",
    albumId: null,
    bloqueado: false,
  },
];

export default function PrensaPage() {
  return (
    <main className="px-5 pb-24 pt-8">
      <header>
        <p className="rotulo">Libro de estilo</p>
        <h1 className="font-serif mt-3 text-[3rem] font-semibold leading-[0.88]">
          La imprenta
        </h1>
        <div className="filete-grueso mt-4" />
        <p className="font-serif mt-4 text-[15px] leading-relaxed text-tinta-suave">
          Musicart no es una app: es una publicación. Estas son las reglas que la
          hacen parecerlo, y los especímenes con los que se comprueba.
        </p>
      </header>

      {/* ── Las siete reglas ─────────────────────────────────────────────── */}
      <section className="mt-10">
        <div className="cabecera-seccion">
          <span className="rotulo">Las reglas</span>
          <span className="dato text-[10px] text-tinta-suave">№ 01</span>
        </div>
        <ol className="mt-1 border-t border-regla">
          {REGLAS.map((r) => (
            <li key={r.n} className="flex gap-4 border-b border-regla py-3.5">
              <span className="cifra w-8 shrink-0 pt-1 text-xl text-tinta-suave">
                {r.n}
              </span>
              <span className="min-w-0">
                <span className="font-serif block text-[17px] leading-tight">
                  {r.titulo}
                </span>
                <span className="mt-1 block text-[12px] leading-relaxed text-tinta-suave">
                  {r.texto}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Tipografía ───────────────────────────────────────────────────── */}
      <section className="mt-12">
        <div className="cabecera-seccion">
          <span className="rotulo">Las tres letras</span>
          <span className="dato text-[10px] text-tinta-suave">№ 02</span>
        </div>

        <div className="mt-4 border-b border-regla pb-4">
          <p className="rotulo">Display · Fraunces</p>
          <p className="font-serif mt-1.5 text-[2.5rem] font-semibold leading-[0.95]">
            Un disco al día
          </p>
          <p className="dato mt-1 text-[10px] text-tinta-suave">
            Titulares y cifras. Óptica variable: tallada en grande, legible en
            pequeño.
          </p>
        </div>

        <div className="mt-4 border-b border-regla pb-4">
          <p className="rotulo">Texto · Archivo</p>
          <p className="mt-1.5 text-[15px] leading-relaxed">
            La grotesca de la prensa. Sustituye a Inter, que es la tipografía de
            todas las apps del mundo y por sí sola ya delata la plantilla.
          </p>
        </div>

        <div className="mt-4 border-b border-regla pb-4">
          <p className="rotulo">Dato · IBM Plex Mono</p>
          <p className="dato mt-1.5 text-[13px]">
            96/100 · 1978 · № 222 · 10 AGO 2026
          </p>
          <p className="dato mt-1 text-[10px] text-tinta-suave">
            Todo lo que es número o referencia. Que los datos se vean como datos.
          </p>
        </div>
      </section>

      {/* ── Sellos ───────────────────────────────────────────────────────── */}
      <section className="mt-12">
        <div className="cabecera-seccion">
          <span className="rotulo">Los sellos</span>
          <span className="dato text-[10px] text-tinta-suave">№ 03</span>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-tinta-suave">
          Pulsa uno: se hunde contra el papel y la sombra desaparece. Eso es un
          tipo móvil entintándose, no una pastilla con un degradado.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="sello">
            Acción principal
          </button>
          <button type="button" className="sello-hueco">
            Secundaria
          </button>
          <button type="button" className="sello" disabled>
            Deshabilitado
          </button>
        </div>
      </section>

      {/* ── Las cifras ───────────────────────────────────────────────────── */}
      <section className="mt-12">
        <div className="cabecera-seccion">
          <span className="rotulo">Las cifras del canon</span>
          <span className="dato text-[10px] text-tinta-suave">№ 04</span>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-tinta-suave">
          La altura se lee por el peso de la tinta, no por el brillo: el 100 va
          en negativo, el 95 con marco macizo, y de ahí para abajo el marco se
          afina hasta ser una raya.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <SelloPuntaje score={100} tam="lg" />
          <SelloPuntaje score={96} tam="md" />
          <SelloPuntaje score={91} tam="md" />
          <SelloPuntaje score={72} tam="sm" />
        </div>
      </section>

      {/* ── El escalafón ─────────────────────────────────────────────────── */}
      <section className="mt-12">
        <div className="cabecera-seccion">
          <span className="rotulo">El escalafón</span>
          <span className="dato text-[10px] text-tinta-suave">№ 05</span>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-tinta-suave">
          El muro del Salón, con especímenes. Antes era una rejilla de carátulas
          con una moneda dorada encima; ahora se lee en columna, numerado y con
          la cifra alineada para poder compararla.
        </p>
        <div className="mt-4">
          <GaleriaCanon albums={ESPECIMENES} destacada />
        </div>
      </section>

      {/* ── Índice ───────────────────────────────────────────────────────── */}
      <section className="mt-12">
        <div className="cabecera-seccion">
          <span className="rotulo">El índice</span>
          <span className="dato text-[10px] text-tinta-suave">№ 06</span>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-tinta-suave">
          Con puntos conductores, como el índice de un libro. Sustituye a
          cualquier fila de pastillas.
        </p>
        <ul className="mt-4">
          {["Heavy metal", "Salsa", "Bossa nova"].map((g, i) => (
            <li
              key={g}
              className="flex items-baseline gap-2.5 border-b border-regla-tenue py-2.5"
            >
              <span className="dato w-6 shrink-0 text-[10px] text-tinta-suave">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-serif shrink-0 text-[17px] leading-none">{g}</span>
              <span className="puntos" />
              <span className="dato shrink-0 text-[10px] uppercase tracking-[0.14em] text-tinta-suave">
                5 discos
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Destacado y capitular ────────────────────────────────────────── */}
      <section className="mt-12">
        <div className="cabecera-seccion">
          <span className="rotulo">Prosa y destacados</span>
          <span className="dato text-[10px] text-tinta-suave">№ 07</span>
        </div>

        <p className="prose-dossier capitular mt-4">
          Así arranca un dossier: con capitular, párrafos sangrados y la medida
          de lectura de un libro. La narrativa es lo único que se lee de corrido
          en toda la app, y por eso es lo único que va en serif a cuerpo grande.
        </p>

        <div className="mt-6 border-l-2 border-album pl-4">
          <p className="rotulo !text-album">Para ti, hoy</p>
          <p className="font-serif mt-2 text-[17px] leading-snug">
            El destacado: la razón del día no vive en una cajita ámbar
            redondeada, sino al margen, como la cita de una página.
          </p>
        </div>

        <p className="font-serif calderon mt-6 text-[15px] leading-relaxed">
          Y un artículo termina con su calderón, que es este cuadradito de ahí al
          lado.
        </p>
      </section>
    </main>
  );
}
