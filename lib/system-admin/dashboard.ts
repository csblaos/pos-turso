import "server-only";

import { and, eq, gte, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { auditEvents, storeMembers, stores, users } from "@/lib/db/schema";

export type SystemAdminDashboardStats = {
  totalClients: number;
  totalStores: number;
  totalUsers: number;
  totalActiveMembers: number;
  totalSuspendedMembers: number;
  totalClientsCanCreateStores: number;
  totalUnlimitedClients: number;
  totalSuspendedClients: number;
  totalMustChangePasswordUsers: number;
  totalAuditEvents24h: number;
};

export async function getSystemAdminDashboardStats(): Promise<SystemAdminDashboardStats> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [
    clientRow,
    storeRow,
    userRow,
    activeMemberRow,
    suspendedMemberRow,
    clientCanCreateRow,
    unlimitedClientRow,
    suspendedClientRow,
    mustChangePasswordRow,
    audit24hRow,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.systemRole, "SUPERADMIN")),
    db.select({ count: sql<number>`count(*)` }).from(stores),
    db.select({ count: sql<number>`count(*)` }).from(users),
    db
      .select({ count: sql<number>`count(*)` })
      .from(storeMembers)
      .where(eq(storeMembers.status, "ACTIVE")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(storeMembers)
      .where(eq(storeMembers.status, "SUSPENDED")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(eq(users.systemRole, "SUPERADMIN"), eq(users.canCreateStores, true)),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          eq(users.systemRole, "SUPERADMIN"),
          eq(users.canCreateStores, true),
          isNull(users.maxStores),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.systemRole, "SUPERADMIN"), eq(users.clientSuspended, true))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.mustChangePassword, true)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditEvents)
      .where(gte(auditEvents.occurredAt, since24h)),
  ]);

  return {
    totalClients: Number(clientRow[0]?.count ?? 0),
    totalStores: Number(storeRow[0]?.count ?? 0),
    totalUsers: Number(userRow[0]?.count ?? 0),
    totalActiveMembers: Number(activeMemberRow[0]?.count ?? 0),
    totalSuspendedMembers: Number(suspendedMemberRow[0]?.count ?? 0),
    totalClientsCanCreateStores: Number(clientCanCreateRow[0]?.count ?? 0),
    totalUnlimitedClients: Number(unlimitedClientRow[0]?.count ?? 0),
    totalSuspendedClients: Number(suspendedClientRow[0]?.count ?? 0),
    totalMustChangePasswordUsers: Number(mustChangePasswordRow[0]?.count ?? 0),
    totalAuditEvents24h: Number(audit24hRow[0]?.count ?? 0),
  };
}
