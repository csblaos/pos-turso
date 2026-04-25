import "server-only";

import { redisDelete, redisGetJson, redisSetJson } from "@/lib/cache/redis";
import { getStoreStockThresholds, type StoreStockThresholds } from "@/lib/inventory/queries";
import { listCategories, type CategoryItem } from "@/lib/products/service";

const STOCK_PAGE_METADATA_TTL_SECONDS = 60 * 5;

const stockCategoriesCacheKey = (storeId: string) => `stock:page:categories:${storeId}`;
const stockThresholdsCacheKey = (storeId: string) => `stock:page:thresholds:${storeId}`;

export async function getCachedStockCategories(storeId: string): Promise<CategoryItem[]> {
  const cached = await redisGetJson<CategoryItem[]>(stockCategoriesCacheKey(storeId));
  if (cached && Array.isArray(cached)) {
    return cached;
  }

  const categories = await listCategories(storeId);
  await redisSetJson(
    stockCategoriesCacheKey(storeId),
    categories,
    STOCK_PAGE_METADATA_TTL_SECONDS,
  );
  return categories;
}

export async function getCachedStockThresholds(
  storeId: string,
): Promise<StoreStockThresholds> {
  const cached = await redisGetJson<StoreStockThresholds>(stockThresholdsCacheKey(storeId));
  if (
    cached &&
    typeof cached.outStockThreshold === "number" &&
    typeof cached.lowStockThreshold === "number"
  ) {
    return cached;
  }

  const thresholds = await getStoreStockThresholds(storeId);
  await redisSetJson(
    stockThresholdsCacheKey(storeId),
    thresholds,
    STOCK_PAGE_METADATA_TTL_SECONDS,
  );
  return thresholds;
}

export async function invalidateStockPageMetadataCache(storeId: string) {
  await Promise.all([
    redisDelete(stockCategoriesCacheKey(storeId)),
    redisDelete(stockThresholdsCacheKey(storeId)),
  ]);
}
