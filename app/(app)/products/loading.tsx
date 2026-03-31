import { ProductsPageSkeleton } from "@/components/app/products-page-skeleton";

export default function ProductsLoading() {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div className="h-7 flex-1 animate-pulse rounded bg-slate-200 sm:max-w-[10rem]" />
          <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
        </div>
      </header>
      <ProductsPageSkeleton />
    </section>
  );
}
