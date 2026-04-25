import { NextResponse } from "next/server";

import { enforcePermission, toRBACErrorResponse } from "@/lib/rbac/access";
import { listStoreProducts } from "@/lib/products/service";
import { createPerfScope } from "@/server/perf/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["hnd1", "sin1"];

export async function GET(request: Request) {
  const perf = createPerfScope("api.products.search");
  try {
    const { storeId } = await perf.step(
      "auth.permission",
      () => enforcePermission("products.view"),
      { kind: "auth", serverTimingName: "auth" },
    );
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const includeStock = searchParams.get("includeStock") === "true";

    const items = await perf.step(
      "db.searchProducts",
      () => listStoreProducts(storeId, q),
      { kind: "db", serverTimingName: "db" },
    );

    const products = await perf.step(
      "logic.shapeResponse",
      () =>
        includeStock
          ? items.map((item) => ({
              ...item,
              stock: {
                onHand: item.stockOnHand,
                reserved: item.stockReserved,
                available: item.stockAvailable,
              },
            }))
          : items,
      { kind: "logic", serverTimingName: "logic" },
    );
    const latency = perf.elapsedMs();

    const response = await perf.step(
      "response.json",
      () =>
        NextResponse.json(
          { ok: true, products, count: products.length, latency },
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
