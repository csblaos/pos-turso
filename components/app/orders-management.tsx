"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDownToLine,
  CheckCheck,
  Clock3,
  Expand,
  ExternalLink,
  Loader2,
  QrCode,
  ScanBarcode,
  Search,
  ShoppingCart,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";

import { BarcodeScannerPanel } from "@/components/app/barcode-scanner-panel";
import {
  ManagerCancelApprovalModal,
  type ManagerCancelApprovalPayload,
  type ManagerCancelApprovalResult,
} from "@/components/app/manager-cancel-approval-modal";
import { OrderPackContent } from "@/components/app/order-pack-content";
import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { authFetch } from "@/lib/auth/client-token";
import {
  currencyLabel,
  currencySymbol,
  parseStoreCurrency,
  vatModeLabel,
} from "@/lib/finance/store-financial";
import { uiLocaleToDateLocale, type UiLocale } from "@/lib/i18n/locales";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { useUiLocale } from "@/lib/i18n/use-ui-locale";
import { resolveLaosBankDisplayName } from "@/lib/payments/laos-banks";
import {
  NEW_ORDER_DRAFT_DEFAULT_MAX_AGE_MS,
  clearNewOrderDraftPayload,
  clearNewOrderDraftState,
  getNewOrderDraftPayload,
  setNewOrderDraftFlag,
  setNewOrderDraftPayload,
  type NewOrderDraftPayload,
} from "@/lib/orders/new-order-draft";
import { fetchImageAsDataUrl, waitForImagesBeforePrint } from "@/lib/print/client";
import { buildOrderQrSvgMarkup, parseOrderSearchValue } from "@/lib/orders/print";
import { buildShippingLabelPrintMarkup } from "@/lib/orders/shipping-label-print";
import type {
  OrderCatalog,
  OrderDetail,
  OrderListItem,
  OrderListTab,
  PaginatedOrderList,
} from "@/lib/orders/queries";
import { computeOrderTotals } from "@/lib/orders/totals";
import {
  createOrderSchema,
  type CreateOrderFormInput,
  type CreateOrderInput,
} from "@/lib/orders/validation";

type OrdersManagementProps =
  | {
      mode?: "manage";
      ordersPage: PaginatedOrderList;
      activeTab: OrderListTab;
      searchQuery: string;
      catalog: OrderCatalog;
      canCreate: boolean;
      canUpdate?: boolean;
      canMarkPaid?: boolean;
      canPack?: boolean;
      canShip?: boolean;
      canCodReturn?: boolean;
      canRequestCancel?: boolean;
      canSelfApproveCancel?: boolean;
    }
  | {
      mode: "create-only";
      catalog: OrderCatalog;
      canCreate: boolean;
      canUpdate?: boolean;
      canMarkPaid?: boolean;
      canPack?: boolean;
      canShip?: boolean;
      canCodReturn?: boolean;
      canRequestCancel?: boolean;
      canSelfApproveCancel?: boolean;
    };

type TabKey = OrderListTab;

const tabOptions: Array<{ key: TabKey; labelKey: MessageKey }> = [
  { key: "ALL", labelKey: "orders.tab.ALL" },
  { key: "PAYMENT_REVIEW", labelKey: "orders.tab.PAYMENT_REVIEW" },
  { key: "TO_PACK", labelKey: "orders.tab.TO_PACK" },
  { key: "TO_SHIP", labelKey: "orders.tab.TO_SHIP" },
  { key: "PICKUP_READY", labelKey: "orders.tab.PICKUP_READY" },
  { key: "COD_RECONCILE", labelKey: "orders.tab.COD_RECONCILE" },
];

const channelSummaryLabelKey = (
  order: Pick<OrderListItem, "channel" | "status">,
): MessageKey => {
  if (order.channel === "FACEBOOK") {
    return "orders.channelSummary.facebook";
  }
  if (order.channel === "WHATSAPP") {
    return "orders.channelSummary.whatsapp";
  }
  if (order.status === "READY_FOR_PICKUP" || order.status === "PICKED_UP_PENDING_PAYMENT") {
    return "orders.channelSummary.pickup";
  }
  return "orders.channelSummary.walkIn";
};

const paymentMethodLabelKey: Record<OrderListItem["paymentMethod"], MessageKey> = {
  CASH: "orders.paymentMethod.CASH",
  LAO_QR: "orders.paymentMethod.LAO_QR",
  ON_CREDIT: "orders.paymentMethod.ON_CREDIT",
  COD: "orders.paymentMethod.COD",
  BANK_TRANSFER: "orders.paymentMethod.BANK_TRANSFER",
};

const statusLabelKey: Record<OrderListItem["status"], MessageKey> = {
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

const statusClass: Record<OrderListItem["status"], string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_PAYMENT: "bg-amber-100 text-amber-700",
  READY_FOR_PICKUP: "bg-cyan-100 text-cyan-700",
  PICKED_UP_PENDING_PAYMENT: "bg-orange-100 text-orange-700",
  PAID: "bg-emerald-100 text-emerald-700",
  PACKED: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-indigo-100 text-indigo-700",
  COD_RETURNED: "bg-orange-100 text-orange-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

type OrderStatusBadge = {
  label: string;
  className: string;
};

type OrderListQuickAction =
  | {
      type: "patch";
      key: "confirm-paid" | "mark-packed" | "mark-shipped" | "submit";
      labelKey: MessageKey;
      requestAction: "confirm_paid" | "mark_packed" | "mark_shipped" | "submit_for_payment";
      successKey: MessageKey;
      requiresConfirm: boolean;
      confirmTitleKey?: MessageKey;
      confirmDescriptionKey?: MessageKey;
    }
  | {
      type: "detail";
      key: "detail";
      labelKey: MessageKey;
      reasonKey?: MessageKey;
    }
  | {
      type: "review";
      key: "review-confirm-paid" | "review-cod-reconcile" | "review-cod-return";
      labelKey: MessageKey;
      reviewKind: "confirm-paid" | "cod-reconcile" | "cod-return";
      reasonKey?: MessageKey;
    };

type OrderListQuickActionPermissions = {
  canUpdate: boolean;
  canMarkPaid: boolean;
  canPack: boolean;
  canShip: boolean;
  canCodReturn: boolean;
};

type OrderListPatchQuickAction = Extract<OrderListQuickAction, { type: "patch" }>;
type OrderBulkActionKey = OrderListPatchQuickAction["key"];
type OrderListReviewAction = Extract<OrderListQuickAction, { type: "review" }>;

type OrderBulkActionGroup = {
  key: OrderBulkActionKey;
  buttonLabelKey: MessageKey;
  requestAction: OrderListPatchQuickAction["requestAction"];
  orders: Array<Pick<OrderListItem, "id" | "orderNo">>;
};

type BulkPrintKind = "receipt" | "label" | "pack";
type ProductUnitPickerSource = "quick-add" | "manual-search" | "scanner";
type ProductUnitPickerState = {
  productId: string;
  source: ProductUnitPickerSource;
};

const bulkActionButtonLabelKey: Record<OrderBulkActionKey, MessageKey> = {
  "confirm-paid": "orders.management.bulk.action.confirmPaid",
  "mark-packed": "orders.management.bulk.action.markPacked",
  "mark-shipped": "orders.management.bulk.action.markShipped",
  submit: "orders.management.bulk.action.submitForPayment",
};

const bulkActionOrder: OrderBulkActionKey[] = [
  "confirm-paid",
  "mark-packed",
  "mark-shipped",
  "submit",
];

const buildOrderStatusBadges = (
  uiLocale: UiLocale,
  order: Pick<OrderListItem, "channel" | "status" | "paymentMethod" | "paymentStatus">,
) => {
  const badges: OrderStatusBadge[] = [];
  const isOnlineOrder = order.channel !== "WALK_IN";

  if (isOnlineOrder && order.status === "PENDING_PAYMENT") {
    badges.push({
      label: t(uiLocale, "orders.badge.processing"),
      className: "bg-amber-100 text-amber-700",
    });
  } else {
    badges.push({
      label: t(uiLocale, statusLabelKey[order.status]),
      className: statusClass[order.status],
    });
  }

  if (order.status === "READY_FOR_PICKUP") {
    const pickupBadge = pickupPaymentBadge(uiLocale, order);
    if (pickupBadge) {
      badges.push(pickupBadge);
    }
    return badges;
  }

  if (!isOnlineOrder) {
    return badges;
  }

  if (order.paymentMethod === "COD") {
    if (order.paymentStatus === "COD_SETTLED") {
      badges.push({
        label: t(uiLocale, "orders.paymentStatus.PAID"),
        className: "bg-emerald-100 text-emerald-700",
      });
    } else if (order.paymentStatus === "FAILED") {
      badges.push({
        label: t(uiLocale, "orders.paymentStatus.FAILED"),
        className: "bg-rose-100 text-rose-700",
      });
    } else if (order.paymentStatus === "COD_PENDING_SETTLEMENT") {
      badges.push({
        label:
          order.status === "SHIPPED"
            ? t(uiLocale, "orders.paymentStatus.COD_PENDING_SETTLEMENT")
            : t(uiLocale, "orders.paymentMethod.COD"),
        className: "bg-indigo-100 text-indigo-700",
      });
    }
    return badges;
  }

  if (order.paymentStatus === "PAID") {
    badges.push({
      label: t(uiLocale, "orders.paymentStatus.PAID"),
      className: "bg-emerald-100 text-emerald-700",
    });
    return badges;
  }

  if (order.paymentStatus === "PENDING_PROOF") {
    badges.push({
      label: t(uiLocale, "orders.paymentStatus.PENDING_PROOF"),
      className: "bg-violet-100 text-violet-700",
    });
    return badges;
  }

  if (order.paymentStatus === "FAILED") {
    badges.push({
      label: t(uiLocale, "orders.paymentStatus.FAILED"),
      className: "bg-rose-100 text-rose-700",
    });
    return badges;
  }

  badges.push({
    label:
      order.paymentMethod === "ON_CREDIT"
        ? t(uiLocale, "orders.paymentMethod.ON_CREDIT")
        : t(uiLocale, "orders.paymentStatus.UNPAID"),
    className: "bg-amber-100 text-amber-700",
  });

  return badges;
};

const pickupPaymentBadge = (
  uiLocale: UiLocale,
  order: Pick<OrderListItem, "status" | "paymentStatus">,
): { label: string; className: string } | null => {
  if (order.status !== "READY_FOR_PICKUP") {
    return null;
  }

  if (order.paymentStatus === "PAID" || order.paymentStatus === "COD_SETTLED") {
    return {
      label: t(uiLocale, "orders.paymentStatus.PAID"),
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  if (order.paymentStatus === "PENDING_PROOF") {
    return {
      label: t(uiLocale, "orders.paymentStatus.PENDING_PROOF"),
      className: "bg-violet-100 text-violet-700",
    };
  }

  return {
    label: t(uiLocale, "orders.status.PENDING_PAYMENT"),
    className: "bg-amber-100 text-amber-700",
  };
};

const getOrderCustomerDisplay = (
  uiLocale: UiLocale,
  order: Pick<OrderListItem, "customerName" | "contactDisplayName">,
) => order.customerName || order.contactDisplayName || t(uiLocale, "orders.customer.guest");

const createCodReconcileIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `cod-reconcile-${crypto.randomUUID()}`;
  }
  return `cod-reconcile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getOrderListQuickAction = (
  order: Pick<OrderListItem, "channel" | "paymentMethod" | "paymentStatus" | "status">,
  permissions: OrderListQuickActionPermissions,
): OrderListQuickAction | null => {
  const isWalkInOrder = order.channel === "WALK_IN";
  const isOnlineOrder = !isWalkInOrder;
  const isCodPendingAfterShipped =
    order.paymentMethod === "COD" &&
    order.status === "SHIPPED" &&
    order.paymentStatus === "COD_PENDING_SETTLEMENT";
  const isPickupReadyPrepaid =
    order.paymentMethod !== "COD" &&
    order.status === "READY_FOR_PICKUP" &&
    order.paymentStatus === "PAID";
  const isWalkInPaidComplete =
    isWalkInOrder &&
    order.status === "PAID" &&
    order.paymentStatus === "PAID";
  const isInStoreCreditSettlement =
    isWalkInOrder &&
    order.paymentMethod === "ON_CREDIT" &&
    ((order.status === "PENDING_PAYMENT" && order.paymentStatus !== "PAID") ||
      (order.status === "READY_FOR_PICKUP" && order.paymentStatus !== "PAID") ||
      (order.status === "PICKED_UP_PENDING_PAYMENT" && order.paymentStatus !== "PAID"));
  const isSlipPendingProof =
    isOnlineOrder && order.paymentMethod === "LAO_QR" && order.paymentStatus === "PENDING_PROOF";
  const canConfirmPaid =
    permissions.canMarkPaid &&
    (isCodPendingAfterShipped ||
      (order.paymentMethod !== "COD" &&
        (order.status === "PENDING_PAYMENT" ||
          order.status === "READY_FOR_PICKUP" ||
          order.status === "PICKED_UP_PENDING_PAYMENT")));
  const canMarkPacked =
    !isWalkInPaidComplete &&
    permissions.canPack &&
    (order.status === "PAID" ||
      (order.paymentMethod === "COD" &&
        order.status === "PENDING_PAYMENT" &&
        order.paymentStatus === "COD_PENDING_SETTLEMENT"));
  const canMarkShipped = !isWalkInPaidComplete && permissions.canShip && order.status === "PACKED";

  if (canConfirmPaid) {
    const labelKey: MessageKey = isCodPendingAfterShipped
      ? "orders.detail.action.confirmCodReceived"
      : isPickupReadyPrepaid
        ? "orders.detail.action.confirmPickupReceived"
        : isSlipPendingProof
          ? "orders.detail.action.reviewSlipAndConfirm"
          : isOnlineOrder
            ? "orders.detail.action.confirmPaid"
            : "orders.detail.action.confirmPaymentReceived";

    if (isCodPendingAfterShipped || isInStoreCreditSettlement) {
      return {
        type: "review",
        key: isCodPendingAfterShipped ? "review-cod-reconcile" : "review-confirm-paid",
        labelKey,
        reviewKind: isCodPendingAfterShipped ? "cod-reconcile" : "confirm-paid",
        reasonKey: "orders.management.quickAction.requiresReview",
      };
    }

    const successKey: MessageKey = isPickupReadyPrepaid
      ? "orders.detail.toast.pickupConfirmed"
      : isOnlineOrder
        ? "orders.detail.toast.markedPaid"
        : "orders.detail.toast.paymentConfirmed";
    const confirmTitleKey: MessageKey = isPickupReadyPrepaid
      ? "orders.detail.confirmPaid.title.pickup"
      : isSlipPendingProof
        ? "orders.detail.confirmPaid.title.slip"
        : "orders.detail.confirmPaid.title.default";
    const confirmDescriptionKey: MessageKey = isPickupReadyPrepaid
      ? "orders.detail.confirmPaid.description.pickup"
      : isSlipPendingProof
        ? "orders.detail.confirmPaid.description.slip"
        : "orders.detail.confirmPaid.description.default";

    return {
      type: "patch",
      key: "confirm-paid",
      labelKey,
      requestAction: "confirm_paid",
      successKey,
      requiresConfirm: true,
      confirmTitleKey,
      confirmDescriptionKey,
    };
  }

  if (canMarkPacked) {
    return {
      type: "patch",
      key: "mark-packed",
      labelKey: isOnlineOrder
        ? "orders.detail.action.markPacked.online"
        : "orders.detail.action.markPacked.offline",
      requestAction: "mark_packed",
      successKey: isOnlineOrder
        ? "orders.detail.toast.markPacked.online"
        : "orders.detail.toast.markPacked.offline",
      requiresConfirm: false,
    };
  }

  if (canMarkShipped) {
    return {
      type: "patch",
      key: "mark-shipped",
      labelKey: isOnlineOrder
        ? "orders.detail.action.markShipped.online"
        : "orders.detail.action.markShipped.offline",
      requestAction: "mark_shipped",
      successKey: isOnlineOrder
        ? "orders.detail.toast.markShipped.online"
        : "orders.detail.toast.markShipped.offline",
      requiresConfirm: false,
    };
  }

  if (order.status === "DRAFT" && permissions.canUpdate) {
    return {
      type: "patch",
      key: "submit",
      labelKey: "orders.detail.action.submitForPayment",
      requestAction: "submit_for_payment",
      successKey: "orders.detail.toast.submittedForPayment",
      requiresConfirm: false,
    };
  }

  return null;
};

const getOrderListSecondaryQuickAction = (
  order: Pick<OrderListItem, "paymentMethod" | "paymentStatus" | "status">,
  permissions: OrderListQuickActionPermissions,
): OrderListReviewAction | null => {
  const canMarkCodReturned =
    permissions.canCodReturn &&
    order.paymentMethod === "COD" &&
    order.status === "SHIPPED" &&
    order.paymentStatus === "COD_PENDING_SETTLEMENT";

  if (!canMarkCodReturned) {
    return null;
  }

  return {
    type: "review",
    key: "review-cod-return",
    labelKey: "orders.detail.action.markCodReturned",
    reviewKind: "cod-return",
    reasonKey: "orders.management.quickAction.codReturnHint",
  };
};

const canOpenOrderPackView = (
  order: Pick<OrderListItem, "channel" | "status">,
) =>
  order.status !== "DRAFT" &&
  order.status !== "CANCELLED" &&
  order.status !== "SHIPPED" &&
  order.status !== "COD_RETURNED" &&
  (order.channel !== "WALK_IN" ||
    order.status === "READY_FOR_PICKUP" ||
    order.status === "PICKED_UP_PENDING_PAYMENT");

type CreateOrderStep = "products" | "details";
type DiscountInputMode = "AMOUNT" | "PERCENT";
type CheckoutPaymentMethod = "CASH" | "LAO_QR" | "ON_CREDIT" | "COD";
type OnlineChannelMode = "FACEBOOK" | "WHATSAPP" | "OTHER";
type QuickAddCategory = {
  id: string;
  name: string;
  count: number;
};
type CheckoutFlow = "WALK_IN_NOW" | "PICKUP_LATER" | "ONLINE_DELIVERY";
type CreatedOrderSuccessState = {
  orderId: string;
  orderNo: string;
  checkoutFlow: CheckoutFlow;
};
type ReceiptPreviewOrder = OrderDetail;
type OrderDetailApiResponse = {
  ok: boolean;
  order?: OrderDetail;
  message?: string;
};
type OrderPackSheetState = {
  orderId: string;
  orderNo: string;
};
type RecentOrderItem = {
  id: string;
  orderNo: string;
  checkoutFlow: CheckoutFlow;
  status: OrderListItem["status"];
  createdAt: string;
  total: number;
  paymentCurrency: "LAK" | "THB" | "USD";
  paymentMethod: OrderListItem["paymentMethod"];
};
type RecentOrdersApiResponse = {
  message?: string;
  orders?: OrderListItem[];
};
type OrderReviewSheetState =
  | {
      kind: "confirm-paid";
      orderId: string;
      orderNo: string;
      customerLabel: string;
      total: number;
      paymentCurrency: OrderListItem["paymentCurrency"];
      actionLabelKey: MessageKey;
      paymentMethod: "CASH" | "LAO_QR";
      paymentAccountId: string;
    }
  | {
      kind: "cod-reconcile";
      orderId: string;
      orderNo: string;
      customerLabel: string;
      total: number;
      shippingCost: number;
      codFeeAccumulated: number;
      paymentCurrency: OrderListItem["paymentCurrency"];
      actionLabelKey: MessageKey;
      codAmount: string;
      codFee: string;
    }
  | {
      kind: "cod-return";
      orderId: string;
      orderNo: string;
      customerLabel: string;
      total: number;
      shippingCost: number;
      codFeeAccumulated: number;
      paymentCurrency: OrderListItem["paymentCurrency"];
      actionLabelKey: MessageKey;
      codFee: string;
      codReturnNote: string;
    };

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");

const checkoutFlowLabelKey: Record<CheckoutFlow, MessageKey> = {
  WALK_IN_NOW: "orders.flow.WALK_IN_NOW",
  PICKUP_LATER: "orders.flow.PICKUP_LATER",
  ONLINE_DELIVERY: "orders.flow.ONLINE_DELIVERY",
};
const SCANNER_PERMISSION_STORAGE_KEY = "scanner-permission-seen";
const CREATE_ONLY_SEARCH_STICKY_TOP_REM = 3.8;
const CREATE_ONLY_CART_STICKY_GAP_FALLBACK_PX = 13;
const CREATE_ONLY_CART_STICKY_EXTRA_TOP_PX = 13;
// Intentional: keep tablet threshold aligned with desktop so both use the same sticky behavior.
const TABLET_MIN_WIDTH_PX = 1200;
const DESKTOP_MIN_WIDTH_PX = 1200;
const CREATE_ONLY_RECENT_ORDERS_LIMIT = 8;
const EMPTY_ORDER_ITEMS: CreateOrderFormInput["items"] = [];
const CREATE_ORDER_CHECKOUT_SHEET_FORM_ID = "create-order-checkout-sheet-form";
const CANCELLABLE_ORDER_STATUSES = new Set<OrderListItem["status"]>([
  "DRAFT",
  "PENDING_PAYMENT",
  "READY_FOR_PICKUP",
  "PICKED_UP_PENDING_PAYMENT",
  "PAID",
  "PACKED",
  "SHIPPED",
]);

const inferCheckoutFlowFromOrderListItem = (order: Pick<OrderListItem, "channel" | "status">): CheckoutFlow => {
  if (order.channel !== "WALK_IN") {
    return "ONLINE_DELIVERY";
  }
  if (order.status === "READY_FOR_PICKUP" || order.status === "PICKED_UP_PENDING_PAYMENT") {
    return "PICKUP_LATER";
  }
  return "WALK_IN_NOW";
};

const parseOnlineQuickCustomerInput = (rawInput: string) => {
  const normalizedRaw = rawInput.replaceAll("\r\n", "\n").trim();
  if (!normalizedRaw) {
    return {
      customerName: "",
      customerPhone: "",
      customerAddress: "",
    };
  }

  const phoneMatch = normalizedRaw.match(/\+?\d[\d\s-]{5,}\d/);
  const rawPhone = phoneMatch?.[0] ?? "";
  const customerPhone = rawPhone.replace(/\D/g, "");
  const withoutPhone = rawPhone ? normalizedRaw.replace(rawPhone, " ") : normalizedRaw;
  const lines = withoutPhone
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let customerName = lines[0] ?? "";
  let customerAddress = lines.slice(1).join(" ").trim();

  if (lines.length === 1 && !customerAddress) {
    const tokens = lines[0].split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      customerName = tokens[0] ?? "";
      customerAddress = tokens.slice(1).join(" ").trim();
    }
  }

  return {
    customerName,
    customerPhone,
    customerAddress,
  };
};

const defaultValues = (catalog: OrderCatalog): CreateOrderFormInput => ({
  channel: "WALK_IN",
  checkoutFlow: "WALK_IN_NOW",
  contactId: "",
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  shippingProvider: "",
  shippingCarrier: "",
  discount: 0,
  shippingFeeCharged: 0,
  shippingCost: 0,
  paymentCurrency: parseStoreCurrency(catalog.storeCurrency),
  paymentMethod: "CASH",
  paymentAccountId: "",
  items: [],
});

export function OrdersManagement(props: OrdersManagementProps) {
  const { catalog, canCreate } = props;
  const canUpdate = props.canUpdate ?? false;
  const canMarkPaid = props.canMarkPaid ?? false;
  const canPack = props.canPack ?? false;
  const canShip = props.canShip ?? false;
  const canCodReturn = props.canCodReturn ?? false;
  const canRequestCancel = props.canRequestCancel ?? false;
  const canSelfApproveCancel = props.canSelfApproveCancel ?? false;
  const isCreateOnlyMode = props.mode === "create-only";
  const activeTab: OrderListTab = isCreateOnlyMode ? "ALL" : props.activeTab;
  const activeSearchQuery = isCreateOnlyMode ? "" : props.searchQuery;
  const ordersPage = isCreateOnlyMode ? null : props.ordersPage;
  const uiLocale = useUiLocale();
  const numberLocale = uiLocaleToDateLocale(uiLocale);
  const printFontFamily = useMemo(() => {
    if (uiLocale === "lo") {
      return '"NotoSansLaoLooped", "GoogleSans", Sarabun, "Noto Sans Lao", "Segoe UI", sans-serif';
    }
    if (uiLocale === "th") {
      return 'Sarabun, "GoogleSans", "Noto Sans Thai", "Segoe UI", sans-serif';
    }
    return 'ui-sans-serif, -apple-system, "Segoe UI", sans-serif';
  }, [uiLocale]);
  const router = useRouter();
  const rawSearchParams = useSearchParams();
  const searchParams = useMemo(
    () => rawSearchParams ?? new URLSearchParams(),
    [rawSearchParams],
  );
  const [isTabPending, startTabTransition] = useTransition();
  const [showScannerPermissionSheet, setShowScannerPermissionSheet] = useState(false);
  const [showScannerSheet, setShowScannerSheet] = useState(false);
  const [hasSeenScannerPermission, setHasSeenScannerPermission] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingTab, setPendingTab] = useState<OrderListTab | null>(null);
  const [isManageSearchPending, setIsManageSearchPending] = useState(false);
  const [isDesktopBulkSelectMode, setIsDesktopBulkSelectMode] = useState(false);
  const [quickActionLoadingKey, setQuickActionLoadingKey] = useState<string | null>(null);
  const [bulkActionLoadingKey, setBulkActionLoadingKey] = useState<OrderBulkActionKey | null>(null);
  const [bulkPrintLoadingKind, setBulkPrintLoadingKind] = useState<BulkPrintKind | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [quickActionConfirm, setQuickActionConfirm] = useState<{
    orderId: string;
    orderNo: string;
    config: Extract<OrderListQuickAction, { type: "patch" }>;
  } | null>(null);
  const [orderReviewSheet, setOrderReviewSheet] = useState<OrderReviewSheetState | null>(null);
  const [bulkActionConfirm, setBulkActionConfirm] = useState<OrderBulkActionGroup | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [manageSearchInput, setManageSearchInput] = useState(activeSearchQuery);
  const [manualSearchKeyword, setManualSearchKeyword] = useState("");
  const [quickAddKeyword, setQuickAddKeyword] = useState("");
  const [quickAddCategoryId, setQuickAddCategoryId] = useState<string>("ALL");
  const [quickAddOnlyAvailable, setQuickAddOnlyAvailable] = useState(false);
  const [showCartSheet, setShowCartSheet] = useState(false);
  const [productUnitPicker, setProductUnitPicker] = useState<ProductUnitPickerState | null>(null);
  const [showCheckoutSheet, setShowCheckoutSheet] = useState(false);
  const [showRecentOrdersSheet, setShowRecentOrdersSheet] = useState(false);
  const [showCheckoutCloseConfirm, setShowCheckoutCloseConfirm] = useState(false);
  const [pickupLaterCustomerOpen, setPickupLaterCustomerOpen] = useState(false);
  const [onlineChannelMode, setOnlineChannelMode] = useState<OnlineChannelMode>("FACEBOOK");
  const [onlineOtherChannelInput, setOnlineOtherChannelInput] = useState("");
  const [onlineCustomProviderOpen, setOnlineCustomProviderOpen] = useState(false);
  const [onlineContactPickerOpen, setOnlineContactPickerOpen] = useState(false);
  const [onlineQuickFillInput, setOnlineQuickFillInput] = useState("");
  const [showQrAccountPreview, setShowQrAccountPreview] = useState(false);
  const [showQrImageViewer, setShowQrImageViewer] = useState(false);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [shippingFeeEnabled, setShippingFeeEnabled] = useState(false);
  const [discountInputMode, setDiscountInputMode] = useState<DiscountInputMode>("AMOUNT");
  const [discountPercentInput, setDiscountPercentInput] = useState("");
  const [createStep, setCreateStep] = useState<CreateOrderStep>("products");
  const [checkoutFlow, setCheckoutFlow] = useState<CheckoutFlow>("WALK_IN_NOW");
  const [createdOrderSuccess, setCreatedOrderSuccess] = useState<CreatedOrderSuccessState | null>(null);
  const [receiptPreviewOrder, setReceiptPreviewOrder] = useState<ReceiptPreviewOrder | null>(null);
  const [receiptPreviewLoading, setReceiptPreviewLoading] = useState(false);
  const [receiptPreviewError, setReceiptPreviewError] = useState<string | null>(null);
  const [receiptPrintLoading, setReceiptPrintLoading] = useState(false);
  const [shippingLabelPrintLoading, setShippingLabelPrintLoading] = useState(false);
  const [showOrderPackSheet, setShowOrderPackSheet] = useState<OrderPackSheetState | null>(null);
  const [orderPackPreview, setOrderPackPreview] = useState<OrderDetail | null>(null);
  const [orderPackPreviewLoading, setOrderPackPreviewLoading] = useState(false);
  const [orderPackPreviewError, setOrderPackPreviewError] = useState<string | null>(null);
  const [orderPackPrintLoading, setOrderPackPrintLoading] = useState(false);
  const [recentOrders, setRecentOrders] = useState<RecentOrderItem[]>([]);
  const [recentOrdersLoading, setRecentOrdersLoading] = useState(false);
  const [recentOrdersError, setRecentOrdersError] = useState<string | null>(null);
  const [cancelApprovalTargetOrder, setCancelApprovalTargetOrder] = useState<RecentOrderItem | null>(
    null,
  );
  const [cancelApprovalSubmitting, setCancelApprovalSubmitting] = useState(false);
  const [hasInitializedDraftRestore, setHasInitializedDraftRestore] = useState(!isCreateOnlyMode);
  const [desktopCartStickyTop, setDesktopCartStickyTop] = useState("13.5rem");
  const createOnlySearchStickyRef = useRef<HTMLDivElement | null>(null);
  const createOnlyCartStickyRef = useRef<HTMLElement | null>(null);
  const outOfStockToastRef = useRef<{
    productId: string;
    shownAtMs: number;
  } | null>(null);

  const form = useForm<CreateOrderFormInput, unknown, CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: defaultValues(catalog),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedChannel = useWatch({ control: form.control, name: "channel" }) ?? "WALK_IN";
  const watchedItemsRaw = useWatch({ control: form.control, name: "items" });
  const watchedItems = watchedItemsRaw ?? EMPTY_ORDER_ITEMS;
  const watchedDiscount = Number(useWatch({ control: form.control, name: "discount" }) ?? 0);
  const watchedShippingFeeCharged = Number(
    useWatch({ control: form.control, name: "shippingFeeCharged" }) ?? 0,
  );
  const watchedShippingCost = Number(useWatch({ control: form.control, name: "shippingCost" }) ?? 0);
  const watchedPaymentCurrency =
    useWatch({ control: form.control, name: "paymentCurrency" }) ?? catalog.storeCurrency;
  const watchedPaymentMethod = useWatch({ control: form.control, name: "paymentMethod" }) ?? "CASH";
  const watchedPaymentAccountId =
    useWatch({ control: form.control, name: "paymentAccountId" }) ?? "";
  const watchedContactId = useWatch({ control: form.control, name: "contactId" }) ?? "";
  const watchedCustomerName = useWatch({ control: form.control, name: "customerName" }) ?? "";
  const watchedCustomerPhone = useWatch({ control: form.control, name: "customerPhone" }) ?? "";
  const watchedCustomerAddress =
    useWatch({ control: form.control, name: "customerAddress" }) ?? "";
  const watchedShippingProvider =
    useWatch({ control: form.control, name: "shippingProvider" }) ?? "";
  const isOnlineCheckout = checkoutFlow === "ONLINE_DELIVERY";
  const isPickupLaterCheckout = checkoutFlow === "PICKUP_LATER";
  const hasPickupCustomerIdentity =
    watchedCustomerName.trim().length > 0 || watchedCustomerPhone.trim().length > 0;
  const pickupCustomerIdentitySummary = useMemo(() => {
    const name = watchedCustomerName.trim();
    const phone = watchedCustomerPhone.trim();
    if (name && phone) {
      return `${name} • ${phone}`;
    }
    return name || phone || t(uiLocale, "orders.create.customerIdentity.none");
  }, [uiLocale, watchedCustomerName, watchedCustomerPhone]);
  const showCustomerIdentityFields =
    isOnlineCheckout || (isPickupLaterCheckout && pickupLaterCustomerOpen);
  const requiresCustomerPhone = isOnlineCheckout;
  const supportedPaymentCurrencies = useMemo(() => {
    const fallbackCurrency = parseStoreCurrency(catalog.storeCurrency);
    const deduped = new Set<ReturnType<typeof parseStoreCurrency>>();
    for (const currency of catalog.supportedCurrencies) {
      deduped.add(parseStoreCurrency(currency, fallbackCurrency));
    }
    if (!deduped.has(fallbackCurrency)) {
      deduped.add(fallbackCurrency);
    }
    if (deduped.size <= 0) {
      deduped.add(fallbackCurrency);
    }
    return Array.from(deduped);
  }, [catalog.storeCurrency, catalog.supportedCurrencies]);
  const selectedPaymentCurrency = parseStoreCurrency(
    watchedPaymentCurrency,
    supportedPaymentCurrencies[0] ?? parseStoreCurrency(catalog.storeCurrency),
  );
  const qrPaymentAccounts = useMemo(
    () =>
      catalog.paymentAccounts.filter(
        (account) =>
          account.accountType === "LAO_QR" &&
          account.currency === selectedPaymentCurrency,
      ),
    [catalog.paymentAccounts, selectedPaymentCurrency],
  );
  const activeQrPaymentAccounts = useMemo(
    () => qrPaymentAccounts.filter((account) => account.isActive),
    [qrPaymentAccounts],
  );
  const getActiveQrPaymentAccountsForCurrency = useCallback(
    (currency: OrderListItem["paymentCurrency"]) =>
      activeQrPaymentAccounts.filter((account) => account.currency === currency),
    [activeQrPaymentAccounts],
  );
  const selectedQrPaymentAccount = useMemo(
    () => qrPaymentAccounts.find((account) => account.id === watchedPaymentAccountId) ?? null,
    [qrPaymentAccounts, watchedPaymentAccountId],
  );
  const paymentMethodOptions = useMemo<Array<{ key: CheckoutPaymentMethod; labelKey: MessageKey }>>(
    () =>
      isOnlineCheckout
        ? [
            { key: "CASH", labelKey: "orders.paymentMethod.CASH" },
            { key: "LAO_QR", labelKey: "orders.paymentMethod.LAO_QR" },
            { key: "ON_CREDIT", labelKey: "orders.paymentMethod.ON_CREDIT" },
            { key: "COD", labelKey: "orders.paymentMethod.COD" },
          ]
        : [
            { key: "CASH", labelKey: "orders.paymentMethod.CASH" },
            { key: "LAO_QR", labelKey: "orders.paymentMethod.LAO_QR" },
            { key: "ON_CREDIT", labelKey: "orders.paymentMethod.ON_CREDIT" },
          ],
    [isOnlineCheckout],
  );
  const hasCheckoutDraftInput = useMemo(() => {
    const hasTextInput =
      watchedCustomerName.trim().length > 0 ||
      watchedCustomerPhone.trim().length > 0 ||
      watchedCustomerAddress.trim().length > 0 ||
      watchedShippingProvider.trim().length > 0 ||
      watchedContactId.trim().length > 0 ||
      (isOnlineCheckout && onlineOtherChannelInput.trim().length > 0);
    const hasAmountInput =
      watchedDiscount > 0 || watchedShippingFeeCharged > 0 || watchedShippingCost > 0;
    const hasPaymentSelectionChange =
      watchedPaymentMethod !== "CASH" ||
      watchedPaymentCurrency !== catalog.storeCurrency ||
      watchedPaymentAccountId.trim().length > 0;
    const hasOrderTypeChange = checkoutFlow !== "WALK_IN_NOW" || watchedChannel !== "WALK_IN";

    return hasTextInput || hasAmountInput || hasPaymentSelectionChange || hasOrderTypeChange;
  }, [
    catalog.storeCurrency,
    checkoutFlow,
    watchedChannel,
    watchedContactId,
    watchedCustomerAddress,
    watchedCustomerName,
    watchedCustomerPhone,
    watchedShippingProvider,
    watchedDiscount,
    watchedPaymentAccountId,
    watchedPaymentCurrency,
    watchedPaymentMethod,
    watchedShippingCost,
    watchedShippingFeeCharged,
    isOnlineCheckout,
    onlineOtherChannelInput,
  ]);

  const productsById = useMemo(
    () => new Map(catalog.products.map((product) => [product.productId, product])),
    [catalog.products],
  );

  const contactsById = useMemo(
    () => new Map(catalog.contacts.map((contact) => [contact.id, contact])),
    [catalog.contacts],
  );
  const onlineChannelContacts = useMemo(
    () =>
      catalog.contacts.filter((contact) =>
        watchedChannel === "FACEBOOK"
          ? contact.channel === "FACEBOOK"
          : contact.channel === "WHATSAPP",
      ),
    [catalog.contacts, watchedChannel],
  );
  const selectedOnlineContactLabel = watchedContactId
    ? (contactsById.get(watchedContactId)?.displayName ?? null)
    : null;
  const shippingProviderChipOptions = useMemo(() => {
    const deduped = new Set<string>();
    return catalog.shippingProviders
      .map((provider) => provider.displayName.trim())
      .filter((name) => name.length > 0)
      .filter((name) => {
        const normalized = name.toLowerCase();
        if (deduped.has(normalized)) {
          return false;
        }
        deduped.add(normalized);
        return true;
      });
  }, [catalog.shippingProviders]);
  const isKnownShippingProvider = shippingProviderChipOptions.some(
    (provider) => provider === watchedShippingProvider.trim(),
  );
  const getProductAvailableQty = useCallback(
    (productId: string, unitId?: string) => {
      const product = productsById.get(productId);
      const available = Number(product?.available ?? 0);
      if (!Number.isFinite(available)) {
        return 0;
      }
      const normalizedAvailable = Math.max(0, Math.trunc(available));
      if (!unitId) {
        return normalizedAvailable;
      }

      const multiplierToBase = Math.max(
        1,
        Math.trunc(
          Number(
            product?.units.find((unitOption) => unitOption.unitId === unitId)?.multiplierToBase ?? 1,
          ),
        ) || 1,
      );
      return Math.max(0, Math.floor(normalizedAvailable / multiplierToBase));
    },
    [productsById],
  );
  const getAvailableSellUnits = useCallback(
    (product: OrderCatalog["products"][number]) =>
      product.units.filter((unit) => getProductAvailableQty(product.productId, unit.unitId) > 0),
    [getProductAvailableQty],
  );
  const getPreferredUnitId = useCallback(
    (product: OrderCatalog["products"][number] | undefined) => {
      if (!product) {
        return "";
      }
      return getAvailableSellUnits(product)[0]?.unitId ?? product.units[0]?.unitId ?? "";
    },
    [getAvailableSellUnits],
  );
  const manualSearchResults = useMemo(() => {
    const keyword = manualSearchKeyword.trim().toLowerCase();
    if (!keyword) {
      return [];
    }

    return catalog.products
      .filter((product) => {
        const barcode = product.barcode?.toLowerCase() ?? "";
        return (
          product.sku.toLowerCase().includes(keyword) ||
          product.name.toLowerCase().includes(keyword) ||
          barcode.includes(keyword)
        );
      })
      .slice(0, 8);
  }, [catalog.products, manualSearchKeyword]);
  const quickAddProducts = useMemo(() => {
    const keyword = quickAddKeyword.trim().toLowerCase();
    let filtered = keyword
      ? catalog.products.filter((product) => {
          const barcode = product.barcode?.toLowerCase() ?? "";
          return (
            product.sku.toLowerCase().includes(keyword) ||
            product.name.toLowerCase().includes(keyword) ||
            barcode.includes(keyword)
          );
        })
      : catalog.products;

    if (quickAddCategoryId !== "ALL") {
      filtered = filtered.filter((product) => product.categoryId === quickAddCategoryId);
    }

    if (quickAddOnlyAvailable) {
      filtered = filtered.filter((product) => getAvailableSellUnits(product).length > 0);
    }

    return filtered.slice(0, 24);
  }, [
    catalog.products,
    getAvailableSellUnits,
    quickAddKeyword,
    quickAddCategoryId,
    quickAddOnlyAvailable,
  ]);
  const quickAddCategories = useMemo<QuickAddCategory[]>(() => {
    const categoryMap = new Map<string, QuickAddCategory>();
    for (const product of catalog.products) {
      if (!product.categoryId || !product.categoryName) {
        continue;
      }
      const current = categoryMap.get(product.categoryId);
      if (current) {
        current.count += 1;
      } else {
        categoryMap.set(product.categoryId, {
          id: product.categoryId,
          name: product.categoryName,
          count: 1,
        });
      }
    }
    return Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [catalog.products]);

  const visibleOrders = useMemo(
    () => (isCreateOnlyMode ? [] : (ordersPage?.rows ?? [])),
    [isCreateOnlyMode, ordersPage],
  );
  const activeTabOption = useMemo(
    () => tabOptions.find((tab) => tab.key === activeTab) ?? tabOptions[0],
    [activeTab],
  );
  const pendingTabOption = useMemo(
    () => (pendingTab ? tabOptions.find((tab) => tab.key === pendingTab) ?? null : null),
    [pendingTab],
  );
  const isOrdersTabTransitioning =
    !isCreateOnlyMode &&
    (isManageSearchPending || (isTabPending && pendingTab !== null && pendingTab !== activeTab));
  const visibleOrderIds = useMemo(() => visibleOrders.map((order) => order.id), [visibleOrders]);
  const selectedOrderIdSet = useMemo(() => new Set(selectedOrderIds), [selectedOrderIds]);
  const selectedOrders = useMemo(
    () => visibleOrders.filter((order) => selectedOrderIdSet.has(order.id)),
    [selectedOrderIdSet, visibleOrders],
  );
  const orderQuickActionPermissions = useMemo<OrderListQuickActionPermissions>(
    () => ({
      canUpdate,
      canMarkPaid,
      canPack,
      canShip,
      canCodReturn,
    }),
    [canCodReturn, canMarkPaid, canPack, canShip, canUpdate],
  );
  useEffect(() => {
    if (isCreateOnlyMode) {
      return;
    }
    const visibleIdSet = new Set(visibleOrderIds);
    setSelectedOrderIds((current) => current.filter((id) => visibleIdSet.has(id)));
  }, [isCreateOnlyMode, visibleOrderIds]);
  const clearSelectedOrders = useCallback(() => {
    setSelectedOrderIds([]);
  }, []);
  const openOrderPackSheet = useCallback((order: Pick<OrderListItem, "id" | "orderNo">) => {
    setOrderPackPreview(null);
    setOrderPackPreviewError(null);
    setShowOrderPackSheet({
      orderId: order.id,
      orderNo: order.orderNo,
    });
  }, []);
  const toggleDesktopBulkSelectMode = useCallback(() => {
    setIsDesktopBulkSelectMode((current) => {
      if (current) {
        clearSelectedOrders();
      }
      return !current;
    });
  }, [clearSelectedOrders]);
  const toggleOrderSelection = useCallback((orderId: string) => {
    setSelectedOrderIds((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
    );
  }, []);
  const areAllVisibleOrdersSelected =
    visibleOrderIds.length > 0 && visibleOrderIds.every((orderId) => selectedOrderIdSet.has(orderId));
  const toggleSelectAllVisibleOrders = useCallback(() => {
    setSelectedOrderIds((current) => {
      const currentSet = new Set(current);
      const allSelected =
        visibleOrderIds.length > 0 && visibleOrderIds.every((orderId) => currentSet.has(orderId));
      if (allSelected) {
        return current.filter((id) => !visibleOrderIds.includes(id));
      }
      const next = current.filter((id) => !visibleOrderIds.includes(id));
      return [...next, ...visibleOrderIds];
    });
  }, [visibleOrderIds]);
  const selectedQuickActionGroups = useMemo<OrderBulkActionGroup[]>(() => {
    const groups = new Map<OrderBulkActionKey, OrderBulkActionGroup>();

    for (const order of selectedOrders) {
      const quickAction = getOrderListQuickAction(order, orderQuickActionPermissions);
      if (!quickAction || quickAction.type !== "patch") {
        continue;
      }

      const existing = groups.get(quickAction.key);
      if (existing) {
        existing.orders.push({
          id: order.id,
          orderNo: order.orderNo,
        });
        continue;
      }

      groups.set(quickAction.key, {
        key: quickAction.key,
        buttonLabelKey: bulkActionButtonLabelKey[quickAction.key],
        requestAction: quickAction.requestAction,
        orders: [
          {
            id: order.id,
            orderNo: order.orderNo,
          },
        ],
      });
    }

    return bulkActionOrder
      .map((actionKey) => groups.get(actionKey))
      .filter((group): group is OrderBulkActionGroup => Boolean(group));
  }, [orderQuickActionPermissions, selectedOrders]);
  const selectedOrdersTotal = useMemo(
    () => selectedOrders.reduce((sum, order) => sum + order.total, 0),
    [selectedOrders],
  );
  const selectedReceiptPrintOrders = selectedOrders;
  const selectedLabelPrintOrders = useMemo(
    () => selectedOrders.filter((order) => order.channel !== "WALK_IN"),
    [selectedOrders],
  );
  const selectedPackPrintOrders = useMemo(
    () => selectedOrders.filter((order) => canOpenOrderPackView(order)),
    [selectedOrders],
  );
  const selectedReviewQrAccount = useMemo(() => {
    if (!orderReviewSheet || orderReviewSheet.kind !== "confirm-paid") {
      return null;
    }
    return (
      getActiveQrPaymentAccountsForCurrency(orderReviewSheet.paymentCurrency).find(
        (account) => account.id === orderReviewSheet.paymentAccountId,
      ) ?? null
    );
  }, [getActiveQrPaymentAccountsForCurrency, orderReviewSheet]);
  const buildOrderQuickActionLoadingKey = useCallback(
    (orderId: string, actionKey: string) => `${orderId}:${actionKey}`,
    [],
  );
  const orderReviewLoadingKey = orderReviewSheet
    ? buildOrderQuickActionLoadingKey(orderReviewSheet.orderId, orderReviewSheet.kind)
    : null;
  const reviewCodAmountNumber =
    orderReviewSheet?.kind === "cod-reconcile" ? Number(orderReviewSheet.codAmount) : null;
  const reviewCodFeeNumber =
    orderReviewSheet?.kind === "cod-reconcile" || orderReviewSheet?.kind === "cod-return"
      ? Number(orderReviewSheet.codFee)
      : null;
  const runOrderQuickAction = useCallback(
    async (
      order: Pick<OrderListItem, "id" | "orderNo">,
      config: Extract<OrderListQuickAction, { type: "patch" }>,
    ) => {
      const loadingKey = buildOrderQuickActionLoadingKey(order.id, config.key);
      setQuickActionLoadingKey(loadingKey);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const response = await authFetch(`/api/orders/${order.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: config.requestAction,
          }),
        });

        const data = (await response.json().catch(() => null)) as
          | {
              message?: string;
            }
          | null;

        if (!response.ok) {
          const message = data?.message ?? t(uiLocale, "common.error.saveFailed");
          setErrorMessage(message);
          toast.error(message);
          return;
        }

        const successText = t(uiLocale, config.successKey);
        setSuccessMessage(successText);
        toast.success(successText);
        setQuickActionConfirm(null);
        router.refresh();
      } catch {
        const message = t(uiLocale, "common.error.saveFailed");
        setErrorMessage(message);
        toast.error(message);
      } finally {
        setQuickActionLoadingKey(null);
      }
    },
    [buildOrderQuickActionLoadingKey, router, uiLocale],
  );
  const openOrderReviewSheet = useCallback(
    (
      order: Pick<
        OrderListItem,
        | "id"
        | "orderNo"
        | "customerName"
        | "contactDisplayName"
        | "paymentCurrency"
        | "total"
        | "shippingCost"
        | "codFee"
        | "codReturnNote"
      >,
      quickAction: OrderListReviewAction,
    ) => {
      const customerLabel = getOrderCustomerDisplay(uiLocale, order);
      if (quickAction.reviewKind === "cod-reconcile") {
        setOrderReviewSheet({
          kind: "cod-reconcile",
          orderId: order.id,
          orderNo: order.orderNo,
          customerLabel,
          total: order.total,
          shippingCost: order.shippingCost,
          codFeeAccumulated: order.codFee,
          paymentCurrency: order.paymentCurrency,
          actionLabelKey: quickAction.labelKey,
          codAmount: String(order.total),
          codFee: "0",
        });
        return;
      }

      if (quickAction.reviewKind === "cod-return") {
        setOrderReviewSheet({
          kind: "cod-return",
          orderId: order.id,
          orderNo: order.orderNo,
          customerLabel,
          total: order.total,
          shippingCost: order.shippingCost,
          codFeeAccumulated: order.codFee,
          paymentCurrency: order.paymentCurrency,
          actionLabelKey: quickAction.labelKey,
          codFee: "0",
          codReturnNote: order.codReturnNote ?? "",
        });
        return;
      }

      setOrderReviewSheet({
        kind: "confirm-paid",
        orderId: order.id,
        orderNo: order.orderNo,
        customerLabel,
        total: order.total,
        paymentCurrency: order.paymentCurrency,
        actionLabelKey: quickAction.labelKey,
        paymentMethod: "CASH",
        paymentAccountId: getActiveQrPaymentAccountsForCurrency(order.paymentCurrency)[0]?.id ?? "",
      });
    },
    [getActiveQrPaymentAccountsForCurrency, uiLocale],
  );
  const runOrderReviewAction = useCallback(async () => {
    if (!orderReviewSheet) {
      return;
    }

    const loadingKey = buildOrderQuickActionLoadingKey(orderReviewSheet.orderId, orderReviewSheet.kind);
    setQuickActionLoadingKey(loadingKey);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (orderReviewSheet.kind === "confirm-paid") {
        if (
          orderReviewSheet.paymentMethod === "LAO_QR" &&
          !orderReviewSheet.paymentAccountId.trim()
        ) {
          const message = t(uiLocale, "orders.management.review.confirmPaid.error.paymentAccountRequired");
          setErrorMessage(message);
          toast.error(message);
          return;
        }

        const response = await authFetch(`/api/orders/${orderReviewSheet.orderId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "confirm_paid",
            paymentMethod: orderReviewSheet.paymentMethod,
            paymentAccountId:
              orderReviewSheet.paymentMethod === "LAO_QR"
                ? orderReviewSheet.paymentAccountId
                : undefined,
          }),
        });
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        if (!response.ok) {
          const message = data?.message ?? t(uiLocale, "common.error.saveFailed");
          setErrorMessage(message);
          toast.error(message);
          return;
        }

        const successText = t(uiLocale, "orders.detail.toast.paymentConfirmed");
        setSuccessMessage(successText);
        toast.success(successText);
        setOrderReviewSheet(null);
        router.refresh();
        return;
      }

      const codFee = Number(orderReviewSheet.codFee);
      if (orderReviewSheet.kind === "cod-reconcile") {
        const codAmount = Number(orderReviewSheet.codAmount);
        if (!Number.isFinite(codAmount) || codAmount < 0 || !Number.isFinite(codFee) || codFee < 0) {
          const message = t(uiLocale, "orders.management.review.cod.error.invalidAmount");
          setErrorMessage(message);
          toast.error(message);
          return;
        }

        const response = await authFetch("/api/orders/cod-reconcile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createCodReconcileIdempotencyKey(),
          },
          body: JSON.stringify({
            items: [
              {
                orderId: orderReviewSheet.orderId,
                codAmount: Math.trunc(codAmount),
                codFee: Math.trunc(codFee),
              },
            ],
          }),
        });
        const data = (await response.json().catch(() => null)) as
          | {
              message?: string;
              ok?: boolean;
              settledCount?: number;
              failedCount?: number;
              results?: Array<{ ok: boolean; message?: string }>;
            }
          | null;
        if (
          !response.ok ||
          !data?.ok ||
          (data.settledCount ?? 0) <= 0 ||
          (data.results?.some((item) => !item.ok) ?? false)
        ) {
          const message = data?.message ?? t(uiLocale, "orders.codReconcile.error.settleFailed");
          setErrorMessage(message);
          toast.error(message);
          return;
        }

        const successText = t(uiLocale, "orders.detail.toast.codSettled");
        setSuccessMessage(successText);
        toast.success(successText);
        setOrderReviewSheet(null);
        router.refresh();
        return;
      }

      if (!Number.isFinite(codFee) || codFee < 0) {
        const message = t(uiLocale, "orders.management.review.codReturn.error.invalidFee");
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      const response = await authFetch(`/api/orders/${orderReviewSheet.orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "mark_cod_returned",
          codFee: Math.trunc(codFee),
          codReturnNote: orderReviewSheet.codReturnNote.trim(),
        }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        const message = data?.message ?? t(uiLocale, "common.error.saveFailed");
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      const successText = t(uiLocale, "orders.detail.toast.codReturned");
      setSuccessMessage(successText);
      toast.success(successText);
      setOrderReviewSheet(null);
      router.refresh();
    } catch {
      const message =
        orderReviewSheet.kind === "confirm-paid"
          ? t(uiLocale, "common.error.saveFailed")
          : orderReviewSheet.kind === "cod-reconcile"
            ? t(uiLocale, "orders.codReconcile.error.settleFailed")
            : t(uiLocale, "common.error.saveFailed");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setQuickActionLoadingKey(null);
    }
  }, [buildOrderQuickActionLoadingKey, orderReviewSheet, router, uiLocale]);
  const handleOrderQuickAction = useCallback(
    (
      order: Pick<
        OrderListItem,
        | "id"
        | "orderNo"
        | "customerName"
        | "contactDisplayName"
        | "paymentCurrency"
        | "total"
        | "shippingCost"
        | "codFee"
        | "codReturnNote"
      >,
      quickAction: OrderListQuickAction | null,
    ) => {
      if (!quickAction) {
        return;
      }

      if (quickAction.type === "detail") {
        router.push(`/orders/${order.id}`);
        return;
      }

      if (quickAction.type === "review") {
        openOrderReviewSheet(order, quickAction);
        return;
      }

      if (quickAction.requiresConfirm) {
        setQuickActionConfirm({
          orderId: order.id,
          orderNo: order.orderNo,
          config: quickAction,
        });
        return;
      }

      void runOrderQuickAction(order, quickAction);
    },
    [openOrderReviewSheet, router, runOrderQuickAction],
  );
  const runBulkOrderAction = useCallback(
    async (group: OrderBulkActionGroup) => {
      setBulkActionLoadingKey(group.key);
      setBulkActionConfirm(null);
      setErrorMessage(null);
      setSuccessMessage(null);

      const succeededOrderIds: string[] = [];
      const failedOrderNos: string[] = [];

      for (const order of group.orders) {
        try {
          const response = await authFetch(`/api/orders/${order.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: group.requestAction,
            }),
          });

          if (!response.ok) {
            failedOrderNos.push(order.orderNo);
            continue;
          }

          succeededOrderIds.push(order.id);
        } catch {
          failedOrderNos.push(order.orderNo);
        }
      }

      if (succeededOrderIds.length > 0) {
        setSelectedOrderIds((current) => current.filter((id) => !succeededOrderIds.includes(id)));
      }

      if (succeededOrderIds.length === group.orders.length) {
        const successText = `${t(uiLocale, "orders.management.bulk.result.successPrefix")} ${succeededOrderIds.length.toLocaleString(numberLocale)} ${t(uiLocale, "orders.management.bulk.result.successSuffix")}`;
        setSuccessMessage(successText);
        toast.success(successText);
      } else {
        const errorText = `${t(uiLocale, "orders.management.bulk.result.partialPrefix")} ${succeededOrderIds.length.toLocaleString(numberLocale)} ${t(uiLocale, "orders.management.bulk.result.partialMiddle")} ${group.orders.length.toLocaleString(numberLocale)} ${t(uiLocale, "orders.management.bulk.result.partialSuffix")}`;
        const failedPreview = failedOrderNos.slice(0, 3).join(", ");
        const detail =
          failedPreview.length > 0
            ? `${errorText} (${failedPreview}${failedOrderNos.length > 3 ? "..." : ""})`
            : errorText;
        setErrorMessage(detail);
        toast.error(detail);
      }

      router.refresh();
      setBulkActionLoadingKey(null);
    },
    [numberLocale, router, uiLocale],
  );
  const hasCatalogProducts = catalog.products.length > 0;
  const getProductUnitPrice = useCallback(
    (productId: string, unitId: string) => {
      const product = productsById.get(productId);
      if (!product) return 0;
      const unit = product.units.find((unitOption) => unitOption.unitId === unitId);
      return unit?.pricePerUnit ?? 0;
    },
    [productsById],
  );
  const getProductDefaultUnitPrice = useCallback(
    (product: OrderCatalog["products"][number]) => product.units[0]?.pricePerUnit ?? product.priceBase,
    [],
  );
  const setItemUnit = useCallback(
    (index: number, nextUnitId: string) => {
      const productId = String(form.getValues(`items.${index}.productId`) ?? "");
      const product = productsById.get(productId);
      const maxQty = getProductAvailableQty(productId, nextUnitId);
      const currentQty = Number(form.getValues(`items.${index}.qty`) ?? 0);
      const normalizedQty = Math.max(1, Math.trunc(currentQty) || 1);
      const boundedQty = maxQty > 0 ? Math.min(normalizedQty, maxQty) : 1;

      form.setValue(`items.${index}.unitId`, nextUnitId, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue(`items.${index}.qty`, boundedQty, {
        shouldDirty: true,
        shouldValidate: true,
      });

      if (product && maxQty > 0 && boundedQty < normalizedQty) {
        setScanMessage(
          `${t(uiLocale, "orders.create.scan.productPrefix")} ${product.sku} - ${product.name} ${t(uiLocale, "orders.create.scan.maxQty.prefix")} ${maxQty.toLocaleString(numberLocale)} ${t(uiLocale, "orders.create.scan.maxQty.unit")}`,
        );
      }
    },
    [form, getProductAvailableQty, numberLocale, productsById, uiLocale],
  );
  const restoreDraftFormForCatalog = useCallback(
    (draft: NewOrderDraftPayload) => {
      const normalizedItems = draft.form.items
        .map((item) => {
          const product = productsById.get(item.productId);
          if (!product) {
            return null;
          }

          const hasUnit = product.units.some((unit) => unit.unitId === item.unitId);
          const fallbackUnitId = getPreferredUnitId(product);
          const unitId = hasUnit ? item.unitId : fallbackUnitId;
          const maxQty = getProductAvailableQty(item.productId, unitId);
          if (!unitId || maxQty <= 0) {
            return null;
          }
          const qty = Math.min(maxQty, Math.max(1, Math.trunc(Number(item.qty) || 0)));

          return {
            productId: item.productId,
            unitId,
            qty,
          };
        })
        .filter(
          (
            item,
          ): item is {
            productId: string;
            unitId: string;
            qty: number;
          } => item !== null,
        );

      if (normalizedItems.length <= 0) {
        return null;
      }

      const supportedCurrencySet = new Set(catalog.supportedCurrencies);
      const allowedMethods = new Set(["CASH", "LAO_QR", "ON_CREDIT", "COD", "BANK_TRANSFER"]);
      const allowedChannels = new Set(["WALK_IN", "FACEBOOK", "WHATSAPP"]);
      const isKnownAccount = catalog.paymentAccounts.some(
        (account) => account.id === draft.form.paymentAccountId,
      );

      const paymentCurrency = supportedCurrencySet.has(draft.form.paymentCurrency)
        ? draft.form.paymentCurrency
        : parseStoreCurrency(catalog.storeCurrency);
      const paymentMethod = allowedMethods.has(draft.form.paymentMethod)
        ? draft.form.paymentMethod === "BANK_TRANSFER"
          ? "ON_CREDIT"
          : draft.form.paymentMethod
        : "CASH";
      const channel = allowedChannels.has(draft.form.channel)
        ? draft.form.channel
        : "WALK_IN";

      return {
        channel,
        checkoutFlow: draft.checkoutFlow,
        contactId: draft.form.contactId,
        customerName: draft.form.customerName,
        customerPhone: draft.form.customerPhone,
        customerAddress: draft.form.customerAddress,
        shippingProvider: draft.form.shippingProvider,
        shippingCarrier: "",
        discount: Math.max(0, Math.trunc(Number(draft.form.discount) || 0)),
        shippingFeeCharged: Math.max(0, Math.trunc(Number(draft.form.shippingFeeCharged) || 0)),
        shippingCost: Math.max(0, Math.trunc(Number(draft.form.shippingCost) || 0)),
        paymentCurrency,
        paymentMethod,
        paymentAccountId:
          paymentMethod === "LAO_QR" && isKnownAccount ? draft.form.paymentAccountId : "",
        items: normalizedItems,
      } satisfies CreateOrderFormInput;
    },
    [
      catalog.paymentAccounts,
      catalog.storeCurrency,
      catalog.supportedCurrencies,
      getPreferredUnitId,
      getProductAvailableQty,
      productsById,
    ],
  );

  const subtotal = watchedItems.reduce((sum, item) => {
    const qty = Number(item.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      return sum;
    }
    return sum + qty * getProductUnitPrice(item.productId, item.unitId);
  }, 0);

  const totals = computeOrderTotals({
    subtotal,
    discount: watchedDiscount,
    vatEnabled: catalog.vatEnabled,
    vatRate: catalog.vatRate,
    vatMode: catalog.vatMode,
    shippingFeeCharged: Math.max(0, watchedShippingFeeCharged),
  });
  const maxDiscountAmount = Math.max(0, Math.round(subtotal));
  const currentDiscountPercent =
    maxDiscountAmount > 0 ? Math.min(100, (totals.discount / maxDiscountAmount) * 100) : 0;
  const cartQtyTotal = watchedItems.reduce((sum, item) => {
    const qty = Number(item.qty ?? 0);
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
  }, 0);
  const isOrderPackSheetBusy = orderPackPreviewLoading || orderPackPrintLoading;

  const applyDiscountAmount = useCallback(
    (nextDiscount: number) => {
      const safeDiscount = Math.max(0, Math.min(maxDiscountAmount, Math.trunc(nextDiscount || 0)));
      form.setValue("discount", safeDiscount, { shouldDirty: true, shouldValidate: true });
    },
    [form, maxDiscountAmount],
  );

  const applyDiscountPercent = useCallback(
    (nextPercent: number) => {
      const safePercent = Math.max(0, Math.min(100, nextPercent));
      const amount = Math.round((maxDiscountAmount * safePercent) / 100);
      applyDiscountAmount(amount);
    },
    [applyDiscountAmount, maxDiscountAmount],
  );

  const setCheckoutPaymentMethod = useCallback(
    (nextMethod: CheckoutPaymentMethod) => {
      setShowQrAccountPreview(false);
      form.setValue("paymentMethod", nextMethod, { shouldDirty: true, shouldValidate: true });
      if (nextMethod === "LAO_QR") {
        const currentPaymentAccountId = form.getValues("paymentAccountId");
        const defaultQrAccount =
          qrPaymentAccounts.some((account) => account.id === currentPaymentAccountId)
            ? currentPaymentAccountId
            : (qrPaymentAccounts[0]?.id ?? "");
        form.setValue("paymentAccountId", defaultQrAccount, {
          shouldDirty: true,
          shouldValidate: true,
        });
        return;
      }
      form.setValue("paymentAccountId", "", { shouldDirty: true, shouldValidate: true });
    },
    [form, qrPaymentAccounts],
  );

  const copyQrAccountNumber = useCallback(async () => {
    if (!selectedQrPaymentAccount?.accountNumber) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedQrPaymentAccount.accountNumber);
      toast.success(t(uiLocale, "orders.toast.copyAccount.success"));
    } catch {
      toast.error(t(uiLocale, "orders.toast.copyAccount.fail"));
    }
  }, [selectedQrPaymentAccount, uiLocale]);

  const getSelectedQrImageActionUrl = useCallback(
    (download = false) => {
      if (!selectedQrPaymentAccount?.id) {
        return null;
      }
      const search = download ? "?download=1" : "";
      return `/api/orders/payment-accounts/${selectedQrPaymentAccount.id}/qr-image${search}`;
    },
    [selectedQrPaymentAccount],
  );

  const openQrImageFull = useCallback(() => {
    if (!selectedQrPaymentAccount?.qrImageUrl) {
      return;
    }
    setShowQrImageViewer(true);
  }, [selectedQrPaymentAccount]);

  const openQrImageInNewTab = useCallback(() => {
    if (!selectedQrPaymentAccount?.qrImageUrl) {
      return;
    }

    const targetUrl = getSelectedQrImageActionUrl(false) ?? selectedQrPaymentAccount.qrImageUrl;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }, [getSelectedQrImageActionUrl, selectedQrPaymentAccount]);

  const downloadQrImage = useCallback(async () => {
    if (!selectedQrPaymentAccount?.qrImageUrl) {
      return;
    }

    const safeFileName = selectedQrPaymentAccount.displayName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    try {
      const response = await fetch(
        getSelectedQrImageActionUrl(true) ?? selectedQrPaymentAccount.qrImageUrl,
      );
      if (!response.ok) {
        throw new Error("DOWNLOAD_FAILED");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${safeFileName || "qr-payment"}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success(t(uiLocale, "orders.toast.qrDownloaded"));
    } catch {
      const fallbackUrl = getSelectedQrImageActionUrl(false) ?? selectedQrPaymentAccount.qrImageUrl;
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      toast(t(uiLocale, "orders.toast.openQrNewTab"));
    }
  }, [getSelectedQrImageActionUrl, selectedQrPaymentAccount, uiLocale]);

  useEffect(() => {
    if (showCheckoutSheet) {
      setShowQrAccountPreview(false);
    }
  }, [showCheckoutSheet]);

  useEffect(() => {
    if (watchedPaymentMethod !== "LAO_QR" || !selectedQrPaymentAccount) {
      setShowQrAccountPreview(false);
      setShowQrImageViewer(false);
    }
  }, [selectedQrPaymentAccount, watchedPaymentMethod]);

  useEffect(() => {
    if (!showQrImageViewer) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowQrImageViewer(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showQrImageViewer]);

  const onChangeProduct = (index: number, productId: string) => {
    const product = productsById.get(productId);
    const nextUnitId = getPreferredUnitId(product);
    const currentQty = Number(form.getValues(`items.${index}.qty`) ?? 0);
    const maxQty = getProductAvailableQty(productId, nextUnitId);
    form.setValue(`items.${index}.productId`, productId, { shouldDirty: true, shouldValidate: true });
    form.setValue(`items.${index}.unitId`, nextUnitId, { shouldDirty: true, shouldValidate: true });
    form.setValue(
      `items.${index}.qty`,
      maxQty > 0 ? Math.min(Math.max(1, Math.trunc(currentQty) || 1), maxQty) : 1,
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const onPickContact = (contactId: string) => {
    form.setValue("contactId", contactId, { shouldDirty: true, shouldValidate: true });
    const contact = contactsById.get(contactId);
    if (contact) {
      form.setValue("customerName", contact.displayName, { shouldDirty: true, shouldValidate: true });
      if (contact.phone) {
        form.setValue("customerPhone", contact.phone, { shouldDirty: true, shouldValidate: true });
      }
    }
  };
  const onSelectOnlineChannelMode = useCallback(
    (nextMode: OnlineChannelMode) => {
      setOnlineChannelMode(nextMode);
      form.setValue("contactId", "", { shouldDirty: true, shouldValidate: true });

      if (nextMode === "FACEBOOK" || nextMode === "WHATSAPP") {
        form.setValue("channel", nextMode, { shouldDirty: true, shouldValidate: true });
        setOnlineOtherChannelInput("");
        return;
      }

      const currentChannel = form.getValues("channel");
      if (currentChannel !== "FACEBOOK" && currentChannel !== "WHATSAPP") {
        form.setValue("channel", "FACEBOOK", { shouldDirty: true, shouldValidate: true });
      }
    },
    [form],
  );
  const applyOnlineQuickFill = useCallback(() => {
    const parsed = parseOnlineQuickCustomerInput(onlineQuickFillInput);
    const changed: string[] = [];

    if (parsed.customerName) {
      form.setValue("customerName", parsed.customerName, { shouldDirty: true, shouldValidate: true });
      changed.push(t(uiLocale, "orders.customer.field.name"));
    }
    if (parsed.customerPhone) {
      form.setValue("customerPhone", parsed.customerPhone, { shouldDirty: true, shouldValidate: true });
      changed.push(t(uiLocale, "orders.customer.field.phone"));
    }
    if (parsed.customerAddress) {
      form.setValue("customerAddress", parsed.customerAddress, { shouldDirty: true, shouldValidate: true });
      changed.push(t(uiLocale, "orders.customer.field.address"));
    }

    if (changed.length <= 0) {
      toast.error(t(uiLocale, "orders.toast.autofill.noData"));
      return;
    }

    form.setValue("contactId", "", { shouldDirty: true, shouldValidate: true });
    form.clearErrors(["contactId", "customerPhone", "customerAddress"]);
    setOnlineQuickFillInput("");
    toast.success(
      `${t(uiLocale, "orders.toast.autofill.success.prefix")} ${changed.join(
        t(uiLocale, "orders.toast.autofill.success.separator"),
      )}`,
    );
  }, [form, onlineQuickFillInput, uiLocale]);
  const onSelectShippingProviderChip = useCallback(
    (provider: string) => {
      setOnlineCustomProviderOpen(false);
      form.setValue("shippingProvider", provider, { shouldDirty: true, shouldValidate: true });
      form.clearErrors("shippingProvider");
    },
    [form],
  );
  const onToggleCustomShippingProvider = useCallback(() => {
    setOnlineCustomProviderOpen(true);
    if (isKnownShippingProvider) {
      form.setValue("shippingProvider", "", { shouldDirty: true, shouldValidate: true });
    }
  }, [form, isKnownShippingProvider]);

  const applyCheckoutFlow = useCallback(
    (nextFlow: CheckoutFlow) => {
      setCheckoutFlow(nextFlow);
      form.setValue("checkoutFlow", nextFlow, { shouldDirty: true, shouldValidate: true });
      form.clearErrors(["contactId", "customerPhone", "customerAddress", "shippingProvider"]);
      if (nextFlow !== "PICKUP_LATER") {
        setPickupLaterCustomerOpen(false);
      }

      if (nextFlow === "ONLINE_DELIVERY") {
        const currentChannel = form.getValues("channel");
        if (currentChannel === "WALK_IN") {
          form.setValue("channel", "FACEBOOK", { shouldDirty: true, shouldValidate: true });
          form.setValue("contactId", "", { shouldDirty: true, shouldValidate: true });
        }
        return;
      }

      form.setValue("channel", "WALK_IN", { shouldDirty: true, shouldValidate: true });
      form.setValue("contactId", "", { shouldDirty: true, shouldValidate: true });
      form.setValue("shippingFeeCharged", 0, { shouldDirty: true, shouldValidate: true });
      form.setValue("shippingCost", 0, { shouldDirty: true, shouldValidate: true });
      setShippingFeeEnabled(false);
      form.setValue("shippingProvider", "", { shouldDirty: true, shouldValidate: true });
      form.setValue("shippingCarrier", "", { shouldDirty: true, shouldValidate: true });

      if (nextFlow === "WALK_IN_NOW") {
        form.setValue("customerName", "", { shouldDirty: true, shouldValidate: true });
        form.setValue("customerPhone", "", { shouldDirty: true, shouldValidate: true });
        form.setValue("customerAddress", "", { shouldDirty: true, shouldValidate: true });
      }

      const currentPaymentMethod = form.getValues("paymentMethod");
      if (currentPaymentMethod === "COD") {
        setCheckoutPaymentMethod("CASH");
      } else if (currentPaymentMethod === "BANK_TRANSFER") {
        setCheckoutPaymentMethod("ON_CREDIT");
      }
    },
    [form, setCheckoutPaymentMethod],
  );

  const addProductFromCatalog = useCallback((productId: string, unitId?: string) => {
    const product = productsById.get(productId);
    if (!product) {
      return null;
    }
    const nextUnitId = unitId ?? getPreferredUnitId(product);
    const availableQty = getProductAvailableQty(productId, nextUnitId);
    if (availableQty <= 0) {
      setScanMessage(
        `${t(uiLocale, "orders.create.scan.productPrefix")} ${product.sku} - ${product.name} ${t(uiLocale, "orders.create.scan.outOfStockOrReserved.suffix")}`,
      );
      const nowMs = Date.now();
      const canShowToast =
        !outOfStockToastRef.current ||
        outOfStockToastRef.current.productId !== productId ||
        nowMs - outOfStockToastRef.current.shownAtMs > 1200;
      if (canShowToast) {
        toast.error(
          `${t(uiLocale, "orders.create.scan.productPrefix")} ${product.name} ${t(uiLocale, "orders.create.scan.outOfStockOrReserved.toastSuffix")}`,
          {
          duration: 1600,
          },
        );
        outOfStockToastRef.current = {
          productId,
          shownAtMs: nowMs,
        };
      }
      return null;
    }

    const existingIndex = watchedItems.findIndex(
      (item) => item.productId === productId && item.unitId === nextUnitId,
    );
    if (existingIndex >= 0) {
      const currentQty = Number(form.getValues(`items.${existingIndex}.qty`) ?? 0);
      if (currentQty >= availableQty) {
        setScanMessage(
          `${t(uiLocale, "orders.create.scan.productPrefix")} ${product.sku} - ${product.name} ${t(uiLocale, "orders.create.scan.maxQty.prefix")} ${availableQty.toLocaleString(numberLocale)} ${t(uiLocale, "orders.create.scan.maxQty.unit")}`,
        );
        return null;
      }
      form.setValue(`items.${existingIndex}.qty`, Math.min(availableQty, Math.max(1, currentQty + 1)), {
        shouldDirty: true,
        shouldValidate: true,
      });
    } else {
      append({
        productId,
        unitId: nextUnitId,
        qty: 1,
      });
    }

    return product;
  }, [
    append,
    form,
    getPreferredUnitId,
    getProductAvailableQty,
    numberLocale,
    productsById,
    uiLocale,
    watchedItems,
  ]);
  const beginAddProductFromCatalog = useCallback(
    (productId: string, source: ProductUnitPickerSource = "quick-add") => {
      const product = productsById.get(productId);
      if (!product) {
        return null;
      }

      const availableUnits = getAvailableSellUnits(product);
      if (availableUnits.length <= 0) {
        return addProductFromCatalog(productId, getPreferredUnitId(product));
      }
      if (availableUnits.length === 1) {
        return addProductFromCatalog(productId, availableUnits[0]?.unitId);
      }

      setProductUnitPicker({ productId, source });
      return null;
    },
    [addProductFromCatalog, getAvailableSellUnits, getPreferredUnitId, productsById],
  );
  const confirmAddProductUnit = useCallback(
    (unitId: string) => {
      if (!productUnitPicker) {
        return;
      }

      const addedProduct = addProductFromCatalog(productUnitPicker.productId, unitId);
      if (addedProduct) {
        setScanMessage(
          `${t(uiLocale, "orders.create.scan.addedProduct.prefix")} ${addedProduct.sku} - ${addedProduct.name} ${t(uiLocale, "orders.create.scan.addedProduct.suffix")}`,
        );
      }
      if (productUnitPicker.source === "manual-search" || productUnitPicker.source === "scanner") {
        setNotFoundBarcode(null);
        setManualSearchKeyword("");
      }
      setProductUnitPicker(null);
    },
    [addProductFromCatalog, productUnitPicker, uiLocale],
  );
  const setItemQty = useCallback(
    (index: number, nextQty: number) => {
      const productId = String(form.getValues(`items.${index}.productId`) ?? "");
      const unitId = String(form.getValues(`items.${index}.unitId`) ?? "");
      const availableQty = getProductAvailableQty(productId, unitId);
      const safeQty = Math.max(1, Math.trunc(nextQty) || 1);
      const boundedQty = availableQty > 0 ? Math.min(safeQty, availableQty) : safeQty;
      if (boundedQty < safeQty && availableQty > 0) {
        const product = productsById.get(productId);
        if (product) {
          setScanMessage(
            `${t(uiLocale, "orders.create.scan.productPrefix")} ${product.sku} - ${product.name} ${t(uiLocale, "orders.create.scan.maxQty.prefix")} ${availableQty.toLocaleString(numberLocale)} ${t(uiLocale, "orders.create.scan.maxQty.unit")}`,
          );
        }
      }
      form.setValue(`items.${index}.qty`, boundedQty, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form, getProductAvailableQty, numberLocale, productsById, uiLocale],
  );
  const increaseItemQty = useCallback(
    (index: number) => {
      const currentQty = Number(form.getValues(`items.${index}.qty`) ?? 0);
      setItemQty(index, currentQty + 1);
    },
    [form, setItemQty],
  );
  const decreaseItemQty = useCallback(
    (index: number) => {
      const currentQty = Number(form.getValues(`items.${index}.qty`) ?? 0);
      setItemQty(index, Math.max(1, currentQty - 1));
    },
    [form, setItemQty],
  );

  const onScanBarcodeResult = (rawCode: string) => {
    const barcode = rawCode.trim();
    if (!barcode) {
      return;
    }

    if (!isCreateOnlyMode) {
      const nextSearchValue = parseOrderSearchValue(barcode);
      if (!nextSearchValue) {
        return;
      }
      setManageSearchInput(nextSearchValue);
      setShowScannerSheet(false);
      setIsManageSearchPending(true);
      startTabTransition(() => {
        router.replace(buildOrdersUrl(activeTab, 1, nextSearchValue), { scroll: false });
      });
      return;
    }

    const keyword = barcode.toLowerCase();
    const matched = catalog.products.find(
      (product) =>
        product.barcode?.toLowerCase() === keyword || product.sku.toLowerCase() === keyword,
    );

    if (matched) {
      const addedProduct = beginAddProductFromCatalog(matched.productId, "scanner");
      if (addedProduct) {
        setScanMessage(
          `${t(uiLocale, "orders.create.scan.addedProduct.prefix")} ${addedProduct.sku} - ${addedProduct.name} ${t(uiLocale, "orders.create.scan.addedProduct.suffix")}`,
        );
      }
      setNotFoundBarcode(null);
      setManualSearchKeyword("");
      setShowScannerSheet(false);
      return;
    }

    setScanMessage(null);
    setNotFoundBarcode(barcode);
    setManualSearchKeyword(barcode);
    setShowScannerSheet(false);
  };

  const pickProductFromManualSearch = (productId: string) => {
    const addedProduct = beginAddProductFromCatalog(productId, "manual-search");
    if (!addedProduct) {
      return;
    }

    setScanMessage(
      `${t(uiLocale, "orders.create.scan.addedProduct.prefix")} ${addedProduct.sku} - ${addedProduct.name} ${t(uiLocale, "orders.create.scan.addedProduct.suffix")}`,
    );
    setNotFoundBarcode(null);
    setManualSearchKeyword("");
  };

  const buildOrdersUrl = useCallback(
    (tab: TabKey, page: number, rawSearchQuery?: string) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      const nextSearchQuery = parseOrderSearchValue(rawSearchQuery ?? activeSearchQuery);

      if (tab === "ALL") {
        nextParams.delete("tab");
      } else {
        nextParams.set("tab", tab);
      }

      if (page <= 1) {
        nextParams.delete("page");
      } else {
        nextParams.set("page", String(page));
      }

      if (nextSearchQuery) {
        nextParams.set("q", nextSearchQuery);
      } else {
        nextParams.delete("q");
      }

      const query = nextParams.toString();
      return query ? `/orders?${query}` : "/orders";
    },
    [activeSearchQuery, searchParams],
  );

  useEffect(() => {
    setPendingTab(null);
  }, [activeTab, ordersPage?.page]);

  useEffect(() => {
    if (isCreateOnlyMode) {
      return;
    }
    setManageSearchInput(activeSearchQuery);
    setIsManageSearchPending(false);
  }, [activeSearchQuery, activeTab, isCreateOnlyMode, ordersPage?.page]);

  const handleTabChange = (tab: TabKey) => {
    if (isCreateOnlyMode) {
      return;
    }

    if (tab === activeTab && (ordersPage?.page ?? 1) === 1) {
      return;
    }

    setPendingTab(tab);
    startTabTransition(() => {
      router.replace(buildOrdersUrl(tab, 1), { scroll: false });
    });
  };

  const applyManageSearch = useCallback(
    (rawValue: string) => {
      if (isCreateOnlyMode) {
        return;
      }

      const nextSearchValue = parseOrderSearchValue(rawValue);
      if (nextSearchValue === activeSearchQuery && (ordersPage?.page ?? 1) === 1) {
        return;
      }

      setManageSearchInput(nextSearchValue);
      setIsManageSearchPending(true);
      startTabTransition(() => {
        router.replace(buildOrdersUrl(activeTab, 1, nextSearchValue), { scroll: false });
      });
    },
    [activeSearchQuery, activeTab, buildOrdersUrl, isCreateOnlyMode, ordersPage?.page, router],
  );

  const tableColumns = useMemo<ColumnDef<OrderListItem>[]>(
    () => {
      const columns: ColumnDef<OrderListItem>[] = [];

      if (isDesktopBulkSelectMode) {
        columns.push({
          id: "select",
          header: () => (
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
              checked={areAllVisibleOrdersSelected}
              disabled={
                quickActionLoadingKey !== null ||
                bulkActionLoadingKey !== null ||
                bulkPrintLoadingKind !== null
              }
              aria-label={t(uiLocale, "orders.management.bulk.selectAllVisible")}
              onChange={() => toggleSelectAllVisibleOrders()}
            />
          ),
          cell: ({ row }) => (
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
              checked={selectedOrderIdSet.has(row.original.id)}
              disabled={
                quickActionLoadingKey !== null ||
                bulkActionLoadingKey !== null ||
                bulkPrintLoadingKind !== null
              }
              aria-label={`${t(uiLocale, "orders.management.bulk.selectOrder")} ${row.original.orderNo}`}
              onChange={() => toggleOrderSelection(row.original.id)}
              onClick={(event) => event.stopPropagation()}
            />
          ),
        });
      }

      columns.push({
        accessorKey: "orderNo",
        header: t(uiLocale, "orders.table.header.orderNo"),
        cell: ({ row }) => (
          <span className="font-medium text-blue-700">{row.original.orderNo}</span>
        ),
      });
      columns.push({
        id: "customer",
        header: t(uiLocale, "orders.table.header.customer"),
        cell: ({ row }) =>
          row.original.customerName ||
          row.original.contactDisplayName ||
          t(uiLocale, "orders.codReconcile.customer.walkIn"),
      });
      columns.push({
        accessorKey: "status",
        header: t(uiLocale, "orders.table.header.status"),
        cell: ({ row }) => {
          const badges = buildOrderStatusBadges(uiLocale, row.original);
          return (
            <div className="flex flex-wrap items-center gap-1">
              {badges.map((badge) => (
                <span key={`${badge.label}-${badge.className}`} className={`rounded-full px-2 py-1 text-xs ${badge.className}`}>
                  {badge.label}
                </span>
              ))}
            </div>
          );
        },
      });
      columns.push({
        id: "channel",
        header: t(uiLocale, "orders.table.header.channel"),
        cell: ({ row }) =>
          `${t(uiLocale, channelSummaryLabelKey(row.original))} • ${row.original.paymentCurrency} • ${t(uiLocale, paymentMethodLabelKey[row.original.paymentMethod])}`,
      });
      columns.push({
        accessorKey: "total",
        header: t(uiLocale, "orders.table.header.total"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-medium tabular-nums">
            {row.original.total.toLocaleString(numberLocale)}{" "}
            {currencySymbol(parseStoreCurrency(catalog.storeCurrency))}
          </span>
        ),
      });
      columns.push({
        id: "nextAction",
        header: t(uiLocale, "orders.table.header.nextAction"),
        cell: ({ row }) => {
          const quickAction = getOrderListQuickAction(row.original, orderQuickActionPermissions);
          const secondaryQuickAction = getOrderListSecondaryQuickAction(
            row.original,
            orderQuickActionPermissions,
          );
          if (!quickAction) {
            return (
              <div className="space-y-1">
                <span className="text-xs text-slate-400">
                  {t(uiLocale, "orders.management.quickAction.none")}
                </span>
                {secondaryQuickAction ? (
                  <p className="text-[11px] text-slate-500">{t(uiLocale, secondaryQuickAction.labelKey)}</p>
                ) : null}
              </div>
            );
          }

          return (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-700">
                {t(uiLocale, quickAction.labelKey)}
              </p>
              {"reasonKey" in quickAction && quickAction.reasonKey ? (
                <p className="text-[11px] text-slate-500">
                  {t(uiLocale, quickAction.reasonKey)}
                </p>
              ) : null}
            </div>
          );
        },
      });
      columns.push({
        id: "actions",
        header: t(uiLocale, "orders.table.header.actions"),
        cell: ({ row }) => {
          const quickAction = getOrderListQuickAction(row.original, orderQuickActionPermissions);
          const secondaryQuickAction = getOrderListSecondaryQuickAction(
            row.original,
            orderQuickActionPermissions,
          );
          const showPackAction = canOpenOrderPackView(row.original);
          const loadingKey = quickAction
            ? buildOrderQuickActionLoadingKey(row.original.id, quickAction.key)
            : null;
          const isBusy = loadingKey !== null && quickActionLoadingKey === loadingKey;
          const secondaryLoadingKey = secondaryQuickAction
            ? buildOrderQuickActionLoadingKey(row.original.id, secondaryQuickAction.key)
            : null;
          const isSecondaryBusy =
            secondaryLoadingKey !== null && quickActionLoadingKey === secondaryLoadingKey;

          return (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {quickAction ? (
                <Button
                  type="button"
                  variant={quickAction.type === "patch" ? "default" : "outline"}
                  className="h-8 px-2 text-xs"
                  disabled={
                    loading ||
                    quickActionLoadingKey !== null ||
                    bulkActionLoadingKey !== null ||
                    bulkPrintLoadingKind !== null
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOrderQuickAction(row.original, quickAction);
                  }}
                >
                  {isBusy
                    ? t(uiLocale, "common.action.saving")
                    : quickAction.type === "detail"
                      ? t(uiLocale, "orders.management.action.viewDetails")
                      : t(uiLocale, quickAction.labelKey)}
                </Button>
              ) : null}
              {secondaryQuickAction ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 border-orange-300 px-2 text-xs text-orange-700 hover:bg-orange-50"
                  disabled={
                    loading ||
                    quickActionLoadingKey !== null ||
                    bulkActionLoadingKey !== null ||
                    bulkPrintLoadingKind !== null
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOrderQuickAction(row.original, secondaryQuickAction);
                  }}
                >
                  {isSecondaryBusy ? t(uiLocale, "common.action.saving") : t(uiLocale, secondaryQuickAction.labelKey)}
                </Button>
              ) : null}
              {showPackAction ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-2 text-xs"
                  disabled={
                    loading ||
                    quickActionLoadingKey !== null ||
                    bulkActionLoadingKey !== null ||
                    bulkPrintLoadingKind !== null ||
                    isOrderPackSheetBusy
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    openOrderPackSheet({ id: row.original.id, orderNo: row.original.orderNo });
                  }}
                >
                  {t(uiLocale, "orders.detail.actions.packView")}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-lg border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                disabled={
                  bulkActionLoadingKey !== null ||
                  bulkPrintLoadingKind !== null ||
                  isOrderPackSheetBusy
                }
                onClick={(event) => {
                  event.stopPropagation();
                  router.push(`/orders/${row.original.id}`);
                }}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                {t(uiLocale, "orders.management.action.open")}
              </Button>
            </div>
          );
        },
      });

      return columns;
    },
    [
      areAllVisibleOrdersSelected,
      buildOrderQuickActionLoadingKey,
      bulkActionLoadingKey,
      bulkPrintLoadingKind,
      catalog.storeCurrency,
      handleOrderQuickAction,
      isDesktopBulkSelectMode,
      loading,
      numberLocale,
      orderQuickActionPermissions,
      quickActionLoadingKey,
      router,
      selectedOrderIdSet,
      isOrderPackSheetBusy,
      openOrderPackSheet,
      toggleOrderSelection,
      toggleSelectAllVisibleOrders,
      uiLocale,
    ],
  );

  const ordersTable = useReactTable({
    data: visibleOrders,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const submitOrder = form.handleSubmit(async (values) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setCreatedOrderSuccess(null);
    form.clearErrors(["customerPhone", "customerAddress", "shippingProvider"]);

    const normalizedCustomerName = values.customerName?.trim();
    const normalizedCustomerPhone = values.customerPhone?.trim() ?? "";
    const normalizedCustomerAddress = values.customerAddress?.trim() ?? "";
    const normalizedShippingProvider = values.shippingProvider?.trim() ?? "";
    const normalizedChannel =
      checkoutFlow === "ONLINE_DELIVERY"
        ? values.channel === "WALK_IN"
          ? "FACEBOOK"
          : values.channel
        : "WALK_IN";
    const normalizedPaymentMethodBase =
      values.paymentMethod === "BANK_TRANSFER" ? "ON_CREDIT" : (values.paymentMethod ?? "CASH");
    const normalizedPaymentMethod =
      checkoutFlow !== "ONLINE_DELIVERY" && normalizedPaymentMethodBase === "COD"
        ? "CASH"
        : normalizedPaymentMethodBase;
    const submittedCheckoutFlow = checkoutFlow;

    if (requiresCustomerPhone && !normalizedCustomerPhone) {
      form.setError("customerPhone", {
        type: "manual",
        message: t(uiLocale, "orders.validation.customerPhoneRequired"),
      });
      return;
    }

    if (checkoutFlow === "ONLINE_DELIVERY" && !normalizedCustomerAddress) {
      form.setError("customerAddress", {
        type: "manual",
        message: t(uiLocale, "orders.validation.addressRequired"),
      });
      return;
    }

    if (checkoutFlow === "ONLINE_DELIVERY" && !normalizedShippingProvider) {
      form.setError("shippingProvider", {
        type: "manual",
        message: t(uiLocale, "orders.validation.shippingProviderRequired"),
      });
      return;
    }

    setLoading(true);

    const fallbackCustomerName =
      checkoutFlow === "PICKUP_LATER"
        ? t(uiLocale, "orders.customer.pickupDefault")
        : normalizedChannel === "WALK_IN"
          ? t(uiLocale, "orders.customer.walkInDefault")
          : t(uiLocale, "orders.customer.onlineDefault");
    const payload: CreateOrderInput = {
      ...values,
      channel: normalizedChannel,
      contactId: checkoutFlow === "ONLINE_DELIVERY" ? values.contactId : "",
      checkoutFlow,
      customerPhone: normalizedCustomerPhone,
      customerAddress: checkoutFlow === "ONLINE_DELIVERY" ? normalizedCustomerAddress : "",
      shippingProvider: checkoutFlow === "ONLINE_DELIVERY" ? normalizedShippingProvider : "",
      shippingCarrier: "",
      shippingFeeCharged: checkoutFlow === "ONLINE_DELIVERY" ? values.shippingFeeCharged : 0,
      shippingCost: checkoutFlow === "ONLINE_DELIVERY" ? values.shippingCost : 0,
      paymentMethod: normalizedPaymentMethod,
      customerName: normalizedCustomerName || fallbackCustomerName,
    };

    const response = await authFetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as
      | {
          message?: string;
          orderId?: string;
          orderNo?: string;
        }
      | null;

    if (!response.ok) {
      setErrorMessage(data?.message ?? t(uiLocale, "orders.error.createFailed"));
      setLoading(false);
      return;
    }

    setSuccessMessage(
      `${t(uiLocale, "orders.create.success.prefix")} ${data?.orderNo ?? ""} ${t(uiLocale, "orders.create.success.suffix")}`,
    );
    setShowCartSheet(false);
    setShowCheckoutSheet(false);
    setShowCheckoutCloseConfirm(false);
    setPickupLaterCustomerOpen(false);
    setDiscountEnabled(false);
    setShippingFeeEnabled(false);
    setDiscountInputMode("AMOUNT");
    setDiscountPercentInput("");
    setCreateStep("products");
    form.reset(defaultValues(catalog));
    setCheckoutFlow("WALK_IN_NOW");
    clearNewOrderDraftState();
    setLoading(false);

    if (data?.orderId) {
      setCreatedOrderSuccess({
        orderId: data.orderId,
        orderNo: data.orderNo?.trim() || data.orderId,
        checkoutFlow: submittedCheckoutFlow,
      });
      router.refresh();
      return;
    }

    router.refresh();
  });

  const closeCreatedOrderSuccess = useCallback(() => {
    setCreatedOrderSuccess(null);
    setReceiptPreviewOrder(null);
    setReceiptPreviewError(null);
    setReceiptPreviewLoading(false);
    setReceiptPrintLoading(false);
    setShippingLabelPrintLoading(false);
    setSuccessMessage(null);
  }, []);

  const fetchRecentOrders = useCallback(async () => {
    if (!isCreateOnlyMode) {
      return;
    }

    setRecentOrdersLoading(true);
    setRecentOrdersError(null);
    try {
      const response = await authFetch(
        `/api/orders?page=1&pageSize=${CREATE_ONLY_RECENT_ORDERS_LIMIT}`,
      );
      const data = (await response.json().catch(() => null)) as RecentOrdersApiResponse | null;
      if (!response.ok) {
        throw new Error(data?.message ?? t(uiLocale, "orders.create.recentOrders.error.loadFailed"));
      }
      if (!Array.isArray(data?.orders)) {
        throw new Error(t(uiLocale, "orders.create.recentOrders.error.invalidData"));
      }
      const mappedOrders = data.orders.slice(0, CREATE_ONLY_RECENT_ORDERS_LIMIT).map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        checkoutFlow: inferCheckoutFlowFromOrderListItem(order),
        status: order.status,
        createdAt: order.createdAt,
        total: order.total,
        paymentCurrency: order.paymentCurrency,
        paymentMethod: order.paymentMethod,
      }));
      setRecentOrders(mappedOrders);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t(uiLocale, "orders.create.recentOrders.error.loadFailed");
      setRecentOrdersError(message);
      setRecentOrders([]);
    } finally {
      setRecentOrdersLoading(false);
    }
  }, [isCreateOnlyMode, uiLocale]);

  const openRecentOrderSummary = useCallback((order: RecentOrderItem) => {
    setShowRecentOrdersSheet(false);
    setSuccessMessage(null);
    setErrorMessage(null);
    setCreatedOrderSuccess({
      orderId: order.id,
      orderNo: order.orderNo,
      checkoutFlow: order.checkoutFlow,
    });
  }, []);

  const openRecentOrderCancelModal = useCallback(
    (order: RecentOrderItem) => {
      if (!canRequestCancel || !CANCELLABLE_ORDER_STATUSES.has(order.status)) {
        return;
      }
      setErrorMessage(null);
      setSuccessMessage(null);
      setCancelApprovalTargetOrder(order);
    },
    [canRequestCancel],
  );

  const cancelRecentOrderWithApproval = useCallback(
    async (payload: ManagerCancelApprovalPayload): Promise<ManagerCancelApprovalResult> => {
      if (!cancelApprovalTargetOrder) {
        return { ok: false, message: t(uiLocale, "orders.cancel.error.notFound") };
      }

      setCancelApprovalSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        const response = await authFetch(`/api/orders/${cancelApprovalTargetOrder.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "cancel",
            ...(payload.approvalEmail ? { approvalEmail: payload.approvalEmail } : {}),
            ...(payload.approvalPassword
              ? { approvalPassword: payload.approvalPassword }
              : {}),
            cancelReason: payload.cancelReason,
            approvalMode: payload.approvalMode,
            ...(payload.confirmBySlide ? { confirmBySlide: true } : {}),
          }),
        });
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        if (!response.ok) {
          const message = data?.message ?? t(uiLocale, "orders.cancel.error.failed");
          setErrorMessage(message);
          return { ok: false, message };
        }

        setSuccessMessage(
          `${t(uiLocale, "orders.cancel.success.prefix")} ${cancelApprovalTargetOrder.orderNo} ${t(uiLocale, "orders.cancel.success.suffix")}`,
        );
        setCancelApprovalTargetOrder(null);
        await fetchRecentOrders();
        router.refresh();
        return { ok: true };
      } catch {
        const message = t(uiLocale, "orders.cancel.error.failed");
        setErrorMessage(message);
        return { ok: false, message };
      } finally {
        setCancelApprovalSubmitting(false);
      }
    },
    [cancelApprovalTargetOrder, fetchRecentOrders, router, uiLocale],
  );

  const fetchOrderReceiptPreview = useCallback(async (orderId: string) => {
    const response = await authFetch(`/api/orders/${orderId}`);
    const data = (await response.json().catch(() => null)) as OrderDetailApiResponse | null;
    if (!response.ok || !data?.order) {
      throw new Error(data?.message ?? t(uiLocale, "orders.print.error.loadReceiptData"));
    }
    return data.order;
  }, [uiLocale]);
  const fetchOrderPackPreview = useCallback(async (orderId: string) => {
    const response = await authFetch(`/api/orders/${orderId}`);
    const data = (await response.json().catch(() => null)) as OrderDetailApiResponse | null;
    if (!response.ok || !data?.order) {
      throw new Error(data?.message ?? t(uiLocale, "orders.print.error.loadPackData"));
    }
    return data.order;
  }, [uiLocale]);

  const mergePrintDocuments = useCallback(
    (documents: string[], kind: BulkPrintKind) => {
      if (documents.length <= 0) {
        throw new Error(
          kind === "receipt"
            ? t(uiLocale, "orders.management.bulk.print.error.noReceipts")
            : kind === "label"
              ? t(uiLocale, "orders.management.bulk.print.error.noLabels")
              : t(uiLocale, "orders.management.bulk.print.error.noPacks"),
        );
      }

      const parsedDocuments = documents.map((documentHtml) =>
        new DOMParser().parseFromString(documentHtml, "text/html"),
      );
      const styles = parsedDocuments
        .flatMap((documentNode) =>
          Array.from(documentNode.querySelectorAll("style")).map(
            (styleNode) => styleNode.textContent ?? "",
          ),
        )
        .filter((styleText) => styleText.trim().length > 0);
      const bodyMarkup = parsedDocuments
        .map((documentNode, index) => {
          const innerMarkup = documentNode.body?.innerHTML?.trim() ?? "";
          return `<section class="bulk-print-batch-item" data-batch-index="${index}">${innerMarkup}</section>`;
        })
        .join("");

      return `<!doctype html>
<html lang="${escapeHtml(uiLocale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(
      kind === "receipt"
        ? t(uiLocale, "orders.management.bulk.print.receipts")
        : kind === "label"
          ? t(uiLocale, "orders.management.bulk.print.labels")
          : t(uiLocale, "orders.management.bulk.print.packs"),
    )}</title>
    <style>
      ${styles.join("\n")}
      .bulk-print-batch-item {
        page-break-after: always;
        break-after: page;
      }
      .bulk-print-batch-item:last-child {
        page-break-after: auto;
        break-after: auto;
      }
    </style>
  </head>
  <body>
    ${bodyMarkup}
  </body>
</html>`;
    },
    [uiLocale],
  );

  const buildReceiptPrintHtml = useCallback((order: ReceiptPreviewOrder, paymentQrImageSrcOverride?: string | null) => {
    const receiptDateText = new Date(order.createdAt).toLocaleString(numberLocale);
    const receiptCustomerName =
      order.customerName || order.contactDisplayName || t(uiLocale, "orders.customer.guest");
    const paymentQrImageSrc =
      paymentQrImageSrcOverride ??
      (order.paymentAccountId && order.paymentAccountQrImageUrl
        ? `/api/orders/payment-accounts/${order.paymentAccountId}/qr-image`
        : order.paymentAccountQrImageUrl);
    const rowsHtml = order.items
      .map((item) => {
        const productName = escapeHtml(item.productName);
        const productSku = escapeHtml(item.productSku || "-");
        const qtyText = `${item.qty.toLocaleString(numberLocale)} ${escapeHtml(item.unitCode)}`;
        const lineTotalText = item.lineTotal.toLocaleString(numberLocale);
        return `<tr>
  <td class="col-item"><div>${productName}</div><div class="sku">${productSku}</div></td>
  <td class="col-qty">${qtyText}</td>
  <td class="col-total">${lineTotalText}</td>
</tr>`;
      })
      .join("");

    return `<!doctype html>
<html lang="${escapeHtml(uiLocale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(t(uiLocale, "orders.print.receipt.title"))} ${escapeHtml(order.orderNo)}</title>
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #ffffff;
        color: #0f172a;
        font-family: ui-sans-serif, -apple-system, "Segoe UI", sans-serif;
        font-size: 11px;
        line-height: 1.35;
      }
      .receipt {
        width: 72mm;
        margin: 0 auto;
        padding: 2mm 0;
      }
      .center { text-align: center; }
      .title { font-weight: 700; font-size: 12px; margin: 0; }
      .meta { margin: 2px 0 0; font-size: 10px; }
      .sep { border-top: 1px dashed #64748b; margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; }
      th { text-align: left; font-size: 10px; font-weight: 600; padding-bottom: 3px; }
      td { vertical-align: top; padding: 2px 0; }
      .col-item { width: 52%; }
      .sku { color: #475569; font-size: 10px; }
      .col-qty { width: 22%; text-align: right; white-space: nowrap; }
      .col-total { width: 26%; text-align: right; white-space: nowrap; }
      .totals-row { display: flex; justify-content: space-between; margin: 2px 0; }
      .totals-main { font-weight: 700; font-size: 12px; }
      .muted { color: #475569; }
      .qr-block { text-align: center; }
      .qr-title { margin: 0; font-size: 11px; font-weight: 700; }
      .qr-hint { margin: 4px 0 0; font-size: 10px; color: #475569; }
      .qr-image { display: block; width: 112px; height: 112px; margin: 8px auto 0; object-fit: contain; }
      .qr-meta { margin-top: 6px; text-align: left; font-size: 10px; line-height: 1.45; }
      .qr-meta p { margin: 2px 0 0; }
      .qr-meta p:first-child { margin-top: 0; }
      .thanks { text-align: center; margin-top: 6px; font-size: 10px; }
    </style>
  </head>
  <body>
    <main class="receipt">
      <p class="title center">${escapeHtml(t(uiLocale, "orders.print.receipt.title"))}</p>
      <p class="meta center">${escapeHtml(t(uiLocale, "orders.print.receipt.noPrefix"))} ${escapeHtml(order.orderNo)}</p>
      <div class="sep"></div>

      <div>${escapeHtml(t(uiLocale, "orders.print.receipt.customerPrefix"))} ${escapeHtml(receiptCustomerName)}</div>
      <div>${escapeHtml(t(uiLocale, "orders.print.receipt.datePrefix"))} ${escapeHtml(receiptDateText)}</div>

      <div class="sep"></div>

      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t(uiLocale, "orders.print.receipt.table.item"))}</th>
            <th style="text-align:right;">${escapeHtml(t(uiLocale, "orders.print.receipt.table.qty"))}</th>
            <th style="text-align:right;">${escapeHtml(t(uiLocale, "orders.print.receipt.table.total"))}</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="sep"></div>

      <div class="totals-row"><span>${escapeHtml(t(uiLocale, "orders.print.receipt.summary.subtotal"))}</span><span>${order.subtotal.toLocaleString(numberLocale)}</span></div>
      <div class="totals-row"><span>${escapeHtml(t(uiLocale, "orders.print.receipt.summary.discount"))}</span><span>${order.discount.toLocaleString(numberLocale)}</span></div>
      <div class="totals-row"><span>${escapeHtml(t(uiLocale, "orders.print.receipt.summary.vat"))}</span><span>${order.vatAmount.toLocaleString(numberLocale)} (${escapeHtml(vatModeLabel(uiLocale, order.storeVatMode))})</span></div>
      <div class="totals-row"><span>${escapeHtml(t(uiLocale, "orders.print.receipt.summary.shipping"))}</span><span>${order.shippingFeeCharged.toLocaleString(numberLocale)}</span></div>
      <div class="totals-row totals-main"><span>${escapeHtml(t(uiLocale, "orders.print.receipt.summary.netTotal"))}</span><span>${order.total.toLocaleString(numberLocale)} ${escapeHtml(order.storeCurrency)}</span></div>
      <div class="totals-row muted"><span>${escapeHtml(t(uiLocale, "orders.print.receipt.summary.paymentCurrency"))}</span><span>${escapeHtml(currencyLabel(order.paymentCurrency))}</span></div>
      <div class="totals-row muted"><span>${escapeHtml(t(uiLocale, "orders.print.receipt.summary.paymentMethod"))}</span><span>${escapeHtml(t(uiLocale, paymentMethodLabelKey[order.paymentMethod]))}</span></div>
      ${
        paymentQrImageSrc
          ? `
      <div class="sep"></div>
      <div class="qr-block">
        <p class="qr-title">${escapeHtml(t(uiLocale, "orders.print.receipt.qrTitle"))}</p>
        <p class="qr-hint">${escapeHtml(t(uiLocale, "orders.print.receipt.qrHint"))}</p>
        <img class="qr-image" src="${escapeHtml(paymentQrImageSrc)}" alt="${escapeHtml(t(uiLocale, "orders.print.receipt.qrTitle"))}" />
        <div class="qr-meta">
          ${
            order.paymentAccountDisplayName
              ? `<p>${escapeHtml(order.paymentAccountDisplayName)}</p>`
              : ""
          }
          ${
            order.paymentAccountBankName
              ? `<p>${escapeHtml(t(uiLocale, "orders.create.paymentAccount.details.bankPrefix"))} ${escapeHtml(order.paymentAccountBankName)}</p>`
              : ""
          }
          ${
            order.paymentAccountNumber
              ? `<p>${escapeHtml(t(uiLocale, "orders.create.paymentAccount.details.accountNumberLabel"))}: ${escapeHtml(order.paymentAccountNumber)}</p>`
              : ""
          }
        </div>
      </div>`
          : ""
      }

      <div class="sep"></div>
      <p class="thanks">${escapeHtml(t(uiLocale, "orders.print.receipt.thanks"))}</p>
    </main>
  </body>
</html>`;
  }, [numberLocale, uiLocale]);

  const buildShippingLabelPrintHtml = useCallback((order: OrderDetail) => {
    const labelMarkup = buildShippingLabelPrintMarkup({
      order,
      uiLocale,
      numberLocale,
      storeCurrencyDisplay: order.storeCurrency,
    });

    return `<!doctype html>
<html lang="${escapeHtml(uiLocale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(t(uiLocale, "orders.print.label.title"))} ${escapeHtml(order.orderNo)}</title>
    <style>
      @page { size: 100mm 150mm; margin: 0; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #ffffff;
        color: #0f172a;
        font-family: ${printFontFamily};
      }
      .print-label {
        width: 100mm;
        margin: 0 auto;
        min-height: 150mm;
        padding: 4mm;
        font-size: 14px;
        line-height: 1.35;
      }
    </style>
  </head>
  <body>
    ${labelMarkup}
  </body>
</html>`;
  }, [numberLocale, printFontFamily, uiLocale]);

  const buildPackPrintHtml = useCallback((order: OrderDetail) => {
    const orderFlowLabel =
      order.channel === "WALK_IN"
        ? order.status === "READY_FOR_PICKUP" || order.status === "PICKED_UP_PENDING_PAYMENT"
          ? t(uiLocale, "orders.flow.PICKUP_LATER")
          : t(uiLocale, "orders.flow.WALK_IN_NOW")
        : t(uiLocale, "orders.flow.ONLINE_DELIVERY");
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
            <span style="font-weight:700;">${(order.codAmount > 0 ? order.codAmount : order.total).toLocaleString(numberLocale)} ${escapeHtml(order.storeCurrency)}</span>
          </div>`
        : "";

    return `<!doctype html>
<html lang="${escapeHtml(uiLocale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(t(uiLocale, "orders.pack.page.title"))} ${escapeHtml(order.orderNo)}</title>
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #ffffff;
        color: #0f172a;
        font-family: ${printFontFamily};
        font-size: 11px;
        line-height: 1.35;
      }
      .pack {
        width: 72mm;
        margin: 0 auto;
        padding: 2mm 0;
      }
    </style>
  </head>
  <body>
    <section class="pack">
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
  </body>
</html>`;
  }, [numberLocale, printFontFamily, uiLocale]);

  const printDocumentViaWindow = useCallback((html: string, kind: "receipt" | "label" | "pack") => {
    if (typeof window === "undefined") {
      return;
    }

    const printRootId = "orders-create-inline-print-root";
    const printStyleId = "orders-create-inline-print-style";
    document.getElementById(printRootId)?.remove();
    document.getElementById(printStyleId)?.remove();
    document
      .querySelectorAll<HTMLIFrameElement>('iframe[data-order-print-frame="true"]')
      .forEach((existingFrame) => existingFrame.remove());

    const parsed = new DOMParser().parseFromString(html, "text/html");
    const bodyMarkup = parsed.body?.innerHTML?.trim() || html;
    const collectedStyles = Array.from(parsed.querySelectorAll("style"))
      .map((styleNode) => styleNode.textContent ?? "")
      .filter((styleText) => styleText.trim().length > 0)
      .join("\n");

    const printRoot = document.createElement("div");
    printRoot.id = printRootId;
    printRoot.setAttribute("aria-hidden", "true");
    printRoot.innerHTML = bodyMarkup;

    const printStyle = document.createElement("style");
    printStyle.id = printStyleId;
    printStyle.textContent = `
      ${collectedStyles}
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
          position: static !important;
          top: 0 !important;
          left: 0 !important;
          right: auto !important;
          width: auto !important;
          overflow: visible !important;
        }
        body > *:not(#${printRootId}) {
          display: none !important;
        }
        #${printRootId} {
          display: block !important;
        }
      }
    `;

    document.head.appendChild(printStyle);
    document.body.appendChild(printRoot);

    const cleanup = () => {
      printRoot.remove();
      printStyle.remove();
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
        setShippingLabelPrintLoading(false);
      } else {
        setOrderPackPrintLoading(false);
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
        void waitForImagesBeforePrint(printRoot)
          .catch(() => undefined)
          .then(() => {
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
    });
  }, [uiLocale]);

  const openOrderReceiptPrint = useCallback(
    async (orderId: string) => {
      if (typeof window === "undefined") {
        return;
      }

      setErrorMessage(null);
      setReceiptPrintLoading(true);

      const order = receiptPreviewOrder && receiptPreviewOrder.id === orderId ? receiptPreviewOrder : null;
      if (!order) {
        setReceiptPrintLoading(false);
        setErrorMessage(t(uiLocale, "orders.print.error.receiptPreviewNotReady"));
        return;
      }

      try {
        const paymentQrImageSrc =
          order.paymentAccountQrImageUrl
            ? await fetchImageAsDataUrl(
                order.paymentAccountId
                  ? `/api/orders/payment-accounts/${order.paymentAccountId}/qr-image`
                  : order.paymentAccountQrImageUrl,
              ).catch(() =>
                order.paymentAccountId
                  ? `/api/orders/payment-accounts/${order.paymentAccountId}/qr-image`
                  : order.paymentAccountQrImageUrl,
              )
            : null;
        printDocumentViaWindow(buildReceiptPrintHtml(order, paymentQrImageSrc), "receipt");
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : t(uiLocale, "orders.print.error.receiptPrintFailed");
        setErrorMessage(message);
        setReceiptPrintLoading(false);
      }
    },
    [buildReceiptPrintHtml, printDocumentViaWindow, receiptPreviewOrder, uiLocale],
  );

  const openCreatedOrderDetail = useCallback(
    (orderId: string) => {
      setCreatedOrderSuccess(null);
      setReceiptPreviewOrder(null);
      setReceiptPreviewError(null);
      setReceiptPreviewLoading(false);
      setReceiptPrintLoading(false);
      setShippingLabelPrintLoading(false);
      setSuccessMessage(null);
      router.push(`/orders/${orderId}`);
    },
    [router],
  );

  const openOrderShippingLabelPrint = useCallback(
    (orderId: string) => {
      if (typeof window === "undefined") {
        return;
      }
      setErrorMessage(null);
      setShippingLabelPrintLoading(true);
      const order = receiptPreviewOrder && receiptPreviewOrder.id === orderId ? receiptPreviewOrder : null;
      if (!order) {
        setShippingLabelPrintLoading(false);
        setErrorMessage(t(uiLocale, "orders.print.error.labelPreviewNotReady"));
        return;
      }

      try {
        printDocumentViaWindow(buildShippingLabelPrintHtml(order), "label");
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : t(uiLocale, "orders.print.error.labelPrintFailed");
        setErrorMessage(message);
        setShippingLabelPrintLoading(false);
      }
    },
    [
      buildShippingLabelPrintHtml,
      printDocumentViaWindow,
      receiptPreviewOrder,
      uiLocale,
    ],
  );
  const handlePrintOrderPackFromList = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!orderPackPreview) {
      setErrorMessage(t(uiLocale, "orders.print.error.packPreviewLoadFailed"));
      return;
    }

    setErrorMessage(null);
    setOrderPackPrintLoading(true);
    setShowOrderPackSheet(null);

    window.setTimeout(() => {
      try {
        printDocumentViaWindow(buildPackPrintHtml(orderPackPreview), "pack");
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : t(uiLocale, "orders.print.error.packPrintFailed");
        setErrorMessage(message);
        setOrderPackPrintLoading(false);
      }
    }, 280);
  }, [buildPackPrintHtml, orderPackPreview, printDocumentViaWindow, uiLocale]);

  const runBulkPrint = useCallback(
    async (kind: BulkPrintKind) => {
      const sourceOrders =
        kind === "receipt"
          ? selectedReceiptPrintOrders
          : kind === "label"
            ? selectedLabelPrintOrders
            : selectedPackPrintOrders;
      if (sourceOrders.length <= 0) {
        const message =
          kind === "receipt"
            ? t(uiLocale, "orders.management.bulk.print.error.noReceipts")
            : kind === "label"
              ? t(uiLocale, "orders.management.bulk.print.error.noLabels")
              : t(uiLocale, "orders.management.bulk.print.error.noPacks");
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      setBulkPrintLoadingKind(kind);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        if (kind === "pack") {
          const previewOrders = await Promise.all(
            sourceOrders.map((order) => fetchOrderPackPreview(order.id)),
          );
          const mergedHtml = mergePrintDocuments(
            previewOrders.map((order) => buildPackPrintHtml(order)),
            kind,
          );
          setOrderPackPrintLoading(true);
          printDocumentViaWindow(mergedHtml, kind);
          return;
        }

        const previewOrders = await Promise.all(
          sourceOrders.map((order) => fetchOrderReceiptPreview(order.id)),
        );
        const printableOrders =
          kind === "receipt"
            ? previewOrders
            : previewOrders.filter(
                (order) =>
                  Boolean(
                    order.customerAddress ||
                      order.shippingProvider ||
                      order.shippingCarrier ||
                      order.trackingNo,
                  ),
              );

        if (printableOrders.length <= 0) {
          throw new Error(t(uiLocale, "orders.management.bulk.print.error.noPrintableLabels"));
        }

        const mergedHtml =
          kind === "receipt"
            ? mergePrintDocuments(
                await Promise.all(
                  printableOrders.map(async (order) => {
                    const paymentQrImageSrc =
                      order.paymentAccountQrImageUrl
                        ? await fetchImageAsDataUrl(
                            order.paymentAccountId
                              ? `/api/orders/payment-accounts/${order.paymentAccountId}/qr-image`
                              : order.paymentAccountQrImageUrl,
                          ).catch(() =>
                            order.paymentAccountId
                              ? `/api/orders/payment-accounts/${order.paymentAccountId}/qr-image`
                              : order.paymentAccountQrImageUrl,
                          )
                        : null;
                    return buildReceiptPrintHtml(order, paymentQrImageSrc);
                  }),
                ),
                kind,
              )
            : mergePrintDocuments(
                printableOrders.map((order) => buildShippingLabelPrintHtml(order)),
                kind,
              );

        if (kind === "receipt") {
          setReceiptPrintLoading(true);
        } else {
          setShippingLabelPrintLoading(true);
        }

        printDocumentViaWindow(mergedHtml, kind);
      } catch (error) {
        const fallbackMessage =
          kind === "receipt"
            ? t(uiLocale, "orders.management.bulk.print.error.receiptFailed")
            : kind === "label"
              ? t(uiLocale, "orders.management.bulk.print.error.labelFailed")
              : t(uiLocale, "orders.management.bulk.print.error.packFailed");
        const message =
          error instanceof Error && error.message ? error.message : fallbackMessage;
        setErrorMessage(message);
        toast.error(message);
        if (kind === "receipt") {
          setReceiptPrintLoading(false);
        } else if (kind === "label") {
          setShippingLabelPrintLoading(false);
        } else {
          setOrderPackPrintLoading(false);
        }
      } finally {
        setBulkPrintLoadingKind(null);
      }
    },
    [
      buildPackPrintHtml,
      buildReceiptPrintHtml,
      buildShippingLabelPrintHtml,
      fetchOrderPackPreview,
      fetchOrderReceiptPreview,
      mergePrintDocuments,
      printDocumentViaWindow,
      selectedPackPrintOrders,
      selectedLabelPrintOrders,
      selectedReceiptPrintOrders,
      uiLocale,
    ],
  );

  const openCheckoutSheet = () => {
    if (watchedItems.length <= 0) {
      return;
    }
    setCreateStep("details");
    setShowCartSheet(false);
    setShowCheckoutCloseConfirm(false);
    setPickupLaterCustomerOpen(false);
    setDiscountPercentInput("");
    setShowCheckoutSheet(true);
  };
  const closeCheckoutSheet = useCallback(() => {
    setShowCheckoutCloseConfirm(false);
    setShowCheckoutSheet(false);
    setCreateStep("products");
  }, []);
  const requestCloseCheckoutSheet = useCallback(() => {
    if (loading) {
      return;
    }

    if (hasCheckoutDraftInput) {
      setShowCheckoutCloseConfirm(true);
      return;
    }

    closeCheckoutSheet();
  }, [closeCheckoutSheet, hasCheckoutDraftInput, loading]);

  useEffect(() => {
    if (!createdOrderSuccess) {
      setReceiptPreviewOrder(null);
      setReceiptPreviewError(null);
      setReceiptPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setReceiptPreviewLoading(true);
    setReceiptPreviewError(null);

    fetchOrderReceiptPreview(createdOrderSuccess.orderId)
      .then((order) => {
        if (cancelled) {
          return;
        }
        setReceiptPreviewOrder(order);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error && error.message
            ? error.message
            : t(uiLocale, "orders.print.error.receiptPreviewLoadFailed");
        setReceiptPreviewError(message);
        setReceiptPreviewOrder(null);
      })
      .finally(() => {
        if (!cancelled) {
          setReceiptPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [createdOrderSuccess, fetchOrderReceiptPreview, uiLocale]);

  useEffect(() => {
    if (!showOrderPackSheet) {
      setOrderPackPreview(null);
      setOrderPackPreviewError(null);
      setOrderPackPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setOrderPackPreviewLoading(true);
    setOrderPackPreviewError(null);

    fetchOrderPackPreview(showOrderPackSheet.orderId)
      .then((order) => {
        if (cancelled) {
          return;
        }
        setOrderPackPreview(order);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error && error.message
            ? error.message
            : t(uiLocale, "orders.print.error.packPreviewLoadFailed");
        setOrderPackPreviewError(message);
        setOrderPackPreview(null);
      })
      .finally(() => {
        if (!cancelled) {
          setOrderPackPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchOrderPackPreview, showOrderPackSheet, uiLocale]);

  useEffect(() => {
    if (!showRecentOrdersSheet) {
      return;
    }
    void fetchRecentOrders();
  }, [fetchRecentOrders, showRecentOrdersSheet]);

  useEffect(() => {
    if (!isCreateOnlyMode) {
      setHasInitializedDraftRestore(true);
      return;
    }
    if (hasInitializedDraftRestore) {
      return;
    }

    const savedDraft = getNewOrderDraftPayload({
      maxAgeMs: NEW_ORDER_DRAFT_DEFAULT_MAX_AGE_MS,
    });
    if (!savedDraft) {
      setHasInitializedDraftRestore(true);
      return;
    }

    const restored = restoreDraftFormForCatalog(savedDraft);
    if (!restored) {
      clearNewOrderDraftState();
      setHasInitializedDraftRestore(true);
      return;
    }

    form.reset(restored);
    setCheckoutFlow(savedDraft.checkoutFlow);
    setScanMessage(t(uiLocale, "orders.create.draftRestore.notice"));
    setNewOrderDraftFlag(true);
    setHasInitializedDraftRestore(true);
  }, [
    form,
    hasInitializedDraftRestore,
    isCreateOnlyMode,
    restoreDraftFormForCatalog,
    uiLocale,
  ]);

  useEffect(() => {
    if (!isCreateOnlyMode || !hasInitializedDraftRestore) {
      return;
    }

    const normalizedItems = watchedItems
      .map((item) => {
        const productId = String(item.productId ?? "").trim();
        const unitId = String(item.unitId ?? "").trim();
        const qty = Math.max(1, Math.trunc(Number(item.qty) || 0));
        if (!productId || !unitId || qty <= 0) {
          return null;
        }
        return { productId, unitId, qty };
      })
      .filter(
        (
          item,
        ): item is {
          productId: string;
          unitId: string;
          qty: number;
        } => item !== null,
      );

    const hasDraft = normalizedItems.length > 0;
    setNewOrderDraftFlag(hasDraft);

    if (!hasDraft) {
      clearNewOrderDraftPayload();
      return;
    }

    const draftPayload: NewOrderDraftPayload = {
      checkoutFlow,
      form: {
        channel:
          watchedChannel === "FACEBOOK" || watchedChannel === "WHATSAPP"
            ? watchedChannel
            : "WALK_IN",
        contactId: watchedContactId,
        customerName: watchedCustomerName,
        customerPhone: watchedCustomerPhone,
        customerAddress: watchedCustomerAddress,
        shippingProvider: watchedShippingProvider,
        shippingCarrier: "",
        discount: Math.max(0, Math.trunc(Number(watchedDiscount) || 0)),
        shippingFeeCharged: Math.max(0, Math.trunc(Number(watchedShippingFeeCharged) || 0)),
        shippingCost: Math.max(0, Math.trunc(Number(watchedShippingCost) || 0)),
        paymentCurrency:
          watchedPaymentCurrency === "THB" || watchedPaymentCurrency === "USD"
            ? watchedPaymentCurrency
            : "LAK",
        paymentMethod:
          watchedPaymentMethod === "BANK_TRANSFER"
            ? "ON_CREDIT"
            : watchedPaymentMethod === "LAO_QR" ||
                watchedPaymentMethod === "ON_CREDIT" ||
                watchedPaymentMethod === "COD"
              ? watchedPaymentMethod
              : "CASH",
        paymentAccountId: watchedPaymentAccountId,
        items: normalizedItems,
      },
    };

    setNewOrderDraftPayload(draftPayload);
  }, [
    checkoutFlow,
    hasInitializedDraftRestore,
    isCreateOnlyMode,
    watchedChannel,
    watchedContactId,
    watchedCustomerAddress,
    watchedCustomerName,
    watchedCustomerPhone,
    watchedShippingProvider,
    watchedDiscount,
    watchedItems,
    watchedPaymentAccountId,
    watchedPaymentCurrency,
    watchedPaymentMethod,
    watchedShippingCost,
    watchedShippingFeeCharged,
  ]);

  useEffect(() => {
    if (watchedDiscount > 0) {
      setDiscountEnabled(true);
    }
  }, [watchedDiscount]);

  useEffect(() => {
    if (watchedShippingFeeCharged > 0 || watchedShippingCost > 0) {
      setShippingFeeEnabled(true);
    }
  }, [watchedShippingCost, watchedShippingFeeCharged]);

  useEffect(() => {
    if (!discountEnabled || discountInputMode !== "PERCENT") {
      return;
    }

    if (totals.discount <= 0 || maxDiscountAmount <= 0) {
      setDiscountPercentInput("");
      return;
    }

    const roundedPercent = Math.round(currentDiscountPercent * 10) / 10;
    setDiscountPercentInput(Number.isInteger(roundedPercent) ? String(roundedPercent) : roundedPercent.toFixed(1));
  }, [
    currentDiscountPercent,
    discountEnabled,
    discountInputMode,
    maxDiscountAmount,
    totals.discount,
  ]);

  useEffect(() => {
    const fallbackCurrency = supportedPaymentCurrencies[0] ?? parseStoreCurrency(catalog.storeCurrency);
    const normalizedCurrentCurrency = parseStoreCurrency(watchedPaymentCurrency, fallbackCurrency);
    if (normalizedCurrentCurrency !== watchedPaymentCurrency) {
      form.setValue("paymentCurrency", normalizedCurrentCurrency, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [catalog.storeCurrency, form, supportedPaymentCurrencies, watchedPaymentCurrency]);

  useEffect(() => {
    const normalizedMethod = watchedPaymentMethod === "BANK_TRANSFER" ? "ON_CREDIT" : watchedPaymentMethod;
    const nextMethod: CheckoutPaymentMethod =
      normalizedMethod === "CASH" ||
      normalizedMethod === "LAO_QR" ||
      normalizedMethod === "ON_CREDIT" ||
      (isOnlineCheckout && normalizedMethod === "COD")
        ? normalizedMethod
        : "CASH";

    if (nextMethod !== watchedPaymentMethod) {
      setCheckoutPaymentMethod(nextMethod);
      return;
    }

    if (nextMethod === "LAO_QR") {
      const currentAccountStillValid = qrPaymentAccounts.some(
        (account) => account.id === watchedPaymentAccountId,
      );
      if (!currentAccountStillValid) {
        form.setValue("paymentAccountId", qrPaymentAccounts[0]?.id ?? "", {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      return;
    }

    if (watchedPaymentAccountId) {
      form.setValue("paymentAccountId", "", { shouldDirty: true, shouldValidate: true });
    }
  }, [
    form,
    isOnlineCheckout,
    qrPaymentAccounts,
    setCheckoutPaymentMethod,
    watchedPaymentAccountId,
    watchedPaymentMethod,
  ]);

  useEffect(() => {
    if (isPickupLaterCheckout) {
      setPickupLaterCustomerOpen(false);
    }
  }, [isPickupLaterCheckout]);

  useEffect(() => {
    if (!isOnlineCheckout) {
      setOnlineChannelMode("FACEBOOK");
      setOnlineOtherChannelInput("");
      setOnlineCustomProviderOpen(false);
      setOnlineContactPickerOpen(false);
      setOnlineQuickFillInput("");
      setShippingFeeEnabled(false);
      return;
    }

    if (onlineChannelMode !== "OTHER") {
      const normalizedMode: OnlineChannelMode = watchedChannel === "WHATSAPP" ? "WHATSAPP" : "FACEBOOK";
      if (onlineChannelMode !== normalizedMode) {
        setOnlineChannelMode(normalizedMode);
      }
    }

    if (watchedContactId) {
      setOnlineContactPickerOpen(true);
    }
  }, [isOnlineCheckout, onlineChannelMode, watchedChannel, watchedContactId]);

  useEffect(() => {
    if (!isOnlineCheckout) {
      return;
    }
    const provider = watchedShippingProvider.trim();
    if (!provider) {
      setOnlineCustomProviderOpen(false);
      return;
    }
    if (!shippingProviderChipOptions.some((item) => item === provider)) {
      setOnlineCustomProviderOpen(true);
      return;
    }
    setOnlineCustomProviderOpen(false);
  }, [isOnlineCheckout, watchedShippingProvider, shippingProviderChipOptions]);

  useEffect(() => {
    const seen = window.localStorage.getItem(SCANNER_PERMISSION_STORAGE_KEY) === "1";
    setHasSeenScannerPermission(seen);
  }, []);

  useEffect(() => {
    if (!isCreateOnlyMode) {
      return;
    }

    const searchStickyElement = createOnlySearchStickyRef.current;
    const cartStickyElement = createOnlyCartStickyRef.current;
    if (!searchStickyElement || !cartStickyElement) {
      return;
    }

    const updateCartStickyTop = () => {
      const rootFontSize = Number.parseFloat(
        window.getComputedStyle(document.documentElement).fontSize,
      );
      const safeRootFontSize = Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
      const stickyTopOffsetPx = CREATE_ONLY_SEARCH_STICKY_TOP_REM * safeRootFontSize;
      const searchSectionHeightPx = searchStickyElement.offsetHeight;
      const viewportWidth = window.innerWidth;
      const isTabletViewport =
        viewportWidth >= TABLET_MIN_WIDTH_PX && viewportWidth < DESKTOP_MIN_WIDTH_PX;
      const layoutGapPx = cartStickyElement.offsetTop - (
        searchStickyElement.offsetTop + searchSectionHeightPx
      );
      const safeLayoutGapPx =
        Number.isFinite(layoutGapPx) && layoutGapPx >= 0
          ? layoutGapPx
          : CREATE_ONLY_CART_STICKY_GAP_FALLBACK_PX;
      const nextTop = isTabletViewport
        ? Math.round(stickyTopOffsetPx + searchSectionHeightPx)
        : Math.round(
            stickyTopOffsetPx +
              searchSectionHeightPx +
              safeLayoutGapPx +
              CREATE_ONLY_CART_STICKY_EXTRA_TOP_PX,
          );
      setDesktopCartStickyTop((prev) => {
        const nextTopValue = `${nextTop}px`;
        return prev === nextTopValue ? prev : nextTopValue;
      });
    };

    updateCartStickyTop();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateCartStickyTop);
      resizeObserver.observe(searchStickyElement);
    }
    window.addEventListener("resize", updateCartStickyTop);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateCartStickyTop);
    };
  }, [isCreateOnlyMode]);

  const openScannerSheet = useCallback(() => {
    if (hasSeenScannerPermission) {
      setShowScannerSheet(true);
      return;
    }
    setShowScannerPermissionSheet(true);
  }, [hasSeenScannerPermission]);

  const renderCreateOrderForm = (options?: { inSheet?: boolean }) => {
    const inSheet = options?.inSheet ?? false;
    const isProductStep = isCreateOnlyMode ? createStep === "products" : true;
    const isDetailsStep = isCreateOnlyMode ? createStep === "details" : true;
    const canContinueToDetails = watchedItems.length > 0;
    const showStickyCartButton = isCreateOnlyMode ? isProductStep : inSheet;

    return (
      <form
        className="space-y-3"
        onSubmit={submitOrder}
        id={inSheet ? CREATE_ORDER_CHECKOUT_SHEET_FORM_ID : undefined}
      >
        {isCreateOnlyMode && !inSheet ? (
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <button
              type="button"
              className={`h-9 rounded-md text-xs font-medium ${
                isProductStep ? "bg-blue-600 text-white" : "bg-white text-slate-600"
              }`}
              onClick={() => setCreateStep("products")}
              disabled={loading}
            >
              1) {t(uiLocale, "orders.create.steps.products")}
            </button>
            <button
              type="button"
              className={`h-9 rounded-md text-xs font-medium ${
                isDetailsStep ? "bg-blue-600 text-white" : "bg-white text-slate-600"
              }`}
              onClick={() => setCreateStep("details")}
              disabled={loading || !canContinueToDetails}
            >
              2) {t(uiLocale, "orders.create.steps.details")}
            </button>
          </div>
        ) : null}

        {isDetailsStep ? (
          <>
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">
                {t(uiLocale, "orders.create.section.orderType.title")}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(
                  [
                    {
                      key: "WALK_IN_NOW",
                      labelKey: "orders.flow.WALK_IN_NOW",
                      descriptionKey: "orders.create.flow.WALK_IN_NOW.description",
                    },
                    {
                      key: "PICKUP_LATER",
                      labelKey: "orders.flow.PICKUP_LATER",
                      descriptionKey: "orders.create.flow.PICKUP_LATER.description",
                    },
                    {
                      key: "ONLINE_DELIVERY",
                      labelKey: "orders.flow.ONLINE_DELIVERY",
                      descriptionKey: "orders.create.flow.ONLINE_DELIVERY.description",
                    },
                  ] satisfies Array<{
                    key: CheckoutFlow;
                    labelKey: MessageKey;
                    descriptionKey: MessageKey;
                  }>
                ).map((flowOption) => (
                  <button
                    key={flowOption.key}
                    type="button"
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${
                      checkoutFlow === flowOption.key
                        ? "border-blue-300 bg-blue-50 text-blue-800"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                    onClick={() => applyCheckoutFlow(flowOption.key)}
                    disabled={loading}
                  >
                    <p className="text-xs font-medium">{t(uiLocale, flowOption.labelKey)}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {t(uiLocale, flowOption.descriptionKey)}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {isOnlineCheckout ? (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  {t(uiLocale, "orders.create.online.channel.label")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: "FACEBOOK", labelKey: "orders.channelSummary.facebook" },
                      { key: "WHATSAPP", labelKey: "orders.channelSummary.whatsapp" },
                      { key: "OTHER", labelKey: "orders.create.online.channel.other" },
                    ] satisfies Array<{ key: OnlineChannelMode; labelKey: MessageKey }>
                  ).map((option) => {
                    const isActive = onlineChannelMode === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`h-10 rounded-md border px-2 text-xs font-medium ${
                          isActive
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                        }`}
                        onClick={() => onSelectOnlineChannelMode(option.key)}
                        disabled={loading}
                      >
                        {t(uiLocale, option.labelKey)}
                      </button>
                    );
                  })}
                </div>
                {onlineChannelMode === "OTHER" ? (
                  <input
                    type="text"
                    className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                    placeholder={t(uiLocale, "orders.create.online.channel.other.placeholder")}
                    value={onlineOtherChannelInput}
                    onChange={(event) => setOnlineOtherChannelInput(event.target.value)}
                    disabled={loading}
                  />
                ) : null}
                <p className="text-[11px] text-slate-500">
                  {onlineChannelMode === "OTHER"
                    ? t(uiLocale, "orders.create.online.channel.hint.other")
                    : t(uiLocale, "orders.create.online.channel.hint.default")}
                </p>
              </div>
            ) : null}

            {isOnlineCheckout && onlineChannelMode !== "OTHER" && watchedChannel !== "WALK_IN" ? (
              <div className="space-y-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-blue-700 hover:text-blue-800"
                    onClick={() => setOnlineContactPickerOpen((prev) => !prev)}
                    disabled={loading}
                  >
                    {onlineContactPickerOpen
                      ? t(uiLocale, "orders.create.online.contactPicker.hide")
                      : selectedOnlineContactLabel
                        ? t(uiLocale, "orders.create.online.contactPicker.editSelected")
                        : t(uiLocale, "orders.create.online.contactPicker.pickOptional")}
                  </button>
                  {watchedContactId ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-slate-600 hover:text-slate-800"
                      onClick={() => onPickContact("")}
                      disabled={loading}
                    >
                      {t(uiLocale, "common.action.clear")}
                    </button>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500">
                  {selectedOnlineContactLabel
                    ? `${t(uiLocale, "orders.create.online.contactPicker.selectedPrefix")} ${selectedOnlineContactLabel}`
                    : t(uiLocale, "orders.create.online.contactPicker.noSelectionHint")}
                </p>
                {onlineContactPickerOpen ? (
                  <>
                    <select
                      id="order-contact"
                      className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                      disabled={loading}
                      value={form.watch("contactId") ?? ""}
                      onChange={(event) => onPickContact(event.target.value)}
                    >
                      <option value="">{t(uiLocale, "orders.create.online.contactPicker.option.none")}</option>
                      {onlineChannelContacts.map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.displayName}
                        </option>
                      ))}
                    </select>
                    {onlineChannelContacts.length <= 0 ? (
                      <p className="text-xs text-slate-500">
                        {t(uiLocale, "orders.create.online.contactPicker.emptyHint")}
                      </p>
                    ) : null}
                    <p className="text-xs text-red-600">{form.formState.errors.contactId?.message}</p>
                  </>
                ) : null}
              </div>
            ) : null}

            {isOnlineCheckout ? (
              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                <label className="text-xs font-medium text-slate-700" htmlFor="online-quick-fill">
                  {t(uiLocale, "orders.create.online.quickFill.labelOptional")}
                </label>
                <textarea
                  id="online-quick-fill"
                  className="min-h-24 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
                  placeholder={t(uiLocale, "orders.create.online.quickFill.placeholderExample")}
                  value={onlineQuickFillInput}
                  onChange={(event) => setOnlineQuickFillInput(event.target.value)}
                  disabled={loading}
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="h-8 rounded-md border border-slate-300 px-2 text-xs text-slate-600"
                    onClick={() => setOnlineQuickFillInput("")}
                    disabled={loading || onlineQuickFillInput.trim().length <= 0}
                  >
                    {t(uiLocale, "common.action.clear")}
                  </button>
                  <button
                    type="button"
                    className="h-8 rounded-md border border-blue-300 bg-blue-50 px-2 text-xs font-medium text-blue-700"
                    onClick={applyOnlineQuickFill}
                    disabled={loading || onlineQuickFillInput.trim().length <= 0}
                  >
                    {t(uiLocale, "orders.create.online.quickFill.apply")}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  {t(uiLocale, "orders.create.online.quickFill.hint")}
                </p>
              </div>
            ) : null}

            {isPickupLaterCheckout ? (
              <div className="space-y-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
                <button
                  type="button"
                  className="text-xs font-medium text-blue-700 hover:text-blue-800"
                  onClick={() => setPickupLaterCustomerOpen((prev) => !prev)}
                  disabled={loading}
                >
                  {pickupLaterCustomerOpen
                    ? t(uiLocale, "orders.create.pickupLater.toggle.hide")
                    : hasPickupCustomerIdentity
                      ? t(uiLocale, "orders.create.pickupLater.toggle.editOptional")
                      : t(uiLocale, "orders.create.pickupLater.toggle.addOptional")}
                </button>
                {!pickupLaterCustomerOpen ? (
                  <p className="text-xs text-slate-500">
                    {t(uiLocale, "orders.create.pickupLater.summary.statusPrefix")}{" "}
                    {pickupCustomerIdentitySummary}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    {t(uiLocale, "orders.create.pickupLater.summary.hint")}
                  </p>
                )}
              </div>
            ) : null}

            {showCustomerIdentityFields ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground" htmlFor="order-customer-name">
                    {isOnlineCheckout
                      ? t(uiLocale, "orders.create.customer.name.labelOnline")
                      : t(uiLocale, "orders.create.customer.name.labelOptional")}
                  </label>
                  <input
                    id="order-customer-name"
                    className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                    disabled={loading}
                    {...form.register("customerName")}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground" htmlFor="order-customer-phone">
                    {requiresCustomerPhone
                      ? t(uiLocale, "orders.create.customer.phone.labelRequired")
                      : t(uiLocale, "orders.create.customer.phone.label")}
                  </label>
                  <input
                    id="order-customer-phone"
                    className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                    disabled={loading}
                    {...form.register("customerPhone")}
                  />
                  <p className="text-xs text-red-600">{form.formState.errors.customerPhone?.message}</p>
                  {!isOnlineCheckout ? (
                    <p className="text-xs text-slate-500">
                      {t(uiLocale, "orders.create.customer.phone.hintOptional")}
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}

            {isOnlineCheckout ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground" htmlFor="order-address">
                    {t(uiLocale, "orders.create.customer.address.labelRequired")}
                  </label>
                  <textarea
                    id="order-address"
                    className="min-h-20 w-full rounded-md border px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
                    disabled={loading}
                    {...form.register("customerAddress")}
                  />
                  <p className="text-xs text-red-600">{form.formState.errors.customerAddress?.message}</p>
                </div>

                <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-700">
                    {t(uiLocale, "orders.create.shipping.section.title")}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {shippingProviderChipOptions.map((provider) => {
                      const isActive = watchedShippingProvider.trim() === provider;
                      return (
                        <button
                          key={provider}
                          type="button"
                          className={`h-10 rounded-md border px-2 text-xs font-medium ${
                            isActive
                              ? "border-blue-300 bg-blue-50 text-blue-700"
                              : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                          }`}
                          onClick={() => onSelectShippingProviderChip(provider)}
                          disabled={loading}
                        >
                          {provider}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className={`h-10 rounded-md border px-2 text-xs font-medium ${
                        onlineCustomProviderOpen
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                      }`}
                      onClick={onToggleCustomShippingProvider}
                      disabled={loading}
                    >
                      {t(uiLocale, "common.other")}
                    </button>
                  </div>
                  {onlineCustomProviderOpen ? (
                    <input
                      type="text"
                      className="h-9 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                      placeholder={t(uiLocale, "orders.create.shipping.other.placeholder")}
                      value={isKnownShippingProvider ? "" : watchedShippingProvider}
                      onChange={(event) => {
                        form.setValue("shippingProvider", event.target.value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        if (event.target.value.trim().length > 0) {
                          form.clearErrors("shippingProvider");
                        }
                      }}
                      disabled={loading}
                    />
                  ) : null}
                  {form.formState.errors.shippingProvider?.message ? (
                    <p className="text-xs text-red-600">{form.formState.errors.shippingProvider.message}</p>
                  ) : watchedShippingProvider.trim().length <= 0 ? (
                    <p className="text-[11px] text-amber-700">
                      {t(uiLocale, "orders.create.shipping.missingWarning")}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      {t(uiLocale, "orders.create.shipping.selectedHint")}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
                {isPickupLaterCheckout
                  ? t(uiLocale, "orders.create.modeHint.pickupLater")
                  : t(uiLocale, "orders.create.modeHint.walkInNow")}
              </p>
            )}
          </>
        ) : null}

        {isProductStep ? (
          <div id="order-cart-section" className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {t(uiLocale, "orders.create.products.sectionTitle")} (
              {watchedItems.length.toLocaleString(numberLocale)} {t(uiLocale, "orders.unit.items")})
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs font-medium text-blue-700"
                disabled={loading || !hasCatalogProducts}
                onClick={openScannerSheet}
              >
                {t(uiLocale, "orders.create.products.action.scanAdd")}
              </button>
              <button
                type="button"
                className="text-xs font-medium text-blue-700"
                disabled={loading || !hasCatalogProducts}
                onClick={() =>
                  append({
                    productId: catalog.products[0]?.productId ?? "",
                    unitId: getPreferredUnitId(catalog.products[0]),
                    qty: 1,
                  })
                }
              >
                {t(uiLocale, "orders.create.products.action.addLineItem")}
              </button>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <p className="text-xs font-medium text-slate-700">
              {t(uiLocale, "orders.create.products.quickAdd.title")}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="h-10 flex-1 rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                placeholder={t(uiLocale, "orders.create.products.search.placeholder")}
                value={quickAddKeyword}
                onChange={(event) => setQuickAddKeyword(event.target.value)}
                disabled={loading || !hasCatalogProducts}
              />
              {quickAddKeyword.trim() ? (
                <button
                  type="button"
                  className="h-10 rounded-md border border-slate-300 px-3 text-xs text-slate-600"
                  onClick={() => setQuickAddKeyword("")}
                  disabled={loading}
                >
                  {t(uiLocale, "common.action.clear")}
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`h-8 rounded-md border px-2 text-xs ${
                  quickAddOnlyAvailable
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-slate-300 bg-white text-slate-600"
                }`}
                onClick={() => setQuickAddOnlyAvailable((prev) => !prev)}
                disabled={loading || !hasCatalogProducts}
              >
                {quickAddOnlyAvailable
                  ? t(uiLocale, "orders.create.products.filter.available.on")
                  : t(uiLocale, "orders.create.products.filter.available.off")}
              </button>
            </div>
            {!hasCatalogProducts ? (
              <p className="text-xs text-slate-500">
                {t(uiLocale, "orders.create.products.quickAdd.emptyCatalog")}
              </p>
            ) : quickAddProducts.length === 0 ? (
              <p className="text-xs text-slate-500">
                {t(uiLocale, "orders.create.products.quickAdd.noMatch")}
              </p>
            ) : (
              <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {quickAddProducts.map((product) => (
                  (() => {
                    const availableSellUnits = getAvailableSellUnits(product);
                    const canQuickAdd = availableSellUnits.length > 0;
                    return (
                  <button
                    key={product.productId}
                    type="button"
                    className="rounded-md border bg-white px-3 py-2 text-left transition-colors hover:bg-blue-50"
                    onClick={() => {
                      const addedProduct = beginAddProductFromCatalog(product.productId, "quick-add");
                      if (addedProduct) {
                        setScanMessage(
                          `${t(uiLocale, "orders.create.scan.addedProduct.prefix")} ${addedProduct.sku} - ${addedProduct.name} ${t(uiLocale, "orders.create.scan.addedProduct.suffix")}`,
                        );
                      }
                    }}
                    disabled={loading}
                  >
                    <p className="text-xs text-slate-500">{product.sku}</p>
                    <p className="truncate text-sm font-medium text-slate-800">{product.name}</p>
                    <p className="text-xs text-slate-500">
                      {t(uiLocale, "orders.create.products.stockRemainingPrefix")}{" "}
                      {product.available.toLocaleString(numberLocale)}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {product.units.map((unit) => unit.unitCode).join(" • ")}
                    </p>
                    {canQuickAdd ? (
                      <p className="mt-1 text-xs font-medium text-blue-700">
                        {t(uiLocale, "orders.create.products.quickAdd.addPrefix")}{" "}
                        {getProductDefaultUnitPrice(product).toLocaleString(numberLocale)}{" "}
                        {catalog.storeCurrency}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-medium text-rose-600">
                        {t(uiLocale, "orders.create.products.outOfStockBadge")}
                      </p>
                    )}
                  </button>
                    );
                  })()
                ))}
              </div>
            )}
          </div>

          {scanMessage ? <p className="text-xs text-emerald-700">{scanMessage}</p> : null}

          {notFoundBarcode ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
              <p className="text-xs text-amber-700">
                {t(uiLocale, "orders.create.products.notFoundBarcode.prefix")}{" "}
                <span className="font-semibold">{notFoundBarcode}</span>{" "}
                {t(uiLocale, "orders.create.products.notFoundBarcode.suffix")}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    className="h-10 flex-1 rounded-md border border-amber-300 bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                    placeholder={t(uiLocale, "orders.create.products.search.placeholder")}
                    value={manualSearchKeyword}
                    onChange={(event) => setManualSearchKeyword(event.target.value)}
                    disabled={loading}
                  />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-10 rounded-md border border-amber-300 px-3 text-xs font-medium text-amber-700"
                    onClick={openScannerSheet}
                    disabled={loading}
                  >
                    {t(uiLocale, "orders.create.products.action.scanAgain")}
                  </button>
                  <button
                    type="button"
                    className="h-10 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-600"
                    onClick={() => {
                      setNotFoundBarcode(null);
                      setManualSearchKeyword("");
                    }}
                    disabled={loading}
                  >
                    {t(uiLocale, "common.action.close")}
                  </button>
                </div>
              </div>

              {manualSearchKeyword.trim() ? (
                manualSearchResults.length > 0 ? (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-amber-200 bg-white p-1">
                    {manualSearchResults.map((product) => (
                      <button
                        key={product.productId}
                        type="button"
                        className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-xs hover:bg-amber-100"
                        onClick={() => pickProductFromManualSearch(product.productId)}
                        disabled={loading}
                      >
                        <span className="font-medium text-slate-800">
                          {product.sku} - {product.name}
                        </span>
                        <span className="text-slate-500">{product.barcode ?? "—"}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">
                    {t(uiLocale, "orders.create.products.manualSearch.noMatch")}
                  </p>
                )
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2 sm:hidden">
            {watchedItems.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-xs text-slate-500">
                {t(uiLocale, "orders.create.products.emptyCart")}
              </p>
            ) : (
              watchedItems.slice(0, 2).map((item, index) => {
                const selectedProduct = productsById.get(item.productId ?? "");
                const selectedUnit = selectedProduct?.units.find(
                  (unit) => unit.unitId === item.unitId,
                );
                const availableQty = getProductAvailableQty(item.productId ?? "");
                const currentQty = Number(item.qty ?? 0) || 0;
                const lineTotal =
                  (Number(item.qty ?? 0) || 0) * (selectedUnit?.pricePerUnit ?? 0);

                return (
                  <div
                    key={`${item.productId}-${index}`}
                    className="space-y-2 rounded-lg border bg-white p-2"
                  >
                    <p className="text-xs text-slate-500">{selectedProduct?.sku ?? "-"}</p>
                    <p className="text-sm font-medium text-slate-900">
                      {selectedProduct?.name ?? t(uiLocale, "orders.create.products.productNotFound")}
                    </p>
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <select
                        className="h-9 rounded-md border px-2 text-sm outline-none ring-primary focus:ring-2"
                        value={item.unitId ?? ""}
                        onChange={(event) => setItemUnit(index, event.target.value)}
                        disabled={loading}
                      >
                        {selectedProduct?.units.map((unit) => (
                          <option key={unit.unitId} value={unit.unitId}>
                            {unit.unitCode}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="h-9 w-9 rounded-md border text-base text-slate-700"
                          onClick={() => decreaseItemQty(index)}
                          disabled={loading}
                          aria-label={t(uiLocale, "orders.create.products.qty.decreaseAria")}
                        >
                          -
                        </button>
                        <div className="min-w-10 text-center text-sm font-medium text-slate-800">
                          {(Number(item.qty ?? 0) || 0).toLocaleString(numberLocale)}
                        </div>
                        <button
                          type="button"
                          className="h-9 w-9 rounded-md border text-base text-slate-700"
                          onClick={() => increaseItemQty(index)}
                          disabled={loading || availableQty <= 0 || currentQty >= availableQty}
                          aria-label={t(uiLocale, "orders.create.products.qty.increaseAria")}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <p className="text-slate-500">
                        {t(uiLocale, "orders.create.products.stockRemainingPrefix")}{" "}
                        {selectedProduct?.available.toLocaleString(numberLocale) ?? 0}
                      </p>
                      <button
                        type="button"
                        className="text-red-600"
                        onClick={() => remove(index)}
                        disabled={loading}
                      >
                        {t(uiLocale, "common.action.delete")}
                      </button>
                    </div>
                    <p className="text-xs font-medium text-blue-700">
                      {t(uiLocale, "orders.create.products.lineTotalPrefix")}{" "}
                      {lineTotal.toLocaleString(numberLocale)} {catalog.storeCurrency}
                    </p>
                  </div>
                );
              })
            )}
            {watchedItems.length > 2 ? (
              <button
                type="button"
                className="w-full rounded-lg border border-dashed px-3 py-2 text-xs font-medium text-blue-700"
                onClick={() => setShowCartSheet(true)}
              >
                {t(uiLocale, "orders.create.products.moreItems.prefix")}{" "}
                {(watchedItems.length - 2).toLocaleString(numberLocale)}{" "}
                {t(uiLocale, "orders.create.products.moreItems.suffix")}
              </button>
            ) : null}
          </div>

          <div className="hidden space-y-2 sm:block">
            {fields.map((field, index) => {
              const selectedProduct = productsById.get(watchedItems[index]?.productId ?? "");
              const selectedUnit = selectedProduct?.units.find(
                (unit) => unit.unitId === watchedItems[index]?.unitId,
              );
              const lineTotal =
                (Number(watchedItems[index]?.qty ?? 0) || 0) * (selectedUnit?.pricePerUnit ?? 0);

              return (
                <div key={field.id} className="space-y-2 rounded-lg border p-2">
                  <div className="grid grid-cols-1 gap-2">
                    <select
                      className="h-10 rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                      value={watchedItems[index]?.productId ?? ""}
                      onChange={(event) => onChangeProduct(index, event.target.value)}
                      disabled={loading}
                    >
                      {catalog.products.map((product) => (
                        <option key={product.productId} value={product.productId}>
                          {product.sku} - {product.name}
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-[1fr_1fr_90px_auto] gap-2">
                      <select
                        className="h-10 rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                        disabled={loading}
                        value={watchedItems[index]?.unitId ?? ""}
                        onChange={(event) => setItemUnit(index, event.target.value)}
                      >
                        {selectedProduct?.units.map((unit) => (
                          <option key={unit.unitId} value={unit.unitId}>
                            {unit.unitCode}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min={1}
                        step={1}
                        className="h-10 rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                        disabled={loading}
                        {...form.register(`items.${index}.qty`)}
                      />

                      <div className="h-10 rounded-md border bg-slate-50 px-2 py-2 text-xs text-slate-600">
                        {t(uiLocale, "orders.create.products.stockRemainingPrefix")}{" "}
                        {selectedProduct?.available.toLocaleString(numberLocale) ?? 0}
                      </div>

                      <button
                        type="button"
                        className="text-xs text-red-600"
                        onClick={() => remove(index)}
                        disabled={loading}
                      >
                        {t(uiLocale, "common.action.delete")}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-blue-700">
                    {t(uiLocale, "orders.create.products.lineTotalPrefix")}{" "}
                    {lineTotal.toLocaleString(numberLocale)} {catalog.storeCurrency}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-red-600">{form.formState.errors.items?.message}</p>

          {showStickyCartButton ? (
            <button
              type="button"
              className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-30 flex items-center justify-between rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 shadow-sm sm:hidden"
              onClick={() => setShowCartSheet(true)}
              disabled={watchedItems.length === 0}
            >
              <span>
                {t(uiLocale, "orders.create.cart.viewCartPrefix")}{" "}
                {watchedItems.length.toLocaleString(numberLocale)} {t(uiLocale, "orders.unit.items")} /{" "}
                {cartQtyTotal.toLocaleString(numberLocale)} {t(uiLocale, "orders.unit.pcs")}
              </span>
              <span>
                {totals.total.toLocaleString(numberLocale)} {catalog.storeCurrency}
              </span>
            </button>
          ) : null}
          </div>
        ) : isCreateOnlyMode ? (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {t(uiLocale, "orders.create.products.sectionTitle")} (
                {watchedItems.length.toLocaleString(numberLocale)} {t(uiLocale, "orders.unit.items")})
              </p>
              <button
                type="button"
                className="text-xs font-medium text-blue-700"
                onClick={() => {
                  if (inSheet) {
                    setShowCheckoutSheet(false);
                  }
                  setCreateStep("products");
                }}
                disabled={loading}
              >
                {inSheet
                  ? t(uiLocale, "orders.create.products.action.backToProducts")
                  : t(uiLocale, "orders.create.products.action.editItems")}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {t(uiLocale, "orders.create.cart.summary.qtyPrefix")}{" "}
              {cartQtyTotal.toLocaleString(numberLocale)} {t(uiLocale, "orders.unit.pcs")} •{" "}
              {t(uiLocale, "orders.create.cart.summary.totalPrefix")}{" "}
              {totals.total.toLocaleString(numberLocale)} {catalog.storeCurrency}
            </p>
            <p className="text-xs text-red-600">{form.formState.errors.items?.message}</p>
          </div>
        ) : null}

        {isDetailsStep ? (
          <>
            <div className={`grid grid-cols-1 gap-2 ${isOnlineCheckout ? "min-[1200px]:grid-cols-2" : ""}`}>
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-700">
                      {t(uiLocale, "orders.create.discount.title")}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {t(uiLocale, "orders.create.discount.hint.prefix")}{" "}
                      {maxDiscountAmount.toLocaleString(numberLocale)} {catalog.storeCurrency}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`h-8 rounded-md border px-2 text-xs font-medium ${
                      discountEnabled
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-slate-300 bg-white text-slate-600"
                    }`}
                    onClick={() => {
                      if (discountEnabled) {
                        setDiscountEnabled(false);
                        setDiscountInputMode("AMOUNT");
                        setDiscountPercentInput("");
                        applyDiscountAmount(0);
                        return;
                      }
                      setDiscountEnabled(true);
                    }}
                    disabled={loading}
                  >
                    {discountEnabled
                      ? t(uiLocale, "orders.create.discount.toggle.off")
                      : t(uiLocale, "orders.create.discount.toggle.on")}
                  </button>
                </div>

                {discountEnabled ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div className="inline-flex shrink-0 rounded-md border border-slate-300 bg-white p-0.5">
                        <button
                          type="button"
                          className={`h-7 rounded px-2 text-xs font-medium ${
                            discountInputMode === "AMOUNT"
                              ? "bg-blue-600 text-white"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                          onClick={() => {
                            setDiscountInputMode("AMOUNT");
                            setDiscountPercentInput("");
                          }}
                          disabled={loading}
                        >
                          {t(uiLocale, "orders.create.discount.mode.amount")}
                        </button>
                        <button
                          type="button"
                          className={`h-7 rounded px-2 text-xs font-medium ${
                            discountInputMode === "PERCENT"
                              ? "bg-blue-600 text-white"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                          onClick={() => {
                            setDiscountInputMode("PERCENT");
                            if (totals.discount > 0 && maxDiscountAmount > 0) {
                              const roundedPercent = Math.round(currentDiscountPercent * 10) / 10;
                              setDiscountPercentInput(
                                Number.isInteger(roundedPercent)
                                  ? String(roundedPercent)
                                  : roundedPercent.toFixed(1),
                              );
                            } else {
                              setDiscountPercentInput("");
                            }
                          }}
                          disabled={loading || maxDiscountAmount <= 0}
                        >
                          %
                        </button>
                      </div>
                      <span aria-hidden className="h-5 w-px shrink-0 bg-slate-300" />

                      {[5, 10, 20].map((percent) => {
                        const isActive = Math.abs(currentDiscountPercent - percent) < 0.5 && totals.discount > 0;
                        return (
                          <button
                            key={percent}
                            type="button"
                            className={`h-7 shrink-0 rounded-md border px-2 text-xs ${
                              isActive
                                ? "border-blue-300 bg-blue-50 text-blue-700"
                                : "border-slate-300 bg-white text-slate-600"
                            }`}
                            onClick={() => {
                              setDiscountEnabled(true);
                              setDiscountInputMode("PERCENT");
                              setDiscountPercentInput(String(percent));
                              applyDiscountPercent(percent);
                            }}
                            disabled={loading || maxDiscountAmount <= 0}
                          >
                            {percent}%
                          </button>
                        );
                      })}
                    </div>

                    {discountInputMode === "AMOUNT" ? (
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                        placeholder="0"
                        disabled={loading}
                        value={totals.discount > 0 ? String(totals.discount) : ""}
                        onChange={(event) => {
                          const raw = event.target.value.trim();
                          if (!raw) {
                            applyDiscountAmount(0);
                            return;
                          }
                          const parsed = Number(raw);
                          if (!Number.isFinite(parsed)) {
                            return;
                          }
                          applyDiscountAmount(parsed);
                        }}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                          placeholder="0"
                          disabled={loading || maxDiscountAmount <= 0}
                          value={discountPercentInput}
                          onChange={(event) => {
                            const raw = event.target.value.trim();
                            setDiscountPercentInput(raw);
                            if (!raw) {
                              applyDiscountAmount(0);
                              return;
                            }
                            const parsed = Number(raw);
                            if (!Number.isFinite(parsed)) {
                              return;
                            }
                            applyDiscountPercent(parsed);
                          }}
                        />
                        <span className="text-sm text-slate-500">%</span>
                      </div>
                    )}

                    <p className="text-xs font-medium text-emerald-700">
                      {t(uiLocale, "orders.create.discount.actual.prefix")} -
                      {totals.discount.toLocaleString(numberLocale)} {catalog.storeCurrency}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    {t(uiLocale, "orders.create.discount.emptyHint")}
                  </p>
                )}
                <p className="text-xs text-red-600">{form.formState.errors.discount?.message}</p>
              </div>

              {isOnlineCheckout ? (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-700">
                        {t(uiLocale, "orders.create.shippingFee.title")}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {t(uiLocale, "orders.create.shippingFee.hint")}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`h-8 shrink-0 whitespace-nowrap rounded-md border px-2 text-xs font-medium ${
                        shippingFeeEnabled
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-slate-300 bg-white text-slate-600"
                      }`}
                      onClick={() => {
                        if (shippingFeeEnabled) {
                          setShippingFeeEnabled(false);
                          form.setValue("shippingFeeCharged", 0, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          form.setValue("shippingCost", 0, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          return;
                        }
                        setShippingFeeEnabled(true);
                      }}
                      disabled={loading}
                    >
                      {shippingFeeEnabled
                        ? t(uiLocale, "orders.create.shippingFee.toggle.off")
                        : t(uiLocale, "orders.create.shippingFee.toggle.on")}
                    </button>
                  </div>

                  {shippingFeeEnabled ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">
                          {t(uiLocale, "orders.create.shippingFee.field.feeCharged.label")}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                          disabled={loading}
                          {...form.register("shippingFeeCharged")}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">
                          {t(uiLocale, "orders.create.shippingFee.field.cost.label")}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                          disabled={loading}
                          {...form.register("shippingCost")}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {t(uiLocale, "orders.create.shippingFee.emptyHint")}
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                {t(uiLocale, "orders.create.paymentMethod.label")}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {paymentMethodOptions.map((methodOption) => {
                  const isActive = watchedPaymentMethod === methodOption.key;
                  return (
                    <button
                      key={methodOption.key}
                      type="button"
                      className={`h-9 rounded-md border px-3 text-xs font-medium ${
                        isActive
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                      }`}
                      onClick={() => setCheckoutPaymentMethod(methodOption.key)}
                      disabled={loading}
                    >
                      {t(uiLocale, methodOption.labelKey)}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">
                {isOnlineCheckout
                  ? t(uiLocale, "orders.create.paymentMethod.help.online")
                  : t(uiLocale, "orders.create.paymentMethod.help.offline")}
              </p>
              <p className="text-xs text-red-600">{form.formState.errors.paymentMethod?.message}</p>
            </div>

            {watchedPaymentMethod === "LAO_QR" ? (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground" htmlFor="payment-account">
                  {t(uiLocale, "orders.create.paymentAccount.label")}
                </label>
                <select
                  id="payment-account"
                  className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                  disabled={loading}
                  value={watchedPaymentAccountId}
                  onChange={(event) =>
                    form.setValue("paymentAccountId", event.target.value, { shouldValidate: true })
                  }
                >
                  <option value="">{t(uiLocale, "orders.create.paymentAccount.placeholder")}</option>
                  {qrPaymentAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.displayName} ({resolveLaosBankDisplayName(account.bankName)} •{" "}
                      {currencyLabel(account.currency)})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-red-600">{form.formState.errors.paymentAccountId?.message}</p>
                {qrPaymentAccounts.length <= 0 ? (
                  <p className="text-[11px] text-slate-500">
                    ยังไม่มีบัญชี QR ที่รองรับ {currencyLabel(selectedPaymentCurrency)} สำหรับร้านนี้
                  </p>
                ) : null}
                {selectedQrPaymentAccount ? (
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700">
                          {t(uiLocale, "orders.create.paymentAccount.qrPreview.title")}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {t(uiLocale, "orders.create.paymentAccount.qrPreview.hint")}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`h-8 shrink-0 rounded-md border px-2 text-xs font-medium ${
                          showQrAccountPreview
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                        }`}
                        onClick={() => setShowQrAccountPreview((current) => !current)}
                        disabled={loading}
                      >
                        {showQrAccountPreview
                          ? t(uiLocale, "orders.create.paymentAccount.qrPreview.toggle.hide")
                          : t(uiLocale, "orders.create.paymentAccount.qrPreview.toggle.show")}
                      </button>
                    </div>

	                    {showQrAccountPreview ? (
	                      <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
	                        {selectedQrPaymentAccount.qrImageUrl ? (
	                          <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-2">
	                            <div className="absolute right-3 top-3 flex items-center gap-2">
	                              <button
	                                type="button"
	                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400"
	                                onClick={openQrImageFull}
	                                disabled={loading}
	                                aria-label={t(uiLocale, "orders.create.paymentAccount.qrPreview.openFullAria")}
	                                title={t(uiLocale, "orders.create.paymentAccount.qrPreview.openFullAria")}
	                              >
	                                <Expand className="h-4 w-4" />
	                              </button>
	                              <button
	                                type="button"
	                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400"
	                                onClick={() => {
	                                  void downloadQrImage();
	                                }}
	                                disabled={loading}
	                                aria-label={t(uiLocale, "orders.create.paymentAccount.qrPreview.downloadAria")}
	                                title={t(uiLocale, "orders.create.paymentAccount.qrPreview.downloadAria")}
	                              >
	                                <ArrowDownToLine className="h-4 w-4" />
	                              </button>
	                            </div>
	                            <Image
	                              src={selectedQrPaymentAccount.qrImageUrl}
	                              alt={`QR ${selectedQrPaymentAccount.displayName}`}
                              width={240}
                              height={240}
                              className="mx-auto h-48 w-48 rounded object-contain"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <p className="rounded-md border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            {t(uiLocale, "orders.create.paymentAccount.qrPreview.noQrImage")}
                          </p>
                        )}

                        <div className="space-y-1.5 text-xs text-slate-600">
                          <p className="font-medium text-slate-800">{selectedQrPaymentAccount.displayName}</p>
                          <p>
                            {t(uiLocale, "orders.create.paymentAccount.details.bankPrefix")}{" "}
                            {resolveLaosBankDisplayName(selectedQrPaymentAccount.bankName)}
                          </p>
                          <p>
                            {t(uiLocale, "orders.create.paymentAccount.details.accountNamePrefix")}{" "}
                            {selectedQrPaymentAccount.accountName}
                          </p>
                          <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                            <div className="min-w-0">
                              <p className="text-[11px] text-slate-500">
                                {t(uiLocale, "orders.create.paymentAccount.details.accountNumberLabel")}
                              </p>
                              <p className="truncate font-medium text-slate-900">
                                {selectedQrPaymentAccount.accountNumber || "-"}
                              </p>
                            </div>
                            {selectedQrPaymentAccount.accountNumber ? (
                              <button
                                type="button"
                                className="h-8 shrink-0 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 hover:border-slate-400"
                                onClick={() => {
                                  void copyQrAccountNumber();
                                }}
                                disabled={loading}
                              >
                                {t(uiLocale, "orders.create.paymentAccount.details.copyAccountNumber")}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {watchedPaymentMethod === "ON_CREDIT" ? (
              <p className="rounded-md border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {t(uiLocale, "orders.create.paymentMethod.hint.onCredit")}
              </p>
            ) : null}

            {watchedPaymentMethod === "COD" ? (
              <p className="rounded-md border border-dashed border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                {t(uiLocale, "orders.create.paymentMethod.hint.cod")}
              </p>
            ) : null}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                {t(uiLocale, "orders.create.paymentCurrency.label")}
              </label>
              {supportedPaymentCurrencies.length <= 1 ? (
                <div className="flex h-10 items-center rounded-md border bg-slate-50 px-3 text-sm font-medium text-slate-700">
                  {currencyLabel(selectedPaymentCurrency)}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {supportedPaymentCurrencies.map((currency) => {
                    const isActive = selectedPaymentCurrency === currency;
                    return (
                      <button
                        key={currency}
                        type="button"
                        className={`h-9 rounded-md border px-3 text-xs font-medium ${
                          isActive
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                        }`}
                        disabled={loading}
                        onClick={() =>
                          form.setValue("paymentCurrency", currency, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      >
                        {currencyLabel(currency)}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-slate-500">
                {supportedPaymentCurrencies.length <= 1
                  ? `${t(uiLocale, "orders.create.paymentCurrency.hint.single.prefix")} ${currencyLabel(
                      selectedPaymentCurrency,
                    )} ${t(uiLocale, "orders.create.paymentCurrency.hint.single.suffix")}`
                  : `${t(uiLocale, "orders.create.paymentCurrency.hint.multi.prefix")} ${supportedPaymentCurrencies
                      .map((currency) => currencyLabel(currency))
                      .join(" / ")}`}
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p>
                {t(uiLocale, "orders.create.summary.subtotalPrefix")}:{" "}
                {subtotal.toLocaleString(numberLocale)} {catalog.storeCurrency}
              </p>
              <p>
                {t(uiLocale, "orders.create.summary.discountPrefix")}:{" "}
                {totals.discount.toLocaleString(numberLocale)} {catalog.storeCurrency}
              </p>
              <p>
                {t(uiLocale, "orders.create.summary.vatPrefix")} ({vatModeLabel(uiLocale, catalog.vatMode)}):{" "}
                {totals.vatAmount.toLocaleString(numberLocale)}{" "}
                {catalog.storeCurrency}
              </p>
              <p className="font-semibold">
                {t(uiLocale, "orders.create.summary.totalPrefix")}:{" "}
                {totals.total.toLocaleString(numberLocale)} {catalog.storeCurrency}
              </p>
              <p className="text-xs text-slate-500">
                {t(uiLocale, "orders.create.summary.selectedCurrencyPrefix")}:{" "}
                {currencyLabel(selectedPaymentCurrency)}
              </p>
              <p className="text-xs text-slate-500">
                {t(uiLocale, "orders.create.summary.checkoutFlowPrefix")}{" "}
                {t(uiLocale, checkoutFlowLabelKey[checkoutFlow])}
              </p>
              <p className="text-xs text-slate-500">
                {t(uiLocale, "orders.create.summary.paymentMethodPrefix")}{" "}
                {t(uiLocale, paymentMethodLabelKey[watchedPaymentMethod])}
              </p>
              {isOnlineCheckout && watchedShippingProvider.trim() ? (
                <p className="text-xs text-slate-500">
                  {t(uiLocale, "orders.create.summary.shippingProviderPrefix")}{" "}
                  {watchedShippingProvider.trim()}
                </p>
              ) : null}
            </div>

            {!inSheet ? (
              <div>
                <Button type="submit" className="h-10 w-full" disabled={loading || !canCreate}>
                  {loading ? t(uiLocale, "common.action.saving") : t(uiLocale, "orders.create.action.submit")}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <p className="text-xs text-slate-600">
              {t(uiLocale, "orders.create.products.stepHint")}
            </p>
            <Button
              type="button"
              className="h-10 w-full"
              onClick={() => setCreateStep("details")}
              disabled={loading || !canContinueToDetails}
            >
              {t(uiLocale, "orders.create.action.nextDetails")}
            </Button>
          </div>
        )}
      </form>
    );
  };

  const renderCreateOnlyPosCatalog = () => {
    return (
      <div className="-mt-4 space-y-4 pb-28 md:pb-4">
        <div
          ref={createOnlySearchStickyRef}
          className="sticky top-[3.8rem] z-[9] -mx-1 space-y-3 border-b border-slate-200 bg-slate-50/95 px-1 pt-4 pb-2 backdrop-blur-sm md:top-[3.8rem]"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                className="h-10 min-w-0 w-full rounded-md border bg-white pr-3 pl-9 text-sm outline-none ring-primary focus:ring-2"
                placeholder={t(uiLocale, "orders.create.products.search.placeholder")}
                value={quickAddKeyword}
                onChange={(event) => setQuickAddKeyword(event.target.value)}
                disabled={loading || !hasCatalogProducts}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-10 p-0"
              disabled={loading || !hasCatalogProducts}
              onClick={openScannerSheet}
              aria-label={t(uiLocale, "orders.create.products.action.scanBarcode")}
              title={t(uiLocale, "orders.create.products.action.scanBarcode")}
            >
              <ScanBarcode className="h-4 w-4" />
              <span className="sr-only">{t(uiLocale, "orders.create.products.action.scanBarcode")}</span>
            </Button>
            <button
              type="button"
              className={`h-10 shrink-0 whitespace-nowrap rounded-md border px-2.5 text-[11px] sm:px-3 sm:text-xs ${
                quickAddOnlyAvailable
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-300 bg-white text-slate-600"
              }`}
              onClick={() => setQuickAddOnlyAvailable((prev) => !prev)}
              disabled={loading || !hasCatalogProducts}
            >
              {t(
                uiLocale,
                quickAddOnlyAvailable
                  ? "orders.create.products.filter.available.compact.on"
                  : "orders.create.products.filter.available.compact.off",
              )}
            </button>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-8 gap-1.5 px-3 text-xs"
              onClick={() => setShowRecentOrdersSheet(true)}
              disabled={loading}
            >
              <Clock3 className="h-3.5 w-3.5" />
              {t(uiLocale, "orders.create.recentOrders.openButton")}
            </Button>
          </div>

          <div className="-mx-1 overflow-x-auto px-1">
            <div className="flex min-w-max items-center gap-2">
              <button
                type="button"
                className={`h-8 rounded-full border px-3 text-xs ${
                  quickAddCategoryId === "ALL"
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-slate-300 bg-white text-slate-600"
                }`}
                onClick={() => setQuickAddCategoryId("ALL")}
                disabled={loading || !hasCatalogProducts}
              >
                {t(uiLocale, "common.filter.all")}
              </button>
              {quickAddCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`h-8 rounded-full border px-3 text-xs ${
                    quickAddCategoryId === category.id
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-slate-300 bg-white text-slate-600"
                  }`}
                  onClick={() => setQuickAddCategoryId(category.id)}
                  disabled={loading || !hasCatalogProducts}
                >
                  {category.name} ({category.count})
                </button>
              ))}
            </div>
          </div>

          {scanMessage ? <p className="text-xs text-emerald-700">{scanMessage}</p> : null}

          {notFoundBarcode ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
              <p className="text-xs text-amber-700">
                {t(uiLocale, "orders.create.products.notFoundBarcode.prefix")}{" "}
                <span className="font-semibold">{notFoundBarcode}</span>{" "}
                {t(uiLocale, "orders.create.products.notFoundBarcode.suffix")}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500/70" />
                  <input
                    type="text"
                    className="h-10 w-full rounded-md border border-amber-300 bg-white pr-3 pl-9 text-sm outline-none ring-primary focus:ring-2"
                    placeholder={t(uiLocale, "orders.create.products.manualSearch.placeholder")}
                    value={manualSearchKeyword}
                    onChange={(event) => setManualSearchKeyword(event.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-10 rounded-md border border-amber-300 px-3 text-xs font-medium text-amber-700"
                    onClick={openScannerSheet}
                    disabled={loading}
                  >
                    {t(uiLocale, "orders.create.products.action.scanAgain")}
                  </button>
                  <button
                    type="button"
                    className="h-10 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-600"
                    onClick={() => {
                      setNotFoundBarcode(null);
                      setManualSearchKeyword("");
                    }}
                    disabled={loading}
                  >
                    {t(uiLocale, "common.action.close")}
                  </button>
                </div>
              </div>
              {manualSearchKeyword.trim() ? (
                manualSearchResults.length > 0 ? (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-amber-200 bg-white p-1">
                    {manualSearchResults.map((product) => (
                      <button
                        key={product.productId}
                        type="button"
                        className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-xs hover:bg-amber-100"
                        onClick={() => pickProductFromManualSearch(product.productId)}
                        disabled={loading}
                      >
                        <span className="font-medium text-slate-800">
                          {product.sku} - {product.name}
                        </span>
                        <span className="text-slate-500">{product.barcode ?? "—"}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">
                    {t(uiLocale, "orders.create.products.manualSearch.noMatch")}
                  </p>
                )
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {t(uiLocale, "orders.create.products.sectionTitle")}
              </p>
              <p className="text-xs text-slate-500">
                {quickAddProducts.length.toLocaleString(numberLocale)} {t(uiLocale, "orders.unit.items")}
              </p>
            </div>
            {!hasCatalogProducts ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-slate-500">
                {t(uiLocale, "orders.create.products.quickAdd.emptyCatalog")}
              </p>
            ) : quickAddProducts.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-slate-500">
                {t(uiLocale, "orders.create.products.quickAdd.noMatch")}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {quickAddProducts.map((product) => (
                  (() => {
                    const availableSellUnits = getAvailableSellUnits(product);
                    const canQuickAdd = availableSellUnits.length > 0;
                    return (
                      <button
                        key={product.productId}
                        type="button"
                        className="space-y-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                        onClick={() => {
                          const addedProduct = beginAddProductFromCatalog(product.productId, "quick-add");
                          if (addedProduct) {
                            setScanMessage(
                              `${t(uiLocale, "orders.create.scan.addedProduct.prefix")} ${addedProduct.sku} - ${addedProduct.name} ${t(uiLocale, "orders.create.scan.addedProduct.suffix")}`,
                            );
                          }
                        }}
                        disabled={loading}
                      >
                        <div className="relative h-12 w-12 overflow-hidden rounded-md border border-slate-200 bg-slate-100 sm:h-14 sm:w-14">
                          {product.imageUrl ? (
                            <Image
                              src={product.imageUrl}
                              alt={product.name}
                              fill
                              sizes="(min-width: 1280px) 56px, (min-width: 640px) 56px, 48px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-400">
                              {t(uiLocale, "common.noImageShort")}
                            </div>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-slate-500">{product.sku}</p>
                        <p className="line-clamp-2 text-[13px] font-medium text-slate-900 sm:text-sm">
                          {product.name}
                        </p>
                        <p className="text-[11px] font-semibold text-blue-700 sm:text-xs">
                          {getProductDefaultUnitPrice(product).toLocaleString(numberLocale)} {catalog.storeCurrency}
                        </p>
                        <p className="text-[10px] text-slate-500">{product.units.map((unit) => unit.unitCode).join(" • ")}</p>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-slate-500">
                            {t(uiLocale, "orders.create.products.stockRemainingPrefix")}{" "}
                            {product.available.toLocaleString(numberLocale)}
                          </p>
                          {canQuickAdd ? (
                            <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                              {t(uiLocale, "orders.create.products.quickAdd.addPrefix")}
                            </span>
                          ) : (
                            <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                              {t(uiLocale, "orders.create.products.outOfStockShort")}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })()
                ))}
              </div>
            )}
          </section>

          <aside
            ref={createOnlyCartStickyRef}
            className="hidden rounded-2xl border border-slate-200 bg-white p-3 md:sticky md:flex md:min-h-[26rem] md:flex-col md:overflow-hidden"
            style={{
              top: desktopCartStickyTop,
              height: `calc(100dvh - ${desktopCartStickyTop} - 2.5rem)`,
            }}
          >
            <div className="flex items-center justify-between gap-2 pb-2">
              <p className="text-sm font-semibold text-slate-900">
                {t(uiLocale, "orders.create.cart.title")} ({watchedItems.length.toLocaleString(numberLocale)})
              </p>
              <button
                type="button"
                className="text-xs font-medium text-blue-700 disabled:text-slate-400"
                onClick={() => setShowCartSheet(true)}
                disabled={loading || watchedItems.length === 0}
              >
                {t(uiLocale, "orders.create.cart.expand")}
              </button>
            </div>

            {watchedItems.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-xs text-slate-500">
                {t(uiLocale, "orders.create.products.emptyCart")}
              </p>
            ) : (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {watchedItems.map((item, index) => {
                  const selectedProduct = productsById.get(item.productId ?? "");
                  const selectedUnit = selectedProduct?.units.find((unit) => unit.unitId === item.unitId);
                  const availableQty = getProductAvailableQty(item.productId ?? "");
                  const currentQty = Number(item.qty ?? 0) || 0;
                  const lineTotal = (Number(item.qty ?? 0) || 0) * (selectedUnit?.pricePerUnit ?? 0);

                  return (
                    <div
                      key={`${item.productId}-${index}`}
                      className="space-y-1.5 rounded-lg border border-slate-200 p-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-900">
                            {selectedProduct?.name ?? t(uiLocale, "orders.create.products.productNotFound")}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {t(uiLocale, "orders.create.products.stockRemainingPrefix")}{" "}
                            {selectedProduct?.available.toLocaleString(numberLocale) ?? 0}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-[11px] text-red-600"
                          onClick={() => remove(index)}
                          disabled={loading}
                        >
                          {t(uiLocale, "common.action.delete")}
                        </button>
                      </div>

                      <div className="grid grid-cols-[minmax(0,1fr)_auto_6.5rem] items-center gap-1.5">
                        <select
                          className="h-7 w-full min-w-0 rounded-md border px-2 text-[11px] outline-none ring-primary focus:ring-2"
                          value={item.unitId ?? ""}
                          onChange={(event) => setItemUnit(index, event.target.value)}
                          disabled={loading}
                        >
                          {selectedProduct?.units.map((unit) => (
                            <option key={unit.unitId} value={unit.unitId}>
                              {unit.unitCode}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="h-7 w-7 rounded-md border text-xs text-slate-700"
                            onClick={() => decreaseItemQty(index)}
                            disabled={loading}
                            aria-label={t(uiLocale, "orders.create.products.qty.decreaseAria")}
                          >
                            -
                          </button>
                          <div className="min-w-7 text-center text-xs font-medium text-slate-900">
                            {(Number(item.qty ?? 0) || 0).toLocaleString(numberLocale)}
                          </div>
                          <button
                            type="button"
                            className="h-7 w-7 rounded-md border text-xs text-slate-700"
                            onClick={() => increaseItemQty(index)}
                            disabled={loading || availableQty <= 0 || currentQty >= availableQty}
                            aria-label={t(uiLocale, "orders.create.products.qty.increaseAria")}
                          >
                            +
                          </button>
                        </div>
                        <span className="text-right text-xs font-semibold tabular-nums text-slate-900">
                          {lineTotal.toLocaleString(numberLocale)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 shrink-0 space-y-2 border-t border-slate-200 bg-white pt-3">
              <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-xs">
                <p className="text-slate-600">
                  {watchedItems.length.toLocaleString(numberLocale)} {t(uiLocale, "orders.unit.items")} •{" "}
                  {cartQtyTotal.toLocaleString(numberLocale)} {t(uiLocale, "orders.unit.pcs")}
                </p>
                <p className="text-base font-semibold text-slate-900">
                  {totals.total.toLocaleString(numberLocale)} {catalog.storeCurrency}
                </p>
              </div>

              <Button
                type="button"
                className="h-10 w-full"
                onClick={openCheckoutSheet}
                disabled={loading || watchedItems.length === 0}
              >
                {t(uiLocale, "orders.create.action.nextPayment")}
              </Button>
            </div>
          </aside>
        </div>

        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-30 md:hidden">
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
              <p>
                {watchedItems.length.toLocaleString(numberLocale)} {t(uiLocale, "orders.unit.items")} •{" "}
                {cartQtyTotal.toLocaleString(numberLocale)} {t(uiLocale, "orders.unit.pcs")}
              </p>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-full border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 shadow-sm active:bg-blue-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                onClick={() => setShowCartSheet(true)}
                disabled={watchedItems.length === 0}
              >
                {t(uiLocale, "orders.create.cart.title")}
              </button>
            </div>
            <button
              type="button"
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm disabled:bg-slate-300"
              onClick={openCheckoutSheet}
              disabled={watchedItems.length === 0 || loading}
            >
              {t(uiLocale, "orders.create.action.nextPayment")} {totals.total.toLocaleString(numberLocale)}{" "}
              {catalog.storeCurrency}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-4">
      {isCreateOnlyMode ? (
        canCreate ? (
          renderCreateOnlyPosCatalog()
        ) : (
          <p className="text-sm text-red-600">{t(uiLocale, "orders.create.error.noPermission")}</p>
        )
      ) : (
        <>
          <article className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold">{t(uiLocale, "orders.management.listTitle")}</h2>
                <p className="text-xs text-slate-500">
                  {t(uiLocale, "orders.management.queueDescription")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {visibleOrders.length > 0 ? (
                  <Button
                    type="button"
                    variant={isDesktopBulkSelectMode ? "default" : "outline"}
                    className="hidden h-9 px-3 text-xs md:inline-flex"
                    disabled={
                      quickActionLoadingKey !== null ||
                      bulkActionLoadingKey !== null ||
                      bulkPrintLoadingKind !== null
                    }
                    onClick={toggleDesktopBulkSelectMode}
                  >
                    {isDesktopBulkSelectMode
                      ? t(uiLocale, "orders.management.bulk.exitMode")
                      : t(uiLocale, "orders.management.bulk.enterMode")}
                  </Button>
                ) : null}
                {visibleOrders.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={`h-9 px-2 text-xs sm:px-3 sm:text-sm ${
                      isDesktopBulkSelectMode ? "" : "md:hidden"
                    }`}
                    disabled={
                      quickActionLoadingKey !== null ||
                      bulkActionLoadingKey !== null ||
                      bulkPrintLoadingKind !== null
                    }
                    aria-label={
                      areAllVisibleOrdersSelected
                        ? t(uiLocale, "orders.management.bulk.clearSelection")
                        : t(uiLocale, "orders.management.bulk.selectAllVisible")
                    }
                    title={
                      areAllVisibleOrdersSelected
                        ? t(uiLocale, "orders.management.bulk.clearSelection")
                        : t(uiLocale, "orders.management.bulk.selectAllVisible")
                    }
                    onClick={() => {
                      if (areAllVisibleOrdersSelected) {
                        clearSelectedOrders();
                        return;
                      }
                      toggleSelectAllVisibleOrders();
                    }}
                  >
                    {areAllVisibleOrdersSelected ? (
                      <X className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <CheckCheck className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">
                      {areAllVisibleOrdersSelected
                        ? t(uiLocale, "orders.management.bulk.clearSelectionShort")
                        : t(uiLocale, "orders.management.bulk.selectAllVisibleShort")}
                    </span>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className="h-9 gap-1.5 px-3 text-xs sm:text-sm"
                  onClick={() => router.push("/orders/new")}
                  disabled={!canCreate || loading}
                >
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  <span>{t(uiLocale, "orders.management.enterPosMode")}</span>
                </Button>
              </div>
            </div>

            <form
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                applyManageSearch(manageSearchInput);
              }}
            >
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="h-10 w-full min-w-0 rounded-md border bg-white pl-10 pr-10 text-sm outline-none ring-primary focus:ring-2"
                  placeholder={t(uiLocale, "orders.management.search.placeholder")}
                  value={manageSearchInput}
                  onChange={(event) => setManageSearchInput(event.target.value)}
                  disabled={
                    quickActionLoadingKey !== null ||
                    bulkActionLoadingKey !== null ||
                    bulkPrintLoadingKind !== null
                  }
                  aria-label={t(uiLocale, "orders.management.search.placeholder")}
                />
                {manageSearchInput ? (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                    onClick={() => {
                      setManageSearchInput("");
                      applyManageSearch("");
                    }}
                    aria-label={t(uiLocale, "common.action.clear")}
                    title={t(uiLocale, "common.action.clear")}
                    disabled={
                      quickActionLoadingKey !== null ||
                      bulkActionLoadingKey !== null ||
                      bulkPrintLoadingKind !== null
                    }
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-10 p-0"
                disabled={
                  quickActionLoadingKey !== null ||
                  bulkActionLoadingKey !== null ||
                  bulkPrintLoadingKind !== null
                }
                onClick={openScannerSheet}
                aria-label={t(uiLocale, "orders.management.search.scan")}
                title={t(uiLocale, "orders.management.search.scan")}
              >
                <QrCode className="h-4 w-4" />
              </Button>
              <Button
                type="submit"
                className="h-10 gap-1.5 px-3 text-xs sm:text-sm"
                disabled={
                  isManageSearchPending ||
                  quickActionLoadingKey !== null ||
                  bulkActionLoadingKey !== null ||
                  bulkPrintLoadingKind !== null
                }
              >
                {isManageSearchPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Search className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{t(uiLocale, "orders.management.search.submit")}</span>
              </Button>
            </form>

            {activeSearchQuery ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p>
                  {t(uiLocale, "orders.management.search.activePrefix")}{" "}
                  <span className="font-medium text-slate-800">{activeSearchQuery}</span> •{" "}
                  {(ordersPage?.total ?? 0).toLocaleString(numberLocale)}{" "}
                  {t(uiLocale, "orders.management.search.resultCountSuffix")}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2 text-xs"
                  onClick={() => applyManageSearch("")}
                  disabled={isManageSearchPending}
                >
                  {t(uiLocale, "orders.management.search.clear")}
                </Button>
              </div>
            ) : null}

            <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max gap-2 px-1">
                {tabOptions.map((tab) => {
                  const count = ordersPage?.queueCounts[tab.key] ?? 0;
                  const isPending = isTabPending && pendingTab === tab.key;
                  const isActive = activeTab === tab.key || isPending;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => handleTabChange(tab.key)}
                      aria-pressed={isActive}
                      disabled={isPending}
                      className={`inline-flex min-w-[8.5rem] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                        isActive
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                      }`}
                    >
                      <span className="font-medium">{t(uiLocale, tab.labelKey)}</span>
                      <span
                        className={`inline-flex min-w-[2.75rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] ${
                          isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          count.toLocaleString(numberLocale)
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </article>

          <section className="space-y-2" aria-busy={isOrdersTabTransitioning}>
            {isOrdersTabTransitioning ? (
              <>
                <article className="rounded-xl border bg-white p-4 text-sm text-muted-foreground shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-700">
                        {t(
                          uiLocale,
                          pendingTabOption?.labelKey ?? activeTabOption.labelKey,
                        )}
                      </p>
                      <p className="mt-1">{t(uiLocale, "common.loading")}</p>
                    </div>
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  </div>
                </article>

                <div className="space-y-2 md:hidden">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <article
                      key={`orders-mobile-skeleton-${index}`}
                      className="rounded-xl border bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
                          <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
                          <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
                        </div>
                        <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
                      </div>
                      <div className="mt-4 h-4 w-24 animate-pulse rounded bg-slate-200" />
                      <div className="mt-4 rounded-lg bg-slate-50 px-3 py-3">
                        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                        <div className="mt-2 h-4 w-32 animate-pulse rounded bg-slate-200" />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="h-9 animate-pulse rounded-md bg-slate-200" />
                        <div className="h-9 animate-pulse rounded-md bg-slate-100" />
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-xl border bg-white shadow-sm md:block">
                  <div className="space-y-3 p-4">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={`orders-desktop-skeleton-${index}`}
                        className="grid grid-cols-[7rem_1.4fr_1fr_0.9fr_1fr_9rem_10rem] items-center gap-3 rounded-lg border border-slate-100 px-3 py-3"
                      >
                        <div className="h-4 animate-pulse rounded bg-slate-200" />
                        <div className="h-4 animate-pulse rounded bg-slate-200" />
                        <div className="h-4 animate-pulse rounded bg-slate-100" />
                        <div className="h-4 animate-pulse rounded bg-slate-100" />
                        <div className="h-4 animate-pulse rounded bg-slate-100" />
                        <div className="h-6 animate-pulse rounded-full bg-slate-100" />
                        <div className="h-8 animate-pulse rounded-md bg-slate-200" />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : visibleOrders.length === 0 ? (
              <article className="rounded-xl border bg-white p-4 text-sm text-muted-foreground shadow-sm">
                <p className="font-medium text-slate-700">{t(uiLocale, activeTabOption.labelKey)}</p>
                <p className="mt-1">
                  {activeSearchQuery
                    ? t(uiLocale, "orders.management.search.empty")
                    : t(uiLocale, "orders.page.emptyTab")}
                </p>
              </article>
            ) : (
              <>
                <div className="space-y-2 md:hidden">
                  {visibleOrders.map((order) => {
                    const badges = buildOrderStatusBadges(uiLocale, order);
                    const quickAction = getOrderListQuickAction(order, orderQuickActionPermissions);
                    const secondaryQuickAction = getOrderListSecondaryQuickAction(
                      order,
                      orderQuickActionPermissions,
                    );
                    const showPackAction = canOpenOrderPackView(order);
                    const quickActionLoading =
                      quickActionLoadingKey !== null &&
                      quickAction !== null &&
                      quickActionLoadingKey ===
                        buildOrderQuickActionLoadingKey(order.id, quickAction.key);
                    const secondaryQuickActionLoading =
                      quickActionLoadingKey !== null &&
                      secondaryQuickAction !== null &&
                      quickActionLoadingKey ===
                        buildOrderQuickActionLoadingKey(order.id, secondaryQuickAction.key);
                    return (
                      <article
                        key={order.id}
                        className="block rounded-xl border bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                checked={selectedOrderIdSet.has(order.id)}
                                disabled={
                                  quickActionLoadingKey !== null ||
                                  bulkActionLoadingKey !== null ||
                                  bulkPrintLoadingKind !== null
                                }
                                onChange={() => toggleOrderSelection(order.id)}
                                aria-label={`${t(uiLocale, "orders.management.bulk.selectOrder")} ${order.orderNo}`}
                              />
                              <span>{order.orderNo}</span>
                            </label>
                            <h3 className="text-sm font-semibold">
                              {order.customerName ||
                                order.contactDisplayName ||
                                t(uiLocale, "orders.customer.guest")}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {t(uiLocale, channelSummaryLabelKey(order))} • {order.paymentCurrency} •{" "}
                              {t(uiLocale, paymentMethodLabelKey[order.paymentMethod])}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {badges.map((badge) => (
                              <span
                                key={`${order.id}-${badge.label}-${badge.className}`}
                                className={`rounded-full px-2 py-1 text-xs ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="mt-2 text-sm font-medium">
                          {order.total.toLocaleString(numberLocale)} {catalog.storeCurrency}
                        </p>
                        <div className="mt-3 space-y-2">
                          <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">
                              {t(uiLocale, "orders.management.quickAction.nextStepLabel")}
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-800">
                              {quickAction
                                ? t(uiLocale, quickAction.labelKey)
                                : t(uiLocale, "orders.management.quickAction.none")}
                            </p>
                            {quickAction && "reasonKey" in quickAction && quickAction.reasonKey ? (
                              <p className="mt-1 text-xs text-slate-500">
                                {t(uiLocale, quickAction.reasonKey)}
                              </p>
                            ) : null}
                          </div>
                          <div className="grid gap-2">
                            <Button
                              type="button"
                              variant={quickAction?.type === "patch" ? "default" : "outline"}
                              className="h-9 text-xs"
                              disabled={
                                !quickAction ||
                                loading ||
                                quickActionLoadingKey !== null ||
                                bulkActionLoadingKey !== null ||
                                bulkPrintLoadingKind !== null
                              }
                              onClick={() => handleOrderQuickAction(order, quickAction)}
                            >
                              {quickActionLoading
                                ? t(uiLocale, "common.action.saving")
                                : quickAction?.type === "detail"
                                  ? t(uiLocale, "orders.management.action.viewDetails")
                                  : quickAction
                                    ? t(uiLocale, quickAction.labelKey)
                                    : t(uiLocale, "orders.management.quickAction.none")}
                            </Button>
                            <div className="flex flex-wrap gap-2">
                              {secondaryQuickAction ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 flex-1 border-orange-300 px-2 text-xs text-orange-700 hover:bg-orange-50"
                                  disabled={
                                    loading ||
                                    quickActionLoadingKey !== null ||
                                    bulkActionLoadingKey !== null ||
                                    bulkPrintLoadingKind !== null
                                  }
                                  onClick={() => handleOrderQuickAction(order, secondaryQuickAction)}
                                >
                                  {secondaryQuickActionLoading
                                    ? t(uiLocale, "common.action.saving")
                                    : t(uiLocale, secondaryQuickAction.labelKey)}
                                </Button>
                              ) : null}
                              {showPackAction ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 flex-1 text-xs"
                                  disabled={
                                    loading ||
                                    quickActionLoadingKey !== null ||
                                    bulkActionLoadingKey !== null ||
                                    bulkPrintLoadingKind !== null ||
                                    isOrderPackSheetBusy
                                  }
                                  onClick={() => openOrderPackSheet({ id: order.id, orderNo: order.orderNo })}
                                >
                                  {t(uiLocale, "orders.detail.actions.packView")}
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 flex-1 rounded-lg border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                disabled={
                                  bulkActionLoadingKey !== null ||
                                  bulkPrintLoadingKind !== null ||
                                  isOrderPackSheetBusy
                                }
                                onClick={() => router.push(`/orders/${order.id}`)}
                              >
                                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                {t(uiLocale, "orders.management.action.open")}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="hidden overflow-hidden rounded-xl border bg-white shadow-sm md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-muted-foreground">
                      {ordersTable.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              className={`px-3 py-2 font-medium ${
                                header.column.id === "select" ? "w-12" : ""
                              }`}
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {ordersTable.getRowModel().rows.map((row) => (
                        <tr
                          key={row.id}
                          className={`border-t transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                            isDesktopBulkSelectMode
                              ? "cursor-default hover:bg-blue-50/80"
                              : "cursor-pointer hover:bg-slate-50"
                          } ${
                            selectedOrderIdSet.has(row.original.id) ? "bg-blue-50/70" : ""
                          }`}
                          role={isDesktopBulkSelectMode ? "checkbox" : "link"}
                          tabIndex={0}
                          aria-checked={
                            isDesktopBulkSelectMode
                              ? selectedOrderIdSet.has(row.original.id)
                              : undefined
                          }
                          aria-label={
                            isDesktopBulkSelectMode
                              ? `${t(uiLocale, "orders.management.bulk.selectOrder")} ${row.original.orderNo}`
                              : `${t(uiLocale, "orders.management.table.openOrderAria.prefix")} ${row.original.orderNo}`
                          }
                          onClick={() => {
                            if (isDesktopBulkSelectMode) {
                              toggleOrderSelection(row.original.id);
                              return;
                            }
                            router.push(`/orders/${row.original.id}`);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              if (isDesktopBulkSelectMode) {
                                toggleOrderSelection(row.original.id);
                                return;
                              }
                              router.push(`/orders/${row.original.id}`);
                            }
                          }}
                        >
                          {row.getVisibleCells().map((cell, index) => (
                            <td
                              key={cell.id}
                              className={`px-3 py-3 ${
                                cell.column.id === "select" || (index === 0 && isDesktopBulkSelectMode)
                                  ? "w-12 align-middle"
                                  : ""
                              }`}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-xs">
                  <p className="text-muted-foreground">
                    {t(uiLocale, "orders.pagination.pagePrefix")}{" "}
                    {ordersPage!.page.toLocaleString(numberLocale)} /{" "}
                    {ordersPage!.pageCount.toLocaleString(numberLocale)} (
                    {ordersPage!.total.toLocaleString(numberLocale)} {t(uiLocale, "orders.pagination.itemsSuffix")})
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 px-2 text-xs"
                      disabled={ordersPage!.page <= 1}
                      onClick={() => router.push(buildOrdersUrl(activeTab, ordersPage!.page - 1))}
                    >
                      {t(uiLocale, "orders.pagination.prev")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 px-2 text-xs"
                      disabled={ordersPage!.page >= ordersPage!.pageCount}
                      onClick={() => router.push(buildOrdersUrl(activeTab, ordersPage!.page + 1))}
                    >
                      {t(uiLocale, "orders.pagination.next")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>

        </>
      )}
      <SlideUpSheet
        isOpen={showScannerPermissionSheet}
        onClose={() => setShowScannerPermissionSheet(false)}
        title={t(uiLocale, "products.scannerPermission.title")}
        description={t(uiLocale, "products.scannerPermission.description")}
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-medium text-slate-700">
              {t(uiLocale, "products.scannerPermission.whyTitle")}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>{t(uiLocale, "products.scannerPermission.bullet.fast")}</li>
              <li>{t(uiLocale, "products.scannerPermission.bullet.fewerTypos")}</li>
              <li>{t(uiLocale, "products.scannerPermission.bullet.ready")}</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1"
              onClick={() => setShowScannerPermissionSheet(false)}
            >
              {t(uiLocale, "common.action.cancel")}
            </Button>
            <Button
              type="button"
              className="h-10 flex-1"
              onClick={() => {
                window.localStorage.setItem(SCANNER_PERMISSION_STORAGE_KEY, "1");
                setHasSeenScannerPermission(true);
                setShowScannerPermissionSheet(false);
                setShowScannerSheet(true);
              }}
            >
              {t(uiLocale, "products.scannerPermission.allowAndScan")}
            </Button>
          </div>
        </div>
      </SlideUpSheet>
      <SlideUpSheet
        isOpen={showScannerSheet}
        onClose={() => setShowScannerSheet(false)}
        title={t(uiLocale, "products.scanner.title")}
        description={t(
          uiLocale,
          isCreateOnlyMode
            ? "orders.create.scanner.description"
            : "orders.management.search.scannerDescription",
        )}
        disabled={loading}
      >
        <div className="p-4">
          {showScannerSheet ? (
            <BarcodeScannerPanel
              isOpen={showScannerSheet}
              onResult={onScanBarcodeResult}
              onClose={() => setShowScannerSheet(false)}
              cameraSelectId="orders-barcode-scanner-camera-select"
              scanMode={isCreateOnlyMode ? "barcode" : "qr"}
            />
          ) : null}
        </div>
      </SlideUpSheet>
      <SlideUpSheet
        isOpen={productUnitPicker !== null}
        onClose={() => setProductUnitPicker(null)}
        title={t(uiLocale, "orders.create.products.unitPicker.title")}
        description={t(uiLocale, "orders.create.products.unitPicker.description")}
        disabled={loading}
      >
        {productUnitPicker ? (
          <div className="space-y-3 p-4">
            {(() => {
              const product = productsById.get(productUnitPicker.productId);
              if (!product) {
                return (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-slate-500">
                    {t(uiLocale, "orders.create.products.productNotFound")}
                  </p>
                );
              }

              const availableUnits = getAvailableSellUnits(product);
              if (availableUnits.length <= 0) {
                return (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-slate-500">
                    {t(uiLocale, "orders.create.products.outOfStockBadge")}
                  </p>
                );
              }

              return (
                <>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{product.sku}</p>
                    <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                  </div>
                  <div className="space-y-2">
                    {availableUnits.map((unit) => {
                      const maxQty = getProductAvailableQty(product.productId, unit.unitId);
                      return (
                        <button
                          key={unit.unitId}
                          type="button"
                          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-left hover:border-blue-300 hover:bg-blue-50"
                          onClick={() => confirmAddProductUnit(unit.unitId)}
                          disabled={loading || maxQty <= 0}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">{unit.unitCode}</p>
                            <p className="text-xs text-slate-500">
                              {unit.multiplierToBase.toLocaleString(numberLocale)} {product.baseUnitCode}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-blue-700">
                              {unit.pricePerUnit.toLocaleString(numberLocale)} {catalog.storeCurrency}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {t(uiLocale, "orders.create.products.unitPicker.availablePrefix")}{" "}
                              {maxQty.toLocaleString(numberLocale)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}
      </SlideUpSheet>
      <SlideUpSheet
        isOpen={showOrderPackSheet !== null}
        onClose={() => {
          if (isOrderPackSheetBusy) {
            return;
          }
          setShowOrderPackSheet(null);
        }}
        title={t(uiLocale, "orders.pack.page.title")}
        description={t(uiLocale, "orders.pack.page.subtitle")}
        panelMaxWidthClass="min-[1200px]:max-w-5xl"
        disabled={isOrderPackSheetBusy}
        scrollToTopOnOpen
        footer={
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full rounded-xl"
              onClick={() => setShowOrderPackSheet(null)}
              disabled={isOrderPackSheetBusy}
            >
              {t(uiLocale, "common.action.close")}
            </Button>
            <Button
              type="button"
              className="h-10 w-full rounded-xl"
              onClick={handlePrintOrderPackFromList}
              disabled={isOrderPackSheetBusy || !orderPackPreview}
            >
              {orderPackPrintLoading
                ? t(uiLocale, "orders.detail.actions.print.loading")
                : t(uiLocale, "orders.detail.actions.print.pack")}
            </Button>
          </div>
        }
      >
        <div className="pb-1">
          {orderPackPreviewLoading ? (
            <p className="rounded-lg border border-dashed p-3 text-sm text-slate-500">
              {t(uiLocale, "common.loading")}
            </p>
          ) : orderPackPreviewError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {orderPackPreviewError}
            </p>
          ) : orderPackPreview ? (
            <OrderPackContent
              order={orderPackPreview}
              uiLocale={uiLocale}
              numberLocale={numberLocale}
              storeCurrencyDisplay={orderPackPreview.storeCurrency}
              className="px-1"
            />
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-sm text-slate-500">
              {showOrderPackSheet?.orderNo ?? t(uiLocale, "orders.customer.guest")}
            </p>
          )}
        </div>
      </SlideUpSheet>
      {isCreateOnlyMode ? (
        <SlideUpSheet
          isOpen={showRecentOrdersSheet}
          onClose={() => setShowRecentOrdersSheet(false)}
          title={t(uiLocale, "orders.create.recentOrders.title")}
          description={`${t(uiLocale, "orders.create.recentOrders.description.prefix")} ${CREATE_ONLY_RECENT_ORDERS_LIMIT.toLocaleString(numberLocale)} ${t(uiLocale, "orders.create.recentOrders.description.suffix")}`}
          disabled={recentOrdersLoading}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-600">
                {t(uiLocale, "orders.create.recentOrders.instruction.prefix")}{" "}
                <span className="font-semibold text-slate-800">
                  {t(uiLocale, "orders.action.openSummary")}
                </span>{" "}
                {t(uiLocale, "orders.create.recentOrders.instruction.suffix")}
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-8 px-2 text-xs"
                onClick={() => {
                  void fetchRecentOrders();
                }}
                disabled={recentOrdersLoading}
              >
                {recentOrdersLoading ? t(uiLocale, "common.loading") : t(uiLocale, "common.action.refresh")}
              </Button>
            </div>
            {recentOrdersLoading ? (
              <p className="rounded-lg border border-dashed p-3 text-xs text-slate-500">
                {t(uiLocale, "orders.create.recentOrders.loading")}
              </p>
            ) : recentOrdersError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                {recentOrdersError}
              </p>
            ) : recentOrders.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-xs text-slate-500">
                {t(uiLocale, "orders.create.recentOrders.empty")}
              </p>
            ) : (
              <div className="space-y-2">
                {recentOrders.map((order) => (
                  <div key={order.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{order.orderNo}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(order.createdAt).toLocaleString(numberLocale)}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                        {t(uiLocale, checkoutFlowLabelKey[order.checkoutFlow])}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      {t(uiLocale, "orders.create.recentOrders.totalPrefix")}{" "}
                      {order.total.toLocaleString(numberLocale)} {order.paymentCurrency} •{" "}
                      {t(uiLocale, paymentMethodLabelKey[order.paymentMethod])}
                    </p>
                    <div
                      className={`mt-2 grid gap-2 ${
                        canRequestCancel && CANCELLABLE_ORDER_STATUSES.has(order.status)
                          ? "grid-cols-3"
                          : "grid-cols-2"
                      }`}
                    >
                      <Button
                        type="button"
                        className="h-8 text-xs"
                        onClick={() => openRecentOrderSummary(order)}
                      >
                        {t(uiLocale, "orders.action.openSummary")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => {
                          setShowRecentOrdersSheet(false);
                          router.push(`/orders/${order.id}`);
                        }}
                      >
                        {t(uiLocale, "orders.action.viewDetail")}
                      </Button>
                      {canRequestCancel && CANCELLABLE_ORDER_STATUSES.has(order.status) ? (
                        <Button
                          type="button"
                          className="h-8 bg-rose-600 text-xs text-white hover:bg-rose-700"
                          onClick={() => openRecentOrderCancelModal(order)}
                        >
                          {t(uiLocale, "orders.action.cancelOrder")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SlideUpSheet>
      ) : null}
      <ManagerCancelApprovalModal
        isOpen={cancelApprovalTargetOrder !== null}
        orderNo={cancelApprovalTargetOrder?.orderNo ?? null}
        mode={canSelfApproveCancel ? "SELF_SLIDE" : "MANAGER_PASSWORD"}
        isHighRisk={
          cancelApprovalTargetOrder
            ? cancelApprovalTargetOrder.status === "PAID" ||
              cancelApprovalTargetOrder.status === "PACKED" ||
              cancelApprovalTargetOrder.status === "SHIPPED"
            : false
        }
        busy={cancelApprovalSubmitting}
        onClose={() => {
          if (cancelApprovalSubmitting) {
            return;
          }
          setCancelApprovalTargetOrder(null);
        }}
        onConfirm={cancelRecentOrderWithApproval}
      />
      <SlideUpSheet
        isOpen={showCartSheet}
        onClose={() => setShowCartSheet(false)}
        title={t(uiLocale, "orders.create.cart.sheet.title")}
        description={t(uiLocale, "orders.create.cart.sheet.description")}
        disabled={loading}
      >
        <div className="space-y-3">
          {watchedItems.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-sm text-slate-500">
              {t(uiLocale, "orders.create.products.emptyCart")}
            </p>
          ) : (
            <div className="space-y-2">
              {watchedItems.map((item, index) => {
                const selectedProduct = productsById.get(item.productId ?? "");
                const selectedUnit = selectedProduct?.units.find(
                  (unit) => unit.unitId === item.unitId,
                );
                const availableQty = getProductAvailableQty(item.productId ?? "");
                const currentQty = Number(item.qty ?? 0) || 0;
                const lineTotal =
                  (Number(item.qty ?? 0) || 0) * (selectedUnit?.pricePerUnit ?? 0);

                return (
                  <div key={`${item.productId}-${index}`} className="space-y-2 rounded-lg border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {selectedProduct?.name ?? t(uiLocale, "orders.create.products.productNotFound")}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t(uiLocale, "orders.create.products.stockRemainingPrefix")}{" "}
                          {selectedProduct?.available.toLocaleString(numberLocale) ?? 0}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-red-600"
                        onClick={() => remove(index)}
                        disabled={loading}
                      >
                        {t(uiLocale, "common.action.delete")}
                      </button>
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_auto_8.5rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_9.5rem]">
                      <select
                        className="h-8 w-full min-w-0 rounded-md border px-2 text-xs outline-none ring-primary focus:ring-2"
                        value={item.unitId ?? ""}
                        onChange={(event) => setItemUnit(index, event.target.value)}
                        disabled={loading}
                      >
                        {selectedProduct?.units.map((unit) => (
                          <option key={unit.unitId} value={unit.unitId}>
                            {unit.unitCode}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="h-8 w-8 rounded-md border text-sm text-slate-700"
                          onClick={() => decreaseItemQty(index)}
                          disabled={loading}
                          aria-label={t(uiLocale, "orders.create.products.qty.decreaseAria")}
                        >
                          -
                        </button>
                        <div className="min-w-8 text-center text-xs font-medium text-slate-800">
                          {(Number(item.qty ?? 0) || 0).toLocaleString(numberLocale)}
                        </div>
                        <button
                          type="button"
                          className="h-8 w-8 rounded-md border text-sm text-slate-700"
                          onClick={() => increaseItemQty(index)}
                          disabled={loading || availableQty <= 0 || currentQty >= availableQty}
                          aria-label={t(uiLocale, "orders.create.products.qty.increaseAria")}
                        >
                          +
                        </button>
                      </div>
                      <p className="text-right text-sm font-semibold tabular-nums text-slate-900">
                        {lineTotal.toLocaleString(numberLocale)} {catalog.storeCurrency}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p>
              {t(uiLocale, "orders.create.cart.summary.qtyPrefix")}: {cartQtyTotal.toLocaleString(numberLocale)}{" "}
              {t(uiLocale, "orders.unit.pcs")} ({watchedItems.length.toLocaleString(numberLocale)}{" "}
              {t(uiLocale, "orders.unit.items")})
            </p>
            <p className="font-semibold">
              {t(uiLocale, "orders.print.receipt.summary.netTotal")}:{" "}
              {totals.total.toLocaleString(numberLocale)} {catalog.storeCurrency}
            </p>
          </div>

          {isCreateOnlyMode ? (
            <div className="space-y-2">
              <Button type="button" className="h-10 w-full" onClick={openCheckoutSheet}>
                {t(uiLocale, "orders.create.cart.sheet.checkoutCta")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full"
                onClick={() => setShowCartSheet(false)}
              >
                {t(uiLocale, "orders.create.products.action.backToProducts")}
              </Button>
            </div>
          ) : (
            <Button type="button" className="h-10 w-full" onClick={() => setShowCartSheet(false)}>
              {t(uiLocale, "orders.management.cartSheet.backToForm")}
            </Button>
          )}
        </div>
      </SlideUpSheet>
      {isCreateOnlyMode ? (
        <SlideUpSheet
          isOpen={showCheckoutSheet}
          onClose={requestCloseCheckoutSheet}
          closeOnBackdrop={false}
          scrollToTopOnOpen
          title={t(uiLocale, "orders.create.details.sheet.title")}
          description={t(uiLocale, "orders.create.details.sheet.description")}
          disabled={loading}
          footer={
            <Button
              type="submit"
              form={CREATE_ORDER_CHECKOUT_SHEET_FORM_ID}
              className="h-10 w-full"
              disabled={loading || !canCreate}
            >
              {loading ? t(uiLocale, "common.action.saving") : t(uiLocale, "orders.create.action.submit")}
            </Button>
          }
        >
          {renderCreateOrderForm({ inSheet: true })}
        </SlideUpSheet>
      ) : null}
      {showCheckoutSheet && showCheckoutCloseConfirm ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/40 px-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowCheckoutCloseConfirm(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-close-confirm-title"
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
          >
            <h3 id="checkout-close-confirm-title" className="text-sm font-semibold text-slate-900">
              {t(uiLocale, "orders.create.details.closeConfirm.title")}
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              {t(uiLocale, "orders.create.details.closeConfirm.description")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9"
                onClick={() => setShowCheckoutCloseConfirm(false)}
              >
                {t(uiLocale, "orders.create.details.closeConfirm.backEdit")}
              </Button>
              <Button type="button" className="h-9" onClick={closeCheckoutSheet}>
                {t(uiLocale, "orders.create.details.closeConfirm.close")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {showQrImageViewer && selectedQrPaymentAccount?.qrImageUrl ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/85 px-3 py-6 sm:px-6"
          onClick={() => setShowQrImageViewer(false)}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-2.5 text-slate-100">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{selectedQrPaymentAccount.displayName}</p>
                <p className="truncate text-xs text-slate-400">{t(uiLocale, "orders.qrViewer.sameTabHint")}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500"
                  onClick={openQrImageInNewTab}
                  aria-label={t(uiLocale, "orders.qrViewer.openNewTabAria")}
                  title={t(uiLocale, "orders.qrViewer.openNewTabAria")}
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500"
                  onClick={() => {
                    void downloadQrImage();
                  }}
                  aria-label={t(uiLocale, "orders.qrViewer.downloadAria")}
                  title={t(uiLocale, "orders.qrViewer.downloadAria")}
                >
                  <ArrowDownToLine className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500"
                  onClick={() => setShowQrImageViewer(false)}
                  aria-label={t(uiLocale, "orders.qrViewer.closeAria")}
                  title={t(uiLocale, "orders.qrViewer.closeAria")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex max-h-[calc(100dvh-9rem)] items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(148,163,184,0.14),_transparent_60%)] p-4 sm:p-6">
              <Image
                src={selectedQrPaymentAccount.qrImageUrl}
                alt={`QR ${selectedQrPaymentAccount.displayName}`}
                width={1200}
                height={1200}
                className="h-auto max-h-[calc(100dvh-13rem)] w-auto max-w-full rounded-lg object-contain"
                unoptimized
              />
            </div>
          </div>
        </div>
      ) : null}
      {createdOrderSuccess ? (
        <SlideUpSheet
          isOpen={Boolean(createdOrderSuccess)}
          onClose={closeCreatedOrderSuccess}
          title={
            createdOrderSuccess.checkoutFlow === "PICKUP_LATER"
              ? t(uiLocale, "orders.create.success.title.pickup")
              : createdOrderSuccess.checkoutFlow === "ONLINE_DELIVERY"
                ? t(uiLocale, "orders.create.success.title.online")
                : t(uiLocale, "orders.create.success.title.walkIn")
          }
          description={`${t(uiLocale, "orders.table.header.orderNo")} ${createdOrderSuccess.orderNo}`}
        >
          <div className="space-y-3">
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {createdOrderSuccess.checkoutFlow === "PICKUP_LATER"
                ? t(uiLocale, "orders.create.success.hint.pickup")
                : createdOrderSuccess.checkoutFlow === "ONLINE_DELIVERY"
                  ? t(uiLocale, "orders.create.success.hint.online")
                  : t(uiLocale, "orders.create.success.hint.walkIn")}
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-700">
                  {t(uiLocale, "orders.create.success.preview.receipt.title")}
                </p>
                <p className="text-[11px] text-slate-500">
                  {t(uiLocale, "orders.create.success.preview.receipt.note")}
                </p>
              </div>
              {receiptPreviewLoading ? (
                <p className="text-xs text-slate-500">
                  {t(uiLocale, "orders.create.success.preview.receipt.loading")}
                </p>
              ) : receiptPreviewError ? (
                <p className="text-xs text-red-600">{receiptPreviewError}</p>
              ) : receiptPreviewOrder ? (
                <div className="mx-auto w-[80mm] rounded-md border border-slate-200 bg-white p-2 text-[10px] text-slate-900">
                  <p className="text-center text-[11px] font-semibold">
                    {t(uiLocale, "orders.print.receipt.title")}
                  </p>
                  <p className="text-center text-[10px]">
                    {t(uiLocale, "orders.print.receipt.noPrefix")} {receiptPreviewOrder.orderNo}
                  </p>
                  <p className="mt-1.5">
                    {t(uiLocale, "orders.print.receipt.customerPrefix")}{" "}
                    {receiptPreviewOrder.customerName ||
                      receiptPreviewOrder.contactDisplayName ||
                      t(uiLocale, "orders.customer.guest")}
                  </p>
                  <p>
                    {t(uiLocale, "orders.print.receipt.datePrefix")}{" "}
                    {new Date(receiptPreviewOrder.createdAt).toLocaleString(numberLocale)}
                  </p>
                  <div className="my-1 border-t border-dashed border-slate-400" />
                  <div className="space-y-1">
                    {receiptPreviewOrder.items.slice(0, 4).map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{item.productName}</p>
                          <p className="truncate text-[9px] text-slate-500">{item.productSku}</p>
                        </div>
                        <p className="shrink-0 text-right">
                          {item.qty.toLocaleString(numberLocale)} {item.unitCode}
                        </p>
                        <p className="shrink-0 text-right">{item.lineTotal.toLocaleString(numberLocale)}</p>
                      </div>
                    ))}
                    {receiptPreviewOrder.items.length > 4 ? (
                      <p className="text-[9px] text-slate-500">
                        {t(uiLocale, "orders.create.success.preview.receipt.moreItems.prefix")}{" "}
                        {(receiptPreviewOrder.items.length - 4).toLocaleString(numberLocale)}{" "}
                        {t(uiLocale, "orders.create.success.preview.receipt.moreItems.suffix")}
                      </p>
                    ) : null}
                  </div>
                  <div className="my-1 border-t border-dashed border-slate-400" />
                  <p className="flex justify-between">
                    <span>{t(uiLocale, "orders.print.receipt.summary.netTotal")}</span>
                    <span className="font-semibold">
                      {receiptPreviewOrder.total.toLocaleString(numberLocale)} {receiptPreviewOrder.storeCurrency}
                    </span>
                  </p>
                  {receiptPreviewOrder.paymentAccountQrImageUrl ? (
                    <>
                      <div className="my-1 border-t border-dashed border-slate-400" />
                      <div className="space-y-1 text-center">
                        <p className="font-semibold">{t(uiLocale, "orders.print.receipt.qrTitle")}</p>
                        <p className="text-[9px] text-slate-500">
                          {t(uiLocale, "orders.print.receipt.qrHint")}
                        </p>
                        <Image
                          src={
                            receiptPreviewOrder.paymentAccountId
                              ? `/api/orders/payment-accounts/${receiptPreviewOrder.paymentAccountId}/qr-image`
                              : receiptPreviewOrder.paymentAccountQrImageUrl
                          }
                          alt={t(uiLocale, "orders.print.receipt.qrTitle")}
                          width={96}
                          height={96}
                          unoptimized
                          className="mx-auto h-24 w-24 object-contain"
                        />
                        <div className="space-y-0.5 text-left text-[9px] text-slate-600">
                          {receiptPreviewOrder.paymentAccountDisplayName ? (
                            <p>{receiptPreviewOrder.paymentAccountDisplayName}</p>
                          ) : null}
                          {receiptPreviewOrder.paymentAccountBankName ? (
                            <p>
                              {t(uiLocale, "orders.create.paymentAccount.details.bankPrefix")}{" "}
                              {receiptPreviewOrder.paymentAccountBankName}
                            </p>
                          ) : null}
                          {receiptPreviewOrder.paymentAccountNumber ? (
                            <p>
                              {t(uiLocale, "orders.create.paymentAccount.details.accountNumberLabel")}:{" "}
                              {receiptPreviewOrder.paymentAccountNumber}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  {t(uiLocale, "orders.create.success.preview.receipt.empty")}
                </p>
              )}
            </div>
            {createdOrderSuccess.checkoutFlow === "ONLINE_DELIVERY" ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-700">
                    {t(uiLocale, "orders.create.success.preview.label.title")}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {t(uiLocale, "orders.create.success.preview.label.note")}
                  </p>
                </div>
                {receiptPreviewLoading ? (
                  <p className="text-xs text-slate-500">
                    {t(uiLocale, "orders.create.success.preview.label.loading")}
                  </p>
                ) : receiptPreviewError ? (
                  <p className="text-xs text-red-600">{receiptPreviewError}</p>
                ) : receiptPreviewOrder ? (
                  <div className="mx-auto max-w-[320px] rounded-md border border-slate-200 bg-white p-2 text-[10px] text-slate-900">
                    <p className="text-center text-[11px] font-semibold">
                      {t(uiLocale, "orders.print.label.title")}
                    </p>
                    <p className="text-center text-[10px]">
                      {t(uiLocale, "orders.print.label.orderPrefix")} {receiptPreviewOrder.orderNo}
                    </p>
                    <div className="my-1 border-t border-dashed border-slate-400" />
                    <div className="space-y-1">
                      <p className="font-semibold">
                        {receiptPreviewOrder.customerName ||
                          receiptPreviewOrder.contactDisplayName ||
                          t(uiLocale, "orders.customer.guest")}
                      </p>
                      <p>
                        {t(uiLocale, "orders.print.label.phonePrefix")}{" "}
                        {receiptPreviewOrder.customerPhone || receiptPreviewOrder.contactPhone || "-"}
                      </p>
                      <p className="whitespace-pre-wrap">
                        {t(uiLocale, "orders.print.label.addressPrefix")}{" "}
                        {receiptPreviewOrder.customerAddress || "-"}
                      </p>
                    </div>
                    <div className="my-1 border-t border-dashed border-slate-400" />
                    <div className="space-y-0.5 text-[9px] text-slate-700">
                      <p>
                        {t(uiLocale, "orders.print.label.shippingPrefix")}{" "}
                        {receiptPreviewOrder.shippingProvider ||
                          receiptPreviewOrder.shippingCarrier ||
                          "-"}
                      </p>
                      <p>
                        {t(uiLocale, "orders.print.label.trackingPrefix")}{" "}
                        {receiptPreviewOrder.trackingNo ||
                          t(uiLocale, "orders.create.success.preview.label.trackingFallback")}
                      </p>
                      <p>
                        {t(uiLocale, "orders.print.label.shippingCostPrefix")}{" "}
                        {receiptPreviewOrder.shippingCost.toLocaleString(numberLocale)}{" "}
                        {receiptPreviewOrder.storeCurrency}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">{t(uiLocale, "orders.create.success.preview.label.empty")}</p>
                )}
              </div>
            ) : null}
            <Button
              type="button"
              className="h-10 w-full"
              disabled={
                receiptPrintLoading ||
                receiptPreviewLoading ||
                !receiptPreviewOrder ||
                receiptPreviewOrder.id !== createdOrderSuccess.orderId
              }
              onClick={() => openOrderReceiptPrint(createdOrderSuccess.orderId)}
            >
              {receiptPrintLoading
                ? t(uiLocale, "orders.detail.actions.print.loading")
                : createdOrderSuccess.checkoutFlow === "PICKUP_LATER"
                  ? t(uiLocale, "orders.create.success.print.pickupSlip")
                  : t(uiLocale, "orders.detail.actions.print.receipt")}
            </Button>
            {createdOrderSuccess.checkoutFlow === "ONLINE_DELIVERY" ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full"
                disabled={
                  shippingLabelPrintLoading ||
                  receiptPreviewLoading ||
                  !receiptPreviewOrder ||
                  receiptPreviewOrder.id !== createdOrderSuccess.orderId
                }
                onClick={() => openOrderShippingLabelPrint(createdOrderSuccess.orderId)}
              >
                {shippingLabelPrintLoading
                  ? t(uiLocale, "orders.detail.actions.print.loading")
                  : t(uiLocale, "orders.create.success.print.shippingLabel")}
              </Button>
            ) : null}
            {createdOrderSuccess.checkoutFlow === "PICKUP_LATER" ||
            createdOrderSuccess.checkoutFlow === "ONLINE_DELIVERY" ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full"
                onClick={() => openCreatedOrderDetail(createdOrderSuccess.orderId)}
              >
                {t(uiLocale, "orders.create.success.action.viewDetail")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full"
                onClick={closeCreatedOrderSuccess}
              >
                {t(uiLocale, "orders.create.success.action.newOrder")}
              </Button>
            )}
            {createdOrderSuccess.checkoutFlow === "PICKUP_LATER" ||
            createdOrderSuccess.checkoutFlow === "ONLINE_DELIVERY" ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full"
                onClick={closeCreatedOrderSuccess}
              >
                {t(uiLocale, "orders.create.success.action.newOrder")}
              </Button>
            ) : null}
            <button
              type="button"
              className="w-full text-center text-xs font-medium text-blue-700 hover:text-blue-800"
              onClick={closeCreatedOrderSuccess}
            >
              {t(uiLocale, "orders.create.success.action.closeWindow")}
            </button>
          </div>
        </SlideUpSheet>
      ) : null}

      {!isCreateOnlyMode && selectedOrderIds.length > 0 ? (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 md:left-1/2 md:w-[min(56rem,calc(100vw-2rem))] md:-translate-x-1/2">
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">
                {t(uiLocale, "orders.management.bulk.selectedPrefix")}{" "}
                {selectedOrderIds.length.toLocaleString(numberLocale)}{" "}
                {t(uiLocale, "orders.management.bulk.selectedSuffix")}
              </p>
              <Button
                type="button"
                variant="ghost"
                className="h-8 px-2 text-xs"
                disabled={bulkActionLoadingKey !== null || bulkPrintLoadingKind !== null}
                onClick={clearSelectedOrders}
              >
                {t(uiLocale, "orders.management.bulk.clearSelection")}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {t(uiLocale, "orders.management.bulk.summary.totalPrefix")}{" "}
                {selectedOrdersTotal.toLocaleString(numberLocale)} {catalog.storeCurrency}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {t(uiLocale, "orders.management.bulk.summary.receiptsPrefix")}{" "}
                {selectedReceiptPrintOrders.length.toLocaleString(numberLocale)}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {t(uiLocale, "orders.management.bulk.summary.labelsPrefix")}{" "}
                {selectedLabelPrintOrders.length.toLocaleString(numberLocale)}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {t(uiLocale, "orders.management.bulk.summary.packsPrefix")}{" "}
                {selectedPackPrintOrders.length.toLocaleString(numberLocale)}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 px-3 text-xs"
                disabled={
                  selectedReceiptPrintOrders.length <= 0 ||
                  quickActionLoadingKey !== null ||
                  bulkActionLoadingKey !== null ||
                  bulkPrintLoadingKind !== null
                }
                onClick={() => void runBulkPrint("receipt")}
              >
                {bulkPrintLoadingKind === "receipt" || receiptPrintLoading
                  ? t(uiLocale, "orders.detail.actions.print.loading")
                  : `${t(uiLocale, "orders.management.bulk.print.receipts")} (${selectedReceiptPrintOrders.length.toLocaleString(numberLocale)})`}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 px-3 text-xs"
                disabled={
                  selectedPackPrintOrders.length <= 0 ||
                  quickActionLoadingKey !== null ||
                  bulkActionLoadingKey !== null ||
                  bulkPrintLoadingKind !== null
                }
                onClick={() => void runBulkPrint("pack")}
              >
                {bulkPrintLoadingKind === "pack" || orderPackPrintLoading
                  ? t(uiLocale, "orders.detail.actions.print.loading")
                  : `${t(uiLocale, "orders.management.bulk.print.packs")} (${selectedPackPrintOrders.length.toLocaleString(numberLocale)})`}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 px-3 text-xs"
                disabled={
                  selectedLabelPrintOrders.length <= 0 ||
                  quickActionLoadingKey !== null ||
                  bulkActionLoadingKey !== null ||
                  bulkPrintLoadingKind !== null
                }
                onClick={() => void runBulkPrint("label")}
              >
                {bulkPrintLoadingKind === "label" || shippingLabelPrintLoading
                  ? t(uiLocale, "orders.detail.actions.print.loading")
                  : `${t(uiLocale, "orders.management.bulk.print.labels")} (${selectedLabelPrintOrders.length.toLocaleString(numberLocale)})`}
              </Button>
            </div>

            {selectedQuickActionGroups.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedQuickActionGroups.map((group) => (
                  <Button
                    key={group.key}
                    type="button"
                    variant="outline"
                    className="h-9 px-3 text-xs"
                    disabled={
                      quickActionLoadingKey !== null ||
                      bulkActionLoadingKey !== null ||
                      bulkPrintLoadingKind !== null
                    }
                    onClick={() => setBulkActionConfirm(group)}
                  >
                    {bulkActionLoadingKey === group.key
                      ? t(uiLocale, "common.action.saving")
                      : `${t(uiLocale, group.buttonLabelKey)} (${group.orders.length.toLocaleString(numberLocale)})`}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {t(uiLocale, "orders.management.bulk.noneEligible")}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {orderReviewSheet ? (
        <SlideUpSheet
          isOpen
          onClose={() => {
            if (quickActionLoadingKey === null) {
              setOrderReviewSheet(null);
            }
          }}
          title={
            orderReviewSheet.kind === "cod-reconcile"
              ? t(uiLocale, "orders.management.review.cod.title")
              : orderReviewSheet.kind === "cod-return"
                ? t(uiLocale, "orders.management.review.codReturn.title")
                : t(uiLocale, "orders.management.review.confirmPaid.title")
          }
          description={
            orderReviewSheet.kind === "cod-reconcile"
              ? t(uiLocale, "orders.management.review.cod.description")
              : orderReviewSheet.kind === "cod-return"
                ? t(uiLocale, "orders.management.review.codReturn.description")
                : t(uiLocale, "orders.management.review.confirmPaid.description")
          }
          panelMaxWidthClass="sm:max-w-lg"
          disabled={quickActionLoadingKey !== null}
          footer={
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-full sm:w-auto"
                disabled={quickActionLoadingKey !== null}
                onClick={() => router.push(`/orders/${orderReviewSheet.orderId}`)}
              >
                {t(uiLocale, "orders.management.action.viewDetails")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full sm:w-auto"
                disabled={quickActionLoadingKey !== null}
                onClick={() => setOrderReviewSheet(null)}
              >
                {t(uiLocale, "common.action.cancel")}
              </Button>
              <Button
                type="button"
                className="h-10 w-full sm:w-auto"
                disabled={
                  quickActionLoadingKey !== null ||
                  (orderReviewSheet.kind === "confirm-paid" &&
                    orderReviewSheet.paymentMethod === "LAO_QR" &&
                    !orderReviewSheet.paymentAccountId.trim()) ||
                  (orderReviewSheet.kind === "cod-reconcile" &&
                    (!Number.isFinite(reviewCodAmountNumber) ||
                      reviewCodAmountNumber === null ||
                      reviewCodAmountNumber < 0 ||
                      !Number.isFinite(reviewCodFeeNumber) ||
                      reviewCodFeeNumber === null ||
                      reviewCodFeeNumber < 0)) ||
                  (orderReviewSheet.kind === "cod-return" &&
                    (!Number.isFinite(reviewCodFeeNumber) ||
                      reviewCodFeeNumber === null ||
                      reviewCodFeeNumber < 0))
                }
                onClick={() => void runOrderReviewAction()}
              >
                {quickActionLoadingKey === orderReviewLoadingKey
                  ? t(uiLocale, "common.action.saving")
                  : t(uiLocale, orderReviewSheet.actionLabelKey)}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium text-slate-900">{orderReviewSheet.orderNo}</p>
                  <p className="text-xs text-slate-500">{orderReviewSheet.customerLabel}</p>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {orderReviewSheet.total.toLocaleString(numberLocale)}{" "}
                  {currencyLabel(orderReviewSheet.paymentCurrency)}
                </p>
              </div>
            </div>

            {orderReviewSheet.kind === "confirm-paid" ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-900">
                    {t(uiLocale, "orders.management.review.confirmPaid.paymentMethodLabel")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["CASH", "LAO_QR"] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                          orderReviewSheet.paymentMethod === method
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                        disabled={quickActionLoadingKey !== null}
                        onClick={() =>
                          setOrderReviewSheet((current) =>
                            current && current.kind === "confirm-paid"
                              ? {
                                  ...current,
                                  paymentMethod: method,
                                  paymentAccountId:
                                    method === "LAO_QR"
                                      ? current.paymentAccountId ||
                                        getActiveQrPaymentAccountsForCurrency(current.paymentCurrency)[0]?.id ||
                                        ""
                                      : "",
                                }
                              : current,
                          )
                        }
                      >
                        {t(uiLocale, paymentMethodLabelKey[method])}
                      </button>
                    ))}
                  </div>
                </div>

                {orderReviewSheet.paymentMethod === "LAO_QR" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900" htmlFor="order-review-qr-account">
                      {t(uiLocale, "orders.management.review.confirmPaid.paymentAccountLabel")}
                    </label>
                    <select
                      id="order-review-qr-account"
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                      value={orderReviewSheet.paymentAccountId}
                      disabled={
                        quickActionLoadingKey !== null ||
                        getActiveQrPaymentAccountsForCurrency(orderReviewSheet.paymentCurrency).length <= 0
                      }
                      onChange={(event) =>
                        setOrderReviewSheet((current) =>
                          current && current.kind === "confirm-paid"
                            ? {
                                ...current,
                                paymentAccountId: event.target.value,
                              }
                            : current,
                        )
                      }
                    >
                      <option value="">{t(uiLocale, "orders.management.review.confirmPaid.paymentAccountPlaceholder")}</option>
                      {getActiveQrPaymentAccountsForCurrency(orderReviewSheet.paymentCurrency).map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.displayName} ({currencyLabel(account.currency)})
                        </option>
                      ))}
                    </select>
                    {selectedReviewQrAccount ? (
                      <p className="text-xs text-slate-500">
                        {selectedReviewQrAccount.bankName?.trim() || selectedReviewQrAccount.accountName}
                      </p>
                    ) : null}
                    {getActiveQrPaymentAccountsForCurrency(orderReviewSheet.paymentCurrency).length <= 0 ? (
                      <p className="text-xs text-amber-700">
                        {t(uiLocale, "orders.management.review.confirmPaid.error.noQrAccounts")} (
                        {currencyLabel(orderReviewSheet.paymentCurrency)})
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : orderReviewSheet.kind === "cod-reconcile" ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  {t(uiLocale, "orders.management.review.cod.hint")}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-900">
                      {t(uiLocale, "orders.management.review.cod.amountLabel")}
                    </span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                      value={orderReviewSheet.codAmount}
                      disabled={quickActionLoadingKey !== null}
                      onChange={(event) =>
                        setOrderReviewSheet((current) =>
                          current && current.kind === "cod-reconcile"
                            ? {
                                ...current,
                                codAmount: event.target.value,
                              }
                            : current,
                        )
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-900">
                      {t(uiLocale, "orders.management.review.cod.feeLabel")}
                    </span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                      value={orderReviewSheet.codFee}
                      disabled={quickActionLoadingKey !== null}
                      onChange={(event) =>
                        setOrderReviewSheet((current) =>
                          current && current.kind === "cod-reconcile"
                            ? {
                                ...current,
                                codFee: event.target.value,
                              }
                            : current,
                        )
                      }
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    {t(uiLocale, "orders.management.review.cod.expectedLabel")}{" "}
                    {orderReviewSheet.total.toLocaleString(numberLocale)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    {t(uiLocale, "orders.management.review.cod.diffLabel")}{" "}
                    {Number.isFinite(reviewCodAmountNumber)
                      ? (reviewCodAmountNumber! - orderReviewSheet.total).toLocaleString(numberLocale)
                      : "-"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
                  {t(uiLocale, "orders.management.review.codReturn.hint")}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-slate-900">
                      {t(uiLocale, "orders.management.review.codReturn.outboundShippingLabel")}
                    </span>
                    <div className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {orderReviewSheet.shippingCost.toLocaleString(numberLocale)}{" "}
                      {currencyLabel(orderReviewSheet.paymentCurrency)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-slate-900">
                      {t(uiLocale, "orders.management.review.codReturn.accumulatedFeeLabel")}
                    </span>
                    <div className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {orderReviewSheet.codFeeAccumulated.toLocaleString(numberLocale)}{" "}
                      {currencyLabel(orderReviewSheet.paymentCurrency)}
                    </div>
                  </div>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-900">
                      {t(uiLocale, "orders.management.review.codReturn.feeLabel")}
                    </span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                      value={orderReviewSheet.codFee}
                      disabled={quickActionLoadingKey !== null}
                      onChange={(event) =>
                        setOrderReviewSheet((current) =>
                          current && current.kind === "cod-return"
                            ? {
                                ...current,
                                codFee: event.target.value,
                              }
                            : current,
                        )
                      }
                    />
                  </label>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-slate-900">
                      {t(uiLocale, "orders.management.review.codReturn.totalShippingLabel")}
                    </span>
                    <div className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {(
                        orderReviewSheet.shippingCost +
                        (Number.isFinite(reviewCodFeeNumber) && reviewCodFeeNumber !== null
                          ? Math.max(0, reviewCodFeeNumber)
                          : 0)
                      ).toLocaleString(numberLocale)}{" "}
                      {currencyLabel(orderReviewSheet.paymentCurrency)}
                    </div>
                  </div>
                </div>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-900">
                    {t(uiLocale, "orders.management.review.codReturn.noteLabel")}
                  </span>
                  <textarea
                    className="min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
                    value={orderReviewSheet.codReturnNote}
                    disabled={quickActionLoadingKey !== null}
                    placeholder={t(uiLocale, "orders.management.review.codReturn.notePlaceholder")}
                    onChange={(event) =>
                      setOrderReviewSheet((current) =>
                        current && current.kind === "cod-return"
                          ? {
                              ...current,
                              codReturnNote: event.target.value,
                            }
                          : current,
                      )
                    }
                  />
                </label>
              </div>
            )}
          </div>
        </SlideUpSheet>
      ) : null}

      {bulkActionConfirm ? (
        <SlideUpSheet
          isOpen
          onClose={() => {
            if (bulkActionLoadingKey === null) {
              setBulkActionConfirm(null);
            }
          }}
          title={t(uiLocale, "orders.management.bulk.confirmTitle")}
          description={t(uiLocale, "orders.management.bulk.confirmDescription")}
          panelMaxWidthClass="sm:max-w-md"
          disabled={bulkActionLoadingKey !== null}
          footer={
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full sm:w-auto"
                disabled={bulkActionLoadingKey !== null}
                onClick={() => setBulkActionConfirm(null)}
              >
                {t(uiLocale, "common.action.cancel")}
              </Button>
              <Button
                type="button"
                className="h-10 w-full sm:w-auto"
                disabled={bulkActionLoadingKey !== null}
                onClick={() => void runBulkOrderAction(bulkActionConfirm)}
              >
                {bulkActionLoadingKey === bulkActionConfirm.key
                  ? t(uiLocale, "common.action.saving")
                  : `${t(uiLocale, bulkActionConfirm.buttonLabelKey)} (${bulkActionConfirm.orders.length.toLocaleString(numberLocale)})`}
              </Button>
            </div>
          }
        >
          <div className="space-y-2 text-sm text-slate-600">
            <p className="font-medium text-slate-900">
              {bulkActionConfirm.orders.length.toLocaleString(numberLocale)}{" "}
              {t(uiLocale, "orders.management.bulk.selectedSuffix")}
            </p>
            <p>{t(uiLocale, "orders.management.bulk.confirmHint")}</p>
          </div>
        </SlideUpSheet>
      ) : null}

      {quickActionConfirm ? (
        <SlideUpSheet
          isOpen
          onClose={() => {
            if (quickActionLoadingKey === null) {
              setQuickActionConfirm(null);
            }
          }}
          title={t(
            uiLocale,
            quickActionConfirm.config.confirmTitleKey ?? "orders.management.quickAction.confirmTitle",
          )}
          description={t(
            uiLocale,
            quickActionConfirm.config.confirmDescriptionKey ??
              "orders.management.quickAction.confirmDescription",
          )}
          panelMaxWidthClass="sm:max-w-md"
          disabled={quickActionLoadingKey !== null}
          footer={
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full sm:w-auto"
                disabled={quickActionLoadingKey !== null}
                onClick={() => setQuickActionConfirm(null)}
              >
                {t(uiLocale, "common.action.cancel")}
              </Button>
              <Button
                type="button"
                className="h-10 w-full sm:w-auto"
                disabled={quickActionLoadingKey !== null}
                onClick={() =>
                  void runOrderQuickAction(
                    { id: quickActionConfirm.orderId, orderNo: quickActionConfirm.orderNo },
                    quickActionConfirm.config,
                  )
                }
              >
                {quickActionLoadingKey ===
                buildOrderQuickActionLoadingKey(
                  quickActionConfirm.orderId,
                  quickActionConfirm.config.key,
                )
                  ? t(uiLocale, "common.action.saving")
                  : t(uiLocale, quickActionConfirm.config.labelKey)}
              </Button>
            </div>
          }
        >
          <div className="space-y-2 text-sm text-slate-600">
            <p className="font-medium text-slate-900">{quickActionConfirm.orderNo}</p>
            <p>{t(uiLocale, "orders.management.quickAction.confirmOrderHint")}</p>
          </div>
        </SlideUpSheet>
      ) : null}

      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </section>
  );
}
