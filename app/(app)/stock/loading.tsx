import { PageLoadingSkeleton } from "@/components/app/page-loading-skeleton";

export default function StockLoading() {
  return (
    <section className="space-y-4">
      <PageLoadingSkeleton />
    </section>
  );
}
