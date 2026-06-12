import { DossierSection } from "@/components/DossierSection";

export function DidYouKnowSection({
  facts,
  sectionNumber,
}: {
  facts: string[];
  sectionNumber: string;
}) {
  if (facts.length === 0) return null;

  return (
    <DossierSection n={sectionNumber} title="Lo que no sabías">
      <p className="text-sm text-dim">
        Datos curiosos verificados — nada inventado por la IA.
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {facts.map((fact, i) => (
          <li
            key={i}
            className="rounded-xl border border-album/20 bg-album/5 px-4 py-3 text-[15px] leading-relaxed"
          >
            <span className="mr-1.5 text-album-light" aria-hidden>
              ✦
            </span>
            {fact}
          </li>
        ))}
      </ul>
    </DossierSection>
  );
}
