export default function SettingsStoreFinanceLoading() {
  return (
    <section className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div className="space-y-2">
            <div className="h-6 w-36 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-9 w-20 animate-pulse rounded-full bg-slate-100" />
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-50" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="flex justify-end">
            <div className="h-11 w-40 animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-16 animate-pulse border-b border-slate-100 bg-slate-50/70" />
          <div className="h-16 animate-pulse border-b border-slate-100 bg-slate-50/40" />
          <div className="h-16 animate-pulse border-b border-slate-100 bg-slate-50/30" />
          <div className="h-16 animate-pulse bg-slate-50/20" />
        </div>
      </div>
    </section>
  );
}
