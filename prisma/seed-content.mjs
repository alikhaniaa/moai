import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Mirrors SETTING_DEFS in src/lib/settings.ts
const SETTINGS = {
  shopPhone: "09121230000",
  shopWhatsapp: "989121230000",
  shopEmail: "info@example.com",
  shopAddress: "تهران",
  shopInstagram: "moai.gallery",
  shippingCost: "80000",
  freeShippingFrom: "3000000",
  shippingNote: "ارسال پنج روز کاری به سراسر ایران",
  announcement: "ارسال رایگان برای خریدهای بالای ۳ میلیون تومان",
  heroTitle: "تابستان را بپیچ دور خودت",
  heroSubtitle:
    "حوله و زیرانداز ساحلی دست‌دوز، از الیاف طبیعی نخ پنبه — برای روزهایی که دریا صدایت می‌کند.",
  aboutText:
    "موآی گالری جایی‌ست برای کسانی که به استایل، کیفیت و حس خوب سفر و آرامش اهمیت می‌دهند.",
};

const BANNERS = [
  {
    title: "کلکسیون ساحلی تابستان",
    subtitle: "زیرانداز و حوله‌هایی که با تو به دریا می‌آیند.",
    badge: "جدید",
    image: "/images/palms.jpg",
    link: "/products?cat=beach-mat",
    slot: "STRIP",
    sort: 0,
  },
  {
    title: "پانچوهای کلاه‌دار",
    subtitle: "بعد از شنا، فقط بپوش و برو.",
    image: "/images/surf.jpg",
    link: "/products?cat=poncho",
    slot: "STRIP",
    sort: 1,
  },
  {
    title: "برای کوچولوها",
    subtitle: "نرم، گرم و بامزه.",
    image: "/images/kids.jpg",
    link: "/products?cat=poncho",
    slot: "STRIP",
    sort: 2,
  },
];

async function main() {
  for (const [key, value] of Object.entries(SETTINGS)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  console.log(`settings: ${Object.keys(SETTINGS).length}`);

  if ((await db.banner.count()) === 0) {
    for (const b of BANNERS) await db.banner.create({ data: b });
    console.log(`banners: ${BANNERS.length}`);
  } else {
    console.log("banners already present — skipped");
  }

  // make every existing product visible in the shop
  await db.product.updateMany({ data: { active: true } });
  console.log("products set active");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
