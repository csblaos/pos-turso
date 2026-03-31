export default function SettingsStoresLoading() {
  return (
    <section className="space-y-2" aria-busy="true" aria-live="polite">
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-64 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200" />
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="space-y-2 px-4 py-3">
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-56 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-11 animate-pulse border-b border-slate-100 bg-slate-50/70" />
              <ul className="divide-y divide-slate-100">
                {Array.from({ length: 3 }).map((_, index) => (
                  <li key={index} className="flex min-h-14 items-center gap-3 px-4 py-3">
                    <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-200" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                      <div className="h-3 w-56 animate-pulse rounded bg-slate-100" />
                    </div>
                    <div className="h-8 w-20 animate-pulse rounded-full bg-slate-200" />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-11 animate-pulse border-b border-slate-100 bg-slate-50/70" />
              <ul className="divide-y divide-slate-100">
                {Array.from({ length: 2 }).map((_, index) => (
                  <li key={index} className="flex min-h-14 items-center gap-3 px-4 py-3">
                    <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-200" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                      <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
                    </div>
                    <div className="h-8 w-20 animate-pulse rounded-full bg-slate-200" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </article>

      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex min-h-14 items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-200" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-52 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-4 w-4 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex min-h-14 items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-200" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-52 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-4 w-4 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      </div>
    </section>
  );
}
