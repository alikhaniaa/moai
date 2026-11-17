// Shared by the storefront, admin preview, and save validation. No database reads.
export const APPEARANCE_DEFAULTS = {
  appearanceMain: "#4a8578",
  appearanceAccent: "#bc6c4a",
  appearanceBackground: "#fbf7ee",
  eventEnabled: "0",
  eventPreset: "nowruz",
  eventText: "",
  eventDecorations: "1",
} as const;

export type Appearance = {
  main: string;
  accent: string;
  background: string;
  eventEnabled: boolean;
  eventPreset: string;
  eventText: string;
  eventDecorations: boolean;
};

export type EventMotif = "flower" | "fire" | "leaf" | "pomegranate" | "pumpkin" | "snow" | "heart" | "star" | "earth";
export const EVENT_PRESETS: {
  id: string; name: string; text: string; background: string; foreground: string; accent: string; motif: EventMotif;
}[] = [
  { id: "nowruz", name: "نوروز", text: "نوروز مبارک؛ به استقبال روزهای تازه برویم", background: "#174c3b", foreground: "#fff8e7", accent: "#edc877", motif: "flower" },
  { id: "chaharshanbe", name: "چهارشنبه‌سوری", text: "چهارشنبه‌سوری مبارک؛ روشن و پرشور باشید", background: "#572319", foreground: "#fff5e5", accent: "#ffbb6a", motif: "fire" },
  { id: "sizdah", name: "سیزده‌بدر", text: "سیزده‌بدر مبارک؛ یک روز خوش در آغوش طبیعت", background: "#284c28", foreground: "#f6f7df", accent: "#c5da8b", motif: "leaf" },
  { id: "yalda", name: "شب یلدا", text: "یلدایتان گرم؛ بلندترین شب، زیباترین بهانه برای با هم بودن", background: "#651e32", foreground: "#fff1df", accent: "#efa788", motif: "pomegranate" },
  { id: "mehregan", name: "جشن مهرگان", text: "مهرگان مبارک؛ جشن مهر و دوستی", background: "#663b20", foreground: "#fff3da", accent: "#e8b16c", motif: "leaf" },
  { id: "tirgan", name: "جشن تیرگان", text: "تیرگان مبارک؛ به روشنی آب و آسمان", background: "#174a65", foreground: "#eefaff", accent: "#9cdbe4", motif: "flower" },
  { id: "sepandarmazgan", name: "سپندارمذگان", text: "سپندارمذگان مبارک؛ روز مهر و عشق", background: "#653144", foreground: "#fff3ee", accent: "#efb5c4", motif: "heart" },
  { id: "autumn", name: "آغاز پاییز", text: "سلام پاییز؛ فصل رنگ‌های گرم و لحظه‌های آرام", background: "#63391f", foreground: "#fff4df", accent: "#edbd78", motif: "leaf" },
  { id: "winter", name: "آغاز زمستان", text: "سلام زمستان؛ روزهای سرد، دل‌های گرم", background: "#233e5d", foreground: "#f0f7ff", accent: "#c2dced", motif: "snow" },
  { id: "halloween", name: "هالووین", text: "هالووین مبارک؛ یک شب پر از رنگ و خیال", background: "#30203e", foreground: "#fff1de", accent: "#f5a14d", motif: "pumpkin" },
  { id: "christmas", name: "کریسمس", text: "کریسمس مبارک؛ شادی را با هم قسمت کنیم", background: "#1c483c", foreground: "#fff6e8", accent: "#e5b973", motif: "snow" },
  { id: "newyear", name: "سال نو میلادی", text: "سال نو میلادی مبارک؛ به امید روزهای زیبا", background: "#26334d", foreground: "#fff6df", accent: "#e8c16c", motif: "star" },
  { id: "valentine", name: "ولنتاین", text: "ولنتاین مبارک؛ یک هدیه کوچک، یک دنیا محبت", background: "#66233e", foreground: "#fff1f4", accent: "#efacbc", motif: "heart" },
  { id: "womensday", name: "روز جهانی زن", text: "روز جهانی زن گرامی؛ برای تمام زنان الهام‌بخش", background: "#49345f", foreground: "#fff5ff", accent: "#dec0ed", motif: "flower" },
  { id: "earthday", name: "روز زمین", text: "روز زمین گرامی؛ با طبیعت مهربان‌تر باشیم", background: "#214c3b", foreground: "#f2f9e5", accent: "#b6d888", motif: "earth" },
  { id: "blackfriday", name: "بلک فرایدی", text: "بلک فرایدی؛ فرصتی برای انتخاب‌های دوست‌داشتنی", background: "#242424", foreground: "#fff5e2", accent: "#e8c16c", motif: "star" },
  { id: "custom", name: "مناسبت دلخواه", text: "", background: "#253e38", foreground: "#fff6e8", accent: "#e6c684", motif: "star" },
];

export const COLOR_PRESETS = [
  { name: "موآی", main: APPEARANCE_DEFAULTS.appearanceMain, accent: APPEARANCE_DEFAULTS.appearanceAccent, background: APPEARANCE_DEFAULTS.appearanceBackground },
  { name: "آبی", main: "#326d9c", accent: "#416cbb", background: "#f3f7fc" },
  { name: "پاییزی", main: "#796044", accent: "#b85d32", background: "#fcf5ea" },
  { name: "بهاری", main: "#447859", accent: "#b75077", background: "#f6f9ee" },
];

export function validHex(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a: string, b: string, weight: number) => {
  const right = channels(b);
  return "#" + channels(a).map((v, i) => Math.round(v * (1 - weight) + right[i] * weight).toString(16).padStart(2, "0")).join("");
};

export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

export function contrast(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const readable = (color: string, background: string, ratio = 4.5) => {
  let result = color;
  for (let i = 0; i < 32 && contrast(result, background) < ratio; i++) result = mix(result, "#000000", 0.08);
  return result;
};

export function getAppearance(settings: Record<string, string>): Appearance {
  const hex = (key: keyof typeof APPEARANCE_DEFAULTS) => {
    const raw = settings[key]?.trim().toLowerCase();
    return raw && validHex(raw) ? raw : APPEARANCE_DEFAULTS[key];
  };
  const background = hex("appearanceBackground");
  return {
    main: hex("appearanceMain"),
    accent: hex("appearanceAccent"),
    background: luminance(background) >= 0.7 ? background : APPEARANCE_DEFAULTS.appearanceBackground,
    eventEnabled: settings.eventEnabled === "1",
    eventPreset: EVENT_PRESETS.some((e) => e.id === settings.eventPreset) ? settings.eventPreset : "nowruz",
    eventText: (settings.eventText ?? "").trim().slice(0, 160),
    eventDecorations: settings.eventDecorations !== "0",
  };
}

/** Only changed families are overridden, so the untouched default stays exact. */
export function appearanceVariables(appearance: Appearance): Record<string, string> {
  const a = getAppearance({ appearanceMain: appearance.main, appearanceAccent: appearance.accent, appearanceBackground: appearance.background });
  const vars: Record<string, string> = {};
  const customBackground = a.background !== APPEARANCE_DEFAULTS.appearanceBackground;
  if (a.main !== APPEARANCE_DEFAULTS.appearanceMain || customBackground) {
    const base = readable(a.main, a.background);
    for (const [shade, white] of [[100, 0.91], [200, 0.77], [300, 0.6], [400, 0.3]] as const)
      vars[`--color-sea-${shade}`] = mix(base, "#ffffff", white);
    vars["--color-sea-500"] = base;
    for (const [shade, black] of [[600, 0.18], [700, 0.35], [800, 0.53], [900, 0.68]] as const)
      vars[`--color-sea-${shade}`] = mix(base, "#000000", black);
  }
  if (a.accent !== APPEARANCE_DEFAULTS.appearanceAccent || customBackground) {
    const base = readable(a.accent, a.background);
    vars["--color-clay-300"] = mix(base, "#ffffff", 0.5);
    vars["--color-clay-400"] = mix(base, "#ffffff", 0.25);
    vars["--color-clay-500"] = base;
    vars["--color-clay-600"] = mix(base, "#000000", 0.2);
    vars["--color-clay-700"] = mix(base, "#000000", 0.38);
  }
  if (customBackground) {
    vars["--color-sand-50"] = a.background;
    for (const [shade, weight] of [[100, 0.04], [200, 0.1], [300, 0.19], [400, 0.32]] as const)
      vars[`--color-sand-${shade}`] = mix(a.background, "#53452e", weight);
  }
  return vars;
}

export function eventBanner(appearance: Appearance) {
  if (!appearance.eventEnabled) return null;
  const preset = EVENT_PRESETS.find((e) => e.id === appearance.eventPreset);
  if (!preset) return null;
  const text = appearance.eventText || preset.text;
  return text ? { ...preset, text, decorated: appearance.eventDecorations } : null;
}

export type EventBannerData = NonNullable<ReturnType<typeof eventBanner>>;
