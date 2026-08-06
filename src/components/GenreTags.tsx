// Badges de género musical: mismo estilo que los chips de ánimo de la rebobinada.

export function GenreTags({
  genres,
  size = "sm",
}: {
  genres: string[];
  size?: "sm" | "xs";
}) {
  if (genres.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {genres.map((g) => (
        <span
          key={g}
          className={
            size === "xs"
              ? "rounded-full bg-album/15 px-2 py-0.5 text-[0.65rem] font-medium text-album-light"
              : "rounded-full bg-album/15 px-3 py-1 text-xs font-medium text-album-light"
          }
        >
          {g}
        </span>
      ))}
    </div>
  );
}
