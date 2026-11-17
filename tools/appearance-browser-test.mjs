// Run against an isolated copy of the database and a local production server.
// DATABASE_URL must point to tmp/appearance-review.db. Never sends SMS or gateway requests.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import puppeteer from "puppeteer-core";

assert.ok((process.env.DATABASE_URL ?? "").replaceAll("\\", "/").endsWith("/tmp/appearance-review.db"), "Use only the isolated review database");
const BASE = "http://localhost:3010";
const db = new PrismaClient();
let browser;
try {
  await db.setting.deleteMany({ where: { key: { in: ["appearanceMain", "appearanceAccent", "appearanceBackground", "eventEnabled", "eventPreset", "eventText", "eventDecorations"] } } });
  await db.setting.upsert({ where: { key: "announcement" }, create: { key: "announcement", value: "اعلان اصلی آزمایشی" }, update: { value: "اعلان اصلی آزمایشی" } });
  await db.setting.upsert({ where: { key: "popupEnabled" }, create: { key: "popupEnabled", value: "0" }, update: { value: "0" } });
  const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
  assert.ok(admin, "Review database has an admin");
  browser = await puppeteer.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true, defaultViewport: { width: 1440, height: 1000 } });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluateOnNewDocument(() => sessionStorage.setItem("moai_intro_seen", "1"));
  await page.goto(`${BASE}/admin/appearance`, { waitUntil: "networkidle0" });
  assert.ok(page.url().includes("/login"));
  const payload = `${admin.id}.${Date.now() + 60 * 60 * 1000}`;
  const signature = createHmac("sha256", process.env.SESSION_SECRET ?? "moai-dev-secret").update(payload).digest("hex").slice(0, 32);
  await page.setCookie({ name: "moai_session", value: `${payload}.${signature}`, domain: "localhost", path: "/" });
  await page.goto(`${BASE}/admin/appearance`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#appearanceMain");
  console.log("PASS: appearance page requires admin authentication and loads with original colors");

  const setText = async (selector, value) => {
    await page.click(selector, { clickCount: 3 });
    await page.keyboard.press("Backspace");
    await page.type(selector, value);
  };
  await setText("#appearanceMain", "#326d9c");
  await setText("#appearanceAccent", "#416cbb");
  await setText("#appearanceBackground", "#f3f7fc");
  await page.select("#eventPreset", "halloween");
  await page.click('input[name="eventEnabled"]');
  await setText("#eventText", "هالووین مبارک؛ یک شب پر از رنگ و خیال");
  const unsaved = await db.setting.findUnique({ where: { key: "eventEnabled" } });
  assert.equal(unsaved, null);
  assert.ok(await page.$('[data-appearance-preview] [data-event-bar="halloween"] svg'));
  await mkdir(new URL("../tmp/appearance-screenshots/", import.meta.url), { recursive: true });
  await page.screenshot({ path: new URL("../tmp/appearance-screenshots/admin-desktop.png", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"), fullPage: true });
  await page.click("form > button");
  await page.waitForFunction(() => document.body.textContent.includes("✓ تغییرات ذخیره شد"));
  assert.equal((await db.setting.findUnique({ where: { key: "appearanceMain" } })).value, "#326d9c");
  assert.equal((await db.setting.findUnique({ where: { key: "eventEnabled" } })).value, "1");
  assert.equal((await db.setting.findUnique({ where: { key: "announcement" } })).value, "اعلان اصلی آزمایشی");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("main")).getPropertyValue("--color-sea-900").trim()), "#0f2c28");
  console.log("PASS: preview does not write settings; saving persists colors and event without changing the admin palette or normal announcement");

  for (const width of [320, 375, 1440]) {
    await page.setViewport({ width, height: 900 });
    const response = await page.goto(`${BASE}/products`, { waitUntil: "networkidle0" });
    assert.equal(response.status(), 200);
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      background: getComputedStyle(document.querySelector("[data-storefront]")).backgroundColor,
      main: getComputedStyle(document.querySelector("[data-storefront]")).getPropertyValue("--color-sea-500").trim(),
      eventHeight: document.querySelector("[data-event-bar]").getBoundingClientRect().height,
      headerBottom: document.querySelector("header").getBoundingClientRect().bottom,
      titleTop: document.querySelector("main h1").getBoundingClientRect().top,
    }));
    assert.equal(layout.overflow, false, `no overflow at ${width}`);
    assert.equal(layout.background, "rgb(243, 247, 252)");
    assert.equal(layout.eventHeight, 48);
    assert.ok(layout.headerBottom <= layout.titleTop, `header does not cover title at ${width}`);
    assert.ok(layout.main && layout.main !== "#4a8578");
    await page.screenshot({ path: new URL(`../tmp/appearance-screenshots/storefront-${width}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, "$1"), fullPage: width === 1440 });
    await page.evaluate(() => scrollTo(0, 500));
    await page.waitForFunction(() => document.querySelector("header > div").getBoundingClientRect().height < 1);
  }
  console.log("PASS: themed storefront at 320, 375, and 1440 pixels; no horizontal overflow or covered headings; bar collapses on scroll");

  await page.setViewport({ width: 375, height: 900 });
  await page.goto(`${BASE}/products`, { waitUntil: "networkidle0" });
  await page.click('button[aria-label="منو"]');
  await page.waitForFunction(() => document.querySelector('button[aria-label="منو"]').closest("header").nextElementSibling.className.includes("150%"));
  await page.click('div.lg\\:hidden button[aria-label="بستن"]');
  await page.click('button[aria-label="سبد خرید"]');
  await page.waitForFunction(() => document.querySelector("aside.fixed").getBoundingClientRect().left >= -1);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("aside.fixed")).backgroundColor), "rgb(243, 247, 252)");
  await page.click('aside.fixed button[aria-label="بستن"]');
  console.log("PASS: mobile navigation and cart drawer still open/close and inherit storefront colors");

  const product = await db.product.findFirst({ where: { active: true }, select: { slug: true } });
  for (const route of ["/", "/size-guide", "/contact", "/checkout", "/account", "/track", "/admin/orders", ...(product ? [`/products/${product.slug}`] : [])]) {
    const response = await page.goto(BASE + route, { waitUntil: "networkidle0" });
    assert.equal(response.status(), 200, route);
  }
  console.log("PASS: homepage, product, sizing, contact, checkout, account, tracking, and admin orders render without server errors");

  await page.goto(`${BASE}/admin/appearance`, { waitUntil: "networkidle0" });
  assert.equal(await page.$eval("#eventPreset", (e) => e.value), "halloween");
  for (const id of ["nowruz", "chaharshanbe", "sizdah", "yalda", "mehregan", "tirgan", "sepandarmazgan", "autumn", "winter", "christmas", "newyear", "valentine", "womensday", "earthday", "blackfriday"]) {
    await page.select("#eventPreset", id);
    assert.ok(await page.$(`[data-event-bar="${id}"] svg`));
  }
  await page.select("#eventPreset", "custom");
  assert.equal(await page.$eval("form > button", (e) => e.disabled), true);
  await setText("#eventText", "مناسبت دلخواه ما");
  await page.click('input[name="eventDecorations"]');
  assert.equal(await page.$("[data-event-bar] svg"), null);
  await page.click("form > button");
  await page.waitForFunction(() => document.body.textContent.includes("✓ تغییرات ذخیره شد"));
  await page.goto(`${BASE}/products`, { waitUntil: "networkidle0" });
  assert.equal(await page.$eval("[data-event-bar] p", (e) => e.textContent), "مناسبت دلخواه ما");
  assert.equal(await page.$("[data-event-bar] svg"), null);
  console.log("PASS: event presets, custom event text, and decoration off switch work");

  await page.goto(`${BASE}/admin/appearance`, { waitUntil: "networkidle0" });
  await page.evaluate(() => [...document.querySelectorAll("button")].find((e) => e.textContent.includes("بازگرداندن رنگ‌های اصلی")).click());
  await page.click('input[name="eventEnabled"]');
  await page.screenshot({ path: new URL("../tmp/appearance-screenshots/admin-mobile.png", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.click("form > button");
  await page.waitForFunction(() => document.body.textContent.includes("✓ تغییرات ذخیره شد"));
  await page.goto(`${BASE}/products`, { waitUntil: "networkidle0" });
  assert.equal(await page.$("[data-event-bar]"), null);
  assert.ok(await page.evaluate(() => document.querySelector("header").textContent.includes("اعلان اصلی آزمایشی")));
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("[data-storefront]")).getPropertyValue("--color-sea-500").trim()), "#4a8578");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("[data-storefront]")).backgroundColor), "rgb(251, 247, 238)");
  assert.deepEqual(errors, []);
  console.log("PASS: mobile admin layout, saved reset, restored normal announcement, exact original colors, and no browser runtime errors");
} finally {
  await browser?.close();
  await db.$disconnect();
}
