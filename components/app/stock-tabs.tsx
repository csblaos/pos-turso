"use client";

import { Edit, FileText, Package, ShoppingCart, type LucideIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { t, type MessageKey } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

type StockTabsProps = {
  recordingTab: ReactNode;
  inventoryTab: ReactNode;
  historyTab: ReactNode;
  purchaseTab: ReactNode;
  initialTab?: string;
};

type TabId = "inventory" | "purchase" | "recording" | "history";

const tabs: ReadonlyArray<{
  id: TabId;
  labelKey: MessageKey;
  labelMobileKey: MessageKey;
  icon: LucideIcon;
}> = [
  {
    id: "inventory",
    labelKey: "stock.tabs.inventory",
    labelMobileKey: "stock.tabs.inventory.mobile",
    icon: Package,
  },
  {
    id: "purchase",
    labelKey: "stock.tabs.purchase",
    labelMobileKey: "stock.tabs.purchase.mobile",
    icon: ShoppingCart,
  },
  {
    id: "recording",
    labelKey: "stock.tabs.recording",
    labelMobileKey: "stock.tabs.recording.mobile",
    icon: Edit,
  },
  {
    id: "history",
    labelKey: "stock.tabs.history",
    labelMobileKey: "stock.tabs.history.mobile",
    icon: FileText,
  },
];

const isTabId = (value: string | null): value is TabId =>
  value === "recording" || value === "inventory" || value === "history" || value === "purchase";

export function StockTabs({
  recordingTab,
  inventoryTab,
  historyTab,
  purchaseTab,
  initialTab = "inventory",
}: StockTabsProps) {
  const router = useRouter();
  const uiLocale = useUiLocale();
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const tabFromQuery = searchParams.get("tab");
  const initialActiveTab: TabId = isTabId(tabFromQuery)
    ? tabFromQuery
    : isTabId(initialTab)
      ? initialTab
      : "inventory";
  const [activeTab, setActiveTab] = useState<TabId>(
    initialActiveTab,
  );
  const [mountedTabs, setMountedTabs] = useState<Record<TabId, boolean>>(() => ({
    inventory: initialActiveTab === "inventory",
    purchase: initialActiveTab === "purchase",
    recording: initialActiveTab === "recording",
    history: initialActiveTab === "history",
  }));
  const pendingScrollRestoreRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setMountedTabs((prev) => ({ ...prev, [activeTab]: true }));
  }, [activeTab]);

  useEffect(() => {
    if (!isTabId(tabFromQuery)) {
      return;
    }
    setActiveTab(tabFromQuery);
  }, [tabFromQuery]);

  useEffect(() => {
    if (typeof window === "undefined") {
      pendingScrollRestoreRef.current = null;
      return;
    }

    const pending = pendingScrollRestoreRef.current;
    if (!pending) {
      return;
    }

    const restore = () => {
      window.scrollTo(pending.x, pending.y);
    };

    const rafId = window.requestAnimationFrame(() => {
      restore();
      window.setTimeout(restore, 0);
      window.setTimeout(restore, 250);
    });

    pendingScrollRestoreRef.current = null;
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [activeTab, mountedTabs]);

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="sticky top-0 z-20 -mx-1 rounded-xl py-2 px-0 shadow-sm">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`flex flex-1 flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                onClick={() => {
                  if (isActive) {
                    return;
                  }
                  if (typeof window !== "undefined") {
                    pendingScrollRestoreRef.current = {
                      x: window.scrollX,
                      y: window.scrollY,
                    };
                  }
                  setActiveTab(tab.id);
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("tab", tab.id);
                  router.replace(`?${params.toString()}`, { scroll: false });
                }}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap md:hidden">{t(uiLocale, tab.labelMobileKey)}</span>
                <span className="hidden whitespace-nowrap md:inline">{t(uiLocale, tab.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className={activeTab === "inventory" ? "block" : "hidden"} aria-hidden={activeTab !== "inventory"}>
        {mountedTabs.inventory ? inventoryTab : null}
      </div>
      <div className={activeTab === "purchase" ? "block" : "hidden"} aria-hidden={activeTab !== "purchase"}>
        {mountedTabs.purchase ? purchaseTab : null}
      </div>
      <div className={activeTab === "recording" ? "block" : "hidden"} aria-hidden={activeTab !== "recording"}>
        {mountedTabs.recording ? recordingTab : null}
      </div>
      <div className={activeTab === "history" ? "block" : "hidden"} aria-hidden={activeTab !== "history"}>
        {mountedTabs.history ? historyTab : null}
      </div>
    </div>
  );
}
