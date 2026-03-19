"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth/client-token";
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

type SuperadminItem = {
  userId: string;
  email: string;
  name: string;
  canCreateStores: boolean;
  maxStores: number | null;
  canCreateBranches: boolean | null;
  maxBranchesPerStore: number | null;
  activeOwnerStoreCount: number;
  createdAt: string;
};

type SuperadminManagementProps = {
  superadmins: SuperadminItem[];
  globalBranchDefaults: {
    defaultCanCreateBranches: boolean;
    defaultMaxBranchesPerStore: number | null;
  };
};

export function SuperadminManagement({
  superadmins,
  globalBranchDefaults,
}: SuperadminManagementProps) {
  const router = useRouter();
  const uiLocale = useUiLocale();

  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formCanCreateStores, setFormCanCreateStores] = useState(true);
  const [formMaxStores, setFormMaxStores] = useState("1");
  const [formUseGlobalBranchPolicy, setFormUseGlobalBranchPolicy] = useState(true);
  const [formCanCreateBranches, setFormCanCreateBranches] = useState(
    globalBranchDefaults.defaultCanCreateBranches,
  );
  const [formMaxBranchesPerStore, setFormMaxBranchesPerStore] = useState(
    globalBranchDefaults.defaultMaxBranchesPerStore !== null
      ? String(globalBranchDefaults.defaultMaxBranchesPerStore)
      : "",
  );

  const [draftCanCreateMap, setDraftCanCreateMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(superadmins.map((item) => [item.userId, item.canCreateStores])),
  );
  const [draftMaxStoresMap, setDraftMaxStoresMap] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      superadmins.map((item) => [item.userId, item.maxStores ? String(item.maxStores) : ""]),
    ),
  );

  const [draftUseGlobalBranchMap, setDraftUseGlobalBranchMap] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(
      superadmins.map((item) => [
        item.userId,
        item.canCreateBranches === null && item.maxBranchesPerStore === null,
      ]),
    ),
  );
  const [draftCanCreateBranchesMap, setDraftCanCreateBranchesMap] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(
      superadmins.map((item) => [
        item.userId,
        typeof item.canCreateBranches === "boolean"
          ? item.canCreateBranches
          : globalBranchDefaults.defaultCanCreateBranches,
      ]),
    ),
  );
  const [draftMaxBranchesPerStoreMap, setDraftMaxBranchesPerStoreMap] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      superadmins.map((item) => [
        item.userId,
        item.maxBranchesPerStore !== null
          ? String(item.maxBranchesPerStore)
          : globalBranchDefaults.defaultMaxBranchesPerStore !== null
            ? String(globalBranchDefaults.defaultMaxBranchesPerStore)
            : "",
      ]),
    ),
  );

  const refreshPage = () => {
    router.refresh();
  };

  const handleError = (message: string) => {
    setSuccessMessage(null);
    setErrorMessage(message);
  };

  const handleSuccess = (message: string) => {
    setErrorMessage(null);
    setSuccessMessage(message);
  };

  const parseOptionalIntWithinRange = (rawValue: string, options: { min: number; max: number }) => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (
      !Number.isInteger(parsed) ||
      parsed < options.min ||
      parsed > options.max
    ) {
      return Number.NaN;
    }

    return parsed;
  };

  const createSuperadmin = async () => {
    const parsedMaxStores = parseOptionalIntWithinRange(formMaxStores, {
      min: 1,
      max: 100,
    });
    if (Number.isNaN(parsedMaxStores)) {
      handleError(t(uiLocale, "systemAdmin.superadminManagement.error.invalidMaxStores"));
      return;
    }

    const parsedMaxBranches = parseOptionalIntWithinRange(formMaxBranchesPerStore, {
      min: 0,
      max: 500,
    });
    if (Number.isNaN(parsedMaxBranches)) {
      handleError(t(uiLocale, "systemAdmin.superadminManagement.error.invalidMaxBranchesPerStore"));
      return;
    }

    setLoadingKey("create-superadmin");
    setErrorMessage(null);

    const response = await authFetch("/api/system-admin/superadmins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: formName,
        email: formEmail,
        password: formPassword,
        canCreateStores: formCanCreateStores,
        maxStores: formCanCreateStores ? parsedMaxStores : null,
        canCreateBranches: formUseGlobalBranchPolicy ? null : formCanCreateBranches,
        maxBranchesPerStore:
          formUseGlobalBranchPolicy || !formCanCreateBranches ? null : parsedMaxBranches,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | {
          message?: string;
        }
      | null;

    if (!response.ok) {
      handleError(data?.message ?? t(uiLocale, "systemAdmin.superadminManagement.error.createFailed"));
      setLoadingKey(null);
      return;
    }

    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormCanCreateStores(true);
    setFormMaxStores("1");
    setFormUseGlobalBranchPolicy(true);
    setFormCanCreateBranches(globalBranchDefaults.defaultCanCreateBranches);
    setFormMaxBranchesPerStore(
      globalBranchDefaults.defaultMaxBranchesPerStore !== null
        ? String(globalBranchDefaults.defaultMaxBranchesPerStore)
        : "",
    );

    handleSuccess(t(uiLocale, "systemAdmin.superadminManagement.message.created"));
    setLoadingKey(null);
    refreshPage();
  };

  const updateStoreCreationConfig = async (userId: string) => {
    const canCreateStores = Boolean(draftCanCreateMap[userId]);
    const parsedMaxStores = parseOptionalIntWithinRange(draftMaxStoresMap[userId] ?? "", {
      min: 1,
      max: 100,
    });
    if (Number.isNaN(parsedMaxStores)) {
      handleError(t(uiLocale, "systemAdmin.superadminManagement.error.invalidMaxStores"));
      return;
    }

    const useGlobalBranchPolicy = Boolean(draftUseGlobalBranchMap[userId]);
    const canCreateBranches = Boolean(draftCanCreateBranchesMap[userId]);
    const parsedMaxBranches = parseOptionalIntWithinRange(
      draftMaxBranchesPerStoreMap[userId] ?? "",
      {
        min: 0,
        max: 500,
      },
    );
    if (Number.isNaN(parsedMaxBranches)) {
      handleError(t(uiLocale, "systemAdmin.superadminManagement.error.invalidMaxBranchesPerStore"));
      return;
    }

    setLoadingKey(`update-${userId}`);
    setErrorMessage(null);

    const response = await authFetch(`/api/system-admin/superadmins/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "set_store_creation_config",
        canCreateStores,
        maxStores: canCreateStores ? parsedMaxStores : null,
        canCreateBranches: useGlobalBranchPolicy ? null : canCreateBranches,
        maxBranchesPerStore:
          useGlobalBranchPolicy || !canCreateBranches ? null : parsedMaxBranches,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | {
          message?: string;
        }
      | null;

    if (!response.ok) {
      handleError(data?.message ?? t(uiLocale, "systemAdmin.superadminManagement.error.saveFailed"));
      setLoadingKey(null);
      return;
    }

    handleSuccess(t(uiLocale, "systemAdmin.superadminManagement.message.saved"));
    setLoadingKey(null);
    refreshPage();
  };

  const branchPolicyStatus = globalBranchDefaults.defaultCanCreateBranches
    ? t(uiLocale, "systemAdmin.superadminManagement.globalBranchPolicy.allowed")
    : t(uiLocale, "systemAdmin.superadminManagement.globalBranchPolicy.blocked");
  const branchPolicyQuota =
    globalBranchDefaults.defaultMaxBranchesPerStore !== null
      ? `${globalBranchDefaults.defaultMaxBranchesPerStore} ${t(
          uiLocale,
          "systemAdmin.superadminManagement.globalBranchPolicy.branchesSuffix",
        )}`
      : t(uiLocale, "systemAdmin.superadminManagement.globalBranchPolicy.unlimited");

  return (
    <section className="space-y-5">
      <article className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">
          {t(uiLocale, "systemAdmin.superadminManagement.create.title")}
        </h2>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground" htmlFor="superadmin-name">
            {t(uiLocale, "systemAdmin.superadminManagement.create.field.name")}
          </label>
          <input
            id="superadmin-name"
            value={formName}
            onChange={(event) => setFormName(event.target.value)}
            className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
            disabled={loadingKey !== null}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground" htmlFor="superadmin-email">
            {t(uiLocale, "systemAdmin.superadminManagement.create.field.email")}
          </label>
          <input
            id="superadmin-email"
            type="email"
            value={formEmail}
            onChange={(event) => setFormEmail(event.target.value)}
            className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
            disabled={loadingKey !== null}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground" htmlFor="superadmin-password">
            {t(uiLocale, "systemAdmin.superadminManagement.create.field.password")}
          </label>
          <input
            id="superadmin-password"
            type="password"
            value={formPassword}
            onChange={(event) => setFormPassword(event.target.value)}
            className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
            disabled={loadingKey !== null}
          />
        </div>

        <label className="flex items-center justify-between gap-2 rounded-md border border-dashed p-3 text-sm">
          <span>{t(uiLocale, "systemAdmin.superadminManagement.create.field.canCreateStores")}</span>
          <input
            type="checkbox"
            checked={formCanCreateStores}
            onChange={(event) => setFormCanCreateStores(event.target.checked)}
            disabled={loadingKey !== null}
          />
        </label>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground" htmlFor="superadmin-max-stores">
            {t(uiLocale, "systemAdmin.superadminManagement.create.field.maxStores")}
          </label>
          <input
            id="superadmin-max-stores"
            type="number"
            min={1}
            max={100}
            value={formMaxStores}
            onChange={(event) => setFormMaxStores(event.target.value)}
            className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
            disabled={loadingKey !== null || !formCanCreateStores}
          />
        </div>

        <div className="space-y-2 rounded-md border border-dashed p-3">
          <label className="flex items-center justify-between gap-2 text-sm">
            <span>
              {t(uiLocale, "systemAdmin.superadminManagement.create.field.useGlobalBranchPolicy")}
            </span>
            <input
              type="checkbox"
              checked={formUseGlobalBranchPolicy}
              onChange={(event) => setFormUseGlobalBranchPolicy(event.target.checked)}
              disabled={loadingKey !== null}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {t(uiLocale, "systemAdmin.superadminManagement.globalBranchPolicy.currentPrefix")}{" "}
            {branchPolicyStatus} / {t(uiLocale, "systemAdmin.superadminManagement.globalBranchPolicy.quotaPrefix")}{" "}
            {branchPolicyQuota}
          </p>

          {!formUseGlobalBranchPolicy ? (
            <>
              <label className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <span>
                  {t(uiLocale, "systemAdmin.superadminManagement.create.field.canCreateBranches")}
                </span>
                <input
                  type="checkbox"
                  checked={formCanCreateBranches}
                  onChange={(event) => setFormCanCreateBranches(event.target.checked)}
                  disabled={loadingKey !== null}
                />
              </label>
              <input
                type="number"
                min={0}
                max={500}
                value={formMaxBranchesPerStore}
                onChange={(event) => setFormMaxBranchesPerStore(event.target.value)}
                className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                placeholder={t(
                  uiLocale,
                  "systemAdmin.superadminManagement.create.field.maxBranchesPerStorePlaceholder",
                )}
                disabled={loadingKey !== null || !formCanCreateBranches}
              />
            </>
          ) : null}
        </div>

        <Button className="h-10 w-full" onClick={createSuperadmin} disabled={loadingKey !== null}>
          {loadingKey === "create-superadmin"
            ? t(uiLocale, "systemAdmin.superadminManagement.action.creating")
            : t(uiLocale, "systemAdmin.superadminManagement.action.create")}
        </Button>
      </article>

      <article className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">
          {t(uiLocale, "systemAdmin.superadminManagement.list.title")}
        </h2>

        <div className="space-y-3">
          {superadmins.map((item) => (
            <div key={item.userId} className="rounded-lg border p-3">
              <p className="text-sm font-semibold">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(uiLocale, "systemAdmin.superadminManagement.list.ownerStoresPrefix")}{" "}
                {item.activeOwnerStoreCount}
              </p>

              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{t(uiLocale, "systemAdmin.superadminManagement.list.field.canCreateStores")}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(draftCanCreateMap[item.userId])}
                      onChange={(event) =>
                        setDraftCanCreateMap((previous) => ({
                          ...previous,
                          [item.userId]: event.target.checked,
                        }))
                      }
                      disabled={loadingKey !== null}
                    />
                  </label>

                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draftMaxStoresMap[item.userId] ?? ""}
                    onChange={(event) =>
                      setDraftMaxStoresMap((previous) => ({
                        ...previous,
                        [item.userId]: event.target.value,
                      }))
                    }
                    placeholder={t(
                      uiLocale,
                      "systemAdmin.superadminManagement.list.field.maxStoresPlaceholder",
                    )}
                    className="h-9 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                    disabled={loadingKey !== null || !Boolean(draftCanCreateMap[item.userId])}
                  />
                </div>

                <div className="space-y-2 rounded-md border border-dashed p-2">
                  <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {t(uiLocale, "systemAdmin.superadminManagement.list.field.useGlobalBranchPolicy")}
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(draftUseGlobalBranchMap[item.userId])}
                      onChange={(event) =>
                        setDraftUseGlobalBranchMap((previous) => ({
                          ...previous,
                          [item.userId]: event.target.checked,
                        }))
                      }
                      disabled={loadingKey !== null}
                    />
                  </label>

                  {!Boolean(draftUseGlobalBranchMap[item.userId]) ? (
                    <>
                      <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {t(uiLocale, "systemAdmin.superadminManagement.list.field.canCreateBranches")}
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(draftCanCreateBranchesMap[item.userId])}
                          onChange={(event) =>
                            setDraftCanCreateBranchesMap((previous) => ({
                              ...previous,
                              [item.userId]: event.target.checked,
                            }))
                          }
                          disabled={loadingKey !== null}
                        />
                      </label>

                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={draftMaxBranchesPerStoreMap[item.userId] ?? ""}
                        onChange={(event) =>
                          setDraftMaxBranchesPerStoreMap((previous) => ({
                            ...previous,
                            [item.userId]: event.target.value,
                          }))
                        }
                        placeholder={t(
                          uiLocale,
                          "systemAdmin.superadminManagement.list.field.maxBranchesPerStorePlaceholder",
                        )}
                        className="h-9 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                        disabled={
                          loadingKey !== null ||
                          !Boolean(draftCanCreateBranchesMap[item.userId])
                        }
                      />
                    </>
                  ) : null}
                </div>

                <Button
                  variant="outline"
                  className="h-9"
                  onClick={() => updateStoreCreationConfig(item.userId)}
                  disabled={loadingKey !== null}
                >
                  {loadingKey === `update-${item.userId}`
                    ? t(uiLocale, "common.action.saving")
                    : t(uiLocale, "products.action.save")}
                </Button>
              </div>
            </div>
          ))}

          {superadmins.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(uiLocale, "systemAdmin.superadminManagement.empty")}
            </p>
          ) : null}
        </div>
      </article>

      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </section>
  );
}
