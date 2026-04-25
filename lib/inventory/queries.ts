import { and, asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { db, getLibsqlClient } from "@/lib/db/client";
import {
  inventoryMovements,
  productUnits,
  products,
  stores,
  units,
  users,
} from "@/lib/db/schema";
import {
  getInventoryBalanceSnapshot,
  listInventoryBalancesByStore,
  listInventoryBalancesByStoreForProducts,
} from "@/lib/inventory/balances";
import { createPerfScope } from "@/server/perf/perf";

export type InventoryBalance = {
  productId: string;
  onHand: number;
  reserved: number;
  available: number;
};

export type StockUnitOption = {
  unitId: string;
  unitCode: string;
  unitNameTh: string;
  multiplierToBase: number;
};

export type StockProductOption = {
  productId: string;
  sku: string;
  barcode: string | null;
  name: string;
  active: boolean;
  baseUnitId: string;
  baseUnitCode: string;
  baseUnitNameTh: string;
  onHand: number;
  reserved: number;
  available: number;
  outStockThreshold: number | null;
  lowStockThreshold: number | null;
  unitOptions: StockUnitOption[];
};

export type InventoryMovementView = {
  id: string;
  productId: string;
  productSku: string;
  productBarcode: string | null;
  productName: string;
  type: "IN" | "OUT" | "RESERVE" | "RELEASE" | "ADJUST" | "RETURN";
  qtyBase: number;
  note: string | null;
  createdAt: string;
  createdByName: string | null;
};

export type InventoryMovementFilters = {
  type?: InventoryMovementView["type"];
  productId?: string;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type InventoryMovementPage = {
  movements: InventoryMovementView[];
  total: number;
};

export type LowStockItem = {
  productId: string;
  sku: string;
  name: string;
  available: number;
  baseUnitCode: string;
};

export type StoreStockThresholds = {
  outStockThreshold: number;
  lowStockThreshold: number;
};

export async function getStoreStockThresholds(
  storeId: string,
): Promise<StoreStockThresholds> {
  const [store] = await db
    .select({
      outStockThreshold: stores.outStockThreshold,
      lowStockThreshold: stores.lowStockThreshold,
    })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  return {
    outStockThreshold: store?.outStockThreshold ?? 0,
    lowStockThreshold: store?.lowStockThreshold ?? 10,
  };
}

export async function getInventoryBalancesByStore(storeId: string) {
  const rows = await listInventoryBalancesByStore(storeId);
  return rows.map((row) => ({
    productId: row.productId,
    onHand: row.onHand,
    reserved: row.reserved,
    available: row.available,
  }));
}

export async function getInventoryBalancesByStoreForProducts(
  storeId: string,
  productIds: string[],
) {
  const rows = await listInventoryBalancesByStoreForProducts(storeId, productIds);
  return rows.map((row) => ({
    productId: row.productId,
    onHand: row.onHand,
    reserved: row.reserved,
    available: row.available,
  }));
}

export async function getInventoryBalanceForProduct(storeId: string, productId: string) {
  const row = await getInventoryBalanceSnapshot(storeId, productId);
  return {
    productId,
    onHand: row.onHand,
    reserved: row.reserved,
    available: row.available,
  };
}

export async function getStockProductsForStore(
  storeId: string,
): Promise<StockProductOption[]> {
  const baseUnits = alias(units, "base_units");

  const [productRows, conversionRows, balances] = await Promise.all([
    db
      .select({
        productId: products.id,
        sku: products.sku,
        barcode: products.barcode,
        name: products.name,
        active: products.active,
        baseUnitId: products.baseUnitId,
        baseUnitCode: baseUnits.code,
        baseUnitNameTh: baseUnits.nameTh,
        outStockThreshold: products.outStockThreshold,
        lowStockThreshold: products.lowStockThreshold,
      })
      .from(products)
      .innerJoin(baseUnits, eq(products.baseUnitId, baseUnits.id))
      .where(eq(products.storeId, storeId))
      .orderBy(asc(products.name)),
    db
      .select({
        productId: productUnits.productId,
        unitId: units.id,
        unitCode: units.code,
        unitNameTh: units.nameTh,
        multiplierToBase: productUnits.multiplierToBase,
      })
      .from(productUnits)
      .innerJoin(products, eq(productUnits.productId, products.id))
      .innerJoin(units, eq(productUnits.unitId, units.id))
      .where(eq(products.storeId, storeId)),
    getInventoryBalancesByStore(storeId),
  ]);

  const balanceMap = new Map(balances.map((row) => [row.productId, row]));
  const conversionMap = new Map<string, StockUnitOption[]>();

  for (const row of conversionRows) {
    const current = conversionMap.get(row.productId) ?? [];
    current.push({
      unitId: row.unitId,
      unitCode: row.unitCode,
      unitNameTh: row.unitNameTh,
      multiplierToBase: row.multiplierToBase,
    });
    conversionMap.set(row.productId, current);
  }

  return productRows.map((product) => {
    const balance = balanceMap.get(product.productId);
    const conversionOptions = conversionMap.get(product.productId) ?? [];

    const unitOptionMap = new Map<string, StockUnitOption>();
    unitOptionMap.set(product.baseUnitId, {
      unitId: product.baseUnitId,
      unitCode: product.baseUnitCode,
      unitNameTh: product.baseUnitNameTh,
      multiplierToBase: 1,
    });

    for (const option of conversionOptions) {
      if (!unitOptionMap.has(option.unitId)) {
        unitOptionMap.set(option.unitId, option);
      }
    }

    const unitOptions = [...unitOptionMap.values()].sort(
      (a, b) => a.multiplierToBase - b.multiplierToBase,
    );

    return {
      productId: product.productId,
      sku: product.sku,
      barcode: product.barcode ?? null,
      name: product.name,
      active: Boolean(product.active),
      baseUnitId: product.baseUnitId,
      baseUnitCode: product.baseUnitCode,
      baseUnitNameTh: product.baseUnitNameTh,
      onHand: balance?.onHand ?? 0,
      reserved: balance?.reserved ?? 0,
      available: balance?.available ?? 0,
      outStockThreshold: product.outStockThreshold ?? null,
      lowStockThreshold: product.lowStockThreshold ?? null,
      unitOptions,
    };
  });
}

export async function getStockProductsForStorePage(
  storeId: string,
  limit: number,
  offset: number,
  categoryId?: string | null,
  query?: string | null,
  options?: {
    includeUnitOptions?: boolean;
    productId?: string | null;
  },
): Promise<StockProductOption[]> {
  const perf = createPerfScope("stock.query.productsPage");
  const client = getLibsqlClient();
  const includeUnitOptions = options?.includeUnitOptions ?? true;
  const exactProductId = options?.productId?.trim() ?? "";
  const normalizedQuery = query?.trim().toLowerCase() ?? "";
  const hasCategoryFilter = Boolean(categoryId);
  const hasSearch = normalizedQuery.length > 0;
  const hasExactProductId = exactProductId.length > 0;
  const searchPattern = `%${normalizedQuery}%`;
  const pageArgs: Array<string | number> = [storeId];

  let whereSql = "where p.store_id = ?";

  if (hasExactProductId) {
    whereSql += " and p.id = ?";
    pageArgs.push(exactProductId);
  }

  if (hasCategoryFilter) {
    whereSql += " and p.category_id = ?";
    pageArgs.push(categoryId!.trim());
  }

  if (hasSearch) {
    whereSql +=
      " and (lower(p.name) like ? or lower(p.sku) like ? or lower(coalesce(p.barcode, '')) like ?)";
    pageArgs.push(searchPattern, searchPattern, searchPattern);
  }

  pageArgs.push(limit, offset);

  try {
    if (hasExactProductId && includeUnitOptions) {
      const [productResult, conversionResult] = await Promise.all([
        perf.step(
          "db.productsWithBalances",
          () =>
            client.execute({
              sql: `
                select
                  p.id as product_id,
                  p.sku as sku,
                  p.barcode as barcode,
                  p.name as name,
                  p.active as active,
                  p.base_unit_id as base_unit_id,
                  bu.code as base_unit_code,
                  bu.name_th as base_unit_name_th,
                  p.out_stock_threshold as out_stock_threshold,
                  p.low_stock_threshold as low_stock_threshold,
                  coalesce(ib.on_hand_base, 0) as on_hand,
                  coalesce(ib.reserved_base, 0) as reserved
                from products p
                inner join units bu on p.base_unit_id = bu.id
                left join inventory_balances ib
                  on ib.store_id = ?
                 and ib.product_id = p.id
                ${whereSql}
                order by p.name asc
                limit 1
              `,
              args: [storeId, ...pageArgs.slice(0, -2)],
            }),
          { kind: "db" },
        ),
        perf.step(
          "db.conversions",
          () =>
            client.execute({
              sql: `
                select
                  pu.product_id as product_id,
                  u.id as unit_id,
                  u.code as unit_code,
                  u.name_th as unit_name_th,
                  pu.multiplier_to_base as multiplier_to_base
                from product_units pu
                inner join units u on pu.unit_id = u.id
                where pu.product_id = ?
                order by pu.multiplier_to_base asc, u.code asc
              `,
              args: [exactProductId],
            }),
          { kind: "db" },
        ),
      ]);

      const productRows = await perf.step(
        "logic.mapProducts",
        () =>
          productResult.rows.map((row) => ({
            productId: String(row.product_id),
            sku: String(row.sku),
            barcode: row.barcode ? String(row.barcode) : null,
            name: String(row.name),
            active: Number(row.active ?? 0) === 1,
            baseUnitId: String(row.base_unit_id),
            baseUnitCode: String(row.base_unit_code),
            baseUnitNameTh: String(row.base_unit_name_th),
            outStockThreshold:
              row.out_stock_threshold === null || row.out_stock_threshold === undefined
                ? null
                : Number(row.out_stock_threshold),
            lowStockThreshold:
              row.low_stock_threshold === null || row.low_stock_threshold === undefined
                ? null
                : Number(row.low_stock_threshold),
            onHand: Number(row.on_hand ?? 0),
            reserved: Number(row.reserved ?? 0),
          })),
        { kind: "logic" },
      );

      if (productRows.length === 0) {
        return [];
      }

      const conversionMap = await perf.step(
        "logic.prepareConversions",
        () => {
          const nextConversionMap = new Map<string, StockUnitOption[]>();
          for (const row of conversionResult.rows) {
            const productId = String(row.product_id);
            const current = nextConversionMap.get(productId) ?? [];
            current.push({
              unitId: String(row.unit_id),
              unitCode: String(row.unit_code),
              unitNameTh: String(row.unit_name_th),
              multiplierToBase: Number(row.multiplier_to_base ?? 0),
            });
            nextConversionMap.set(productId, current);
          }
          return nextConversionMap;
        },
        { kind: "logic" },
      );

      return perf.step(
        "logic.assembleResponse",
        () =>
          productRows.map((product) => {
            const conversionOptions = conversionMap.get(product.productId) ?? [];
            const unitOptionMap = new Map<string, StockUnitOption>();
            unitOptionMap.set(product.baseUnitId, {
              unitId: product.baseUnitId,
              unitCode: product.baseUnitCode,
              unitNameTh: product.baseUnitNameTh,
              multiplierToBase: 1,
            });

            for (const option of conversionOptions) {
              if (!unitOptionMap.has(option.unitId)) {
                unitOptionMap.set(option.unitId, option);
              }
            }

            const unitOptions = [...unitOptionMap.values()].sort(
              (a, b) => a.multiplierToBase - b.multiplierToBase,
            );

            return {
              productId: product.productId,
              sku: product.sku,
              barcode: product.barcode ?? null,
              name: product.name,
              active: Boolean(product.active),
              baseUnitId: product.baseUnitId,
              baseUnitCode: product.baseUnitCode,
              baseUnitNameTh: product.baseUnitNameTh,
              onHand: product.onHand,
              reserved: product.reserved,
              available: product.onHand - product.reserved,
              outStockThreshold: product.outStockThreshold ?? null,
              lowStockThreshold: product.lowStockThreshold ?? null,
              unitOptions,
            };
          }),
        { kind: "logic" },
      );
    }

    const productResult = await perf.step(
      includeUnitOptions ? "db.productsWithBalances" : "db.productsWithBalances",
      () =>
        client.execute({
          sql: `
            with page_products as (
              select
                p.id as product_id,
                p.sku as sku,
                p.barcode as barcode,
                p.name as name,
                p.active as active,
                p.base_unit_id as base_unit_id,
                bu.code as base_unit_code,
                bu.name_th as base_unit_name_th,
                p.out_stock_threshold as out_stock_threshold,
                p.low_stock_threshold as low_stock_threshold
              from products p
              inner join units bu on p.base_unit_id = bu.id
	              ${whereSql}
	              order by p.name asc
	              limit ? offset ?
	            )
	            select
	              pp.product_id,
              pp.sku,
              pp.barcode,
              pp.name,
              pp.active,
              pp.base_unit_id,
              pp.base_unit_code,
              pp.base_unit_name_th,
              pp.out_stock_threshold,
              pp.low_stock_threshold,
              coalesce(ib.on_hand_base, 0) as on_hand,
              coalesce(ib.reserved_base, 0) as reserved
            from page_products pp
            left join inventory_balances ib
              on ib.store_id = ?
             and ib.product_id = pp.product_id
            order by pp.name asc
          `,
          args: [...pageArgs, storeId],
        }),
      { kind: "db" },
    );

    const productRows = await perf.step(
      "logic.mapProducts",
      () =>
        productResult.rows.map((row) => ({
          productId: String(row.product_id),
          sku: String(row.sku),
          barcode: row.barcode ? String(row.barcode) : null,
          name: String(row.name),
          active: Number(row.active ?? 0) === 1,
          baseUnitId: String(row.base_unit_id),
          baseUnitCode: String(row.base_unit_code),
          baseUnitNameTh: String(row.base_unit_name_th),
          outStockThreshold:
            row.out_stock_threshold === null || row.out_stock_threshold === undefined
              ? null
              : Number(row.out_stock_threshold),
          lowStockThreshold:
            row.low_stock_threshold === null || row.low_stock_threshold === undefined
              ? null
              : Number(row.low_stock_threshold),
          onHand: Number(row.on_hand ?? 0),
          reserved: Number(row.reserved ?? 0),
        })),
      { kind: "logic" },
    );

    const productIds = productRows.map((row) => row.productId);
    if (productIds.length === 0) return [];

    let conversionMap = new Map<string, StockUnitOption[]>();

    if (includeUnitOptions) {
      const placeholders = productIds.map(() => "?").join(", ");
      const conversionResult = await perf.step(
        "db.conversions",
        () =>
          client.execute({
            sql: `
              select
                pu.product_id as product_id,
                u.id as unit_id,
                u.code as unit_code,
                u.name_th as unit_name_th,
                pu.multiplier_to_base as multiplier_to_base
              from product_units pu
              inner join units u on pu.unit_id = u.id
              where pu.product_id in (${placeholders})
              order by pu.product_id asc, pu.multiplier_to_base asc, u.code asc
            `,
            args: productIds,
          }),
        { kind: "db" },
      );

      conversionMap = await perf.step(
        "logic.prepareConversions",
        () => {
          const nextConversionMap = new Map<string, StockUnitOption[]>();
          for (const row of conversionResult.rows) {
            const productId = String(row.product_id);
            const current = nextConversionMap.get(productId) ?? [];
            current.push({
              unitId: String(row.unit_id),
              unitCode: String(row.unit_code),
              unitNameTh: String(row.unit_name_th),
              multiplierToBase: Number(row.multiplier_to_base ?? 0),
            });
            nextConversionMap.set(productId, current);
          }
          return nextConversionMap;
        },
        { kind: "logic" },
      );
    }

    return perf.step(
      "logic.assembleResponse",
      () =>
        productRows.map((product) => {
          const conversionOptions = conversionMap.get(product.productId) ?? [];

          const unitOptionMap = new Map<string, StockUnitOption>();
          unitOptionMap.set(product.baseUnitId, {
            unitId: product.baseUnitId,
            unitCode: product.baseUnitCode,
            unitNameTh: product.baseUnitNameTh,
            multiplierToBase: 1,
          });

          if (includeUnitOptions) {
            for (const option of conversionOptions) {
              if (!unitOptionMap.has(option.unitId)) {
                unitOptionMap.set(option.unitId, option);
              }
            }
          }

          const unitOptions = [...unitOptionMap.values()].sort(
            (a, b) => a.multiplierToBase - b.multiplierToBase,
          );

          return {
            productId: product.productId,
            sku: product.sku,
            barcode: product.barcode ?? null,
            name: product.name,
            active: Boolean(product.active),
            baseUnitId: product.baseUnitId,
            baseUnitCode: product.baseUnitCode,
            baseUnitNameTh: product.baseUnitNameTh,
            onHand: product.onHand,
            reserved: product.reserved,
            available: product.onHand - product.reserved,
            outStockThreshold: product.outStockThreshold ?? null,
            lowStockThreshold: product.lowStockThreshold ?? null,
            unitOptions,
          };
        }),
      { kind: "logic" },
    );
  } finally {
    perf.end();
  }
}

export async function getRecentInventoryMovements(
  storeId: string,
  limit = 20,
): Promise<InventoryMovementView[]> {
  const rows = await db
    .select({
      id: inventoryMovements.id,
      productId: products.id,
      productSku: products.sku,
      productBarcode: products.barcode,
      productName: products.name,
      type: inventoryMovements.type,
      qtyBase: inventoryMovements.qtyBase,
      note: inventoryMovements.note,
      createdAt: inventoryMovements.createdAt,
      createdByName: users.name,
    })
    .from(inventoryMovements)
    .innerJoin(products, eq(inventoryMovements.productId, products.id))
    .leftJoin(users, eq(inventoryMovements.createdBy, users.id))
    .where(eq(inventoryMovements.storeId, storeId))
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    productSku: row.productSku,
    productBarcode: row.productBarcode ?? null,
    productName: row.productName,
    type: row.type,
    qtyBase: row.qtyBase,
    note: row.note,
    createdAt: row.createdAt,
    createdByName: row.createdByName,
  }));
}

export async function getInventoryMovementsPage(
  storeId: string,
  params: {
    page: number;
    pageSize: number;
    filters?: InventoryMovementFilters;
  },
): Promise<InventoryMovementPage> {
  const toDayStartIso = (dateOnly: string) => `${dateOnly}T00:00:00.000Z`;
  const toNextDayStartIso = (dateOnly: string) => {
    const [year, month, day] = dateOnly.split("-").map((part) => Number.parseInt(part, 10));
    if (!year || !month || !day) {
      return toDayStartIso(dateOnly);
    }
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
    const yyyy = String(nextDay.getUTCFullYear());
    const mm = String(nextDay.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(nextDay.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
  };
  const perf = createPerfScope("stock.query.movementsPage");

  const page = Math.max(1, Math.floor(params.page));
  const pageSize = Math.min(200, Math.max(1, Math.floor(params.pageSize)));
  const offset = (page - 1) * pageSize;
  const filters = params.filters;
  const whereConditions = [eq(inventoryMovements.storeId, storeId)];

  if (filters?.type) {
    whereConditions.push(eq(inventoryMovements.type, filters.type));
  }

  if (filters?.productId) {
    whereConditions.push(eq(inventoryMovements.productId, filters.productId));
  }

  const query = filters?.query?.trim();
  const productQueryCondition = query
    ? sql`(${products.sku} like ${`%${query}%`} or ${products.name} like ${`%${query}%`} or ${products.barcode} like ${`%${query}%`})`
    : undefined;

  if (filters?.dateFrom) {
    whereConditions.push(sql`${inventoryMovements.createdAt} >= ${toDayStartIso(filters.dateFrom)}`);
  }

  if (filters?.dateTo) {
    whereConditions.push(
      sql`${inventoryMovements.createdAt} < ${toNextDayStartIso(filters.dateTo)}`,
    );
  }

  const movementWhereClause = and(...whereConditions);
  const joinedWhereClause = productQueryCondition
    ? and(...whereConditions, productQueryCondition)
    : movementWhereClause;

  try {
    const [rows, totalRows] = await Promise.all([
      perf.step(
        "db.rows",
        () =>
          db
            .select({
              id: inventoryMovements.id,
              productId: products.id,
              productSku: products.sku,
              productBarcode: products.barcode,
              productName: products.name,
              type: inventoryMovements.type,
              qtyBase: inventoryMovements.qtyBase,
              note: inventoryMovements.note,
              createdAt: inventoryMovements.createdAt,
              createdByName: users.name,
            })
            .from(inventoryMovements)
            .innerJoin(products, eq(inventoryMovements.productId, products.id))
            .leftJoin(users, eq(inventoryMovements.createdBy, users.id))
            .where(joinedWhereClause!)
            .orderBy(desc(inventoryMovements.createdAt), desc(inventoryMovements.id))
            .limit(pageSize)
            .offset(offset),
        { kind: "db" },
      ),
      perf.step(
        "db.count",
        () =>
          query
            ? db
                .select({
                  total: sql<number>`count(*)`,
                })
                .from(inventoryMovements)
                .innerJoin(products, eq(inventoryMovements.productId, products.id))
                .where(joinedWhereClause!)
            : db
                .select({
                  total: sql<number>`count(*)`,
                })
                .from(inventoryMovements)
                .where(movementWhereClause!),
        { kind: "db" },
      ),
    ]);

    const movements = await perf.step(
      "logic.mapRows",
      () =>
        rows.map((row) => ({
          id: row.id,
          productId: row.productId,
          productSku: row.productSku,
          productBarcode: row.productBarcode ?? null,
          productName: row.productName,
          type: row.type,
          qtyBase: row.qtyBase,
          note: row.note,
          createdAt: row.createdAt,
          createdByName: row.createdByName,
        })),
      { kind: "logic" },
    );

    return {
      movements,
      total: Number(totalRows[0]?.total ?? 0),
    };
  } finally {
    perf.end();
  }
}

export async function getLowStockProducts(
  storeId: string,
  thresholds?: StoreStockThresholds,
): Promise<LowStockItem[]> {
  const productsWithBalance = await getStockProductsForStore(storeId);
  const storeThresholds = thresholds ?? (await getStoreStockThresholds(storeId));
  const storeOutThreshold = storeThresholds.outStockThreshold ?? 0;
  const storeLowThreshold = Math.max(
    storeThresholds.lowStockThreshold ?? 10,
    storeOutThreshold,
  );

  return productsWithBalance
    .filter((product) => {
      if (!product.active) {
        return false;
      }

      const outThreshold = product.outStockThreshold ?? storeOutThreshold;
      const lowThreshold = Math.max(
        product.lowStockThreshold ?? storeLowThreshold,
        outThreshold,
      );

      return product.available <= lowThreshold;
    })
    .sort((a, b) => a.available - b.available)
    .map((product) => ({
      productId: product.productId,
      sku: product.sku,
      name: product.name,
      available: product.available,
      baseUnitCode: product.baseUnitCode,
    }));
}
