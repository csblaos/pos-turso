export default function SettingsAuditLogLoading() {
  return (
    <section className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div className="space-y-2">
            <div className="h-6 w-40 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-4 w-72 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
        </div>

        <div className="space-y-4 border-b border-slate-100 px-4 py-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-50" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-50" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-50" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-24 animate-pulse rounded-full bg-slate-100" />
            <div className="h-9 w-28 animate-pulse rounded-full bg-slate-50" />
          </div>
        </div>

        <div className="border-b border-slate-100 px-4 py-3">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-40 animate-pulse rounded bg-slate-100" />
        </div>

        <div className="space-y-0">
          <div className="h-24 animate-pulse border-b border-slate-100 bg-slate-50/50" />
          <div className="h-24 animate-pulse border-b border-slate-100 bg-slate-50/20" />
          <div className="h-24 animate-pulse bg-slate-50/50" />
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <div className="h-8 w-24 animate-pulse rounded-full bg-slate-100" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-slate-50" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-16 animate-pulse border-b border-slate-100 bg-slate-50/70" />
          <div className="h-16 animate-pulse bg-slate-50/20" />
        </div>
      </div>
    </section>
  );
}
