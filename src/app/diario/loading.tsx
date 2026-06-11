import { SkeletonCard, SkeletonHeader } from "@/components/Skeleton";

export default function DiarioLoading() {
  return (
    <main className="px-6 pt-12">
      <SkeletonHeader />
      <div className="mt-8 flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </main>
  );
}
