import { and, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { getSession } from "@/lib/auth/session";
import { redisDelete, redisGetJson, redisSetJson } from "@/lib/cache/redis";
import { db } from "@/lib/db/client";
import { permissions, rolePermissions, roles, storeMembers } from "@/lib/db/schema";
import { createPerfScope } from "@/server/perf/perf";

export const OWNER_PERMISSION_WILDCARD = "*";

type UserIdentity = string | { id?: string; userId?: string };

export class RBACError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const ROLE_PERMISSION_CACHE_TTL_SECONDS = 60 * 5;
const rolePermissionCacheKey = (roleId: string) => `rbac:role_permission_keys:v1:${roleId}`;

const userIdFromIdentity = (user: UserIdentity) => {
  if (typeof user === "string") {
    return user;
  }

  const userId = user.userId ?? user.id;
  if (!userId) {
    throw new RBACError(400, "ไม่พบรหัสผู้ใช้");
  }

  return userId;
};

async function getMembership(userId: string, storeId: string) {
  const [membership] = await db
    .select({
      roleId: roles.id,
      roleName: roles.name,
      status: storeMembers.status,
    })
    .from(storeMembers)
    .innerJoin(roles, eq(storeMembers.roleId, roles.id))
    .where(
      and(
        eq(storeMembers.storeId, storeId),
        eq(storeMembers.userId, userId),
        eq(storeMembers.status, "ACTIVE"),
      ),
    )
    .limit(1);

  return membership ?? null;
}

const getMembershipForRequest = cache(getMembership);

async function getAllPermissionKeys() {
  const allPermissionRows = await db.select({ key: permissions.key }).from(permissions);
  return allPermissionRows.map((permission) => permission.key);
}

const getAllPermissionKeysCached = unstable_cache(
  async () => getAllPermissionKeys(),
  ["rbac.permissions.keys.v1"],
  { revalidate: 60 * 10 },
);

async function getRolePermissionKeys(roleId: string) {
  const permissionRows = await db
    .select({ key: permissions.key })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, roleId));

  return permissionRows.map((permission) => permission.key);
}

const getRolePermissionKeysForRequest = cache(getRolePermissionKeys);

async function getCachedRolePermissionKeys(roleId: string) {
  const cached = await redisGetJson<string[]>(rolePermissionCacheKey(roleId));
  if (cached && Array.isArray(cached)) {
    return cached;
  }

  const keys = await getRolePermissionKeys(roleId);
  await redisSetJson(rolePermissionCacheKey(roleId), keys, ROLE_PERMISSION_CACHE_TTL_SECONDS);
  return keys;
}

export async function invalidateRolePermissionKeysCache(roleId: string) {
  await redisDelete(rolePermissionCacheKey(roleId));
}

async function getUserPermissionsInternal(
  userId: string,
  storeId: string,
  options?: {
    requestCached?: boolean;
    perf?: ReturnType<typeof createPerfScope>;
  },
) {
  const membership = options?.perf
    ? await options.perf.step(
        "db.membership",
        () =>
          options?.requestCached
            ? getMembershipForRequest(userId, storeId)
            : getMembership(userId, storeId),
        { kind: "db" },
      )
    : options?.requestCached
      ? await getMembershipForRequest(userId, storeId)
      : await getMembership(userId, storeId);

  if (!membership) {
    return [];
  }

  if (membership.roleName === "Owner") {
    const permissionKeys = options?.perf
      ? await options.perf.step(
          "db.ownerPermissionCatalog",
          () =>
            options?.requestCached ? getAllPermissionKeysCached() : getAllPermissionKeys(),
          { kind: "db" },
        )
      : options?.requestCached
        ? await getAllPermissionKeysCached()
        : await getAllPermissionKeys();
    return [OWNER_PERMISSION_WILDCARD, ...new Set(permissionKeys)];
  }

  if (options?.perf) {
    return options.perf.step(
      "db.rolePermissionKeys",
      () =>
        options?.requestCached
          ? getRolePermissionKeysForRequest(membership.roleId)
          : getRolePermissionKeys(membership.roleId),
      { kind: "db" },
    );
  }

  if (options?.requestCached) {
    return getRolePermissionKeysForRequest(membership.roleId);
  }

  return getRolePermissionKeys(membership.roleId);
}

export async function getUserPermissions(user: UserIdentity, storeId: string) {
  const userId = userIdFromIdentity(user);
  return getUserPermissionsInternal(userId, storeId);
}

export const isPermissionGranted = (
  permissionKeys: string[],
  permissionKey: string,
) =>
  permissionKeys.includes(OWNER_PERMISSION_WILDCARD) ||
  permissionKeys.includes(permissionKey);

export async function hasPermission(
  user: UserIdentity,
  storeId: string,
  permissionKey: string,
) {
  const permissionKeys = await getUserPermissions(user, storeId);
  return isPermissionGranted(permissionKeys, permissionKey);
}

export async function getUserPermissionsForCurrentSession() {
  const perf = createPerfScope("auth.permissions.currentSession");

  try {
    const session = await perf.step("auth.session", () => getSession(), {
      kind: "auth",
    });

    if (!session || !session.activeStoreId) {
      return [];
    }

    if (session.activeRoleName === "Owner") {
      const permissionKeys = await perf.step(
        "db.ownerPermissionCatalog",
        () => getAllPermissionKeysCached(),
        { kind: "db" },
      );
      return [OWNER_PERMISSION_WILDCARD, ...new Set(permissionKeys)];
    }

    if (session.activeRoleId) {
      return perf.step(
        "cache.rolePermissionKeys",
        () => getCachedRolePermissionKeys(session.activeRoleId!),
        { kind: "cache" },
      );
    }

    return getUserPermissionsInternal(session.userId, session.activeStoreId, {
      requestCached: true,
      perf,
    });
  } finally {
    perf.end();
  }
}

export async function enforcePermission(
  permissionKey: string,
  options?: { storeId?: string },
) {
  const session = await getSession();

  if (!session) {
    throw new RBACError(401, "กรุณาเข้าสู่ระบบ");
  }

  const storeId = options?.storeId ?? session.activeStoreId;
  if (!storeId) {
    throw new RBACError(400, "ยังไม่ได้เลือกร้านค้า");
  }

  const allowed = await hasPermission({ userId: session.userId }, storeId, permissionKey);
  if (!allowed) {
    throw new RBACError(403, "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
  }

  return {
    session,
    storeId,
  };
}

export async function enforcePermissionForCurrentSession(
  permissionKey: string,
  options?: { storeId?: string },
) {
  const session = await getSession();

  if (!session) {
    throw new RBACError(401, "กรุณาเข้าสู่ระบบ");
  }

  const storeId = options?.storeId ?? session.activeStoreId;
  if (!storeId) {
    throw new RBACError(400, "ยังไม่ได้เลือกร้านค้า");
  }

  if (storeId !== session.activeStoreId) {
    return enforcePermission(permissionKey, options);
  }

  let permissionKeys: string[] = [];

  if (session.activeRoleName === "Owner") {
    permissionKeys = [OWNER_PERMISSION_WILDCARD];
  } else if (session.activeRoleId) {
    permissionKeys = await getCachedRolePermissionKeys(session.activeRoleId);
  } else {
    permissionKeys = await getUserPermissionsInternal(session.userId, storeId, {
      requestCached: true,
    });
  }

  if (!isPermissionGranted(permissionKeys, permissionKey)) {
    throw new RBACError(403, "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
  }

  return {
    session,
    storeId,
  };
}

export const toRBACErrorResponse = (error: unknown) => {
  if (error instanceof RBACError) {
    return Response.json({ message: error.message }, { status: error.status });
  }

  return Response.json({ message: "เกิดข้อผิดพลาดภายในระบบ" }, { status: 500 });
};
