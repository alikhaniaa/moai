// No live database or external services. Node 24: node tools/appearance-regression.mjs
import assert from "node:assert/strict";
import { register } from "node:module";
const SRC = new URL("../src/", import.meta.url).href;
register("data:text/javascript," + encodeURIComponent(`
const src = ${JSON.stringify(SRC)};
const mocks = {
  '@/lib/db': 'export const db=globalThis.__appearanceTest.db',
  '@/lib/auth': 'export async function requireAdmin(){return globalThis.__appearanceTest.admin}',
  'next/navigation': 'export function redirect(url){throw new Error("REDIRECT:"+url)}',
  'next/cache': 'export function revalidatePath(...args){globalThis.__appearanceTest.invalidated.push(args)}'
};
export function resolve(s,c,n) {
  if(mocks[s])return {url:'data:text/javascript,'+encodeURIComponent(mocks[s]),shortCircuit:true};
  if(s.startsWith('@/'))return n(src+s.slice(2)+'.ts',c);
  return n(s,c);
}`));
const state = globalThis.__appearanceTest = {
  admin: { id: "admin" }, stored: { shopPhone: "existing", announcement: "existing" },
  invalidated: [], fail: false,
};
state.db = {
  setting: { upsert: (operation) => operation },
  $transaction: async (operations) => {
    if (state.fail) throw new Error("database unavailable");
    for (const { create } of operations) state.stored[create.key] = create.value;
  },
};
const { APPEARANCE_DEFAULTS, COLOR_PRESETS, EVENT_PRESETS, getAppearance, appearanceVariables, eventBanner, contrast, validHex } = await import(SRC + "lib/appearance.ts");
const { saveAppearance } = await import(SRC + "app/admin/appearance/actions.ts");

assert.deepEqual(appearanceVariables(getAppearance({})), {});
assert.equal(eventBanner(getAppearance({})), null);
assert.deepEqual(appearanceVariables(getAppearance(APPEARANCE_DEFAULTS)), {});
console.log("PASS: absent settings and restored defaults preserve the existing palette exactly and hide the event bar");

for (const color of ["#ffffff", "#ffff00", "#00ff00", "#000000", "#0000ff", "#f4c8ec", ...COLOR_PRESETS.map((p) => p.accent)]) {
  const a = getAppearance({ appearanceMain: color, appearanceAccent: color, appearanceBackground: "#f3f7fc" });
  const vars = appearanceVariables(a);
  assert.ok(Object.values(vars).every(validHex));
  assert.ok(contrast(vars["--color-clay-500"], a.background) >= 4.5);
  assert.ok(contrast(vars["--color-sea-900"], a.background) >= 7);
}
const malformed = getAppearance({ appearanceMain: "red; } body {display:none}", appearanceAccent: "url(javascript:test)", appearanceBackground: "#000000" });
assert.equal(malformed.main, APPEARANCE_DEFAULTS.appearanceMain);
assert.equal(malformed.accent, APPEARANCE_DEFAULTS.appearanceAccent);
assert.equal(malformed.background, APPEARANCE_DEFAULTS.appearanceBackground);
console.log("PASS: custom colors generate readable button/title shades; invalid stored CSS and dark backgrounds fall back safely");

for (const preset of EVENT_PRESETS) {
  const banner = eventBanner(getAppearance({ eventEnabled: "1", eventPreset: preset.id, eventText: preset.id === "custom" ? "جشن ما" : "" }));
  assert.ok(banner?.text);
  assert.ok(contrast(preset.background, preset.foreground) >= 4.5);
}
assert.equal(eventBanner(getAppearance({ eventEnabled: "1", eventPreset: "custom" })), null);
assert.equal(eventBanner(getAppearance({ eventEnabled: "1", eventText: "پیام دلخواه", eventDecorations: "0" })).decorated, false);
console.log("PASS: all event presets have readable text; custom text and decoration controls work");

const form = (overrides = {}) => {
  const data = new FormData();
  for (const [k, v] of Object.entries({ ...APPEARANCE_DEFAULTS, ...overrides })) data.set(k, v);
  return data;
};
const result = await saveAppearance({}, form({ appearanceMain: "#326D9C", eventEnabled: "1", eventPreset: "halloween" }));
assert.equal(result.saved, true);
assert.equal(state.stored.appearanceMain, "#326d9c");
assert.equal(state.stored.eventEnabled, "1");
assert.equal(state.stored.shopPhone, "existing");
assert.equal(state.stored.announcement, "existing");
assert.deepEqual(state.invalidated, [["/", "layout"]]);
const before = { ...state.stored };
for (const fields of [
  { appearanceMain: "red" }, { appearanceBackground: "#222222" },
  { eventPreset: "not-an-event" }, { eventText: "a".repeat(161) },
  { eventEnabled: "1", eventPreset: "custom", eventText: " " },
]) {
  assert.ok((await saveAppearance({}, form(fields))).error);
  assert.deepEqual(state.stored, before);
}
state.fail = true;
assert.ok((await saveAppearance({}, form())).error);
assert.deepEqual(state.stored, before);
state.fail = false;
const off = form();
off.delete("eventEnabled");
off.delete("eventDecorations");
assert.equal((await saveAppearance({}, off)).saved, true);
assert.equal(state.stored.eventEnabled, "0");
assert.equal(state.stored.eventDecorations, "0");
state.admin = null;
await assert.rejects(saveAppearance({}, form()), /REDIRECT:\/login/);
console.log("PASS: saves require admin access, validate every field before writing, preserve other settings, invalidate the storefront, and report database failures");
