import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const TIERS = [
  { key: "sadaf", nameFa: "صدف", emoji: "🐚", minPoints: 0, sort: 0,
    perks: "۱۰ امتیاز به ازای هر ۱۰۰ هزار تومان خرید\nخبر زودهنگام از کلکسیون‌های جدید\nهدیه کوچک تولد" },
  { key: "marjan", nameFa: "مرجان", emoji: "🪸", minPoints: 500, sort: 1,
    perks: "٪۵ تخفیف همیشگی\nارسال رایگان اولین سفارش هر فصل\nدسترسی زودتر به حراج‌ها" },
  { key: "morvarid", nameFa: "مروارید", emoji: "🫧", minPoints: 1500, sort: 2,
    perks: "٪۱۰ تخفیف همیشگی\nارسال رایگان همه سفارش‌ها\nپیش‌خرید محصولات محدود\nهدیه ویژه سالگرد عضویت" },
];

async function main() {
  for (const t of TIERS) {
    await db.clubTier.upsert({ where: { key: t.key }, update: {}, create: t });
  }
  const cfg = {
    clubWelcomePoints: "50",
    clubPointsPer100k: "10",
    statFollowers: "7591",
    statProducts: "124",
    statCustomers: "3000",
    statYears: "3",
  };
  for (const [key, value] of Object.entries(cfg)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  console.log(`club tiers: ${await db.clubTier.count()}, config seeded`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
