import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

// customer-requested content values
const SETTINGS = {
  shopAddress: "تهران",
  shippingCost: "0",
  freeShippingFrom: "15000000",
  shippingNote:
    "ارسال سفارش‌ها از طریق تیپاکس و با هزینه‌ی مشتری انجام می‌شود. برای مشتریان تهران امکان ارسال با پیک هم هست (هزینه بر عهده‌ی مشتری).",
  announcement: "ارسال به سراسر ایران با تیپاکس ✦ کالکشن نسخه‌ی محدود",
};

// shipping methods she actually uses (customer pays the courier)
const METHODS = [
  {
    nameFa: "تیپاکس (پس‌کرایه)",
    description: "ارسال به سراسر ایران؛ هزینه هنگام تحویل توسط مشتری پرداخت می‌شود.",
    cost: 0,
    freeFrom: 0,
    estimatedDays: "۲ تا ۴ روز کاری",
    sort: 0,
  },
  {
    nameFa: "پیک موتوری (تهران)",
    description: "فقط داخل تهران؛ هزینه بر عهده‌ی مشتری است.",
    cost: 0,
    freeFrom: 0,
    estimatedDays: "همان روز یا روز بعد",
    sort: 1,
  },
];

async function main() {
  for (const [key, value] of Object.entries(SETTINGS)) {
    await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  console.log("settings updated:", Object.keys(SETTINGS).length);

  // retire old methods (deactivate if referenced by an order, else remove)
  const old = await db.shippingMethod.findMany({
    include: { _count: { select: { orders: true } } },
  });
  for (const m of old) {
    if (m._count.orders === 0) await db.shippingMethod.delete({ where: { id: m.id } });
    else await db.shippingMethod.update({ where: { id: m.id }, data: { active: false } });
  }
  for (const m of METHODS) await db.shippingMethod.create({ data: m });
  console.log("shipping methods reset to:", METHODS.map((m) => m.nameFa).join(" / "));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
