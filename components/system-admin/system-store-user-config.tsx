"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth/client-token";
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
  const uiLocale = useUiLocale();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleError = (message: string) => {
    setSuccessMessage(null);
    setErrorMessage(message);
  };

  const handleSuccess = (message: string) => {
    setErrorMessage(null);
    setSuccessMessage(message);
  };

  const saveStoreConfig = async (storeId: string) => {
    const draft = storeDrafts[storeId];
    if (!draft) {
      return;
    }

    const vatRate = toVatBasisPoints(draft.vatRatePercent);
    if (Number.isNaN(vatRate)) {
      handleError(t(uiLocale, "systemAdmin.storeUserConfig.error.invalidVatRate"));
      return;
    }

    if (!draft.currency.trim()) {
      handleError(t(uiLocale, "systemAdmin.storeUserConfig.error.currencyRequired"));
      return;
    }

    const maxBranchesOverride = parseOptionalInt(draft.maxBranchesOverride, {
      min: 0,
      max: 500,
    });
    if (Number.isNaN(maxBranchesOverride)) {
      handleError(t(uiLocale, "systemAdmin.storeUserConfig.error.invalidMaxBranchesOverride"));
      return;
    }

    setLoadingKey(`store-${storeId}`);
    setErrorMessage(null);

    const response = await authFetch(`/api/system-admin/config/stores/${storeId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: draft.name.trim(),
        storeType: draft.storeType,
        currency: draft.currency.trim().toUpperCase(),
        vatEnabled: draft.vatEnabled,
        vatRate,
        maxBranchesOverride,
      }),
    });

    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      handleError(data?.message ?? t(uiLocale, "systemAdmin.storeUserConfig.error.saveStoreFailed"));
      setLoadingKey(null);
      return;
    }

    handleSuccess(t(uiLocale, "systemAdmin.storeUserConfig.message.storeSaved"));
    setLoadingKey(null);
    router.refresh();
  };

  const saveUserConfig = async (userId: string) => {
    const draft = userDrafts[userId];
    if (!draft) {
      return;
    }

    if (!draft.name.trim()) {
      handleError(t(uiLocale, "systemAdmin.storeUserConfig.error.userNameRequired"));
      return;
    }

    const sessionLimit = parseOptionalInt(draft.sessionLimit, { min: 1, max: 10 });
    if (Number.isNaN(sessionLimit)) {
      handleError(t(uiLocale, "systemAdmin.storeUserConfig.error.invalidSessionLimit"));
      return;
    }

    const isSuperadmin = draft.systemRole === "SUPERADMIN";

    const maxStores = parseOptionalInt(draft.maxStores, { min: 1, max: 100 });
    if (Number.isNaN(maxStores)) {
      handleError(t(uiLocale, "systemAdmin.storeUserConfig.error.invalidMaxStores"));
      return;
    }

    const maxBranchesPerStore = parseOptionalInt(draft.maxBranchesPerStore, {
      min: 0,
      max: 500,
    });
    if (Number.isNaN(maxBranchesPerStore)) {
      handleError(t(uiLocale, "systemAdmin.storeUserConfig.error.invalidMaxBranchesPerStore"));
      return;
    }

    const canCreateBranches =
      draft.branchMode === "GLOBAL" ? null : draft.branchMode === "ALLOW";

    setLoadingKey(`user-${userId}`);
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
        maxStores: isSuperadmin && draft.canCreateStores ? maxStores : null,
        canCreateBranches: isSuperadmin ? canCreateBranches : null,
        maxBranchesPerStore:
          isSuperadmin && canCreateBranches !== false ? maxBranchesPerStore : null,
        sessionLimit,
      }),
    });

    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      handleError(data?.message ?? t(uiLocale, "systemAdmin.storeUserConfig.error.saveUserFailed"));
      setLoadingKey(null);
      return;
    }

    handleSuccess(t(uiLocale, "systemAdmin.storeUserConfig.message.userSaved"));
    setLoadingKey(null);
    router.refresh();
  };

  return (
    <section className="space-y-5">
      <article className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">
          {t(uiLocale, "systemAdmin.storeUserConfig.storeSection.title")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t(uiLocale, "systemAdmin.storeUserConfig.storeSection.description")}
        </p>

        <div className="space-y-3">
          {stores.map((store) => {
            const draft = storeDrafts[store.id];
            if (!draft) {
              return null;
            }

            return (
              <div key={store.id} className="rounded-lg border p-3">
                <p className="text-sm font-semibold">{store.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t(uiLocale, "systemAdmin.storeUserConfig.storeSection.storeIdPrefix")} {store.id}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setStoreDrafts((previous) => ({
                        ...previous,
                        [store.id]: { ...previous[store.id], name: event.target.value },
                      }))
                    }
                    className="h-9 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                    placeholder={t(uiLocale, "systemAdmin.storeUserConfig.field.storeName.placeholder")}
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
                    className="h-9 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                    disabled={loadingKey !== null}
                  >
                    {storeTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(uiLocale, option.labelKey)}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={draft.currency}
                    onChange={(event) =>
                      setStoreDrafts((previous) => ({
                        ...previous,
                        [store.id]: {
                          ...previous[store.id],
                          currency: event.target.value.toUpperCase(),
                        },
                      }))
                    }
                    className="h-9 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                    placeholder={t(uiLocale, "systemAdmin.storeUserConfig.field.currency.placeholder")}
                    disabled={loadingKey !== null}
                  />

                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={draft.vatRatePercent}
                    onChange={(event) =>
                      setStoreDrafts((previous) => ({
                        ...previous,
                        [store.id]: { ...previous[store.id], vatRatePercent: event.target.value },
                      }))
                    }
                    className="h-9 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                    placeholder={t(uiLocale, "systemAdmin.storeUserConfig.field.vatRate.placeholder")}
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
                    className="h-9 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                    placeholder={t(
                      uiLocale,
                      "systemAdmin.storeUserConfig.field.maxBranchesOverride.placeholder",
                    )}
                    disabled={loadingKey !== null}
                  />

                  <label className="flex h-9 items-center justify-between rounded-md border px-3 text-sm">
                    <span>{t(uiLocale, "systemAdmin.storeUserConfig.field.vatEnabled")}</span>
                    <input
                      type="checkbox"
                      checked={draft.vatEnabled}
                      onChange={(event) =>
                        setStoreDrafts((previous) => ({
                          ...previous,
                          [store.id]: { ...previous[store.id], vatEnabled: event.target.checked },
                        }))
                      }
                      disabled={loadingKey !== null}
                    />
                  </label>
                </div>

                <Button
                  variant="outline"
                  className="mt-3 h-9"
                  onClick={() => saveStoreConfig(store.id)}
                  disabled={loadingKey !== null}
                >
                  {loadingKey === `store-${store.id}`
                    ? t(uiLocale, "common.action.saving")
                    : t(uiLocale, "systemAdmin.storeUserConfig.action.saveStoreConfig")}
                </Button>
              </div>
            );
          })}

          {stores.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(uiLocale, "systemAdmin.storeUserConfig.empty.stores")}
            </p>
          ) : null}
        </div>
      </article>

      <article className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">
          {t(uiLocale, "systemAdmin.storeUserConfig.userSection.title")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t(uiLocale, "systemAdmin.storeUserConfig.userSection.description")}
        </p>

        <div className="space-y-3">
          {users.map((user) => {
            const draft = userDrafts[user.id];
            if (!draft) {
              return null;
            }

            const isSuperadmin = draft.systemRole === "SUPERADMIN";

            return (
              <div key={user.id} className="rounded-lg border p-3">
                <p className="text-sm font-semibold">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <p className="text-xs text-muted-foreground">
                  {t(uiLocale, "systemAdmin.storeUserConfig.userSection.userIdPrefix")} {user.id}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setUserDrafts((previous) => ({
                        ...previous,
                        [user.id]: { ...previous[user.id], name: event.target.value },
                      }))
                    }
                    className="h-9 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                    placeholder={t(uiLocale, "systemAdmin.storeUserConfig.field.userName.placeholder")}
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
                    className="h-9 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                    disabled={loadingKey !== null}
                  >
                    {systemRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(uiLocale, option.labelKey)}
                      </option>
                    ))}
                  </select>

                  <label className="flex h-9 items-center justify-between rounded-md border px-3 text-sm">
                    <span>{t(uiLocale, "systemAdmin.storeUserConfig.field.canCreateStores")}</span>
                    <input
                      type="checkbox"
                      checked={draft.canCreateStores}
                      onChange={(event) =>
                        setUserDrafts((previous) => ({
                          ...previous,
                          [user.id]: {
                            ...previous[user.id],
                            canCreateStores: event.target.checked,
                          },
                        }))
                      }
                      disabled={loadingKey !== null || !isSuperadmin}
                    />
                  </label>

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
                    className="h-9 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                    placeholder={t(uiLocale, "systemAdmin.storeUserConfig.field.maxStores.placeholder")}
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
                    className="h-9 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
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
                    className="h-9 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                    placeholder={t(
                      uiLocale,
                      "systemAdmin.storeUserConfig.field.maxBranchesPerStore.placeholder",
                    )}
                    disabled={
                      loadingKey !== null ||
                      !isSuperadmin ||
                      draft.branchMode === "BLOCK"
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
                    className="h-9 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                    placeholder={t(
                      uiLocale,
                      "systemAdmin.storeUserConfig.field.sessionLimit.placeholder",
                    )}
                    disabled={loadingKey !== null}
                  />
                </div>

                <Button
                  variant="outline"
                  className="mt-3 h-9"
                  onClick={() => saveUserConfig(user.id)}
                  disabled={loadingKey !== null}
                >
                  {loadingKey === `user-${user.id}`
                    ? t(uiLocale, "common.action.saving")
                    : t(uiLocale, "systemAdmin.storeUserConfig.action.saveUserConfig")}
                </Button>
              </div>
            );
          })}

          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(uiLocale, "systemAdmin.storeUserConfig.empty.users")}
            </p>
          ) : null}
        </div>
      </article>

      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </section>
  );
}
