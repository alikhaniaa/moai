import { readFile } from "fs/promises";
import path from "path";
import { validHeroImage } from "@/lib/hero";

export const dynamic = "force-dynamic";

/** Public hero photos, including uploads made after the server started. */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!validHeroImage(`/uploads/${name}`)) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", "uploads", name));
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch { return new Response(null, { status: 404 }); }
}
