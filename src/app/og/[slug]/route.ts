import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

/**
 * Share card for a product: /og/<slug>.
 *
 * Why this exists instead of just pointing og:image at the product photo:
 *   - the catalogue is WebP, and WhatsApp / Telegram / LinkedIn refuse to
 *     render a WebP preview. When og:image fails they fall back to whatever
 *     else is on the page - which was the header logo, blown up to fill a
 *     1.91:1 card. That is the "big zoomed logo" bug.
 *   - the photos are portrait (about 3:4). Dropped straight into a landscape
 *     preview they get centre-cropped to a sliver.
 *
 * So: always emit JPEG, always exactly 1200x630, and letterbox the photo
 * rather than crop it, next to the mark.
 */
export const dynamic = "force-dynamic";

const W = 1200;
const H = 630;
const SEA = { r: 0x0f, g: 0x2c, b: 0x28 }; // --color-sea-900
const SAND = { r: 0xfb, g: 0xf7, b: 0xee }; // --color-sand-50

// the photo panel, and where it sits
const CARD_W = 420;
const CARD_H = 470;
const CARD_X = 100;
const CARD_Y = 80;
const RADIUS = 24;

const publicDir = path.join(process.cwd(), "public");

/** Resolve a stored `/uploads/x.webp` to a real file, refusing anything that
 *  tries to climb out of public/. */
function resolveLocal(src: string): string | null {
  if (!src || /^https?:\/\//i.test(src)) return null;
  const rel = src.replace(/^\/+/, "");
  if (!/^(uploads|images)\//.test(rel)) return null;
  const abs = path.resolve(publicDir, rel);
  return abs.startsWith(publicDir + path.sep) ? abs : null;
}

function respond(body: Buffer, cache: string) {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(body.length),
      "Cache-Control": cache,
    },
  });
}

/** The plain logo card, used whenever a product photo can't be composed. */
async function fallback() {
  const buf = await readFile(path.join(publicDir, "images", "og-default.jpg"));
  return respond(buf, "public, max-age=3600");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const product = await db.product.findUnique({
      where: { slug },
      select: { image: true },
    });

    const file = product && resolveLocal(product.image);
    if (!file) return fallback();

    const sharp = (await import("sharp")).default;

    // Letterbox the photo onto a sand panel - `contain`, never `cover`, so
    // nothing of the product is cut off.
    const panel = await sharp(await readFile(file))
      .resize({ width: CARD_W, height: CARD_H, fit: "contain", background: SAND })
      .toBuffer();

    const rounded = await sharp(panel)
      .composite([
        {
          input: Buffer.from(
            `<svg width="${CARD_W}" height="${CARD_H}"><rect width="${CARD_W}" height="${CARD_H}" rx="${RADIUS}" ry="${RADIUS}" fill="#fff"/></svg>`
          ),
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();

    // The mark fills the remaining half.
    const markRegion = W - (CARD_X + CARD_W);
    const mark = await sharp(path.join(publicDir, "images", "moai-mark.png"))
      .resize({ height: 320, fit: "inside" })
      .toBuffer();
    const markMeta = await sharp(mark).metadata();

    const out = await sharp({
      create: { width: W, height: H, channels: 3, background: SEA },
    })
      .composite([
        { input: rounded, left: CARD_X, top: CARD_Y },
        {
          input: mark,
          left: CARD_X + CARD_W + Math.round((markRegion - (markMeta.width ?? 0)) / 2),
          top: Math.round((H - (markMeta.height ?? 0)) / 2),
        },
      ])
      .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
      .toBuffer();

    // Long cache: the URL carries a ?v= stamped from the photo, so a new
    // photo is a new URL and crawlers re-fetch.
    return respond(out, "public, max-age=31536000, immutable");
  } catch {
    // sharp is the one moving part here (the VPS runs an old build for CPU
    // reasons) - a broken card must never take the page's metadata down.
    return fallback().catch(
      () => new Response(null, { status: 302, headers: { Location: "/images/og-default.jpg" } })
    );
  }
}
