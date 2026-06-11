import { Skeleton } from "@/components/Skeleton";

// El ritual diario tarda en elegir tu disco: que la espera ya se sienta como apertura.
export default function HomeLoading() {
  return (
    <main className="flex min-h-[calc(100dvh-6rem)] flex-col px-6 pt-12">
      <div className="flex flex-col items-center text-center">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-5 w-40" />
      </div>

      <Skeleton className="mx-auto mt-8 aspect-square w-full max-w-xs rounded-2xl" />

      <div className="mt-8 flex flex-col items-center">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-5 w-44" />
        <Skeleton className="mt-6 h-20 w-full max-w-sm rounded-2xl" />
      </div>

      <div className="mt-auto pb-8 pt-10">
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </main>
  );
}
