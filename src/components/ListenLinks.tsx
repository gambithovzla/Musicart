import type { AlbumLinks } from "@/lib/types";

const SERVICES: {
  key: keyof AlbumLinks;
  name: string;
  dot: string;
}[] = [
  { key: "spotify", name: "Spotify", dot: "#1DB954" },
  { key: "appleMusic", name: "Apple Music", dot: "#FA586A" },
  { key: "youtubeMusic", name: "YouTube Music", dot: "#FF0000" },
];

export function ListenLinks({ links }: { links: AlbumLinks }) {
  const available = SERVICES.filter((s) => links[s.key]);
  if (available.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {available.map((s) => (
        <a
          key={s.key}
          href={links[s.key]}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-2xl border border-white/10 bg-surface px-5 py-4 text-base font-medium transition-transform active:scale-[0.98]"
        >
          <span className="flex items-center gap-3">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: s.dot }}
            />
            Abrir en {s.name}
          </span>
          <span className="text-dim">→</span>
        </a>
      ))}
    </div>
  );
}
