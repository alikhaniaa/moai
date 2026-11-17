"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { EVENT_PRESETS, luminance, validHex } from "@/lib/appearance";

export type AppearanceSaveState = { error?: string; saved?: boolean };

export async function saveAppearance(_previous: AppearanceSaveState, formData: FormData): Promise<AppearanceSaveState> {
  if (!(await requireAdmin())) redirect("/login?next=/admin/appearance");
  const value = (key: string) => String(formData.get(key) ?? "").trim();
  const colors = ["appearanceMain", "appearanceAccent", "appearanceBackground"];
  if (colors.some((key) => !validHex(value(key)))) return { error: "لطفاً رنگ‌ها را با انتخابگر رنگ یا کد شش‌رقمی مثل ‎#326d9c وارد کنید." };
  if (luminance(value("appearanceBackground")) < 0.7) return { error: "لطفاً یک رنگ روشن برای پس‌زمینه انتخاب کنید تا نوشته‌ها خوانا بمانند." };
  const eventPreset = value("eventPreset");
  if (!EVENT_PRESETS.some((event) => event.id === eventPreset)) return { error: "مناسبت انتخاب‌شده معتبر نیست." };
  const eventText = value("eventText");
  if (eventText.length > 160) return { error: "متن نوار مناسبت باید حداکثر ۱۶۰ نویسه باشد." };
  const enabled = value("eventEnabled") === "1";
  if (enabled && eventPreset === "custom" && !eventText) return { error: "برای مناسبت دلخواه، متن نوار را بنویسید." };
  const settings: Record<string, string> = {
    ...Object.fromEntries(colors.map((key) => [key, value(key).toLowerCase()])),
    eventPreset, eventText,
    eventEnabled: enabled ? "1" : "0",
    eventDecorations: value("eventDecorations") === "1" ? "1" : "0",
  };
  try {
    await db.$transaction(Object.entries(settings).map(([key, value]) =>
      db.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
    ));
  } catch {
    return { error: "ذخیره تغییرات انجام نشد. لطفاً دوباره تلاش کنید." };
  }
  revalidatePath("/", "layout");
  return { saved: true };
}
