import Link from "next/link";
import { Settings2, ShieldCheck, Store, Users } from "lucide-react";

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
        <h1 className="text-xl font-semibold">{t(uiLocale, "systemAdmin.configCenter.title")}</h1>
      </header>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        {menus.map((menu) => {
          const Icon = menu.icon;

          return (
            <Link
              key={menu.href}
              href={menu.href}
              prefetch
              className="rounded-xl border bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/40"
            >
              <Icon className="h-5 w-5 text-blue-700" />
              <h2 className="mt-3 text-sm font-semibold">{t(uiLocale, menu.titleKey)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t(uiLocale, menu.descriptionKey)}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
