import { Skeleton, SkeletonHeader } from "@/components/Skeleton";

export default function ExplorarLoading() {
  return (
    <main className="px-6 pb-10 pt-12">
      <SkeletonHeader />
      <div className="mt-8 flex flex-col gap-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    </main>
  );
}
