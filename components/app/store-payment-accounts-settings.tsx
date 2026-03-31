"use client";

import {
  ChevronRight,
  CircleAlert,
  Info,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { authFetch } from "@/lib/auth/client-token";
import { currencyCodeLabel, type StoreCurrency } from "@/lib/finance/store-financial";
import { getRasterImageTypeLabel, isRasterImageContentType, RASTER_IMAGE_ACCEPT } from "@/lib/media/image-upload";
import {
  findLaosBankByCode,
  findLaosBankByName,
  LAOS_BANK_OTHER_OPTION_CODE,
  laosBankCatalog,
  resolveLaosBankDisplayName,
} from "@/lib/payments/laos-banks";
import {
  maskAccountValue,
  paymentAccountSupportsQr,
  type PaymentAccountType,
} from "@/lib/payments/store-payment";

type StorePaymentAccount = {
  id: string;
  displayName: string;
  accountType: PaymentAccountType;
  bankName: string | null;
  accountName: string;
  accountNumber: string | null;
  qrImageUrl: string | null;
  currency: StoreCurrency;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type StorePaymentPolicy = {
  maxAccountsPerStore: number;
};

type StorePaymentAccountsSettingsProps = {
  initialAccounts: StorePaymentAccount[];
  initialPolicy: StorePaymentPolicy;
  canUpdate: boolean;
  canUploadQrImage?: boolean;
  storeSupportedCurrencies: StoreCurrency[];
};

type PaymentApiResponse = {
  ok?: boolean;
  message?: string;
  accounts?: StorePaymentAccount[];
  policy?: StorePaymentPolicy;
};

type PaymentFormState = {
  displayName: string;
  supportsQr: boolean;
  accountName: string;
  accountNumber: string;
  qrImageUrl: string;
  currency: StoreCurrency;
  isDefault: boolean;
  isActive: boolean;
};

type BankSelectValue = string;

const MAX_QR_IMAGE_SIZE_MB = 4;

const emptyForm = (storeSupportedCurrencies: StoreCurrency[]): PaymentFormState => ({
  displayName: "",
  supportsQr: false,
  accountName: "",
  accountNumber: "",
  qrImageUrl: "",
  currency: storeSupportedCurrencies[0] ?? "LAK",
  isDefault: false,
  isActive: true,
});

const formFromAccount = (account: StorePaymentAccount): PaymentFormState => ({
  displayName: account.displayName,
  supportsQr: paymentAccountSupportsQr(account.accountType),
  accountName: account.accountName,
  accountNumber: account.accountNumber ?? "",
  qrImageUrl: account.qrImageUrl ?? "",
  currency: account.currency,
  isDefault: account.isDefault,
  isActive: account.isActive,
});

const fileToObjectUrl = (file: File | null) => {
  if (!file) {
    return null;
  }

  return URL.createObjectURL(file);
};

const resolveBankState = (bankName: string | null | undefined) => {
  const normalized = bankName?.trim() ?? "";
  if (!normalized) {
    return {
      bankSelectValue: "" as BankSelectValue,
      bankCustomName: "",
    };
  }

  const matched = findLaosBankByCode(normalized) ?? findLaosBankByName(normalized);
  if (matched) {
    return {
      bankSelectValue: matched.code as BankSelectValue,
      bankCustomName: "",
    };
  }

  return {
    bankSelectValue: LAOS_BANK_OTHER_OPTION_CODE as BankSelectValue,
    bankCustomName: normalized,
  };
};

const validateForm = (params: {
  form: PaymentFormState;
  bankNameForSubmit: string;
  storeSupportedCurrencies: StoreCurrency[];
  canUploadQrImage: boolean;
  hasQrPreview: boolean;
  hasQrFile: boolean;
  removeQrImage: boolean;
}) => {
  const {
    form,
    bankNameForSubmit,
    storeSupportedCurrencies,
    canUploadQrImage,
    hasQrPreview,
    hasQrFile,
    removeQrImage,
  } = params;

  if (!form.displayName.trim()) {
    return "กรุณาระบุชื่อบัญชี";
  }

  if (!bankNameForSubmit.trim()) {
    return "กรุณาเลือกธนาคาร";
  }

  if (!form.accountName.trim()) {
    return "กรุณาระบุชื่อเจ้าของบัญชี";
  }

  if (!form.accountNumber.trim()) {
    return "กรุณาระบุเลขบัญชี";
  }

  if (form.isDefault && !form.isActive) {
    return "บัญชีหลักต้องอยู่ในสถานะใช้งาน";
  }

  if (!storeSupportedCurrencies.includes(form.currency)) {
    return "กรุณาเลือกสกุลเงินของบัญชีให้ตรงกับสกุลที่ร้านรองรับ";
  }

  if (form.supportsQr) {
    if (!hasQrPreview || removeQrImage) {
      return "กรุณาอัปโหลดรูป QR";
    }

    if (hasQrFile && !canUploadQrImage) {
      return "ยังไม่ได้ตั้งค่า Cloudflare R2 สำหรับอัปโหลดรูป QR";
    }
  }

  return null;
};

export function StorePaymentAccountsSettings({
  initialAccounts,
  initialPolicy,
  canUpdate,
  canUploadQrImage = false,
  storeSupportedCurrencies,
}: StorePaymentAccountsSettingsProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [policy, setPolicy] = useState(initialPolicy);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    initialAccounts[0]?.id ?? null,
  );
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [form, setForm] = useState<PaymentFormState>(() => emptyForm(storeSupportedCurrencies));
  const [bankSelectValue, setBankSelectValue] = useState<BankSelectValue>("");
  const [bankCustomName, setBankCustomName] = useState("");
  const [qrImageFile, setQrImageFile] = useState<File | null>(null);
  const [qrImagePreviewUrl, setQrImagePreviewUrl] = useState<string | null>(null);
  const [removeQrImage, setRemoveQrImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const qrInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const objectUrl = fileToObjectUrl(qrImageFile);
    setQrImagePreviewUrl(objectUrl);

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [qrImageFile]);

  const closeSheet = (options?: { force?: boolean }) => {
    if (!options?.force && (isSaving || isDeleting)) {
      return;
    }

    setIsSheetOpen(false);
  };

  const reachedPolicyLimit = accounts.length >= policy.maxAccountsPerStore;

  const hasQrPreview = useMemo(() => {
    if (!form.supportsQr) {
      return false;
    }

    if (removeQrImage) {
      return false;
    }

    if (qrImagePreviewUrl) {
      return true;
    }

    return form.qrImageUrl.trim().length > 0;
  }, [form.qrImageUrl, form.supportsQr, qrImagePreviewUrl, removeQrImage]);

  const previewImageSrc = useMemo(() => {
    if (removeQrImage || !form.supportsQr) {
      return null;
    }

    return qrImagePreviewUrl || form.qrImageUrl.trim() || null;
  }, [form.qrImageUrl, form.supportsQr, qrImagePreviewUrl, removeQrImage]);

  const bankNameForSubmit = useMemo(() => {
    if (bankSelectValue === LAOS_BANK_OTHER_OPTION_CODE) {
      return bankCustomName.trim();
    }

    return bankSelectValue.trim();
  }, [bankCustomName, bankSelectValue]);

  const resetFormState = () => {
    setForm(emptyForm(storeSupportedCurrencies));
    setBankSelectValue("");
    setBankCustomName("");
    setQrImageFile(null);
    setRemoveQrImage(false);
    if (qrInputRef.current) {
      qrInputRef.current.value = "";
    }
  };

  const openCreateSheet = () => {
    if (reachedPolicyLimit) {
      return;
    }

    setMode("create");
    setSelectedAccountId(null);
    resetFormState();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSheetOpen(true);
  };

  const openEditSheet = (account: StorePaymentAccount) => {
    const bankState = resolveBankState(account.bankName);
    setMode("edit");
    setSelectedAccountId(account.id);
    setForm(formFromAccount(account));
    setBankSelectValue(bankState.bankSelectValue);
    setBankCustomName(bankState.bankCustomName);
    setQrImageFile(null);
    setRemoveQrImage(false);
    if (qrInputRef.current) {
      qrInputRef.current.value = "";
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSheetOpen(true);
  };


  const handleQrFileChanged = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("รองรับเฉพาะไฟล์รูปภาพสำหรับ QR");
      event.target.value = "";
      return;
    }

    if (!isRasterImageContentType(file.type)) {
      setErrorMessage(`รองรับเฉพาะไฟล์ ${getRasterImageTypeLabel()} สำหรับ QR`);
      event.target.value = "";
      return;
    }

    const maxFileSizeBytes = MAX_QR_IMAGE_SIZE_MB * 1024 * 1024;
    if (file.size > maxFileSizeBytes) {
      setErrorMessage(`ไฟล์รูป QR ใหญ่เกินกำหนด (ไม่เกิน ${MAX_QR_IMAGE_SIZE_MB}MB)`);
      event.target.value = "";
      return;
    }

    setErrorMessage(null);
    setQrImageFile(file);
    setRemoveQrImage(false);
  };

  const clearQrImage = () => {
    setQrImageFile(null);
    setForm((current) => ({ ...current, qrImageUrl: "" }));
    setRemoveQrImage(true);
    if (qrInputRef.current) {
      qrInputRef.current.value = "";
    }
  };

  const saveAccount = async () => {
    if (!canUpdate) {
      setErrorMessage("บัญชีนี้ไม่มีสิทธิ์จัดการบัญชีรับเงิน");
      return;
    }

    if (mode === "create" && reachedPolicyLimit) {
      setErrorMessage(`ร้านนี้ตั้งค่าได้สูงสุด ${policy.maxAccountsPerStore} บัญชี`);
      return;
    }

    const validationError = validateForm({
      form,
      bankNameForSubmit,
      storeSupportedCurrencies,
      canUploadQrImage,
      hasQrPreview,
      hasQrFile: Boolean(qrImageFile),
      removeQrImage,
    });
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const accountType: PaymentAccountType = form.supportsQr ? "LAO_QR" : "BANK";
      const formData = new FormData();
      formData.set("displayName", form.displayName.trim());
      formData.set("accountType", accountType);
      formData.set("accountName", form.accountName.trim());
      formData.set("bankName", bankNameForSubmit);
      formData.set("accountNumber", form.accountNumber.trim());
      formData.set("currency", form.currency);
      formData.set("isDefault", String(form.isDefault));
      formData.set("isActive", String(form.isActive));

      if (mode === "edit" && selectedAccountId) {
        formData.set("id", selectedAccountId);
      }

      if (form.supportsQr) {
        if (qrImageFile) {
          formData.set("qrImageFile", qrImageFile);
        }

        if (!qrImageFile && form.qrImageUrl.trim()) {
          formData.set("qrImageUrl", form.qrImageUrl.trim());
        }

        if (mode === "edit") {
          formData.set("removeQrImage", String(removeQrImage));
        }
      } else if (mode === "edit") {
        formData.set("removeQrImage", "true");
      }

      const response = await authFetch("/api/settings/store/payment-accounts", {
        method: mode === "create" ? "POST" : "PATCH",
        body: formData,
      });

      const data = (await response.json().catch(() => null)) as PaymentApiResponse | null;
      if (!response.ok) {
        setErrorMessage(data?.message ?? "บันทึกบัญชีรับเงินไม่สำเร็จ");
        return;
      }

      const nextAccounts = data?.accounts ?? [];
      const nextPolicy = data?.policy ?? policy;
      setAccounts(nextAccounts);
      setPolicy(nextPolicy);
      setSuccessMessage(mode === "create" ? "เพิ่มบัญชีรับเงินแล้ว" : "บันทึกการเปลี่ยนแปลงแล้ว");

      const fallbackSelected =
        mode === "edit" && selectedAccountId
          ? nextAccounts.find((item) => item.id === selectedAccountId) ?? nextAccounts[0] ?? null
          : nextAccounts[0] ?? null;

      setSelectedAccountId(fallbackSelected?.id ?? null);
      closeSheet({ force: true });
      resetFormState();
    } catch {
      setErrorMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSaving(false);
    }
  };

  const removeAccount = async () => {
    if (!canUpdate || !selectedAccountId || mode !== "edit") {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await authFetch(
        `/api/settings/store/payment-accounts?id=${encodeURIComponent(selectedAccountId)}`,
        {
          method: "DELETE",
        },
      );

      const data = (await response.json().catch(() => null)) as PaymentApiResponse | null;
      if (!response.ok) {
        setErrorMessage(data?.message ?? "ลบบัญชีรับเงินไม่สำเร็จ");
        return;
      }

      const nextAccounts = data?.accounts ?? [];
      setAccounts(nextAccounts);
      setPolicy(data?.policy ?? policy);
      setSuccessMessage("ลบบัญชีรับเงินแล้ว");
      setSelectedAccountId(nextAccounts[0]?.id ?? null);
      closeSheet({ force: true });
      resetFormState();
    } catch {
      setErrorMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsDeleting(false);
    }
  };

  const fieldClassName =
    "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none ring-primary focus:ring-2 disabled:bg-slate-100";

  return (
    <section className="space-y-4">
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">บัญชีรับเงินของร้าน</p>
            <p className="mt-0.5 text-xs text-slate-500">
              ใช้งาน {accounts.length.toLocaleString("th-TH")} /{" "}
              {policy.maxAccountsPerStore.toLocaleString("th-TH")} บัญชี
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 w-9 rounded-full px-0"
              onClick={() => setIsHelpOpen(true)}
              aria-label="วิธีตั้งค่าบัญชีรับเงิน"
            >
              <Info className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-full px-3"
              onClick={openCreateSheet}
              disabled={!canUpdate || reachedPolicyLimit || isSaving || isDeleting}
            >
              <Plus className="h-4 w-4" />
              เพิ่มบัญชี
            </Button>
          </div>
        </div>

        {accounts.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">ยังไม่มีบัญชีรับเงินของร้านนี้</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {accounts.map((account) => (
              <li key={account.id}>
                <button
                  type="button"
                  className={`flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                    selectedAccountId === account.id ? "bg-slate-50" : "bg-white"
                  }`}
                  onClick={() => openEditSheet(account)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {account.displayName}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {resolveLaosBankDisplayName(account.bankName)} •{" "}
                      {maskAccountValue(account.accountNumber)} • {currencyCodeLabel(account.currency)}{" "}
                      {paymentAccountSupportsQr(account.accountType)
                        ? account.qrImageUrl
                          ? "• QR พร้อมใช้"
                          : "• ยังไม่มีรูป QR"
                        : "• ไม่มี QR"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {account.isDefault ? (
                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                        Default
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        account.isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      {account.isActive ? "Active" : "Inactive"}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </article>

      {!canUploadQrImage ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          ระบบยังไม่ได้ตั้งค่า Cloudflare R2 สำหรับอัปโหลด QR (ยังบันทึกข้อมูลบัญชีได้ แต่จะยังแนบรูป QR ไม่ได้)
        </p>
      ) : null}

      {errorMessage && !isSheetOpen ? (
        <p className="inline-flex items-center gap-1 text-sm text-red-600">
          <CircleAlert className="h-4 w-4" />
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

      <SlideUpSheet
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="วิธีตั้งค่าบัญชีรับเงิน"
        description="สรุปกติกาที่ควรรู้ก่อนเพิ่มบัญชีหรือแนบ QR"
        panelMaxWidthClass="min-[1200px]:max-w-md"
      >
        <div className="space-y-3 text-sm text-slate-700">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">1 บัญชี = 1 สกุลเงิน</p>
            <p className="mt-1 text-xs text-slate-500">
              เลือกได้เฉพาะสกุลเงินที่ร้านเปิดใช้งานไว้ เพื่อให้เลือกบัญชีตอนรับเงินได้ตรงและไม่สับสน
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">บัญชีเดียวมีได้ทั้งเลขบัญชีและ QR</p>
            <p className="mt-1 text-xs text-slate-500">
              ถ้าบัญชีนี้รับโอนผ่าน QR ได้ ให้เปิดสวิตช์ QR แล้วแนบรูป QR ของบัญชีนั้นได้เลย
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-900">ตั้งบัญชีหลักเฉพาะตัวที่ใช้งานจริง</p>
            <p className="mt-1 text-xs text-slate-500">
              บัญชีหลักต้องอยู่ในสถานะเปิดใช้งาน และเหมาะกับบัญชีที่พนักงานควรเห็นก่อนเป็นค่าเริ่มต้น
            </p>
          </div>
        </div>
      </SlideUpSheet>

      <SlideUpSheet
        isOpen={isSheetOpen}
        onClose={() => closeSheet()}
        title={mode === "create" ? "เพิ่มบัญชีรับเงิน" : "แก้ไขบัญชีรับเงิน"}
        description={
          mode === "create"
            ? "เพิ่มบัญชีที่เลือกได้ 1 สกุลเงิน และแนบ QR ได้"
            : "ปรับข้อมูลบัญชี สกุลเงิน และสถานะการใช้งาน"
        }
        panelMaxWidthClass="min-[1200px]:max-w-md"
        disabled={isSaving || isDeleting}
        footer={
          <div className="flex items-center gap-2">
            {mode === "edit" ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-red-200 px-4 text-red-600 hover:bg-red-50"
                onClick={removeAccount}
                disabled={!canUpdate || isSaving || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    กำลังลบ...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    ลบ
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl px-4"
                onClick={() => closeSheet()}
                disabled={isSaving || isDeleting}
              >
                ยกเลิก
              </Button>
            )}

            <Button
              type="button"
              className="h-11 min-w-[170px] flex-1 rounded-xl"
              onClick={saveAccount}
              disabled={!canUpdate || isSaving || isDeleting}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : mode === "create" ? (
                "สร้างบัญชี"
              ) : (
                "บันทึกการแก้ไข"
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs text-slate-500" htmlFor="payment-display-name">
                ชื่อบัญชี (สำหรับแสดงผล)
              </label>
              <input
                id="payment-display-name"
                className={fieldClassName}
                value={form.displayName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, displayName: event.target.value }))
                }
                disabled={isSaving || isDeleting}
              />
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <label className="flex items-center justify-between gap-2 text-sm text-slate-700">
                <span>บัญชีนี้มี QR รับโอน</span>
                <input
                  type="checkbox"
                  checked={form.supportsQr}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setForm((current) => ({ ...current, supportsQr: checked }));
                    if (!checked) {
                      setQrImageFile(null);
                      setRemoveQrImage(true);
                      if (qrInputRef.current) {
                        qrInputRef.current.value = "";
                      }
                    } else {
                      setRemoveQrImage(false);
                    }
                  }}
                  disabled={isSaving || isDeleting}
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500" htmlFor="payment-bank-select">
                ธนาคาร
              </label>
              <select
                id="payment-bank-select"
                className={fieldClassName}
                value={bankSelectValue}
                onChange={(event) =>
                  setBankSelectValue(event.target.value)
                }
                disabled={isSaving || isDeleting}
              >
                <option value="">เลือกธนาคาร</option>
                {laosBankCatalog.map((bank) => (
                  <option key={bank.code} value={bank.code}>
                    {bank.name}
                  </option>
                ))}
                <option value={LAOS_BANK_OTHER_OPTION_CODE}>อื่นๆ</option>
              </select>

              {bankSelectValue === LAOS_BANK_OTHER_OPTION_CODE ? (
                <input
                  id="payment-bank-other"
                  className={fieldClassName}
                  value={bankCustomName}
                  onChange={(event) => setBankCustomName(event.target.value)}
                  disabled={isSaving || isDeleting}
                  placeholder="ระบุชื่อธนาคาร"
                />
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500" htmlFor="payment-account-number">
                เลขบัญชี
              </label>
              <input
                id="payment-account-number"
                className={fieldClassName}
                value={form.accountNumber}
                onChange={(event) =>
                  setForm((current) => ({ ...current, accountNumber: event.target.value }))
                }
                disabled={isSaving || isDeleting}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500" htmlFor="payment-account-owner">
                ชื่อเจ้าของบัญชี
              </label>
              <input
                id="payment-account-owner"
                className={fieldClassName}
                value={form.accountName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, accountName: event.target.value }))
                }
                disabled={isSaving || isDeleting}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500" htmlFor="payment-currency">
                สกุลเงินของบัญชีนี้
              </label>
              <select
                id="payment-currency"
                className={fieldClassName}
                value={form.currency}
                onChange={(event) =>
                  setForm((current) => ({ ...current, currency: event.target.value as StoreCurrency }))
                }
                disabled={isSaving || isDeleting}
              >
                {storeSupportedCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currencyCodeLabel(currency)}
                  </option>
                ))}
              </select>
            </div>

            {form.supportsQr ? (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-700">รูป QR รับโอน</p>
                  <input
                    ref={qrInputRef}
                    type="file"
                    accept={RASTER_IMAGE_ACCEPT}
                    className="hidden"
                    onChange={handleQrFileChanged}
                    disabled={isSaving || isDeleting || !canUploadQrImage}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => qrInputRef.current?.click()}
                    disabled={isSaving || isDeleting || !canUploadQrImage}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    เลือกรูป
                  </Button>
                </div>

                <p className="text-[11px] text-slate-500">
                  รองรับไฟล์ {getRasterImageTypeLabel()} ไม่เกิน {MAX_QR_IMAGE_SIZE_MB}MB
                </p>

                {previewImageSrc ? (
                  <div className="space-y-2">
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                      <Image
                        src={previewImageSrc}
                        alt="QR preview"
                        width={220}
                        height={220}
                        className="mx-auto h-52 w-52 rounded-lg object-contain"
                        unoptimized
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-full border-red-200 px-3 text-xs text-red-600 hover:bg-red-50"
                      onClick={clearQrImage}
                      disabled={isSaving || isDeleting}
                    >
                      ลบรูป QR
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">ยังไม่มีรูป QR</p>
                )}
              </div>
            ) : null}

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <label className="flex items-center justify-between gap-2 text-sm text-slate-700">
                <span>ตั้งเป็นบัญชีหลัก</span>
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isDefault: event.target.checked }))
                  }
                  disabled={isSaving || isDeleting}
                />
              </label>
              <label className="flex items-center justify-between gap-2 text-sm text-slate-700">
                <span>เปิดใช้งานบัญชีนี้</span>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                  disabled={isSaving || isDeleting}
                />
              </label>
            </div>

            {errorMessage ? (
              <p className="inline-flex items-center gap-1 text-sm text-red-600">
                <CircleAlert className="h-4 w-4" />
                {errorMessage}
              </p>
            ) : null}
        </div>
      </SlideUpSheet>
    </section>
  );
}
