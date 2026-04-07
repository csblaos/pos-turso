import Link from "next/link";
import { Activity, ArrowRight, Settings2, ShieldCheck, Store, Users } from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { DEFAULT_UI_LOCALE } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";

const menus = [
  {
    href: "/system-admin/config/clients",
    titleKey: "systemAdmin.configCenter.menu.clients.title",
    descriptionKey: "systemAdmin.configCenter.menu.clients.description",
    icon: Users,
  },
  {
    href: "/system-admin/config/system",
    titleKey: "systemAdmin.configCenter.menu.system.title",
    descriptionKey: "systemAdmin.configCenter.menu.system.description",
    icon: Settings2,
  },
  {
    href: "/system-admin/config/stores-users",
    titleKey: "systemAdmin.configCenter.menu.storesUsers.title",
    descriptionKey: "systemAdmin.configCenter.menu.storesUsers.description",
    icon: Store,
  },
  {
    href: "/system-admin/config/monitoring",
    titleKey: "systemAdmin.configCenter.menu.monitoring.title",
    descriptionKey: "systemAdmin.configCenter.menu.monitoring.description",
    icon: Activity,
  },
  {
    href: "/system-admin/config/security",
    titleKey: "systemAdmin.configCenter.menu.security.title",
    descriptionKey: "systemAdmin.configCenter.menu.security.description",
    icon: ShieldCheck,
  },
] as const;

export default async function SystemAdminConfigPage() {
  const session = await getSession();
  const uiLocale = session?.uiLocale ?? DEFAULT_UI_LOCALE;

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t(uiLocale, "systemAdmin.workspaceBadge")}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {menus.map((menu) => {
          const Icon = menu.icon;

          return (
            <Link
              key={menu.href}
              href={menu.href}
              prefetch
              className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900">
                      {t(uiLocale, menu.titleKey)}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {t(uiLocale, menu.descriptionKey)}
                    </p>
                  </div>
                </div>
                <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-700">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
