import { SkeletonCard, SkeletonHeader } from "@/components/Skeleton";

export default function RutaLoading() {
  return (
    <main className="px-6 pb-10 pt-12">
      <SkeletonHeader />
      <div className="mt-8 flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </main>
  );
}
