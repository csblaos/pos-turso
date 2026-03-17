import { Boxes, LayoutGrid, ReceiptText, Settings, Warehouse } from "lucide-react";

import type { StorefrontNavTab } from "@/components/storefront/nav/types";

export const onlineStorefrontTabs: StorefrontNavTab[] = [
  {
    href: "/dashboard",
    labelKey: "tab.dashboard",
    compactLabelKey: "tab.dashboard",
    icon: LayoutGrid,
    permission: "dashboard.view",
  },
  {
    href: "/orders",
    labelKey: "tab.orders",
    compactLabelKey: "tab.orders",
    icon: ReceiptText,
    permission: "orders.view",
  },
  {
    href: "/stock",
    labelKey: "tab.stock",
    compactLabelKey: "tab.stock",
    icon: Warehouse,
    permission: "inventory.view",
  },
  {
    href: "/products",
    labelKey: "tab.products",
    compactLabelKey: "tab.products",
    icon: Boxes,
    permission: "products.view",
  },
  {
    href: "/settings",
    labelKey: "tab.settings",
    compactLabelKey: "tab.settings",
    icon: Settings,
    permission: "settings.view",
  },
];
