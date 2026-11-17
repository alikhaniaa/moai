/**
 * Make تیپاکس (Tipax, پس‌کرایه) the ONLY shipping method customers can pick.
 *
 *   node tools/shipping-tipax-only.mjs
 *
 * - Ensures exactly one active method: تیپاکس, cost 0 (freight collect - the
 *   customer pays the courier on delivery), no free-shipping threshold.
 * - Deactivates every other method (kept in the table so past orders that
 *   reference them stay intact - nothing is deleted).
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const DESC = "ارسال به سراسر ایران؛ هزینه هنگام تحویل توسط مشتری پرداخت می‌شود.";
const DAYS = "۲ تا ۴ روز کاری";

try {
  const methods = await db.shippingMethod.findMany();
  // There can be several Tipax rows (a duplicate crept in). Keep exactly one - 
  // prefer the one that already carries a description/estimate so we lose no data.
  const tipaxes = methods.filter((m) => m.nameFa.includes("تیپاکس"));
  tipaxes.sort((a, b) => (b.description?.length || 0) - (a.description?.length || 0));
  let tipax = tipaxes[0];

  if (!tipax) {
    tipax = await db.shippingMethod.create({
      data: { nameFa: "تیپاکس", cost: 0, freeFrom: 0, estimatedDays: DAYS, description: DESC, active: true, sort: 0 },
    });
    console.log("＋ created Tipax method");
  } else {
    await db.shippingMethod.update({
      where: { id: tipax.id },
      data: {
        nameFa: "تیپاکس",
        cost: 0,
        freeFrom: 0,
        active: true,
        sort: 0,
        estimatedDays: tipax.estimatedDays || DAYS,
        description: tipax.description || DESC,
      },
    });
    console.log(`✓ kept 1 Tipax (of ${tipaxes.length}), set name «تیپاکس», cost 0, پس‌کرایه`);
  }

  const off = await db.shippingMethod.updateMany({
    where: { id: { not: tipax.id } },
    data: { active: false },
  });
  console.log(`✓ deactivated ${off.count} other method(s)`);

  const active = await db.shippingMethod.findMany({ where: { active: true } });
  console.log(
    "\nActive methods now:",
    active.map((m) => `${m.nameFa} (${m.cost === 0 ? "پس‌کرایه" : m.cost})`).join(", ")
  );
} finally {
  await db.$disconnect();
}
