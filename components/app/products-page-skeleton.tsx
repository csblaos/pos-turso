export function ProductsPageSkeleton() {
  return (
    <section className="space-y-2 pb-24">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm"
          >
            <div className="mx-auto h-6 w-12 animate-pulse rounded bg-slate-200" />
            <div className="mx-auto mt-2 h-3 w-16 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="sticky top-0 z-10 -mx-1 rounded-xl py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="h-10 flex-1 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="h-10 w-10 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="hidden h-10 w-28 animate-pulse rounded-xl bg-slate-200 sm:block" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-10 min-w-[10rem] flex-1 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="h-10 w-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>

      <div className="divide-y overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 px-3 py-3"
          >
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-slate-100" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-slate-100" />
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-100" />
              <div className="h-2.5 w-2/5 animate-pulse rounded bg-blue-100" />
            </div>
            <div className="w-16 shrink-0 space-y-1.5 text-right">
              <div className="ml-auto h-3.5 w-full animate-pulse rounded bg-slate-200" />
              <div className="ml-auto h-5 w-12 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </section>
  );
}
