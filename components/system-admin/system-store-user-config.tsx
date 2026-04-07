"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Info, Loader2, Pencil, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { authFetch } from "@/lib/auth/client-token";
import { currencySymbol, isStoreCurrency, storeCurrencyValues } from "@/lib/finance/store-financial";
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

type StoreConfigItem = {
  id: string;
  name: string;
  storeType: "ONLINE_RETAIL" | "RESTAURANT" | "CAFE" | "OTHER";
  currency: string;
  vatEnabled: boolean;
  vatRate: number;
  maxBranchesOverride: number | null;
  createdAt: string;
};

type UserConfigItem = {
  id: string;
  email: string;
  name: string;
  systemRole: "USER" | "SUPERADMIN" | "SYSTEM_ADMIN";
  canCreateStores: boolean | null;
  maxStores: number | null;
  canCreateBranches: boolean | null;
  maxBranchesPerStore: number | null;
  sessionLimit: number | null;
  createdAt: string;
};

type StoreDraft = {
  name: string;
  storeType: "ONLINE_RETAIL" | "RESTAURANT" | "CAFE" | "OTHER";
  currency: string;
  vatEnabled: boolean;
  vatRatePercent: string;
  maxBranchesOverride: string;
};

type BranchMode = "GLOBAL" | "ALLOW" | "BLOCK";

type UserDraft = {
  name: string;
  systemRole: "USER" | "SUPERADMIN" | "SYSTEM_ADMIN";
  canCreateStores: boolean;
  maxStores: string;
  branchMode: BranchMode;
  maxBranchesPerStore: string;
  sessionLimit: string;
};

type SystemStoreUserConfigProps = {
  stores: StoreConfigItem[];
  users: UserConfigItem[];
};

type StoresUsersTab = "stores" | "users";
type SaveUiState = "idle" | "saving" | "success" | "error";

const toNormalizedCurrency = (value: string) => value.trim().toUpperCase();

const isStoreDraftDirty = (baseline: StoreConfigItem, draft: StoreDraft) => {
  if (baseline.name !== draft.name.trim()) return true;
  if (baseline.storeType !== draft.storeType) return true;

  const normalizedCurrency = toNormalizedCurrency(draft.currency);
  if (baseline.currency !== normalizedCurrency) return true;

  if (baseline.vatEnabled !== draft.vatEnabled) return true;

  if (draft.vatEnabled) {
    const vatRate = toVatBasisPoints(draft.vatRatePercent);
    if (Number.isNaN(vatRate)) return true;
    if (baseline.vatRate !== vatRate) return true;
  }

  const maxBranchesOverride = parseOptionalInt(draft.maxBranchesOverride, { min: 0, max: 500 });
  if (Number.isNaN(maxBranchesOverride)) return true;
  if (baseline.maxBranchesOverride !== maxBranchesOverride) return true;

  return false;
};

const isUserDraftDirty = (baseline: UserConfigItem, draft: UserDraft) => {
  if (baseline.name !== draft.name.trim()) return true;
  if (baseline.systemRole !== draft.systemRole) return true;

  const sessionLimit = parseOptionalInt(draft.sessionLimit, { min: 1, max: 10 });
  if (Number.isNaN(sessionLimit)) return true;
  if (baseline.sessionLimit !== sessionLimit) return true;

  const isSuperadmin = draft.systemRole === "SUPERADMIN";
  const canCreateBranches = draft.branchMode === "GLOBAL" ? null : draft.branchMode === "ALLOW";

  const nextCanCreateStores = isSuperadmin ? draft.canCreateStores : null;
  const nextMaxStores = (() => {
    if (!isSuperadmin || !draft.canCreateStores) return null;
    const parsed = parseOptionalInt(draft.maxStores, { min: 1, max: 100 });
    if (Number.isNaN(parsed)) return Number.NaN;
    return parsed;
  })();
  const nextCanCreateBranches = isSuperadmin ? canCreateBranches : null;
  const nextMaxBranchesPerStore = (() => {
    if (!isSuperadmin || canCreateBranches === false) return null;
    const parsed = parseOptionalInt(draft.maxBranchesPerStore, { min: 0, max: 500 });
    if (Number.isNaN(parsed)) return Number.NaN;
    return parsed;
  })();

  if (Number.isNaN(nextMaxStores)) return true;
  if (Number.isNaN(nextMaxBranchesPerStore)) return true;

  if (baseline.canCreateStores !== nextCanCreateStores) return true;
  if (baseline.maxStores !== nextMaxStores) return true;
  if (baseline.canCreateBranches !== nextCanCreateBranches) return true;
  if (baseline.maxBranchesPerStore !== nextMaxBranchesPerStore) return true;

  return false;
};

const storeTypeOptions = [
  { value: "ONLINE_RETAIL", labelKey: "onboarding.storeType.online.title" },
  { value: "RESTAURANT", labelKey: "onboarding.storeType.restaurant.title" },
  { value: "CAFE", labelKey: "onboarding.storeType.cafe.title" },
  { value: "OTHER", labelKey: "onboarding.storeType.other.title" },
] as const;

const systemRoleOptions = [
  { value: "USER", labelKey: "systemAdmin.storeUserConfig.role.USER" },
  { value: "SUPERADMIN", labelKey: "systemAdmin.storeUserConfig.role.SUPERADMIN" },
  { value: "SYSTEM_ADMIN", labelKey: "systemAdmin.storeUserConfig.role.SYSTEM_ADMIN" },
] as const;

const currencyOptions = storeCurrencyValues.map((currency) => ({
  value: currency,
  label: `${currency} (${currencySymbol(currency)})`,
}));

const toVatPercentText = (basisPoints: number) => (basisPoints / 100).toFixed(2);

const toVatBasisPoints = (percentText: string) => {
  const parsed = Number(percentText);
  if (!Number.isFinite(parsed)) {
    return Number.NaN;
  }

  return Math.max(0, Math.min(10000, Math.round(parsed * 100)));
};

const parseOptionalInt = (rawValue: string, options: { min: number; max: number }) => {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < options.min || parsed > options.max) {
    return Number.NaN;
  }

  return parsed;
};

const toBranchMode = (value: boolean | null): BranchMode => {
  if (value === true) {
    return "ALLOW";
  }
  if (value === false) {
    return "BLOCK";
  }
  return "GLOBAL";
};

export function SystemStoreUserConfig({ stores, users }: SystemStoreUserConfigProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const uiLocale = useUiLocale();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storeQuery, setStoreQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [openStoreId, setOpenStoreId] = useState<string | null>(null);
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [isStoreHelpOpen, setIsStoreHelpOpen] = useState(false);
  const [isUserHelpOpen, setIsUserHelpOpen] = useState(false);
  const [saveUiByKey, setSaveUiByKey] = useState<Record<string, SaveUiState>>({});
  const saveUiTimeoutsRef = useRef<number[]>([]);
  const urlTab = searchParams.get("tab") === "users" ? "users" : "stores";
  const [activeTab, setActiveTab] = useState<StoresUsersTab>(urlTab);

  const [storeDrafts, setStoreDrafts] = useState<Record<string, StoreDraft>>(() =>
    Object.fromEntries(
      stores.map((store) => [
        store.id,
        {
          name: store.name,
          storeType: store.storeType,
          currency: store.currency,
          vatEnabled: store.vatEnabled,
          vatRatePercent: toVatPercentText(store.vatRate),
          maxBranchesOverride:
            typeof store.maxBranchesOverride === "number"
              ? String(store.maxBranchesOverride)
              : "",
        },
      ]),
    ),
  );

  const [userDrafts, setUserDrafts] = useState<Record<string, UserDraft>>(() =>
    Object.fromEntries(
      users.map((user) => [
        user.id,
        {
          name: user.name,
          systemRole: user.systemRole,
          canCreateStores: user.canCreateStores === true,
          maxStores: typeof user.maxStores === "number" ? String(user.maxStores) : "",
          branchMode: toBranchMode(user.canCreateBranches),
          maxBranchesPerStore:
            typeof user.maxBranchesPerStore === "number"
              ? String(user.maxBranchesPerStore)
              : "",
          sessionLimit:
            typeof user.sessionLimit === "number" ? String(user.sessionLimit) : "",
        },
      ]),
    ),
  );

  useEffect(() => {
    // Keep drafts in sync with server data after router.refresh()/prop changes.
    setStoreDrafts(
      Object.fromEntries(
        stores.map((store) => [
          store.id,
          {
            name: store.name,
            storeType: store.storeType,
            currency: store.currency,
            vatEnabled: store.vatEnabled,
            vatRatePercent: toVatPercentText(store.vatRate),
            maxBranchesOverride:
              typeof store.maxBranchesOverride === "number"
                ? String(store.maxBranchesOverride)
                : "",
          },
        ]),
      ),
    );

    setUserDrafts(
      Object.fromEntries(
        users.map((user) => [
          user.id,
          {
            name: user.name,
            systemRole: user.systemRole,
            canCreateStores: user.canCreateStores === true,
            maxStores: typeof user.maxStores === "number" ? String(user.maxStores) : "",
            branchMode: toBranchMode(user.canCreateBranches),
            maxBranchesPerStore:
              typeof user.maxBranchesPerStore === "number"
                ? String(user.maxBranchesPerStore)
                : "",
            sessionLimit:
              typeof user.sessionLimit === "number" ? String(user.sessionLimit) : "",
          },
        ]),
      ),
    );
  }, [stores, users]);

  useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);

  useEffect(() => {
    return () => {
      saveUiTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      saveUiTimeoutsRef.current = [];
    };
  }, []);

  const setSaveUiState = (key: string, nextState: SaveUiState) => {
    setSaveUiByKey((previous) => ({ ...previous, [key]: nextState }));
  };

  const resetSaveUiLater = (key: string, delayMs: number) => {
    const timeoutId = window.setTimeout(() => {
      setSaveUiByKey((previous) => ({ ...previous, [key]: "idle" }));
    }, delayMs);
    saveUiTimeoutsRef.current.push(timeoutId);
  };

  const flashSaveResult = (key: string, result: Exclude<SaveUiState, "idle" | "saving">) => {
    setSaveUiState(key, result);
    resetSaveUiLater(key, 1800);
  };

  const AnimatedCheckIcon = ({ className }: { className?: string }) => (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={["h-4 w-4", className ?? "", "sa-draw-check"].join(" ").trim()}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 12.5l4.2 4.2L19.5 6.8" />
    </svg>
  );

  const AnimatedXIcon = ({ className }: { className?: string }) => (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={["h-4 w-4", className ?? "", "sa-draw-x"].join(" ").trim()}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 7l10 10" />
      <path d="M17 7L7 17" />
    </svg>
  );

  const renderSaveButtonLabel = (key: string, defaultLabel: string) => {
    const state = saveUiByKey[key] ?? "idle";

    if (state === "saving") {
      return (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t(uiLocale, "common.action.saving")}
        </span>
      );
    }

    if (state === "success") {
      return (
        <span className="inline-flex items-center gap-2 text-emerald-700">
          <AnimatedCheckIcon />
          {t(uiLocale, "systemAdmin.storeUserConfig.action.saved")}
        </span>
      );
    }

    if (state === "error") {
      return (
        <span className="inline-flex items-center gap-2 text-red-700">
          <AnimatedXIcon />
          {t(uiLocale, "systemAdmin.storeUserConfig.action.failed")}
        </span>
      );
    }

    return defaultLabel;
  };

  const setTab = (tab: StoresUsersTab) => {
    setActiveTab(tab);
    setOpenStoreId(null);
    setOpenUserId(null);

    const nextParams = new URLSearchParams(searchParams.toString());
    if (tab === "users") {
      nextParams.set("tab", "users");
    } else {
      nextParams.delete("tab");
    }

    const qs = nextParams.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const handleError = (message: string) => {
    setErrorMessage(message);
  };

  const saveStoreConfig = async (storeId: string) => {
    const key = `store-${storeId}`;
    const draft = storeDrafts[storeId];
    if (!draft) {
      return;
    }

    const vatRate = toVatBasisPoints(draft.vatRatePercent);
    if (Number.isNaN(vatRate)) {
      handleError(t(uiLocale, "systemAdmin.storeUserConfig.error.invalidVatRate"));
      flashSaveResult(key, "error");
      return;
    }

    const currency = draft.currency.trim().toUpperCase();
    if (!isStoreCurrency(currency)) {
      handleError(t(uiLocale, "systemAdmin.storeUserConfig.error.currencyRequired"));
      flashSaveResult(key, "error");
      return;
    }

    const maxBranchesOverride = parseOptionalInt(draft.maxBranchesOverride, {
      min: 0,
      max: 500,
    });
    if (Number.isNaN(maxBranchesOverride)) {
      handleError(t(uiLocale, "systemAdmin.storeUserConfig.error.invalidMaxBranchesOverride"));
      flashSaveResult(key, "error");
      return;
    }

    setSaveUiState(key, "saving");
    setLoadingKey(key);
    setErrorMessage(null);

    const response = await authFetch(`/api/system-admin/config/stores/${storeId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: draft.name.trim(),
        storeType: draft.storeType,
        currency,
        vatEnabled: draft.vatEnabled,
        vatRate,
        maxBranchesOverride,
      }),
    });

    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      handleError(data?.message ?? t(uiLocale, "systemAdmin.storeUserConfig.error.saveStoreFailed"));
      setSaveUiState(key, "error");
      resetSaveUiLater(key, 1800);
      setLoadingKey(null);
      return;
    }

    setSaveUiState(key, "success");
    resetSaveUiLater(key, 1800);
    setLoadingKey(null);
    window.setTimeout(() => {
      router.refresh();
    }, 700);
  };

  const saveUserConfig = async (userId: string) => {
    const key = `user-${userId}`;
    const draft = userDrafts[userId];
    if (!draft) {
      return;
    }

    if (!draft.name.trim()) {
      handleError(t(uiLocale, "systemAdmin.storeUserConfig.error.userNameRequired"));
      flashSaveResult(key, "error");
      return;
    }

    const sessionLimit = parseOptionalInt(draft.sessionLimit, { min: 1, max: 10 });
    if (Number.isNaN(sessionLimit)) {
      handleError(t(uiLocale, "systemAdmin.storeUserConfig.error.invalidSessionLimit"));
      flashSaveResult(key, "error");
      return;
    }

    const isSuperadmin = draft.systemRole === "SUPERADMIN";

    const canCreateBranches =
      draft.branchMode === "GLOBAL" ? null : draft.branchMode === "ALLOW";

    const maxStores = (() => {
      if (!isSuperadmin || !draft.canCreateStores) return null;
      const parsed = parseOptionalInt(draft.maxStores, { min: 1, max: 100 });
      if (Number.isNaN(parsed)) return Number.NaN;
      return parsed;
    })();
    if (Number.isNaN(maxStores)) {
      handleError(t(uiLocale, "systemAdmin.storeUserConfig.error.invalidMaxStores"));
      flashSaveResult(key, "error");
      return;
    }

    const maxBranchesPerStore = (() => {
      if (!isSuperadmin || canCreateBranches === false) return null;
      const parsed = parseOptionalInt(draft.maxBranchesPerStore, { min: 0, max: 500 });
      if (Number.isNaN(parsed)) return Number.NaN;
      return parsed;
    })();
    if (Number.isNaN(maxBranchesPerStore)) {
      handleError(t(uiLocale, "systemAdmin.storeUserConfig.error.invalidMaxBranchesPerStore"));
      flashSaveResult(key, "error");
      return;
    }

    setSaveUiState(key, "saving");
    setLoadingKey(key);
    setErrorMessage(null);

    const response = await authFetch(`/api/system-admin/config/users/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: draft.name.trim(),
        systemRole: draft.systemRole,
        canCreateStores: isSuperadmin ? draft.canCreateStores : null,
        maxStores,
        canCreateBranches: isSuperadmin ? canCreateBranches : null,
        maxBranchesPerStore,
        sessionLimit,
      }),
    });

    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      handleError(data?.message ?? t(uiLocale, "systemAdmin.storeUserConfig.error.saveUserFailed"));
      setSaveUiState(key, "error");
      resetSaveUiLater(key, 1800);
      setLoadingKey(null);
      return;
    }

    setSaveUiState(key, "success");
    resetSaveUiLater(key, 1800);
    setLoadingKey(null);
    window.setTimeout(() => {
      router.refresh();
    }, 700);
  };

  const deferredStoreQuery = useDeferredValue(storeQuery);
  const deferredUserQuery = useDeferredValue(userQuery);

  const visibleStores = useMemo(() => {
    const query = deferredStoreQuery.trim().toLowerCase();
    if (!query) {
      return stores;
    }

    return stores.filter((store) => {
      const haystack = `${store.name} ${store.id} ${store.currency} ${store.storeType}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [deferredStoreQuery, stores]);

  const visibleUsers = useMemo(() => {
    const query = deferredUserQuery.trim().toLowerCase();
    if (!query) {
      return users;
    }

    return users.filter((user) => {
      const haystack = `${user.name} ${user.email} ${user.id} ${user.systemRole}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [deferredUserQuery, users]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setTab("stores")}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${
              activeTab === "stores"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
            aria-pressed={activeTab === "stores"}
            disabled={loadingKey !== null}
          >
            {t(uiLocale, "systemAdmin.storesUsersPage.tab.stores")}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              {stores.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("users")}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${
              activeTab === "users"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
            aria-pressed={activeTab === "users"}
            disabled={loadingKey !== null}
          >
            {t(uiLocale, "systemAdmin.storesUsersPage.tab.users")}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              {users.length}
            </span>
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {activeTab === "stores" ? (
        <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-slate-900">
              {t(uiLocale, "systemAdmin.storeUserConfig.storeSection.title")}
            </h2>
            <button
              type="button"
              onClick={() => setIsStoreHelpOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-50"
              aria-label={t(uiLocale, "systemAdmin.storeUserConfig.storeSection.description")}
              title={t(uiLocale, "systemAdmin.storeUserConfig.storeSection.description")}
              disabled={loadingKey !== null}
            >
              <Info className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {stores.length}
          </div>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={storeQuery}
            onChange={(event) => setStoreQuery(event.target.value)}
            placeholder={t(uiLocale, "systemAdmin.storeUserConfig.storeSearch.placeholder")}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm outline-none ring-primary transition focus:border-slate-300 focus:ring-2 disabled:opacity-50"
            disabled={loadingKey !== null}
          />
          <div className="absolute inset-y-0 right-3 flex items-center">
            {storeQuery ? (
              <button
                type="button"
                onClick={() => setStoreQuery("")}
                className="text-slate-400 hover:text-slate-600 disabled:pointer-events-none"
                aria-label={t(uiLocale, "systemAdmin.storeUserConfig.search.clearAriaLabel")}
                title={t(uiLocale, "systemAdmin.storeUserConfig.search.clearAriaLabel")}
                disabled={loadingKey !== null}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          {visibleStores.map((store) => {
            const draft = storeDrafts[store.id];
            if (!draft) {
              return null;
            }

            const isDirty = isStoreDraftDirty(store, draft);
            const isOpen = openStoreId === store.id;
            const storeTypeLabelKey = storeTypeOptions.find(
              (option) => option.value === draft.storeType,
            )?.labelKey;
            const storeTypeLabel = storeTypeLabelKey
              ? t(uiLocale, storeTypeLabelKey)
              : draft.storeType;
            const currencyLabel = isStoreCurrency(draft.currency)
              ? draft.currency
              : store.currency;

            return (
              <div key={store.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{store.name}</p>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {currencyLabel}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {storeTypeLabel}
                      </span>
                      {draft.vatEnabled ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          VAT {draft.vatRatePercent}%
                        </span>
                      ) : (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          VAT OFF
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {t(uiLocale, "systemAdmin.storeUserConfig.storeSection.storeIdPrefix")}{" "}
                      {store.id}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 shrink-0 rounded-full px-3 text-xs font-semibold"
                    onClick={() => setOpenStoreId((prev) => (prev === store.id ? null : store.id))}
                    disabled={loadingKey !== null}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                  </Button>
                </div>

                {isOpen ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                      <input
                        value={draft.name}
                        onChange={(event) =>
                          setStoreDrafts((previous) => ({
                            ...previous,
                            [store.id]: { ...previous[store.id], name: event.target.value },
                          }))
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-primary transition focus:border-slate-300 focus:ring-2 disabled:opacity-50"
                        placeholder={t(
                          uiLocale,
                          "systemAdmin.storeUserConfig.field.storeName.placeholder",
                        )}
                        disabled={loadingKey !== null}
                      />

                      <select
                        value={draft.storeType}
                        onChange={(event) =>
                          setStoreDrafts((previous) => ({
                            ...previous,
                            [store.id]: {
                              ...previous[store.id],
                              storeType: event.target.value as StoreDraft["storeType"],
                            },
                          }))
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-primary transition focus:border-slate-300 focus:ring-2 disabled:opacity-50"
                        disabled={loadingKey !== null}
                      >
                        {storeTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {t(uiLocale, option.labelKey)}
                          </option>
                        ))}
                      </select>

                      <select
                        value={isStoreCurrency(draft.currency) ? draft.currency : store.currency}
                        onChange={(event) =>
                          setStoreDrafts((previous) => ({
                            ...previous,
                            [store.id]: {
                              ...previous[store.id],
                              currency: event.target.value,
                            },
                          }))
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-primary transition focus:border-slate-300 focus:ring-2 disabled:opacity-50"
                        disabled={loadingKey !== null}
                      >
                        {currencyOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <div className="flex h-10 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
                        <span className="font-semibold">
                          {t(uiLocale, "systemAdmin.storeUserConfig.field.vatEnabled")}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={draft.vatEnabled}
                          onClick={() =>
                            setStoreDrafts((previous) => ({
                              ...previous,
                              [store.id]: {
                                ...previous[store.id],
                                vatEnabled: !previous[store.id]?.vatEnabled,
                              },
                            }))
                          }
                          disabled={loadingKey !== null}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                            draft.vatEnabled
                              ? "border-emerald-600 bg-emerald-600"
                              : "border-slate-200 bg-slate-200"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                              draft.vatEnabled ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={draft.vatRatePercent}
                        onChange={(event) =>
                          setStoreDrafts((previous) => ({
                            ...previous,
                            [store.id]: {
                              ...previous[store.id],
                              vatRatePercent: event.target.value,
                            },
                          }))
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-primary transition focus:border-slate-300 focus:ring-2 disabled:opacity-50"
                        placeholder={t(
                          uiLocale,
                          "systemAdmin.storeUserConfig.field.vatRate.placeholder",
                        )}
                        disabled={loadingKey !== null || !draft.vatEnabled}
                      />

                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={draft.maxBranchesOverride}
                        onChange={(event) =>
                          setStoreDrafts((previous) => ({
                            ...previous,
                            [store.id]: {
                              ...previous[store.id],
                              maxBranchesOverride: event.target.value,
                            },
                          }))
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-primary transition focus:border-slate-300 focus:ring-2 disabled:opacity-50"
                        placeholder={t(
                          uiLocale,
                          "systemAdmin.storeUserConfig.field.maxBranchesOverride.placeholder",
                        )}
                        disabled={loadingKey !== null}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-end">
	                      <Button
	                        variant="outline"
	                        className="h-9 min-w-[9.25rem] rounded-full px-4 text-xs font-semibold"
	                        onClick={() => saveStoreConfig(store.id)}
	                        disabled={
                            loadingKey !== null ||
                            !isDirty ||
                            (saveUiByKey[`store-${store.id}`] ?? "idle") !== "idle"
                          }
	                      >
	                        {renderSaveButtonLabel(
                            `store-${store.id}`,
                            t(uiLocale, "systemAdmin.storeUserConfig.action.saveStoreConfig"),
                          )}
	                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {visibleStores.length === 0 ? (
            <p className="text-sm text-slate-600">
              {t(uiLocale, "systemAdmin.storeUserConfig.empty.stores")}
            </p>
          ) : null}
        </div>
        </article>
      ) : null}

      {activeTab === "users" ? (
        <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-slate-900">
              {t(uiLocale, "systemAdmin.storeUserConfig.userSection.title")}
            </h2>
            <button
              type="button"
              onClick={() => setIsUserHelpOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-50"
              aria-label={t(uiLocale, "systemAdmin.storeUserConfig.userSection.description")}
              title={t(uiLocale, "systemAdmin.storeUserConfig.userSection.description")}
              disabled={loadingKey !== null}
            >
              <Info className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {users.length}
          </div>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={userQuery}
            onChange={(event) => setUserQuery(event.target.value)}
            placeholder={t(uiLocale, "systemAdmin.storeUserConfig.userSearch.placeholder")}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm outline-none ring-primary transition focus:border-slate-300 focus:ring-2 disabled:opacity-50"
            disabled={loadingKey !== null}
          />
          <div className="absolute inset-y-0 right-3 flex items-center">
            {userQuery ? (
              <button
                type="button"
                onClick={() => setUserQuery("")}
                className="text-slate-400 hover:text-slate-600 disabled:pointer-events-none"
                aria-label={t(uiLocale, "systemAdmin.storeUserConfig.search.clearAriaLabel")}
                title={t(uiLocale, "systemAdmin.storeUserConfig.search.clearAriaLabel")}
                disabled={loadingKey !== null}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          {visibleUsers.map((user) => {
            const draft = userDrafts[user.id];
            if (!draft) {
              return null;
            }

            const isDirty = isUserDraftDirty(user, draft);
            const isOpen = openUserId === user.id;
            const isSuperadmin = draft.systemRole === "SUPERADMIN";

            return (
              <div key={user.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {draft.systemRole}
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t(uiLocale, "systemAdmin.storeUserConfig.userSection.userIdPrefix")}{" "}
                      {user.id}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 shrink-0 rounded-full px-3 text-xs font-semibold"
                    onClick={() => setOpenUserId((prev) => (prev === user.id ? null : user.id))}
                    disabled={loadingKey !== null}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                  </Button>
                </div>

                {isOpen ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                      <input
                        value={draft.name}
                        onChange={(event) =>
                          setUserDrafts((previous) => ({
                            ...previous,
                            [user.id]: { ...previous[user.id], name: event.target.value },
                          }))
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-primary transition focus:border-slate-300 focus:ring-2 disabled:opacity-50"
                        placeholder={t(
                          uiLocale,
                          "systemAdmin.storeUserConfig.field.userName.placeholder",
                        )}
                        disabled={loadingKey !== null}
                      />

                      <select
                        value={draft.systemRole}
                        onChange={(event) =>
                          setUserDrafts((previous) => ({
                            ...previous,
                            [user.id]: {
                              ...previous[user.id],
                              systemRole: event.target.value as UserDraft["systemRole"],
                            },
                          }))
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-primary transition focus:border-slate-300 focus:ring-2 disabled:opacity-50"
                        disabled={loadingKey !== null}
                      >
                        {systemRoleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {t(uiLocale, option.labelKey)}
                          </option>
                        ))}
                      </select>

                      <div className="flex h-10 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
                        <span className="font-semibold">
                          {t(uiLocale, "systemAdmin.storeUserConfig.field.canCreateStores")}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={draft.canCreateStores}
                          onClick={() =>
                            setUserDrafts((previous) => {
                              const current = previous[user.id];
                              if (!current) return previous;
                              return {
                                ...previous,
                                [user.id]: {
                                  ...current,
                                  canCreateStores: !current.canCreateStores,
                                },
                              };
                            })
                          }
                          disabled={loadingKey !== null || !isSuperadmin}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                            draft.canCreateStores
                              ? "border-emerald-600 bg-emerald-600"
                              : "border-slate-200 bg-slate-200"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                              draft.canCreateStores ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={draft.maxStores}
                        onChange={(event) =>
                          setUserDrafts((previous) => ({
                            ...previous,
                            [user.id]: { ...previous[user.id], maxStores: event.target.value },
                          }))
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-primary transition focus:border-slate-300 focus:ring-2 disabled:opacity-50"
                        placeholder={t(
                          uiLocale,
                          "systemAdmin.storeUserConfig.field.maxStores.placeholder",
                        )}
                        disabled={loadingKey !== null || !isSuperadmin || !draft.canCreateStores}
                      />

                      <select
                        value={draft.branchMode}
                        onChange={(event) =>
                          setUserDrafts((previous) => ({
                            ...previous,
                            [user.id]: {
                              ...previous[user.id],
                              branchMode: event.target.value as BranchMode,
                            },
                          }))
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-primary transition focus:border-slate-300 focus:ring-2 disabled:opacity-50"
                        disabled={loadingKey !== null || !isSuperadmin}
                      >
                        <option value="GLOBAL">
                          {t(uiLocale, "systemAdmin.storeUserConfig.field.branchMode.global")}
                        </option>
                        <option value="ALLOW">
                          {t(uiLocale, "systemAdmin.storeUserConfig.field.branchMode.allow")}
                        </option>
                        <option value="BLOCK">
                          {t(uiLocale, "systemAdmin.storeUserConfig.field.branchMode.block")}
                        </option>
                      </select>

                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={draft.maxBranchesPerStore}
                        onChange={(event) =>
                          setUserDrafts((previous) => ({
                            ...previous,
                            [user.id]: {
                              ...previous[user.id],
                              maxBranchesPerStore: event.target.value,
                            },
                          }))
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-primary transition focus:border-slate-300 focus:ring-2 disabled:opacity-50"
                        placeholder={t(
                          uiLocale,
                          "systemAdmin.storeUserConfig.field.maxBranchesPerStore.placeholder",
                        )}
                        disabled={
                          loadingKey !== null || !isSuperadmin || draft.branchMode === "BLOCK"
                        }
                      />

                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={draft.sessionLimit}
                        onChange={(event) =>
                          setUserDrafts((previous) => ({
                            ...previous,
                            [user.id]: {
                              ...previous[user.id],
                              sessionLimit: event.target.value,
                            },
                          }))
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-primary transition focus:border-slate-300 focus:ring-2 disabled:opacity-50"
                        placeholder={t(
                          uiLocale,
                          "systemAdmin.storeUserConfig.field.sessionLimit.placeholder",
                        )}
                        disabled={loadingKey !== null}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-end">
	                      <Button
	                        variant="outline"
	                        className="h-9 min-w-[9.25rem] rounded-full px-4 text-xs font-semibold"
	                        onClick={() => saveUserConfig(user.id)}
	                        disabled={
                            loadingKey !== null ||
                            !isDirty ||
                            (saveUiByKey[`user-${user.id}`] ?? "idle") !== "idle"
                          }
	                      >
	                        {renderSaveButtonLabel(
                            `user-${user.id}`,
                            t(uiLocale, "systemAdmin.storeUserConfig.action.saveUserConfig"),
                          )}
	                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {visibleUsers.length === 0 ? (
            <p className="text-sm text-slate-600">{t(uiLocale, "systemAdmin.storeUserConfig.empty.users")}</p>
          ) : null}
        </div>
        </article>
      ) : null}

      <SlideUpSheet
        isOpen={isStoreHelpOpen}
        onClose={() => setIsStoreHelpOpen(false)}
        title={t(uiLocale, "systemAdmin.storeUserConfig.storeSection.title")}
        description={t(uiLocale, "systemAdmin.storeUserConfig.storeSection.description")}
        disabled={loadingKey !== null}
      >
        <div className="space-y-2 text-sm text-slate-700">
          <p>{t(uiLocale, "systemAdmin.storeUserConfig.storeSection.description")}</p>
        </div>
      </SlideUpSheet>

      <SlideUpSheet
        isOpen={isUserHelpOpen}
        onClose={() => setIsUserHelpOpen(false)}
        title={t(uiLocale, "systemAdmin.storeUserConfig.userSection.title")}
        description={t(uiLocale, "systemAdmin.storeUserConfig.userSection.description")}
        disabled={loadingKey !== null}
      >
        <div className="space-y-2 text-sm text-slate-700">
          <p>{t(uiLocale, "systemAdmin.storeUserConfig.userSection.description")}</p>
        </div>
      </SlideUpSheet>
    </section>
  );
}
