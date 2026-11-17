// Render the real components with production CSS for layout checks without a server or database.
import assert from "node:assert/strict";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { register } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import puppeteer from "puppeteer-core";

const ROOT = new URL("../", import.meta.url);
const SRC = new URL("src/", ROOT).href;
const REACT = new URL("node_modules/react/index.js", ROOT).href;
const TYPESCRIPT = new URL("node_modules/typescript/lib/typescript.js", ROOT).href;
register("data:text/javascript," + encodeURIComponent(`
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import ts from ${JSON.stringify(TYPESCRIPT)};
const src=${JSON.stringify(SRC)};
const mocks={
  '@/app/admin/appearance/actions':'export async function saveAppearance(){return {error:"preview only"}}',
  '@/lib/cart':'export function useCart(){return {count:0,setOpen(){}}}',
  'next/navigation':'export function usePathname(){return "/products"}',
  'next/link':'import React from '+${JSON.stringify(JSON.stringify(REACT))}+';export default function Link({href,children,...props}){return React.createElement("a",{href,...props},children)}'
};
export function resolve(s,c,n){
  if(mocks[s])return {url:'data:text/javascript,'+encodeURIComponent(mocks[s]),shortCircuit:true};
  if(s.startsWith('@/')){const path=src+s.slice(2);return n(path+(existsSync(fileURLToPath(path+'.tsx'))?'.tsx':'.ts'),c)}
  return n(s,c);
}
export async function load(url,c,n){
  if(url.startsWith(src)&&/\\.tsx?$/.test(url)){
    const code=await readFile(new URL(url),'utf8');
    const result=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
    return {format:'module',source:result.outputText,shortCircuit:true};
  }
  return n(url,c);
}
`));
const { getAppearance, appearanceVariables, eventBanner, EVENT_PRESETS } = await import(SRC + "lib/appearance.ts");
const { default: Form } = await import(SRC + "components/admin/AppearanceForm.tsx");
const { default: Navbar } = await import(SRC + "components/Navbar.tsx");
const cssFiles = (await readdir(new URL(".next/static/css/", ROOT), { recursive: true })).filter((f) => f.endsWith(".css"));
assert.ok(cssFiles.length);
let css = (await Promise.all(cssFiles.map((f) => readFile(new URL(".next/static/css/" + f.replaceAll("\\", "/"), ROOT), "utf8")))).join("\n");
css = css.replaceAll("/fonts/", new URL("public/fonts/", ROOT).href);
const OUT = new URL("tmp/appearance-screenshots/", ROOT);
await mkdir(OUT, { recursive: true });
const a = getAppearance({ appearanceMain: "#326d9c", appearanceAccent: "#416cbb", appearanceBackground: "#f3f7fc", eventEnabled: "1", eventPreset: "halloween" });
const doc = (body) => `<!doctype html><html dir="rtl" lang="fa"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body>${body}</body></html>`;
const adminMarkup = renderToStaticMarkup(React.createElement("div", { className: "flex min-h-svh bg-sand-100" },
  React.createElement("aside", { className: "w-56 shrink-0 bg-sea-900 text-sand-100 max-md:w-16" }, "موآی"),
  React.createElement("main", { className: "min-w-0 flex-1 p-6 md:p-10" },
    React.createElement("div", { className: "mx-auto max-w-5xl space-y-8" },
      React.createElement("h1", { className: "font-display text-4xl font-bold text-sea-900" }, "ظاهر و مناسبت‌ها"), React.createElement(Form, { initial: a })))));
await writeFile(new URL("admin-preview.html", OUT), doc(adminMarkup));
const storeMarkup = (appearance) => renderToStaticMarkup(React.createElement("div", { "data-storefront": "", className: "min-h-svh bg-sand-50", style: appearanceVariables(appearance) },
  React.createElement(Navbar, { loggedIn: false, announcement: "اعلان اصلی سایت", event: eventBanner(appearance) }),
  React.createElement("main", { className: "mx-auto max-w-7xl px-6 pt-32 md:pt-40" },
    React.createElement("h1", { className: "font-display text-4xl text-sea-900" }, "فروشگاه موآی"),
    React.createElement("p", { className: "my-5 text-ink/70" }, "رنگ تازه، همان حس خوب موآی"),
    React.createElement("button", { className: "btn btn-primary" }, "مشاهده محصولات"))));
const storeDoc = (appearance) => doc(storeMarkup(appearance).replaceAll('src="/images/', 'src="' + new URL("public/images/", ROOT).href));
await writeFile(new URL("store-preview.html", OUT), storeDoc(a));
const browser = await puppeteer.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  for (const width of [320, 375, 1440]) {
    await page.setViewport({ width, height: 1000 });
    await page.goto(new URL("admin-preview.html", OUT).href, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `admin overflow ${width}`);
    await page.screenshot({ path: fileURLToPath(new URL(`admin-${width}.png`, OUT)), fullPage: true });
    await page.goto(new URL("store-preview.html", OUT).href, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      background: getComputedStyle(document.querySelector("[data-storefront]")).backgroundColor,
      headerBottom: document.querySelector("header").getBoundingClientRect().bottom,
      titleTop: document.querySelector("h1").getBoundingClientRect().top,
      eventHeight: document.querySelector("[data-event-bar]").getBoundingClientRect().height,
    }));
    assert.equal(layout.overflow, false, `store overflow ${width}`);
    assert.equal(layout.background, "rgb(243, 247, 252)");
    assert.equal(layout.eventHeight, 48);
    assert.ok(layout.headerBottom <= layout.titleTop);
    await page.screenshot({ path: fileURLToPath(new URL(`store-${width}.png`, OUT)) });
  }
  console.log("PASS: real admin and navbar components with production CSS at 320, 375, and 1440 pixels; no overflow or covered headings; custom colors applied");
  await page.setViewport({ width: 320, height: 900 });
  for (const preset of EVENT_PRESETS) {
    const preview = { ...a, eventPreset: preset.id, eventText: "متن مناسبت ".repeat(14).slice(0, 160) };
    await writeFile(new URL("event-check.html", OUT), storeDoc(preview));
    await page.goto(new URL("event-check.html", OUT).href, { waitUntil: "load" });
    assert.equal(await page.$eval("[data-event-bar]", (el) => el.getBoundingClientRect().height), 48);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  console.log("PASS: all event motifs and maximum-length custom messages fit the mobile header");
} finally {
  await browser.close();
}
