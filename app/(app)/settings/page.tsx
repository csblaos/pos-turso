import Link from "next/link";
import { eq } from "drizzle-orm";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Globe,
  Lock,
  Package,
  PackageCheck,
  PlugZap,
  Settings2,
  Shield,
  Store,
  Tags,
  Truck,
  UserRound,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { LogoutButton } from "@/components/app/logout-button";
import { getSession } from "@/lib/auth/session";
import { getUserSystemRole } from "@/lib/auth/system-admin";
import { db } from "@/lib/db/client";
import { fbConnections, stores, waConnections } from "@/lib/db/schema";
import { DEFAULT_UI_LOCALE, type UiLocale } from "@/lib/i18n/locales";
import { type MessageKey, t } from "@/lib/i18n/messages";
import {
  getUserPermissionsForCurrentSession,
  isPermissionGranted,
} from "@/lib/rbac/access";
import { buildUserCapabilities } from "@/lib/settings/account-capabilities";

const storeTypeLabels = {
  ONLINE_RETAIL: "Online POS",
  RESTAURANT: "Restaurant POS",
  CAFE: "Cafe POS",
  OTHER: "Other POS",
} as const;

type ChannelStatus = "DISCONNECTED" | "CONNECTED" | "ERROR";

type SettingsLinkItem = {
  id: string;
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  visible: boolean;
  badgeText?: string;
};

function ChannelStatusPill({ status, uiLocale }: { status: ChannelStatus; uiLocale: UiLocale }) {
  const toneClassName =
    status === "CONNECTED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "ERROR"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClassName}`}
    >
      {t(uiLocale, `settings.channelStatus.${status}` as MessageKey)}
    </span>
  );
}

function SettingsLinkRow({
  href,
  title,
  description,
  icon: Icon,
  badgeText,
}: Omit<SettingsLinkItem, "id" | "visible">) {
  return (
    <Link
      href={href}
      className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{description}</span>
      </span>
      {badgeText ? (
        <span className="inline-flex shrink-0 items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-blue-700">
          {badgeText}
        </span>
      ) : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export default async function SettingsPage() {
  const [session, permissionKeys] = await Promise.all([
    getSession(),
    getUserPermissionsForCurrentSession(),
  ]);
  const uiLocale = session?.uiLocale ?? DEFAULT_UI_LOCALE;
  const systemRole = session ? await getUserSystemRole(session.userId) : "USER";
  const isSuperadmin = systemRole === "SUPERADMIN";
  const canViewSettings = isPermissionGranted(permissionKeys, "settings.view");
  const canViewUsers = isPermissionGranted(permissionKeys, "members.view");
  const canViewRoles = isPermissionGranted(permissionKeys, "rbac.roles.view");
  const canViewUnits = isPermissionGranted(permissionKeys, "units.view");
  const canViewProducts = isPermissionGranted(permissionKeys, "products.view");
  const canViewReports = isPermissionGranted(permissionKeys, "reports.view");
  const canViewConnections = isPermissionGranted(permissionKeys, "connections.view");
  const canUpdateSettings = isPermissionGranted(permissionKeys, "settings.update");
  const userCapabilities = buildUserCapabilities(permissionKeys, uiLocale);
  const grantedCapabilitiesCount = userCapabilities.filter((capability) => capability.granted).length;

  if (!canViewSettings) {
    return (
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">{t(uiLocale, "settings.page.title")}</h1>
        <p className="text-sm text-red-600">{t(uiLocale, "settings.page.noAccess")}</p>
      </section>
    );
  }

  const activeStoreId = session?.activeStoreId ?? null;

  const [storeSummary, fbConnection, waConnection] = activeStoreId
    ? await Promise.all([
        db
          .select({
            name: stores.name,
            storeType: stores.storeType,
            currency: stores.currency,
            address: stores.address,
            phoneNumber: stores.phoneNumber,
          })
          .from(stores)
          .where(eq(stores.id, activeStoreId))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        canViewConnections
          ? db
              .select({
                status: fbConnections.status,
                pageName: fbConnections.pageName,
              })
              .from(fbConnections)
              .where(eq(fbConnections.storeId, activeStoreId))
              .limit(1)
              .then((rows) => rows[0] ?? null)
          : Promise.resolve(null),
        canViewConnections
          ? db
              .select({
                status: waConnections.status,
                phoneNumber: waConnections.phoneNumber,
              })
              .from(waConnections)
              .where(eq(waConnections.storeId, activeStoreId))
              .limit(1)
              .then((rows) => rows[0] ?? null)
          : Promise.resolve(null),
      ])
    : [null, null, null];

  const fbStatus: ChannelStatus = fbConnection?.status ?? "DISCONNECTED";
  const waStatus: ChannelStatus = waConnection?.status ?? "DISCONNECTED";

  const formatGrantedCapabilities = (count: number) => {
    if (uiLocale === "en") {
      return `${count.toLocaleString("en-US")} items`;
    }

    if (uiLocale === "lo") {
      return `ໃຊ້ໄດ້ ${count.toLocaleString("lo-LA")} ລາຍການ`;
    }

    return `ใช้งานได้ ${count.toLocaleString("th-TH")} รายการ`;
  };

  const managementLinks: SettingsLinkItem[] = [
    {
      id: "store-profile",
      href: "/settings/store",
      title: t(uiLocale, "settings.link.storeProfile.title"),
      description: t(uiLocale, "settings.link.storeProfile.description"),
      icon: Store,
      visible: true,
    },
    {
      id: "switch-store",
      href: "/settings/stores",
      title: t(uiLocale, "settings.link.switchStore.title"),
      description: t(uiLocale, "settings.link.switchStore.description"),
      icon: Settings2,
      visible: true,
    },
    {
      id: "payment-accounts",
      href: "/settings/store/payments",
      title: t(uiLocale, "settings.link.paymentAccounts.title"),
      description: t(uiLocale, "settings.link.paymentAccounts.description"),
      icon: WalletCards,
      visible: true,
    },
    {
      id: "shipping-providers",
      href: "/settings/store/shipping-providers",
      title: t(uiLocale, "settings.link.shippingProviders.title"),
      description: t(uiLocale, "settings.link.shippingProviders.description"),
      icon: Truck,
      visible: true,
    },
    {
      id: "pdf-settings",
      href: "/settings/pdf",
      title: t(uiLocale, "settings.link.pdfSettings.title"),
      description: t(uiLocale, "settings.link.pdfSettings.description"),
      icon: FileText,
      visible: true,
    },
    {
      id: "audit-log",
      href: "/settings/audit-log",
      title: t(uiLocale, "settings.link.auditLog.title"),
      description: t(uiLocale, "settings.link.auditLog.description"),
      icon: ClipboardList,
      visible: true,
    },
    {
      id: "users",
      href: "/settings/users",
      title: t(uiLocale, "settings.link.users.title"),
      description: t(uiLocale, "settings.link.users.description"),
      icon: Users,
      visible: canViewUsers,
    },
    {
      id: "roles",
      href: "/settings/roles",
      title: t(uiLocale, "settings.link.roles.title"),
      description: t(uiLocale, "settings.link.roles.description"),
      icon: Shield,
      visible: canViewRoles,
    },
    {
      id: "reports",
      href: "/reports",
      title: t(uiLocale, "settings.link.reports.title"),
      description: t(uiLocale, "settings.link.reports.description"),
      icon: PlugZap,
      visible: canViewReports,
    },
  ];

  const productSettingsLinks: SettingsLinkItem[] = [
    {
      id: "categories",
      href: "/settings/categories",
      title: t(uiLocale, "settings.link.categories.title"),
      description: t(uiLocale, "settings.link.categories.description"),
      icon: Tags,
      visible: canViewProducts,
    },
    {
      id: "stock-thresholds",
      href: "/settings/stock",
      title: t(uiLocale, "settings.link.stockThresholds.title"),
      description: t(uiLocale, "settings.link.stockThresholds.description"),
      icon: PackageCheck,
      visible: canViewProducts,
    },
    {
      id: "units",
      href: "/settings/units",
      title: t(uiLocale, "settings.link.units.title"),
      description: t(uiLocale, "settings.link.units.description"),
      icon: Package,
      visible: canViewUnits,
    },
  ];

  const accountLinks: SettingsLinkItem[] = [
    {
      id: "account-profile",
      href: "/settings/profile",
      title: t(uiLocale, "settings.link.accountProfile.title"),
      description: t(uiLocale, "settings.link.accountProfile.description"),
      icon: UserRound,
      visible: true,
    },
    {
      id: "account-language",
      href: "/settings/language",
      title: t(uiLocale, "settings.link.accountLanguage.title"),
      description: t(uiLocale, "settings.link.accountLanguage.description"),
      icon: Globe,
      visible: true,
    },
    {
      id: "account-permissions",
      href: "/settings/permissions",
      title: t(uiLocale, "settings.link.accountPermissions.title"),
      description: formatGrantedCapabilities(grantedCapabilitiesCount),
      icon: CheckCircle2,
      visible: true,
    },
    {
      id: "account-security",
      href: "/settings/security",
      title: t(uiLocale, "settings.link.accountSecurity.title"),
      description: t(uiLocale, "settings.link.accountSecurity.description"),
      icon: Lock,
      visible: true,
    },
    {
      id: "account-notifications",
      href: "/settings/notifications",
      title: t(uiLocale, "settings.link.accountNotifications.title"),
      description: t(uiLocale, "settings.link.accountNotifications.description"),
      icon: Bell,
      visible: true,
    },
  ];

  const adminLinks: SettingsLinkItem[] = [
    {
      id: "superadmin-stores",
      href: "/settings/superadmin",
      title: "Superadmin Center",
      description: t(uiLocale, "settings.superadminCenter.description"),
      icon: Shield,
      visible: isSuperadmin,
      badgeText: "SUPERADMIN",
    },
  ];

  const storeTypeLabel = storeSummary
    ? storeTypeLabels[storeSummary.storeType] ?? storeSummary.storeType
    : t(uiLocale, "settings.value.notSpecified");

  return (
    <section className="space-y-5">
      <header className="space-y-1 px-1">
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">
          {t(uiLocale, "settings.page.title")}
        </h1>
        <p className="text-sm text-slate-500">{t(uiLocale, "settings.page.subtitle")}</p>
      </header>

      <div className="space-y-4">
        {adminLinks.some((item) => item.visible) ? (
          <div className="space-y-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {t(uiLocale, "settings.section.adminArea")}
            </p>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <ul className="divide-y divide-slate-100">
                {adminLinks
                  .filter((item) => item.visible)
                  .map((item) => (
                    <li key={item.id}>
                      <SettingsLinkRow
                        href={item.href}
                        title={item.title}
                        description={item.description}
                        icon={item.icon}
                        badgeText={item.badgeText}
                      />
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t(uiLocale, "settings.section.accountAndStore")}
          </p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              <li className="flex min-h-14 items-center gap-3 px-4 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Store className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {session?.activeStoreName ?? t(uiLocale, "settings.store.notSelected")}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {storeTypeLabel} • {storeSummary?.currency ?? "-"}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                  {session?.activeRoleName ?? t(uiLocale, "settings.role.none")}
                </span>
              </li>

              <li className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {t(uiLocale, "settings.store.addressLabel")}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {storeSummary?.address?.trim()
                      ? storeSummary.address
                      : t(uiLocale, "settings.value.notSpecified")}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-slate-500">System: {systemRole}</span>
              </li>

              <li className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {t(uiLocale, "settings.store.phoneLabel")}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {storeSummary?.phoneNumber?.trim()
                      ? storeSummary.phoneNumber
                      : t(uiLocale, "settings.value.notSpecified")}
                  </p>
                </div>
                {!canUpdateSettings ? (
                  <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                    {t(uiLocale, "settings.permission.viewOnly")}
                  </span>
                ) : null}
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t(uiLocale, "settings.section.management")}
          </p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {managementLinks
                .filter((item) => item.visible)
                .map((item) => (
                  <li key={item.id}>
                    <SettingsLinkRow
                      href={item.href}
                      title={item.title}
                      description={item.description}
                      icon={item.icon}
                    />
                  </li>
                ))}
            </ul>
          </div>
        </div>

        {productSettingsLinks.some((item) => item.visible) && (
          <div className="space-y-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {t(uiLocale, "settings.section.productSettings")}
            </p>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <ul className="divide-y divide-slate-100">
                {productSettingsLinks
                  .filter((item) => item.visible)
                  .map((item) => (
                    <li key={item.id}>
                      <SettingsLinkRow
                        href={item.href}
                        title={item.title}
                        description={item.description}
                        icon={item.icon}
                      />
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t(uiLocale, "settings.section.myAccount")}
          </p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {accountLinks
                .filter((item) => item.visible)
                .map((item) => (
                  <li key={item.id}>
                    <SettingsLinkRow
                      href={item.href}
                      title={item.title}
                      description={item.description}
                      icon={item.icon}
                      badgeText={item.badgeText}
                    />
                  </li>
                ))}
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t(uiLocale, "settings.section.channelConnections")}
          </p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {canViewConnections ? (
              <ul className="divide-y divide-slate-100">
                <li className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">Facebook Page</p>
                    <p className="truncate text-xs text-slate-500">
                      {fbConnection?.pageName?.trim()
                        ? fbConnection.pageName
                        : t(uiLocale, "settings.connections.fb.notLinked")}
                    </p>
                  </div>
                  <ChannelStatusPill status={fbStatus} uiLocale={uiLocale} />
                </li>
                <li className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">WhatsApp</p>
                    <p className="truncate text-xs text-slate-500">
                      {waConnection?.phoneNumber?.trim()
                        ? waConnection.phoneNumber
                        : t(uiLocale, "settings.connections.wa.notLinked")}
                    </p>
                  </div>
                  <ChannelStatusPill status={waStatus} uiLocale={uiLocale} />
                </li>
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-slate-500">
                {t(uiLocale, "settings.connections.noPermission")}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t(uiLocale, "settings.section.security")}
          </p>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start gap-2 text-sm text-slate-700">
              <PlugZap className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              {t(uiLocale, "settings.logout.hint")}
            </div>
            <div className="sm:max-w-[220px]">
              <LogoutButton />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
