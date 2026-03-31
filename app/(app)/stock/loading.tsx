import { StockPageSkeleton } from "@/components/app/stock-page-skeleton";

export default function StockLoading() {
  return (
    <section className="space-y-4">
      <StockPageSkeleton />
    </section>
  );
}
