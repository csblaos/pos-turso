import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { db, getLibsqlClient } from "@/lib/db/client";
import { getInventoryBalancesByStoreForProducts } from "@/lib/inventory/queries";
import {
  auditEvents,
  productCategories,
  productModels,
  productUnits,
  products,
  units,
} from "@/lib/db/schema";
import {
  parseVariantOptions,
  type ProductVariantOption,
} from "@/lib/products/variant-options";
import { resolveProductImageUrl } from "@/lib/storage/r2";

export type UnitOption = {
  id: string;
  code: string;
  nameTh: string;
  scope: "SYSTEM" | "STORE";
  storeId: string | null;
};

export type ProductConversionView = {
  unitId: string;
  unitCode: string;
  unitNameTh: string;
  multiplierToBase: number;
  enabledForSale: boolean;
  pricePerUnit: number | null;
};

export type ProductCostTrackingSource = "MANUAL" | "PURCHASE_ORDER" | "UNKNOWN";

export type ProductCostTracking = {
  source: ProductCostTrackingSource;
  updatedAt: string | null;
  actorName: string | null;
  reason: string | null;
  reference: string | null;
};

export type ProductLatestPurchaseOrderCost = {
  costBase: number;
  updatedAt: string | null;
  actorName: string | null;
  reference: string | null;
  reason: string | null;
};

export type ProductListItem = {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  modelId: string | null;
  modelName: string | null;
  variantLabel: string | null;
  variantOptionsJson: string | null;
  variantOptions: ProductVariantOption[];
  variantSortOrder: number;
  imageUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  baseUnitId: string;
  baseUnitCode: string;
  baseUnitNameTh: string;
  allowBaseUnitSale: boolean;
  priceBase: number;
  costBase: number;
  outStockThreshold: number | null;
  lowStockThreshold: number | null;
  stockOnHand: number;
  stockReserved: number;
  stockAvailable: number;
  costTracking: ProductCostTracking;
  latestPurchaseOrderCost: ProductLatestPurchaseOrderCost | null;
  active: boolean;
  createdAt: string;
  conversions: ProductConversionView[];
};

export type ProductStatusFilter = "all" | "active" | "inactive";
export type ProductSortOption = "newest" | "name-asc" | "name-desc" | "price-asc" | "price-desc";

export type ProductPageResult = {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type ProductSummaryCounts = {
  total: number;
  active: number;
  inactive: number;
};

type ProductListDataMode = "full" | "lite";

type ProductRowWithConversion = {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  modelId: string | null;
  modelName: string | null;
  variantLabel: string | null;
  variantOptionsJson: string | null;
  variantSortOrder: number;
  imageUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  baseUnitId: string;
  baseUnitCode: string;
  baseUnitNameTh: string;
  allowBaseUnitSale: boolean;
  priceBase: number;
  costBase: number;
  outStockThreshold: number | null;
  lowStockThreshold: number | null;
  active: boolean;
  createdAt: string;
  conversionUnitId: string | null;
  conversionUnitCode: string | null;
  conversionUnitNameTh: string | null;
  multiplierToBase: number | null;
  conversionEnabledForSale: boolean | null;
  conversionPricePerUnit: number | null;
};

export async function listUnits(storeId: string): Promise<UnitOption[]> {
  const rows = await db
    .select({
      id: units.id,
      code: units.code,
      nameTh: units.nameTh,
      scope: units.scope,
      storeId: units.storeId,
    })
    .from(units)
    .where(
      or(
        eq(units.scope, "SYSTEM"),
        and(eq(units.scope, "STORE"), eq(units.storeId, storeId)),
      ),
    )
    .orderBy(sql`case when ${units.scope} = 'STORE' then 0 else 1 end`, asc(units.code));

  return rows;
}

const mapProductRows = (rows: ProductRowWithConversion[]): ProductListItem[] => {
  const productMap = new Map<string, ProductListItem>();

  for (const row of rows) {
    const current = productMap.get(row.id);
    if (!current) {
      productMap.set(row.id, {
        id: row.id,
        sku: row.sku,
        name: row.name,
        barcode: row.barcode,
        modelId: row.modelId,
        modelName: row.modelName,
        variantLabel: row.variantLabel,
        variantOptionsJson: row.variantOptionsJson,
        variantOptions: parseVariantOptions(row.variantOptionsJson),
        variantSortOrder: row.variantSortOrder,
        imageUrl: resolveProductImageUrl(row.imageUrl),
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        baseUnitId: row.baseUnitId,
        baseUnitCode: row.baseUnitCode,
        baseUnitNameTh: row.baseUnitNameTh,
        allowBaseUnitSale: Boolean(row.allowBaseUnitSale),
        priceBase: row.priceBase,
        costBase: row.costBase,
        outStockThreshold: row.outStockThreshold ?? null,
        lowStockThreshold: row.lowStockThreshold ?? null,
        stockOnHand: 0,
        stockReserved: 0,
        stockAvailable: 0,
        costTracking: {
          source: "UNKNOWN",
          updatedAt: null,
          actorName: null,
          reason: null,
          reference: null,
        },
        latestPurchaseOrderCost: null,
        active: Boolean(row.active),
        createdAt: row.createdAt,
        conversions: [],
      });
    }

    if (
      row.conversionUnitId &&
      row.conversionUnitCode &&
      row.conversionUnitNameTh &&
      row.multiplierToBase !== null
    ) {
      const item = productMap.get(row.id);
      if (item) {
        item.conversions.push({
          unitId: row.conversionUnitId,
          unitCode: row.conversionUnitCode,
          unitNameTh: row.conversionUnitNameTh,
          multiplierToBase: row.multiplierToBase,
          enabledForSale: Boolean(row.conversionEnabledForSale),
          pricePerUnit: row.conversionPricePerUnit ?? null,
        });
      }
    }
  }

  const productsList = [...productMap.values()];
  productsList.forEach((item) => {
    item.conversions.sort((a, b) => a.multiplierToBase - b.multiplierToBase);
  });

  return productsList;
};

const parseAuditMetadata = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
};

const getMetadataText = (metadata: Record<string, unknown> | null, key: string) => {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

async function getLatestCostTrackingByProductIds(
  storeId: string,
  productIds: string[],
): Promise<{
  trackingByProductId: Map<string, ProductCostTracking>;
  latestPurchaseOrderCostByProductId: Map<string, ProductLatestPurchaseOrderCost>;
}> {
  if (productIds.length === 0) {
    return {
      trackingByProductId: new Map(),
      latestPurchaseOrderCostByProductId: new Map(),
    };
  }

  const rows = await db
    .select({
      entityId: auditEvents.entityId,
      action: auditEvents.action,
      actorName: auditEvents.actorName,
      metadata: auditEvents.metadata,
      occurredAt: auditEvents.occurredAt,
    })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.storeId, storeId),
        eq(auditEvents.entityType, "product"),
        inArray(auditEvents.entityId, productIds),
        inArray(auditEvents.action, [
          "product.cost.manual_update",
          "product.cost.auto_from_po",
        ]),
      ),
    )
    .orderBy(desc(auditEvents.occurredAt));

  const trackingByProductId = new Map<string, ProductCostTracking>();
  const latestPurchaseOrderCostByProductId = new Map<
    string,
    ProductLatestPurchaseOrderCost
  >();
  for (const row of rows) {
    if (!row.entityId) continue;
    const metadata = parseAuditMetadata(row.metadata);
    const source: ProductCostTrackingSource =
      row.action === "product.cost.manual_update"
        ? "MANUAL"
        : row.action === "product.cost.auto_from_po"
          ? "PURCHASE_ORDER"
          : "UNKNOWN";

    if (!trackingByProductId.has(row.entityId)) {
      trackingByProductId.set(row.entityId, {
        source,
        updatedAt: row.occurredAt ?? null,
        actorName: row.actorName ?? null,
        reason:
          source === "MANUAL"
            ? getMetadataText(metadata, "reason")
            : getMetadataText(metadata, "note"),
        reference:
          source === "PURCHASE_ORDER"
            ? getMetadataText(metadata, "poNumber")
            : null,
      });
    }

    if (
      row.action === "product.cost.auto_from_po" &&
      !latestPurchaseOrderCostByProductId.has(row.entityId)
    ) {
      const nextCostBase = metadata?.nextCostBase;
      if (typeof nextCostBase === "number" && Number.isFinite(nextCostBase)) {
        latestPurchaseOrderCostByProductId.set(row.entityId, {
          costBase: Math.round(nextCostBase),
          updatedAt: row.occurredAt ?? null,
          actorName: row.actorName ?? null,
          reference: getMetadataText(metadata, "poNumber"),
          reason: getMetadataText(metadata, "note"),
        });
      }
    }
  }

  return {
    trackingByProductId,
    latestPurchaseOrderCostByProductId,
  };
}

const buildProductsWhere = ({
  storeId,
  search,
  categoryId,
  status,
}: {
  storeId: string;
  search?: string;
  categoryId?: string;
  status?: ProductStatusFilter;
}) => {
  let whereClause = eq(products.storeId, storeId);
  const keyword = search?.trim();
  const normalizedCategoryId = categoryId?.trim();

  if (keyword) {
    whereClause = and(
      whereClause,
      or(
        like(products.name, `%${keyword}%`),
        like(products.sku, `%${keyword}%`),
        like(products.barcode, `%${keyword}%`),
        like(products.variantLabel, `%${keyword}%`),
      ),
    )!;
  }

  if (normalizedCategoryId) {
    whereClause = and(whereClause, eq(products.categoryId, normalizedCategoryId))!;
  }

  if (status === "active") {
    whereClause = and(whereClause, eq(products.active, true))!;
  } else if (status === "inactive") {
    whereClause = and(whereClause, eq(products.active, false))!;
  }

  return whereClause;
};

const defaultCostTracking = (): ProductCostTracking => ({
  source: "UNKNOWN",
  updatedAt: null,
  actorName: null,
  reason: null,
  reference: null,
});

async function listStoreProductsPageLiteRaw({
  storeId,
  search,
  categoryId,
  status = "all",
  sort = "newest",
  page = 1,
  pageSize = 30,
}: {
  storeId: string;
  search?: string;
  categoryId?: string;
  status?: ProductStatusFilter;
  sort?: ProductSortOption;
  page?: number;
  pageSize?: number;
}): Promise<ProductPageResult> {
  const client = getLibsqlClient();
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));
  const offset = (safePage - 1) * safePageSize;

  const args: Array<string | number> = [storeId];
  const whereParts = ["p.store_id = ?"];
  const keyword = search?.trim();
  if (keyword) {
    const keywordLike = `%${keyword}%`;
    whereParts.push(
      "(p.name like ? or p.sku like ? or p.barcode like ? or p.variant_label like ?)",
    );
    args.push(keywordLike, keywordLike, keywordLike, keywordLike);
  }

  const normalizedCategoryId = categoryId?.trim();
  if (normalizedCategoryId) {
    whereParts.push("p.category_id = ?");
    args.push(normalizedCategoryId);
  }

  if (status === "active") {
    whereParts.push("p.active = 1");
  } else if (status === "inactive") {
    whereParts.push("p.active = 0");
  }

  const orderBy =
    sort === "name-asc"
      ? "p.name asc, p.created_at desc"
      : sort === "name-desc"
        ? "p.name desc, p.created_at desc"
        : sort === "price-asc"
          ? "p.price_base asc, p.name asc"
          : sort === "price-desc"
            ? "p.price_base desc, p.name asc"
            : "p.created_at desc, p.name asc";

  const whereSql = whereParts.join(" and ");
  const rowsResult = await client.execute({
    sql: `
      select
        p.id,
        p.sku,
        p.name,
        p.barcode,
        p.model_id,
        pm.name as model_name,
        p.variant_label,
        p.variant_options_json,
        p.variant_sort_order,
        p.image_url,
        p.category_id,
        pc.name as category_name,
        p.base_unit_id,
        bu.code as base_unit_code,
        bu.name_th as base_unit_name_th,
        p.allow_base_unit_sale,
        p.price_base,
        p.cost_base,
        p.out_stock_threshold,
        p.low_stock_threshold,
        p.active,
        p.created_at,
        coalesce(ib.on_hand_base, 0) as stock_on_hand,
        coalesce(ib.reserved_base, 0) as stock_reserved,
        coalesce(ib.available_base, 0) as stock_available,
        count(*) over() as total_count
      from products p
      inner join units bu on bu.id = p.base_unit_id
      left join product_models pm on pm.id = p.model_id
      left join product_categories pc on pc.id = p.category_id
      left join inventory_balances ib
        on ib.store_id = p.store_id
       and ib.product_id = p.id
      where ${whereSql}
      order by ${orderBy}
      limit ? offset ?
    `,
    args: [...args, safePageSize, offset],
  });

  const rows = rowsResult.rows;
  const items: ProductListItem[] = rows.map((row) => ({
    id: String(row.id),
    sku: String(row.sku),
    name: String(row.name),
    barcode: row.barcode ? String(row.barcode) : null,
    modelId: row.model_id ? String(row.model_id) : null,
    modelName: row.model_name ? String(row.model_name) : null,
    variantLabel: row.variant_label ? String(row.variant_label) : null,
    variantOptionsJson: row.variant_options_json ? String(row.variant_options_json) : null,
    variantOptions: parseVariantOptions(
      row.variant_options_json ? String(row.variant_options_json) : null,
    ),
    variantSortOrder: Number(row.variant_sort_order ?? 0),
    imageUrl: resolveProductImageUrl(row.image_url ? String(row.image_url) : null),
    categoryId: row.category_id ? String(row.category_id) : null,
    categoryName: row.category_name ? String(row.category_name) : null,
    baseUnitId: String(row.base_unit_id),
    baseUnitCode: String(row.base_unit_code),
    baseUnitNameTh: String(row.base_unit_name_th),
    allowBaseUnitSale: Number(row.allow_base_unit_sale ?? 0) === 1,
    priceBase: Number(row.price_base ?? 0),
    costBase: Number(row.cost_base ?? 0),
    outStockThreshold:
      row.out_stock_threshold === null || row.out_stock_threshold === undefined
        ? null
        : Number(row.out_stock_threshold),
    lowStockThreshold:
      row.low_stock_threshold === null || row.low_stock_threshold === undefined
        ? null
        : Number(row.low_stock_threshold),
    stockOnHand: Number(row.stock_on_hand ?? 0),
    stockReserved: Number(row.stock_reserved ?? 0),
    stockAvailable: Number(row.stock_available ?? 0),
    costTracking: defaultCostTracking(),
    latestPurchaseOrderCost: null,
    active: Number(row.active ?? 0) === 1,
    createdAt: String(row.created_at),
    conversions: [],
  }));

  const total =
    rows.length > 0
      ? Number(rows[0]?.total_count ?? 0)
      : Number(
          (
            await client.execute({
              sql: `
                select count(*) as total
                from products p
                where ${whereSql}
              `,
              args,
            })
          ).rows[0]?.total ?? 0,
        );

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
  };
}

async function listStoreProductsByIds(
  storeId: string,
  productIds: string[],
  options?: {
    mode?: ProductListDataMode;
  },
): Promise<ProductListItem[]> {
  if (productIds.length === 0) return [];
  const mode = options?.mode ?? "full";

  const baseUnits = alias(units, "base_units");
  const conversionUnits = alias(units, "conversion_units");

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      barcode: products.barcode,
      modelId: products.modelId,
      modelName: productModels.name,
      variantLabel: products.variantLabel,
      variantOptionsJson: products.variantOptionsJson,
      variantSortOrder: products.variantSortOrder,
      imageUrl: products.imageUrl,
      categoryId: products.categoryId,
      categoryName: productCategories.name,
      baseUnitId: products.baseUnitId,
      baseUnitCode: baseUnits.code,
      baseUnitNameTh: baseUnits.nameTh,
      allowBaseUnitSale: products.allowBaseUnitSale,
      priceBase: products.priceBase,
      costBase: products.costBase,
      outStockThreshold: products.outStockThreshold,
      lowStockThreshold: products.lowStockThreshold,
      active: products.active,
      createdAt: products.createdAt,
      conversionUnitId:
        mode === "full" ? conversionUnits.id : sql<string | null>`null`,
      conversionUnitCode:
        mode === "full" ? conversionUnits.code : sql<string | null>`null`,
      conversionUnitNameTh:
        mode === "full" ? conversionUnits.nameTh : sql<string | null>`null`,
      multiplierToBase:
        mode === "full" ? productUnits.multiplierToBase : sql<number | null>`null`,
      conversionEnabledForSale:
        mode === "full" ? productUnits.enabledForSale : sql<boolean | null>`null`,
      conversionPricePerUnit:
        mode === "full" ? productUnits.pricePerUnit : sql<number | null>`null`,
    })
    .from(products)
    .innerJoin(baseUnits, eq(products.baseUnitId, baseUnits.id))
    .leftJoin(productModels, eq(products.modelId, productModels.id))
    .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
    .leftJoin(
      productUnits,
      mode === "full" ? eq(productUnits.productId, products.id) : sql`0 = 1`,
    )
    .leftJoin(
      conversionUnits,
      mode === "full" ? eq(productUnits.unitId, conversionUnits.id) : sql`0 = 1`,
    )
    .where(and(eq(products.storeId, storeId), inArray(products.id, productIds)));
  const balances = await getInventoryBalancesByStoreForProducts(storeId, productIds);
  const costAuditSummary =
    mode === "full"
      ? await getLatestCostTrackingByProductIds(storeId, productIds)
      : {
          trackingByProductId: new Map<string, ProductCostTracking>(),
          latestPurchaseOrderCostByProductId:
            new Map<string, ProductLatestPurchaseOrderCost>(),
        };

  const items = mapProductRows(rows);
  const balanceByProductId = new Map(balances.map((balance) => [balance.productId, balance]));

  return items.map((item) => {
    const balance = balanceByProductId.get(item.id);
    return {
      ...item,
      stockOnHand: balance?.onHand ?? 0,
      stockReserved: balance?.reserved ?? 0,
      stockAvailable: balance?.available ?? 0,
      costTracking:
        costAuditSummary.trackingByProductId.get(item.id) ?? item.costTracking,
      latestPurchaseOrderCost:
        costAuditSummary.latestPurchaseOrderCostByProductId.get(item.id) ??
        item.latestPurchaseOrderCost,
    };
  });
}

export async function listStoreProducts(
  storeId: string,
  search?: string,
  options?: {
    mode?: ProductListDataMode;
  },
): Promise<ProductListItem[]> {
  const whereClause = buildProductsWhere({ storeId, search });
  const idRows = await db
    .select({ id: products.id })
    .from(products)
    .where(whereClause)
    .orderBy(desc(products.createdAt), asc(products.name));

  const orderedIds = idRows.map((row) => row.id);
  const items = await listStoreProductsByIds(storeId, orderedIds, options);
  const itemById = new Map(items.map((item) => [item.id, item]));

  return orderedIds.flatMap((id) => {
    const item = itemById.get(id);
    return item ? [item] : [];
  });
}

export async function listStoreProductsPage({
  storeId,
  search,
  categoryId,
  status = "all",
  sort = "newest",
  page = 1,
  pageSize = 30,
  mode = "full",
}: {
  storeId: string;
  search?: string;
  categoryId?: string;
  status?: ProductStatusFilter;
  sort?: ProductSortOption;
  page?: number;
  pageSize?: number;
  mode?: ProductListDataMode;
}): Promise<ProductPageResult> {
  if (mode === "lite") {
    return listStoreProductsPageLiteRaw({
      storeId,
      search,
      categoryId,
      status,
      sort,
      page,
      pageSize,
    });
  }

  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));
  const offset = (safePage - 1) * safePageSize;

  const whereClause = buildProductsWhere({
    storeId,
    search,
    categoryId,
    status,
  });

  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(products)
    .where(whereClause);
  const total = Number(countRow?.total ?? 0);

  const idRows =
    sort === "name-asc"
      ? await db
          .select({ id: products.id })
          .from(products)
          .where(whereClause)
          .orderBy(asc(products.name), desc(products.createdAt))
          .limit(safePageSize)
          .offset(offset)
      : sort === "name-desc"
      ? await db
          .select({ id: products.id })
          .from(products)
          .where(whereClause)
          .orderBy(desc(products.name), desc(products.createdAt))
          .limit(safePageSize)
          .offset(offset)
      : sort === "price-asc"
      ? await db
          .select({ id: products.id })
          .from(products)
          .where(whereClause)
          .orderBy(asc(products.priceBase), asc(products.name))
          .limit(safePageSize)
          .offset(offset)
      : sort === "price-desc"
      ? await db
          .select({ id: products.id })
          .from(products)
          .where(whereClause)
          .orderBy(desc(products.priceBase), asc(products.name))
          .limit(safePageSize)
          .offset(offset)
      : await db
          .select({ id: products.id })
          .from(products)
          .where(whereClause)
          .orderBy(desc(products.createdAt), asc(products.name))
          .limit(safePageSize)
          .offset(offset);
  const orderedIds = idRows.map((row) => row.id);
  const items = await listStoreProductsByIds(storeId, orderedIds, { mode });
  const itemById = new Map(items.map((item) => [item.id, item]));

  return {
    items: orderedIds.flatMap((id) => {
      const item = itemById.get(id);
      return item ? [item] : [];
    }),
    total,
    page: safePage,
    pageSize: safePageSize,
  };
}

export async function getStoreProductById(
  storeId: string,
  productId: string,
): Promise<ProductListItem | null> {
  const items = await listStoreProductsByIds(storeId, [productId], { mode: "full" });
  return items[0] ?? null;
}

export async function getStoreProductSummaryCounts(
  storeId: string,
): Promise<ProductSummaryCounts> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when ${products.active} = 1 then 1 else 0 end)`,
    })
    .from(products)
    .where(eq(products.storeId, storeId));

  const total = Number(row?.total ?? 0);
  const active = Number(row?.active ?? 0);

  return {
    total,
    active,
    inactive: Math.max(total - active, 0),
  };
}

export async function listStoreProductModelNames({
  storeId,
  search,
  limit = 10,
}: {
  storeId: string;
  search?: string;
  limit?: number;
}): Promise<string[]> {
  const safeLimit = Math.min(30, Math.max(1, Math.trunc(limit)));
  const keyword = search?.trim();

  const whereClause = keyword
    ? and(eq(productModels.storeId, storeId), like(productModels.name, `%${keyword}%`))
    : eq(productModels.storeId, storeId);

  const rows = await db
    .select({
      name: productModels.name,
      usageCount: sql<number>`count(${products.id})`,
    })
    .from(productModels)
    .leftJoin(
      products,
      and(eq(products.modelId, productModels.id), eq(products.storeId, storeId)),
    )
    .where(whereClause)
    .groupBy(productModels.id, productModels.name)
    .orderBy(sql`count(${products.id}) desc`, asc(productModels.name))
    .limit(safeLimit);

  return rows
    .map((row) => row.name.trim())
    .filter((name) => name.length > 0);
}

export async function getNextVariantSortOrderByModelName({
  storeId,
  modelName,
}: {
  storeId: string;
  modelName: string;
}): Promise<number> {
  const normalizedModelName = modelName.trim();
  if (!normalizedModelName) return 0;

  const [row] = await db
    .select({
      maxSortOrder: sql<number | null>`max(${products.variantSortOrder})`,
    })
    .from(productModels)
    .leftJoin(
      products,
      and(eq(products.modelId, productModels.id), eq(products.storeId, storeId)),
    )
    .where(
      and(
        eq(productModels.storeId, storeId),
        eq(productModels.name, normalizedModelName),
      ),
    );

  const maxSortOrder = Number(row?.maxSortOrder ?? -1);
  if (!Number.isFinite(maxSortOrder)) return 0;

  return Math.max(0, maxSortOrder + 1);
}

export async function listVariantLabelsByModelName({
  storeId,
  modelName,
  search,
  limit = 5,
}: {
  storeId: string;
  modelName: string;
  search?: string;
  limit?: number;
}): Promise<string[]> {
  const normalizedModelName = modelName.trim();
  if (!normalizedModelName) return [];

  const safeLimit = Math.min(30, Math.max(1, Math.trunc(limit)));
  const keyword = search?.trim();

  let whereClause = and(
    eq(productModels.storeId, storeId),
    eq(productModels.name, normalizedModelName),
    sql`${products.variantLabel} is not null`,
    sql`length(trim(${products.variantLabel})) > 0`,
  );

  if (keyword) {
    whereClause = and(whereClause, like(products.variantLabel, `%${keyword}%`));
  }

  const rows = await db
    .select({
      variantLabel: products.variantLabel,
      usageCount: sql<number>`count(${products.id})`,
    })
    .from(productModels)
    .innerJoin(
      products,
      and(eq(products.modelId, productModels.id), eq(products.storeId, storeId)),
    )
    .where(whereClause)
    .groupBy(products.variantLabel)
    .orderBy(sql`count(${products.id}) desc`, asc(products.variantLabel))
    .limit(safeLimit);

  return rows
    .map((row) => row.variantLabel?.trim() ?? "")
    .filter((name) => name.length > 0);
}

/* ── Categories ── */

export type CategoryItem = {
  id: string;
  name: string;
  sortOrder: number;
  productCount: number;
};

export async function listCategories(storeId: string): Promise<CategoryItem[]> {
  const rows = await db
    .select({
      id: productCategories.id,
      name: productCategories.name,
      sortOrder: productCategories.sortOrder,
      productCount: sql<number>`count(${products.id})`,
    })
    .from(productCategories)
    .leftJoin(
      products,
      and(
        eq(products.categoryId, productCategories.id),
        eq(products.storeId, storeId),
      ),
    )
    .where(eq(productCategories.storeId, storeId))
    .groupBy(
      productCategories.id,
      productCategories.name,
      productCategories.sortOrder,
    )
    .orderBy(asc(productCategories.sortOrder), asc(productCategories.name));

  return rows;
}
