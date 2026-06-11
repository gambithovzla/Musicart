import { Skeleton, SkeletonHeader } from "@/components/Skeleton";

export default function PerfilLoading() {
  return (
    <main className="px-6 pb-10 pt-12">
      <SkeletonHeader />
      <Skeleton className="mt-6 h-16 w-full rounded-2xl" />
      <div className="mt-8">
        <Skeleton className="h-5 w-48" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-20 rounded-full" />
        </div>
      </div>
      <div className="mt-8">
        <Skeleton className="h-5 w-44" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
        </div>
      </div>
    </main>
  );
}
