export default function SettingsRolesLoading() {
  return (
    <section className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="space-y-2 px-1">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-72 animate-pulse rounded bg-slate-100" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-14 animate-pulse border-b border-slate-100 bg-slate-50/70" />
        <ul className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, index) => (
            <li key={index} className="flex min-h-14 items-center gap-3 px-4 py-3">
              <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-200" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-4 w-4 animate-pulse rounded bg-slate-200" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
