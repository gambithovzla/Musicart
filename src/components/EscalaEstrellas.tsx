// Recordatorio sencillo de qué significan las estrellas de "Dificultad" e
// "Impacto", para que el usuario no se sienta perdido al verlas. Se muestra
// junto a las métricas en el reveal del día y en el dossier completo.

export function EscalaEstrellas({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-dim ${className}`}>
      <span className="text-album-light">Dificultad:</span> 1★ se entra fácil,
      5★ pide oído atento.{" "}
      <span className="text-album-light">Impacto:</span> de 1 a 100, cuánto movió
      la historia de la música (100 = un hito).
    </p>
  );
}
