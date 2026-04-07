import { Activity, ShieldCheck } from "lucide-react";
import { isNotNull, sql } from "drizzle-orm";

import { SystemMonitoringSnapshot } from "@/components/system-admin/system-monitoring-snapshot";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import {
  fbConnections,
  orders,
  products,
  storePaymentAccounts,
  stores,
  waConnections,
} from "@/lib/db/schema";
import { DEFAULT_UI_LOCALE, uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { toSafeEndpointLabel } from "@/lib/system-admin/safe-display";

type Tone = "ok" | "warn" | "bad" | "neutral";

const toNumber = (value: unknown) => Number(value ?? 0);

type MonitoringSnapshotCard = {
  titleKey: MessageKey;
  helpKey: MessageKey;
  tone: Tone;
  rows: Array<{ labelKey: MessageKey; value: string; tone?: Tone }>;
};

function getR2ConfigFromEnv() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucket = process.env.R2_BUCKET?.trim() ?? "";
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim() ?? "";

  const missingKeys: string[] = [];
  if (!accountId) missingKeys.push("R2_ACCOUNT_ID");
  if (!accessKeyId) missingKeys.push("R2_ACCESS_KEY_ID");
  if (!secretAccessKey) missingKeys.push("R2_SECRET_ACCESS_KEY");
  if (!bucket) missingKeys.push("R2_BUCKET");

  const logoPrefix = process.env.R2_STORE_LOGO_PREFIX?.trim() || "store-logos";
  const paymentQrPrefix = process.env.R2_PAYMENT_QR_PREFIX?.trim() || "store-payment-qrs";
  const shippingLabelPrefix =
    process.env.R2_ORDER_SHIPPING_LABEL_PREFIX?.trim() || "order-shipping-labels";
  const productImagePrefix = process.env.R2_PRODUCT_IMAGE_PREFIX?.trim() || "product-images";

  const configured = missingKeys.length === 0;
  const endpoint = accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "-";

  return {
    configured,
    missingKeys,
    bucket,
    endpoint,
    publicBaseUrl: publicBaseUrl || "-",
    prefixes: {
      logoPrefix,
      paymentQrPrefix,
      shippingLabelPrefix,
      productImagePrefix,
    },
  };
}

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

function getDatabaseUrl() {
  const useLocalDbInDev =
    process.env.NODE_ENV === "development" && process.env.DEV_USE_LOCAL_DB === "1";

  return useLocalDbInDev
    ? process.env.DEV_DATABASE_URL ?? "file:./local.db"
    : process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./local.db";
}

function getDatabaseMode(databaseUrl: string) {
  return databaseUrl.startsWith("file:") ? "local" : "turso";
}

function getDatabaseTarget(databaseUrl: string) {
  if (databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }

  try {
    const parsed = new URL(databaseUrl);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return databaseUrl;
  }
}

export const dynamic = "force-dynamic";

export default async function SystemAdminMonitoringPage() {
  const session = await getSession();
  const uiLocale = session?.uiLocale ?? DEFAULT_UI_LOCALE;
  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const isProduction = process.env.NODE_ENV === "production";

  const databaseUrl = getDatabaseUrl();
  const dbMode = getDatabaseMode(databaseUrl);
  const dbTarget = getDatabaseTarget(databaseUrl);
  const safeDbTarget = toSafeEndpointLabel(dbTarget);

  let dbProbeOk = true;
  let dbProbeError: string | null = null;
  try {
    await db
      .select({ ok: sql<number>`1` })
      .from(sql`(select 1) as probe`)
      .limit(1);
  } catch (error) {
    dbProbeOk = false;
    dbProbeError = error instanceof Error ? error.message : "unknown error";
  }

  const redisCheckEnabled = isRedisSessionCheckEnabled();
  const redisDriver = getRedisDriverFromEnv();
  const redisTarget =
    redisDriver === "upstash"
      ? process.env.UPSTASH_REDIS_REST_URL?.trim() || "fromEnv"
      : redisDriver === "local"
        ? process.env.REDIS_URL ?? "redis://127.0.0.1:6379"
        : "-";
  const safeRedisTarget = toSafeEndpointLabel(redisTarget);

  const cacheTone: Tone = (() => {
    if (!redisCheckEnabled) return "ok";
    if (redisDriver === "none") return "bad";
    // Do not ping Redis on SSR; treat as "warn" when enforcement is ON.
    return "warn";
  })();

  const [
    storesAgg,
    fbAgg,
    waAgg,
    storesWithLogoAgg,
    paymentQrAgg,
    productImageAgg,
    shippingLabelAgg,
  ] = await Promise.all([
    db.select({ value: sql<number>`count(*)` }).from(stores),
    db
      .select({
        connected: sql<number>`sum(case when ${fbConnections.status} = 'CONNECTED' then 1 else 0 end)`,
        error: sql<number>`sum(case when ${fbConnections.status} = 'ERROR' then 1 else 0 end)`,
        lastAt: sql<string | null>`max(${fbConnections.connectedAt})`,
      })
      .from(fbConnections),
    db
      .select({
        connected: sql<number>`sum(case when ${waConnections.status} = 'CONNECTED' then 1 else 0 end)`,
        error: sql<number>`sum(case when ${waConnections.status} = 'ERROR' then 1 else 0 end)`,
        lastAt: sql<string | null>`max(${waConnections.connectedAt})`,
      })
      .from(waConnections),
    db.select({ value: sql<number>`count(*)` }).from(stores).where(isNotNull(stores.logoUrl)),
    db
      .select({ value: sql<number>`count(*)` })
      .from(storePaymentAccounts)
      .where(isNotNull(storePaymentAccounts.qrImageUrl)),
    db.select({ value: sql<number>`count(*)` }).from(products).where(isNotNull(products.imageUrl)),
    db.select({ value: sql<number>`count(*)` }).from(orders).where(isNotNull(orders.shippingLabelUrl)),
  ]);

  const storesTotal = toNumber(storesAgg[0]?.value);

  const fbConnected = toNumber(fbAgg[0]?.connected);
  const fbError = toNumber(fbAgg[0]?.error);
  const fbLastAtRaw = fbAgg[0]?.lastAt ?? null;
  const fbLastAt = fbLastAtRaw ? new Date(fbLastAtRaw).toLocaleString(numberLocale) : "-";

  const waConnected = toNumber(waAgg[0]?.connected);
  const waError = toNumber(waAgg[0]?.error);
  const waLastAtRaw = waAgg[0]?.lastAt ?? null;
  const waLastAt = waLastAtRaw ? new Date(waLastAtRaw).toLocaleString(numberLocale) : "-";

  const messagingTone: Tone = fbError > 0 || waError > 0 ? "warn" : "ok";

  const databaseRows: MonitoringSnapshotCard["rows"] = [
    {
      labelKey: "systemAdmin.monitoringPage.field.dbMode",
      value: dbMode,
      tone: "neutral",
    },
    {
      labelKey: "systemAdmin.monitoringPage.field.dbTarget",
      value: safeDbTarget,
      tone: "neutral",
    },
    {
      labelKey: "systemAdmin.monitoringPage.field.dbHealth",
      value: dbProbeOk
        ? t(uiLocale, "systemAdmin.monitoringPage.dbHealth.ok")
        : t(uiLocale, "systemAdmin.monitoringPage.dbHealth.fail"),
      tone: dbProbeOk ? "ok" : "bad",
    },
  ];

  if (!dbProbeOk) {
    databaseRows.push({
      labelKey: "systemAdmin.monitoringPage.field.dbError",
      value: dbProbeError ?? "-",
      tone: "bad",
    });
  }

  const databaseCard: MonitoringSnapshotCard = {
    titleKey: "systemAdmin.monitoringPage.card.database.title",
    helpKey: "systemAdmin.monitoringPage.help.database",
    tone: dbProbeOk ? "ok" : "bad",
    rows: databaseRows,
  };

  const cacheCard: MonitoringSnapshotCard = {
    titleKey: "systemAdmin.monitoringPage.card.cache.title",
    helpKey: "systemAdmin.monitoringPage.help.cache",
    tone: cacheTone,
    rows: [
      {
        labelKey: "systemAdmin.monitoringPage.field.redisCheck",
        value: redisCheckEnabled
          ? t(uiLocale, "systemAdmin.securityPage.redisCheck.on")
          : t(uiLocale, "systemAdmin.securityPage.redisCheck.off"),
        tone: redisCheckEnabled ? cacheTone : "ok",
      },
      {
        labelKey: "systemAdmin.monitoringPage.field.redisDriver",
        value: redisDriver,
        tone: redisDriver === "none" ? "bad" : redisCheckEnabled ? "warn" : "neutral",
      },
      {
        labelKey: "systemAdmin.monitoringPage.field.redisTarget",
        value: safeRedisTarget,
        tone: redisDriver === "none" ? "bad" : "neutral",
      },
    ],
  };

  const messagingCard: MonitoringSnapshotCard = {
    titleKey: "systemAdmin.monitoringPage.card.messaging.title",
    helpKey: "systemAdmin.monitoringPage.help.messaging",
    tone: messagingTone,
    rows: [
      {
        labelKey: "systemAdmin.monitoringPage.field.totalStores",
        value: storesTotal.toLocaleString(numberLocale),
        tone: "neutral",
      },
      {
        labelKey: "systemAdmin.monitoringPage.field.fbConnected",
        value: fbConnected.toLocaleString(numberLocale),
        tone: fbError > 0 ? "warn" : "ok",
      },
      {
        labelKey: "systemAdmin.monitoringPage.field.waConnected",
        value: waConnected.toLocaleString(numberLocale),
        tone: waError > 0 ? "warn" : "ok",
      },
      {
        labelKey: "systemAdmin.monitoringPage.field.channelsLastAt",
        value: [fbLastAt, waLastAt].filter(Boolean).join(" / "),
        tone: "neutral",
      },
    ],
  };

  const r2 = getR2ConfigFromEnv();
  const r2Tone: Tone = (() => {
    if (r2.configured) {
      if (r2.publicBaseUrl === "-") return isProduction ? "warn" : "neutral";
      return "ok";
    }
    return isProduction ? "bad" : "warn";
  })();

  const storesWithLogoTotal = toNumber(storesWithLogoAgg[0]?.value);
  const paymentQrTotal = toNumber(paymentQrAgg[0]?.value);
  const productImageTotal = toNumber(productImageAgg[0]?.value);
  const shippingLabelTotal = toNumber(shippingLabelAgg[0]?.value);

  const r2AssetsSummary = [
    `${t(uiLocale, "systemAdmin.monitoringPage.r2Assets.logo")} ${storesWithLogoTotal.toLocaleString(numberLocale)}`,
    `${t(uiLocale, "systemAdmin.monitoringPage.r2Assets.qr")} ${paymentQrTotal.toLocaleString(numberLocale)}`,
    `${t(uiLocale, "systemAdmin.monitoringPage.r2Assets.product")} ${productImageTotal.toLocaleString(numberLocale)}`,
    `${t(uiLocale, "systemAdmin.monitoringPage.r2Assets.label")} ${shippingLabelTotal.toLocaleString(numberLocale)}`,
  ].join(" • ");

  const r2PrefixesSummary = [
    `logo:${r2.prefixes.logoPrefix}`,
    `qr:${r2.prefixes.paymentQrPrefix}`,
    `label:${r2.prefixes.shippingLabelPrefix}`,
    `product:${r2.prefixes.productImagePrefix}`,
  ].join(" • ");

  const storageRows: MonitoringSnapshotCard["rows"] = [
    {
      labelKey: "systemAdmin.monitoringPage.field.r2Status",
      value: r2.configured
        ? t(uiLocale, "systemAdmin.monitoringPage.r2Status.enabled")
        : t(uiLocale, "systemAdmin.monitoringPage.r2Status.disabled"),
      tone: r2.configured ? "ok" : r2Tone,
    },
    {
      labelKey: "systemAdmin.monitoringPage.field.r2Bucket",
      value: r2.bucket || "-",
      tone: r2.configured ? "neutral" : r2Tone,
    },
    {
      labelKey: "systemAdmin.monitoringPage.field.r2Endpoint",
      value: toSafeEndpointLabel(r2.endpoint),
      tone: "neutral",
    },
    {
      labelKey: "systemAdmin.monitoringPage.field.r2PublicBaseUrl",
      value: r2.publicBaseUrl === "-" ? "-" : toSafeEndpointLabel(r2.publicBaseUrl),
      tone: r2.publicBaseUrl === "-" ? r2Tone : "neutral",
    },
  ];

  if (!r2.configured) {
    storageRows.push({
      labelKey: "systemAdmin.monitoringPage.field.r2Missing",
      value: r2.missingKeys.join(", "),
      tone: r2Tone,
    });
  } else {
    storageRows.push({
      labelKey: "systemAdmin.monitoringPage.field.r2Prefixes",
      value: r2PrefixesSummary,
      tone: "neutral",
    });
    storageRows.push({
      labelKey: "systemAdmin.monitoringPage.field.r2Assets",
      value: r2AssetsSummary,
      tone: "neutral",
    });
  }

  const storageCard: MonitoringSnapshotCard = {
    titleKey: "systemAdmin.monitoringPage.card.storage.title",
    helpKey: "systemAdmin.monitoringPage.help.storage",
    tone: r2Tone,
    rows: storageRows,
  };

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t(uiLocale, "systemAdmin.workspaceBadge")}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
            <Activity className="h-3.5 w-3.5" />
            {t(uiLocale, "systemAdmin.monitoringPage.title")}
          </div>
        </div>
      </header>

      <SystemMonitoringSnapshot
        databaseCard={databaseCard}
        cacheCard={cacheCard}
        messagingCard={messagingCard}
        storageCard={storageCard}
      />
    </section>
  );
}
