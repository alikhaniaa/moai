import { getSettings, popupWindow, SETTING_DEFS, type Settings } from "@/lib/settings";
import { tehranDay } from "@/lib/visits";
import { saveSettings } from "../actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

/** The group whose fields get the live status strip below. */
const POPUP_GROUP = "پاپ‌آپ اعلان";

/** A line of guidance under a group's heading, where the labels aren't enough. */
const GROUP_NOTES: Record<string, string> = {
  [POPUP_GROUP]:
    "پاپ‌آپ چند ثانیه بعد از ورود بازدیدکننده باز می‌شود و در هر بازدید فقط یک‌بار دیده می‌شود. اگر متن را عوض کنی، دوباره به همه نشان داده می‌شود.",
  "دکمه‌ی تماس":
    "این همان دکمه‌ی گردِ گوشه‌ی صفحه است. مقصد سه گزینه‌اش از بخش «تماس» بالا خوانده می‌شود — واتس‌اپ، آی‌دی بله و شماره تماس. هر کدام را خالی بگذاری، همان گزینه در دکمه نشان داده نمی‌شود؛ اگر هر سه خالی باشند، خودِ دکمه هم نمایش داده نمی‌شود.",
};

/** «۱ شهریور ۱۴۰۵» for a YYYY-MM-DD, read as a plain calendar day. */
const faDay = (day: string) =>
  new Intl.DateTimeFormat("fa-IR", { timeZone: "UTC", dateStyle: "medium" }).format(
    new Date(`${day}T12:00:00Z`)
  );

const dayDiff = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** One sentence telling the shop exactly what the popup is doing right now. */
function popupStatus(settings: Settings) {
  if (settings.popupEnabled !== "1") return { tone: "off", text: "پاپ‌آپ خاموش است و به مشتری نشان داده نمی‌شود." };
  if (!(settings.popupText ?? "").trim())
    return { tone: "warn", text: "متن پاپ‌آپ خالی است، برای همین چیزی نمایش داده نمی‌شود." };

  const { from, until } = popupWindow(settings);
  const today = tehranDay();

  if (from && today < from)
    return { tone: "warn", text: `هنوز شروع نشده — از ${faDay(from)} نمایش داده می‌شود.` };
  if (until && today > until)
    return { tone: "warn", text: `زمان نمایشش تمام شده (تا ${faDay(until)} بود). برای تمدید، تاریخ شروع یا تعداد روزها را عوض کن.` };

  const left = until ? dayDiff(today, until) + 1 : 0;
  return {
    tone: "live",
    text: until
      ? `هم‌اکنون روی سایت باز می‌شود — تا ${faDay(until)}، یعنی ${left.toLocaleString("fa-IR")} روز دیگر.`
      : "هم‌اکنون روی سایت باز می‌شود — بدون تاریخ پایان.",
  };
}

const TONE: Record<string, string> = {
  live: "bg-sea-100 text-sea-700",
  warn: "bg-gold/15 text-clay-700",
  off: "bg-sand-100 text-ink/70",
};

export default async function AdminSettings({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const settings = await getSettings();

  const groups = [...new Set(SETTING_DEFS.map((d) => d.group))];
  const status = popupStatus(settings);
  const today = tehranDay();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold text-sea-900">تنظیمات سایت</h1>
        <p className="mt-1 text-sm text-ink/68">
          اطلاعات تماس، هزینه ارسال و متن‌های اصلی سایت — بدون نیاز به برنامه‌نویس.
        </p>
      </div>

      {saved && (
        <p className="rounded-2xl bg-sea-100 px-5 py-3 text-sm font-bold text-sea-700">
          ✓ تغییرات ذخیره شد و روی سایت اعمال شده است.
        </p>
      )}

      <Link href="/admin/appearance" className="card block p-5 text-sm font-semibold text-sea-900 hover:bg-sand-50">🎨 تغییر رنگ‌های سایت و نوار مناسبت‌ها ←</Link>
      <Link href="/admin/homepage" className="card block p-5 text-sm font-semibold text-sea-900 hover:bg-sand-50">ویرایش متن، دکمه و تصویر بالای صفحه اصلی ←</Link>
      <form action={saveSettings} className="space-y-6">
        {groups.map((g) => (
          <div key={g} className="card p-7">
            <h2 className="mb-5 font-display text-2xl font-bold text-sea-900">{g}</h2>

            {(g === POPUP_GROUP || GROUP_NOTES[g]) && (
              <div className="mb-5 space-y-2">
                {g === POPUP_GROUP && (
                  <p className={`rounded-2xl px-5 py-3 text-sm font-bold ${TONE[status.tone]}`}>
                    {status.text}
                  </p>
                )}
                {GROUP_NOTES[g] && (
                  <p className="text-xs leading-6 text-ink/60">{GROUP_NOTES[g]}</p>
                )}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {SETTING_DEFS.filter((d) => d.group === g).map((d) => {
                const type = "type" in d ? d.type : "text";

                // An unticked checkbox posts nothing at all, so a "0" twin goes
                // first and the ticked box overwrites it - saveSettings applies
                // the entries in form order.
                if (type === "checkbox") {
                  return (
                    <label
                      key={d.key}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-sand-200 bg-white px-4 py-3.5 md:col-span-2"
                    >
                      <input type="hidden" name={`s_${d.key}`} value="0" />
                      <input
                        type="checkbox"
                        name={`s_${d.key}`}
                        value="1"
                        defaultChecked={settings[d.key] === "1"}
                        className="h-5 w-5 accent-clay-500"
                      />
                      <span className="text-sm font-semibold text-sea-900">{d.label}</span>
                    </label>
                  );
                }

                return (
                  <div key={d.key} className={type === "textarea" ? "md:col-span-2" : ""}>
                    <label className="mb-1.5 block text-sm font-semibold text-sea-900">
                      {d.label}
                    </label>
                    {type === "textarea" ? (
                      <textarea
                        name={`s_${d.key}`}
                        defaultValue={settings[d.key]}
                        className="input min-h-24 resize-y"
                      />
                    ) : (
                      <input
                        name={`s_${d.key}`}
                        type={type === "number" ? "number" : type === "date" ? "date" : "text"}
                        dir={type === "number" || type === "date" ? "ltr" : undefined}
                        // an unset start day defaults to today, so «۱۰ روز» reads
                        // as ten days from now without any date-picking
                        defaultValue={type === "date" ? settings[d.key] || today : settings[d.key]}
                        className="input"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <button className="btn btn-primary">ذخیره تنظیمات</button>
      </form>
    </div>
  );
}
