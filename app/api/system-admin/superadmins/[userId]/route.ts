import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { alias } from "drizzle-orm/sqlite-core";

import {
  enforceSystemAdminSession,
  toSystemAdminErrorResponse,
} from "@/lib/auth/system-admin";
import { invalidateUserSessions } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { roles, storeMembers, users } from "@/lib/db/schema";

const updateSuperadminSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_store_creation_config"),
    canCreateStores: z.boolean(),
    maxStores: z.number().int().min(1).max(100).nullable(),
    canCreateBranches: z.boolean().nullable(),
    maxBranchesPerStore: z.number().int().min(0).max(500).nullable(),
  }),
  z.object({
    action: z.literal("set_client_suspension"),
    suspended: z.boolean(),
    reason: z.string().trim().max(300).nullable().optional(),
  }),
]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const { session } = await enforceSystemAdminSession();

    const { userId } = await context.params;
    const payload = updateSuperadminSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }

    const [targetUser] = await db
      .select({
        id: users.id,
        systemRole: users.systemRole,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json({ message: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });
    }

    if (targetUser.systemRole !== "SUPERADMIN") {
      return NextResponse.json(
        { message: "อนุญาตแก้ไขเฉพาะบัญชี SUPERADMIN" },
        { status: 400 },
      );
    }

    if (payload.data.action === "set_store_creation_config") {
      await db
        .update(users)
        .set({
          canCreateStores: payload.data.canCreateStores,
          maxStores: payload.data.canCreateStores ? payload.data.maxStores : null,
          canCreateBranches: payload.data.canCreateBranches,
          maxBranchesPerStore:
            payload.data.canCreateBranches === false ? null : payload.data.maxBranchesPerStore,
        })
        .where(eq(users.id, userId));

      return NextResponse.json({ ok: true });
    }

    const suspended = payload.data.suspended === true;
    const reason = payload.data.reason?.trim() ? payload.data.reason.trim() : null;

    await db
      .update(users)
      .set(
        suspended
          ? {
              clientSuspended: true,
              clientSuspendedAt: sql`CURRENT_TIMESTAMP`,
              clientSuspendedReason: reason,
              clientSuspendedBy: session.userId,
            }
          : {
              clientSuspended: false,
              clientSuspendedAt: null,
              clientSuspendedReason: null,
              clientSuspendedBy: null,
            },
      )
      .where(eq(users.id, userId));

    // Best-effort revoke: kick SUPERADMIN and all users in stores where this SUPERADMIN is Owner.
    if (suspended) {
      const ownerMembers = alias(storeMembers, "owner_members");
      const ownerRoles = alias(roles, "owner_roles");

      const ownedStoreRows = await db
        .select({ storeId: ownerMembers.storeId })
        .from(ownerMembers)
        .innerJoin(
          ownerRoles,
          and(eq(ownerMembers.roleId, ownerRoles.id), eq(ownerMembers.storeId, ownerRoles.storeId)),
        )
        .where(and(eq(ownerMembers.userId, userId), eq(ownerRoles.name, "Owner")));

      const storeIds = [...new Set(ownedStoreRows.map((row) => row.storeId))];
      const memberIds = storeIds.length
        ? await db
            .select({ userId: storeMembers.userId })
            .from(storeMembers)
            .where(inArray(storeMembers.storeId, storeIds))
        : [];

      const userIdsToRevoke = [...new Set([userId, ...memberIds.map((row) => row.userId)])];
      await Promise.all(
        userIdsToRevoke.map(async (targetId) => {
          try {
            await invalidateUserSessions(targetId);
          } catch (error) {
            console.warn("[system-admin] invalidateUserSessions failed", targetId, error);
          }
        }),
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toSystemAdminErrorResponse(error);
  }
}
