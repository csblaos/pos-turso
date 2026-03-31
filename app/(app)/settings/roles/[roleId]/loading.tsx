export default function SettingsRoleDetailLoading() {
  return (
    <section className="space-y-5">
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="hidden sm:block">
            <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:hidden">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-11 w-full animate-pulse rounded-full bg-slate-100 sm:w-48" />
          </div>
        </div>
      </article>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex min-h-14 items-center gap-3 px-4 py-3">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </article>
    </section>
  );
}
