import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const categories = [
  { slug: "poncho", nameFa: "پانچو" },
  { slug: "bathrobe", nameFa: "حوله تن‌پوش" },
  { slug: "body", nameFa: "حوله بدن و استخری" },
  { slug: "hand", nameFa: "حوله دستی" },
  { slug: "beach-mat", nameFa: "زیرانداز ساحلی" },
  { slug: "kitchen", nameFa: "حوله آشپزخانه" },
];

const products = [
  {
    slug: "poncho-sport-b2",
    nameFa: "حوله پانچو نخی اسپورت کلاه‌دار موآی B2",
    price: 3200000,
    salePrice: 3100000,
    image: "/images/surf.jpg",
    category: "poncho",
    featured: true,
    stock: 12,
    description:
      "پانچوی اسپورت کلاه‌دار موآی از نخ پنبه‌ی صددرصد طبیعی؛ سبک، جاذب و خوش‌فرم. بعد از شنا یا ورزش فقط بپوشش و برو — گرم می‌مونی و شیک.",
  },
  {
    slug: "bathrobe-poncho",
    nameFa: "حوله تن‌پوش نخی و رومایویی کلاه‌دار موآی",
    price: 2800000,
    salePrice: 2400000,
    image: "/images/boho.jpg",
    category: "bathrobe",
    featured: true,
    stock: 8,
    description:
      "تن‌پوشی که هم حوله است و هم رومایویی؛ از اولین طرح‌های ایران. با دوخت دست و پارچه‌ی نخی لطیف، برای صبح‌های آرام و عصرهای کنار آب.",
  },
  {
    slug: "pinterest-towel",
    nameFa: "حوله پینترستی نخی موآی",
    price: 2200000,
    salePrice: 1900000,
    image: "/images/stripes.jpg",
    category: "body",
    featured: true,
    stock: 15,
    description:
      "همان حوله‌ای که در پینترست دیده‌ای و پیدا نمی‌کردی؛ راه‌راه، خوش‌رنگ و از الیاف طبیعی. برای عکس‌هایی که خودشان لایک می‌گیرند.",
  },
  {
    slug: "beach-travel-mat",
    nameFa: "زیرانداز مسافرتی ساحلی موآی",
    price: 3500000,
    salePrice: 2900000,
    image: "/images/palms.jpg",
    category: "beach-mat",
    featured: true,
    stock: 10,
    description:
      "زیرانداز ساحلی و مسافرتی موآی؛ بزرگ، سبک و جمع‌وجورشونده. ماسه به آن نمی‌چسبد و بعد از هر سفر با یک شست‌وشو مثل روز اول می‌شود.",
  },
  {
    slug: "body-pool-towel",
    nameFa: "حوله بدن استخری نخی موآی",
    price: 1900000,
    salePrice: 1700000,
    image: "/images/pool.jpg",
    category: "body",
    featured: true,
    stock: 20,
    description:
      "حوله‌ی بدن و استخر با جذب بالا و خشک‌شدن سریع؛ همراه همیشگی باشگاه، استخر و سفر. نرم روی پوست، سبک توی ساک.",
  },
  {
    slug: "kids-poncho",
    nameFa: "حوله تن‌پوش پانچو بچه‌گانه موآی",
    price: 1500000,
    salePrice: 1100000,
    image: "/images/kids.jpg",
    category: "poncho",
    featured: false,
    stock: 14,
    description:
      "پانچوی کلاه‌دار بچه‌گانه؛ نرم، گرم و بامزه. بعد از دریا و استخر، کوچولوها را مثل یک ابر می‌پیچد.",
  },
  {
    slug: "kids-pool-towel",
    nameFa: "حوله استخری کودک و نوجوان نخی موآی",
    price: 2000000,
    salePrice: 1300000,
    image: "/images/kid.jpg",
    category: "body",
    featured: false,
    stock: 18,
    description:
      "حوله‌ی استخری مخصوص کودک و نوجوان از نخ پنبه‌ی طبیعی؛ مقاوم به شست‌وشوی زیاد و مهربان با پوست حساس.",
  },
  {
    slug: "hand-face-towel",
    nameFa: "حوله دست و صورت نخی موآی",
    price: 800000,
    salePrice: 650000,
    image: "/images/bath.jpg",
    category: "hand",
    featured: false,
    stock: 30,
    description:
      "حوله‌ی دست و صورت با بافت لطیف پنبه‌ای؛ جذب فوق‌العاده و ماندگاری رنگ، برای هر روزِ خانه.",
  },
  {
    slug: "hand-towel",
    nameFa: "حوله نخی دستی موآی",
    price: 400000,
    salePrice: 350000,
    image: "/images/spa.jpg",
    category: "hand",
    featured: false,
    stock: 40,
    description:
      "حوله‌ی دستی کوچک و کاربردی؛ برای کیف ورزشی، آشپزخانه یا سفر. نخی، بادوام و خوش‌دست.",
  },
  {
    slug: "kitchen-towel-set",
    nameFa: "ست حوله آشپزخانه نخی موآی",
    price: 600000,
    salePrice: null,
    image: "/images/hangers.jpg",
    category: "kitchen",
    featured: false,
    stock: 25,
    description:
      "ست حوله‌ی آشپزخانه از پنبه‌ی طبیعی؛ جاذب، بهداشتی و خوش‌رنگ — مکمل آشپزخانه‌های مرتب.",
  },
];

async function main() {
  console.log("Seeding…");

  for (const c of categories) {
    await db.category.upsert({ where: { slug: c.slug }, update: { nameFa: c.nameFa }, create: c });
  }
  const cats = Object.fromEntries((await db.category.findMany()).map((c) => [c.slug, c.id]));

  for (const p of products) {
    const { category, ...data } = p;
    await db.product.upsert({
      where: { slug: p.slug },
      update: { ...data, categoryId: cats[category] },
      create: { ...data, categoryId: cats[category] },
    });
  }

  // Admin - logs in with the shop's own phone number via OTP
  const admin = await db.user.upsert({
    where: { phone: "09121230000" },
    update: { role: "ADMIN" },
    create: { phone: "09121230000", name: "مدیر موآی", role: "ADMIN", points: 0 },
  });

  // Sample customers + orders so the admin panel has something to show
  const demo1 = await db.user.upsert({
    where: { phone: "09120000001" },
    update: {},
    create: { phone: "09120000001", name: "سارا محمدی", points: 640 },
  });
  const demo2 = await db.user.upsert({
    where: { phone: "09120000002" },
    update: {},
    create: { phone: "09120000002", name: "نگین کریمی", points: 180 },
  });

  if ((await db.order.count()) === 0) {
    const bySlug = Object.fromEntries((await db.product.findMany()).map((p) => [p.slug, p]));
    const mk = (user, status, daysAgo, lines) => {
      const items = lines.map(([slug, qty]) => ({
        productId: bySlug[slug].id,
        nameFa: bySlug[slug].nameFa,
        qty,
        unitPrice: bySlug[slug].salePrice ?? bySlug[slug].price,
      }));
      return db.order.create({
        data: {
          userId: user.id,
          status,
          total: items.reduce((s, i) => s + i.qty * i.unitPrice, 0),
          fullName: user.name ?? "",
          phone: user.phone,
          city: "تهران",
          address: "خیابان نمونه، پلاک ۱۲",
          createdAt: new Date(Date.now() - daysAgo * 864e5),
          items: { create: items },
        },
      });
    };
    await mk(demo1, "DELIVERED", 21, [["beach-travel-mat", 1], ["hand-face-towel", 2]]);
    await mk(demo1, "SHIPPED", 4, [["pinterest-towel", 1]]);
    await mk(demo2, "AWAITING_PAYMENT", 1, [["kids-poncho", 1], ["hand-towel", 1]]);
  }

  console.log("Done. Admin:", admin.phone);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
