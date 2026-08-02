export default function DashboardGroupLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="bg-muted/60 h-8 w-48 animate-pulse rounded-md" />
      <div className="bg-muted/40 h-4 w-72 max-w-full animate-pulse rounded-md" />
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-muted/35 h-28 animate-pulse rounded-xl" />
        <div className="bg-muted/35 h-28 animate-pulse rounded-xl" />
        <div className="bg-muted/35 hidden h-28 animate-pulse rounded-xl sm:block" />
      </div>
      <div className="bg-muted/30 mt-2 h-64 animate-pulse rounded-xl" />
    </div>
  );
}
