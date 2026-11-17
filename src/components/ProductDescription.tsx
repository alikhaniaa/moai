"use client";

import { useMemo, useState } from "react";

/**
 * The product description, given back the shape it was written with.
 *
 * The shop writes these in a plain textarea, and they are long - four thousand
 * characters, ninety-odd lines, with headings, bullet lists and paragraphs. Up
 * to now the whole thing was dumped into one `whitespace-pre-line` block, which
 * turned that structure into an undifferentiated grey wall five thousand pixels
 * tall. This reads the structure back out of the text and renders it properly,
 * and folds anything past the first few blocks behind a «ادامه…» so the rest of
 * the page stays reachable.
 *
 * The parsing is deliberately forgiving: text that has no structure at all
 * still comes out as ordinary paragraphs.
 */

type Block =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "para"; text: string };

const BULLET = /^\s*[•·◦*\-–—✦✧▪️▪●]\s+/;
/** «معرفی محصول:» - a short line that ends in a colon is a heading. */
const HEADING = /[:：]\s*$/;

export function parseDescription(raw: string): Block[] {
  const blocks: Block[] = [];
  // blank lines are the author's own paragraph breaks
  const chunks = raw.replace(/\r\n/g, "\n").split(/\n{2,}/);

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    if (lines.length === 0) continue;

    let buffer: string[] = [];
    let list: string[] = [];

    const flushPara = () => {
      if (buffer.length) blocks.push({ kind: "para", text: buffer.join("\n") });
      buffer = [];
    };
    const flushList = () => {
      if (list.length) blocks.push({ kind: "list", items: list });
      list = [];
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (BULLET.test(trimmed)) {
        flushPara();
        list.push(trimmed.replace(BULLET, "").trim());
        continue;
      }
      flushList();
      // a short line ending in a colon introduces what follows
      if (HEADING.test(trimmed) && trimmed.length <= 90) {
        flushPara();
        blocks.push({ kind: "heading", text: trimmed.replace(/[:：]\s*$/, "").trim() });
        continue;
      }
      buffer.push(trimmed);
    }
    flushList();
    flushPara();
  }

  return blocks;
}

/** Roughly how much of the text is worth showing before asking to expand. */
const PREVIEW_CHARS = 900;

export default function ProductDescription({ text }: { text: string }) {
  const blocks = useMemo(() => parseDescription(text ?? ""), [text]);
  const [open, setOpen] = useState(false);

  // Cut at a block boundary, never mid-sentence, and never leave a lone heading
  // dangling at the fold.
  const previewCount = useMemo(() => {
    let chars = 0;
    let i = 0;
    for (; i < blocks.length; i++) {
      const b = blocks[i];
      chars += b.kind === "list" ? b.items.join(" ").length : b.text.length;
      if (chars >= PREVIEW_CHARS) {
        i++;
        break;
      }
    }
    while (i > 0 && blocks[i - 1]?.kind === "heading") i--;
    return Math.max(1, i);
  }, [blocks]);

  const truncated = blocks.length > previewCount;
  const shown = open || !truncated ? blocks : blocks.slice(0, previewCount);

  if (blocks.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="font-display text-2xl font-bold text-sea-900">معرفی محصول</h2>
      <div className="mt-4 max-w-prose">
        {shown.map((b, i) => {
          if (b.kind === "heading") {
            return (
              <h3
                key={i}
                className="mt-7 mb-2 text-base font-bold text-sea-900 first:mt-0"
              >
                {b.text}
              </h3>
            );
          }
          if (b.kind === "list") {
            return (
              <ul key={i} className="my-3 space-y-2">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5 text-[0.95rem] leading-8 text-ink/82">
                    <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-clay-400" />
                    <span className="min-w-0">{item}</span>
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p
              key={i}
              className="my-3 whitespace-pre-line text-[0.95rem] leading-8 text-ink/82"
            >
              {b.text}
            </p>
          );
        })}

        {truncated && !open && (
          // the fade tells the reader there is more without a hard cut
          <div className="pointer-events-none -mt-16 h-16 bg-gradient-to-t from-sand-50 to-transparent" />
        )}
      </div>

      {truncated && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-sea-100 px-5 py-2.5 text-sm font-bold text-sea-700 transition-colors hover:bg-sea-200"
        >
          {open ? "بستن توضیحات" : "ادامه‌ی توضیحات"}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
