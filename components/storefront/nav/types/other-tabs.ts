import { LayoutGrid, Settings, Store } from "lucide-react";

import type { StorefrontNavTab } from "@/components/storefront/nav/types";

export const otherStorefrontTabs: StorefrontNavTab[] = [
  {
    href: "/dashboard",
    labelKey: "tab.overview",
    compactLabelKey: "tab.dashboard",
    icon: LayoutGrid,
    permission: "dashboard.view",
  },
  {
    href: "/settings/stores",
    labelKey: "tab.stores",
    compactLabelKey: "tab.stores",
    icon: Store,
    permission: "stores.view",
  },
  {
    href: "/settings",
    labelKey: "tab.settings",
    compactLabelKey: "tab.settings",
    icon: Settings,
    permission: "settings.view",
  },
];
