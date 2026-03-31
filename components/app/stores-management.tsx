"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Boxes,
  Building2,
  CheckCircle2,
  Coffee,
  Grid3X3,
  Link2,
  Plus,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  Warehouse,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { StoresManagementHelpButton } from "@/components/app/stores-management-help-button";
import { authFetch, setClientAuthToken } from "@/lib/auth/client-token";
import {
  DEFAULT_UI_LOCALE,
  type UiLocale,
  uiLocaleToDateLocale,
} from "@/lib/i18n/locales";
import { t, type MessageKey } from "@/lib/i18n/messages";
import {
  formatLaosAddress,
  getDistrictsByProvinceId,
  laosProvinces,
} from "@/lib/location/laos-address";

type StoreMembershipItem = {
  storeId: string;
  storeName: string;
  storeType: "ONLINE_RETAIL" | "RESTAURANT" | "CAFE" | "OTHER";
  roleName: string;
};

type BranchItem = {
  id: string;
  storeId: string;
  name: string;
  code: string | null;
  address: string | null;
  sourceBranchId: string | null;
  sourceBranchName: string | null;
  sharingMode: "MAIN" | "BALANCED" | "FULL_SYNC" | "INDEPENDENT";
  sharingConfig: BranchSharingConfig | null;
  canAccess?: boolean;
  createdAt: string;
};

type BranchSharingMode = "BALANCED" | "FULL_SYNC" | "INDEPENDENT";

type BranchSharingConfig = {
  shareCatalog: boolean;
  sharePricing: boolean;
  sharePromotions: boolean;
  shareCustomers: boolean;
  shareStaffRoles: boolean;
  shareInventory: boolean;
};

type BranchPolicySummary = {
  isSuperadmin: boolean;
  isStoreOwner: boolean;
  effectiveCanCreateBranches: boolean;
  effectiveMaxBranchesPerStore: number | null;
  effectiveLimitSource: "STORE_OVERRIDE" | "SUPERADMIN_OVERRIDE" | "GLOBAL_DEFAULT" | "UNLIMITED";
  currentBranchCount: number;
  summary: string;
};

type BranchCreateStep = 1 | 2 | 3;

type BranchFieldErrors = Partial<
  Record<"name" | "code" | "address" | "sourceBranchId", string>
>;

type StoresManagementMode = "all" | "quick" | "store-config" | "branch-config";

type StoresManagementProps = {
  memberships: StoreMembershipItem[];
  activeStoreId: string;
  activeBranchId: string | null;
  uiLocale?: UiLocale;
  isSuperadmin: boolean;
  canCreateStore: boolean;
  createStoreBlockedReason: string | null;
  storeQuotaSummary: string | null;
  mode?: StoresManagementMode;
  embeddedQuickCard?: boolean;
};

const storeTypeOptions = [
  {
    value: "ONLINE_RETAIL",
    titleKey: "onboarding.storeType.online.title",
    icon: ShoppingBag,
    iconColorClassName: "text-sky-700",
    iconBgClassName: "bg-sky-100 ring-sky-200",
  },
  {
    value: "RESTAURANT",
    titleKey: "onboarding.storeType.restaurant.title",
    icon: UtensilsCrossed,
    iconColorClassName: "text-amber-700",
    iconBgClassName: "bg-amber-100 ring-amber-200",
  },
  {
    value: "CAFE",
    titleKey: "onboarding.storeType.cafe.title",
    icon: Coffee,
    iconColorClassName: "text-emerald-700",
    iconBgClassName: "bg-emerald-100 ring-emerald-200",
  },
  {
    value: "OTHER",
    titleKey: "onboarding.storeType.other.title",
    icon: Grid3X3,
    iconColorClassName: "text-violet-700",
    iconBgClassName: "bg-violet-100 ring-violet-200",
  },
] as const;

const storeTypeLabelKeys: Record<StoreMembershipItem["storeType"], MessageKey> = {
  ONLINE_RETAIL: "onboarding.storeType.online.title",
  RESTAURANT: "onboarding.storeType.restaurant.title",
  CAFE: "onboarding.storeType.cafe.title",
  OTHER: "onboarding.storeType.other.title",
};

const branchSharingDefaultsByMode: Record<BranchSharingMode, BranchSharingConfig> = {
  BALANCED: {
    shareCatalog: true,
    sharePricing: true,
    sharePromotions: true,
    shareCustomers: true,
    shareStaffRoles: true,
    shareInventory: false,
  },
  FULL_SYNC: {
    shareCatalog: true,
    sharePricing: true,
    sharePromotions: true,
    shareCustomers: true,
    shareStaffRoles: true,
    shareInventory: true,
  },
  INDEPENDENT: {
    shareCatalog: false,
    sharePricing: false,
    sharePromotions: false,
    shareCustomers: false,
    shareStaffRoles: false,
    shareInventory: false,
  },
};

const branchSharingModeOptions: Array<{
  value: BranchSharingMode;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  recommended?: boolean;
}> = [
  {
    value: "BALANCED",
    labelKey: "storesManagement.branchMode.BALANCED.label",
    descriptionKey: "storesManagement.branchMode.BALANCED.description",
    recommended: true,
  },
  {
    value: "FULL_SYNC",
    labelKey: "storesManagement.branchMode.FULL_SYNC.label",
    descriptionKey: "storesManagement.branchMode.FULL_SYNC.description",
  },
  {
    value: "INDEPENDENT",
    labelKey: "storesManagement.branchMode.INDEPENDENT.label",
    descriptionKey: "storesManagement.branchMode.INDEPENDENT.description",
  },
];

const branchSharingToggleOptions: Array<{
  key: keyof BranchSharingConfig;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
}> = [
  {
    key: "shareCatalog",
    labelKey: "storesManagement.shareToggle.shareCatalog.label",
    descriptionKey: "storesManagement.shareToggle.shareCatalog.description",
  },
  {
    key: "sharePricing",
    labelKey: "storesManagement.shareToggle.sharePricing.label",
    descriptionKey: "storesManagement.shareToggle.sharePricing.description",
  },
  {
    key: "sharePromotions",
    labelKey: "storesManagement.shareToggle.sharePromotions.label",
    descriptionKey: "storesManagement.shareToggle.sharePromotions.description",
  },
  {
    key: "shareCustomers",
    labelKey: "storesManagement.shareToggle.shareCustomers.label",
    descriptionKey: "storesManagement.shareToggle.shareCustomers.description",
  },
  {
    key: "shareStaffRoles",
    labelKey: "storesManagement.shareToggle.shareStaffRoles.label",
    descriptionKey: "storesManagement.shareToggle.shareStaffRoles.description",
  },
  {
    key: "shareInventory",
    labelKey: "storesManagement.shareToggle.shareInventory.label",
    descriptionKey: "storesManagement.shareToggle.shareInventory.description",
  },
];

const branchCreateSteps: Array<{
  id: BranchCreateStep;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
}> = [
  {
    id: 1,
    titleKey: "storesManagement.branchWizard.step.branchInfo.title",
    descriptionKey: "storesManagement.branchWizard.step.branchInfo.description",
  },
  {
    id: 2,
    titleKey: "storesManagement.branchWizard.step.branchMode.title",
    descriptionKey: "storesManagement.branchWizard.step.branchMode.description",
  },
  {
    id: 3,
    titleKey: "storesManagement.branchWizard.step.review.title",
    descriptionKey: "storesManagement.branchWizard.step.review.description",
  },
];

const branchSharingModeLabelKeys: Record<BranchItem["sharingMode"], MessageKey> = {
  MAIN: "storesManagement.branchList.mode.main",
  BALANCED: "storesManagement.branchMode.BALANCED.label",
  FULL_SYNC: "storesManagement.branchMode.FULL_SYNC.label",
  INDEPENDENT: "storesManagement.branchMode.INDEPENDENT.label",
};

const describeSharingConfig = (uiLocale: UiLocale, config: BranchSharingConfig | null) => {
  if (!config) {
    return t(uiLocale, "storesManagement.sharing.mainBranch");
  }

  const shared = branchSharingToggleOptions
    .filter((item) => config[item.key])
    .map((item) => t(uiLocale, item.labelKey));
  const isolated = branchSharingToggleOptions
    .filter((item) => !config[item.key])
    .map((item) => t(uiLocale, item.labelKey));

  const sharedLabel =
    shared.length > 0
      ? `${t(uiLocale, "storesManagement.sharing.sharedPrefix")} ${shared.join(", ")}`
      : `${t(uiLocale, "storesManagement.sharing.sharedPrefix")} ${t(uiLocale, "storesManagement.sharing.sharedEmpty")}`;
  const isolatedLabel =
    isolated.length > 0
      ? `${t(uiLocale, "storesManagement.sharing.isolatedPrefix")} ${isolated.join(", ")}`
      : `${t(uiLocale, "storesManagement.sharing.isolatedPrefix")} ${t(uiLocale, "storesManagement.sharing.isolatedEmpty")}`;

  return `${sharedLabel} · ${isolatedLabel}`;
};

export function StoresManagement({
  memberships,
  activeStoreId,
  activeBranchId,
  uiLocale = DEFAULT_UI_LOCALE,
  isSuperadmin,
  canCreateStore,
  createStoreBlockedReason,
  storeQuotaSummary,
  mode = "all",
  embeddedQuickCard = false,
}: StoresManagementProps) {
  const router = useRouter();
  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const formatNumber = (value: number) => value.toLocaleString(numberLocale);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [storeType, setStoreType] =
    useState<(typeof storeTypeOptions)[number]["value"]>("ONLINE_RETAIL");
  const [storeName, setStoreName] = useState("");
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [village, setVillage] = useState("");
  const [storePhoneNumber, setStorePhoneNumber] = useState("");

  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [branchPolicy, setBranchPolicy] = useState<BranchPolicySummary | null>(null);
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchSourceBranchId, setBranchSourceBranchId] = useState("");
  const [branchSharingMode, setBranchSharingMode] = useState<BranchSharingMode>("BALANCED");
  const [branchSharingConfig, setBranchSharingConfig] = useState<BranchSharingConfig>(
    branchSharingDefaultsByMode.BALANCED,
  );
  const [branchCreateStep, setBranchCreateStep] = useState<BranchCreateStep>(1);
  const [branchFieldErrors, setBranchFieldErrors] = useState<BranchFieldErrors>({});
  const [isCreateBranchSheetOpen, setIsCreateBranchSheetOpen] = useState(false);
  const [isBranchAdvancedOpen, setIsBranchAdvancedOpen] = useState(false);
  const [switchToCreatedBranch, setSwitchToCreatedBranch] = useState(false);
  const [isCreateStoreSheetOpen, setIsCreateStoreSheetOpen] = useState(false);

  const activeStore = useMemo(
    () => memberships.find((item) => item.storeId === activeStoreId) ?? null,
    [activeStoreId, memberships],
  );
  const districtOptions = useMemo(() => getDistrictsByProvinceId(provinceId), [provinceId]);
  const formattedAddress = useMemo(
    () =>
      formatLaosAddress({
        provinceId,
        districtId,
        detail: village,
      }),
    [provinceId, districtId, village],
  );
  const mainBranch = useMemo(
    () => branches.find((branch) => branch.code === "MAIN") ?? branches[0] ?? null,
    [branches],
  );
  const branchSourceOptions = useMemo(
    () => branches.filter((branch) => branch.code === "MAIN" || branch.sharingMode !== "MAIN"),
    [branches],
  );
  const branchSharingSummary = useMemo(
    () => describeSharingConfig(uiLocale, branchSharingConfig),
    [branchSharingConfig, uiLocale],
  );
  const canCreateBranch = Boolean(
    branchPolicy?.isStoreOwner && branchPolicy?.effectiveCanCreateBranches,
  );
  const sourceBranchLabel = useMemo(
    () =>
      branchSourceOptions.find((branch) => branch.id === branchSourceBranchId)?.name ??
      null,
    [branchSourceBranchId, branchSourceOptions],
  );
  const sharedBranchSharingLabels = useMemo(
    () =>
      branchSharingToggleOptions
        .filter((item) => branchSharingConfig[item.key])
        .map((item) => t(uiLocale, item.labelKey)),
    [branchSharingConfig, uiLocale],
  );
  const isolatedBranchSharingLabels = useMemo(
    () =>
      branchSharingToggleOptions
        .filter((item) => !branchSharingConfig[item.key])
        .map((item) => t(uiLocale, item.labelKey)),
    [branchSharingConfig, uiLocale],
  );
  const normalizedBranchName = branchName.trim();
  const normalizedBranchCode = branchCode.trim().toUpperCase();
  const isDuplicateBranchName = useMemo(() => {
    if (!normalizedBranchName) {
      return false;
    }
    const target = normalizedBranchName.toLocaleLowerCase();
    return branches.some((branch) => branch.name.trim().toLocaleLowerCase() === target);
  }, [branches, normalizedBranchName]);
  const isDuplicateBranchCode = useMemo(() => {
    if (!normalizedBranchCode) {
      return false;
    }
    return branches.some((branch) => (branch.code ?? "").trim().toUpperCase() === normalizedBranchCode);
  }, [branches, normalizedBranchCode]);
  const activeBranchCreateStepMeta = useMemo(
    () =>
      branchCreateSteps.find((step) => step.id === branchCreateStep) ??
      branchCreateSteps[0],
    [branchCreateStep],
  );
  const showSwitchPanels = mode === "all" || mode === "quick";
  const showStoreCreatePanel = isSuperadmin && (mode === "all" || mode === "store-config");
  const showBranchManagePanel = isSuperadmin && (mode === "all" || mode === "branch-config");

  const switchStore = async (storeId: string) => {
    if (storeId === activeStoreId) {
      return;
    }

    setLoadingKey(`switch-${storeId}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await authFetch("/api/stores/switch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ storeId }),
    });

    const data = (await response.json().catch(() => null)) as
      | { message?: string; token?: string; next?: string; activeStoreName?: string }
      | null;

    if (!response.ok) {
      setErrorMessage(data?.message ?? t(uiLocale, "storesManagement.feedback.switchStore.error"));
      setLoadingKey(null);
      return;
    }

    if (data?.token) {
      setClientAuthToken(data.token);
    }

    setSuccessMessage(
      `${t(uiLocale, "storesManagement.feedback.switchStore.successPrefix")} ${data?.activeStoreName ?? t(uiLocale, "storesManagement.feedback.switchStore.selectedStore")} ${t(uiLocale, "storesManagement.feedback.switchStore.successSuffix")}`,
    );
    setLoadingKey(null);
    router.replace(data?.next ?? "/dashboard");
    router.refresh();
  };

  const switchBranch = async (branchId: string) => {
    if (!branchId || branchId === activeBranchId) {
      return;
    }

    setLoadingKey(`switch-branch-${branchId}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await authFetch("/api/stores/branches/switch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ branchId }),
    });

    const data = (await response.json().catch(() => null)) as
      | { message?: string; token?: string; next?: string; activeBranchName?: string }
      | null;

    if (!response.ok) {
      setErrorMessage(data?.message ?? t(uiLocale, "storesManagement.feedback.switchBranch.error"));
      setLoadingKey(null);
      return;
    }

    if (data?.token) {
      setClientAuthToken(data.token);
    }

    setSuccessMessage(
      `${t(uiLocale, "storesManagement.feedback.switchBranch.successPrefix")} ${data?.activeBranchName ?? t(uiLocale, "storesManagement.feedback.switchBranch.selectedBranch")} ${t(uiLocale, "storesManagement.feedback.switchBranch.successSuffix")}`,
    );
    setLoadingKey(null);
    router.replace(data?.next ?? "/dashboard");
    router.refresh();
  };

  const createStore = async () => {
    if (!isSuperadmin) {
      setErrorMessage(t(uiLocale, "storesManagement.feedback.createStore.superadminOnly"));
      return;
    }

    if (!canCreateStore) {
      setErrorMessage(
        createStoreBlockedReason ?? t(uiLocale, "storesManagement.feedback.createStore.blocked"),
      );
      return;
    }

    if (!storeName.trim()) {
      setErrorMessage(t(uiLocale, "storesManagement.feedback.createStore.storeNameRequired"));
      return;
    }
    if (!provinceId) {
      setErrorMessage(t(uiLocale, "storesManagement.feedback.createStore.provinceRequired"));
      return;
    }
    if (!districtId) {
      setErrorMessage(t(uiLocale, "storesManagement.feedback.createStore.districtRequired"));
      return;
    }
    if (!village.trim()) {
      setErrorMessage(t(uiLocale, "storesManagement.feedback.createStore.villageRequired"));
      return;
    }
    if (!formattedAddress) {
      setErrorMessage(t(uiLocale, "storesManagement.feedback.createStore.addressIncomplete"));
      return;
    }
    const finalAddress = formattedAddress;
    if (finalAddress.length > 300) {
      setErrorMessage(t(uiLocale, "storesManagement.feedback.createStore.addressTooLong"));
      return;
    }
    if (!storePhoneNumber.trim()) {
      setErrorMessage(t(uiLocale, "storesManagement.feedback.createStore.phoneRequired"));
      return;
    }
    if (!/^[0-9+\-\s()]{6,20}$/.test(storePhoneNumber.trim())) {
      setErrorMessage(t(uiLocale, "storesManagement.feedback.createStore.phoneInvalid"));
      return;
    }

    setLoadingKey("create-store");
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = await authFetch("/api/onboarding/store", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        storeType,
        storeName: storeName.trim(),
        logoName: storeName.trim(),
        address: finalAddress,
        phoneNumber: storePhoneNumber.trim(),
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | { message?: string; token?: string; next?: string }
      | null;

    if (!response.ok) {
      setErrorMessage(data?.message ?? t(uiLocale, "storesManagement.feedback.createStore.error"));
      setLoadingKey(null);
      return;
    }

    if (data?.token) {
      setClientAuthToken(data.token);
    }

    setLoadingKey(null);
    setSuccessMessage(t(uiLocale, "storesManagement.feedback.createStore.success"));
    router.replace(data?.next ?? "/dashboard");
    router.refresh();
  };

  useEffect(() => {
    const loadBranches = async () => {
      setLoadingKey("load-branches");
      const response = await authFetch("/api/stores/branches", {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as
          | {
              message?: string;
              branches?: BranchItem[];
              policy?: BranchPolicySummary;
              branchAccessMode?: "ALL" | "SELECTED";
            }
          | null;

      if (!response.ok) {
        setErrorMessage(data?.message ?? t(uiLocale, "storesManagement.feedback.loadBranches.error"));
        setLoadingKey(null);
        return;
      }

      setBranches(data?.branches ?? []);
      setBranchPolicy(data?.policy ?? null);
      setLoadingKey(null);
    };

    void loadBranches();
  }, [activeStoreId, isSuperadmin, uiLocale]);

  useEffect(() => {
    if (branchSharingMode === "INDEPENDENT") {
      setBranchSourceBranchId("");
      return;
    }

    if (branchSourceBranchId) {
      const exists = branches.some((branch) => branch.id === branchSourceBranchId);
      if (exists) {
        return;
      }
    }

    if (mainBranch) {
      setBranchSourceBranchId(mainBranch.id);
    }
  }, [branchSharingMode, branchSourceBranchId, branches, mainBranch]);

  useEffect(() => {
    setBranchCreateStep(1);
    setBranchFieldErrors({});
    setBranchName("");
    setBranchCode("");
    setBranchAddress("");
    setBranchSourceBranchId("");
    setBranchSharingMode("BALANCED");
    setBranchSharingConfig(branchSharingDefaultsByMode.BALANCED);
    setIsBranchAdvancedOpen(false);
    setSwitchToCreatedBranch(false);
    setIsCreateBranchSheetOpen(false);
  }, [activeStoreId]);

  const clearBranchFieldError = (field: keyof BranchFieldErrors) => {
    setBranchFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      return { ...current, [field]: undefined };
    });
  };

  const validateBranchInfoStep = (): BranchFieldErrors => {
    const errors: BranchFieldErrors = {};
    const normalizedName = branchName.trim();
    const normalizedCode = branchCode.trim().toUpperCase();
    const normalizedAddress = branchAddress.trim();

    if (!normalizedName) {
      errors.name = t(uiLocale, "storesManagement.feedback.branch.nameRequired");
    } else if (normalizedName.length < 2 || normalizedName.length > 120) {
      errors.name = t(uiLocale, "storesManagement.feedback.branch.nameLength");
    } else if (isDuplicateBranchName) {
      errors.name = t(uiLocale, "storesManagement.feedback.branch.nameDuplicate");
    }

    if (normalizedCode.length > 40) {
      errors.code = t(uiLocale, "storesManagement.feedback.branch.codeLength");
    } else if (normalizedCode && isDuplicateBranchCode) {
      errors.code = t(uiLocale, "storesManagement.feedback.branch.codeDuplicate");
    }

    if (normalizedAddress.length > 240) {
      errors.address = t(uiLocale, "storesManagement.feedback.branch.addressLength");
    }

    return errors;
  };

  const validateBranchSharingStep = (): BranchFieldErrors => {
    const errors: BranchFieldErrors = {};

    if (branchSharingMode !== "INDEPENDENT" && !branchSourceBranchId) {
      errors.sourceBranchId = t(uiLocale, "storesManagement.feedback.branch.sourceRequired");
    }

    return errors;
  };

  const getBranchFormErrorsByStep = (
    step: BranchCreateStep,
  ): BranchFieldErrors => {
    if (step === 1) {
      return validateBranchInfoStep();
    }
    if (step === 2) {
      return validateBranchSharingStep();
    }
    return {
      ...validateBranchInfoStep(),
      ...validateBranchSharingStep(),
    };
  };

  const hasBranchFormErrors = (errors: BranchFieldErrors) =>
    Object.values(errors).some((value) => typeof value === "string" && value.length > 0);

  const moveBranchStepForward = () => {
    if (branchCreateStep === 3) {
      void createBranch();
      return;
    }

    const errors = getBranchFormErrorsByStep(branchCreateStep);
    if (hasBranchFormErrors(errors)) {
      setBranchFieldErrors((current) => ({ ...current, ...errors }));
      setErrorMessage(t(uiLocale, "storesManagement.feedback.branch.stepInvalid"));
      return;
    }

    setErrorMessage(null);
    setBranchCreateStep((current) =>
      current >= 3 ? current : ((current + 1) as BranchCreateStep),
    );
  };

  const moveBranchStepBackward = () => {
    setErrorMessage(null);
    setBranchCreateStep((current) =>
      current <= 1 ? current : ((current - 1) as BranchCreateStep),
    );
  };

  const jumpToBranchStep = (targetStep: BranchCreateStep) => {
    if (targetStep > branchCreateStep || loadingKey === "create-branch") {
      return;
    }
    setErrorMessage(null);
    setBranchCreateStep(targetStep);
  };

  const createBranch = async () => {
    if (!canCreateBranch) {
      setErrorMessage(t(uiLocale, "storesManagement.feedback.branch.permissionDenied"));
      return;
    }

    const errors = getBranchFormErrorsByStep(3);
    if (hasBranchFormErrors(errors)) {
      setBranchFieldErrors(errors);
      setErrorMessage(t(uiLocale, "storesManagement.feedback.branch.incomplete"));
      setBranchCreateStep(
        errors.name || errors.code || errors.address ? 1 : 2,
      );
      return;
    }

    setLoadingKey("create-branch");
    setErrorMessage(null);
    setSuccessMessage(null);
    const existingBranchIds = new Set(branches.map((branch) => branch.id));
    const requestName = branchName.trim();
    const requestCode = branchCode.trim().toUpperCase();

    const response = await authFetch("/api/stores/branches", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: requestName,
        code: requestCode || null,
        address: branchAddress.trim() || null,
        sourceBranchId: branchSharingMode === "INDEPENDENT" ? null : branchSourceBranchId || null,
        sharingMode: branchSharingMode,
        sharingConfig: branchSharingConfig,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | {
          message?: string;
          branches?: BranchItem[];
          policy?: BranchPolicySummary;
        }
      | null;

    if (!response.ok) {
      setErrorMessage(data?.message ?? t(uiLocale, "storesManagement.feedback.branch.createError"));
      setLoadingKey(null);
      return;
    }

    const nextBranches = data?.branches ?? [];
    const createdBranch =
      nextBranches.find((branch) => !existingBranchIds.has(branch.id)) ??
      nextBranches.find(
        (branch) =>
          branch.name.trim().toLocaleLowerCase() === requestName.toLocaleLowerCase() &&
          (branch.code ?? "").trim().toUpperCase() === requestCode,
      ) ??
      null;

    setBranches(nextBranches);
    setBranchPolicy(data?.policy ?? null);
    setBranchName("");
    setBranchCode("");
    setBranchAddress("");
    setBranchSharingMode("BALANCED");
    setBranchSharingConfig(branchSharingDefaultsByMode.BALANCED);
    setBranchSourceBranchId(mainBranch?.id ?? "");
    setBranchCreateStep(1);
    setBranchFieldErrors({});
    setIsBranchAdvancedOpen(false);
    setIsCreateBranchSheetOpen(false);
    setSuccessMessage(t(uiLocale, "storesManagement.feedback.branch.createSuccess"));
    setLoadingKey(null);

    if (switchToCreatedBranch && createdBranch?.id) {
      await switchBranch(createdBranch.id);
    }
  };

  const applySharingMode = (mode: BranchSharingMode) => {
    setBranchSharingMode(mode);
    setBranchSharingConfig(branchSharingDefaultsByMode[mode]);
    if (mode === "INDEPENDENT") {
      clearBranchFieldError("sourceBranchId");
    }
  };

  const updateSharingToggle = (key: keyof BranchSharingConfig, checked: boolean) => {
    setBranchSharingConfig((current) => ({
      ...current,
      [key]: checked,
    }));
  };

  const openCreateBranchSheet = () => {
    if (!canCreateBranch || loadingKey !== null) {
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsCreateBranchSheetOpen(true);
  };

  const closeCreateBranchSheet = () => {
    if (loadingKey === "create-branch") {
      return;
    }
    setIsCreateBranchSheetOpen(false);
  };

  const closeCreateStoreSheet = () => {
    if (loadingKey === "create-store") {
      return;
    }
    setIsCreateStoreSheetOpen(false);
  };

  const useEmbeddedQuickCard = embeddedQuickCard && mode === "quick";
  const sectionLabelClassName = useEmbeddedQuickCard
    ? "px-1 text-[11px] font-semibold uppercase text-slate-500"
    : "px-1 text-[11px] font-semibold uppercase text-slate-500";
  const quickPanels = (
    <>
      <div className="space-y-2">
        <p className={sectionLabelClassName}>{t(uiLocale, "storesManagement.currentStore.section")}</p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{activeStore?.storeName ?? "-"}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {t(uiLocale, "storesManagement.currentStore.rolePrefix")} {activeStore?.roleName ?? "-"} ·{" "}
              {t(uiLocale, "storesManagement.currentStore.accessPrefix")} {formatNumber(memberships.length)}{" "}
              {t(uiLocale, "storesManagement.currentStore.accessSuffix")}
            </p>
          </div>
        </div>
      </div>

      {showSwitchPanels ? (
        <div className="space-y-2">
          <p className={sectionLabelClassName}>{t(uiLocale, "storesManagement.switchStore.section")}</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500">
                {t(uiLocale, "storesManagement.switchStore.countPrefix")} {formatNumber(memberships.length)}{" "}
                {t(uiLocale, "storesManagement.switchStore.countSuffix")}
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              {memberships.map((membership) => {
                const isActive = membership.storeId === activeStoreId;

                return (
                  <li key={membership.storeId} className="flex min-h-14 items-center gap-3 px-4 py-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <Store className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{membership.storeName}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {t(uiLocale, storeTypeLabelKeys[membership.storeType])} ·{" "}
                        {t(uiLocale, "storesManagement.currentStore.rolePrefix")} {membership.roleName}
                      </p>
                    </div>
                    {isActive ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        {t(uiLocale, "storesManagement.switchStore.activeBadge")}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        disabled={loadingKey !== null}
                        onClick={() => switchStore(membership.storeId)}
                      >
                        {loadingKey === `switch-${membership.storeId}`
                          ? t(uiLocale, "storesManagement.common.loading")
                          : t(uiLocale, "storesManagement.common.select")}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}

      {showSwitchPanels ? (
        <div className="space-y-2">
          <p className={sectionLabelClassName}>{t(uiLocale, "storesManagement.switchBranch.section")}</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500">
                {t(uiLocale, "storesManagement.switchBranch.countPrefix")} {formatNumber(branches.length)}{" "}
                {t(uiLocale, "storesManagement.switchBranch.countSuffix")}
              </p>
            </div>
            {loadingKey === "load-branches" ? (
              <p className="px-4 py-4 text-sm text-slate-500">
                {t(uiLocale, "storesManagement.switchBranch.loading")}
              </p>
            ) : branches.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-500">
                {t(uiLocale, "storesManagement.switchBranch.empty")}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {branches.map((branch) => {
                  const isActiveBranch = branch.id === activeBranchId;
                  const canAccessBranch = branch.canAccess ?? true;

                  return (
                    <li key={branch.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {branch.name}
                          {branch.code === "MAIN" ? (
                            <span className="ml-1 rounded-full border border-slate-300 bg-white px-1.5 text-[10px] text-slate-600">
                              {t(uiLocale, "storesManagement.branchList.mainBadge")}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {branch.address ?? t(uiLocale, "storesManagement.switchBranch.noAddress")}
                        </p>
                      </div>
                      {isActiveBranch ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          {t(uiLocale, "storesManagement.switchBranch.activeBadge")}
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          disabled={loadingKey !== null || !canAccessBranch}
                          onClick={() => switchBranch(branch.id)}
                        >
                          {canAccessBranch
                            ? loadingKey === `switch-branch-${branch.id}`
                              ? t(uiLocale, "storesManagement.common.loading")
                              : t(uiLocale, "storesManagement.common.select")
                            : t(uiLocale, "storesManagement.switchBranch.noAccess")}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  );

  return (
    <section className="space-y-5">
      {useEmbeddedQuickCard ? (
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {t(uiLocale, "settings.link.switchStore.title")}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {t(uiLocale, "settings.link.switchStore.description")}
              </p>
            </div>
            <StoresManagementHelpButton uiLocale={uiLocale} />
          </div>
          <div className="space-y-4 px-4 py-4">{quickPanels}</div>
        </article>
      ) : (
        quickPanels
      )}

      {showStoreCreatePanel ? (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t(uiLocale, "storesManagement.createStore.section")}
          </p>
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="space-y-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {t(uiLocale, "storesManagement.createStore.title")}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t(uiLocale, "storesManagement.createStore.subtitle")}
                </p>
                {storeQuotaSummary ? <p className="mt-1 text-xs text-slate-500">{storeQuotaSummary}</p> : null}
              </div>
              <Button
                type="button"
                className="h-10 w-full"
                onClick={() => setIsCreateStoreSheetOpen(true)}
                disabled={loadingKey !== null || !canCreateStore}
              >
                <Plus className="h-4 w-4" />
                {t(uiLocale, "storesManagement.createStore.action")}
              </Button>
              {!canCreateStore && createStoreBlockedReason ? (
                <p className="text-sm text-red-600">{createStoreBlockedReason}</p>
              ) : null}
            </div>
          </article>
        </div>
      ) : null}

      {showBranchManagePanel ? (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t(uiLocale, "storesManagement.branchManage.section")}
          </p>
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">
                {t(uiLocale, "storesManagement.branchManage.title")}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {t(uiLocale, "storesManagement.branchManage.storePrefix")} {activeStore?.storeName ?? "-"}
              </p>
              {branchPolicy ? (
                <p className="mt-1 text-xs text-slate-500">
                  {t(uiLocale, "storesManagement.branchManage.quotaPrefix")} {branchPolicy.summary}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-slate-500">
                {t(uiLocale, "storesManagement.branchManage.overrideHint")}
              </p>
            </div>

            <div className="space-y-4 border-b border-slate-100 px-4 py-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">
                  {t(uiLocale, "storesManagement.branchManage.flowTitle")}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t(uiLocale, "storesManagement.branchManage.flowDescription")}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                <p className="text-sm font-medium text-slate-900">
                  {t(uiLocale, "storesManagement.branchManage.wizardTitle")}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t(uiLocale, "storesManagement.branchManage.wizardDescription")}
                </p>
                <Button
                  type="button"
                  className="mt-3 h-10 w-full"
                  onClick={openCreateBranchSheet}
                  disabled={loadingKey !== null || !canCreateBranch}
                >
                  <Plus className="h-4 w-4" />
                  {t(uiLocale, "storesManagement.branchManage.openAction")}
                </Button>
              </div>

              {branchPolicy && !branchPolicy.effectiveCanCreateBranches ? (
                <p className="text-sm text-red-600">
                  {t(uiLocale, "storesManagement.feedback.branch.permissionDenied")}
                </p>
              ) : null}
            </div>

            <div className="px-4 py-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                {t(uiLocale, "storesManagement.branchManage.listTitle")}
              </p>
              {loadingKey === "load-branches" ? (
                <p className="text-sm text-slate-500">
                  {t(uiLocale, "storesManagement.branchManage.listLoading")}
                </p>
              ) : branches.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {t(uiLocale, "storesManagement.branchManage.listEmpty")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {branches.map((branch) => (
                    <li key={branch.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-slate-500">
                          <Building2 className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {branch.name}
                            {branch.sharingMode === "MAIN" ? (
                              <span className="ml-1.5 inline-flex items-center rounded-full border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                MAIN
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {t(uiLocale, "storesManagement.branchList.codePrefix")} {branch.code ?? "-"} ·{" "}
                            {t(uiLocale, "storesManagement.branchList.addressPrefix")} {branch.address ?? "-"}
                          </p>
                          {branch.sharingMode !== "MAIN" ? (
                            <>
                              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-500">
                                <Boxes className="h-3.5 w-3.5" />
                                {t(uiLocale, "storesManagement.branchList.modePrefix")}{" "}
                                {t(uiLocale, branchSharingModeLabelKeys[branch.sharingMode])}
                              </p>
                              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-500">
                                <Warehouse className="h-3.5 w-3.5" />
                                {t(uiLocale, "storesManagement.branchList.sourcePrefix")} {branch.sourceBranchName ?? "-"}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {describeSharingConfig(uiLocale, branch.sharingConfig)}
                              </p>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        </div>
      ) : null}

      {showBranchManagePanel ? (
        <SlideUpSheet
          isOpen={isCreateBranchSheetOpen}
          onClose={closeCreateBranchSheet}
          title={t(uiLocale, "storesManagement.branchWizard.sheetTitle")}
          description={t(uiLocale, "storesManagement.branchWizard.sheetDescription")}
          panelMaxWidthClass="min-[1200px]:max-w-2xl"
          disabled={loadingKey === "create-branch"}
          footer={
            <>
              {branchPolicy && !branchPolicy.effectiveCanCreateBranches ? (
                <p className="mb-2 text-sm text-red-600">
                  {t(uiLocale, "storesManagement.feedback.branch.permissionDenied")}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 px-4"
                  onClick={branchCreateStep === 1 ? closeCreateBranchSheet : moveBranchStepBackward}
                  disabled={loadingKey !== null}
                >
                  {branchCreateStep === 1
                    ? t(uiLocale, "storesManagement.common.cancel")
                    : t(uiLocale, "storesManagement.common.back")}
                </Button>
                <Button
                  type="button"
                  className="h-10 min-w-[9rem] px-4"
                  onClick={moveBranchStepForward}
                  disabled={loadingKey !== null || !canCreateBranch}
                >
                  {branchCreateStep === 3
                    ? loadingKey === "create-branch"
                      ? t(uiLocale, "storesManagement.branchWizard.createLoading")
                      : t(uiLocale, "storesManagement.branchWizard.createAction")
                    : t(uiLocale, "storesManagement.common.next")}
                </Button>
              </div>
            </>
          }
        >
          <div className="space-y-4">
            <div className="sticky top-0 z-10 -mx-4 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                <div className="relative">
                  <div className="absolute left-5 right-5 top-4 h-px bg-slate-200" />
                  <ol className="relative grid grid-cols-3 gap-2">
                    {branchCreateSteps.map((step) => {
                      const isActiveStep = branchCreateStep === step.id;
                      const isCompletedStep = branchCreateStep > step.id;
                      const canJump = step.id <= branchCreateStep;

                      return (
                        <li key={step.id} className="min-w-0">
                          <button
                            type="button"
                            onClick={() => jumpToBranchStep(step.id)}
                            disabled={!canJump || loadingKey === "create-branch"}
                            className={`flex w-full flex-col items-center gap-1 text-center ${!canJump ? "opacity-60" : ""}`}
                          >
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition ${
                                isCompletedStep
                                  ? "border-emerald-300 bg-emerald-500 text-white"
                                  : isActiveStep
                                    ? "border-blue-400 bg-blue-500 text-white shadow-sm"
                                    : "border-slate-300 bg-white text-slate-500"
                              }`}
                            >
                              {isCompletedStep ? "✓" : step.id}
                            </span>
                            <span
                              className={`block w-full truncate text-[11px] font-medium ${
                                isActiveStep || isCompletedStep ? "text-slate-900" : "text-slate-500"
                              }`}
                            >
                              {t(uiLocale, step.titleKey)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t(uiLocale, "storesManagement.branchWizard.stepPrefix")} {activeBranchCreateStepMeta.id}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-slate-900">
                    {t(uiLocale, activeBranchCreateStepMeta.titleKey)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t(uiLocale, activeBranchCreateStepMeta.descriptionKey)}
                  </p>
                </div>
              </div>
            </div>

            {branchCreateStep === 1 ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500" htmlFor="create-branch-name">
                    {t(uiLocale, "storesManagement.branchWizard.field.name.label")}
                  </label>
                  <input
                    id="create-branch-name"
                    value={branchName}
                    onChange={(event) => {
                      setBranchName(event.target.value);
                      clearBranchFieldError("name");
                    }}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    placeholder={t(uiLocale, "storesManagement.branchWizard.field.name.placeholder")}
                    disabled={loadingKey !== null}
                  />
                  {branchFieldErrors.name ? (
                    <p className="text-xs text-red-600">{branchFieldErrors.name}</p>
                  ) : isDuplicateBranchName ? (
                    <p className="text-xs text-red-600">
                      {t(uiLocale, "storesManagement.feedback.branch.nameDuplicate")}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {t(uiLocale, "storesManagement.branchWizard.field.name.hint")}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-500" htmlFor="create-branch-code">
                      {t(uiLocale, "storesManagement.branchWizard.field.code.label")}
                    </label>
                    <input
                      id="create-branch-code"
                      value={branchCode}
                      onChange={(event) => {
                        setBranchCode(event.target.value.toUpperCase());
                        clearBranchFieldError("code");
                      }}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      placeholder={t(uiLocale, "storesManagement.branchWizard.field.code.placeholder")}
                      disabled={loadingKey !== null}
                    />
                    {branchFieldErrors.code ? (
                      <p className="text-xs text-red-600">{branchFieldErrors.code}</p>
                    ) : isDuplicateBranchCode ? (
                      <p className="text-xs text-red-600">
                        {t(uiLocale, "storesManagement.feedback.branch.codeDuplicate")}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">
                        {t(uiLocale, "storesManagement.branchWizard.field.code.hint")}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-500" htmlFor="create-branch-address">
                      {t(uiLocale, "storesManagement.branchWizard.field.address.label")}
                    </label>
                    <input
                      id="create-branch-address"
                      value={branchAddress}
                      onChange={(event) => {
                        setBranchAddress(event.target.value);
                        clearBranchFieldError("address");
                      }}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      placeholder={t(uiLocale, "storesManagement.branchWizard.field.address.placeholder")}
                      disabled={loadingKey !== null}
                    />
                    {branchFieldErrors.address ? (
                      <p className="text-xs text-red-600">{branchFieldErrors.address}</p>
                    ) : (
                      <p className="text-xs text-slate-500">
                        {t(uiLocale, "storesManagement.branchWizard.field.address.hint")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {branchCreateStep === 2 ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    {t(uiLocale, "storesManagement.branchWizard.mode.title")}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t(uiLocale, "storesManagement.branchWizard.mode.subtitle")}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {branchSharingModeOptions.map((option) => {
                      const selected = branchSharingMode === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`rounded-xl border px-3 py-2 text-left transition ${
                            selected
                              ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            applySharingMode(option.value);
                            clearBranchFieldError("sourceBranchId");
                          }}
                          disabled={loadingKey !== null}
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {t(uiLocale, option.labelKey)}
                            {option.recommended ? (
                              <span className="ml-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                {t(uiLocale, "storesManagement.branchWizard.mode.recommended")}
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {t(uiLocale, option.descriptionKey)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500" htmlFor="create-branch-source">
                    {t(uiLocale, "storesManagement.branchWizard.source.label")}
                  </label>
                  <div className="relative">
                    <ArrowRightLeft className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      id="create-branch-source"
                      value={branchSharingMode === "INDEPENDENT" ? "" : branchSourceBranchId}
                      onChange={(event) => {
                        setBranchSourceBranchId(event.target.value);
                        clearBranchFieldError("sourceBranchId");
                      }}
                      disabled={loadingKey !== null || branchSharingMode === "INDEPENDENT"}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="">{t(uiLocale, "storesManagement.branchWizard.source.placeholder")}</option>
                      {branchSourceOptions.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                          {branch.code === "MAIN"
                            ? ` (${t(uiLocale, "storesManagement.branchList.mainBadge")})`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  {branchFieldErrors.sourceBranchId ? (
                    <p className="text-xs text-red-600">{branchFieldErrors.sourceBranchId}</p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {t(uiLocale, "storesManagement.branchWizard.source.hint")}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <button
                    type="button"
                    className="w-full text-left text-xs font-medium text-slate-700"
                    onClick={() => setIsBranchAdvancedOpen((current) => !current)}
                  >
                    {isBranchAdvancedOpen
                      ? t(uiLocale, "storesManagement.branchWizard.advanced.hide")
                      : t(uiLocale, "storesManagement.branchWizard.advanced.show")}
                  </button>

                  {isBranchAdvancedOpen ? (
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {branchSharingToggleOptions.map((item) => (
                        <label
                          key={item.key}
                          className={`flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-2.5 py-2 ${
                            branchSharingMode === "INDEPENDENT" ? "opacity-70" : ""
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block text-xs font-medium text-slate-900">
                              {t(uiLocale, item.labelKey)}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              {t(uiLocale, item.descriptionKey)}
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            checked={branchSharingConfig[item.key]}
                            onChange={(event) => updateSharingToggle(item.key, event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            disabled={loadingKey !== null}
                          />
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                  <p className="inline-flex items-center gap-1 text-xs font-medium text-blue-800">
                    <Link2 className="h-3.5 w-3.5" />
                    {t(uiLocale, "storesManagement.branchWizard.summaryTitle")}
                  </p>
                  <p className="mt-1 text-xs text-blue-800">{branchSharingSummary}</p>
                </div>
              </div>
            ) : null}

            {branchCreateStep === 3 ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-xs font-medium text-emerald-700">
                    {t(uiLocale, "storesManagement.branchWizard.review.readyTitle")}
                  </p>
                  <p className="mt-1 text-xs text-emerald-800">
                    {t(uiLocale, "storesManagement.branchWizard.review.readyDescription")}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t(uiLocale, "storesManagement.branchWizard.review.title")}
                  </p>
                  <dl className="mt-2 space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">{t(uiLocale, "storesManagement.branchWizard.review.nameLabel")}</dt>
                      <dd className="text-right font-medium text-slate-900">{normalizedBranchName || "-"}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">{t(uiLocale, "storesManagement.branchWizard.review.codeLabel")}</dt>
                      <dd className="text-right font-medium text-slate-900">{normalizedBranchCode || "-"}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">{t(uiLocale, "storesManagement.branchWizard.review.addressLabel")}</dt>
                      <dd className="text-right font-medium text-slate-900">{branchAddress.trim() || "-"}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">{t(uiLocale, "storesManagement.branchWizard.review.modeLabel")}</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {t(uiLocale, branchSharingModeLabelKeys[branchSharingMode])}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-500">{t(uiLocale, "storesManagement.branchWizard.review.sourceLabel")}</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {branchSharingMode === "INDEPENDENT"
                          ? t(uiLocale, "storesManagement.branchWizard.review.sourceIndependent")
                          : sourceBranchLabel ?? "-"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-xs font-medium text-emerald-700">
                      {t(uiLocale, "storesManagement.branchWizard.review.sharedTitle")}
                    </p>
                    <p className="mt-1 text-xs text-emerald-800">
                      {sharedBranchSharingLabels.length > 0
                        ? sharedBranchSharingLabels.join(", ")
                        : t(uiLocale, "storesManagement.sharing.sharedEmpty")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-medium text-slate-700">
                      {t(uiLocale, "storesManagement.branchWizard.review.isolatedTitle")}
                    </p>
                    <p className="mt-1 text-xs text-slate-700">
                      {isolatedBranchSharingLabels.length > 0
                        ? isolatedBranchSharingLabels.join(", ")
                        : t(uiLocale, "storesManagement.sharing.isolatedEmpty")}
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <input
                    type="checkbox"
                    checked={switchToCreatedBranch}
                    onChange={(event) => setSwitchToCreatedBranch(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    disabled={loadingKey !== null}
                  />
                  <span className="text-sm text-slate-700">
                    {t(uiLocale, "storesManagement.branchWizard.review.switchNow")}
                  </span>
                </label>
              </div>
            ) : null}
          </div>
        </SlideUpSheet>
      ) : null}

      {showStoreCreatePanel ? (
        <SlideUpSheet
          isOpen={isCreateStoreSheetOpen}
          onClose={closeCreateStoreSheet}
          title={t(uiLocale, "storesManagement.createStore.sheetTitle")}
          description={t(uiLocale, "storesManagement.createStore.sheetDescription")}
          panelMaxWidthClass="min-[1200px]:max-w-md"
          disabled={loadingKey === "create-store"}
          footer={
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 px-4"
                onClick={closeCreateStoreSheet}
                disabled={loadingKey === "create-store"}
              >
                {t(uiLocale, "storesManagement.common.cancel")}
              </Button>
              <Button
                className="h-10 min-w-[9rem] px-4"
                onClick={createStore}
                disabled={loadingKey !== null || !canCreateStore}
              >
                {loadingKey === "create-store"
                  ? t(uiLocale, "storesManagement.createStore.confirmLoading")
                  : t(uiLocale, "storesManagement.createStore.confirmAction")}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs text-slate-500">{t(uiLocale, "onboarding.step.storeType")}</p>
              <div
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-label={t(uiLocale, "onboarding.step.storeType")}
              >
                {storeTypeOptions.map((option) => {
                  const selected = storeType === option.value;
                  const Icon = option.icon;

                  return (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition ${
                        selected
                          ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      } ${loadingKey !== null || !canCreateStore ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <input
                        type="radio"
                        name="create-store-type"
                        value={option.value}
                        checked={selected}
                        onChange={() => setStoreType(option.value)}
                        className="sr-only"
                        disabled={loadingKey !== null || !canCreateStore}
                      />
                      <span
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${option.iconBgClassName}`}
                      >
                        <Icon className={`h-4 w-4 ${option.iconColorClassName}`} />
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {t(uiLocale, option.titleKey)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-500" htmlFor="create-store-name">
                {t(uiLocale, "onboarding.form.storeName.label")}
              </label>
              <input
                id="create-store-name"
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                disabled={loadingKey !== null || !canCreateStore}
                placeholder={t(uiLocale, "onboarding.form.storeName.placeholder")}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-500" htmlFor="create-store-province">
                {t(uiLocale, "onboarding.form.province.label")}
              </label>
              <select
                id="create-store-province"
                value={provinceId ?? ""}
                onChange={(event) => {
                  const nextProvinceId = Number(event.target.value) || null;
                  setProvinceId(nextProvinceId);
                  setDistrictId(null);
                }}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                disabled={loadingKey !== null || !canCreateStore}
              >
                <option value="">{t(uiLocale, "onboarding.form.province.placeholder")}</option>
                {laosProvinces.map((province) => (
                  <option key={province.id} value={province.id}>
                    {province.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-500" htmlFor="create-store-district">
                {t(uiLocale, "onboarding.form.district.label")}
              </label>
              <select
                id="create-store-district"
                value={districtId ?? ""}
                onChange={(event) => setDistrictId(Number(event.target.value) || null)}
                disabled={!provinceId || loadingKey !== null || !canCreateStore}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="">{t(uiLocale, "onboarding.form.district.placeholder")}</option>
                {districtOptions.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-500" htmlFor="create-store-village">
                {t(uiLocale, "onboarding.form.village.label")}
              </label>
              <input
                id="create-store-village"
                value={village}
                onChange={(event) => setVillage(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                disabled={loadingKey !== null || !canCreateStore}
                placeholder={t(uiLocale, "onboarding.form.village.placeholder")}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-500" htmlFor="create-store-phone">
                {t(uiLocale, "onboarding.form.phone.label")}
              </label>
              <input
                id="create-store-phone"
                value={storePhoneNumber}
                onChange={(event) => setStorePhoneNumber(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                disabled={loadingKey !== null || !canCreateStore}
                placeholder={t(uiLocale, "onboarding.form.phone.placeholder")}
              />
            </div>

            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {t(uiLocale, "storesManagement.createStore.defaultHint")}
            </p>
          </div>
        </SlideUpSheet>
      ) : null}

      {successMessage ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
      ) : null}
    </section>
  );
}
