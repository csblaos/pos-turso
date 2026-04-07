import { LockKeyhole, ShieldCheck } from "lucide-react";

import { and, eq, sql } from "drizzle-orm";

import { SystemSecuritySnapshot } from "@/components/system-admin/system-security-snapshot";
import { getSession } from "@/lib/auth/session";
import { SESSION_TTL_SECONDS } from "@/lib/auth/session-cookie";
import { db } from "@/lib/db/client";
import { auditEvents, users } from "@/lib/db/schema";
import { DEFAULT_UI_LOCALE, uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { getGlobalSessionPolicy } from "@/lib/system-config/policy";
import { toSafeEndpointLabel } from "@/lib/system-admin/safe-display";

type Tone = "ok" | "warn" | "bad" | "neutral";

const toNumber = (value: unknown) => Number(value ?? 0);

function isRedisSessionCheckEnabled() {
  const configured = process.env.AUTH_JWT_REDIS_CHECK?.trim().toLowerCase();
  return configured !== "0" && configured !== "false" && configured !== "off";
}

function getRedisDriverFromEnv(): "upstash" | "local" | "none" {
  const configuredDriver = process.env.REDIS_DRIVER?.trim().toLowerCase();
  if (configuredDriver === "upstash" || configuredDriver === "local" || configuredDriver === "none") {
    return configuredDriver;
  }

  if (process.env.NODE_ENV === "production") {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      return "upstash";
    }
    return "none";
  }

  return "local";
}

export default async function SystemAdminSecurityPage() {
  const session = await getSession();
  const uiLocale = session?.uiLocale ?? DEFAULT_UI_LOCALE;
  const numberLocale = uiLocaleToDateLocale(uiLocale);

  const hasJwtSecret = Boolean(process.env.AUTH_JWT_SECRET?.trim());
  const isProduction = process.env.NODE_ENV === "production";
  const jwtTone: Tone = hasJwtSecret ? "ok" : isProduction ? "bad" : "warn";
  const jwtSecretLabel = hasJwtSecret
    ? t(uiLocale, "systemAdmin.securityPage.jwtSecret.configured")
    : isProduction
      ? t(uiLocale, "systemAdmin.securityPage.jwtSecret.missing")
      : t(uiLocale, "systemAdmin.securityPage.jwtSecret.devFallback");

  const redisCheckEnabled = isRedisSessionCheckEnabled();
  const redisDriver = getRedisDriverFromEnv();
  const redisTarget =
    redisDriver === "upstash"
      ? process.env.UPSTASH_REDIS_REST_URL?.trim() || "fromEnv"
      : redisDriver === "local"
        ? process.env.REDIS_URL ?? "redis://127.0.0.1:6379"
        : "-";
  const safeRedisTarget = toSafeEndpointLabel(redisTarget);

  const globalSessionPolicy = await getGlobalSessionPolicy();

  const [mustChangeRows, suspendedClientRows, auditAggRows] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.mustChangePassword, true)),
    db
      .select({ value: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.systemRole, "SUPERADMIN"), eq(users.clientSuspended, true))),
    db
      .select({
        count24h: sql<number>`sum(case when ${auditEvents.occurredAt} >= ${new Date(
          Date.now() - 24 * 60 * 60 * 1000,
        ).toISOString()} then 1 else 0 end)`,
        lastAt: sql<string | null>`max(${auditEvents.occurredAt})`,
      })
      .from(auditEvents),
  ]);

  const mustChangeTotal = toNumber(mustChangeRows[0]?.value);
  const suspendedClientsTotal = toNumber(suspendedClientRows[0]?.value);
  const audit24hTotal = toNumber(auditAggRows[0]?.count24h);
  const auditLastAtRaw = auditAggRows[0]?.lastAt ?? null;
  const auditLastAt = auditLastAtRaw
    ? new Date(auditLastAtRaw).toLocaleString(numberLocale)
    : "-";

  const sessionsTone: Tone = (() => {
    if (!redisCheckEnabled) return "ok";
    if (redisDriver === "none") return "bad";
    // We do not actively ping Redis here to avoid blocking SSR; treat as "warn" when enforcement is ON.
    return "warn";
  })();

  const accessTone: Tone = suspendedClientsTotal > 0 || mustChangeTotal > 0 ? "warn" : "ok";

  const authCard = {
    titleKey: "systemAdmin.securityPage.card.auth.title",
    helpKey: "systemAdmin.securityPage.help.auth",
    tone: jwtTone,
    rows: [
      {
        labelKey: "systemAdmin.securityPage.field.jwtSecret",
        value: jwtSecretLabel,
        tone: jwtTone,
      },
      {
        labelKey: "systemAdmin.securityPage.field.jwtAlgorithm",
        value: "HS256",
        tone: "neutral" as const,
      },
      {
        labelKey: "systemAdmin.securityPage.field.sessionTtl",
        value: `${Math.round(SESSION_TTL_SECONDS / 60).toLocaleString(numberLocale)} min`,
        tone: "neutral" as const,
      },
    ],
  } as const;

  const sessionsCard = {
    titleKey: "systemAdmin.securityPage.card.sessions.title",
    helpKey: "systemAdmin.securityPage.help.sessions",
    tone: sessionsTone,
    rows: [
      {
        labelKey: "systemAdmin.securityPage.field.redisCheck",
        value: redisCheckEnabled
          ? t(uiLocale, "systemAdmin.securityPage.redisCheck.on")
          : t(uiLocale, "systemAdmin.securityPage.redisCheck.off"),
        tone: redisCheckEnabled ? sessionsTone : "ok",
      },
      {
        labelKey: "systemAdmin.securityPage.field.redisDriver",
        value: redisDriver,
        tone: redisDriver === "none" ? "bad" : redisCheckEnabled ? "warn" : "neutral",
      },
      {
        labelKey: "systemAdmin.securityPage.field.redisTarget",
        value: safeRedisTarget,
        tone: redisDriver === "none" ? "bad" : "neutral",
      },
      {
        labelKey: "systemAdmin.securityPage.field.defaultSessionLimit",
        value: String(globalSessionPolicy.defaultSessionLimit),
        tone: "neutral" as const,
      },
    ],
  } as const;

  const accessCard = {
    titleKey: "systemAdmin.securityPage.card.access.title",
    helpKey: "systemAdmin.securityPage.help.access",
    tone: accessTone,
    rows: [
      {
        labelKey: "systemAdmin.securityPage.field.suspendedClients",
        value: suspendedClientsTotal.toLocaleString(numberLocale),
        tone: suspendedClientsTotal > 0 ? "warn" : "ok",
      },
      {
        labelKey: "systemAdmin.securityPage.field.mustChangePassword",
        value: mustChangeTotal.toLocaleString(numberLocale),
        tone: mustChangeTotal > 0 ? "warn" : "ok",
      },
      {
        labelKey: "systemAdmin.securityPage.field.audit24h",
        value: audit24hTotal.toLocaleString(numberLocale),
        tone: audit24hTotal === 0 ? "warn" : "ok",
      },
      {
        labelKey: "systemAdmin.securityPage.field.auditLastAt",
        value: auditLastAt,
        tone: auditLastAtRaw ? "neutral" : "warn",
      },
    ],
  } as const;

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t(uiLocale, "systemAdmin.workspaceBadge")}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
            <LockKeyhole className="h-3.5 w-3.5" />
            {t(uiLocale, "systemAdmin.securityPage.title")}
          </div>
        </div>
      </header>

      <SystemSecuritySnapshot authCard={authCard} sessionsCard={sessionsCard} accessCard={accessCard} />
    </section>
  );
}
