"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ArrowDownToLine, Expand, ExternalLink, X } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  ManagerCancelApprovalModal,
  type ManagerCancelApprovalPayload,
  type ManagerCancelApprovalResult,
} from "@/components/app/manager-cancel-approval-modal";
import { OrderPackContent } from "@/components/app/order-pack-content";
import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import {
  currencyLabel,
  currencySymbol,
  parseStoreCurrency,
  vatModeLabel,
} from "@/lib/finance/store-financial";
import { uiLocaleToDateLocale } from "@/lib/i18n/locales";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";
import { compressRasterImageFile, validateRasterImageFile } from "@/lib/media/client-image";
import { RASTER_IMAGE_ACCEPT } from "@/lib/media/image-upload";
import { buildOrderQrSvgMarkup } from "@/lib/orders/print";
import type { OrderCatalogPaymentAccount, OrderDetail } from "@/lib/orders/queries";
import { maskAccountValue } from "@/lib/payments/store-payment";

type MessagingInfo = {
  within24h: boolean;
  template: string;
  waDeepLink: string | null;
  facebookInboxUrl: string;
};

type OrderDetailViewProps = {
  order: OrderDetail;
  qrPaymentAccounts: OrderCatalogPaymentAccount[];
  messaging: MessagingInfo;
  canUpdate: boolean;
  canMarkPaid: boolean;
  canPack: boolean;
  canShip: boolean;
  canCodReturn: boolean;
  canCancel: boolean;
  canSelfApproveCancel: boolean;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");

const statusLabelKey: Record<OrderDetail["status"], MessageKey> = {
  DRAFT: "orders.status.DRAFT",
  PENDING_PAYMENT: "orders.status.PENDING_PAYMENT",
  READY_FOR_PICKUP: "orders.status.READY_FOR_PICKUP",
  PICKED_UP_PENDING_PAYMENT: "orders.status.PICKED_UP_PENDING_PAYMENT",
  PAID: "orders.status.PAID",
  PACKED: "orders.status.PACKED",
  SHIPPED: "orders.status.SHIPPED",
  COD_RETURNED: "orders.status.COD_RETURNED",
  CANCELLED: "orders.status.CANCELLED",
};

const channelLabelKey: Record<OrderDetail["channel"], MessageKey> = {
  WALK_IN: "orders.channelSummary.walkIn",
  FACEBOOK: "orders.channelSummary.facebook",
  WHATSAPP: "orders.channelSummary.whatsapp",
};

const paymentMethodLabelKey: Record<OrderDetail["paymentMethod"], MessageKey> = {
  CASH: "orders.paymentMethod.CASH",
  LAO_QR: "orders.paymentMethod.LAO_QR",
  ON_CREDIT: "orders.paymentMethod.ON_CREDIT",
  COD: "orders.paymentMethod.COD",
  BANK_TRANSFER: "orders.paymentMethod.BANK_TRANSFER",
};

const paymentStatusLabelKey: Record<OrderDetail["paymentStatus"], MessageKey> = {
  UNPAID: "orders.paymentStatus.UNPAID",
  PENDING_PROOF: "orders.paymentStatus.PENDING_PROOF",
  PAID: "orders.paymentStatus.PAID",
  COD_PENDING_SETTLEMENT: "orders.paymentStatus.COD_PENDING_SETTLEMENT",
  COD_SETTLED: "orders.paymentStatus.COD_SETTLED",
  FAILED: "orders.paymentStatus.FAILED",
};

const shippingLabelStatusLabelKey: Record<OrderDetail["shippingLabelStatus"], MessageKey> = {
  NONE: "orders.shippingLabelStatus.NONE",
  REQUESTED: "orders.shippingLabelStatus.REQUESTED",
  READY: "orders.shippingLabelStatus.READY",
  FAILED: "orders.shippingLabelStatus.FAILED",
};

const SHIPPING_LABEL_MAX_SIZE_MB = 6;
const SHIPPING_LABEL_MAX_SIZE_BYTES = SHIPPING_LABEL_MAX_SIZE_MB * 1024 * 1024;

export function OrderDetailView({
  order,
  qrPaymentAccounts,
  messaging,
  canUpdate,
  canMarkPaid,
  canPack,
  canShip,
  canCodReturn,
  canCancel,
  canSelfApproveCancel,
}: OrderDetailViewProps) {
  const router = useRouter();
  const uiLocale = useUiLocale();
  const numberLocale = uiLocaleToDateLocale(uiLocale);

  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [shippingLabelUrl, setShippingLabelUrl] = useState(order.shippingLabelUrl ?? "");
  const [codSettlementAmount, setCodSettlementAmount] = useState(
    String(order.codAmount > 0 ? order.codAmount : order.total),
  );
  const [codReturnFeeInput, setCodReturnFeeInput] = useState("");
  const [codReturnNoteInput, setCodReturnNoteInput] = useState(order.codReturnNote ?? "");
  const [messageText, setMessageText] = useState(messaging.template);
  const [receiptPrintLoading, setReceiptPrintLoading] = useState(false);
  const [labelPrintLoading, setLabelPrintLoading] = useState(false);
  const [packPrintLoading, setPackPrintLoading] = useState(false);
  const [showConfirmPaidConfirmModal, setShowConfirmPaidConfirmModal] = useState(false);
  const [showConfirmPickupBeforePaidModal, setShowConfirmPickupBeforePaidModal] = useState(false);
  const [showCancelApprovalModal, setShowCancelApprovalModal] = useState(false);
  const [showPackSheet, setShowPackSheet] = useState(false);
  const [showConfirmPaidQrImageViewer, setShowConfirmPaidQrImageViewer] = useState(false);
  const [showOrderQrImageViewer, setShowOrderQrImageViewer] = useState(false);
  const [showShippingLabelSourcePicker, setShowShippingLabelSourcePicker] = useState(false);
  const [showDeleteShippingLabelConfirm, setShowDeleteShippingLabelConfirm] = useState(false);
  const [confirmPaidPaymentMethod, setConfirmPaidPaymentMethod] = useState<"CASH" | "LAO_QR">("CASH");
  const [confirmPaidPaymentAccountId, setConfirmPaidPaymentAccountId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [shippingLabelUploadError, setShippingLabelUploadError] = useState<string | null>(null);
  const shippingLabelFileInputRef = useRef<HTMLInputElement | null>(null);
  const shippingLabelCameraInputRef = useRef<HTMLInputElement | null>(null);

  const isCodPendingAfterShipped =
    order.paymentMethod === "COD" &&
    order.status === "SHIPPED" &&
    order.paymentStatus === "COD_PENDING_SETTLEMENT";
  const isWalkInOrder = order.channel === "WALK_IN";
  const isPickupReadyPrepaid =
    order.paymentMethod !== "COD" &&
    order.status === "READY_FOR_PICKUP" &&
    order.paymentStatus === "PAID";
  const isInStoreCreditSettlement =
    isWalkInOrder &&
    order.paymentMethod === "ON_CREDIT" &&
    ((order.status === "PENDING_PAYMENT" && order.paymentStatus !== "PAID") ||
      (order.status === "READY_FOR_PICKUP" && order.paymentStatus !== "PAID") ||
      (order.status === "PICKED_UP_PENDING_PAYMENT" && order.paymentStatus !== "PAID"));
  const isPickupOrder =
    order.status === "READY_FOR_PICKUP" ||
    order.status === "PICKED_UP_PENDING_PAYMENT" ||
    isPickupReadyPrepaid;
  const isOnlineOrder = !isWalkInOrder;
  const isWalkInPaidComplete =
    isWalkInOrder &&
    order.status === "PAID" &&
    order.paymentStatus === "PAID";
  const canConfirmPaid =
    canMarkPaid &&
    (isCodPendingAfterShipped ||
      (order.paymentMethod !== "COD" &&
        (order.status === "PENDING_PAYMENT" ||
          order.status === "READY_FOR_PICKUP" ||
          order.status === "PICKED_UP_PENDING_PAYMENT")));
  const canMarkPickupBeforePaid =
    canMarkPaid &&
    order.paymentMethod !== "COD" &&
    order.status === "READY_FOR_PICKUP" &&
    order.paymentStatus !== "PAID";
  const canMarkPacked =
    !isWalkInPaidComplete &&
    canPack &&
    (order.status === "PAID" ||
      (order.paymentMethod === "COD" &&
        order.status === "PENDING_PAYMENT" &&
        order.paymentStatus === "COD_PENDING_SETTLEMENT"));
  const canMarkShipped = !isWalkInPaidComplete && canShip && order.status === "PACKED";
  const canMarkCodReturned =
    canCodReturn &&
    order.paymentMethod === "COD" &&
    order.status === "SHIPPED" &&
    order.paymentStatus === "COD_PENDING_SETTLEMENT";
  const canRequestOrderCancel = canCancel || canUpdate;
  const canOrderCancel =
    canRequestOrderCancel &&
    (order.status === "DRAFT" ||
      order.status === "PENDING_PAYMENT" ||
      order.status === "READY_FOR_PICKUP" ||
      order.status === "PICKED_UP_PENDING_PAYMENT" ||
      order.status === "PAID" ||
      order.status === "PACKED" ||
      order.status === "SHIPPED");
  const cancelIsHighRisk =
    order.status === "PAID" || order.status === "PACKED" || order.status === "SHIPPED";
  const orderFlowLabel = isOnlineOrder
    ? t(uiLocale, "orders.flow.ONLINE_DELIVERY")
    : isPickupOrder
      ? t(uiLocale, "orders.flow.PICKUP_LATER")
      : t(uiLocale, "orders.flow.WALK_IN_NOW");
  const showShippingSection =
    isOnlineOrder ||
    Boolean(
      order.shippingProvider ||
        order.shippingCarrier ||
        order.trackingNo ||
        order.shippingLabelUrl ||
        order.shippingCost > 0,
    );
  const isLaoQrOrder = order.paymentMethod === "LAO_QR";
  const showLaoQrMessaging = order.paymentMethod === "LAO_QR" && isOnlineOrder;
  const showWhatsappMessagingAction = order.channel === "WHATSAPP" && Boolean(messaging.waDeepLink);
  const showFacebookMessagingAction =
    order.channel === "FACEBOOK" && Boolean(messaging.facebookInboxUrl);
  const messagingActionCount =
    1 + (showWhatsappMessagingAction ? 1 : 0) + (showFacebookMessagingAction ? 1 : 0);
  const canOpenShippingLabelCamera = typeof window !== "undefined" && "mediaDevices" in navigator;
  const storeCurrencyDisplay = currencySymbol(parseStoreCurrency(order.storeCurrency));
  const paymentCurrencyDisplay = currencyLabel(order.paymentCurrency);
  const walkInCustomerDefault = t(uiLocale, "orders.customer.walkInDefault");
  const guestCustomerDefault = t(uiLocale, "orders.customer.guest");
  const customerNameDisplay =
    (order.customerName ||
      order.contactDisplayName ||
      (isWalkInOrder ? walkInCustomerDefault : guestCustomerDefault)).trim();
  const customerPhoneDisplay = (order.customerPhone || order.contactPhone || "").trim();
  const customerAddressDisplay = (order.customerAddress || "").trim();
  const hasMeaningfulCustomerSection =
    customerNameDisplay !== walkInCustomerDefault ||
    customerPhoneDisplay.length > 0 ||
    customerAddressDisplay.length > 0;
  const showCustomerSection = !isWalkInPaidComplete || hasMeaningfulCustomerSection;
  const showCancelApprovalSummary =
    order.status === "CANCELLED" && Boolean(order.cancelApproval);
  const isAnyPrintLoading = receiptPrintLoading || labelPrintLoading || packPrintLoading;
  const cancelApprovedAtLabel = order.cancelApproval
    ? new Date(order.cancelApproval.approvedAt).toLocaleString(numberLocale)
    : "";
  const cancelApprovalMethodLabel = order.cancelApproval
    ? order.cancelApproval.approvalMode === "SELF_SLIDE"
      ? t(uiLocale, "orders.detail.cancelApproval.method.selfSlide")
      : order.cancelApproval.approvalMode === "MANAGER_PASSWORD"
        ? t(uiLocale, "orders.detail.cancelApproval.method.managerPassword")
        : t(uiLocale, "orders.detail.cancelApproval.method.unknown")
    : "";
  const codCollectedAmount =
    order.paymentMethod === "COD" && order.paymentStatus === "COD_SETTLED"
      ? (order.codAmount > 0 ? order.codAmount : order.total)
      : 0;
  const codShippingMargin = order.shippingFeeCharged - order.shippingCost;
  const codNetOutcome =
    order.paymentMethod === "COD"
      ? order.paymentStatus === "COD_SETTLED"
        ? codCollectedAmount - order.shippingCost
        : order.status === "COD_RETURNED" || isCodPendingAfterShipped
          ? -order.shippingCost
          : 0
      : 0;
  const orderQrSvgMarkup = useMemo(
    () =>
      buildOrderQrSvgMarkup(order.orderNo, {
        size: 120,
        ariaLabel: `${t(uiLocale, "orders.print.label.orderQrTitle")} ${order.orderNo}`,
      }),
    [order.orderNo, uiLocale],
  );
  const printFontFamily = useMemo(() => {
    if (uiLocale === "lo") {
      return '"NotoSansLaoLooped", "GoogleSans", Sarabun, "Noto Sans Lao", "Segoe UI", sans-serif';
    }
    if (uiLocale === "th") {
      return 'Sarabun, "GoogleSans", "Noto Sans Thai", "Segoe UI", sans-serif';
    }
    return 'ui-sans-serif, -apple-system, "Segoe UI", sans-serif';
  }, [uiLocale]);

  const codSettlementAmountNumber = useMemo(
    () => Number(codSettlementAmount || "0"),
    [codSettlementAmount],
  );
  const codReturnFeeNumber = useMemo(() => Number(codReturnFeeInput || "0"), [codReturnFeeInput]);
  const defaultPickupQrPaymentAccountId = useMemo(
    () => qrPaymentAccounts.find((account) => account.isDefault)?.id ?? qrPaymentAccounts[0]?.id ?? "",
    [qrPaymentAccounts],
  );
  const selectedConfirmPaidQrAccount = useMemo(
    () => qrPaymentAccounts.find((account) => account.id === confirmPaidPaymentAccountId) ?? null,
    [confirmPaidPaymentAccountId, qrPaymentAccounts],
  );
  const openConfirmPaidConfirmModal = useCallback(() => {
    if (isInStoreCreditSettlement) {
      setConfirmPaidPaymentMethod("CASH");
      setConfirmPaidPaymentAccountId(defaultPickupQrPaymentAccountId);
    }
    setShowConfirmPaidQrImageViewer(false);
    setShowConfirmPaidConfirmModal(true);
    setErrorMessage(null);
  }, [defaultPickupQrPaymentAccountId, isInStoreCreditSettlement]);
  const getConfirmPaidQrImageActionUrl = useCallback(
    (download = false) => {
      if (!selectedConfirmPaidQrAccount?.id) {
        return null;
      }
      return `/api/orders/payment-accounts/${selectedConfirmPaidQrAccount.id}/qr-image${
        download ? "?download=1" : ""
      }`;
    },
    [selectedConfirmPaidQrAccount],
  );
  const getOrderQrImageActionUrl = useCallback(
    (download = false) => {
      if (!order.paymentAccountId) {
        return null;
      }
      return `/api/orders/payment-accounts/${order.paymentAccountId}/qr-image${
        download ? "?download=1" : ""
      }`;
    },
    [order.paymentAccountId],
  );
  const runPatchAction = useCallback(
    async (
      payload: Record<string, unknown>,
      key: string,
      successText: string,
    ): Promise<ManagerCancelApprovalResult> => {
      setLoadingKey(key);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/orders/${order.id}`, {
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
        const message = data?.message ?? t(uiLocale, "common.error.saveFailed");
        setErrorMessage(message);
        setLoadingKey(null);
        return { ok: false, message };
      }

      setSuccessMessage(successText);
      setLoadingKey(null);
      router.refresh();
      return { ok: true };
    },
    [order.id, router, uiLocale],
  );

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setSuccessMessage(t(uiLocale, "orders.toast.copyMessage.success"));
    } catch {
      setErrorMessage(t(uiLocale, "orders.toast.copyMessage.fail"));
    }
  };

  const openConfirmPaidQrImageFull = useCallback(() => {
    if (!selectedConfirmPaidQrAccount?.qrImageUrl) {
      return;
    }
    setShowConfirmPaidQrImageViewer(true);
  }, [selectedConfirmPaidQrAccount]);

  const openOrderQrImageFull = useCallback(() => {
    if (!order.paymentAccountQrImageUrl) {
      return;
    }
    setShowOrderQrImageViewer(true);
  }, [order.paymentAccountQrImageUrl]);

  const openOrderQrImageInNewTab = useCallback(() => {
    if (!order.paymentAccountQrImageUrl) {
      return;
    }
    const targetUrl = getOrderQrImageActionUrl(false) ?? order.paymentAccountQrImageUrl;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }, [getOrderQrImageActionUrl, order.paymentAccountQrImageUrl]);

  const openConfirmPaidQrImageInNewTab = useCallback(() => {
    if (!selectedConfirmPaidQrAccount?.qrImageUrl) {
      return;
    }
    const targetUrl =
      getConfirmPaidQrImageActionUrl(false) ?? selectedConfirmPaidQrAccount.qrImageUrl;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }, [getConfirmPaidQrImageActionUrl, selectedConfirmPaidQrAccount]);

  const downloadConfirmPaidQrImage = useCallback(async () => {
    if (!selectedConfirmPaidQrAccount?.qrImageUrl) {
      return;
    }

    const safeFileName = selectedConfirmPaidQrAccount.displayName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    try {
      const response = await fetch(
        getConfirmPaidQrImageActionUrl(true) ?? selectedConfirmPaidQrAccount.qrImageUrl,
      );
      if (!response.ok) {
        throw new Error("DOWNLOAD_FAILED");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${safeFileName || "pickup-qr-payment"}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success(t(uiLocale, "orders.toast.qrDownloaded"));
    } catch {
      const fallbackUrl =
        getConfirmPaidQrImageActionUrl(false) ?? selectedConfirmPaidQrAccount.qrImageUrl;
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      toast(t(uiLocale, "orders.toast.openQrNewTab"));
    }
  }, [getConfirmPaidQrImageActionUrl, selectedConfirmPaidQrAccount, uiLocale]);

  const downloadOrderQrImage = useCallback(async () => {
    if (!order.paymentAccountQrImageUrl) {
      return;
    }

    const safeFileName = (order.paymentAccountDisplayName || "payment-qr")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    try {
      const response = await fetch(getOrderQrImageActionUrl(true) ?? order.paymentAccountQrImageUrl);
      if (!response.ok) {
        throw new Error("DOWNLOAD_FAILED");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${safeFileName || "payment-qr"}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success(t(uiLocale, "orders.toast.qrDownloaded"));
    } catch {
      const fallbackUrl = getOrderQrImageActionUrl(false) ?? order.paymentAccountQrImageUrl;
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      toast(t(uiLocale, "orders.toast.openQrNewTab"));
    }
  }, [
    getOrderQrImageActionUrl,
    order.paymentAccountDisplayName,
    order.paymentAccountQrImageUrl,
    uiLocale,
  ]);

  const copyConfirmPaidQrAccountNumber = useCallback(async () => {
    if (!selectedConfirmPaidQrAccount?.accountNumber) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedConfirmPaidQrAccount.accountNumber);
      toast.success(t(uiLocale, "orders.toast.copyAccount.success"));
    } catch {
      toast.error(t(uiLocale, "orders.toast.copyAccount.fail"));
    }
  }, [selectedConfirmPaidQrAccount, uiLocale]);

  const uploadShippingLabelImage = async (file: File, source: "file" | "camera") => {
    const setUploadError = (message: string) => {
      setShippingLabelUploadError(message);
      toast.error(message);
    };

    setLoadingKey(source === "camera" ? "upload-label-camera" : "upload-label-file");
    setShippingLabelUploadError(null);
    setSuccessMessage(null);

    if (!file.type.startsWith("image/")) {
      setUploadError(t(uiLocale, "orders.shippingLabel.error.onlyImage"));
      setLoadingKey(null);
      return;
    }

    if (file.size > SHIPPING_LABEL_MAX_SIZE_BYTES) {
      setUploadError(
        `${t(uiLocale, "orders.shippingLabel.error.tooLarge.prefix")} ${SHIPPING_LABEL_MAX_SIZE_MB}${t(uiLocale, "orders.shippingLabel.error.tooLarge.suffix")}`,
      );
      setLoadingKey(null);
      return;
    }

    try {
      const formData = new FormData();
      formData.set("image", file);
      formData.set("source", source);

      const response = await fetch(`/api/orders/${order.id}/shipments/upload-label`, {
        method: "POST",
        body: formData,
      });

      const data = (await response.json().catch(() => null)) as
        | {
            message?: string;
            labelUrl?: string;
          }
        | null;

      if (!response.ok) {
        setUploadError(data?.message ?? t(uiLocale, "orders.shippingLabel.error.uploadFailed"));
        return;
      }

      if (!data?.labelUrl) {
        setUploadError(t(uiLocale, "orders.shippingLabel.error.noUploadedLink"));
        return;
      }

      setShippingLabelUrl(data.labelUrl);
      const patchResponse = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update_shipping",
          shippingCarrier: order.shippingCarrier ?? "",
          trackingNo: order.trackingNo ?? "",
          shippingLabelUrl: data.labelUrl,
          shippingCost: order.shippingCost,
        }),
      });
      const patchData = (await patchResponse.json().catch(() => null)) as
        | {
            message?: string;
          }
        | null;

      if (!patchResponse.ok) {
        setUploadError(patchData?.message ?? t(uiLocale, "orders.shippingLabel.error.patchFailed"));
        return;
      }

      setShippingLabelUploadError(null);
      setSuccessMessage(
        source === "camera"
          ? t(uiLocale, "orders.shippingLabel.success.camera")
          : t(uiLocale, "orders.shippingLabel.success.file"),
      );
      router.refresh();
    } catch {
      setUploadError(t(uiLocale, "orders.shippingLabel.error.uploadFailed"));
    } finally {
      setLoadingKey(null);
    }
  };

  const removeShippingLabelImage = async () => {
    const result = await runPatchAction(
      {
        action: "update_shipping",
        shippingCarrier: order.shippingCarrier ?? "",
        trackingNo: order.trackingNo ?? "",
        shippingLabelUrl: "",
        shippingCost: order.shippingCost,
      },
      "remove-shipping-label",
      t(uiLocale, "orders.shippingLabel.success.removed"),
    );
    if (result.ok) {
      setShippingLabelUrl("");
      setShowDeleteShippingLabelConfirm(false);
    }
    return result;
  };

  const openShippingLabelSourcePicker = useCallback(() => {
    if (!canUpdate || loadingKey !== null) {
      return;
    }
    setShippingLabelUploadError(null);
    setShowShippingLabelSourcePicker(true);
  }, [canUpdate, loadingKey]);

  const closeShippingLabelSourcePicker = useCallback(() => {
    if (loadingKey !== null) {
      return;
    }
    setShowShippingLabelSourcePicker(false);
  }, [loadingKey]);

  const pickShippingLabelFromDevice = useCallback(
    (source: "file" | "camera") => {
      if (loadingKey !== null) {
        return;
      }
      setShowShippingLabelSourcePicker(false);
      if (source === "camera") {
        shippingLabelCameraInputRef.current?.click();
        return;
      }
      shippingLabelFileInputRef.current?.click();
    },
    [loadingKey],
  );

  const handleShippingLabelFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
    source: "file" | "camera",
  ) => {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!file) {
      return;
    }

    const validation = validateRasterImageFile(file);
    if (!validation.ok) {
      setShippingLabelUploadError(validation.message);
      toast.error(validation.message);
      return;
    }

    setShippingLabelUploadError(null);

    try {
      const optimizedFile = await compressRasterImageFile(file, {
        maxWidth: 1600,
        quality: 0.82,
        fileNameBase: `${order.orderNo}-shipping-label`,
      });
      await uploadShippingLabelImage(optimizedFile, source);
    } catch {
      const message = t(uiLocale, "orders.shippingLabel.error.prepareFailed");
      setShippingLabelUploadError(message);
      toast.error(message);
    }
  };

  const buildReceiptPrintMarkup = useCallback(() => {
    const rows = order.items
      .map(
        (item) => `<tr>
          <td style="padding:4px 0;vertical-align:top;">
            <div>${escapeHtml(item.productName)}</div>
            <div style="font-size:10px;color:#475569;">${escapeHtml(item.productSku)}</div>
          </td>
          <td style="padding:4px 0;text-align:right;white-space:nowrap;">${item.qty.toLocaleString(numberLocale)} ${escapeHtml(item.unitCode)}</td>
          <td style="padding:4px 0;text-align:right;white-space:nowrap;">${item.lineTotal.toLocaleString(numberLocale)}</td>
        </tr>`,
      )
      .join("");

    return `<section class="print-page print-receipt">
      <h1 style="margin:0;text-align:center;font-size:14px;font-weight:700;">${escapeHtml(t(uiLocale, "orders.print.receipt.title"))}</h1>
      <p style="margin:4px 0 0;text-align:center;font-size:11px;">${escapeHtml(t(uiLocale, "orders.print.receipt.noPrefix"))} ${escapeHtml(order.orderNo)}</p>
      <p style="margin:8px 0 0;font-size:11px;">${escapeHtml(t(uiLocale, "orders.print.receipt.customerPrefix"))} ${escapeHtml(order.customerName || order.contactDisplayName || t(uiLocale, "orders.customer.guest"))}</p>
      <p style="margin:2px 0 0;font-size:11px;">${escapeHtml(t(uiLocale, "orders.print.receipt.datePrefix"))} ${escapeHtml(new Date(order.createdAt).toLocaleString(numberLocale))}</p>
      <hr style="border:0;border-top:1px dashed #64748b;margin:8px 0;" />
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:0 0 4px;">${escapeHtml(t(uiLocale, "orders.print.receipt.table.item"))}</th>
            <th style="text-align:right;padding:0 0 4px;">${escapeHtml(t(uiLocale, "orders.print.receipt.table.qty"))}</th>
            <th style="text-align:right;padding:0 0 4px;">${escapeHtml(t(uiLocale, "orders.print.receipt.table.total"))}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <hr style="border:0;border-top:1px dashed #64748b;margin:8px 0;" />
      <div style="font-size:11px;display:flex;justify-content:space-between;gap:8px;"><span>${escapeHtml(t(uiLocale, "orders.print.receipt.summary.subtotal"))}</span><span>${order.subtotal.toLocaleString(numberLocale)}</span></div>
      <div style="font-size:11px;display:flex;justify-content:space-between;gap:8px;"><span>${escapeHtml(t(uiLocale, "orders.print.receipt.summary.discount"))}</span><span>${order.discount.toLocaleString(numberLocale)}</span></div>
      <div style="font-size:11px;display:flex;justify-content:space-between;gap:8px;"><span>${escapeHtml(t(uiLocale, "orders.print.receipt.summary.vat"))}</span><span>${order.vatAmount.toLocaleString(numberLocale)} (${escapeHtml(vatModeLabel(uiLocale, order.storeVatMode))})</span></div>
      <div style="font-size:11px;display:flex;justify-content:space-between;gap:8px;"><span>${escapeHtml(t(uiLocale, "orders.print.receipt.summary.shipping"))}</span><span>${order.shippingFeeCharged.toLocaleString(numberLocale)}</span></div>
      <div style="font-size:12px;font-weight:700;display:flex;justify-content:space-between;gap:8px;"><span>${escapeHtml(t(uiLocale, "orders.print.receipt.summary.netTotal"))}</span><span>${order.total.toLocaleString(numberLocale)} ${escapeHtml(storeCurrencyDisplay)}</span></div>
      <div style="font-size:11px;display:flex;justify-content:space-between;gap:8px;"><span>${escapeHtml(t(uiLocale, "orders.print.receipt.summary.paymentCurrency"))}</span><span>${escapeHtml(paymentCurrencyDisplay)}</span></div>
      <div style="font-size:11px;display:flex;justify-content:space-between;gap:8px;"><span>${escapeHtml(t(uiLocale, "orders.print.receipt.summary.paymentMethod"))}</span><span>${escapeHtml(t(uiLocale, paymentMethodLabelKey[order.paymentMethod]))}</span></div>
      <hr style="border:0;border-top:1px dashed #64748b;margin:8px 0;" />
      <p style="margin:0;text-align:center;font-size:11px;">${escapeHtml(t(uiLocale, "orders.print.receipt.thanks"))}</p>
    </section>`;
  }, [numberLocale, order, paymentCurrencyDisplay, storeCurrencyDisplay, uiLocale]);

  const buildLabelPrintMarkup = useCallback(() => {
    return `<section class="print-page print-label">
      <div style="border:1px solid #0f172a;padding:12px;min-height:136mm;display:flex;flex-direction:column;justify-content:space-between;">
        <section style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start;">
          <div>
            <h1 style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(t(uiLocale, "orders.print.label.title"))}</h1>
            <p style="margin:4px 0 0;font-size:14px;">${escapeHtml(t(uiLocale, "orders.print.label.orderPrefix"))} ${escapeHtml(order.orderNo)}</p>
            <p style="margin:2px 0 0;font-size:13px;">${escapeHtml(t(uiLocale, "orders.print.label.statusPrefix"))} ${escapeHtml(t(uiLocale, statusLabelKey[order.status]))}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#64748b;">${escapeHtml(t(uiLocale, "orders.print.label.createdAtPrefix"))} ${escapeHtml(new Date(order.createdAt).toLocaleString(numberLocale))}</p>
          </div>
          <div style="width:132px;border:1px solid #cbd5e1;border-radius:12px;padding:8px;text-align:center;">
            <div style="width:120px;height:120px;margin:0 auto;">${orderQrSvgMarkup}</div>
            <p style="margin:8px 0 0;font-size:10px;font-weight:700;">${escapeHtml(t(uiLocale, "orders.print.label.orderQrTitle"))}</p>
            <p style="margin:4px 0 0;font-size:9px;line-height:1.35;color:#64748b;">${escapeHtml(t(uiLocale, "orders.print.label.orderQrHint"))}</p>
          </div>
        </section>
        <section style="margin-top:10px;">
          <p style="margin:0 0 6px;font-size:12px;color:#475569;">${escapeHtml(t(uiLocale, "orders.print.label.receiverTitle"))}</p>
          <p style="margin:0;font-size:20px;font-weight:700;line-height:1.2;">${escapeHtml(order.customerName || order.contactDisplayName || t(uiLocale, "orders.customer.guest"))}</p>
          <p style="margin:6px 0 0;font-size:15px;">${escapeHtml(t(uiLocale, "orders.print.label.phonePrefix"))} ${escapeHtml(order.customerPhone || order.contactPhone || "-")}</p>
          <p style="margin:6px 0 0;font-size:15px;white-space:pre-wrap;line-height:1.35;">${escapeHtml(order.customerAddress || "-")}</p>
        </section>
        <section style="border-top:1px dashed #64748b;padding-top:8px;margin-top:12px;font-size:13px;line-height:1.5;">
          <p style="margin:0;">${escapeHtml(t(uiLocale, "orders.print.label.shippingPrefix"))} ${escapeHtml(order.shippingProvider || order.shippingCarrier || "-")}</p>
          <p style="margin:0;">${escapeHtml(t(uiLocale, "orders.print.label.trackingPrefix"))} ${escapeHtml(order.trackingNo || "-")}</p>
          <p style="margin:0;">${escapeHtml(t(uiLocale, "orders.print.label.shippingCostPrefix"))} ${order.shippingCost.toLocaleString(numberLocale)} ${escapeHtml(storeCurrencyDisplay)}</p>
        </section>
      </div>
    </section>`;
  }, [numberLocale, order, orderQrSvgMarkup, storeCurrencyDisplay, uiLocale]);

  const buildPackPrintMarkup = useCallback(() => {
    const totalQuantity = order.items.reduce((sum, item) => sum + item.qty, 0);
    const rows = order.items
      .map(
        (item, index) => `<div style="display:flex;gap:8px;border-top:1px dashed #64748b;padding:6px 0;">
          <div style="font-size:11px;color:#475569;flex-shrink:0;">${index + 1}.</div>
          <div style="min-width:0;flex:1;">
            <div style="font-size:11px;font-weight:700;color:#0f172a;line-height:1.35;word-break:break-word;">${escapeHtml(item.productName)}</div>
            <div style="margin-top:2px;font-size:10px;color:#64748b;word-break:break-word;">${escapeHtml(t(uiLocale, "orders.pack.page.skuLabel"))}: ${escapeHtml(item.productSku || "-")}</div>
          </div>
          <div style="text-align:right;white-space:nowrap;flex-shrink:0;">
            <div style="font-size:11px;font-weight:700;color:#0f172a;">${item.qty.toLocaleString(numberLocale)}</div>
            <div style="font-size:10px;color:#64748b;">${escapeHtml(item.unitCode)}</div>
          </div>
        </div>`,
      )
      .join("");

    const codSummary =
      order.paymentMethod === "COD"
        ? `<div style="margin-top:6px;font-size:11px;display:flex;justify-content:space-between;gap:8px;">
            <span>${escapeHtml(t(uiLocale, "orders.pack.page.codAmountLabel"))}</span>
            <span style="font-weight:700;">${(order.codAmount > 0 ? order.codAmount : order.total).toLocaleString(numberLocale)} ${escapeHtml(storeCurrencyDisplay)}</span>
          </div>`
        : "";

    return `<section class="print-page print-pack">
      <section>
        <h1 style="margin:0;text-align:center;font-size:14px;font-weight:700;">${escapeHtml(t(uiLocale, "orders.pack.page.title"))}</h1>
        <p style="margin:4px 0 0;text-align:center;font-size:13px;font-weight:700;">${escapeHtml(order.orderNo)}</p>
        <p style="margin:4px 0 0;text-align:center;font-size:11px;color:#475569;">${escapeHtml(t(uiLocale, "orders.pack.page.flowLabel"))}: ${escapeHtml(orderFlowLabel)}</p>
        <p style="margin:4px 0 0;text-align:center;font-size:10px;color:#64748b;">${escapeHtml(t(uiLocale, "orders.print.label.createdAtPrefix"))} ${escapeHtml(new Date(order.createdAt).toLocaleString(numberLocale))}</p>

        <div style="margin:8px auto 0;width:72px;height:72px;">${buildOrderQrSvgMarkup(order.orderNo, {
          size: 72,
          ariaLabel: `${t(uiLocale, "orders.print.label.orderQrTitle")} ${order.orderNo}`,
        })}</div>
        <p style="margin:6px 0 0;text-align:center;font-size:9px;color:#64748b;">${escapeHtml(t(uiLocale, "orders.print.label.orderQrHint"))}</p>

        <hr style="border:0;border-top:1px dashed #64748b;margin:8px 0;" />
        <div style="font-size:11px;line-height:1.45;word-break:break-word;">
          <div><strong>${escapeHtml(t(uiLocale, "orders.print.label.receiverTitle"))}:</strong> ${escapeHtml(order.customerName || order.contactDisplayName || t(uiLocale, "orders.customer.guest"))}</div>
          <div><strong>${escapeHtml(t(uiLocale, "common.phone.prefix"))}</strong> ${escapeHtml(order.customerPhone || order.contactPhone || "-")}</div>
          <div><strong>${escapeHtml(t(uiLocale, "orders.print.label.addressPrefix"))}</strong> ${escapeHtml(order.customerAddress || "-")}</div>
          <div><strong>${escapeHtml(t(uiLocale, "orders.print.label.shippingPrefix"))}</strong> ${escapeHtml(order.shippingProvider || order.shippingCarrier || "-")}</div>
          <div><strong>${escapeHtml(t(uiLocale, "orders.print.label.trackingPrefix"))}</strong> ${escapeHtml(order.trackingNo || "-")}</div>
          <div style="display:flex;justify-content:space-between;gap:8px;">
            <span>${escapeHtml(t(uiLocale, "orders.pack.page.itemsQtyTotal"))}</span>
            <span style="font-weight:700;">${totalQuantity.toLocaleString(numberLocale)}</span>
          </div>
        </div>
        ${codSummary}

        <hr style="border:0;border-top:1px dashed #64748b;margin:8px 0;" />
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#475569;">${escapeHtml(t(uiLocale, "orders.pack.page.itemsTitle"))}</div>
          <div style="margin-top:4px;">${rows}</div>
        </div>
      </section>
    </section>`;
  }, [numberLocale, order, orderFlowLabel, storeCurrencyDisplay, uiLocale]);

  const printViaWindow = useCallback(
    (kind: "receipt" | "label" | "pack") => {
      if (typeof window === "undefined") {
        return;
      }

      setErrorMessage(null);
      if (kind === "receipt") {
        setReceiptPrintLoading(true);
      } else if (kind === "label") {
        setLabelPrintLoading(true);
      } else {
        setPackPrintLoading(true);
      }

      const printRootId = "order-detail-inline-print-root";
      const printStyleId = "order-detail-inline-print-style";

      document.getElementById(printRootId)?.remove();
      document.getElementById(printStyleId)?.remove();

      const printRoot = document.createElement("div");
      printRoot.id = printRootId;
      printRoot.setAttribute("aria-hidden", "true");
      printRoot.innerHTML =
        kind === "receipt"
          ? buildReceiptPrintMarkup()
          : kind === "label"
            ? buildLabelPrintMarkup()
            : buildPackPrintMarkup();

      const printStyle = document.createElement("style");
      printStyle.id = printStyleId;
      printStyle.textContent = `
        @media screen {
          #${printRootId} {
            display: none !important;
          }
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          body > *:not(#${printRootId}) {
            display: none !important;
          }
          #${printRootId} {
            display: block !important;
          }
          #${printRootId} .print-page {
            color: #000000;
            font-family: ${printFontFamily};
          }
          #${printRootId} .print-receipt {
            width: 80mm;
            margin: 0 auto;
            padding: 2mm;
            font-size: 12px;
            line-height: 1.35;
          }
          #${printRootId} .print-label {
            width: 105mm;
            margin: 0 auto;
            padding: 4mm;
            font-size: 14px;
            line-height: 1.35;
          }
          #${printRootId} .print-pack {
            width: 80mm;
            margin: 0 auto;
            padding: 2mm;
            font-size: 12px;
            line-height: 1.35;
          }
        }
      `;
      document.head.appendChild(printStyle);
      document.body.appendChild(printRoot);

      const cleanup = () => {
        if (printRoot.parentNode) {
          printRoot.parentNode.removeChild(printRoot);
        }
        if (printStyle.parentNode) {
          printStyle.parentNode.removeChild(printStyle);
        }
      };

      let settled = false;
      const settleLoading = () => {
        if (settled) {
          return;
        }
        settled = true;
        if (kind === "receipt") {
          setReceiptPrintLoading(false);
        } else if (kind === "label") {
          setLabelPrintLoading(false);
        } else {
          setPackPrintLoading(false);
        }
      };

      const handleAfterPrint = () => {
        settleLoading();
        cleanup();
      };
      window.addEventListener("afterprint", handleAfterPrint, { once: true });

      window.setTimeout(() => {
        settleLoading();
      }, 1200);

      window.setTimeout(() => {
        cleanup();
      }, 20000);

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          try {
            window.focus();
            window.print();
          } catch {
            window.removeEventListener("afterprint", handleAfterPrint);
            setErrorMessage(
              kind === "receipt"
                ? t(uiLocale, "orders.print.error.receiptPrintFailed")
                : kind === "label"
                  ? t(uiLocale, "orders.print.error.labelPrintFailed")
                  : t(uiLocale, "orders.print.error.packPrintFailed"),
            );
            settleLoading();
            cleanup();
          }
        });
      });
    },
    [buildLabelPrintMarkup, buildPackPrintMarkup, buildReceiptPrintMarkup, printFontFamily, uiLocale],
  );

  const handlePrintPackFromSheet = useCallback(() => {
    if (isAnyPrintLoading) {
      return;
    }
    setShowPackSheet(false);
    window.setTimeout(() => {
      printViaWindow("pack");
    }, 280);
  }, [isAnyPrintLoading, printViaWindow]);

  const isSlipPendingProof =
    isOnlineOrder && order.paymentMethod === "LAO_QR" && order.paymentStatus === "PENDING_PROOF";

  const confirmPaidButtonKey: MessageKey = isCodPendingAfterShipped
    ? "orders.detail.action.confirmCodReceived"
    : isPickupReadyPrepaid
      ? "orders.detail.action.confirmPickupReceived"
      : isSlipPendingProof
        ? "orders.detail.action.reviewSlipAndConfirm"
        : isOnlineOrder
          ? "orders.detail.action.confirmPaid"
          : "orders.detail.action.confirmPaymentReceived";
  const confirmPaidButtonLabel = t(uiLocale, confirmPaidButtonKey);

  const confirmPaidSuccessKey: MessageKey = isCodPendingAfterShipped
    ? "orders.detail.toast.codSettled"
    : isPickupReadyPrepaid
      ? "orders.detail.toast.pickupConfirmed"
      : isOnlineOrder
        ? "orders.detail.toast.markedPaid"
        : "orders.detail.toast.paymentConfirmed";
  const confirmPaidSuccessText = t(uiLocale, confirmPaidSuccessKey);
  const confirmPaidDisabled =
    !canConfirmPaid ||
    loadingKey !== null ||
    (isCodPendingAfterShipped &&
      (!Number.isFinite(codSettlementAmountNumber) || codSettlementAmountNumber < 0)) ||
    (isInStoreCreditSettlement &&
      confirmPaidPaymentMethod === "LAO_QR" &&
      !selectedConfirmPaidQrAccount);
  const shouldConfirmReceivePaymentAction = !isCodPendingAfterShipped && !isPickupReadyPrepaid;
  const shouldConfirmPickupReceiveAction = isPickupReadyPrepaid;
  const confirmPaidConfirmTitleKey: MessageKey = isPickupReadyPrepaid
    ? "orders.detail.confirmPaid.title.pickup"
    : isCodPendingAfterShipped
      ? "orders.detail.confirmPaid.title.cod"
      : isSlipPendingProof
        ? "orders.detail.confirmPaid.title.slip"
        : "orders.detail.confirmPaid.title.default";
  const confirmPaidConfirmTitle = t(uiLocale, confirmPaidConfirmTitleKey);

  const confirmPaidConfirmDescriptionKey: MessageKey = isPickupReadyPrepaid
    ? "orders.detail.confirmPaid.description.pickup"
    : isCodPendingAfterShipped
      ? "orders.detail.confirmPaid.description.cod"
      : isInStoreCreditSettlement
        ? "orders.detail.confirmPaid.description.inStoreCredit"
        : isSlipPendingProof
          ? "orders.detail.confirmPaid.description.slip"
          : "orders.detail.confirmPaid.description.default";
  const runConfirmPaidAction = async () => {
    const pickupSettlementPayload =
      isInStoreCreditSettlement
        ? {
            paymentMethod: confirmPaidPaymentMethod,
            paymentAccountId:
              confirmPaidPaymentMethod === "LAO_QR" ? confirmPaidPaymentAccountId : undefined,
          }
        : {};
    const result = await runPatchAction(
      {
        action: "confirm_paid",
        codAmount:
          isCodPendingAfterShipped && Number.isFinite(codSettlementAmountNumber)
            ? Math.max(0, Math.trunc(codSettlementAmountNumber))
            : undefined,
        ...pickupSettlementPayload,
      },
      "confirm-paid",
      confirmPaidSuccessText,
    );
    if (result.ok) {
      setShowConfirmPaidConfirmModal(false);
    }
    return result;
  };
  const pickupBeforePaidDisabled = !canMarkPickupBeforePaid || loadingKey !== null;
  const runMarkPickupBeforePaidAction = async () => {
    const result = await runPatchAction(
      {
        action: "mark_picked_up_unpaid",
      },
      "mark-picked-up-unpaid",
      t(uiLocale, "orders.detail.toast.pickedUpUnpaid"),
    );
    if (result.ok) {
      setShowConfirmPickupBeforePaidModal(false);
    }
    return result;
  };
  const codReturnDisabled =
    !canMarkCodReturned ||
    loadingKey !== null ||
    !Number.isFinite(codReturnFeeNumber) ||
    codReturnFeeNumber < 0;
  const submitCancelWithApproval = async ({
    approvalEmail,
    approvalPassword,
    cancelReason,
  }: ManagerCancelApprovalPayload): Promise<ManagerCancelApprovalResult> => {
    const result = await runPatchAction(
      {
        action: "cancel",
        approvalEmail,
        approvalPassword,
        cancelReason,
      },
      "cancel",
      t(uiLocale, "orders.detail.toast.cancelled"),
    );
    if (!result.ok) {
      return result;
    }
    setShowCancelApprovalModal(false);
    return { ok: true };
  };

  const selectedConfirmPaidQrBankDisplay = selectedConfirmPaidQrAccount?.bankName?.trim() || "-";

  useEffect(() => {
    if (!showConfirmPaidQrImageViewer) {
      return;
    }
    if (!selectedConfirmPaidQrAccount?.qrImageUrl) {
      setShowConfirmPaidQrImageViewer(false);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowConfirmPaidQrImageViewer(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedConfirmPaidQrAccount, showConfirmPaidQrImageViewer]);

  useEffect(() => {
    if (!showOrderQrImageViewer) {
      return;
    }
    if (!order.paymentAccountQrImageUrl) {
      setShowOrderQrImageViewer(false);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowOrderQrImageViewer(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [order.paymentAccountQrImageUrl, showOrderQrImageViewer]);

  const timelineSteps = useMemo(() => {
    const makeTimelineSteps = (labelKeys: MessageKey[], currentStep: number) =>
      labelKeys.map((labelKey, index) => ({
        label: t(uiLocale, labelKey),
        state: index < currentStep ? "done" : index === currentStep ? "current" : "todo",
      }));

    if (isOnlineOrder) {
      const labelKeys: MessageKey[] =
        order.paymentMethod === "COD"
          ? [
              "orders.timeline.step.create",
              "orders.timeline.step.pack",
              "orders.timeline.step.ship",
              "orders.timeline.step.codSettle",
            ]
          : [
              "orders.timeline.step.create",
              "orders.timeline.step.confirmPaid",
              "orders.timeline.step.pack",
              "orders.timeline.step.ship",
            ];
      let currentStep = 0;
      if (order.paymentMethod === "COD") {
        if (order.status === "PENDING_PAYMENT") {
          currentStep = 1;
        } else if (order.status === "PACKED") {
          currentStep = 2;
        } else if (order.status === "SHIPPED") {
          currentStep = 3;
        }
        if (order.paymentStatus === "COD_SETTLED" || order.status === "COD_RETURNED") {
          currentStep = 3;
        }
      } else {
        if (order.status === "PENDING_PAYMENT" || order.status === "READY_FOR_PICKUP") {
          currentStep = 1;
        } else if (order.status === "PAID") {
          currentStep = 2;
        } else if (order.status === "PACKED" || order.status === "SHIPPED") {
          currentStep = 3;
        }
      }
      return makeTimelineSteps(labelKeys, currentStep);
    }

    if (isPickupOrder) {
      const labelKeys: MessageKey[] = [
        "orders.timeline.step.create",
        "orders.timeline.step.reservePickup",
        "orders.timeline.step.pickup",
        "orders.timeline.step.done",
      ];
      let currentStep = 0;
      if (order.status === "READY_FOR_PICKUP") {
        currentStep = order.paymentStatus === "PAID" ? 2 : 1;
      } else if (order.status === "PICKED_UP_PENDING_PAYMENT") {
        currentStep = 2;
      } else if (order.status === "PAID") {
        currentStep = 3;
      } else if (order.status === "PENDING_PAYMENT") {
        currentStep = 1;
      }
      return makeTimelineSteps(labelKeys, currentStep);
    }

    const labelKeys: MessageKey[] = [
      "orders.timeline.step.create",
      "orders.timeline.step.payment",
      "orders.timeline.step.done",
    ];
    let currentStep = 0;
    if (order.status === "PENDING_PAYMENT") {
      currentStep = 1;
    } else if (order.status === "PAID" || order.status === "PACKED" || order.status === "SHIPPED") {
      currentStep = 2;
    }
    return makeTimelineSteps(labelKeys, currentStep);
  }, [isOnlineOrder, isPickupOrder, order.paymentMethod, order.paymentStatus, order.status, uiLocale]);
  const timelineDoneCount = useMemo(
    () => timelineSteps.filter((step) => step.state === "done").length,
    [timelineSteps],
  );
  const timelineCurrentIndex = useMemo(() => {
    const currentIndex = timelineSteps.findIndex((step) => step.state === "current");
    if (currentIndex >= 0) {
      return currentIndex;
    }
    return Math.max(0, Math.min(timelineSteps.length - 1, timelineDoneCount));
  }, [timelineDoneCount, timelineSteps]);
  const timelineReachedCount = useMemo(() => {
    if (timelineSteps.length === 0) {
      return 0;
    }
    const hasCurrent = timelineSteps.some((step) => step.state === "current");
    if (hasCurrent) {
      return Math.min(timelineSteps.length, timelineDoneCount + 1);
    }
    return Math.min(timelineSteps.length, timelineDoneCount);
  }, [timelineDoneCount, timelineSteps]);
  const timelineProgressPercent = useMemo(() => {
    if (timelineSteps.length === 0) {
      return 0;
    }
    return Math.round((timelineReachedCount / timelineSteps.length) * 100);
  }, [timelineReachedCount, timelineSteps.length]);
  const timelineCurrentLabel = timelineSteps[timelineCurrentIndex]?.label ?? "-";

  const primaryAction =
    isWalkInPaidComplete
      ? null
      : canConfirmPaid
      ? {
          key: "confirm-paid",
          label: confirmPaidButtonLabel,
          onClick: () => {
            if (shouldConfirmReceivePaymentAction || shouldConfirmPickupReceiveAction) {
              openConfirmPaidConfirmModal();
              return;
            }
            return runConfirmPaidAction();
          },
          disabled: confirmPaidDisabled,
        }
      : canMarkPacked
        ? {
            key: "mark-packed",
            label: t(
              uiLocale,
              isOnlineOrder ? "orders.detail.action.markPacked.online" : "orders.detail.action.markPacked.offline",
            ),
            onClick: () =>
              runPatchAction(
                { action: "mark_packed" },
                "mark-packed",
                t(
                  uiLocale,
                  isOnlineOrder ? "orders.detail.toast.markPacked.online" : "orders.detail.toast.markPacked.offline",
                ),
              ),
            disabled: loadingKey !== null,
          }
        : canMarkShipped
          ? {
              key: "mark-shipped",
              label: t(
                uiLocale,
                isOnlineOrder ? "orders.detail.action.markShipped.online" : "orders.detail.action.markShipped.offline",
              ),
              onClick: () =>
                runPatchAction(
                  { action: "mark_shipped" },
                  "mark-shipped",
                  t(
                    uiLocale,
                    isOnlineOrder ? "orders.detail.toast.markShipped.online" : "orders.detail.toast.markShipped.offline",
                  ),
                ),
              disabled: loadingKey !== null,
            }
          : order.status === "DRAFT" && canUpdate
            ? {
                key: "submit",
                label: t(uiLocale, "orders.detail.action.submitForPayment"),
                onClick: () =>
                  runPatchAction(
                    { action: "submit_for_payment" },
                    "submit",
                    t(uiLocale, "orders.detail.toast.submittedForPayment"),
                  ),
                disabled: loadingKey !== null,
              }
            : null;
  const primaryActionKey = primaryAction?.key ?? null;
  const actionRailEmptyMessage =
    isOnlineOrder && order.status === "SHIPPED" && order.paymentMethod !== "COD"
      ? t(uiLocale, "orders.detail.emptyAction.onlineShipped")
      : order.paymentMethod === "COD" && order.paymentStatus === "COD_SETTLED"
        ? t(uiLocale, "orders.detail.emptyAction.codSettled")
        : order.status === "COD_RETURNED"
          ? t(uiLocale, "orders.detail.emptyAction.codReturned")
          : t(uiLocale, "orders.detail.emptyAction.none");
  const showExtraActionsHeader = !(
    (isWalkInOrder && (order.status === "CANCELLED" || order.status === "PENDING_PAYMENT")) ||
    order.status === "READY_FOR_PICKUP" ||
    order.status === "PICKED_UP_PENDING_PAYMENT"
  );
  const extraActions = [
    canMarkPacked && primaryActionKey !== "mark-packed"
      ? {
          key: "mark-packed",
          label: t(
            uiLocale,
            isOnlineOrder ? "orders.detail.action.markPacked.online" : "orders.detail.action.markPacked.offline",
          ),
          tone: "outline" as const,
          onClick: () =>
            runPatchAction(
              { action: "mark_packed" },
              "mark-packed",
              t(
                uiLocale,
                isOnlineOrder ? "orders.detail.toast.markPacked.online" : "orders.detail.toast.markPacked.offline",
              ),
            ),
          disabled: loadingKey !== null,
        }
      : null,
    canMarkShipped && primaryActionKey !== "mark-shipped"
      ? {
          key: "mark-shipped",
          label: t(
            uiLocale,
            isOnlineOrder ? "orders.detail.action.markShipped.online" : "orders.detail.action.markShipped.offline",
          ),
          tone: "outline" as const,
          onClick: () =>
            runPatchAction(
              { action: "mark_shipped" },
              "mark-shipped",
              t(
                uiLocale,
                isOnlineOrder ? "orders.detail.toast.markShipped.online" : "orders.detail.toast.markShipped.offline",
              ),
            ),
          disabled: loadingKey !== null,
        }
      : null,
    canMarkCodReturned
      ? {
          key: "mark-cod-returned",
          label: t(uiLocale, "orders.detail.action.markCodReturned"),
          tone: "warning" as const,
          onClick: () =>
            runPatchAction(
              {
                action: "mark_cod_returned",
                codFee: Number.isFinite(codReturnFeeNumber)
                  ? Math.max(0, Math.trunc(codReturnFeeNumber))
                  : 0,
                codReturnNote: codReturnNoteInput.trim(),
              },
              "mark-cod-returned",
              t(uiLocale, "orders.detail.toast.codReturned"),
            ),
          disabled: codReturnDisabled,
        }
      : null,
  ].filter((action): action is NonNullable<typeof action> => Boolean(action));

  return (
    <section className="mx-auto max-w-6xl space-y-4 overflow-x-hidden pb-10">
      <header className="space-y-3 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{order.orderNo}</p>
            <h1 className="text-xl font-semibold">{t(uiLocale, "orders.detail.title")}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600">
                {orderFlowLabel}
              </span>
              <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600">
                {t(uiLocale, "orders.detail.chip.channelPrefix")}{" "}
                {t(uiLocale, channelLabelKey[order.channel])}
              </span>
              <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600">
                {t(uiLocale, "orders.detail.chip.statusPrefix")}{" "}
                {t(uiLocale, statusLabelKey[order.status])}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <article className="space-y-3 border-b border-slate-200 pb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {t(uiLocale, "orders.detail.section.statusTitle")}
            </h2>

            <div className="space-y-2 sm:hidden">
              <div className="flex items-center justify-between text-xs">
                <p className="min-w-0 flex-1 truncate pr-2 font-medium text-slate-800">
                  {t(uiLocale, "orders.detail.timeline.stepPrefix")}{" "}
                  {Math.max(1, timelineCurrentIndex + 1)}/{Math.max(1, timelineSteps.length)}
                  {t(uiLocale, "orders.detail.timeline.stepSuffix")} {timelineCurrentLabel}
                </p>
                <p className="text-slate-500">{timelineProgressPercent}%</p>
              </div>
              <div className="w-full max-w-full pb-0.5">
                <ol className="flex w-full items-start gap-1.5">
                  {timelineSteps.map((step, index) => {
                    const isDone = step.state === "done";
                    const isCurrent = step.state === "current";
                    const connectorDone = timelineReachedCount > index + 1;
                    return (
                      <li key={step.label} className="flex min-w-0 flex-1 items-center gap-1.5">
                        <div
                          className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md border px-1 py-1.5 ${
                            isDone
                              ? "border-emerald-200 bg-emerald-50"
                              : isCurrent
                                ? "border-blue-300 bg-blue-50"
                                : "border-slate-200 bg-white"
                          }`}
                        >
                          <span
                            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                              isDone
                                ? "bg-emerald-100 text-emerald-700"
                                : isCurrent
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {index + 1}
                          </span>
                          <span
                            className={`line-clamp-2 text-center text-[11px] leading-4 ${
                              isDone
                                ? "text-emerald-700"
                                : isCurrent
                                  ? "font-semibold text-blue-700"
                                  : "text-slate-500"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                        {index < timelineSteps.length - 1 ? (
                          <span
                            className={`h-[2px] w-2 shrink-0 rounded-full ${
                              connectorDone ? "bg-emerald-300" : "bg-slate-200"
                            }`}
                            aria-hidden="true"
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${timelineProgressPercent}%` }}
                />
              </div>
            </div>

            <ol className="hidden items-start gap-2 sm:flex">
              {timelineSteps.map((step, index) => {
                const isDone = step.state === "done";
                const isCurrent = step.state === "current";
                const connectorDone = timelineReachedCount > index + 1;
                return (
                  <li key={step.label} className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            isDone
                              ? "bg-emerald-100 text-emerald-700"
                              : isCurrent
                                ? "bg-blue-100 text-blue-700 ring-2 ring-blue-200"
                                : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span
                          className={`truncate text-xs ${
                            isDone
                              ? "text-slate-700"
                              : isCurrent
                                ? "font-semibold text-blue-700"
                                : "text-slate-500"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    </div>
                    {index < timelineSteps.length - 1 ? (
                      <span
                        className={`h-[2px] w-6 shrink-0 rounded-full lg:w-10 ${
                          connectorDone ? "bg-emerald-300" : "bg-slate-200"
                        }`}
                        aria-hidden="true"
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>

            {isWalkInPaidComplete ? (
              <p className="text-xs text-emerald-700">
                {t(uiLocale, "orders.detail.status.walkInCompleteNotice")}
              </p>
            ) : null}
          </article>

          {showCancelApprovalSummary && order.cancelApproval ? (
            <article className="space-y-2 border-b border-slate-200 pb-4">
              <h2 className="text-sm font-semibold text-slate-900">
                {t(uiLocale, "orders.detail.section.cancelApprovalTitle")}
              </h2>
              <div className="rounded-md border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs text-rose-800">
                <p>
                  {t(uiLocale, "orders.detail.cancelApproval.reasonPrefix")}{" "}
                  {order.cancelApproval.cancelReason || "-"}
                </p>
                <p>
                  {t(uiLocale, "orders.detail.cancelApproval.approverPrefix")}{" "}
                  {order.cancelApproval.approvedByName || "-"}{" "}
                  {order.cancelApproval.approvedByRole
                    ? `(${order.cancelApproval.approvedByRole})`
                    : ""}
                </p>
                <p>
                  {t(uiLocale, "orders.detail.cancelApproval.approverEmailPrefix")}{" "}
                  {order.cancelApproval.approvedByEmail || "-"}
                </p>
                <p>
                  {t(uiLocale, "orders.detail.cancelApproval.methodPrefix")} {cancelApprovalMethodLabel}
                </p>
                <p>
                  {t(uiLocale, "orders.detail.cancelApproval.cancelledByPrefix")}{" "}
                  {order.cancelApproval.cancelledByName || "-"}
                </p>
                <p>
                  {t(uiLocale, "orders.detail.cancelApproval.approvedAtPrefix")} {cancelApprovedAtLabel}
                </p>
              </div>
            </article>
          ) : null}

          {showCustomerSection ? (
            <article className="space-y-2 border-b border-slate-200 pb-4">
              <h2 className="text-sm font-semibold text-slate-900">
                {t(uiLocale, "orders.detail.section.customerTitle")}
              </h2>
              <p className="text-sm">{customerNameDisplay}</p>
              <p className="text-xs text-muted-foreground">
                {t(uiLocale, "orders.detail.customer.phonePrefix")} {customerPhoneDisplay || "-"}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(uiLocale, "orders.detail.customer.addressPrefix")} {customerAddressDisplay || "-"}
              </p>
            </article>
          ) : null}

          <article className="space-y-3 border-b border-slate-200 pb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {t(uiLocale, "orders.detail.items.title")}
            </h2>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="hidden grid-cols-[minmax(0,1fr)_7rem_9rem] bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500 lg:grid">
                <p>{t(uiLocale, "orders.print.receipt.table.item")}</p>
                <p className="text-right">{t(uiLocale, "orders.print.receipt.table.qty")}</p>
                <p className="text-right">{t(uiLocale, "orders.print.receipt.table.total")}</p>
              </div>
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-1.5 border-t border-slate-200 px-3 py-2.5 first:border-t-0 lg:grid-cols-[minmax(0,1fr)_7rem_9rem] lg:items-center lg:gap-2"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium text-slate-900">{item.productName}</p>
                    <p className="text-xs text-slate-500">{item.productSku || "-"}</p>
                  </div>
                  <div className="text-left lg:text-right">
                    <p className="text-[11px] text-slate-500 lg:hidden">
                      {t(uiLocale, "orders.print.receipt.table.qty")}
                    </p>
                    <p className="text-sm font-medium text-slate-700 tabular-nums">
                      {item.qty.toLocaleString(numberLocale)} {item.unitCode}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {t(uiLocale, "orders.detail.items.baseQtyPrefix")}{" "}
                      {item.qtyBase.toLocaleString(numberLocale)}
                    </p>
                  </div>
                  <div className="text-left lg:text-right">
                    <p className="text-[11px] text-slate-500 lg:hidden">
                      {t(uiLocale, "orders.detail.items.lineTotalLabel")}
                    </p>
                    <p className="text-sm font-semibold text-slate-900 tabular-nums">
                      {item.lineTotal.toLocaleString(numberLocale)} {storeCurrencyDisplay}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="space-y-1.5 rounded-md bg-slate-50/70 px-0 py-2.5 text-sm">
                <p className="flex items-center justify-between gap-4">
                  <span className="text-slate-600">{t(uiLocale, "orders.print.receipt.summary.subtotal")}</span>
                  <span className="text-slate-900 tabular-nums">
                    {order.subtotal.toLocaleString(numberLocale)} {storeCurrencyDisplay}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-4">
                  <span className="text-slate-600">{t(uiLocale, "orders.print.receipt.summary.discount")}</span>
                  <span className="text-slate-900 tabular-nums">
                    {order.discount.toLocaleString(numberLocale)} {storeCurrencyDisplay}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-4">
                  <span className="text-slate-600">VAT ({vatModeLabel(uiLocale, order.storeVatMode)})</span>
                  <span className="text-slate-900 tabular-nums">
                    {order.vatAmount.toLocaleString(numberLocale)} {storeCurrencyDisplay}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-4">
                  <span className="text-slate-600">
                    {t(uiLocale, "orders.create.shippingFee.field.feeCharged.label")}
                  </span>
                  <span className="text-slate-900 tabular-nums">
                    {order.shippingFeeCharged.toLocaleString(numberLocale)} {storeCurrencyDisplay}
                  </span>
                </p>
                <div className="border-t border-slate-200 pt-1.5">
                  <p className="flex items-center justify-between gap-4 text-base font-semibold text-slate-900">
                    <span>{t(uiLocale, "orders.detail.summary.totalLabel")}</span>
                    <span className="tabular-nums">
                      {order.total.toLocaleString(numberLocale)} {storeCurrencyDisplay}
                    </span>
                  </p>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-500">
                <p>
                  {t(uiLocale, "orders.detail.summary.paymentCurrencyPrefix")}: {paymentCurrencyDisplay}
                </p>
                <p>
                  {t(uiLocale, "orders.detail.summary.paymentMethodPrefix")}:{" "}
                  {t(uiLocale, paymentMethodLabelKey[order.paymentMethod])}
                </p>
                <p>
                  {t(uiLocale, "orders.detail.summary.paymentStatusPrefix")}:{" "}
                  {t(uiLocale, paymentStatusLabelKey[order.paymentStatus])}
                </p>
              </div>
              {order.paymentAccountDisplayName ? (
                <p className="text-xs text-slate-500">
                  {t(uiLocale, "orders.detail.summary.paymentAccountPrefix")}:{" "}
                  {order.paymentAccountDisplayName} • {order.paymentAccountBankName ?? "-"} •{" "}
                  {maskAccountValue(order.paymentAccountNumber)}
                </p>
              ) : null}
              {order.paymentMethod === "COD" ? (
                <div className="mt-2 border-l-2 border-slate-300 pl-2 text-xs text-slate-600">
                  <p>
                    {t(uiLocale, "orders.detail.cod.collectedPrefix")}:{" "}
                    {codCollectedAmount.toLocaleString(numberLocale)} {storeCurrencyDisplay}
                  </p>
                  <p>
                    {t(uiLocale, "orders.detail.cod.shippingCostPrefix")}:{" "}
                    {order.shippingCost.toLocaleString(numberLocale)} {storeCurrencyDisplay}
                  </p>
                  <p>
                    {t(uiLocale, "orders.detail.cod.feePrefix")}:{" "}
                    {order.codFee.toLocaleString(numberLocale)} {storeCurrencyDisplay}
                  </p>
                  {order.codReturnNote ? (
                    <p>
                      {t(uiLocale, "orders.detail.cod.returnNotePrefix")}: {order.codReturnNote}
                    </p>
                  ) : null}
                  <p>
                    {t(uiLocale, "orders.detail.cod.marginPrefix")}:{" "}
                    {codShippingMargin.toLocaleString(numberLocale)} {storeCurrencyDisplay}
                  </p>
                  <p className={codNetOutcome >= 0 ? "text-emerald-700" : "text-rose-700"}>
                    {t(uiLocale, "orders.detail.cod.netOutcomePrefix")}:{" "}
                    {codNetOutcome.toLocaleString(numberLocale)} {storeCurrencyDisplay}
                  </p>
                </div>
              ) : null}
            </div>
          </article>

          {isLaoQrOrder ? (
            <article className="space-y-3 border-b border-slate-200 pb-4">
              <h2 className="text-sm font-semibold text-slate-900">
                {t(uiLocale, "orders.detail.paymentQr.title")}
              </h2>
              {order.paymentAccountQrImageUrl ? (
                <div className="space-y-2 overflow-hidden border border-slate-200 bg-slate-50 p-2">
                  <Image
                    src={order.paymentAccountQrImageUrl}
                    alt={t(uiLocale, "orders.qrViewer.defaultTitle")}
                    width={208}
                    height={208}
                    className="mx-auto h-52 w-52 rounded-lg object-contain"
                    unoptimized
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 w-full text-xs"
                      onClick={openOrderQrImageFull}
                    >
                      {t(uiLocale, "orders.qrViewer.openFullButton")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 w-full text-xs"
                      onClick={() => {
                        void downloadOrderQrImage();
                      }}
                    >
                      {t(uiLocale, "orders.qrViewer.downloadButton")}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {t(uiLocale, "orders.detail.paymentQr.noImageHint")}
                </p>
              )}

              <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                <p>
                  {t(uiLocale, "orders.detail.confirmPaid.qr.accountNamePrefix")}{" "}
                  <span className="font-medium text-slate-900">
                    {order.paymentAccountDisplayName || "-"}
                  </span>
                </p>
                <p>
                  {t(uiLocale, "orders.detail.confirmPaid.qr.bankPrefix")}{" "}
                  <span className="font-medium text-slate-900">
                    {order.paymentAccountBankName || "-"}
                  </span>
                </p>
                <p>
                  {t(uiLocale, "orders.detail.confirmPaid.qr.accountNumberPrefix")}{" "}
                  <span className="font-medium text-slate-900">
                    {order.paymentAccountNumber || "-"}
                  </span>
                </p>
              </div>

            </article>
          ) : null}

          {showShippingSection ? (
            <article className="space-y-3 border-b border-slate-200 pb-4">
              <h2 className="text-sm font-semibold text-slate-900">
                {isOnlineOrder
                  ? t(uiLocale, "orders.detail.shipping.title.online")
                  : t(uiLocale, "orders.detail.shipping.title.optional")}
              </h2>
              <div className="border-l-2 border-slate-300 pl-2 text-xs text-slate-600">
                <p>
                  {t(uiLocale, "orders.detail.shipping.providerPrefix")}: {order.shippingProvider || "-"}
                </p>
                <p>
                  {t(uiLocale, "orders.detail.shipping.labelStatusPrefix")}:{" "}
                  {t(uiLocale, shippingLabelStatusLabelKey[order.shippingLabelStatus])}
                </p>
                <p>
                  {t(uiLocale, "orders.detail.shipping.trackingPrefix")}: {order.trackingNo || "-"}
                </p>
                <p>
                  {t(uiLocale, "orders.detail.shipping.shippingCostPrefix")}:{" "}
                  {order.shippingCost.toLocaleString(numberLocale)} {storeCurrencyDisplay}
                </p>
                {shippingLabelUrl ? (
                  <a
                    href={shippingLabelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {t(uiLocale, "orders.detail.shipping.openLatestLabel")}
                  </a>
                ) : null}
              </div>

              {shippingLabelUrl ? (
                <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-2">
                  <Image
                    src={shippingLabelUrl}
                    alt={t(uiLocale, "orders.shippingLabel.preview.alt")}
                    width={960}
                    height={720}
                    className="h-auto max-h-80 w-full rounded object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {t(uiLocale, "orders.shippingLabel.emptyHint")}
                </p>
              )}

              <div className="grid grid-cols-1 gap-2">
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    onClick={openShippingLabelSourcePicker}
                    disabled={!canUpdate || loadingKey !== null}
                  >
                    {loadingKey === "upload-label-file" || loadingKey === "upload-label-camera"
                      ? t(uiLocale, "orders.shippingLabel.action.uploading")
                      : t(uiLocale, "orders.shippingLabel.action.addImage")}
                  </Button>
                  {shippingLabelUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                      onClick={() => setShowDeleteShippingLabelConfirm(true)}
                      disabled={!canUpdate || loadingKey !== null}
                    >
                      {loadingKey === "remove-shipping-label"
                        ? t(uiLocale, "orders.shippingLabel.deleteConfirm.deleting")
                        : t(uiLocale, "orders.shippingLabel.deleteConfirm.confirm")}
                    </Button>
                  ) : null}
                  <input
                    ref={shippingLabelFileInputRef}
                    type="file"
                    accept={RASTER_IMAGE_ACCEPT}
                    className="hidden"
                    disabled={!canUpdate || loadingKey !== null}
                    onChange={(event) => {
                      void handleShippingLabelFileChange(event, "file");
                    }}
                  />
                  <input
                    ref={shippingLabelCameraInputRef}
                    type="file"
                    accept={RASTER_IMAGE_ACCEPT}
                    capture="environment"
                    className="hidden"
                    disabled={!canUpdate || loadingKey !== null}
                    onChange={(event) => {
                      void handleShippingLabelFileChange(event, "camera");
                    }}
                  />
                </div>
                {shippingLabelUploadError ? (
                  <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {shippingLabelUploadError}
                  </p>
                ) : null}
                <p className="text-[11px] text-muted-foreground">
                  {t(uiLocale, "orders.shippingLabel.note.autoSave")}{" "}
                  {t(uiLocale, "orders.shippingLabel.note.supportedFiles")}
                </p>
              </div>
            </article>
          ) : null}

          {showLaoQrMessaging ? (
            <article className="space-y-3 border-b border-slate-200 pb-4">
              <h2 className="text-sm font-semibold text-slate-900">
                {t(uiLocale, "orders.detail.messaging.title")}
              </h2>

              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                {t(uiLocale, "orders.detail.messaging.hint")}
              </div>

              <textarea
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                className="min-h-24 w-full rounded-md border px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
              />

              <div
                className={`grid grid-cols-1 gap-2 ${
                  messagingActionCount >= 3 ? "sm:grid-cols-3" : messagingActionCount === 2 ? "sm:grid-cols-2" : ""
                }`}
              >
                <Button type="button" className="h-9" onClick={copyMessage}>
                  {t(uiLocale, "orders.detail.messaging.copy")}
                </Button>

                {showWhatsappMessagingAction ? (
                  <a
                    href={messaging.waDeepLink ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-9 items-center justify-center rounded-md border border-green-400 text-xs font-medium text-green-700"
                  >
                    {t(uiLocale, "orders.detail.messaging.openWhatsapp")}
                  </a>
                ) : null}

                {showFacebookMessagingAction ? (
                  <a
                    href={messaging.facebookInboxUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-9 items-center justify-center rounded-md border border-blue-400 text-xs font-medium text-blue-700"
                  >
                    {t(uiLocale, "orders.detail.messaging.openFacebook")}
                  </a>
                ) : null}
              </div>
            </article>
          ) : null}

          {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="space-y-3 border-y border-slate-200 py-3">
            <h2 className="text-sm font-semibold text-slate-900">
              {t(uiLocale, "orders.detail.actions.title")}
            </h2>
            {isWalkInPaidComplete ? (
              <>
                <div className="space-y-1 text-xs text-slate-600">
                  <p>
                    {t(uiLocale, "orders.detail.actions.statusPrefix")}:{" "}
                    {t(uiLocale, "orders.detail.actions.completed")}
                  </p>
                  <p>
                    {t(uiLocale, "orders.detail.actions.paymentPrefix")}:{" "}
                    {t(uiLocale, paymentStatusLabelKey[order.paymentStatus])}
                  </p>
                  <p>
                    {t(uiLocale, "orders.detail.actions.totalPrefix")}:{" "}
                    {order.total.toLocaleString(numberLocale)} {storeCurrencyDisplay}
                  </p>
                </div>
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
                  {t(uiLocale, "orders.detail.actions.walkInCompleteHint")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full text-xs"
                  onClick={() => printViaWindow("receipt")}
                  disabled={isAnyPrintLoading}
                >
                  {receiptPrintLoading
                    ? t(uiLocale, "orders.detail.actions.print.loading")
                    : t(uiLocale, "orders.detail.actions.print.receipt")}
                </Button>
                {canOrderCancel ? (
                  <Button
                    className="h-10 w-full bg-rose-600 text-white hover:bg-rose-700"
                    onClick={() => {
                      setShowCancelApprovalModal(true);
                      setErrorMessage(null);
                    }}
                    disabled={canMarkCodReturned || loadingKey !== null}
                  >
                    {loadingKey === "cancel"
                      ? t(uiLocale, "common.action.saving")
                      : t(uiLocale, "orders.action.cancelOrder")}
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <div className="space-y-1 text-xs text-slate-600">
                  <p>
                    {t(uiLocale, "orders.detail.actions.statusPrefix")}:{" "}
                    {t(uiLocale, statusLabelKey[order.status])}
                  </p>
                  <p>
                    {t(uiLocale, "orders.detail.actions.paymentPrefix")}:{" "}
                    {t(uiLocale, paymentStatusLabelKey[order.paymentStatus])}
                  </p>
                  <p>
                    {t(uiLocale, "orders.detail.actions.totalPrefix")}:{" "}
                    {order.total.toLocaleString(numberLocale)} {storeCurrencyDisplay}
                  </p>
                </div>

                {isCodPendingAfterShipped ? (
                  <div className="space-y-2 rounded-md border border-blue-100 bg-blue-50/70 p-2">
                    <p className="text-xs font-medium text-blue-900">
                      {t(uiLocale, "orders.detail.cod.settleTitle")}
                    </p>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={codSettlementAmount}
                      onChange={(event) => setCodSettlementAmount(event.target.value)}
                      className="h-9 w-full rounded-md border border-blue-200 bg-white px-2 text-sm outline-none ring-primary focus:ring-2"
                      disabled={confirmPaidDisabled}
                      placeholder={t(uiLocale, "orders.detail.cod.settlementAmount.placeholder")}
                    />
                    {canMarkCodReturned ? (
                      <>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={codReturnFeeInput}
                          onChange={(event) => setCodReturnFeeInput(event.target.value)}
                          className="h-9 w-full rounded-md border border-blue-200 bg-white px-2 text-sm outline-none ring-primary focus:ring-2"
                          disabled={codReturnDisabled}
                          placeholder={t(uiLocale, "orders.detail.cod.returnFee.placeholder")}
                        />
                        <textarea
                          value={codReturnNoteInput}
                          onChange={(event) => setCodReturnNoteInput(event.target.value)}
                          className="min-h-16 w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm outline-none ring-primary focus:ring-2"
                          disabled={codReturnDisabled}
                          placeholder={t(uiLocale, "orders.detail.cod.returnNote.placeholderOptional")}
                        />
                      </>
                    ) : null}
                  </div>
                ) : null}

                {primaryAction ? (
                  <Button className="h-10 w-full" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
                    {loadingKey === primaryAction.key ? t(uiLocale, "common.action.saving") : primaryAction.label}
                  </Button>
                ) : (
                  <p className="rounded-md border border-dashed border-slate-200 p-2 text-xs text-slate-500">
                    {actionRailEmptyMessage}
                  </p>
                )}
                {canMarkPickupBeforePaid ? (
                  <Button
                    className="h-10 w-full border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    variant="outline"
                    onClick={() => {
                      setShowConfirmPickupBeforePaidModal(true);
                      setErrorMessage(null);
                    }}
                    disabled={pickupBeforePaidDisabled}
                  >
                    {loadingKey === "mark-picked-up-unpaid"
                      ? t(uiLocale, "common.action.saving")
                      : t(uiLocale, "orders.detail.action.confirmPickupUnpaid")}
                  </Button>
                ) : null}
                {canOrderCancel ? (
                  <Button
                    className="h-10 w-full bg-rose-600 text-white hover:bg-rose-700"
                    onClick={() => {
                      setShowCancelApprovalModal(true);
                      setErrorMessage(null);
                    }}
                    disabled={canMarkCodReturned || loadingKey !== null}
                  >
                    {loadingKey === "cancel"
                      ? t(uiLocale, "common.action.saving")
                      : t(uiLocale, "orders.action.cancelOrder")}
                  </Button>
                ) : null}

                <div className={`grid gap-2 ${showShippingSection ? "grid-cols-2" : "grid-cols-1"}`}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-xs"
                    onClick={() => printViaWindow("receipt")}
                    disabled={isAnyPrintLoading}
                  >
                    {receiptPrintLoading
                      ? t(uiLocale, "orders.detail.actions.print.loading")
                      : t(uiLocale, "orders.detail.actions.print.receipt")}
                  </Button>
                  {showShippingSection ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 text-xs"
                      onClick={() => printViaWindow("label")}
                      disabled={isAnyPrintLoading}
                    >
                      {labelPrintLoading
                        ? t(uiLocale, "orders.detail.actions.print.loading")
                        : t(uiLocale, "orders.detail.actions.print.label")}
                    </Button>
                  ) : null}
                </div>
                {!isWalkInPaidComplete ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full text-xs"
                    onClick={() => setShowPackSheet(true)}
                    disabled={isAnyPrintLoading}
                  >
                    {t(uiLocale, "orders.detail.actions.packView")}
                  </Button>
                ) : null}

                {showExtraActionsHeader && extraActions.length > 0 ? (
                  <details className="rounded-md border border-slate-200 p-2">
                    <summary className="cursor-pointer text-xs font-medium text-slate-700">
                      {t(uiLocale, "orders.detail.actions.extraTitle")}
                    </summary>
                    <div className="mt-2 space-y-2">
                      {extraActions.map((action) => (
                        <Button
                          key={action.key}
                          className={
                            action.tone === "warning"
                              ? "h-9 w-full bg-orange-600 text-white hover:bg-orange-700"
                              : "h-9 w-full"
                          }
                          variant={action.tone === "warning" ? undefined : "outline"}
                          onClick={() => {
                            void action.onClick();
                          }}
                          disabled={action.disabled}
                        >
                          {loadingKey === action.key ? t(uiLocale, "common.action.saving") : action.label}
                        </Button>
                      ))}
                    </div>
                  </details>
                ) : null}
              </>
            )}
          </div>
        </aside>
      </div>
      <ManagerCancelApprovalModal
        isOpen={showCancelApprovalModal}
        orderNo={order.orderNo}
        mode={canSelfApproveCancel ? "SELF_SLIDE" : "MANAGER_PASSWORD"}
        isHighRisk={cancelIsHighRisk}
        busy={loadingKey === "cancel"}
        onClose={() => {
          if (loadingKey !== null) {
            return;
          }
          setShowCancelApprovalModal(false);
        }}
        onConfirm={submitCancelWithApproval}
      />
      {showConfirmPickupBeforePaidModal ? (
        <div className="fixed inset-0 z-[89]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/55"
            aria-label={t(uiLocale, "orders.detail.confirmPickupUnpaid.overlayCloseAria")}
            onClick={() => {
              if (loadingKey !== null) {
                return;
              }
              setShowConfirmPickupBeforePaidModal(false);
            }}
            disabled={loadingKey !== null}
          />
          <div className="relative flex min-h-full items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-pickup-before-paid-title"
              className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
            >
              <h3 id="confirm-pickup-before-paid-title" className="text-sm font-semibold text-slate-900">
                {t(uiLocale, "orders.detail.confirmPickupUnpaid.title")}
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                {t(uiLocale, "orders.detail.confirmPickupUnpaid.description")}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => setShowConfirmPickupBeforePaidModal(false)}
                  disabled={loadingKey !== null}
                >
                  {t(uiLocale, "common.action.cancel")}
                </Button>
                <Button
                  type="button"
                  className="h-9 bg-amber-600 text-white hover:bg-amber-700"
                  onClick={() => {
                    void runMarkPickupBeforePaidAction();
                  }}
                  disabled={pickupBeforePaidDisabled}
                >
                  {loadingKey === "mark-picked-up-unpaid"
                    ? t(uiLocale, "common.action.saving")
                    : t(uiLocale, "orders.detail.confirmPickupUnpaid.confirm")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showConfirmPaidConfirmModal ? (
        <div className="fixed inset-0 z-[89]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/55"
            aria-label={t(uiLocale, "orders.detail.confirmPaid.overlayCloseAria")}
            onClick={() => {
              if (loadingKey !== null) {
                return;
              }
              setShowConfirmPaidConfirmModal(false);
            }}
            disabled={loadingKey !== null}
          />
          <div className="relative flex min-h-full items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-receive-payment-title"
              className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
            >
              <h3 id="confirm-receive-payment-title" className="text-sm font-semibold text-slate-900">
                {confirmPaidConfirmTitle}
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                {t(uiLocale, confirmPaidConfirmDescriptionKey)}
              </p>
              {isInStoreCreditSettlement ? (
                <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-700">
                      {t(uiLocale, "orders.detail.confirmPaid.settlement.title")}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={`rounded-md border px-3 py-2 text-sm ${
                          confirmPaidPaymentMethod === "CASH"
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                        onClick={() => setConfirmPaidPaymentMethod("CASH")}
                        disabled={loadingKey !== null}
                      >
                        {t(uiLocale, "orders.detail.confirmPaid.settlement.cash")}
                      </button>
                      <button
                        type="button"
                        className={`rounded-md border px-3 py-2 text-sm ${
                          confirmPaidPaymentMethod === "LAO_QR"
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700"
                        } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400`}
                        onClick={() => setConfirmPaidPaymentMethod("LAO_QR")}
                        disabled={loadingKey !== null || qrPaymentAccounts.length === 0}
                      >
                        {t(uiLocale, "orders.detail.confirmPaid.settlement.qr")}
                      </button>
                    </div>
                  </div>
                  {confirmPaidPaymentMethod === "LAO_QR" ? (
                    qrPaymentAccounts.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-slate-700">
                          {t(uiLocale, "orders.detail.confirmPaid.settlement.selectAccountTitle")}
                        </p>
                        <div className="space-y-2">
                          {qrPaymentAccounts.map((account) => {
                            const isSelected = account.id === confirmPaidPaymentAccountId;
                            return (
                              <button
                                key={account.id}
                                type="button"
                                className={`w-full rounded-md border px-3 py-2 text-left ${
                                  isSelected
                                    ? "border-blue-300 bg-blue-50"
                                    : "border-slate-200 bg-white"
                                }`}
                                onClick={() => setConfirmPaidPaymentAccountId(account.id)}
                                disabled={loadingKey !== null}
                              >
                                <p className="text-sm font-medium text-slate-900">
                                  {account.displayName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {account.bankName || "-"} • {maskAccountValue(account.accountNumber)}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                        {selectedConfirmPaidQrAccount ? (
                          <div className="space-y-2">
                            <p className="text-[11px] text-slate-500">
                              {t(uiLocale, "orders.detail.confirmPaid.settlement.preview.prefix")}{" "}
                              {selectedConfirmPaidQrAccount.displayName} •{" "}
                              {maskAccountValue(selectedConfirmPaidQrAccount.accountNumber)}
                            </p>
                            <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
                              {selectedConfirmPaidQrAccount.qrImageUrl ? (
                                <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-2">
                                  <div className="absolute right-3 top-3 flex items-center gap-2">
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400"
                                      onClick={openConfirmPaidQrImageFull}
                                      disabled={loadingKey !== null}
                                      aria-label={t(uiLocale, "orders.qrViewer.openFullAria")}
                                      title={t(uiLocale, "orders.qrViewer.openFullAria")}
                                    >
                                      <Expand className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400"
                                      onClick={() => {
                                        void downloadConfirmPaidQrImage();
                                      }}
                                      disabled={loadingKey !== null}
                                      aria-label={t(uiLocale, "orders.qrViewer.downloadAria")}
                                      title={t(uiLocale, "orders.qrViewer.downloadAria")}
                                    >
                                      <ArrowDownToLine className="h-4 w-4" />
                                    </button>
                                  </div>
                                  <Image
                                    src={selectedConfirmPaidQrAccount.qrImageUrl}
                                    alt={`QR ${selectedConfirmPaidQrAccount.displayName}`}
                                    width={240}
                                    height={240}
                                    className="mx-auto h-44 w-44 rounded object-contain"
                                    unoptimized
                                  />
                                </div>
                              ) : (
                                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                  {t(uiLocale, "orders.detail.confirmPaid.qr.noImageHint")}
                                </p>
                              )}
                              <div className="space-y-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                                <p>
                                  {t(uiLocale, "orders.detail.confirmPaid.qr.accountNamePrefix")}{" "}
                                  <span className="font-medium text-slate-900">
                                    {selectedConfirmPaidQrAccount.accountName}
                                  </span>
                                </p>
                                <p>
                                  {t(uiLocale, "orders.detail.confirmPaid.qr.bankPrefix")}{" "}
                                  <span className="font-medium text-slate-900">
                                    {selectedConfirmPaidQrBankDisplay}
                                  </span>
                                </p>
                                <p>
                                  {t(uiLocale, "orders.detail.confirmPaid.qr.accountNumberPrefix")}{" "}
                                  <span className="font-medium text-slate-900">
                                    {selectedConfirmPaidQrAccount.accountNumber || "-"}
                                  </span>
                                </p>
                              </div>
                              {selectedConfirmPaidQrAccount.accountNumber ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 w-full text-xs"
                                  onClick={() => {
                                    void copyConfirmPaidQrAccountNumber();
                                  }}
                                  disabled={loadingKey !== null}
                                >
                                  {t(uiLocale, "orders.detail.confirmPaid.qr.copyAccountNumber")}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        {t(uiLocale, "orders.detail.confirmPaid.qr.noAccountsHint")}
                      </p>
                    )
                  ) : null}
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => setShowConfirmPaidConfirmModal(false)}
                  disabled={loadingKey !== null}
                >
                  {t(uiLocale, "common.action.cancel")}
                </Button>
                <Button
                  type="button"
                  className="h-9"
                  onClick={() => {
                    void runConfirmPaidAction();
                  }}
                  disabled={confirmPaidDisabled}
                >
                  {loadingKey === "confirm-paid"
                    ? t(uiLocale, "common.action.saving")
                    : confirmPaidButtonLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showConfirmPaidQrImageViewer && selectedConfirmPaidQrAccount?.qrImageUrl ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/85 px-3 py-6 sm:px-6"
          onClick={() => setShowConfirmPaidQrImageViewer(false)}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-2.5 text-slate-100">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{selectedConfirmPaidQrAccount.displayName}</p>
                <p className="truncate text-xs text-slate-400">{t(uiLocale, "orders.qrViewer.sameTabHint")}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500"
                  onClick={openConfirmPaidQrImageInNewTab}
                  aria-label={t(uiLocale, "orders.qrViewer.openNewTabAria")}
                  title={t(uiLocale, "orders.qrViewer.openNewTabAria")}
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500"
                  onClick={() => {
                    void downloadConfirmPaidQrImage();
                  }}
                  aria-label={t(uiLocale, "orders.qrViewer.downloadAria")}
                  title={t(uiLocale, "orders.qrViewer.downloadAria")}
                >
                  <ArrowDownToLine className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500"
                  onClick={() => setShowConfirmPaidQrImageViewer(false)}
                  aria-label={t(uiLocale, "orders.qrViewer.closeAria")}
                  title={t(uiLocale, "orders.qrViewer.closeAria")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex max-h-[calc(100dvh-9rem)] items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(148,163,184,0.14),_transparent_60%)] p-4 sm:p-6">
              <Image
                src={selectedConfirmPaidQrAccount.qrImageUrl}
                alt={`QR ${selectedConfirmPaidQrAccount.displayName}`}
                width={1200}
                height={1200}
                className="h-auto max-h-[calc(100dvh-13rem)] w-auto max-w-full rounded-lg object-contain"
                unoptimized
              />
            </div>
          </div>
        </div>
      ) : null}
      {showOrderQrImageViewer && order.paymentAccountQrImageUrl ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/85 px-3 py-6 sm:px-6"
          onClick={() => setShowOrderQrImageViewer(false)}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-2.5 text-slate-100">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {order.paymentAccountDisplayName || t(uiLocale, "orders.qrViewer.defaultTitle")}
                </p>
                <p className="truncate text-xs text-slate-400">{t(uiLocale, "orders.qrViewer.sameTabHint")}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500"
                  onClick={openOrderQrImageInNewTab}
                  aria-label={t(uiLocale, "orders.qrViewer.openNewTabAria")}
                  title={t(uiLocale, "orders.qrViewer.openNewTabAria")}
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500"
                  onClick={() => {
                    void downloadOrderQrImage();
                  }}
                  aria-label={t(uiLocale, "orders.qrViewer.downloadAria")}
                  title={t(uiLocale, "orders.qrViewer.downloadAria")}
                >
                  <ArrowDownToLine className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500"
                  onClick={() => setShowOrderQrImageViewer(false)}
                  aria-label={t(uiLocale, "orders.qrViewer.closeAria")}
                  title={t(uiLocale, "orders.qrViewer.closeAria")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex max-h-[calc(100dvh-9rem)] items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(148,163,184,0.14),_transparent_60%)] p-4 sm:p-6">
              <Image
                src={order.paymentAccountQrImageUrl}
                alt={`QR ${order.paymentAccountDisplayName || "payment"}`}
                width={1200}
                height={1200}
                className="h-auto max-h-[calc(100dvh-13rem)] w-auto max-w-full rounded-lg object-contain"
                unoptimized
              />
            </div>
          </div>
        </div>
      ) : null}
      <SlideUpSheet
        isOpen={showPackSheet}
        onClose={() => {
          if (isAnyPrintLoading) {
            return;
          }
          setShowPackSheet(false);
        }}
        title={t(uiLocale, "orders.pack.page.title")}
        description={t(uiLocale, "orders.pack.page.subtitle")}
        panelMaxWidthClass="min-[1200px]:max-w-5xl"
        disabled={isAnyPrintLoading}
        scrollToTopOnOpen
        footer={
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-xl"
              onClick={() => setShowPackSheet(false)}
              disabled={isAnyPrintLoading}
            >
              {t(uiLocale, "common.action.close")}
            </Button>
            <Button
              type="button"
              className="h-10 w-full rounded-xl"
              onClick={handlePrintPackFromSheet}
              disabled={isAnyPrintLoading}
            >
              {packPrintLoading
                ? t(uiLocale, "orders.detail.actions.print.loading")
                : t(uiLocale, "orders.detail.actions.print.pack")}
            </Button>
          </div>
        }
      >
        <div className="pb-1">
          <OrderPackContent
            order={order}
            uiLocale={uiLocale}
            numberLocale={numberLocale}
            storeCurrencyDisplay={storeCurrencyDisplay}
            className="px-1"
          />
        </div>
      </SlideUpSheet>
      <SlideUpSheet
        isOpen={showShippingLabelSourcePicker}
        onClose={closeShippingLabelSourcePicker}
        title={t(uiLocale, "orders.shippingLabel.picker.title")}
        description={t(uiLocale, "orders.shippingLabel.picker.description")}
        panelMaxWidthClass="min-[1200px]:max-w-sm"
        disabled={loadingKey !== null}
        footer={
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl"
            onClick={closeShippingLabelSourcePicker}
            disabled={loadingKey !== null}
          >
            {t(uiLocale, "common.action.close")}
          </Button>
        }
      >
        <div className="space-y-2 pb-1">
          <Button
            type="button"
            className="h-10 w-full rounded-xl"
            onClick={() => pickShippingLabelFromDevice("file")}
            disabled={loadingKey !== null}
          >
            {t(uiLocale, "orders.shippingLabel.picker.chooseFile")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl"
            onClick={() => pickShippingLabelFromDevice("camera")}
            disabled={loadingKey !== null || !canOpenShippingLabelCamera}
          >
            {t(uiLocale, "orders.shippingLabel.picker.takePhoto")}
          </Button>
          {!canOpenShippingLabelCamera ? (
            <p className="text-[11px] text-slate-500">
              {t(uiLocale, "orders.shippingLabel.picker.cameraUnsupported")}
            </p>
          ) : null}
        </div>
      </SlideUpSheet>
      {showDeleteShippingLabelConfirm ? (
        <div className="fixed inset-0 z-[96]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/55"
            aria-label={t(uiLocale, "orders.shippingLabel.deleteConfirm.overlayCloseAria")}
            onClick={() => {
              if (loadingKey !== null) {
                return;
              }
              setShowDeleteShippingLabelConfirm(false);
            }}
            disabled={loadingKey !== null}
          />
          <div className="relative flex min-h-full items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-shipping-label-title"
              className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
            >
              <h3 id="delete-shipping-label-title" className="text-sm font-semibold text-slate-900">
                {t(uiLocale, "orders.shippingLabel.deleteConfirm.title")}
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                {t(uiLocale, "orders.shippingLabel.deleteConfirm.description")}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => setShowDeleteShippingLabelConfirm(false)}
                  disabled={loadingKey !== null}
                >
                  {t(uiLocale, "common.action.cancel")}
                </Button>
                <Button
                  type="button"
                  className="h-9 bg-rose-600 text-white hover:bg-rose-700"
                  onClick={() => {
                    void removeShippingLabelImage();
                  }}
                  disabled={loadingKey !== null}
                >
                  {loadingKey === "remove-shipping-label"
                    ? t(uiLocale, "orders.shippingLabel.deleteConfirm.deleting")
                    : t(uiLocale, "orders.shippingLabel.deleteConfirm.confirm")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
