import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { inventoryBalances } from "@/lib/db/schema";

type InventoryBalanceTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type InventoryBalanceExecutor = typeof db | InventoryBalanceTx;

export type InventoryBalanceSnapshot = {
  storeId: string;
  productId: string;
  onHand: number;
  reserved: number;
  available: number;
};

export type InventoryBalanceMovement = {
  storeId: string;
  productId: string;
  type: "IN" | "OUT" | "RESERVE" | "RELEASE" | "ADJUST" | "RETURN";
  qtyBase: number;
};

type InventoryBalanceDelta = {
  storeId: string;
  productId: string;
  onHandDelta: number;
  reservedDelta: number;
};

function movementToDelta(
  movement: InventoryBalanceMovement,
): InventoryBalanceDelta | null {
  switch (movement.type) {
    case "IN":
    case "RETURN":
    case "ADJUST":
      return {
        storeId: movement.storeId,
        productId: movement.productId,
        onHandDelta: movement.qtyBase,
        reservedDelta: 0,
      };
    case "OUT":
      return {
        storeId: movement.storeId,
        productId: movement.productId,
        onHandDelta: -movement.qtyBase,
        reservedDelta: 0,
      };
    case "RESERVE":
      return {
        storeId: movement.storeId,
        productId: movement.productId,
        onHandDelta: 0,
        reservedDelta: movement.qtyBase,
      };
    case "RELEASE":
      return {
        storeId: movement.storeId,
        productId: movement.productId,
        onHandDelta: 0,
        reservedDelta: -movement.qtyBase,
      };
    default:
      return null;
  }
}

function aggregateMovementDeltas(movements: InventoryBalanceMovement[]) {
  const aggregated = new Map<string, InventoryBalanceDelta>();

  for (const movement of movements) {
    const delta = movementToDelta(movement);
    if (!delta) continue;

    const key = `${delta.storeId}:${delta.productId}`;
    const current = aggregated.get(key);

    if (current) {
      current.onHandDelta += delta.onHandDelta;
      current.reservedDelta += delta.reservedDelta;
      continue;
    }

    aggregated.set(key, delta);
  }

  return [...aggregated.values()].filter(
    (delta) => delta.onHandDelta !== 0 || delta.reservedDelta !== 0,
  );
}

export async function applyInventoryBalanceMovements(
  movements: InventoryBalanceMovement[],
  tx?: InventoryBalanceTx,
) {
  const deltas = aggregateMovementDeltas(movements);
  if (deltas.length === 0) return;

  const executor: InventoryBalanceExecutor = tx ?? db;

  for (const delta of deltas) {
    const availableDelta = delta.onHandDelta - delta.reservedDelta;

    await executor
      .insert(inventoryBalances)
      .values({
        storeId: delta.storeId,
        productId: delta.productId,
        onHandBase: delta.onHandDelta,
        reservedBase: delta.reservedDelta,
        availableBase: availableDelta,
        updatedAt: sql`(CURRENT_TIMESTAMP)`,
      })
      .onConflictDoUpdate({
        target: [inventoryBalances.storeId, inventoryBalances.productId],
        set: {
          onHandBase: sql`${inventoryBalances.onHandBase} + ${delta.onHandDelta}`,
          reservedBase: sql`${inventoryBalances.reservedBase} + ${delta.reservedDelta}`,
          availableBase: sql`${inventoryBalances.availableBase} + ${availableDelta}`,
          updatedAt: sql`(CURRENT_TIMESTAMP)`,
        },
      });
  }
}

export async function listInventoryBalancesByStore(
  storeId: string,
): Promise<InventoryBalanceSnapshot[]> {
  const rows = await db
    .select({
      storeId: inventoryBalances.storeId,
      productId: inventoryBalances.productId,
      onHand: inventoryBalances.onHandBase,
      reserved: inventoryBalances.reservedBase,
      available: inventoryBalances.availableBase,
    })
    .from(inventoryBalances)
    .where(eq(inventoryBalances.storeId, storeId));

  return rows.map((row) => ({
    storeId: row.storeId,
    productId: row.productId,
    onHand: Number(row.onHand ?? 0),
    reserved: Number(row.reserved ?? 0),
    available: Number(row.available ?? 0),
  }));
}

export async function listInventoryBalancesByStoreForProducts(
  storeId: string,
  productIds: string[],
): Promise<InventoryBalanceSnapshot[]> {
  if (productIds.length === 0) return [];

  const rows = await db
    .select({
      storeId: inventoryBalances.storeId,
      productId: inventoryBalances.productId,
      onHand: inventoryBalances.onHandBase,
      reserved: inventoryBalances.reservedBase,
      available: inventoryBalances.availableBase,
    })
    .from(inventoryBalances)
    .where(
      and(
        eq(inventoryBalances.storeId, storeId),
        inArray(inventoryBalances.productId, productIds),
      ),
    );

  return rows.map((row) => ({
    storeId: row.storeId,
    productId: row.productId,
    onHand: Number(row.onHand ?? 0),
    reserved: Number(row.reserved ?? 0),
    available: Number(row.available ?? 0),
  }));
}

export async function getInventoryBalanceSnapshot(
  storeId: string,
  productId: string,
  tx?: InventoryBalanceTx,
): Promise<InventoryBalanceSnapshot> {
  const executor: InventoryBalanceExecutor = tx ?? db;
  const [row] = await executor
    .select({
      storeId: inventoryBalances.storeId,
      productId: inventoryBalances.productId,
      onHand: inventoryBalances.onHandBase,
      reserved: inventoryBalances.reservedBase,
      available: inventoryBalances.availableBase,
    })
    .from(inventoryBalances)
    .where(
      and(
        eq(inventoryBalances.storeId, storeId),
        eq(inventoryBalances.productId, productId),
      ),
    )
    .limit(1);

  return {
    storeId,
    productId,
    onHand: Number(row?.onHand ?? 0),
    reserved: Number(row?.reserved ?? 0),
    available: Number(row?.available ?? 0),
  };
}
