import { Skeleton } from "@/components/Skeleton";

export default function AlbumLoading() {
  return (
    <main className="px-6 pt-10">
      <div className="flex flex-col items-center text-center">
        <Skeleton className="aspect-square w-48 rounded-xl" />
        <Skeleton className="mt-6 h-8 w-64" />
        <Skeleton className="mt-3 h-5 w-44" />
        <Skeleton className="mt-4 h-4 w-56" />
      </div>

      <Skeleton className="mt-8 h-24 w-full rounded-2xl" />

      <div className="mt-12">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="mt-5 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-5/6" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-3/4" />
      </div>

      <div className="mt-12">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="mt-5 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-4/5" />
      </div>
    </main>
  );
}
