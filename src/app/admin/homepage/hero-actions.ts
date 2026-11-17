"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readFile } from "fs/promises";
import path from "path";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { HERO_DEFAULTS, HERO_TEXT_FIELDS, HERO_DESTINATIONS, validHeroText, validHeroImage, type HeroSaveState } from "@/lib/hero";

async function guard() {
  if (!(await requireAdmin())) redirect("/login?next=/admin/homepage");
}
async function save(values: Record<string, string>): Promise<HeroSaveState> {
  try {
    await db.$transaction(Object.entries(values).map(([key, value]) =>
      db.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
    ));
  } catch {
    return { error: "ذخیره انجام نشد. لطفاً دوباره تلاش کن." };
  }
  revalidatePath("/");
  revalidatePath("/admin/homepage");
  return { saved: true };
}
export async function saveHeroText(_previous: HeroSaveState, data: FormData): Promise<HeroSaveState> {
  await guard();
  const values: Record<string, string> = {};
  for (const field of HERO_TEXT_FIELDS) {
    const value = String(data.get(field.key) ?? "").trim();
    if (!validHeroText(value, field.max)) return { error: `${field.label}: متن ساده و کوتاه (حداکثر ${field.max.toLocaleString("fa-IR")} نویسه) وارد کن.` };
    values[field.key] = value;
  }
  const href = String(data.get("landingButtonHref") ?? "");
  if (!HERO_DESTINATIONS.some(d => d.href === href)) return { error: "مقصد دکمه را از فهرست انتخاب کن." };
  values.landingButtonHref = href;
  return save(values);
}
export async function saveHeroImage(_previous: HeroSaveState, data: FormData): Promise<HeroSaveState> {
  await guard();
  const image = String(data.get("landingImage") ?? "");
  if (!validHeroImage(image)) return { error: "تصویر را با دکمه آپلود انتخاب کن." };
  if (image !== HERO_DEFAULTS.landingImage) {
    try {
      const bytes = await readFile(path.join(process.cwd(), "public", "uploads", image.slice("/uploads/".length)));
      if (bytes.length > 8 * 1024 * 1024) throw new Error("size");
      const sharp = (await import("sharp")).default;
      const meta = await sharp(bytes, { limitInputPixels: 40000000 }).metadata();
      if (meta.format !== "webp" || !meta.width || !meta.height || meta.width < 1200 || meta.height < 600 || meta.width < meta.height) throw new Error("dimensions");
      // Decode as well as checking metadata, so a truncated upload cannot be saved.
      await sharp(bytes, { limitInputPixels: 40000000 }).resize(1, 1).toBuffer();
    } catch {
      return { error: "تصویر معتبر نیست یا اندازه مناسب ندارد. یک عکس افقی با عرض حداقل ۱۲۰۰ و ارتفاع حداقل ۶۰۰ پیکسل آپلود کن." };
    }
  }
  return save({ landingImage: image });
}
