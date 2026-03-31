export function StockPageSkeleton() {
  return (
    <section className="space-y-2">
      <div className="sticky top-0 z-20 -mx-1 rounded-xl py-2 px-0">
        <div className="flex gap-1 overflow-hidden rounded-xl bg-slate-100 p-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className={`h-9 flex-1 animate-pulse rounded-lg ${
                index === 0 ? "bg-white shadow-sm" : "bg-slate-100"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="h-5 w-10 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-16 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="sticky top-[3.8rem] z-10 -mx-1 rounded-xl py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="h-10 flex-1 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="h-10 w-10 animate-pulse rounded-xl border border-slate-200 bg-white" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-10 min-w-[10rem] flex-1 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="h-10 w-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <article
            key={index}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex gap-3 p-4">
              <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-slate-100" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
            <div className="border-t border-slate-100 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                <div className="h-7 w-16 animate-pulse rounded-full bg-slate-100" />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
