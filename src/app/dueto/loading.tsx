export default function DuetoLoading() {
  return (
    <main className="px-6 pb-16 pt-12">
      <div className="mx-auto max-w-sm animate-pulse space-y-4">
        <div className="mx-auto h-4 w-24 rounded bg-white/10" />
        <div className="mx-auto h-8 w-56 rounded bg-white/10" />
        <div className="mt-8 aspect-square rounded-2xl bg-white/5" />
        <div className="h-24 rounded-2xl bg-white/5" />
      </div>
    </main>
  );
}
