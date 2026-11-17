import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/auth";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Photo upload for the admin panel. Files land in public/uploads/ and are
 * served straight from there.
 *
 * NOTE for deployment: public/uploads must be on a persistent disk. On hosts
 * with an ephemeral filesystem the images vanish on redeploy.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "دسترسی ندارید." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "فایلی انتخاب نشده." }, { status: 400 });
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: "فقط تصویر (JPG, PNG, WEBP, AVIF, GIF) مجاز است." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "حجم تصویر باید کمتر از ۸ مگابایت باشد." },
      { status: 400 }
    );
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });

  const input = Buffer.from(await file.arrayBuffer());
  const id = randomUUID();

  // The landing image needs stricter checks than ordinary catalog uploads.
  if (form?.get("purpose") === "hero") {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return NextResponse.json({ ok: false, error: "برای تصویر اول فقط JPG، PNG یا WEBP انتخاب کن." }, { status: 400 });
    }
    try {
      const sharp = (await import("sharp")).default;
      const meta = await sharp(input, { limitInputPixels: 40000000 }).metadata();
      const rotated = meta.orientation && meta.orientation >= 5;
      const width = rotated ? meta.height : meta.width;
      const height = rotated ? meta.width : meta.height;
      if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || !width || !height || width < 1200 || height < 600 || width < height) {
        return NextResponse.json({ ok: false, error: "عکس باید افقی، با عرض حداقل ۱۲۰۰ و ارتفاع حداقل ۶۰۰ پیکسل باشد." }, { status: 400 });
      }
      // Keep at least 600px of height even for a wide landscape crop.
      const outputWidth = Math.min(width, Math.max(1400, Math.ceil(600 * width / height)));
      const out = await sharp(input, { limitInputPixels: 40000000 }).rotate().resize({ width: outputWidth, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      const name = `${id}.webp`;
      await writeFile(path.join(dir, name), out);
      return NextResponse.json({ ok: true, url: `/uploads/${name}` });
    } catch {
      return NextResponse.json({ ok: false, error: "این عکس قابل پردازش نیست. یک عکس JPG، PNG یا WEBP سالم انتخاب کن؛ اگر ادامه داشت با توسعه‌دهنده هماهنگ کن." }, { status: 400 });
    }
  }

  // Optimize to WebP (resize + compress) so uploads are small and consistent
  // with the rest of the catalog. If sharp fails for any reason, fall back to
  // saving the original so an upload never silently breaks.
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(input)
      .rotate()
      .resize({ width: 1400, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    const name = `${id}.webp`;
    await writeFile(path.join(dir, name), out);
    return NextResponse.json({ ok: true, url: `/uploads/${name}` });
  } catch {
    const name = `${id}.${ext}`;
    await writeFile(path.join(dir, name), input);
    return NextResponse.json({ ok: true, url: `/uploads/${name}` });
  }
}
