export default function SettingsCategoriesLoading() {
  return (
    <section className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="space-y-2 px-1">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-72 animate-pulse rounded bg-slate-100" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-14 animate-pulse border-b border-slate-100 bg-slate-50/70" />
        <div className="space-y-3 px-4 py-4">
          <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-14 animate-pulse rounded-xl bg-slate-50" />
          <div className="h-14 animate-pulse rounded-xl bg-slate-50/70" />
          <div className="h-14 animate-pulse rounded-xl bg-slate-50/50" />
        </div>
      </div>
    </section>
  );
}
