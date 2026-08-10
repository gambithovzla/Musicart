// Descriptores de género — antes: pastillas ámbar, como las etiquetas de
// cualquier app. Ahora son lo que son en una publicación: los DESCRIPTORES que
// se ponen al pie de un artículo, en monoespaciada y separados por barras.

export function GenreTags({
  genres,
  size = "sm",
}: {
  genres: string[];
  size?: "sm" | "xs";
}) {
  if (genres.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {genres.map((g, i) => (
        <span key={g} className="flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden className="text-tinta-suave/50">
              /
            </span>
          )}
          <span
            className={`dato uppercase tracking-[0.14em] text-album ${
              size === "xs" ? "text-[9px]" : "text-[10px]"
            }`}
          >
            {g}
          </span>
        </span>
      ))}
    </p>
  );
}
