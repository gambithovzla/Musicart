import { Skeleton } from "@/components/Skeleton";

export default function RebobinadaLoading() {
  return (
    <main className="px-6 pb-16 pt-12">
      <div className="flex flex-col items-center">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-8 w-48" />
      </div>
      <Skeleton className="mt-8 h-56 w-full rounded-2xl" />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    </main>
  );
}
