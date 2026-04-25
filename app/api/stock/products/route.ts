import { NextResponse } from "next/server";

import {
  enforcePermissionForCurrentSession,
  toRBACErrorResponse,
} from "@/lib/rbac/access";
import { getStockProductsPage } from "@/server/services/stock.service";
import { createPerfScope } from "@/server/perf/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["hnd1", "sin1"];

export async function GET(request: Request) {
  const perf = createPerfScope("api.stock.products");
  try {
    const { storeId } = await perf.step(
      "auth.permission",
      () => enforcePermissionForCurrentSession("inventory.view"),
      { kind: "auth", serverTimingName: "auth" },
    );
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId")?.trim() || undefined;
    const includeUnitOptionsParam = url.searchParams.get("includeUnitOptions");
    const includeUnitOptions =
      includeUnitOptionsParam === "1" || includeUnitOptionsParam === "true";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = productId
      ? 1
      : Math.min(50, Math.max(5, Number(url.searchParams.get("pageSize") ?? 20)));
    const categoryId = url.searchParams.get("categoryId")?.trim() || undefined;
    const query = url.searchParams.get("q")?.trim() || undefined;
    const offset = (page - 1) * pageSize;
    const rows = await perf.step(
      "db.productsPage",
      () =>
        getStockProductsPage({
          storeId,
          limit: pageSize + 1,
          offset,
          categoryId,
          query,
          includeUnitOptions,
          productId,
        }),
      { kind: "db", serverTimingName: "db" },
    );
    const { hasMore, products } = await perf.step(
      "logic.slicePage",
      () => ({
        hasMore: rows.length > pageSize,
        products: rows.slice(0, pageSize),
      }),
      { kind: "logic", serverTimingName: "logic" },
    );
    const latency = perf.elapsedMs();

    const response = await perf.step(
      "response.json",
      () =>
        NextResponse.json(
          {
            ok: true,
            products,
            page,
            pageSize,
            hasMore,
            count: products.length,
            latency,
          },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          },
        ),
      { kind: "logic", serverTimingName: "response" },
    );
    response.headers.set(
      "Server-Timing",
      perf.serverTiming({ includeTotal: true, totalName: "app" }),
    );

    return response;
  } catch (error) {
    return toRBACErrorResponse(error);
  } finally {
    perf.end();
  }
}
