"use client";

import { Check, ChevronRight, Copy, Info, KeyRound, Loader2, Mail, Plus, Search, Smartphone, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { authFetch } from "@/lib/auth/client-token";
import { uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";

type MemberItem = {
  userId: string;
  email: string;
  name: string;
  systemRole: "USER" | "SUPERADMIN" | "SYSTEM_ADMIN";
  mustChangePassword: boolean;
  sessionLimit: number | null;
  createdByUserId: string | null;
  createdByName: string | null;
  roleId: string;
  roleName: string;
  status: "ACTIVE" | "INVITED" | "SUSPENDED";
  joinedAt: string;
  addedByUserId: string | null;
  addedByName: string | null;
};

type RoleOption = {
  id: string;
  name: string;
};

type BranchOption = {
  id: string;
  name: string;
  code: string | null;
};

type ExistingUserCandidate = {
  userId: string;
  name: string;
  email: string;
  sourceStores: string[];
};

type UsersManagementProps = {
  members: MemberItem[];
  roles: RoleOption[];
  branches: BranchOption[];
  canCreate: boolean;
  canUpdate: boolean;
  canLinkExisting: boolean;
  defaultSessionLimit: number;
};

const statusToneClassName: Record<MemberItem["status"], string> = {
  ACTIVE: "text-emerald-700",
  INVITED: "text-amber-700",
  SUSPENDED: "text-rose-700",
};

const statusDotClassName: Record<MemberItem["status"], string> = {
  ACTIVE: "bg-emerald-500",
  INVITED: "bg-amber-500",
  SUSPENDED: "bg-rose-500",
};

const getInitial = (name: string, email: string) => {
  const text = name.trim() || email.trim();
  if (!text) {
    return "U";
  }
  return text.slice(0, 1).toUpperCase();
};

const getDefaultRoleId = (roleOptions: RoleOption[]) => {
  const staffRole = roleOptions.find((role) => role.name.trim().toLowerCase() === "staff");
  return staffRole?.id ?? roleOptions[0]?.id ?? "";
};

const normalizeBranchIds = (branchIds: string[]) =>
  [...new Set(branchIds)].sort((a, b) => a.localeCompare(b));

export function UsersManagement({
  members,
  roles,
  branches,
  canCreate,
  canUpdate,
  canLinkExisting,
  defaultSessionLimit,
}: UsersManagementProps) {
  const router = useRouter();
  const uiLocale = useUiLocale();
  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const fmtNumber = (value: number) => value.toLocaleString(numberLocale);
  const statusLabel = useMemo(
    () => ({
      ACTIVE: t(uiLocale, "users.status.ACTIVE"),
      INVITED: t(uiLocale, "users.status.INVITED"),
      SUSPENDED: t(uiLocale, "users.status.SUSPENDED"),
    }),
    [uiLocale],
  );
  const statusCompactLabel = useMemo(
    () => ({
      ACTIVE: t(uiLocale, "users.statusShort.ACTIVE"),
      INVITED: t(uiLocale, "users.statusShort.INVITED"),
      SUSPENDED: t(uiLocale, "users.statusShort.SUSPENDED"),
    }),
    [uiLocale],
  );
  const statusOptions = useMemo(
    () =>
      [
        { value: "ACTIVE" as const, label: statusLabel.ACTIVE },
        { value: "INVITED" as const, label: statusLabel.INVITED },
        { value: "SUSPENDED" as const, label: statusLabel.SUSPENDED },
      ] satisfies Array<{ value: MemberItem["status"]; label: string }>,
    [statusLabel],
  );
  const normalizeSessionLimit = (value: string) => {
    const raw = value.trim();
    if (!raw) {
      return { ok: true as const, value: null as number | null };
    }

    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
      return {
        ok: false as const,
        message: t(uiLocale, "users.sessionLimit.validationError"),
      };
    }

    return { ok: true as const, value: parsed };
  };
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null);
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"new" | "existing">("new");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [isResetPasswordConfirmOpen, setIsResetPasswordConfirmOpen] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [createdTemporaryPassword, setCreatedTemporaryPassword] = useState<string | null>(null);
  const [createdUserEmail, setCreatedUserEmail] = useState<string>("");

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRoleId, setFormRoleId] = useState<string>(() => getDefaultRoleId(roles));
  const [existingQuery, setExistingQuery] = useState("");
  const [existingRoleId, setExistingRoleId] = useState<string>(() => getDefaultRoleId(roles));
  const [existingCandidates, setExistingCandidates] = useState<ExistingUserCandidate[]>([]);
  const [existingCandidatesError, setExistingCandidatesError] = useState<string | null>(null);
  const [selectedExistingUserId, setSelectedExistingUserId] = useState<string>("");
  const [isLoadingExistingCandidates, setIsLoadingExistingCandidates] = useState(false);

  const [editRoleId, setEditRoleId] = useState<string>("");
  const [editStatus, setEditStatus] = useState<MemberItem["status"]>("ACTIVE");
  const [editSessionLimit, setEditSessionLimit] = useState<string>("");
  const [isLoadingEditBranchAccess, setIsLoadingEditBranchAccess] = useState(false);
  const [editBranchMode, setEditBranchMode] = useState<"ALL" | "SELECTED">("ALL");
  const [editBranchIds, setEditBranchIds] = useState<string[]>([]);
  const [initialEditBranchMode, setInitialEditBranchMode] = useState<"ALL" | "SELECTED">("ALL");
  const [initialEditBranchIds, setInitialEditBranchIds] = useState<string[]>([]);

  const rolesById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);
  const membersById = useMemo(() => new Map(members.map((member) => [member.userId, member])), [members]);
  const editingMember = editingMemberId ? membersById.get(editingMemberId) ?? null : null;
  const isEditModalOpen = Boolean(editingMember);

  useEffect(() => {
    const defaultRoleId = getDefaultRoleId(roles);
    setFormRoleId((current) =>
      roles.some((role) => role.id === current) ? current : defaultRoleId,
    );
    setExistingRoleId((current) =>
      roles.some((role) => role.id === current) ? current : defaultRoleId,
    );
  }, [roles]);

  const openCreateModal = () => {
    if (!canCreate) {
      return;
    }
    setCreateErrorMessage(null);
    setExistingCandidatesError(null);
    setCreatedTemporaryPassword(null);
    setCreatedUserEmail("");
    setCreateMode("new");
    setFormRoleId(getDefaultRoleId(roles));
    setExistingRoleId(getDefaultRoleId(roles));
    setExistingQuery("");
    setExistingCandidates([]);
    setSelectedExistingUserId("");
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (loadingKey === "create-user" || loadingKey === "add-existing-user") {
      return;
    }
    setIsCreateModalOpen(false);
    setCreateErrorMessage(null);
    setExistingCandidatesError(null);
    setCreatedTemporaryPassword(null);
    setCreatedUserEmail("");
  };

  const loadMemberBranchAccess = async (userId: string) => {
    setIsLoadingEditBranchAccess(true);
    const response = await authFetch(`/api/settings/users/${userId}`, {
      method: "GET",
      cache: "no-store",
    });

    const data = (await response.json().catch(() => null)) as
      | {
          message?: string;
          branchAccess?: {
            mode?: "ALL" | "SELECTED";
            branchIds?: string[];
          };
        }
      | null;

    if (!response.ok) {
      setEditErrorMessage(data?.message ?? t(uiLocale, "users.branchAccess.error.loadFailed"));
      setIsLoadingEditBranchAccess(false);
      return;
    }

    const mode = data?.branchAccess?.mode === "SELECTED" ? "SELECTED" : "ALL";
    const branchIds = normalizeBranchIds(data?.branchAccess?.branchIds ?? []);
    const normalizedBranchIds = mode === "SELECTED" ? branchIds : [];
    setEditBranchMode(mode);
    setEditBranchIds(normalizedBranchIds);
    setInitialEditBranchMode(mode);
    setInitialEditBranchIds(normalizedBranchIds);
    setIsLoadingEditBranchAccess(false);
  };

  const openEditModal = (member: MemberItem) => {
    setEditErrorMessage(null);
    setEditingMemberId(member.userId);
    setEditRoleId(member.roleId);
    setEditStatus(member.status);
    setEditSessionLimit(member.sessionLimit?.toString() ?? "");
    setEditBranchMode("ALL");
    setEditBranchIds([]);
    setInitialEditBranchMode("ALL");
    setInitialEditBranchIds([]);
    void loadMemberBranchAccess(member.userId);
    setIsResetPasswordConfirmOpen(false);
    setTemporaryPassword(null);
  };

  const closeEditModal = () => {
    if (loadingKey === "save-member" || loadingKey === "reset-password") {
      return;
    }
    setEditingMemberId(null);
    setEditErrorMessage(null);
    setIsLoadingEditBranchAccess(false);
    setEditBranchMode("ALL");
    setEditBranchIds([]);
    setInitialEditBranchMode("ALL");
    setInitialEditBranchIds([]);
    setIsResetPasswordConfirmOpen(false);
    setTemporaryPassword(null);
  };

  const loadExistingCandidates = useCallback(async (query: string) => {
    setIsLoadingExistingCandidates(true);
    setExistingCandidatesError(null);

    const searchParams = new URLSearchParams();
    const normalizedQuery = query.trim();
    if (normalizedQuery) {
      searchParams.set("q", normalizedQuery);
    }
    const queryString = searchParams.toString();
    const endpoint = queryString
      ? `/api/settings/users/candidates?${queryString}`
      : "/api/settings/users/candidates";

    try {
      const response = await authFetch(endpoint, {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as
        | {
            message?: string;
            candidates?: ExistingUserCandidate[];
          }
        | null;

      if (!response.ok) {
        setExistingCandidates([]);
        setExistingCandidatesError(
          data?.message ?? t(uiLocale, "users.existingCandidates.error.loadFailed"),
        );
        return;
      }

      const nextCandidates = data?.candidates ?? [];
      setExistingCandidates(nextCandidates);
      setSelectedExistingUserId((current) =>
        nextCandidates.some((item) => item.userId === current) ? current : "",
      );
    } catch {
      setExistingCandidates([]);
      setExistingCandidatesError(t(uiLocale, "users.existingCandidates.error.loadFailed"));
    } finally {
      setIsLoadingExistingCandidates(false);
    }
  }, [uiLocale]);

  useEffect(() => {
    if (!isCreateModalOpen || createMode !== "existing" || !canLinkExisting) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadExistingCandidates(existingQuery);
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isCreateModalOpen, createMode, canLinkExisting, existingQuery, loadExistingCandidates]);

  const copyTextToClipboard = async (text: string, successMessage: string) => {
    if (!text || typeof window === "undefined" || !window.navigator?.clipboard) {
      return;
    }

    try {
      await window.navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error(t(uiLocale, "users.clipboard.copyFailed"));
    }
  };

  const copyTemporaryPassword = async () => {
    if (!temporaryPassword) {
      return;
    }
    await copyTextToClipboard(temporaryPassword, t(uiLocale, "users.clipboard.copyTempPasswordSuccess"));
  };

  const copyCreatedTemporaryPassword = async () => {
    if (!createdTemporaryPassword) {
      return;
    }
    await copyTextToClipboard(
      createdTemporaryPassword,
      t(uiLocale, "users.clipboard.copyInitialPasswordSuccess"),
    );
  };

  const resetMemberPassword = async () => {
    if (!editingMember) {
      return;
    }

    setLoadingKey("reset-password");
    setEditErrorMessage(null);

    const response = await authFetch(`/api/settings/users/${editingMember.userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "reset_password",
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | {
          message?: string;
          temporaryPassword?: string;
        }
      | null;

    if (!response.ok) {
      setEditErrorMessage(data?.message ?? t(uiLocale, "users.resetPassword.error.failed"));
      setLoadingKey(null);
      return;
    }

    if (!data?.temporaryPassword) {
      setEditErrorMessage(t(uiLocale, "users.resetPassword.error.missingTempPassword"));
      setLoadingKey(null);
      return;
    }

    setTemporaryPassword(data.temporaryPassword);
    setIsResetPasswordConfirmOpen(false);
    toast.success(t(uiLocale, "users.resetPassword.toast.success"));
    setLoadingKey(null);
    router.refresh();
  };

  const createUser = async () => {
    if (!formRoleId) {
      setCreateErrorMessage(t(uiLocale, "users.create.validation.roleRequired"));
      return;
    }

    if (!formName.trim() || !formEmail.trim()) {
      setCreateErrorMessage(t(uiLocale, "users.create.validation.nameEmailRequired"));
      return;
    }

    setLoadingKey("create-user");
    setCreateErrorMessage(null);

    const response = await authFetch("/api/settings/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "create_new",
        name: formName,
        email: formEmail,
        roleId: formRoleId,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | {
          message?: string;
          temporaryPassword?: string;
        }
      | null;

    if (!response.ok) {
      setCreateErrorMessage(data?.message ?? t(uiLocale, "users.create.error.failed"));
      setLoadingKey(null);
      return;
    }

    if (!data?.temporaryPassword) {
      setCreateErrorMessage(t(uiLocale, "users.resetPassword.error.missingTempPassword"));
      setLoadingKey(null);
      return;
    }

    setCreatedTemporaryPassword(data.temporaryPassword);
    setCreatedUserEmail(formEmail.trim().toLowerCase());
    setFormName("");
    setFormEmail("");
    toast.success(t(uiLocale, "users.create.toast.success"));
    setLoadingKey(null);
    router.refresh();
  };

  const addExistingUserToStore = async () => {
    if (!existingRoleId) {
      setCreateErrorMessage(t(uiLocale, "users.create.validation.roleRequired"));
      return;
    }

    if (!selectedExistingUserId) {
      setCreateErrorMessage(t(uiLocale, "users.create.validation.existingUserRequired"));
      return;
    }

    setLoadingKey("add-existing-user");
    setCreateErrorMessage(null);

    const response = await authFetch("/api/settings/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "add_existing",
        userId: selectedExistingUserId,
        roleId: existingRoleId,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | {
          message?: string;
        }
      | null;

    if (!response.ok) {
      setCreateErrorMessage(data?.message ?? t(uiLocale, "users.create.error.addExistingFailed"));
      setLoadingKey(null);
      return;
    }

    setExistingQuery("");
    setExistingCandidates([]);
    setSelectedExistingUserId("");
    setExistingCandidatesError(null);
    setIsCreateModalOpen(false);
    toast.success(t(uiLocale, "users.create.toast.addExistingSuccess"));
    setLoadingKey(null);
    router.refresh();
  };

  const saveMemberChanges = async () => {
    if (!editingMember) {
      return;
    }

    if (!editRoleId) {
      setEditErrorMessage(t(uiLocale, "users.create.validation.roleRequired"));
      return;
    }

    const normalizedLimit = normalizeSessionLimit(editSessionLimit);
    if (!normalizedLimit.ok) {
      setEditErrorMessage(normalizedLimit.message);
      return;
    }

    const roleDirty = editRoleId !== editingMember.roleId;
    const statusDirty = editStatus !== editingMember.status;
    const sessionDirty = normalizedLimit.value !== editingMember.sessionLimit;
    const nextBranchIds = editBranchMode === "SELECTED" ? normalizeBranchIds(editBranchIds) : [];
    const prevBranchIds =
      initialEditBranchMode === "SELECTED" ? normalizeBranchIds(initialEditBranchIds) : [];
    const branchModeDirty = editBranchMode !== initialEditBranchMode;
    const branchIdsDirty =
      editBranchMode === "SELECTED" &&
      (nextBranchIds.length !== prevBranchIds.length ||
        nextBranchIds.some((branchId, index) => branchId !== prevBranchIds[index]));
    const branchDirty = branchModeDirty || branchIdsDirty;
    const hasAnyChanges = roleDirty || statusDirty || sessionDirty || branchDirty;

    if (!hasAnyChanges) {
      toast.success(t(uiLocale, "users.edit.toast.noChanges"));
      return;
    }

    setLoadingKey("save-member");
    setEditErrorMessage(null);

    if (editBranchMode === "SELECTED" && nextBranchIds.length === 0) {
      setEditErrorMessage(t(uiLocale, "users.branchAccess.validation.selectAtLeastOne"));
      setLoadingKey(null);
      return;
    }

    const runPatch = async (payload: Record<string, unknown>, fallbackMessage: string) => {
      const response = await authFetch(`/api/settings/users/${editingMember.userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            message?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(data?.message ?? fallbackMessage);
      }
    };

    try {
      if (roleDirty) {
        await runPatch(
          { action: "assign_role", roleId: editRoleId },
          t(uiLocale, "users.edit.error.assignRoleFailed"),
        );
      }

      if (statusDirty) {
        await runPatch(
          { action: "set_status", status: editStatus },
          t(uiLocale, "users.edit.error.setStatusFailed"),
        );
      }

      if (sessionDirty) {
        await runPatch(
          { action: "set_session_limit", sessionLimit: normalizedLimit.value },
          t(uiLocale, "users.edit.error.setSessionLimitFailed"),
        );
      }

      if (branchDirty) {
        await runPatch(
          {
            action: "set_branch_access",
            mode: editBranchMode,
            branchIds: editBranchMode === "SELECTED" ? nextBranchIds : [],
          },
          t(uiLocale, "users.edit.error.setBranchAccessFailed"),
        );
      }

      setEditingMemberId(null);
      toast.success(t(uiLocale, "users.edit.toast.saved"));
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t(uiLocale, "users.edit.error.saveFailed");
      setEditErrorMessage(message);
    } finally {
      setLoadingKey(null);
    }
  };

  const canSubmitNewUser = Boolean(formName.trim() && formEmail.trim() && formRoleId);
  const isCreateSubmitDisabled =
    !canCreate ||
    loadingKey !== null ||
    (createMode === "new"
      ? !canSubmitNewUser || Boolean(createdTemporaryPassword)
      : !existingRoleId || !selectedExistingUserId);
  const hasExistingQuery = existingQuery.trim().length > 0;

  return (
    <section className="space-y-4">
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{t(uiLocale, "users.list.title")}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {t(uiLocale, "users.summary.totalMembers.prefix")} {fmtNumber(members.length)}{" "}
              {t(uiLocale, "users.summary.totalMembers.suffix")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 w-9 rounded-full px-0"
              onClick={() => setIsHelpOpen(true)}
              aria-label={t(uiLocale, "users.help.ariaLabel")}
            >
              <Info className="h-4 w-4" />
            </Button>
            {canCreate ? (
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full px-3"
                onClick={openCreateModal}
              >
                <Plus className="h-4 w-4" />
                {t(uiLocale, "users.action.addMember")}
              </Button>
            ) : null}
          </div>
        </div>
        {members.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            {t(uiLocale, "users.list.empty")}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((member) => (
              <li key={member.userId}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                  onClick={() => openEditModal(member)}
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                    {getInitial(member.name, member.email)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className="block min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                        {member.name}
                      </span>
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                        title={
                          member.sessionLimit === null
                            ? t(uiLocale, "users.sessionLimit.tooltip.default")
                            : `${t(uiLocale, "users.sessionLimit.tooltip.custom.prefix")} ${fmtNumber(member.sessionLimit)} ${t(uiLocale, "users.sessionLimit.tooltip.custom.suffix")}`
                        }
                      >
                        <Smartphone className="h-3 w-3" />
                        {member.sessionLimit ?? defaultSessionLimit}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-slate-500">{member.email}</span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <span className="truncate">{rolesById.get(member.roleId)?.name ?? member.roleName}</span>
                      <span className="text-slate-300">•</span>
                      <span className={`inline-flex items-center gap-1 ${statusToneClassName[member.status]}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDotClassName[member.status]}`} />
                        {statusCompactLabel[member.status]}
                      </span>
                      {member.mustChangePassword ? (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            {t(uiLocale, "users.password.mustChangeBadge")}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </article>

      <SlideUpSheet
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title={t(uiLocale, "users.help.sheet.title")}
        description={t(uiLocale, "users.help.sheet.description")}
        panelMaxWidthClass="min-[1200px]:max-w-md"
      >
        <div className="space-y-3 text-sm text-slate-700">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">{t(uiLocale, "users.help.roles.title")}</p>
            <p className="mt-1 text-xs text-slate-500">{t(uiLocale, "users.help.roles.description")}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">{t(uiLocale, "users.help.status.title")}</p>
            <p className="mt-1 text-xs text-slate-500">{t(uiLocale, "users.help.status.description")}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">{t(uiLocale, "users.help.access.title")}</p>
            <p className="mt-1 text-xs text-slate-500">{t(uiLocale, "users.help.access.description")}</p>
          </div>
        </div>
      </SlideUpSheet>

      <SlideUpSheet
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        title={t(uiLocale, "users.create.sheet.title")}
        description={t(uiLocale, "users.create.sheet.description")}
        panelMaxWidthClass="min-[1200px]:max-w-md"
        disabled={loadingKey === "create-user" || loadingKey === "add-existing-user"}
        footer={
          <>
            {createErrorMessage ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {createErrorMessage}
              </p>
            ) : null}
            {createMode === "new" && createdTemporaryPassword ? (
              <div className={`${createErrorMessage ? "mt-3 " : ""}grid grid-cols-2 gap-2`}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl"
                  onClick={() => {
                    setCreatedTemporaryPassword(null);
                    setCreatedUserEmail("");
                    setCreateErrorMessage(null);
                    setFormRoleId(getDefaultRoleId(roles));
                  }}
                  disabled={loadingKey !== null}
                >
                  {t(uiLocale, "users.create.action.addAnother")}
                </Button>
                <Button type="button" className="h-10 rounded-xl" onClick={closeCreateModal} disabled={loadingKey !== null}>
                  {t(uiLocale, "users.create.action.done")}
                </Button>
              </div>
            ) : (
              <div className={`${createErrorMessage ? "mt-3 " : ""}grid grid-cols-2 gap-2`}>
                <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={closeCreateModal} disabled={loadingKey !== null}>
                  {t(uiLocale, "users.common.cancel")}
                </Button>
                <Button
                  type="button"
                  className="h-10 rounded-xl"
                  onClick={createMode === "new" ? createUser : addExistingUserToStore}
                  disabled={isCreateSubmitDisabled}
                >
                  {loadingKey === "create-user" || loadingKey === "add-existing-user" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t(uiLocale, "users.common.saving")}
                    </>
                  ) : createMode === "new" ? (
                    t(uiLocale, "users.create.action.addNewUser")
                  ) : (
                    t(uiLocale, "users.create.action.addExistingUser")
                  )}
                </Button>
              </div>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {canLinkExisting ? (
            <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                className={`h-9 rounded-lg text-sm font-medium transition ${createMode === "new" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                onClick={() => {
                  setCreateMode("new");
                  setCreateErrorMessage(null);
                  setCreatedTemporaryPassword(null);
                  setCreatedUserEmail("");
                }}
                disabled={loadingKey !== null}
              >
                {t(uiLocale, "users.create.mode.new")}
              </button>
              <button
                type="button"
                className={`h-9 rounded-lg text-sm font-medium transition ${createMode === "existing" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                onClick={() => {
                  setCreateMode("existing");
                  setCreateErrorMessage(null);
                  setExistingCandidatesError(null);
                  setSelectedExistingUserId("");
                  setCreatedTemporaryPassword(null);
                  setCreatedUserEmail("");
                }}
                disabled={loadingKey !== null}
              >
                {t(uiLocale, "users.create.mode.existing")}
              </button>
            </div>
          ) : null}

          {createMode === "new" ? (
            createdTemporaryPassword ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs font-medium text-emerald-700">
                    {t(uiLocale, "users.create.success.title")}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    {t(uiLocale, "users.create.success.hintPrefix")}{" "}
                    {createdUserEmail ? `(${createdUserEmail})` : ""}{" "}
                    {t(uiLocale, "users.create.success.hintSuffix")}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-sm font-semibold text-emerald-700">
                      {createdTemporaryPassword}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-lg px-2.5 text-xs"
                      onClick={copyCreatedTemporaryPassword}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {t(uiLocale, "users.common.copy")}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500" htmlFor="new-user-name">
                    {t(uiLocale, "users.form.nameLabel")}
                  </label>
                  <input
                    id="new-user-name"
                    value={formName}
                    onChange={(event) => setFormName(event.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-primary focus:ring-2"
                    disabled={!canCreate || loadingKey !== null}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500" htmlFor="new-user-email">
                    {t(uiLocale, "users.form.emailLabel")}
                  </label>
                  <input
                    id="new-user-email"
                    type="email"
                    value={formEmail}
                    onChange={(event) => setFormEmail(event.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-primary focus:ring-2"
                    disabled={!canCreate || loadingKey !== null}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500" htmlFor="new-user-role">
                    {t(uiLocale, "users.form.roleLabel")}
                  </label>
                  <select
                    id="new-user-role"
                    value={formRoleId}
                    onChange={(event) => setFormRoleId(event.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-primary focus:ring-2"
                    disabled={!canCreate || loadingKey !== null}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  {t(uiLocale, "users.create.newUser.tempPasswordHint")}
                </p>
              </div>
            )
          ) : (
            <div className="space-y-3">
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {t(uiLocale, "users.create.existingUser.warning.sameSuperadmin")}
              </p>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500" htmlFor="existing-user-search">
                  {t(uiLocale, "users.create.existingUser.searchLabel")}
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="existing-user-search"
                    type="text"
                    value={existingQuery}
                    onChange={(event) => setExistingQuery(event.target.value)}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-20 text-sm outline-none ring-primary transition focus:border-slate-300 focus:bg-white focus:ring-2"
                    disabled={!canCreate || loadingKey !== null}
                    placeholder={t(uiLocale, "users.create.existingUser.searchPlaceholder")}
                  />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    {isLoadingExistingCandidates ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                    ) : null}
                    {existingQuery ? (
                      <button
                        type="button"
                        className="inline-flex h-6 items-center rounded-full border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100"
                        onClick={() => setExistingQuery("")}
                        disabled={!canCreate || loadingKey !== null}
                        aria-label={t(uiLocale, "users.create.existingUser.clearSearchAriaLabel")}
                      >
                        {t(uiLocale, "users.create.existingUser.clearSearch")}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500" htmlFor="existing-user-role">
                  {t(uiLocale, "users.create.existingUser.roleLabel")}
                </label>
                <select
                  id="existing-user-role"
                  value={existingRoleId}
                  onChange={(event) => setExistingRoleId(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-primary focus:ring-2"
                  disabled={!canCreate || loadingKey !== null}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              {existingCandidatesError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {existingCandidatesError}
                </p>
              ) : null}

              <div className="space-y-2">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">
                    {t(uiLocale, "users.create.existingUser.candidatesTitle")}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {hasExistingQuery
                      ? t(uiLocale, "users.create.existingUser.candidatesFilteredHint")
                      : t(uiLocale, "users.create.existingUser.candidatesAllHint")}
                  </p>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                  {isLoadingExistingCandidates ? (
                    <div className="px-3 py-3 text-sm text-slate-500">
                      {t(uiLocale, "users.create.existingUser.candidatesLoading")}
                    </div>
                  ) : existingCandidates.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-slate-500">
                      {hasExistingQuery
                        ? t(uiLocale, "users.create.existingUser.candidatesEmptyFiltered")
                        : t(uiLocale, "users.create.existingUser.candidatesEmpty")}
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {existingCandidates.map((candidate) => {
                        const selected = selectedExistingUserId === candidate.userId;
                        return (
                          <li key={candidate.userId}>
                            <button
                              type="button"
                              className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left transition ${
                                selected ? "bg-blue-50" : "hover:bg-slate-50"
                              }`}
                              onClick={() => setSelectedExistingUserId(candidate.userId)}
                              disabled={loadingKey !== null}
                              aria-pressed={selected}
                            >
                              <span className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-slate-900">{candidate.name}</p>
                                <p className="truncate text-xs text-slate-500">{candidate.email}</p>
                                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                  {t(uiLocale, "users.create.existingUser.sourceStoresPrefix")}{" "}
                                  {candidate.sourceStores.join(", ")}
                                </p>
                              </span>
                              {selected ? <Check className="h-4 w-4 shrink-0 self-center text-emerald-600" /> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </SlideUpSheet>

      <SlideUpSheet
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        title={editingMember?.name ?? t(uiLocale, "users.edit.sheet.title")}
        description={editingMember?.email ?? t(uiLocale, "users.edit.sheet.description")}
        panelMaxWidthClass="min-[1200px]:max-w-[45rem]"
        disabled={loadingKey === "save-member" || loadingKey === "reset-password"}
        footer={
          editingMember ? (
            <>
              {editErrorMessage ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {editErrorMessage}
                </p>
              ) : null}
              <div className={`${editErrorMessage ? "mt-3 " : ""}grid grid-cols-2 gap-2`}>
                <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={closeEditModal} disabled={loadingKey !== null}>
                  {t(uiLocale, "users.common.cancel")}
                </Button>
                <Button type="button" className="h-10 rounded-xl" onClick={saveMemberChanges} disabled={!canUpdate || loadingKey !== null}>
                  {loadingKey === "save-member" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t(uiLocale, "users.common.saving")}
                    </>
                  ) : (
                    t(uiLocale, "users.edit.action.save")
                  )}
                </Button>
              </div>
            </>
          ) : null
        }
      >
        {editingMember ? (
          <div className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <article className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{t(uiLocale, "users.form.roleLabel")}</p>
                <select
                  value={editRoleId}
                  onChange={(event) => setEditRoleId(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                  disabled={!canUpdate || loadingKey !== null}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </article>

              <article className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{t(uiLocale, "users.edit.section.statusLabel")}</p>
                <div className="grid grid-cols-3 gap-1">
                  {statusOptions.map((status) => (
                    <button
                      key={status.value}
                      type="button"
                      onClick={() => setEditStatus(status.value)}
                      disabled={!canUpdate || loadingKey !== null}
                      className={`h-9 rounded-lg text-xs font-medium transition ${
                        editStatus === status.value
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:bg-white"
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </article>

              <article className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                <p className="text-xs text-slate-500">{t(uiLocale, "users.edit.section.sessionLimitLabel")}</p>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={editSessionLimit}
                    onChange={(event) => setEditSessionLimit(event.target.value)}
                    placeholder={t(uiLocale, "users.edit.sessionLimit.placeholder")}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                    disabled={!canUpdate || loadingKey !== null}
                  />
                  <span className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-500">
                    {t(uiLocale, "users.edit.sessionLimit.currentPrefix")}{" "}
                    {editingMember.sessionLimit ?? defaultSessionLimit}
                  </span>
                </div>
              </article>

              <article className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                <p className="text-xs text-slate-500">{t(uiLocale, "users.edit.section.branchAccessLabel")}</p>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-white p-1">
                  <button
                    type="button"
                    className={`h-9 rounded-md text-xs font-medium transition ${
                      editBranchMode === "ALL"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    onClick={() => setEditBranchMode("ALL")}
                    disabled={!canUpdate || loadingKey !== null || isLoadingEditBranchAccess}
                  >
                    {t(uiLocale, "users.edit.branchMode.all")}
                  </button>
                  <button
                    type="button"
                    className={`h-9 rounded-md text-xs font-medium transition ${
                      editBranchMode === "SELECTED"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    onClick={() => setEditBranchMode("SELECTED")}
                    disabled={!canUpdate || loadingKey !== null || isLoadingEditBranchAccess}
                  >
                    {t(uiLocale, "users.edit.branchMode.selected")}
                  </button>
                </div>

                {isLoadingEditBranchAccess ? (
                  <p className="text-xs text-slate-500">
                    {t(uiLocale, "users.edit.branchAccess.loading")}
                  </p>
                ) : editBranchMode === "SELECTED" ? (
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
                    {branches.length === 0 ? (
                      <p className="text-xs text-slate-500">{t(uiLocale, "users.edit.branchAccess.empty")}</p>
                    ) : (
                      <ul className="space-y-1">
                        {branches.map((branch) => {
                          const selected = editBranchIds.includes(branch.id);
                          return (
                            <li key={branch.id}>
                              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={(event) => {
                                    setEditBranchIds((current) => {
                                      if (event.target.checked) {
                                        return normalizeBranchIds([...current, branch.id]);
                                      }
                                      return current.filter((id) => id !== branch.id);
                                    });
                                  }}
                                  disabled={!canUpdate || loadingKey !== null}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs text-slate-700">
                                  {branch.name}
                                  {branch.code === "MAIN" ? " (MAIN)" : ""}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    {t(uiLocale, "users.edit.branchAccess.allHint")}
                  </p>
                )}
              </article>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {t(uiLocale, "users.edit.info.systemRolePrefix")} {editingMember.systemRole}
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5" />
                {t(uiLocale, "users.edit.info.currentStatusPrefix")} {statusLabel[editingMember.status]}
              </p>
              <p className="mt-1">
                {t(uiLocale, "users.edit.info.createdByPrefix")}{" "}
                {editingMember.createdByName ??
                  (editingMember.createdByUserId
                    ? t(uiLocale, "users.common.unknownName")
                    : t(uiLocale, "common.actor.system"))}
              </p>
              <p className="mt-1">
                {t(uiLocale, "users.edit.info.addedByPrefix")}{" "}
                {editingMember.addedByName ??
                  (editingMember.addedByUserId
                    ? t(uiLocale, "users.common.unknownName")
                    : t(uiLocale, "common.actor.system"))}
              </p>
              <p className="mt-1">
                {t(uiLocale, "users.edit.info.passwordStatusPrefix")}{" "}
                {editingMember.mustChangePassword
                  ? t(uiLocale, "users.password.status.mustChange")
                  : t(uiLocale, "users.password.status.normal")}
              </p>
            </div>

            <article className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-medium text-slate-700">
                {t(uiLocale, "users.resetPassword.section.title")}
              </p>
              <p className="text-xs text-slate-500">
                {t(uiLocale, "users.resetPassword.section.description")}
              </p>

              {temporaryPassword ? (
                <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2">
                  <p className="text-xs text-emerald-700">
                    {t(uiLocale, "users.resetPassword.tempPasswordLabel")}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-sm font-semibold text-emerald-700">
                      {temporaryPassword}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-lg px-2.5 text-xs"
                      onClick={copyTemporaryPassword}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {t(uiLocale, "users.common.copy")}
                    </Button>
                  </div>
                </div>
              ) : null}

              {!temporaryPassword && isResetPasswordConfirmOpen ? (
                <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-2">
                  <p className="text-xs text-amber-700">
                    {t(uiLocale, "users.resetPassword.confirm.question")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-lg text-xs"
                      onClick={() => setIsResetPasswordConfirmOpen(false)}
                      disabled={loadingKey === "reset-password"}
                    >
                      {t(uiLocale, "users.common.cancel")}
                    </Button>
                    <Button
                      type="button"
                      className="h-9 rounded-lg text-xs"
                      onClick={resetMemberPassword}
                      disabled={!canUpdate || loadingKey === "reset-password"}
                    >
                      {loadingKey === "reset-password" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t(uiLocale, "users.resetPassword.action.resetting")}
                        </>
                      ) : (
                        t(uiLocale, "users.resetPassword.action.confirm")
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}

              {!temporaryPassword && !isResetPasswordConfirmOpen ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-lg text-xs"
                  onClick={() => setIsResetPasswordConfirmOpen(true)}
                  disabled={!canUpdate || loadingKey !== null}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {t(uiLocale, "users.resetPassword.action.reset")}
                </Button>
              ) : null}
            </article>
          </div>
        ) : null}
      </SlideUpSheet>
    </section>
  );
}
