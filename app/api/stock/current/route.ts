import { NextResponse } from "next/server";

import { getLibsqlClient } from "@/lib/db/client";
import {
  enforcePermissionForCurrentSession,
  toRBACErrorResponse,
} from "@/lib/rbac/access";
import { createPerfScope } from "@/server/perf/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["hnd1", "sin1"];

export async function GET(request: Request) {
  const perf = createPerfScope("api.stock.current");
  try {
    const { storeId } = await perf.step(
      "auth.permission",
      () => enforcePermissionForCurrentSession("inventory.view"),
      { kind: "auth", serverTimingName: "auth" },
    );
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json({ message: "กรุณาระบุ productId" }, { status: 400 });
    }

    const result = await perf.step(
      "db.balance",
      () =>
        getLibsqlClient().execute({
          sql: `
            select
              coalesce(on_hand_base, 0) as on_hand,
              coalesce(reserved_base, 0) as reserved
            from inventory_balances
            where store_id = ? and product_id = ?
            limit 1
          `,
          args: [storeId, productId],
        }),
      { kind: "db", serverTimingName: "db" },
    );

    const stock = await perf.step(
      "logic.shapeStock",
      () => {
        const onHand = Number(result.rows[0]?.on_hand ?? 0);
        const reserved = Number(result.rows[0]?.reserved ?? 0);
        return {
          onHand,
          reserved,
          available: onHand - reserved,
        };
      },
      { kind: "logic", serverTimingName: "logic" },
    );
    const latency = perf.elapsedMs();

    const response = await perf.step(
      "response.json",
      () =>
        NextResponse.json(
          {
            ok: true,
            stock,
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
