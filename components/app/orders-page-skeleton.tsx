export function OrdersManagementSkeleton() {
  return (
    <article className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-64 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="h-9 w-9 animate-pulse rounded-md border border-slate-200 bg-white" />
          <div className="h-9 w-28 animate-pulse rounded-md bg-slate-200" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-8 w-20 animate-pulse rounded-full border border-slate-200 bg-white"
          />
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
        <div className="h-10 animate-pulse rounded-md border border-slate-200 bg-white" />
        <div className="h-10 w-10 animate-pulse rounded-md border border-slate-200 bg-white" />
        <div className="h-10 w-10 animate-pulse rounded-md border border-slate-200 bg-white" />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <ul className="divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, index) => (
            <li key={index} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-52 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-40 animate-pulse rounded bg-slate-200" />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
                <div className="h-6 w-16 animate-pulse rounded-full bg-slate-200" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function OrdersPageSkeleton() {
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="h-7 w-32 animate-pulse rounded bg-slate-200" />
        <div className="flex shrink-0 items-center gap-2">
          <div className="h-9 w-9 animate-pulse rounded-md border border-slate-200 bg-white" />
          <div className="h-9 w-24 animate-pulse rounded-md border border-slate-200 bg-white" />
        </div>
      </header>

      <OrdersManagementSkeleton />
    </section>
  );
}

