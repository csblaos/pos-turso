export default function SettingsLoading() {
  return (
    <section className="space-y-4" aria-busy="true" aria-live="polite">
      <header className="space-y-1 px-1">
        <div className="h-7 w-36 animate-pulse rounded bg-slate-200" />
      </header>

      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, sectionIndex) => (
          <div key={sectionIndex} className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <ul className="divide-y divide-slate-100">
                {Array.from({ length: sectionIndex === 0 ? 1 : 3 }).map((__, rowIndex) => (
                  <li key={rowIndex} className="flex min-h-14 items-center gap-3 px-4 py-3">
                    <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-200" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                      <div className="h-3 w-52 animate-pulse rounded bg-slate-100" />
                    </div>
                    {/* <div className="h-4 w-4 animate-pulse rounded bg-slate-200" /> */}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
