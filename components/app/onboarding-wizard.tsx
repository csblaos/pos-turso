"use client";

import {
  CheckCircle2,
  Circle,
  Coffee,
  Grid3X3,
  ImagePlus,
  MapPin,
  Phone,
  ShoppingBag,
  Store,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  authFetch,
  clearClientAuthToken,
  setClientAuthToken,
} from "@/lib/auth/client-token";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";
import { clearPurchaseLocalStorage } from "@/lib/purchases/client-storage";
import {
  formatLaosAddress,
  getDistrictsByProvinceId,
  laosProvinces,
} from "@/lib/location/laos-address";

type ChannelStatus = "DISCONNECTED" | "CONNECTED" | "ERROR";

type ChannelState = {
  facebook: ChannelStatus;
  whatsapp: ChannelStatus;
};

type OnboardingStoreType = "ONLINE_RETAIL" | "RESTAURANT" | "CAFE" | "OTHER";

type WizardProps = {
  hasStoreMembership: boolean;
  activeStoreType: OnboardingStoreType | null;
};

const onboardingStepKeys = [
  "onboarding.step.storeType",
  "onboarding.step.storeSetup",
  "onboarding.step.channels",
] as const satisfies ReadonlyArray<MessageKey>;

const storeTypeOptions = [
  {
    value: "ONLINE_RETAIL",
    titleKey: "onboarding.storeType.online.title",
    shortTitleKey: "onboarding.storeType.online.shortTitle",
    descriptionKey: "onboarding.storeType.online.description",
    icon: ShoppingBag,
    iconColorClassName: "text-sky-700",
    iconBgClassName: "bg-sky-100 ring-sky-200",
    available: true,
  },
  {
    value: "RESTAURANT",
    titleKey: "onboarding.storeType.restaurant.title",
    shortTitleKey: "onboarding.storeType.restaurant.shortTitle",
    descriptionKey: "onboarding.storeType.restaurant.description",
    icon: UtensilsCrossed,
    iconColorClassName: "text-amber-700",
    iconBgClassName: "bg-amber-100 ring-amber-200",
    available: true,
  },
  {
    value: "CAFE",
    titleKey: "onboarding.storeType.cafe.title",
    shortTitleKey: "onboarding.storeType.cafe.shortTitle",
    descriptionKey: "onboarding.storeType.cafe.description",
    icon: Coffee,
    iconColorClassName: "text-emerald-700",
    iconBgClassName: "bg-emerald-100 ring-emerald-200",
    available: true,
  },
  {
    value: "OTHER",
    titleKey: "onboarding.storeType.other.title",
    shortTitleKey: "onboarding.storeType.other.shortTitle",
    descriptionKey: "onboarding.storeType.other.description",
    icon: Grid3X3,
    iconColorClassName: "text-violet-700",
    iconBgClassName: "bg-violet-100 ring-violet-200",
    available: true,
  },
] as const satisfies ReadonlyArray<{
  value: OnboardingStoreType;
  titleKey: MessageKey;
  shortTitleKey: MessageKey;
  descriptionKey: MessageKey;
  icon: LucideIcon;
  iconColorClassName: string;
  iconBgClassName: string;
  available: boolean;
}>;

const defaultChannelState: ChannelState = {
  facebook: "DISCONNECTED",
  whatsapp: "DISCONNECTED",
};

const statusLabelKey: Record<ChannelStatus, MessageKey> = {
  DISCONNECTED: "onboarding.channel.status.disconnected",
  CONNECTED: "onboarding.channel.status.connected",
  ERROR: "onboarding.channel.status.error",
};

function FacebookPageBrandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10" fill="#1877F2" />
      <path
        fill="#fff"
        d="M13.79 8.5h1.88V6h-2.21c-2.42 0-3.46 1.48-3.46 3.52V11H8v2.5h1.99V18h2.73v-4.5H15l.36-2.5h-2.64v-1.2c0-.75.22-1.3 1.07-1.3Z"
      />
    </svg>
  );
}

function WhatsAppBrandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 640" aria-hidden="true" className={className}>
      <circle cx="320" cy="320" r="224" fill="#25D366" />
      <path
        fill="#fff"
        d="M476.9 161.1C435 119.1 379.2 96 319.9 96C197.5 96 97.9 195.6 97.9 318C97.9 357.1 108.1 395.3 127.5 429L96 544L213.7 513.1C246.1 530.8 282.6 540.1 319.8 540.1L319.9 540.1C442.2 540.1 544 440.5 544 318.1C544 258.8 518.8 203.1 476.9 161.1zM319.9 502.7C286.7 502.7 254.2 493.8 225.9 477L219.2 473L149.4 491.3L168 423.2L163.6 416.2C145.1 386.8 135.4 352.9 135.4 318C135.4 216.3 218.2 133.5 320 133.5C369.3 133.5 415.6 152.7 450.4 187.6C485.2 222.5 506.6 268.8 506.5 318.1C506.5 419.9 421.6 502.7 319.9 502.7zM421.1 364.5C415.6 361.7 388.3 348.3 383.2 346.5C378.1 344.6 374.4 343.7 370.7 349.3C367 354.9 356.4 367.3 353.1 371.1C349.9 374.8 346.6 375.3 341.1 372.5C308.5 356.2 287.1 343.4 265.6 306.5C259.9 296.7 271.3 297.4 281.9 276.2C283.7 272.5 282.8 269.3 281.4 266.5C280 263.7 268.9 236.4 264.3 225.3C259.8 214.5 255.2 216 251.8 215.8C248.6 215.6 244.9 215.6 241.2 215.6C237.5 215.6 231.5 217 226.4 222.5C221.3 228.1 207 241.5 207 268.8C207 296.1 226.9 322.5 229.6 326.2C232.4 329.9 268.7 385.9 324.4 410C359.6 425.2 373.4 426.5 391 423.9C401.7 422.3 423.8 410.5 428.4 397.5C433 384.5 433 373.4 431.6 371.1C430.3 368.6 426.6 367.2 421.1 364.5z"
      />
    </svg>
  );
}

export function OnboardingWizard({ hasStoreMembership, activeStoreType }: WizardProps) {
  const router = useRouter();
  const uiLocale = useUiLocale();
  const initialStoreType = activeStoreType ?? "ONLINE_RETAIL";
  const nonOnlineChannelMessage = t(uiLocale, "onboarding.channel.nonOnlineOnly");
  const [step, setStep] = useState<1 | 2 | 3>(hasStoreMembership ? 3 : 1);
  const [storeType, setStoreType] = useState<OnboardingStoreType>(initialStoreType);
  const [storeName, setStoreName] = useState("");
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [village, setVillage] = useState("");
  const [storePhoneNumber, setStorePhoneNumber] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [channelStatus, setChannelStatus] = useState<ChannelState>(defaultChannelState);
  const [channelEligibility, setChannelEligibility] = useState<{
    eligible: boolean;
    reason: string | null;
  }>({
    eligible: initialStoreType === "ONLINE_RETAIL",
    reason: null,
  });
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedStoreType = useMemo(
    () => storeTypeOptions.find((option) => option.value === storeType),
    [storeType],
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

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [logoFile]);

  const loadChannelStatus = useCallback(async () => {
    const response = await authFetch("/api/onboarding/channels", {
      method: "GET",
      cache: "no-store",
    });

    const data = (await response.json().catch(() => null)) as
      | {
          status?: ChannelState;
          eligible?: boolean;
          reason?: string | null;
          message?: string;
        }
      | null;

    if (!response.ok) {
      setErrorMessage(data?.message ?? t(uiLocale, "onboarding.error.loadChannelStatus"));
      return;
    }

    if (!data) {
      return;
    }

    if (data.status) {
      setChannelStatus(data.status);
    }
    if (typeof data.eligible === "boolean") {
      setChannelEligibility({
        eligible: data.eligible,
        reason: data.eligible ? null : data.reason ?? null,
      });
    }
  }, [uiLocale]);

  useEffect(() => {
    if (step === 3) {
      void loadChannelStatus();
    }
  }, [step, loadChannelStatus]);

  const goToStep2 = () => {
    if (!selectedStoreType?.available) {
      return;
    }

    setStep(2);
    setNoticeMessage(null);
    setErrorMessage(null);
  };

  const submitStore = async () => {
    if (!storeName.trim()) {
      setErrorMessage(t(uiLocale, "onboarding.error.storeNameRequired"));
      return;
    }
    if (!provinceId) {
      setErrorMessage(t(uiLocale, "onboarding.error.provinceRequired"));
      return;
    }
    if (!districtId) {
      setErrorMessage(t(uiLocale, "onboarding.error.districtRequired"));
      return;
    }
    if (!village.trim()) {
      setErrorMessage(t(uiLocale, "onboarding.error.villageRequired"));
      return;
    }
    if (!storePhoneNumber.trim()) {
      setErrorMessage(t(uiLocale, "onboarding.error.phoneRequired"));
      return;
    }
    if (!/^[0-9+\-\s()]{6,20}$/.test(storePhoneNumber.trim())) {
      setErrorMessage(t(uiLocale, "onboarding.error.phoneInvalid"));
      return;
    }
    if (!formattedAddress) {
      setErrorMessage(t(uiLocale, "onboarding.error.addressIncomplete"));
      return;
    }

    const finalAddress = formattedAddress;
    if (finalAddress.length > 300) {
      setErrorMessage(t(uiLocale, "onboarding.error.addressTooLong"));
      return;
    }

    setIsSubmitting(true);
    setNoticeMessage(null);
    setErrorMessage(null);
    setChannelEligibility({
      eligible: storeType === "ONLINE_RETAIL",
      reason: null,
    });

    const formData = new FormData();
    const normalizedPhoneNumber = storePhoneNumber.trim();
    formData.set("storeType", storeType);
    formData.set("storeName", storeName.trim());
    formData.set("logoName", storeName.trim());
    formData.set("address", finalAddress);
    formData.set("phoneNumber", normalizedPhoneNumber);
    if (logoFile) {
      formData.set("logoFile", logoFile);
    }

    const response = await authFetch("/api/onboarding/store", {
      method: "POST",
      body: formData,
    });

    const data = (await response.json().catch(() => null)) as
      | { token?: string; message?: string; warning?: string }
      | null;

    if (!response.ok) {
      setNoticeMessage(null);
      setErrorMessage(data?.message ?? t(uiLocale, "onboarding.error.createStoreFailed"));
      setIsSubmitting(false);
      return;
    }

    if (data?.warning) {
      setNoticeMessage(data.warning);
    }

    if (data?.token) {
      setClientAuthToken(data.token);
    }

    await loadChannelStatus();
    setStep(3);
    setIsSubmitting(false);
  };

  const connectChannel = async (channel: "FACEBOOK" | "WHATSAPP") => {
    if (!channelEligibility.eligible) {
      setErrorMessage(channelEligibility.reason ?? nonOnlineChannelMessage);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const response = await authFetch("/api/onboarding/channels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel }),
    });

    const data = (await response.json().catch(() => null)) as
      | { message?: string; status?: ChannelState }
      | null;

    if (!response.ok) {
      setErrorMessage(data?.message ?? t(uiLocale, "onboarding.error.connectChannelFailed"));
      setIsSubmitting(false);
      return;
    }

    if (data?.status) {
      setChannelStatus(data.status);
    }

    setIsSubmitting(false);
  };

  const completeOnboarding = () => {
    router.replace("/dashboard");
    router.refresh();
  };

  const openCancelConfirm = () => {
    if (isSubmitting || isCancelling) {
      return;
    }

    setIsCancelConfirmOpen(true);
  };

  const confirmCancelOnboarding = async () => {
    setIsCancelling(true);
    setErrorMessage(null);

    try {
      await authFetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      clearClientAuthToken();
      clearPurchaseLocalStorage();
      setIsCancelConfirmOpen(false);
      setIsCancelling(false);
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <section className="space-y-5">
      <header className="space-y-2 text-center">
        <p className="text-sm font-medium text-blue-600">
          {t(uiLocale, "onboarding.header.eyebrow")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t(uiLocale, "onboarding.header.title")}
        </h1>
      </header>

      <div className="rounded-xl border bg-slate-50 p-3">
        <ol className="grid grid-cols-3 gap-2 text-xs">
          {onboardingStepKeys.map((titleKey, index) => {
            const current = index + 1;
            const done = step > current;
            const active = step === current;

            return (
              <li
                key={titleKey}
                className={`flex items-center gap-1 rounded-md px-2 py-1 ${
                  active ? "bg-blue-100 text-blue-800" : "text-slate-500"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
                <span className="truncate">{t(uiLocale, titleKey)}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-10 w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
        onClick={openCancelConfirm}
        disabled={isSubmitting || isCancelling}
      >
        {isCancelling
          ? t(uiLocale, "onboarding.cancel.loggingOut")
          : t(uiLocale, "onboarding.cancel.action")}
      </Button>

      {step === 1 ? (
        <div className="space-y-3">
          {selectedStoreType ? (
            <article className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-4 text-white">
              <p className="text-xs text-slate-200">
                {t(uiLocale, "onboarding.storeType.selected")}
              </p>
              <div className="mt-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">
                    {t(uiLocale, selectedStoreType.shortTitleKey)}
                  </p>
                  <p className="mt-1 text-xs text-slate-200">
                    {t(uiLocale, selectedStoreType.descriptionKey)}
                  </p>
                </div>
                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <selectedStoreType.icon className="h-5 w-5" />
                </div>
              </div>
            </article>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {storeTypeOptions.map((option) => {
              const selected = storeType === option.value;
              const Icon = option.icon;

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setStoreType(option.value)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selected
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${option.iconBgClassName}`}
                    >
                      <Icon className={`h-5 w-5 ${option.iconColorClassName}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold">{t(uiLocale, option.titleKey)}</p>
                        {selected ? <CheckCircle2 className="h-4 w-4 text-blue-600" /> : null}
                      </div>
                      <p
                        className={`mt-1 text-xs ${
                          option.available ? "text-slate-500" : "text-amber-600"
                        }`}
                      >
                        {t(uiLocale, option.descriptionKey)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <Button
            className="h-11 w-full"
            onClick={goToStep2}
            disabled={!selectedStoreType?.available}
          >
            {t(uiLocale, "onboarding.action.continue")}
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          {selectedStoreType ? (
            <article className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-4">
              <p className="text-xs text-muted-foreground">
                {t(uiLocale, "onboarding.storeSetup.mode")}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${selectedStoreType.iconBgClassName}`}
                >
                  <selectedStoreType.icon
                    className={`h-4 w-4 ${selectedStoreType.iconColorClassName}`}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">{t(uiLocale, selectedStoreType.titleKey)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(uiLocale, selectedStoreType.descriptionKey)}
                  </p>
                </div>
              </div>
            </article>
          ) : null}

          <div className="grid gap-3">
            <label className="rounded-xl border bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Store className="h-4 w-4" />
                {t(uiLocale, "onboarding.form.storeName.label")}
              </div>
              <input
                id="storeName"
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
                className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                placeholder={t(uiLocale, "onboarding.form.storeName.placeholder")}
              />
            </label>

            <label className="rounded-xl border bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {t(uiLocale, "onboarding.form.province.label")}
              </div>
              <select
                value={provinceId ?? ""}
                onChange={(event) => {
                  const nextProvinceId = Number(event.target.value) || null;
                  setProvinceId(nextProvinceId);
                  setDistrictId(null);
                }}
                className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
              >
                <option value="">{t(uiLocale, "onboarding.form.province.placeholder")}</option>
                {laosProvinces.map((province) => (
                  <option key={province.id} value={province.id}>
                    {province.nameEn}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-xl border bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {t(uiLocale, "onboarding.form.district.label")}
              </div>
              <select
                value={districtId ?? ""}
                onChange={(event) => setDistrictId(Number(event.target.value) || null)}
                disabled={!provinceId}
                className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2 disabled:bg-slate-100"
              >
                <option value="">{t(uiLocale, "onboarding.form.district.placeholder")}</option>
                {districtOptions.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.nameEn}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-xl border bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {t(uiLocale, "onboarding.form.village.label")}
              </div>
              <input
                value={village}
                onChange={(event) => setVillage(event.target.value)}
                className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                placeholder={t(uiLocale, "onboarding.form.village.placeholder")}
              />
            </label>

            <label className="rounded-xl border bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-4 w-4" />
                {t(uiLocale, "onboarding.form.phone.label")}
              </div>
              <input
                value={storePhoneNumber}
                onChange={(event) => setStorePhoneNumber(event.target.value)}
                className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                placeholder={t(uiLocale, "onboarding.form.phone.placeholder")}
              />
            </label>

            <label className="rounded-xl border border-dashed bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <ImagePlus className="h-4 w-4" />
                {t(uiLocale, "onboarding.form.logo.label")}
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  setLogoFile(selected);
                }}
                className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-slate-700"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {t(uiLocale, "onboarding.form.logo.hint")}
              </p>
              {logoFile ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
                  <span className="shrink-0">{t(uiLocale, "onboarding.form.logo.selected")}</span>
                  <span className="max-w-[220px] truncate" title={logoFile.name}>
                    {logoFile.name}
                  </span>
                </p>
              ) : null}
              <div className="mt-3 flex justify-center">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 bg-white">
                  {logoPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoPreviewUrl}
                      alt={t(uiLocale, "onboarding.form.logo.previewAlt")}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-slate-400" />
                  )}
                </div>
              </div>
            </label>
          </div>

          <p className="rounded-xl border bg-amber-50 p-3 text-xs text-amber-800">
            {t(uiLocale, "onboarding.storeSetup.note")}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setStep(1)}
              disabled={isSubmitting}
            >
              {t(uiLocale, "onboarding.action.back")}
            </Button>
            <Button className="h-11" onClick={submitStore} disabled={isSubmitting}>
              {isSubmitting
                ? t(uiLocale, "onboarding.action.creatingStore")
                : t(uiLocale, "onboarding.action.createStoreAndContinue")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <article
            className={`rounded-2xl border p-4 ${
              channelEligibility.eligible
                ? "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50"
                : "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50"
            }`}
          >
            <p className="text-xs text-muted-foreground">
              {t(uiLocale, "onboarding.channel.sectionTitle")}
            </p>
            <div className="mt-2 flex items-start gap-3">
              <div
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  channelEligibility.eligible ? "bg-sky-100" : "bg-amber-100"
                }`}
              >
                {channelEligibility.eligible ? (
                  <CheckCircle2 className="h-5 w-5 text-sky-700" />
                ) : (
                  <Circle className="h-5 w-5 text-amber-700" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {channelEligibility.eligible
                    ? t(uiLocale, "onboarding.channel.eligible.title")
                    : t(uiLocale, "onboarding.channel.ineligible.title")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {channelEligibility.eligible
                    ? t(uiLocale, "onboarding.channel.eligible.description")
                    : channelEligibility.reason ?? nonOnlineChannelMessage}
                </p>
              </div>
            </div>
          </article>

          <div className="grid gap-3 sm:grid-cols-2">
            <article
              className={`rounded-xl border bg-white p-4 ${
                channelEligibility.eligible ? "" : "opacity-70"
              }`}
            >
              <div className="flex items-center gap-2">
                <FacebookPageBrandIcon className="h-5 w-5" />
                <p className="font-medium">{t(uiLocale, "onboarding.channel.facebook.label")}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(uiLocale, "onboarding.channel.status.prefix")}{" "}
                {t(uiLocale, statusLabelKey[channelStatus.facebook])}
              </p>
              <Button
                variant={channelStatus.facebook === "CONNECTED" ? "outline" : "default"}
                className="mt-3 h-10 w-full"
                onClick={() => connectChannel("FACEBOOK")}
                disabled={isSubmitting || !channelEligibility.eligible}
              >
                {!channelEligibility.eligible
                  ? t(uiLocale, "onboarding.channel.action.onlineOnly")
                  : channelStatus.facebook === "CONNECTED"
                    ? t(uiLocale, "onboarding.channel.action.connected")
                    : t(uiLocale, "onboarding.channel.facebook.connect")}
              </Button>
            </article>

            <article
              className={`rounded-xl border bg-white p-4 ${
                channelEligibility.eligible ? "" : "opacity-70"
              }`}
            >
              <div className="flex items-center gap-2">
                <WhatsAppBrandIcon className="h-5 w-5" />
                <p className="font-medium">{t(uiLocale, "onboarding.channel.whatsapp.label")}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(uiLocale, "onboarding.channel.status.prefix")}{" "}
                {t(uiLocale, statusLabelKey[channelStatus.whatsapp])}
              </p>
              <Button
                variant={channelStatus.whatsapp === "CONNECTED" ? "outline" : "default"}
                className="mt-3 h-10 w-full"
                onClick={() => connectChannel("WHATSAPP")}
                disabled={isSubmitting || !channelEligibility.eligible}
              >
                {!channelEligibility.eligible
                  ? t(uiLocale, "onboarding.channel.action.onlineOnly")
                  : channelStatus.whatsapp === "CONNECTED"
                    ? t(uiLocale, "onboarding.channel.action.connected")
                    : t(uiLocale, "onboarding.channel.whatsapp.connect")}
              </Button>
            </article>
          </div>

          <Button className="h-11 w-full" onClick={completeOnboarding}>
            {channelEligibility.eligible
              ? t(uiLocale, "onboarding.action.enterDashboard")
              : t(uiLocale, "onboarding.action.skipChannelsAndEnterDashboard")}
          </Button>
        </div>
      ) : null}

      {noticeMessage ? <p className="text-sm text-amber-700">{noticeMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {isCancelConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border bg-white p-4 shadow-xl">
            <h2 className="text-base font-semibold">
              {t(uiLocale, "onboarding.cancel.confirm.title")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(uiLocale, "onboarding.cancel.confirm.description")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => setIsCancelConfirmOpen(false)}
                disabled={isCancelling}
              >
                {t(uiLocale, "onboarding.cancel.confirm.back")}
              </Button>
              <Button
                type="button"
                className="h-10 bg-red-600 text-white hover:bg-red-700"
                onClick={confirmCancelOnboarding}
                disabled={isCancelling}
              >
                {isCancelling
                  ? t(uiLocale, "onboarding.cancel.confirm.cancelling")
                  : t(uiLocale, "onboarding.cancel.confirm.confirm")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
