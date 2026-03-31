export default function SettingsSuperadminAuditLogLoading() {
  return (
    <section className="space-y-5">
      <header className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-6 w-40 animate-pulse rounded-full bg-blue-100" />
          <div className="h-8 w-52 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
      </header>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-1">
                <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-9 w-24 animate-pulse rounded-full bg-slate-200" />
            <div className="h-9 w-24 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
        <div className="space-y-2 px-4 py-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      </article>
    </section>
  );
}
