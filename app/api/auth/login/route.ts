import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { alias } from "drizzle-orm/sqlite-core";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { buildSessionForUser, getUserMembershipFlags } from "@/lib/auth/session-db";
import { createSessionCookie, SessionStoreUnavailableError } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { roles, storeMembers, users } from "@/lib/db/schema";
import { UI_LOCALE_COOKIE_NAME, uiLocaleCookieOptions } from "@/lib/i18n/ui-locale-cookie";
import { getUserPermissions } from "@/lib/rbac/access";
import { getStorefrontEntryRoute } from "@/lib/storefront/routing";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  newPassword: z.string().min(8).max(128).optional(),
});

type BlockedAccountStatus = "INVITED" | "SUSPENDED" | "NO_ACTIVE_STORE" | "CLIENT_SUSPENDED";

const toAccountStatusRoute = (status: BlockedAccountStatus) =>
  `/account-status?status=${status}`;

const blockedLoginResponse = (status: BlockedAccountStatus, message: string) =>
  NextResponse.json({
    ok: true,
    blocked: true,
    accountStatus: status,
    message,
    next: toAccountStatusRoute(status),
  });

export async function POST(request: Request) {
  const payload = loginSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ message: "ข้อมูลเข้าสู่ระบบไม่ถูกต้อง" }, { status: 400 });
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      uiLocale: users.uiLocale,
      passwordHash: users.passwordHash,
      mustChangePassword: users.mustChangePassword,
      systemRole: users.systemRole,
      clientSuspended: users.clientSuspended,
    })
    .from(users)
    .where(eq(users.email, payload.data.email.toLowerCase()))
    .limit(1);

  if (!user) {
    return NextResponse.json({ message: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });
  }

  const isValid = await verifyPassword(payload.data.password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  const canAccessOnboarding = user.systemRole === "SUPERADMIN";
  const canAccessSystemAdmin = user.systemRole === "SYSTEM_ADMIN";

  // Client suspension: blocks SUPERADMIN itself and all users in stores owned by suspended SUPERADMIN.
  if (!canAccessSystemAdmin) {
    const isSuperadminSuspended = user.systemRole === "SUPERADMIN" && user.clientSuspended === true;
    let isClientSuspended = isSuperadminSuspended;

    if (!isClientSuspended && user.systemRole !== "SUPERADMIN") {
      const memberRows = await db
        .select({ storeId: storeMembers.storeId })
        .from(storeMembers)
        .where(eq(storeMembers.userId, user.id));

      const storeIds = [...new Set(memberRows.map((row) => row.storeId))];
      if (storeIds.length > 0) {
        const ownerMembers = alias(storeMembers, "owner_members");
        const ownerRoles = alias(roles, "owner_roles");
        const ownerUsers = alias(users, "owner_users");

        const rows = await db
          .select({ ownerId: ownerUsers.id })
          .from(ownerMembers)
          .innerJoin(
            ownerRoles,
            and(
              eq(ownerMembers.roleId, ownerRoles.id),
              eq(ownerMembers.storeId, ownerRoles.storeId),
            ),
          )
          .innerJoin(ownerUsers, eq(ownerMembers.userId, ownerUsers.id))
          .where(
            and(
              inArray(ownerMembers.storeId, storeIds),
              eq(ownerRoles.name, "Owner"),
              eq(ownerUsers.systemRole, "SUPERADMIN"),
              eq(ownerUsers.clientSuspended, true),
            ),
          )
          .limit(1);

        isClientSuspended = rows.length > 0;
      }
    }

    if (isClientSuspended) {
      return blockedLoginResponse(
        "CLIENT_SUSPENDED",
        "บัญชีของคุณถูกระงับโดยผู้ดูแลระบบกลาง กรุณาติดต่อทีมงานผู้ดูแลระบบ",
      );
    }
  }

  if (user.mustChangePassword) {
    const nextPassword = payload.data.newPassword?.trim();
    if (!nextPassword) {
      return NextResponse.json({
        ok: false,
        requiresPasswordChange: true,
        email: user.email,
        message: "บัญชีนี้ต้องเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน",
      });
    }

    const isSamePassword = await verifyPassword(nextPassword, user.passwordHash);
    if (isSamePassword) {
      return NextResponse.json(
        { message: "รหัสผ่านใหม่ต้องไม่ซ้ำรหัสผ่านเดิม" },
        { status: 400 },
      );
    }

    const nextPasswordHash = await hashPassword(nextPassword);
    await db
      .update(users)
      .set({
        passwordHash: nextPasswordHash,
        mustChangePassword: false,
        passwordUpdatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(users.id, user.id));
  }

  const [membershipFlags, session] = await Promise.all([
    getUserMembershipFlags(user.id),
    buildSessionForUser({
      id: user.id,
      email: user.email,
      name: user.name,
      uiLocale: user.uiLocale,
    }),
  ]);

  if (membershipFlags.hasSuspendedMembership && !membershipFlags.hasActiveMembership) {
    return blockedLoginResponse(
      "SUSPENDED",
      "บัญชีของคุณอยู่สถานะ SUSPENDED (ถูกระงับการใช้งาน) กรุณาติดต่อแอดมินร้าน",
    );
  }

  if (
    membershipFlags.hasInvitedMembership &&
    !membershipFlags.hasActiveMembership &&
    !canAccessOnboarding &&
    !canAccessSystemAdmin
  ) {
    return blockedLoginResponse(
      "INVITED",
      "บัญชีของคุณอยู่สถานะ INVITED (รอเปิดใช้งาน) กรุณาติดต่อแอดมินร้าน",
    );
  }

  if (!membershipFlags.hasActiveMembership && !canAccessOnboarding && !canAccessSystemAdmin) {
    return blockedLoginResponse(
      "NO_ACTIVE_STORE",
      "บัญชีนี้ยังไม่มีสิทธิ์เข้าใช้งานระบบ กรุณาติดต่อแอดมินร้าน",
    );
  }

  let sessionCookie;
  try {
    const sessionCookiePromise = createSessionCookie(session);

    let nextRoute = "/onboarding";
    if (canAccessSystemAdmin) {
      nextRoute = "/system-admin";
    } else if (session.hasStoreMembership && session.activeStoreId) {
      if (session.activeStoreType === "ONLINE_RETAIL") {
        const permissionKeys = await getUserPermissions(
          { userId: session.userId },
          session.activeStoreId,
        );
        nextRoute = getStorefrontEntryRoute(session.activeStoreType, permissionKeys);
      } else {
        nextRoute = "/dashboard";
      }
    }

    sessionCookie = await sessionCookiePromise;

    const response = NextResponse.json({
      ok: true,
      token: sessionCookie.value,
      next: nextRoute,
    });

    response.cookies.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.options,
    );
    response.cookies.set(UI_LOCALE_COOKIE_NAME, user.uiLocale, uiLocaleCookieOptions);

    return response;
  } catch (error) {
    if (error instanceof SessionStoreUnavailableError) {
      return NextResponse.json(
        { message: "ระบบเซสชันไม่พร้อมใช้งาน กรุณาลองอีกครั้ง" },
        { status: 503 },
      );
    }
    throw error;
  }
}
