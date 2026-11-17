/**
 * Regenerates every derived brand asset from the two logo masters.
 *
 * Masters (edit these, then re-run - `npm run brand`):
 *   moailogo.jpg      stacked mark + wordmark, black on white
 *   src/app/icon.png  the rounded badge used as the favicon
 *
 * Generated (never hand-edit, they get overwritten):
 *   public/images/og-default.jpg   1200x630 share card - the fallback preview
 *                                  for every page that has no photo of its own
 *   public/images/moai-mark.png    the mark in sand on transparency, used by
 *                                  the per-product share card at /og/<slug>
 *   src/app/favicon.ico            16/32/48 - /favicon.ico must not 404 or
 *                                  Google loses one of its favicon signals
 *   src/app/apple-icon.png         180x180 home-screen icon
 *
 * The script is idempotent: it only ever reads the masters, so re-running it
 * can't degrade anything.
 */
import sharp from "sharp";
import { writeFile } from "fs/promises";
import path from "path";

const root = process.cwd();
const p = (...s) => path.join(root, ...s);

const SEA = { r: 0x0f, g: 0x2c, b: 0x28 }; // --color-sea-900
const SAND = { r: 0xfb, g: 0xf7, b: 0xee }; // --color-sand-50

/** The master is black line-art on white. Turn it into `tint`-coloured
 *  artwork on transparency so it can sit on the dark brand background. */
async function tintedMark(tint, width) {
  const art = await sharp(p("moailogo.jpg"))
    .greyscale()
    .trim({ threshold: 20 }) // drop the white margin around the artwork
    .negate() // ink -> white, paper -> black; i.e. an alpha mask
    .toBuffer();

  const mask = await sharp(art)
    .resize({ width, fit: "inside", withoutEnlargement: false })
    .toBuffer();
  const { width: w, height: h } = await sharp(mask).metadata();

  return {
    buf: await sharp({
      create: { width: w, height: h, channels: 3, background: tint },
    })
      .joinChannel(mask) // the mask becomes the alpha channel
      .png()
      .toBuffer(),
    width: w,
    height: h,
  };
}

async function main() {
  // ---- the mark, in sand, for runtime compositing --------------------------
  const mark = await tintedMark(SAND, 600);
  await writeFile(p("public", "images", "moai-mark.png"), mark.buf);
  console.log(`public/images/moai-mark.png  ${mark.width}x${mark.height}`);

  // ---- the default 1200x630 share card ------------------------------------
  // Sized to sit comfortably inside the safe area every messenger crops to.
  const card = await tintedMark(SAND, 560);
  const cardH = 430;
  const scaled = await sharp(card.buf)
    .resize({ height: cardH, fit: "inside" })
    .toBuffer();
  const scaledMeta = await sharp(scaled).metadata();

  await sharp({ create: { width: 1200, height: 630, channels: 3, background: SEA } })
    .composite([
      {
        input: scaled,
        left: Math.round((1200 - scaledMeta.width) / 2),
        top: Math.round((630 - scaledMeta.height) / 2),
      },
    ])
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toFile(p("public", "images", "og-default.jpg"));
  console.log("public/images/og-default.jpg  1200x630");

  // ---- favicons ------------------------------------------------------------
  const iconSrc = p("src", "app", "icon.png");

  await sharp(iconSrc).resize(180, 180).png().toFile(p("src", "app", "apple-icon.png"));
  console.log("src/app/apple-icon.png  180x180");

  const sizes = [16, 32, 48];
  const pngs = await Promise.all(
    sizes.map((s) => sharp(iconSrc).resize(s, s).png({ compressionLevel: 9 }).toBuffer())
  );
  await writeFile(p("src", "app", "favicon.ico"), ico(sizes, pngs));
  console.log(`src/app/favicon.ico  ${sizes.join("/")}`);
}

/** Minimal PNG-in-ICO container. Every browser Google's crawler included
 *  reads this form; it saves pulling in an encoder dependency. */
function ico(sizes, pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(sizes.length, 4);

  let offset = 6 + 16 * sizes.length;
  const entries = sizes.map((size, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size === 256 ? 0 : size, 0); // width
    e.writeUInt8(size === 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette size
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(pngs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    return e;
  });

  return Buffer.concat([header, ...entries, ...pngs]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
