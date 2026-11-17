import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { writeFile, mkdir } from "fs/promises";
import { createHash } from "crypto";
import http from "http";
import path from "path";
import fs from "fs";

const db = new PrismaClient();
const OLD_IP = "203.0.113.31";
const HOST = "moaigallery.ir";
const OUT = path.join(process.cwd(), "public", "uploads");
const MAX_GALLERY = 5; // main + up to 5 extra per product

const cleanName = (n) => n.replace(/^اسم\s*[:：]\s*/, "").trim();

// download a file from the old server by connecting to its IP with the real Host header
function download(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      { host: OLD_IP, path: u.pathname + u.search, method: "GET", headers: { Host: HOST }, timeout: 30000 },
      (res) => {
        if (res.statusCode !== 200) { res.resume(); return reject(new Error("HTTP " + res.statusCode)); }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.end();
  });
}

async function optimize(buf, width) {
  return sharp(buf).rotate().resize({ width, withoutEnlargement: true })
    .webp({ quality: 72 }).toBuffer();
}

async function saveOptimized(buf, width) {
  const out = await optimize(buf, width);
  const name = createHash("sha1").update(out).digest("hex").slice(0, 16) + ".webp";
  await writeFile(path.join(OUT, name), out);
  return { url: `/uploads/${name}`, bytes: out.length };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const products = JSON.parse(fs.readFileSync("products.json", "utf8"));
  const dbProducts = await db.product.findMany();
  const byName = new Map(dbProducts.map((p) => [p.nameFa, p]));

  let ok = 0, miss = 0, imgCount = 0, savedBytes = 0, origBytes = 0;

  for (const p of products) {
    const prod = byName.get(cleanName(p.name));
    if (!prod) { miss++; continue; }
    if (!p.images.length) continue;

    const urls = p.images.slice(0, 1 + MAX_GALLERY);
    let mainUrl = null;
    const gallery = [];

    for (let i = 0; i < urls.length; i++) {
      try {
        const raw = await download(urls[i]);
        origBytes += raw.length;
        // main image bigger (1200), gallery a touch smaller (900)
        const { url, bytes } = await saveOptimized(raw, i === 0 ? 1200 : 900);
        savedBytes += bytes;
        imgCount++;
        if (i === 0) mainUrl = url; else gallery.push(url);
      } catch (e) {
        process.stdout.write(`  ! ${cleanName(p.name).slice(0, 20)} img${i}: ${e.message}\n`);
      }
    }

    if (mainUrl) {
      await db.product.update({ where: { id: prod.id }, data: { image: mainUrl } });
      // reset + set gallery
      await db.productImage.deleteMany({ where: { productId: prod.id } });
      if (gallery.length) {
        await db.productImage.createMany({
          data: gallery.map((url, idx) => ({ productId: prod.id, url, sort: idx })),
        });
      }
      ok++;
      process.stdout.write(`  ✓ ${cleanName(p.name).slice(0, 30)} (${1 + gallery.length} imgs)\n`);
    }
  }

  console.log(`\ndone: ${ok} products imaged, ${miss} unmatched, ${imgCount} images`);
  console.log(`size: ${(origBytes / 1e6).toFixed(1)}MB → ${(savedBytes / 1e6).toFixed(1)}MB optimized`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
