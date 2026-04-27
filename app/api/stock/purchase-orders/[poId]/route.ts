import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import {
  enforcePermission,
  enforcePermissionForCurrentSession,
  toRBACErrorResponse,
} from "@/lib/rbac/access";
import {
  updatePOStatusSchema,
  updatePurchaseOrderSchema,
} from "@/lib/purchases/validation";
import {
  getPurchaseOrderDetail,
  updatePurchaseOrderFlow,
  updatePurchaseOrderStatusFlow,
  PurchaseServiceError,
} from "@/server/services/purchase.service";
import { db } from "@/lib/db/client";
import { stores } from "@/lib/db/schema";
import { safeLogAuditEvent } from "@/server/services/audit.service";
import {
  claimIdempotency,
  getIdempotencyKey,
  hashRequestBody,
  safeMarkIdempotencyFailed,
} from "@/server/services/idempotency.service";
import { createPerfScope } from "@/server/perf/perf";

type RouteParams = { params: Promise<{ poId: string }> };
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["hnd1", "sin1"];

export async function GET(_request: Request, { params }: RouteParams) {
  const perf = createPerfScope("api.stock.purchaseOrderDetail");
  try {
    const [{ storeId }, { poId }] = await Promise.all([
      perf.step(
        "auth.permission",
        () => enforcePermissionForCurrentSession("inventory.view"),
        { kind: "auth", serverTimingName: "auth" },
      ),
      params,
    ]);
    const po = await perf.step(
      "db.purchaseOrderDetail",
      () => getPurchaseOrderDetail(poId, storeId),
      { kind: "db", serverTimingName: "db" },
    );
    const response = await perf.step(
      "response.json",
      () =>
        NextResponse.json(
          { ok: true, purchaseOrder: po, latency: perf.elapsedMs() },
          { headers: NO_STORE_HEADERS },
        ),
      { kind: "logic", serverTimingName: "response" },
    );
    response.headers.set(
      "Server-Timing",
      perf.serverTiming({ includeTotal: true, totalName: "app" }),
    );
    return response;
  } catch (error) {
    if (error instanceof PurchaseServiceError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    return toRBACErrorResponse(error);
  } finally {
    perf.end();
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const action = "po.status.change";

  let auditContext: {
    storeId: string;
    userId: string;
    actorName: string | null;
    actorRole: string | null;
    poId: string;
  } | null = null;
  let idempotencyRecordId: string | null = null;

  try {
    const { session, storeId } = await enforcePermission("inventory.create");
    const { poId } = await params;
    auditContext = {
      storeId,
      userId: session.userId,
      actorName: session.displayName,
      actorRole: session.activeRoleName,
      poId,
    };

    const rawBody = await request.text();
    const idempotencyKey = getIdempotencyKey(request);
    const requestHash = hashRequestBody(rawBody);
    let body: unknown;

    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      if (idempotencyKey) {
        const claim = await claimIdempotency({
          storeId,
          action,
          idempotencyKey,
          requestHash,
          createdBy: session.userId,
        });
        if (claim.kind === "replay") {
          return NextResponse.json(claim.body, { status: claim.statusCode });
        }
        if (claim.kind === "processing") {
          return NextResponse.json({ message: "คำขอนี้กำลังประมวลผลอยู่" }, { status: 409 });
        }
        if (claim.kind === "conflict") {
          return NextResponse.json(
            { message: "Idempotency-Key นี้ถูกใช้กับข้อมูลคำขออื่นแล้ว" },
            { status: 409 },
          );
        }
        idempotencyRecordId = claim.recordId;
        await safeMarkIdempotencyFailed({
          recordId: claim.recordId,
          statusCode: 400,
          body: { message: "รูปแบบ JSON ไม่ถูกต้อง" },
        });
      }
      return NextResponse.json({ message: "รูปแบบ JSON ไม่ถูกต้อง" }, { status: 400 });
    }

    if (idempotencyKey) {
      const claim = await claimIdempotency({
        storeId,
        action,
        idempotencyKey,
        requestHash,
        createdBy: session.userId,
      });
      if (claim.kind === "replay") {
        return NextResponse.json(claim.body, { status: claim.statusCode });
      }
      if (claim.kind === "processing") {
        return NextResponse.json({ message: "คำขอนี้กำลังประมวลผลอยู่" }, { status: 409 });
      }
      if (claim.kind === "conflict") {
        return NextResponse.json(
          { message: "Idempotency-Key นี้ถูกใช้กับข้อมูลคำขออื่นแล้ว" },
          { status: 409 },
        );
      }
      idempotencyRecordId = claim.recordId;
    }

    const parsed = updatePOStatusSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง";
      if (idempotencyRecordId) {
        await safeMarkIdempotencyFailed({
          recordId: idempotencyRecordId,
          statusCode: 400,
          body: { message: firstError },
        });
      }
      await safeLogAuditEvent({
        scope: "STORE",
        storeId,
        actorUserId: session.userId,
        actorName: session.displayName,
        actorRole: session.activeRoleName,
        action,
        entityType: "purchase_order",
        entityId: poId,
        result: "FAIL",
        reasonCode: "VALIDATION_ERROR",
        metadata: {
          issues: parsed.error.issues.map((issue) => issue.path.join(".")).slice(0, 5),
        },
        request,
      });
      return NextResponse.json({ message: firstError }, { status: 400 });
    }

    const po = await updatePurchaseOrderStatusFlow({
      poId,
      storeId,
      userId: session.userId,
      payload: parsed.data,
      audit: {
        actorName: session.displayName,
        actorRole: session.activeRoleName,
        request,
      },
      idempotency: idempotencyRecordId
        ? {
            recordId: idempotencyRecordId,
          }
        : undefined,
    });

    return NextResponse.json({ ok: true, purchaseOrder: po });
  } catch (error) {
    if (error instanceof PurchaseServiceError) {
      if (idempotencyRecordId) {
        await safeMarkIdempotencyFailed({
          recordId: idempotencyRecordId,
          statusCode: error.status,
          body: { message: error.message },
        });
      }
      if (auditContext) {
        await safeLogAuditEvent({
          scope: "STORE",
          storeId: auditContext.storeId,
          actorUserId: auditContext.userId,
          actorName: auditContext.actorName,
          actorRole: auditContext.actorRole,
          action,
          entityType: "purchase_order",
          entityId: auditContext.poId,
          result: "FAIL",
          reasonCode: "BUSINESS_RULE",
          metadata: {
            message: error.message,
          },
          request,
        });
      }
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    if (idempotencyRecordId) {
      await safeMarkIdempotencyFailed({
        recordId: idempotencyRecordId,
        statusCode: 500,
        body: { message: "เกิดข้อผิดพลาดภายในระบบ" },
      });
    }
    if (auditContext) {
      await safeLogAuditEvent({
        scope: "STORE",
        storeId: auditContext.storeId,
        actorUserId: auditContext.userId,
        actorName: auditContext.actorName,
        actorRole: auditContext.actorRole,
        action,
        entityType: "purchase_order",
        entityId: auditContext.poId,
        result: "FAIL",
        reasonCode: "INTERNAL_ERROR",
        metadata: {
          message: error instanceof Error ? error.message : "unknown",
        },
        request,
      });
    }
    return toRBACErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const action = "po.update";

  let auditContext: {
    storeId: string;
    userId: string;
    actorName: string | null;
    actorRole: string | null;
    poId: string;
  } | null = null;
  let idempotencyRecordId: string | null = null;

  try {
    const { session, storeId } = await enforcePermission("inventory.create");
    const { poId } = await params;
    auditContext = {
      storeId,
      userId: session.userId,
      actorName: session.displayName,
      actorRole: session.activeRoleName,
      poId,
    };

    const rawBody = await request.text();
    const idempotencyKey = getIdempotencyKey(request);
    const requestHash = hashRequestBody(rawBody);
    let body: unknown;

    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      if (idempotencyKey) {
        const claim = await claimIdempotency({
          storeId,
          action,
          idempotencyKey,
          requestHash,
          createdBy: session.userId,
        });
        if (claim.kind === "replay") {
          return NextResponse.json(claim.body, { status: claim.statusCode });
        }
        if (claim.kind === "processing") {
          return NextResponse.json({ message: "คำขอนี้กำลังประมวลผลอยู่" }, { status: 409 });
        }
        if (claim.kind === "conflict") {
          return NextResponse.json(
            { message: "Idempotency-Key นี้ถูกใช้กับข้อมูลคำขออื่นแล้ว" },
            { status: 409 },
          );
        }
        idempotencyRecordId = claim.recordId;
        await safeMarkIdempotencyFailed({
          recordId: claim.recordId,
          statusCode: 400,
          body: { message: "รูปแบบ JSON ไม่ถูกต้อง" },
        });
      }
      return NextResponse.json({ message: "รูปแบบ JSON ไม่ถูกต้อง" }, { status: 400 });
    }

    if (idempotencyKey) {
      const claim = await claimIdempotency({
        storeId,
        action,
        idempotencyKey,
        requestHash,
        createdBy: session.userId,
      });
      if (claim.kind === "replay") {
        return NextResponse.json(claim.body, { status: claim.statusCode });
      }
      if (claim.kind === "processing") {
        return NextResponse.json({ message: "คำขอนี้กำลังประมวลผลอยู่" }, { status: 409 });
      }
      if (claim.kind === "conflict") {
        return NextResponse.json(
          { message: "Idempotency-Key นี้ถูกใช้กับข้อมูลคำขออื่นแล้ว" },
          { status: 409 },
        );
      }
      idempotencyRecordId = claim.recordId;
    }

    const parsed = updatePurchaseOrderSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง";
      if (idempotencyRecordId) {
        await safeMarkIdempotencyFailed({
          recordId: idempotencyRecordId,
          statusCode: 400,
          body: { message: firstError },
        });
      }
      await safeLogAuditEvent({
        scope: "STORE",
        storeId,
        actorUserId: session.userId,
        actorName: session.displayName,
        actorRole: session.activeRoleName,
        action,
        entityType: "purchase_order",
        entityId: poId,
        result: "FAIL",
        reasonCode: "VALIDATION_ERROR",
        metadata: {
          issues: parsed.error.issues.map((issue) => issue.path.join(".")).slice(0, 5),
        },
        request,
      });
      return NextResponse.json({ message: firstError }, { status: 400 });
    }

    const [storeRow] = await db
      .select({ currency: stores.currency })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);

    const po = await updatePurchaseOrderFlow({
      poId,
      storeId,
      userId: session.userId,
      storeCurrency: storeRow?.currency ?? "LAK",
      payload: parsed.data,
      audit: {
        actorName: session.displayName,
        actorRole: session.activeRoleName,
        request,
      },
      idempotency: idempotencyRecordId
        ? {
            recordId: idempotencyRecordId,
          }
        : undefined,
    });

    return NextResponse.json({ ok: true, purchaseOrder: po });
  } catch (error) {
    if (error instanceof PurchaseServiceError) {
      if (idempotencyRecordId) {
        await safeMarkIdempotencyFailed({
          recordId: idempotencyRecordId,
          statusCode: error.status,
          body: { message: error.message },
        });
      }
      if (auditContext) {
        await safeLogAuditEvent({
          scope: "STORE",
          storeId: auditContext.storeId,
          actorUserId: auditContext.userId,
          actorName: auditContext.actorName,
          actorRole: auditContext.actorRole,
          action,
          entityType: "purchase_order",
          entityId: auditContext.poId,
          result: "FAIL",
          reasonCode: "BUSINESS_RULE",
          metadata: {
            message: error.message,
          },
          request,
        });
      }
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    if (idempotencyRecordId) {
      await safeMarkIdempotencyFailed({
        recordId: idempotencyRecordId,
        statusCode: 500,
        body: { message: "เกิดข้อผิดพลาดภายในระบบ" },
      });
    }
    if (auditContext) {
      await safeLogAuditEvent({
        scope: "STORE",
        storeId: auditContext.storeId,
        actorUserId: auditContext.userId,
        actorName: auditContext.actorName,
        actorRole: auditContext.actorRole,
        action,
        entityType: "purchase_order",
        entityId: auditContext.poId,
        result: "FAIL",
        reasonCode: "INTERNAL_ERROR",
        metadata: {
          message: error instanceof Error ? error.message : "unknown",
        },
        request,
      });
    }
    return toRBACErrorResponse(error);
  }
}
