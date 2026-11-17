import { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";

/** `db` itself, or the `tx` handed out inside `db.$transaction(async (tx) => …)`. */
type DbClient = PrismaClient | Prisma.TransactionClient;

/** Anything that identifies goods leaving or returning to the shelf. */
export type StockLine = { productId: string; sizeId?: string | null; qty: number };

/**
 * Prisma updates that move inventory by `qty * direction`.
 *
 * Stock lives on the size row once a product has sizes, but `Product.stock` is
 * kept as the sum of them - it is what the dashboard's «موجودی رو به اتمام»
 * list and the sizeless products both read. So every movement touches both,
 * always in the same transaction, or the two drift apart.
 *
 * Pass the ops straight into a `db.$transaction([...])` with the order update.
 */
export function stockOps(lines: StockLine[], direction: 1 | -1, client: DbClient = db) {
  const ops = [];
  for (const l of lines) {
    const delta = l.qty * direction;
    ops.push(
      client.product.update({
        where: { id: l.productId },
        data: delta < 0 ? { stock: { decrement: -delta } } : { stock: { increment: delta } },
      })
    );
    if (l.sizeId) {
      ops.push(
        client.productSize.update({
          where: { id: l.sizeId },
          data: delta < 0 ? { stock: { decrement: -delta } } : { stock: { increment: delta } },
        })
      );
    }
  }
  return ops;
}

/** Goods leaving the shelf. */
export const takeStock = (lines: StockLine[], client: DbClient = db) =>
  stockOps(lines, -1, client);

/** Goods coming back (a cancelled order). */
export const returnStock = (lines: StockLine[], client: DbClient = db) =>
  stockOps(lines, 1, client);

/**
 * Re-derive `Product.stock` from its size rows. Called after the admin edits a
 * product's sizes, which is the one place the two can legitimately disagree.
 */
export async function syncProductStock(productId: string) {
  const sizes = await db.productSize.findMany({ where: { productId } });
  if (sizes.length === 0) return;
  await db.product.update({
    where: { id: productId },
    data: { stock: sizes.reduce((s, r) => s + Math.max(0, r.stock), 0) },
  });
}
