export default function SettingsSuperadminStoreConfigLoading() {
  return (
    <section className="space-y-5">
      <header className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-7 w-44 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
      </header>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-slate-100 px-4 py-4">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-72 max-w-full animate-pulse rounded bg-slate-100" />
          <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="space-y-3 px-4 py-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </article>

      <div className="space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-3 px-4 py-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
