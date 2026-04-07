"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, Pencil, Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SystemAdminSaveButtonLabel,
  useSystemAdminSaveUi,
} from "@/components/system-admin/system-admin-save-feedback";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
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
  clientSuspended: boolean;
  clientSuspendedAt: string | null;
  clientSuspendedReason: string | null;
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

  const {
    state: editSaveState,
    reset: resetEditSaveUi,
    startSaving: startEditSaving,
    flashSuccess: flashEditSuccess,
    flashError: flashEditError,
  } = useSystemAdminSaveUi();

  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [listQuery, setListQuery] = useState("");
  const [suspensionTargetUserId, setSuspensionTargetUserId] = useState<string | null>(null);
  const [suspensionMode, setSuspensionMode] = useState<"disable" | "enable">("disable");
  const [suspensionConfirmEmail, setSuspensionConfirmEmail] = useState("");
  const [suspensionReason, setSuspensionReason] = useState("");

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
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

  useEffect(() => {
    resetEditSaveUi();
  }, [editingUserId, resetEditSaveUi]);

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

  useEffect(() => {
    // Keep edit drafts in sync with server data after router.refresh()/prop changes.
    setDraftCanCreateMap(
      Object.fromEntries(superadmins.map((item) => [item.userId, item.canCreateStores])),
    );
    setDraftMaxStoresMap(
      Object.fromEntries(
        superadmins.map((item) => [item.userId, item.maxStores ? String(item.maxStores) : ""]),
      ),
    );
    setDraftUseGlobalBranchMap(
      Object.fromEntries(
        superadmins.map((item) => [
          item.userId,
          item.canCreateBranches === null && item.maxBranchesPerStore === null,
        ]),
      ),
    );
    setDraftCanCreateBranchesMap(
      Object.fromEntries(
        superadmins.map((item) => [
          item.userId,
          typeof item.canCreateBranches === "boolean"
            ? item.canCreateBranches
            : globalBranchDefaults.defaultCanCreateBranches,
        ]),
      ),
    );
    setDraftMaxBranchesPerStoreMap(
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
  }, [
    superadmins,
    globalBranchDefaults.defaultCanCreateBranches,
    globalBranchDefaults.defaultMaxBranchesPerStore,
  ]);

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
    setIsPasswordVisible(false);
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
    setIsCreateOpen(false);
    setLoadingKey(null);
    refreshPage();
  };

  const updateStoreCreationConfig = async (userId: string) => {
    const canCreateStores = Boolean(draftCanCreateMap[userId]);
    const parsedMaxStores = (() => {
      if (!canCreateStores) return null;
      const parsed = parseOptionalIntWithinRange(draftMaxStoresMap[userId] ?? "", {
        min: 1,
        max: 100,
      });
      if (Number.isNaN(parsed)) return Number.NaN;
      return parsed;
    })();
    if (Number.isNaN(parsedMaxStores)) {
      handleError(t(uiLocale, "systemAdmin.superadminManagement.error.invalidMaxStores"));
      flashEditError();
      return;
    }

    const useGlobalBranchPolicy = Boolean(draftUseGlobalBranchMap[userId]);
    const canCreateBranches = Boolean(draftCanCreateBranchesMap[userId]);
    const parsedMaxBranches = (() => {
      if (useGlobalBranchPolicy || !canCreateBranches) return null;
      const parsed = parseOptionalIntWithinRange(draftMaxBranchesPerStoreMap[userId] ?? "", {
        min: 0,
        max: 500,
      });
      if (Number.isNaN(parsed)) return Number.NaN;
      return parsed;
    })();
    if (Number.isNaN(parsedMaxBranches)) {
      handleError(t(uiLocale, "systemAdmin.superadminManagement.error.invalidMaxBranchesPerStore"));
      flashEditError();
      return;
    }

    setLoadingKey(`update-${userId}`);
    setErrorMessage(null);
    startEditSaving();

    const response = await authFetch(`/api/system-admin/superadmins/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "set_store_creation_config",
        canCreateStores,
        maxStores: parsedMaxStores,
        canCreateBranches: useGlobalBranchPolicy ? null : canCreateBranches,
        maxBranchesPerStore: parsedMaxBranches,
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
      flashEditError();
      return;
    }

    handleSuccess(t(uiLocale, "systemAdmin.superadminManagement.message.saved"));
    setLoadingKey(null);
    flashEditSuccess();

    window.setTimeout(() => {
      setEditingUserId(null);
      refreshPage();
    }, 650);
  };

  const updateClientSuspension = async (userId: string, suspended: boolean) => {
    setLoadingKey(`suspension-${userId}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await authFetch(`/api/system-admin/superadmins/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "set_client_suspension",
        suspended,
        reason: suspensionReason.trim() ? suspensionReason.trim() : null,
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

    handleSuccess(
      suspended
        ? t(uiLocale, "systemAdmin.superadminManagement.message.clientDisabled")
        : t(uiLocale, "systemAdmin.superadminManagement.message.clientEnabled"),
    );
    setLoadingKey(null);
    setSuspensionTargetUserId(null);
    setSuspensionConfirmEmail("");
    setSuspensionReason("");
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

  const unlimitedLabel = t(uiLocale, "systemAdmin.superadminManagement.globalBranchPolicy.unlimited");

  const editingUser = editingUserId
    ? superadmins.find((item) => item.userId === editingUserId) ?? null
    : null;
  const suspensionTargetUser = suspensionTargetUserId
    ? superadmins.find((item) => item.userId === suspensionTargetUserId) ?? null
    : null;

  const editCanCreateStores = editingUserId ? Boolean(draftCanCreateMap[editingUserId]) : false;
  const editUseGlobalBranchPolicy = editingUserId
    ? Boolean(draftUseGlobalBranchMap[editingUserId])
    : true;
  const editCanCreateBranches = editingUserId
    ? Boolean(draftCanCreateBranchesMap[editingUserId])
    : globalBranchDefaults.defaultCanCreateBranches;

  const isEditDirty = (() => {
    if (!editingUserId || !editingUser) return false;

    const nextCanCreateStores = editCanCreateStores;
    const nextMaxStores = (() => {
      if (!editCanCreateStores) return null;
      const parsed = parseOptionalIntWithinRange(draftMaxStoresMap[editingUserId] ?? "", {
        min: 1,
        max: 100,
      });
      if (Number.isNaN(parsed)) return Number.NaN;
      return parsed;
    })();
    if (Number.isNaN(nextMaxStores)) return true;

    const nextCanCreateBranches = editUseGlobalBranchPolicy ? null : editCanCreateBranches;
    const nextMaxBranchesPerStore = (() => {
      if (editUseGlobalBranchPolicy || !editCanCreateBranches) return null;
      const parsed = parseOptionalIntWithinRange(
        draftMaxBranchesPerStoreMap[editingUserId] ?? "",
        { min: 0, max: 500 },
      );
      if (Number.isNaN(parsed)) return Number.NaN;
      return parsed;
    })();
    if (Number.isNaN(nextMaxBranchesPerStore)) return true;

    return (
      editingUser.canCreateStores !== nextCanCreateStores ||
      editingUser.maxStores !== nextMaxStores ||
      editingUser.canCreateBranches !== nextCanCreateBranches ||
      editingUser.maxBranchesPerStore !== nextMaxBranchesPerStore
    );
  })();

  const deferredListQuery = useDeferredValue(listQuery);
  const visibleSuperadmins = useMemo(() => {
    const q = deferredListQuery.trim().toLowerCase();
    if (!q) return superadmins;
    return superadmins.filter((item) => {
      const name = (item.name ?? "").toLowerCase();
      const email = (item.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [deferredListQuery, superadmins]);

  const renderStatePill = (enabled: boolean) => (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        enabled
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700",
      ].join(" ")}
    >
      {enabled ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {t(uiLocale, enabled ? "common.state.on" : "common.state.off")}
    </span>
  );

  const renderClientStatusPill = (suspended: boolean) => (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        suspended
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
      ].join(" ")}
    >
      {suspended ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
      {t(
        uiLocale,
        suspended
          ? "systemAdmin.superadminManagement.clientStatus.suspended"
          : "systemAdmin.superadminManagement.clientStatus.active",
      )}
    </span>
  );

  return (
    <section className="space-y-5">
      <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {t(uiLocale, "systemAdmin.superadminManagement.list.title")}
          </h2>
          <Button
            type="button"
            className="h-9 rounded-full px-3 text-xs font-semibold"
            onClick={() => {
              setSuccessMessage(null);
              setErrorMessage(null);
              setIsCreateOpen(true);
            }}
            disabled={loadingKey !== null}
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t(uiLocale, "systemAdmin.superadminManagement.action.create")}
            </span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={listQuery}
              onChange={(event) => setListQuery(event.target.value)}
              placeholder={t(uiLocale, "systemAdmin.superadminManagement.list.search.placeholder")}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm outline-none ring-primary transition focus:border-slate-300 focus:ring-2 disabled:opacity-50"
              disabled={loadingKey !== null}
            />
            <div className="absolute inset-y-0 right-3 flex items-center">
              {listQuery ? (
                <button
                  type="button"
                  onClick={() => setListQuery("")}
                  className="text-slate-400 hover:text-slate-600 disabled:pointer-events-none"
                  aria-label={t(uiLocale, "systemAdmin.superadminManagement.list.search.clearAriaLabel")}
                  title={t(uiLocale, "systemAdmin.superadminManagement.list.search.clearAriaLabel")}
                  disabled={loadingKey !== null}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">
            {t(uiLocale, "systemAdmin.superadminManagement.globalBranchPolicy.currentPrefix")}
          </span>{" "}
          {branchPolicyStatus} •{" "}
          {t(uiLocale, "systemAdmin.superadminManagement.globalBranchPolicy.quotaPrefix")}{" "}
          {branchPolicyQuota}
        </div>

        <div className="space-y-2">
          {visibleSuperadmins.map((item) => (
            <div
              key={item.userId}
              className="rounded-2xl border border-slate-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                    {item.name?.trim()?.slice(0, 1)?.toUpperCase() ?? "?"}
                  </div>
	                  <div className="min-w-0">
	                    <div className="flex flex-wrap items-center gap-2">
	                      <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
	                      {renderClientStatusPill(item.clientSuspended)}
	                    </div>
	                    <p className="truncate text-xs text-slate-500">{item.email}</p>
	                    <p className="mt-1 text-[11px] text-slate-500">
	                      {t(uiLocale, "systemAdmin.superadminManagement.list.ownerStoresPrefix")}{" "}
	                      <span className="font-semibold text-slate-700">{item.activeOwnerStoreCount}</span>
	                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-full px-3 text-xs font-semibold"
                  disabled={loadingKey !== null}
                  onClick={() => {
                    setSuccessMessage(null);
                    setErrorMessage(null);
                    setEditingUserId(item.userId);
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    {t(uiLocale, "common.action.edit")}
                  </span>
                </Button>
              </div>

              <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-2">
                  <span>{t(uiLocale, "systemAdmin.superadminManagement.list.summary.storeCreation")}</span>
                  {renderStatePill(item.canCreateStores)}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>{t(uiLocale, "systemAdmin.superadminManagement.list.summary.maxStores")}</span>
                  <span className="font-semibold text-slate-800">
                    {item.canCreateStores
                      ? typeof item.maxStores === "number" ? item.maxStores : unlimitedLabel
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 sm:col-span-2">
                  <span>{t(uiLocale, "systemAdmin.superadminManagement.list.summary.branchPolicy")}</span>
                  {(() => {
                    const useGlobal =
                      item.canCreateBranches === null && item.maxBranchesPerStore === null;

                    const effectiveCanCreateBranches = useGlobal
                      ? globalBranchDefaults.defaultCanCreateBranches
                      : typeof item.canCreateBranches === "boolean"
                        ? item.canCreateBranches
                        : globalBranchDefaults.defaultCanCreateBranches;

                    const effectiveQuota = useGlobal
                      ? globalBranchDefaults.defaultMaxBranchesPerStore
                      : item.maxBranchesPerStore;

                    const quotaLabel = effectiveCanCreateBranches
                      ? typeof effectiveQuota === "number"
                        ? `${effectiveQuota} ${t(
                            uiLocale,
                            "systemAdmin.superadminManagement.globalBranchPolicy.branchesSuffix",
                          )}`
                        : unlimitedLabel
                      : "-";

                    return (
                      <span className="flex flex-wrap items-center justify-end gap-2 text-right font-semibold text-slate-800">
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {t(
                            uiLocale,
                            useGlobal
                              ? "systemAdmin.superadminManagement.list.summary.mode.global"
                              : "systemAdmin.superadminManagement.list.summary.mode.override",
                          )}
                        </span>
                        {renderStatePill(effectiveCanCreateBranches)}
                        <span className="text-xs text-slate-700">{quotaLabel}</span>
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}

          {superadmins.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(uiLocale, "systemAdmin.superadminManagement.empty")}
            </p>
          ) : visibleSuperadmins.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(uiLocale, "systemAdmin.superadminManagement.list.search.empty")}
            </p>
          ) : null}
        </div>
      </article>

      <SlideUpSheet
        isOpen={editingUserId !== null}
        onClose={() => setEditingUserId(null)}
        title={
          editingUser
            ? `${t(uiLocale, "common.action.edit")} • ${editingUser.name}`
            : t(uiLocale, "common.action.edit")
        }
        disabled={loadingKey !== null}
        scrollToTopOnOpen
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9"
              disabled={loadingKey !== null}
              onClick={() => setEditingUserId(null)}
            >
              {t(uiLocale, "common.action.cancel")}
            </Button>
            <Button
              type="button"
              className="h-9"
              disabled={
                loadingKey !== null ||
                !editingUserId ||
                editSaveState === "success" ||
                !isEditDirty
              }
              onClick={() => {
                if (!editingUserId) return;
                updateStoreCreationConfig(editingUserId);
              }}
            >
              <SystemAdminSaveButtonLabel
                uiLocale={uiLocale}
                state={
                  loadingKey === (editingUserId ? `update-${editingUserId}` : "")
                    ? "saving"
                    : editSaveState
                }
                idleLabel={t(uiLocale, "systemAdmin.common.action.save")}
              />
            </Button>
          </div>
        }
      >
	        {editingUser ? (
	          <div className="space-y-3">
	            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
	              <div className="flex flex-wrap items-center justify-between gap-2">
	                <div className="min-w-0">
	                  <p className="text-sm font-semibold text-slate-900">{editingUser.name}</p>
	                  <p className="text-xs text-slate-600">{editingUser.email}</p>
	                </div>
	                {renderClientStatusPill(editingUser.clientSuspended)}
	              </div>
	            </div>

	            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
	              <p className="text-xs font-semibold text-slate-700">
	                {t(uiLocale, "systemAdmin.superadminManagement.section.clientStatus")}
	              </p>
	              {editingUser.clientSuspendedAt ? (
	                <p className="text-xs text-slate-600">
	                  {t(uiLocale, "systemAdmin.superadminManagement.clientStatus.suspendedAtPrefix")}{" "}
	                  <span className="font-semibold text-slate-800">{editingUser.clientSuspendedAt}</span>
	                </p>
	              ) : null}
	              {editingUser.clientSuspendedReason ? (
	                <p className="text-xs text-slate-600">
	                  {t(uiLocale, "systemAdmin.superadminManagement.clientStatus.reasonPrefix")}{" "}
	                  <span className="font-semibold text-slate-800">
	                    {editingUser.clientSuspendedReason}
	                  </span>
	                </p>
	              ) : null}
	              <Button
	                type="button"
	                variant="outline"
	                className={[
	                  "h-10 w-full rounded-full text-xs font-semibold",
	                  editingUser.clientSuspended
	                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
	                    : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
	                ].join(" ")}
	                disabled={loadingKey !== null}
	                onClick={() => {
	                  setSuccessMessage(null);
	                  setErrorMessage(null);
	                  setSuspensionMode(editingUser.clientSuspended ? "enable" : "disable");
	                  setSuspensionTargetUserId(editingUser.userId);
	                  setSuspensionConfirmEmail("");
	                  setSuspensionReason("");
	                  setEditingUserId(null);
	                }}
	              >
	                {editingUser.clientSuspended
	                  ? t(uiLocale, "systemAdmin.superadminManagement.action.enableClient")
	                  : t(uiLocale, "systemAdmin.superadminManagement.action.disableClient")}
	              </Button>
	            </div>
	
	            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
	              <span className="font-medium text-slate-800">
	                {t(uiLocale, "systemAdmin.superadminManagement.list.field.canCreateStores")}
	              </span>
              <input
                type="checkbox"
                checked={editCanCreateStores}
                onChange={(event) =>
                  setDraftCanCreateMap((previous) => ({
                    ...previous,
                    [editingUser.userId]: event.target.checked,
                  }))
                }
                disabled={loadingKey !== null}
              />
            </label>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600" htmlFor="edit-max-stores">
                {t(uiLocale, "systemAdmin.superadminManagement.list.field.maxStoresPlaceholder")}
              </label>
              <input
                id="edit-max-stores"
                type="number"
                min={1}
                max={100}
                value={draftMaxStoresMap[editingUser.userId] ?? ""}
                onChange={(event) =>
                  setDraftMaxStoresMap((previous) => ({
                    ...previous,
                    [editingUser.userId]: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
                disabled={loadingKey !== null || !editCanCreateStores}
              />
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-800">
                  {t(uiLocale, "systemAdmin.superadminManagement.list.field.useGlobalBranchPolicy")}
                </span>
                <input
                  type="checkbox"
                  checked={editUseGlobalBranchPolicy}
                  onChange={(event) =>
                    setDraftUseGlobalBranchMap((previous) => ({
                      ...previous,
                      [editingUser.userId]: event.target.checked,
                    }))
                  }
                  disabled={loadingKey !== null}
                />
              </label>
              <p className="text-xs text-slate-600">
                {t(uiLocale, "systemAdmin.superadminManagement.globalBranchPolicy.currentPrefix")}{" "}
                {branchPolicyStatus} •{" "}
                {t(uiLocale, "systemAdmin.superadminManagement.globalBranchPolicy.quotaPrefix")}{" "}
                {branchPolicyQuota}
              </p>

              {!editUseGlobalBranchPolicy ? (
                <div className="space-y-2 pt-2">
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2 text-sm">
                    <span className="font-medium text-slate-800">
                      {t(uiLocale, "systemAdmin.superadminManagement.list.field.canCreateBranches")}
                    </span>
                    <input
                      type="checkbox"
                      checked={editCanCreateBranches}
                      onChange={(event) =>
                        setDraftCanCreateBranchesMap((previous) => ({
                          ...previous,
                          [editingUser.userId]: event.target.checked,
                        }))
                      }
                      disabled={loadingKey !== null}
                    />
                  </label>

                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={draftMaxBranchesPerStoreMap[editingUser.userId] ?? ""}
                    onChange={(event) =>
                      setDraftMaxBranchesPerStoreMap((previous) => ({
                        ...previous,
                        [editingUser.userId]: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
                    placeholder={t(
                      uiLocale,
                      "systemAdmin.superadminManagement.list.field.maxBranchesPerStorePlaceholder",
                    )}
                    disabled={loadingKey !== null || !editCanCreateBranches}
                  />
                </div>
              ) : null}
            </div>

            {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          </div>
        ) : null}
	      </SlideUpSheet>

	      <SlideUpSheet
	        isOpen={suspensionTargetUserId !== null}
	        onClose={() => setSuspensionTargetUserId(null)}
	        title={
	          suspensionMode === "disable"
	            ? t(uiLocale, "systemAdmin.superadminManagement.disableClient.title")
	            : t(uiLocale, "systemAdmin.superadminManagement.enableClient.title")
	        }
	        disabled={loadingKey !== null}
	        scrollToTopOnOpen
	        footer={
	          <div className="grid grid-cols-2 gap-2">
	            <Button
	              type="button"
	              variant="outline"
	              className="h-9"
	              disabled={loadingKey !== null}
	              onClick={() => setSuspensionTargetUserId(null)}
	            >
	              {t(uiLocale, "common.action.cancel")}
	            </Button>
	            <Button
	              type="button"
	              className={[
	                "h-9",
	                suspensionMode === "disable" ? "bg-rose-600 text-white hover:opacity-95" : "",
	              ].join(" ")}
	              disabled={
	                loadingKey !== null ||
	                !suspensionTargetUser ||
	                suspensionConfirmEmail.trim().toLowerCase() !==
	                  (suspensionTargetUser?.email ?? "").trim().toLowerCase()
	              }
	              onClick={() => {
	                if (!suspensionTargetUserId) return;
	                updateClientSuspension(suspensionTargetUserId, suspensionMode === "disable");
	              }}
	            >
	              {loadingKey ===
	              (suspensionTargetUserId ? `suspension-${suspensionTargetUserId}` : "")
	                ? t(uiLocale, "common.action.saving")
	                : suspensionMode === "disable"
	                  ? t(uiLocale, "systemAdmin.superadminManagement.action.confirmDisableClient")
	                  : t(uiLocale, "systemAdmin.superadminManagement.action.confirmEnableClient")}
	            </Button>
	          </div>
	        }
	      >
	        {suspensionTargetUser ? (
	          <div className="space-y-3">
	            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
	              <p className="text-sm font-semibold text-slate-900">{suspensionTargetUser.name}</p>
	              <p className="text-xs text-slate-600">{suspensionTargetUser.email}</p>
	            </div>

	            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
	              {t(
	                uiLocale,
	                suspensionMode === "disable"
	                  ? "systemAdmin.superadminManagement.disableClient.warning"
	                  : "systemAdmin.superadminManagement.enableClient.warning",
	              )}
	            </p>

	            <div className="space-y-2">
	              <label
	                className="text-xs font-medium text-slate-600"
	                htmlFor="client-suspension-reason"
	              >
	                {t(uiLocale, "systemAdmin.superadminManagement.disableClient.reasonLabel")}
	              </label>
	              <input
	                id="client-suspension-reason"
	                type="text"
	                value={suspensionReason}
	                onChange={(event) => setSuspensionReason(event.target.value)}
	                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
	                disabled={loadingKey !== null}
	                placeholder={t(
	                  uiLocale,
	                  "systemAdmin.superadminManagement.disableClient.reasonPlaceholder",
	                )}
	              />
	            </div>

	            <div className="space-y-2">
	              <label
	                className="text-xs font-medium text-slate-600"
	                htmlFor="client-suspension-confirm-email"
	              >
	                {t(uiLocale, "systemAdmin.superadminManagement.disableClient.confirmEmailLabel")}
	              </label>
	              <input
	                id="client-suspension-confirm-email"
	                type="email"
	                value={suspensionConfirmEmail}
	                onChange={(event) => setSuspensionConfirmEmail(event.target.value)}
	                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
	                disabled={loadingKey !== null}
	                placeholder={suspensionTargetUser.email}
	              />
	              <p className="text-xs text-slate-500">
	                {t(uiLocale, "systemAdmin.superadminManagement.disableClient.confirmEmailHint")}
	              </p>
	            </div>

	            {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
	          </div>
	        ) : null}
	      </SlideUpSheet>

	      <SlideUpSheet
	        isOpen={isCreateOpen}
	        onClose={() => setIsCreateOpen(false)}
	        title={t(uiLocale, "systemAdmin.superadminManagement.create.title")}
        disabled={loadingKey !== null}
        scrollToTopOnOpen
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9"
              disabled={loadingKey !== null}
              onClick={() => setIsCreateOpen(false)}
            >
              {t(uiLocale, "common.action.cancel")}
            </Button>
            <Button
              type="button"
              className="h-9"
              disabled={loadingKey !== null}
              onClick={createSuperadmin}
            >
              {loadingKey === "create-superadmin"
                ? t(uiLocale, "systemAdmin.superadminManagement.action.creating")
                : t(uiLocale, "systemAdmin.superadminManagement.action.create")}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600" htmlFor="superadmin-name">
              {t(uiLocale, "systemAdmin.superadminManagement.create.field.name")}
            </label>
            <input
              id="superadmin-name"
              value={formName}
              onChange={(event) => setFormName(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
              disabled={loadingKey !== null}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600" htmlFor="superadmin-email">
              {t(uiLocale, "systemAdmin.superadminManagement.create.field.email")}
            </label>
            <input
              id="superadmin-email"
              type="email"
              value={formEmail}
              onChange={(event) => setFormEmail(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
              disabled={loadingKey !== null}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600" htmlFor="superadmin-password">
              {t(uiLocale, "systemAdmin.superadminManagement.create.field.password")}
            </label>
            <div className="flex h-10 w-full overflow-hidden rounded-md border border-slate-300 bg-white ring-primary transition focus-within:ring-2">
              <input
                id="superadmin-password"
                type={isPasswordVisible ? "text" : "password"}
                value={formPassword}
                onChange={(event) => setFormPassword(event.target.value)}
                className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none disabled:opacity-50"
                disabled={loadingKey !== null}
              />
              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center border-l text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-50"
                onClick={() => setIsPasswordVisible((prev) => !prev)}
                onMouseDown={(event) => event.preventDefault()}
                disabled={loadingKey !== null}
                aria-label={isPasswordVisible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                title={isPasswordVisible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <span className="font-medium text-slate-800">
              {t(uiLocale, "systemAdmin.superadminManagement.create.field.canCreateStores")}
            </span>
            <input
              type="checkbox"
              checked={formCanCreateStores}
              onChange={(event) => setFormCanCreateStores(event.target.checked)}
              disabled={loadingKey !== null}
            />
          </label>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600" htmlFor="superadmin-max-stores">
              {t(uiLocale, "systemAdmin.superadminManagement.create.field.maxStores")}
            </label>
            <input
              id="superadmin-max-stores"
              type="number"
              min={1}
              max={100}
              value={formMaxStores}
              onChange={(event) => setFormMaxStores(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
              disabled={loadingKey !== null || !formCanCreateStores}
            />
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-800">
                {t(uiLocale, "systemAdmin.superadminManagement.create.field.useGlobalBranchPolicy")}
              </span>
              <input
                type="checkbox"
                checked={formUseGlobalBranchPolicy}
                onChange={(event) => setFormUseGlobalBranchPolicy(event.target.checked)}
                disabled={loadingKey !== null}
              />
            </label>
            <p className="text-xs text-slate-600">
              {t(uiLocale, "systemAdmin.superadminManagement.globalBranchPolicy.currentPrefix")}{" "}
              {branchPolicyStatus} / {t(uiLocale, "systemAdmin.superadminManagement.globalBranchPolicy.quotaPrefix")}{" "}
              {branchPolicyQuota}
            </p>

            {!formUseGlobalBranchPolicy ? (
              <div className="space-y-2 pt-2">
                <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2 text-sm">
                  <span className="font-medium text-slate-800">
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
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-primary transition focus:ring-2"
                  placeholder={t(
                    uiLocale,
                    "systemAdmin.superadminManagement.create.field.maxBranchesPerStorePlaceholder",
                  )}
                  disabled={loadingKey !== null || !formCanCreateBranches}
                />
              </div>
            ) : null}
          </div>
        </div>
      </SlideUpSheet>

      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </section>
  );
}
