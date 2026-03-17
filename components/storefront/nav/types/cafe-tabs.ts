import { LayoutGrid, ReceiptText, Settings } from "lucide-react";

import type { StorefrontNavTab } from "@/components/storefront/nav/types";

export const cafeStorefrontTabs: StorefrontNavTab[] = [
  {
    href: "/dashboard",
    labelKey: "tab.overview",
    compactLabelKey: "tab.dashboard",
    icon: LayoutGrid,
    permission: "dashboard.view",
  },
  {
    href: "/orders",
    labelKey: "tab.cafeOrders",
    compactLabelKey: "tab.orders",
    icon: ReceiptText,
    permission: "orders.view",
  },
  {
    href: "/settings",
    labelKey: "tab.settings",
    compactLabelKey: "tab.settings",
    icon: Settings,
    permission: "settings.view",
  },
];
