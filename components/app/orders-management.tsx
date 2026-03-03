"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ScanLine } from "lucide-react";

import { BarcodeScannerPanel } from "@/components/app/barcode-scanner-panel";
import { Button } from "@/components/ui/button";
import { SlideUpSheet } from "@/components/ui/slide-up-sheet";
import { authFetch } from "@/lib/auth/client-token";
import { currencyLabel, parseStoreCurrency, vatModeLabel } from "@/lib/finance/store-financial";
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
import type {
  OrderCatalog,
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
      catalog: OrderCatalog;
      canCreate: boolean;
    }
  | {
      mode: "create-only";
      catalog: OrderCatalog;
      canCreate: boolean;
    };

type TabKey = OrderListTab;

const tabOptions: Array<{ key: TabKey; label: string }> = [
  { key: "ALL", label: "ทั้งหมด" },
  { key: "PENDING_PAYMENT", label: "รอจ่าย/รับ" },
  { key: "PAID", label: "จ่ายแล้ว" },
  { key: "SHIPPED", label: "ส่งแล้ว" },
];

const channelLabel: Record<"WALK_IN" | "FACEBOOK" | "WHATSAPP", string> = {
  WALK_IN: "Walk-in",
  FACEBOOK: "Facebook",
  WHATSAPP: "WhatsApp",
};

const paymentMethodLabel: Record<OrderListItem["paymentMethod"], string> = {
  CASH: "เงินสด",
  LAO_QR: "QR โอน",
  COD: "COD",
  BANK_TRANSFER: "โอนเงิน",
};

const statusLabel: Record<OrderListItem["status"], string> = {
  DRAFT: "ร่าง",
  PENDING_PAYMENT: "รอชำระ",
  READY_FOR_PICKUP: "รอรับที่ร้าน",
  PAID: "ชำระแล้ว",
  PACKED: "แพ็กแล้ว",
  SHIPPED: "จัดส่งแล้ว",
  CANCELLED: "ยกเลิก",
};

const statusClass: Record<OrderListItem["status"], string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_PAYMENT: "bg-amber-100 text-amber-700",
  READY_FOR_PICKUP: "bg-cyan-100 text-cyan-700",
  PAID: "bg-emerald-100 text-emerald-700",
  PACKED: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-indigo-100 text-indigo-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

type CreateOrderStep = "products" | "details";
type QuickAddCategory = {
  id: string;
  name: string;
  count: number;
};
type CheckoutFlow = "WALK_IN_NOW" | "PICKUP_LATER" | "ONLINE_DELIVERY";

const checkoutFlowLabel: Record<CheckoutFlow, string> = {
  WALK_IN_NOW: "Walk-in ทันที",
  PICKUP_LATER: "มารับที่ร้านภายหลัง",
  ONLINE_DELIVERY: "สั่งออนไลน์/จัดส่ง",
};
const SCANNER_PERMISSION_STORAGE_KEY = "scanner-permission-seen";
const CREATE_ONLY_SEARCH_STICKY_TOP_REM = 3.8;
const CREATE_ONLY_CART_STICKY_GAP_FALLBACK_PX = 13;
const CREATE_ONLY_CART_STICKY_EXTRA_TOP_PX = 13;
// Intentional: keep tablet threshold aligned with desktop so both use the same sticky behavior.
const TABLET_MIN_WIDTH_PX = 1200;
const DESKTOP_MIN_WIDTH_PX = 1200;

const defaultValues = (catalog: OrderCatalog): CreateOrderFormInput => ({
  channel: "WALK_IN",
  contactId: "",
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  discount: 0,
  shippingFeeCharged: 0,
  shippingCost: 0,
  paymentCurrency: catalog.storeCurrency as "LAK" | "THB" | "USD",
  paymentMethod: "CASH",
  paymentAccountId: "",
  items: [],
});

export function OrdersManagement(props: OrdersManagementProps) {
  const { catalog, canCreate } = props;
  const isCreateOnlyMode = props.mode === "create-only";
  const activeTab: OrderListTab = isCreateOnlyMode ? "ALL" : props.activeTab;
  const ordersPage = isCreateOnlyMode ? null : props.ordersPage;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [showScannerPermissionSheet, setShowScannerPermissionSheet] = useState(false);
  const [showScannerSheet, setShowScannerSheet] = useState(false);
  const [hasSeenScannerPermission, setHasSeenScannerPermission] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [manualSearchKeyword, setManualSearchKeyword] = useState("");
  const [quickAddKeyword, setQuickAddKeyword] = useState("");
  const [quickAddCategoryId, setQuickAddCategoryId] = useState<string>("ALL");
  const [quickAddOnlyAvailable, setQuickAddOnlyAvailable] = useState(false);
  const [showCartSheet, setShowCartSheet] = useState(false);
  const [showCheckoutSheet, setShowCheckoutSheet] = useState(false);
  const [showCheckoutCloseConfirm, setShowCheckoutCloseConfirm] = useState(false);
  const [createStep, setCreateStep] = useState<CreateOrderStep>("products");
  const [checkoutFlow, setCheckoutFlow] = useState<CheckoutFlow>("WALK_IN_NOW");
  const [hasInitializedDraftRestore, setHasInitializedDraftRestore] = useState(!isCreateOnlyMode);
  const [desktopCartStickyTop, setDesktopCartStickyTop] = useState("13.5rem");
  const createOnlySearchStickyRef = useRef<HTMLDivElement | null>(null);
  const createOnlyCartStickyRef = useRef<HTMLElement | null>(null);

  const form = useForm<CreateOrderFormInput, unknown, CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: defaultValues(catalog),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedChannel = form.watch("channel");
  const watchedItemsRaw = form.watch("items");
  const watchedItems = useMemo(() => watchedItemsRaw ?? [], [watchedItemsRaw]);
  const watchedDiscount = Number(form.watch("discount") ?? 0);
  const watchedShippingFeeCharged = Number(form.watch("shippingFeeCharged") ?? 0);
  const watchedShippingCost = Number(form.watch("shippingCost") ?? 0);
  const watchedPaymentCurrency = form.watch("paymentCurrency") ?? catalog.storeCurrency;
  const watchedPaymentMethod = form.watch("paymentMethod") ?? "CASH";
  const watchedPaymentAccountId = form.watch("paymentAccountId") ?? "";
  const watchedContactId = form.watch("contactId") ?? "";
  const watchedCustomerName = form.watch("customerName") ?? "";
  const watchedCustomerPhone = form.watch("customerPhone") ?? "";
  const watchedCustomerAddress = form.watch("customerAddress") ?? "";
  const isOnlineCheckout = checkoutFlow === "ONLINE_DELIVERY";
  const isPickupLaterCheckout = checkoutFlow === "PICKUP_LATER";
  const requiresCustomerPhone = isOnlineCheckout || isPickupLaterCheckout;
  const selectedPaymentCurrency = parseStoreCurrency(
    watchedPaymentCurrency,
    parseStoreCurrency(catalog.storeCurrency),
  );
  const qrPaymentAccounts = useMemo(
    () => catalog.paymentAccounts.filter((account) => account.accountType === "LAO_QR"),
    [catalog.paymentAccounts],
  );
  const bankPaymentAccounts = useMemo(
    () => catalog.paymentAccounts.filter((account) => account.accountType === "BANK"),
    [catalog.paymentAccounts],
  );
  const paymentAccountsForMethod = useMemo(() => {
    if (watchedPaymentMethod === "LAO_QR") {
      return qrPaymentAccounts;
    }
    if (watchedPaymentMethod === "BANK_TRANSFER") {
      return bankPaymentAccounts;
    }
    return [];
  }, [bankPaymentAccounts, qrPaymentAccounts, watchedPaymentMethod]);
  const hasCheckoutDraftInput = useMemo(() => {
    const hasTextInput =
      watchedCustomerName.trim().length > 0 ||
      watchedCustomerPhone.trim().length > 0 ||
      watchedCustomerAddress.trim().length > 0 ||
      watchedContactId.trim().length > 0;
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
    watchedDiscount,
    watchedPaymentAccountId,
    watchedPaymentCurrency,
    watchedPaymentMethod,
    watchedShippingCost,
    watchedShippingFeeCharged,
  ]);

  const productsById = useMemo(
    () => new Map(catalog.products.map((product) => [product.productId, product])),
    [catalog.products],
  );

  const contactsById = useMemo(
    () => new Map(catalog.contacts.map((contact) => [contact.id, contact])),
    [catalog.contacts],
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
      filtered = filtered.filter((product) => product.available > 0);
    }

    return filtered.slice(0, 24);
  }, [catalog.products, quickAddKeyword, quickAddCategoryId, quickAddOnlyAvailable]);
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

  const visibleOrders = isCreateOnlyMode ? [] : (ordersPage?.rows ?? []);
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
  const getProductAvailableQty = useCallback(
    (productId: string) => {
      const available = Number(productsById.get(productId)?.available ?? 0);
      if (!Number.isFinite(available)) {
        return 0;
      }
      return Math.max(0, Math.trunc(available));
    },
    [productsById],
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
          const fallbackUnitId = product.units[0]?.unitId ?? "";
          const unitId = hasUnit ? item.unitId : fallbackUnitId;
          const maxQty = getProductAvailableQty(item.productId);
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
      const allowedMethods = new Set(["CASH", "LAO_QR", "COD", "BANK_TRANSFER"]);
      const allowedChannels = new Set(["WALK_IN", "FACEBOOK", "WHATSAPP"]);
      const isKnownAccount = catalog.paymentAccounts.some(
        (account) => account.id === draft.form.paymentAccountId,
      );

      const paymentCurrency = supportedCurrencySet.has(draft.form.paymentCurrency)
        ? draft.form.paymentCurrency
        : parseStoreCurrency(catalog.storeCurrency);
      const paymentMethod = allowedMethods.has(draft.form.paymentMethod)
        ? draft.form.paymentMethod
        : "CASH";
      const channel = allowedChannels.has(draft.form.channel)
        ? draft.form.channel
        : "WALK_IN";

      return {
        channel,
        contactId: draft.form.contactId,
        customerName: draft.form.customerName,
        customerPhone: draft.form.customerPhone,
        customerAddress: draft.form.customerAddress,
        discount: Math.max(0, Math.trunc(Number(draft.form.discount) || 0)),
        shippingFeeCharged: Math.max(0, Math.trunc(Number(draft.form.shippingFeeCharged) || 0)),
        shippingCost: Math.max(0, Math.trunc(Number(draft.form.shippingCost) || 0)),
        paymentCurrency,
        paymentMethod,
        paymentAccountId: isKnownAccount ? draft.form.paymentAccountId : "",
        items: normalizedItems,
      } satisfies CreateOrderFormInput;
    },
    [
      catalog.paymentAccounts,
      catalog.storeCurrency,
      catalog.supportedCurrencies,
      getProductAvailableQty,
      productsById,
    ],
  );

  const subtotal = useMemo(() => {
    return watchedItems.reduce((sum, item) => {
      const qty = Number(item.qty);
      if (!Number.isFinite(qty) || qty <= 0) {
        return sum;
      }
      return sum + qty * getProductUnitPrice(item.productId, item.unitId);
    }, 0);
  }, [getProductUnitPrice, watchedItems]);

  const totals = computeOrderTotals({
    subtotal,
    discount: watchedDiscount,
    vatEnabled: catalog.vatEnabled,
    vatRate: catalog.vatRate,
    vatMode: catalog.vatMode,
    shippingFeeCharged: Math.max(0, watchedShippingFeeCharged),
  });
  const cartQtyTotal = useMemo(
    () =>
      watchedItems.reduce((sum, item) => {
        const qty = Number(item.qty ?? 0);
        return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
      }, 0),
    [watchedItems],
  );

  const onChangeProduct = (index: number, productId: string) => {
    const product = productsById.get(productId);
    form.setValue(`items.${index}.productId`, productId);
    form.setValue(`items.${index}.unitId`, product?.units[0]?.unitId ?? "");
  };

  const onPickContact = (contactId: string) => {
    form.setValue("contactId", contactId);
    const contact = contactsById.get(contactId);
    if (contact) {
      form.setValue("customerName", contact.displayName);
      if (contact.phone) {
        form.setValue("customerPhone", contact.phone);
      }
    }
  };

  const applyCheckoutFlow = useCallback(
    (nextFlow: CheckoutFlow) => {
      setCheckoutFlow(nextFlow);
      form.clearErrors(["contactId", "customerPhone", "customerAddress"]);

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

      if (form.getValues("paymentMethod") === "COD") {
        form.setValue("paymentMethod", "CASH", { shouldDirty: true, shouldValidate: true });
      }
    },
    [form],
  );

  const addProductFromCatalog = (productId: string) => {
    const product = productsById.get(productId);
    if (!product) {
      return null;
    }
    const availableQty = getProductAvailableQty(productId);
    if (availableQty <= 0) {
      setScanMessage(`สินค้า ${product.sku} - ${product.name} หมดสต็อก/ติดจอง เพิ่มไม่ได้`);
      return null;
    }

    const existingIndex = watchedItems.findIndex((item) => item.productId === productId);
    if (existingIndex >= 0) {
      const currentQty = Number(form.getValues(`items.${existingIndex}.qty`) ?? 0);
      if (currentQty >= availableQty) {
        setScanMessage(
          `สินค้า ${product.sku} - ${product.name} เพิ่มได้สูงสุด ${availableQty.toLocaleString("th-TH")} ชิ้น`,
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
        unitId: product.units[0]?.unitId ?? "",
        qty: 1,
      });
    }

    return product;
  };
  const setItemQty = useCallback(
    (index: number, nextQty: number) => {
      const productId = String(form.getValues(`items.${index}.productId`) ?? "");
      const availableQty = getProductAvailableQty(productId);
      const safeQty = Math.max(1, Math.trunc(nextQty) || 1);
      const boundedQty = availableQty > 0 ? Math.min(safeQty, availableQty) : safeQty;
      if (boundedQty < safeQty && availableQty > 0) {
        const product = productsById.get(productId);
        if (product) {
          setScanMessage(
            `สินค้า ${product.sku} - ${product.name} เพิ่มได้สูงสุด ${availableQty.toLocaleString("th-TH")} ชิ้น`,
          );
        }
      }
      form.setValue(`items.${index}.qty`, boundedQty, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form, getProductAvailableQty, productsById],
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

    const keyword = barcode.toLowerCase();
    const matched = catalog.products.find(
      (product) =>
        product.barcode?.toLowerCase() === keyword || product.sku.toLowerCase() === keyword,
    );

    if (matched) {
      const addedProduct = addProductFromCatalog(matched.productId);
      if (addedProduct) {
        setScanMessage(`เพิ่มสินค้า ${addedProduct.sku} - ${addedProduct.name} แล้ว`);
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
    const addedProduct = addProductFromCatalog(productId);
    if (!addedProduct) {
      return;
    }

    setScanMessage(`เพิ่มสินค้า ${addedProduct.sku} - ${addedProduct.name} แล้ว`);
    setNotFoundBarcode(null);
    setManualSearchKeyword("");
  };

  const buildOrdersUrl = (tab: TabKey, page: number) => {
    const nextParams = new URLSearchParams(searchParams.toString());

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

    const query = nextParams.toString();
    return query ? `/orders?${query}` : "/orders";
  };

  const tableColumns = useMemo<ColumnDef<OrderListItem>[]>(
    () => [
      {
        accessorKey: "orderNo",
        header: "เลขที่ออเดอร์",
      },
      {
        id: "customer",
        header: "ลูกค้า",
        cell: ({ row }) =>
          row.original.customerName || row.original.contactDisplayName || "ลูกค้าทั่วไป",
      },
      {
        accessorKey: "status",
        header: "สถานะ",
        cell: ({ row }) => (
          <span className={`rounded-full px-2 py-1 text-xs ${statusClass[row.original.status]}`}>
            {statusLabel[row.original.status]}
          </span>
        ),
      },
      {
        accessorKey: "total",
        header: "ยอดรวม",
        cell: ({ row }) =>
          `${row.original.total.toLocaleString("th-TH")} ${catalog.storeCurrency} • จ่าย ${row.original.paymentCurrency} • ${
            paymentMethodLabel[row.original.paymentMethod]
          }`,
      },
    ],
    [catalog.storeCurrency],
  );

  const ordersTable = useReactTable({
    data: visibleOrders,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const submitOrder = form.handleSubmit(async (values) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    form.clearErrors(["customerPhone", "customerAddress"]);

    const normalizedCustomerName = values.customerName?.trim();
    const normalizedCustomerPhone = values.customerPhone?.trim() ?? "";
    const normalizedCustomerAddress = values.customerAddress?.trim() ?? "";
    const normalizedChannel =
      checkoutFlow === "ONLINE_DELIVERY"
        ? values.channel === "WALK_IN"
          ? "FACEBOOK"
          : values.channel
        : "WALK_IN";
    const normalizedPaymentMethod =
      checkoutFlow !== "ONLINE_DELIVERY" && values.paymentMethod === "COD"
        ? "CASH"
        : (values.paymentMethod ?? "CASH");

    if (requiresCustomerPhone && !normalizedCustomerPhone) {
      form.setError("customerPhone", {
        type: "manual",
        message: "กรุณากรอกเบอร์โทรลูกค้า",
      });
      return;
    }

    if (checkoutFlow === "ONLINE_DELIVERY" && !normalizedCustomerAddress) {
      form.setError("customerAddress", {
        type: "manual",
        message: "กรุณากรอกที่อยู่จัดส่ง",
      });
      return;
    }

    setLoading(true);

    const fallbackCustomerName =
      checkoutFlow === "PICKUP_LATER"
        ? "ลูกค้ารับที่ร้าน"
        : normalizedChannel === "WALK_IN"
          ? "ลูกค้าหน้าร้าน"
          : "ลูกค้าออนไลน์";
    const payload: CreateOrderInput = {
      ...values,
      channel: normalizedChannel,
      contactId: checkoutFlow === "ONLINE_DELIVERY" ? values.contactId : "",
      checkoutFlow,
      customerPhone: normalizedCustomerPhone,
      customerAddress: checkoutFlow === "ONLINE_DELIVERY" ? normalizedCustomerAddress : "",
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
      setErrorMessage(data?.message ?? "สร้างออเดอร์ไม่สำเร็จ");
      setLoading(false);
      return;
    }

    setSuccessMessage(`สร้างออเดอร์ ${data?.orderNo ?? ""} เรียบร้อย`);
    setCreateFormOpen(false);
    setShowCartSheet(false);
    setShowCheckoutSheet(false);
    setShowCheckoutCloseConfirm(false);
    setCreateStep("products");
    setCheckoutFlow("WALK_IN_NOW");
    clearNewOrderDraftState();
    setLoading(false);

    if (data?.orderId) {
      router.push(`/orders/${data.orderId}`);
      return;
    }

    router.refresh();
  });

  const openCreateForm = () => {
    setCreateFormOpen(true);
    setShowCartSheet(false);
    setShowCheckoutSheet(false);
    setShowCheckoutCloseConfirm(false);
    setCreateStep("products");
    setCheckoutFlow("WALK_IN_NOW");
  };

  const closeCreateForm = () => {
    setCreateFormOpen(false);
    setShowCartSheet(false);
    setShowCheckoutSheet(false);
    setShowCheckoutCloseConfirm(false);
    setCreateStep("products");
    setCheckoutFlow("WALK_IN_NOW");
  };

  const openCheckoutSheet = () => {
    if (watchedItems.length <= 0) {
      return;
    }
    setCreateStep("details");
    setShowCartSheet(false);
    setShowCheckoutCloseConfirm(false);
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

  const isCreateFormOpen = isCreateOnlyMode ? false : createFormOpen;

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
    setScanMessage("กู้คืนตะกร้าที่ค้างจากการรีเฟรชแล้ว");
    setNewOrderDraftFlag(true);
    setHasInitializedDraftRestore(true);
  }, [
    form,
    hasInitializedDraftRestore,
    isCreateOnlyMode,
    restoreDraftFormForCatalog,
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
        discount: Math.max(0, Math.trunc(Number(watchedDiscount) || 0)),
        shippingFeeCharged: Math.max(0, Math.trunc(Number(watchedShippingFeeCharged) || 0)),
        shippingCost: Math.max(0, Math.trunc(Number(watchedShippingCost) || 0)),
        paymentCurrency:
          watchedPaymentCurrency === "THB" || watchedPaymentCurrency === "USD"
            ? watchedPaymentCurrency
            : "LAK",
        paymentMethod:
          watchedPaymentMethod === "LAO_QR" ||
          watchedPaymentMethod === "COD" ||
          watchedPaymentMethod === "BANK_TRANSFER"
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
    watchedDiscount,
    watchedItems,
    watchedPaymentAccountId,
    watchedPaymentCurrency,
    watchedPaymentMethod,
    watchedShippingCost,
    watchedShippingFeeCharged,
  ]);

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
      <form className="space-y-3" onSubmit={submitOrder}>
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
              1) เลือกสินค้า
            </button>
            <button
              type="button"
              className={`h-9 rounded-md text-xs font-medium ${
                isDetailsStep ? "bg-blue-600 text-white" : "bg-white text-slate-600"
              }`}
              onClick={() => setCreateStep("details")}
              disabled={loading || !canContinueToDetails}
            >
              2) รายละเอียดออเดอร์
            </button>
          </div>
        ) : null}

        {isDetailsStep ? (
          <>
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">ประเภทออเดอร์</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(
                  [
                    {
                      key: "WALK_IN_NOW",
                      label: "Walk-in ทันที",
                      description: "รับและจบออเดอร์หน้างาน",
                    },
                    {
                      key: "PICKUP_LATER",
                      label: "มารับที่ร้านภายหลัง",
                      description: "โทรสั่งไว้ก่อนแล้วค่อยมารับ",
                    },
                    {
                      key: "ONLINE_DELIVERY",
                      label: "สั่งออนไลน์/จัดส่ง",
                      description: "ต้องมีช่องทางและข้อมูลส่งของ",
                    },
                  ] satisfies Array<{ key: CheckoutFlow; label: string; description: string }>
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
                    <p className="text-xs font-medium">{flowOption.label}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{flowOption.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {isOnlineCheckout ? (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground" htmlFor="order-channel">
                  ช่องทางออเดอร์ออนไลน์
                </label>
                <select
                  id="order-channel"
                  className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                  disabled={loading}
                  value={watchedChannel === "WALK_IN" ? "FACEBOOK" : watchedChannel}
                  onChange={(event) => {
                    const nextChannel = event.target.value === "WHATSAPP" ? "WHATSAPP" : "FACEBOOK";
                    form.setValue("channel", nextChannel, { shouldDirty: true, shouldValidate: true });
                    form.setValue("contactId", "", { shouldDirty: true, shouldValidate: true });
                  }}
                >
                  <option value="FACEBOOK">Facebook</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </select>
              </div>
            ) : null}

            {isOnlineCheckout && watchedChannel !== "WALK_IN" ? (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground" htmlFor="order-contact">
                  เลือกลูกค้า
                </label>
                <select
                  id="order-contact"
                  className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                  disabled={loading}
                  value={form.watch("contactId") ?? ""}
                  onChange={(event) => onPickContact(event.target.value)}
                >
                  <option value="">เลือกจากรายชื่อลูกค้า</option>
                  {catalog.contacts
                    .filter((contact) =>
                      watchedChannel === "FACEBOOK"
                        ? contact.channel === "FACEBOOK"
                        : contact.channel === "WHATSAPP",
                    )
                    .map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.displayName}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-red-600">{form.formState.errors.contactId?.message}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground" htmlFor="order-customer-name">
                {isOnlineCheckout ? "ชื่อลูกค้า/ผู้รับสินค้า" : "ชื่อลูกค้า (ไม่บังคับ)"}
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
                {requiresCustomerPhone ? "เบอร์โทร (จำเป็น)" : "เบอร์โทร"}
              </label>
              <input
                id="order-customer-phone"
                className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                disabled={loading}
                {...form.register("customerPhone")}
              />
              <p className="text-xs text-red-600">{form.formState.errors.customerPhone?.message}</p>
            </div>

            {isOnlineCheckout ? (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground" htmlFor="order-address">
                  ที่อยู่จัดส่ง (จำเป็น)
                </label>
                <textarea
                  id="order-address"
                  className="min-h-20 w-full rounded-md border px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
                  disabled={loading}
                  {...form.register("customerAddress")}
                />
                <p className="text-xs text-red-600">{form.formState.errors.customerAddress?.message}</p>
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
                {isPickupLaterCheckout
                  ? "โหมดรับที่ร้านภายหลัง: แนะนำกรอกเบอร์โทรให้ครบ เพื่อโทรนัดรับสินค้า"
                  : "โหมด Walk-in ทันที: ไม่จำเป็นต้องกรอกข้อมูลจัดส่ง"}
              </p>
            )}
          </>
        ) : null}

        {isProductStep ? (
          <div id="order-cart-section" className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              รายการสินค้า ({watchedItems.length.toLocaleString("th-TH")} รายการ)
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs font-medium text-blue-700"
                disabled={loading || !hasCatalogProducts}
                onClick={openScannerSheet}
              >
                สแกนเพิ่มสินค้า
              </button>
              <button
                type="button"
                className="text-xs font-medium text-blue-700"
                disabled={loading || !hasCatalogProducts}
                onClick={() =>
                  append({
                    productId: catalog.products[0]?.productId ?? "",
                    unitId: catalog.products[0]?.units[0]?.unitId ?? "",
                    qty: 1,
                  })
                }
              >
                + เพิ่มรายการ
              </button>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <p className="text-xs font-medium text-slate-700">เพิ่มสินค้าแบบแตะเร็ว (POS-lite)</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="h-10 flex-1 rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                placeholder="ค้นหา SKU, ชื่อ หรือบาร์โค้ด"
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
                  ล้าง
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
                {quickAddOnlyAvailable ? "เฉพาะมีสต็อก: เปิด" : "เฉพาะมีสต็อก"}
              </button>
            </div>
            {!hasCatalogProducts ? (
              <p className="text-xs text-slate-500">ยังไม่มีสินค้าในระบบ</p>
            ) : quickAddProducts.length === 0 ? (
              <p className="text-xs text-slate-500">ไม่พบสินค้าที่ตรงกับคำค้น</p>
            ) : (
              <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {quickAddProducts.map((product) => (
                  <button
                    key={product.productId}
                    type="button"
                    className="rounded-md border bg-white px-3 py-2 text-left transition-colors hover:bg-blue-50"
                    onClick={() => {
                      const addedProduct = addProductFromCatalog(product.productId);
                      if (addedProduct) {
                        setScanMessage(
                          `เพิ่มสินค้า ${addedProduct.sku} - ${addedProduct.name} แล้ว`,
                        );
                      }
                    }}
                    disabled={loading || product.available <= 0}
                  >
                    <p className="text-xs text-slate-500">{product.sku}</p>
                    <p className="truncate text-sm font-medium text-slate-800">{product.name}</p>
                    <p className="text-xs text-slate-500">
                      คงเหลือ {product.available.toLocaleString("th-TH")}
                    </p>
                    {product.available > 0 ? (
                      <p className="mt-1 text-xs font-medium text-blue-700">
                        + เพิ่ม {getProductDefaultUnitPrice(product).toLocaleString("th-TH")}{" "}
                        {catalog.storeCurrency}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-medium text-rose-600">หมดสต็อก/ติดจอง</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {scanMessage ? <p className="text-xs text-emerald-700">{scanMessage}</p> : null}

          {notFoundBarcode ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
              <p className="text-xs text-amber-700">
                ไม่พบบาร์โค้ด <span className="font-semibold">{notFoundBarcode}</span> กรุณาค้นหาเอง
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  className="h-10 flex-1 rounded-md border border-amber-300 bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                  placeholder="ค้นหาด้วยชื่อสินค้า, SKU หรือบาร์โค้ด"
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
                    สแกนใหม่
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
                    ปิด
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
                  <p className="text-xs text-amber-700">ไม่พบสินค้าจากคำค้นนี้</p>
                )
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2 sm:hidden">
            {watchedItems.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-xs text-slate-500">
                ยังไม่มีรายการสินค้า
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
                      {selectedProduct?.name ?? "ไม่พบสินค้า"}
                    </p>
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <select
                        className="h-9 rounded-md border px-2 text-sm outline-none ring-primary focus:ring-2"
                        value={item.unitId ?? ""}
                        onChange={(event) =>
                          form.setValue(`items.${index}.unitId`, event.target.value, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
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
                          aria-label="ลดจำนวน"
                        >
                          -
                        </button>
                        <div className="min-w-10 text-center text-sm font-medium text-slate-800">
                          {(Number(item.qty ?? 0) || 0).toLocaleString("th-TH")}
                        </div>
                        <button
                          type="button"
                          className="h-9 w-9 rounded-md border text-base text-slate-700"
                          onClick={() => increaseItemQty(index)}
                          disabled={loading || availableQty <= 0 || currentQty >= availableQty}
                          aria-label="เพิ่มจำนวน"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <p className="text-slate-500">
                        คงเหลือ {selectedProduct?.available.toLocaleString("th-TH") ?? 0}
                      </p>
                      <button
                        type="button"
                        className="text-red-600"
                        onClick={() => remove(index)}
                        disabled={loading}
                      >
                        ลบ
                      </button>
                    </div>
                    <p className="text-xs font-medium text-blue-700">
                      รวมรายการ {lineTotal.toLocaleString("th-TH")} {catalog.storeCurrency}
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
                มีอีก {(watchedItems.length - 2).toLocaleString("th-TH")} รายการ แตะเพื่อดูทั้งหมด
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
                        {...form.register(`items.${index}.unitId`)}
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
                        คงเหลือ {selectedProduct?.available.toLocaleString("th-TH") ?? 0}
                      </div>

                      <button
                        type="button"
                        className="text-xs text-red-600"
                        onClick={() => remove(index)}
                        disabled={loading}
                      >
                        ลบ
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-blue-700">
                    รวมรายการ {lineTotal.toLocaleString("th-TH")} {catalog.storeCurrency}
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
                ดูตะกร้า {watchedItems.length.toLocaleString("th-TH")} รายการ /{" "}
                {cartQtyTotal.toLocaleString("th-TH")} ชิ้น
              </span>
              <span>
                {totals.total.toLocaleString("th-TH")} {catalog.storeCurrency}
              </span>
            </button>
          ) : null}
          </div>
        ) : isCreateOnlyMode ? (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                รายการสินค้า ({watchedItems.length.toLocaleString("th-TH")} รายการ)
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
                {inSheet ? "กลับไปเลือกสินค้า" : "แก้รายการสินค้า"}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              จำนวน {cartQtyTotal.toLocaleString("th-TH")} ชิ้น • ยอดรวม{" "}
              {totals.total.toLocaleString("th-TH")} {catalog.storeCurrency}
            </p>
            <p className="text-xs text-red-600">{form.formState.errors.items?.message}</p>
          </div>
        ) : null}

        {isDetailsStep ? (
          <>
            <div className={`grid grid-cols-1 gap-2 ${isOnlineCheckout ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">ส่วนลด</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                  disabled={loading}
                  {...form.register("discount")}
                />
              </div>

              {isOnlineCheckout ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">ค่าส่งที่เรียกเก็บ</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                      disabled={loading}
                      {...form.register("shippingFeeCharged")}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">ต้นทุนค่าส่ง</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                      disabled={loading}
                      {...form.register("shippingCost")}
                    />
                  </div>
                </>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground" htmlFor="payment-method">
                วิธีรับชำระ
              </label>
              <select
                id="payment-method"
                className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                disabled={loading}
                value={watchedPaymentMethod}
                onChange={(event) => {
                  const rawMethod = event.target.value;
                  const nextMethod =
                    rawMethod === "LAO_QR" || rawMethod === "BANK_TRANSFER"
                      ? rawMethod
                      : rawMethod === "COD" && isOnlineCheckout
                        ? "COD"
                      : "CASH";
                  form.setValue("paymentMethod", nextMethod, { shouldValidate: true });
                  if (nextMethod === "LAO_QR") {
                    const defaultQrAccount = qrPaymentAccounts[0]?.id ?? "";
                    form.setValue("paymentAccountId", defaultQrAccount, { shouldValidate: true });
                  } else if (nextMethod === "BANK_TRANSFER") {
                    const defaultBankAccount = bankPaymentAccounts[0]?.id ?? "";
                    form.setValue("paymentAccountId", defaultBankAccount, { shouldValidate: true });
                  } else {
                    form.setValue("paymentAccountId", "", { shouldValidate: true });
                  }
                }}
              >
                <option value="CASH">เงินสด</option>
                <option value="LAO_QR">QR โอนเงิน (ลาว)</option>
                <option value="BANK_TRANSFER">โอนเงินผ่านบัญชี</option>
                {isOnlineCheckout ? <option value="COD">COD (เก็บเงินปลายทาง)</option> : null}
              </select>
            </div>

            {watchedPaymentMethod === "LAO_QR" || watchedPaymentMethod === "BANK_TRANSFER" ? (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground" htmlFor="payment-account">
                  บัญชีรับเงิน
                </label>
                <select
                  id="payment-account"
                  className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                  disabled={loading}
                  value={form.watch("paymentAccountId") ?? ""}
                  onChange={(event) =>
                    form.setValue("paymentAccountId", event.target.value, { shouldValidate: true })
                  }
                >
                  <option value="">
                    {watchedPaymentMethod === "LAO_QR" ? "เลือกบัญชี QR" : "เลือกบัญชีโอน"}
                  </option>
                  {paymentAccountsForMethod.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.displayName} ({resolveLaosBankDisplayName(account.bankName)})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-red-600">{form.formState.errors.paymentAccountId?.message}</p>
                <p className="text-xs text-slate-500">
                  {watchedPaymentMethod === "LAO_QR" && catalog.requireSlipForLaoQr
                    ? "นโยบายร้าน: ต้องแนบสลิปก่อนยืนยันชำระ"
                    : watchedPaymentMethod === "LAO_QR"
                      ? "นโยบายร้าน: ไม่บังคับแนบสลิป"
                      : isOnlineCheckout
                        ? "โหมดโอนเงินผ่านบัญชี: แนะนำแนบหลักฐานก่อนยืนยันชำระ"
                        : "หน้าร้าน/รับที่ร้าน: เลือกบัญชีรับเงินของร้าน"}
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground" htmlFor="payment-currency">
                สกุลที่รับชำระในออเดอร์นี้
              </label>
              <select
                id="payment-currency"
                className="h-10 w-full rounded-md border px-3 text-sm outline-none ring-primary focus:ring-2"
                disabled={loading}
                {...form.register("paymentCurrency")}
              >
                {catalog.supportedCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currencyLabel(currency)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Base currency: {catalog.storeCurrency} • รองรับ {catalog.supportedCurrencies.join(", ")}
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p>ยอดสินค้า: {subtotal.toLocaleString("th-TH")} {catalog.storeCurrency}</p>
              <p>ส่วนลด: {totals.discount.toLocaleString("th-TH")} {catalog.storeCurrency}</p>
              <p>
                VAT ({vatModeLabel(catalog.vatMode)}): {totals.vatAmount.toLocaleString("th-TH")}{" "}
                {catalog.storeCurrency}
              </p>
              <p className="font-semibold">
                ยอดรวม: {totals.total.toLocaleString("th-TH")} {catalog.storeCurrency}
              </p>
              <p className="text-xs text-slate-500">
                สกุลชำระที่เลือก: {currencyLabel(selectedPaymentCurrency)}
              </p>
              <p className="text-xs text-slate-500">
                ประเภทออเดอร์: {checkoutFlowLabel[checkoutFlow]}
              </p>
              <p className="text-xs text-slate-500">วิธีชำระ: {paymentMethodLabel[watchedPaymentMethod]}</p>
            </div>

            <div className={inSheet ? "sticky bottom-0 border-t border-slate-200 bg-white pt-3" : ""}>
              <Button type="submit" className="h-10 w-full" disabled={loading || !canCreate}>
                {loading ? "กำลังบันทึก..." : "สร้างออเดอร์"}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <p className="text-xs text-slate-600">
              เลือกสินค้าเสร็จแล้วให้กดไปขั้นถัดไป เพื่อกรอกลูกค้า/การชำระเงิน/ที่อยู่จัดส่ง
            </p>
            <Button
              type="button"
              className="h-10 w-full"
              onClick={() => setCreateStep("details")}
              disabled={loading || !canContinueToDetails}
            >
              ถัดไป: รายละเอียดออเดอร์
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
            <input
              type="text"
              className="h-10 min-w-0 w-full rounded-md border bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
              placeholder="ค้นหา SKU, ชื่อ หรือบาร์โค้ด"
              value={quickAddKeyword}
              onChange={(event) => setQuickAddKeyword(event.target.value)}
              disabled={loading || !hasCatalogProducts}
            />
            <Button
              type="button"
              variant="outline"
              className="h-10 w-10 p-0"
              disabled={loading || !hasCatalogProducts}
              onClick={openScannerSheet}
              aria-label="สแกนบาร์โค้ด"
              title="สแกนบาร์โค้ด"
            >
              <ScanLine className="h-4 w-4" />
              <span className="sr-only">สแกนบาร์โค้ด</span>
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
              {quickAddOnlyAvailable ? "มีสต็อก✓" : "มีสต็อก"}
            </button>
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
                ทั้งหมด
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
                ไม่พบบาร์โค้ด <span className="font-semibold">{notFoundBarcode}</span> กรุณาค้นหาเอง
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  className="h-10 flex-1 rounded-md border border-amber-300 bg-white px-3 text-sm outline-none ring-primary focus:ring-2"
                  placeholder="ค้นหาด้วยชื่อสินค้า, SKU หรือบาร์โค้ด"
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
                    สแกนใหม่
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
                    ปิด
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
                  <p className="text-xs text-amber-700">ไม่พบสินค้าจากคำค้นนี้</p>
                )
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">สินค้า</p>
              <p className="text-xs text-slate-500">
                {quickAddProducts.length.toLocaleString("th-TH")} รายการ
              </p>
            </div>
            {!hasCatalogProducts ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-slate-500">
                ยังไม่มีสินค้าในระบบ
              </p>
            ) : quickAddProducts.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-slate-500">
                ไม่พบสินค้าที่ตรงกับคำค้น
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {quickAddProducts.map((product) => (
                  <button
                    key={product.productId}
                    type="button"
                    className="space-y-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                    onClick={() => {
                      const addedProduct = addProductFromCatalog(product.productId);
                      if (addedProduct) {
                        setScanMessage(`เพิ่มสินค้า ${addedProduct.sku} - ${addedProduct.name} แล้ว`);
                      }
                    }}
                    disabled={loading || product.available <= 0}
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
                          NO IMG
                        </div>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-slate-500">{product.sku}</p>
                    <p className="line-clamp-2 text-[13px] font-medium text-slate-900 sm:text-sm">
                      {product.name}
                    </p>
                    <p className="text-[11px] font-semibold text-blue-700 sm:text-xs">
                      {getProductDefaultUnitPrice(product).toLocaleString("th-TH")} {catalog.storeCurrency}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-500">
                        คงเหลือ {product.available.toLocaleString("th-TH")}
                      </p>
                      {product.available > 0 ? (
                        <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                          + เพิ่ม
                        </span>
                      ) : (
                        <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                          หมด
                        </span>
                      )}
                    </div>
                  </button>
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
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                ตะกร้า ({watchedItems.length.toLocaleString("th-TH")})
              </p>
              <button
                type="button"
                className="text-xs font-medium text-blue-700 disabled:text-slate-400"
                onClick={() => setShowCartSheet(true)}
                disabled={loading || watchedItems.length === 0}
              >
                เปิดเต็ม
              </button>
            </div>

            {watchedItems.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-xs text-slate-500">
                ยังไม่มีรายการสินค้าในตะกร้า
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
                            {selectedProduct?.name ?? "ไม่พบสินค้า"}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            คงเหลือ {selectedProduct?.available.toLocaleString("th-TH") ?? 0}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-[11px] text-red-600"
                          onClick={() => remove(index)}
                          disabled={loading}
                        >
                          ลบ
                        </button>
                      </div>

                      <div className="grid grid-cols-[minmax(0,1fr)_auto_6.5rem] items-center gap-1.5">
                        <select
                          className="h-7 w-full min-w-0 rounded-md border px-2 text-[11px] outline-none ring-primary focus:ring-2"
                          value={item.unitId ?? ""}
                          onChange={(event) =>
                            form.setValue(`items.${index}.unitId`, event.target.value, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
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
                            aria-label="ลดจำนวน"
                          >
                            -
                          </button>
                          <div className="min-w-7 text-center text-xs font-medium text-slate-900">
                            {(Number(item.qty ?? 0) || 0).toLocaleString("th-TH")}
                          </div>
                          <button
                            type="button"
                            className="h-7 w-7 rounded-md border text-xs text-slate-700"
                            onClick={() => increaseItemQty(index)}
                            disabled={loading || availableQty <= 0 || currentQty >= availableQty}
                            aria-label="เพิ่มจำนวน"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-right text-xs font-semibold tabular-nums text-slate-900">
                          {lineTotal.toLocaleString("th-TH")}
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
                  {watchedItems.length.toLocaleString("th-TH")} รายการ • {cartQtyTotal.toLocaleString("th-TH")} ชิ้น
                </p>
                <p className="text-base font-semibold text-slate-900">
                  {totals.total.toLocaleString("th-TH")} {catalog.storeCurrency}
                </p>
              </div>

              <Button
                type="button"
                className="h-10 w-full"
                onClick={openCheckoutSheet}
                disabled={loading || watchedItems.length === 0}
              >
                ถัดไป: ชำระเงิน
              </Button>
            </div>
          </aside>
        </div>

        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-30 md:hidden">
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
              <p>
                {watchedItems.length.toLocaleString("th-TH")} รายการ • {cartQtyTotal.toLocaleString("th-TH")} ชิ้น
              </p>
              <button
                type="button"
                className="font-medium text-blue-700 disabled:text-slate-400"
                onClick={() => setShowCartSheet(true)}
                disabled={watchedItems.length === 0}
              >
                แก้ตะกร้า
              </button>
            </div>
            <button
              type="button"
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm disabled:bg-slate-300"
              onClick={openCheckoutSheet}
              disabled={watchedItems.length === 0 || loading}
            >
              ถัดไป: ชำระเงิน {totals.total.toLocaleString("th-TH")} {catalog.storeCurrency}
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
          <p className="text-sm text-red-600">คุณไม่มีสิทธิ์สร้างออเดอร์</p>
        )
      ) : (
        <>
          <article className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">รายการออเดอร์</h2>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 px-3 text-xs"
                  onClick={() => (isCreateFormOpen ? closeCreateForm() : openCreateForm())}
                  disabled={!canCreate || loading}
                >
                  {isCreateFormOpen ? "ปิดฟอร์มด่วน" : "สร้างด่วน"}
                </Button>
                <Button
                  type="button"
                  className="h-9 px-3 text-xs sm:text-sm"
                  onClick={() => router.push("/orders/new")}
                  disabled={!canCreate || loading}
                >
                  สร้างออเดอร์
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {tabOptions.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => router.push(buildOrdersUrl(tab.key, 1))}
                  className={`rounded-lg px-2 py-2 text-xs ${
                    activeTab === tab.key ? "bg-blue-600 text-white" : "border bg-white text-slate-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </article>

          <section className="space-y-2">
            {visibleOrders.length === 0 ? (
              <article className="rounded-xl border bg-white p-4 text-sm text-muted-foreground shadow-sm">
                ไม่พบออเดอร์ในแท็บนี้
              </article>
            ) : (
              <>
                <div className="space-y-2 md:hidden">
                  {visibleOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/orders/${order.id}`}
                      className="block rounded-xl border bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">{order.orderNo}</p>
                          <h3 className="text-sm font-semibold">
                            {order.customerName || order.contactDisplayName || "ลูกค้าทั่วไป"}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            ช่องทาง {channelLabel[order.channel]} • จ่าย {order.paymentCurrency} •{" "}
                            {paymentMethodLabel[order.paymentMethod]}
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs ${statusClass[order.status]}`}>
                          {statusLabel[order.status]}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium">
                        {order.total.toLocaleString("th-TH")} {catalog.storeCurrency}
                      </p>
                    </Link>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-xl border bg-white shadow-sm md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-muted-foreground">
                      {ordersTable.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <th key={header.id} className="px-3 py-2 font-medium">
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
                        <tr key={row.id} className="border-t">
                          {row.getVisibleCells().map((cell, index) => (
                            <td key={cell.id} className="px-3 py-3">
                              {index === 0 ? (
                                <Link
                                  className="font-medium text-blue-700 hover:underline"
                                  href={`/orders/${row.original.id}`}
                                >
                                  {row.original.orderNo}
                                </Link>
                              ) : (
                                flexRender(cell.column.columnDef.cell, cell.getContext())
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-xs">
                  <p className="text-muted-foreground">
                    หน้า {ordersPage!.page.toLocaleString("th-TH")} /{" "}
                    {ordersPage!.pageCount.toLocaleString("th-TH")} ({ordersPage!.total.toLocaleString("th-TH")} รายการ)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 px-2 text-xs"
                      disabled={ordersPage!.page <= 1}
                      onClick={() => router.push(buildOrdersUrl(activeTab, ordersPage!.page - 1))}
                    >
                      ก่อนหน้า
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 px-2 text-xs"
                      disabled={ordersPage!.page >= ordersPage!.pageCount}
                      onClick={() => router.push(buildOrdersUrl(activeTab, ordersPage!.page + 1))}
                    >
                      ถัดไป
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>

          <SlideUpSheet
            isOpen={createFormOpen}
            onClose={closeCreateForm}
            title="สร้างออเดอร์ใหม่"
            description="มือถือ: Slide-up / เดสก์ท็อป: Modal"
            disabled={loading}
          >
            {renderCreateOrderForm({ inSheet: true })}
          </SlideUpSheet>
        </>
      )}
      <SlideUpSheet
        isOpen={showScannerPermissionSheet}
        onClose={() => setShowScannerPermissionSheet(false)}
        title="ขออนุญาตใช้กล้อง"
        description="ระบบต้องใช้กล้องเพื่อสแกนบาร์โค้ดสินค้า"
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-medium text-slate-700">ทำไมต้องใช้กล้อง?</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>สแกนบาร์โค้ดได้เร็วขึ้น</li>
              <li>ลดความผิดพลาดจากการพิมพ์</li>
              <li>ใช้งานได้ทันทีในหน้านี้</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1"
              onClick={() => setShowScannerPermissionSheet(false)}
            >
              ยกเลิก
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
              อนุญาตและสแกน
            </Button>
          </div>
        </div>
      </SlideUpSheet>
      <SlideUpSheet
        isOpen={showScannerSheet}
        onClose={() => setShowScannerSheet(false)}
        title="สแกนบาร์โค้ดสินค้า"
        description="สแกนแล้วเพิ่มสินค้าเข้าออเดอร์อัตโนมัติ"
        disabled={loading}
      >
        <div className="p-4">
          {showScannerSheet ? (
            <BarcodeScannerPanel
              isOpen={showScannerSheet}
              onResult={onScanBarcodeResult}
              onClose={() => setShowScannerSheet(false)}
              cameraSelectId="orders-barcode-scanner-camera-select"
            />
          ) : null}
        </div>
      </SlideUpSheet>
      <SlideUpSheet
        isOpen={showCartSheet}
        onClose={() => setShowCartSheet(false)}
        title="ตะกร้าสินค้า"
        description="ตรวจสอบและแก้จำนวนสินค้าก่อนสร้างออเดอร์"
        disabled={loading}
      >
        <div className="space-y-3">
          {watchedItems.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-sm text-slate-500">
              ยังไม่มีรายการสินค้าในตะกร้า
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
                          {selectedProduct?.name ?? "ไม่พบสินค้า"}
                        </p>
                        <p className="text-xs text-slate-500">
                          คงเหลือ {selectedProduct?.available.toLocaleString("th-TH") ?? 0}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-red-600"
                        onClick={() => remove(index)}
                        disabled={loading}
                      >
                        ลบ
                      </button>
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_auto_8.5rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_9.5rem]">
                      <select
                        className="h-8 w-full min-w-0 rounded-md border px-2 text-xs outline-none ring-primary focus:ring-2"
                        value={item.unitId ?? ""}
                        onChange={(event) =>
                          form.setValue(`items.${index}.unitId`, event.target.value, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
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
                          aria-label="ลดจำนวน"
                        >
                          -
                        </button>
                        <div className="min-w-8 text-center text-xs font-medium text-slate-800">
                          {(Number(item.qty ?? 0) || 0).toLocaleString("th-TH")}
                        </div>
                        <button
                          type="button"
                          className="h-8 w-8 rounded-md border text-sm text-slate-700"
                          onClick={() => increaseItemQty(index)}
                          disabled={loading || availableQty <= 0 || currentQty >= availableQty}
                          aria-label="เพิ่มจำนวน"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-right text-sm font-semibold tabular-nums text-slate-900">
                        {lineTotal.toLocaleString("th-TH")} {catalog.storeCurrency}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p>
              จำนวนทั้งหมด: {cartQtyTotal.toLocaleString("th-TH")} ชิ้น ({watchedItems.length.toLocaleString("th-TH")} รายการ)
            </p>
            <p className="font-semibold">
              ยอดรวมสุทธิ: {totals.total.toLocaleString("th-TH")} {catalog.storeCurrency}
            </p>
          </div>

          {isCreateOnlyMode ? (
            <div className="space-y-2">
              <Button type="button" className="h-10 w-full" onClick={openCheckoutSheet}>
                ไปชำระเงิน / กรอกรายละเอียด
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full"
                onClick={() => setShowCartSheet(false)}
              >
                กลับไปเลือกสินค้า
              </Button>
            </div>
          ) : (
            <Button type="button" className="h-10 w-full" onClick={() => setShowCartSheet(false)}>
              กลับไปแก้ฟอร์มออเดอร์
            </Button>
          )}
        </div>
      </SlideUpSheet>
      {isCreateOnlyMode ? (
        <SlideUpSheet
          isOpen={showCheckoutSheet}
          onClose={requestCloseCheckoutSheet}
          closeOnBackdrop={false}
          title="ชำระเงินและรายละเอียดออเดอร์"
          description="กรอกข้อมูลลูกค้า การชำระเงิน และยืนยันสร้างออเดอร์"
          disabled={loading}
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
              ปิดหน้าชำระเงิน?
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              มีข้อมูลที่กรอกไว้ในขั้นตอนนี้ ต้องการปิดหน้าชำระเงินและกลับไปเลือกสินค้าหรือไม่
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9"
                onClick={() => setShowCheckoutCloseConfirm(false)}
              >
                กลับไปแก้ไข
              </Button>
              <Button type="button" className="h-9" onClick={closeCheckoutSheet}>
                ปิดหน้าชำระเงิน
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </section>
  );
}
