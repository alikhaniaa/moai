import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "./db";

const SECRET = process.env.SESSION_SECRET ?? "moai-dev-secret";
const COOKIE = "moai_session";
const THIRTY_DAYS = 30 * 24 * 60 * 60;

const sign = (data: string) =>
  createHmac("sha256", SECRET).update(data).digest("hex").slice(0, 32);

// ── password hashing (scrypt) ─────────────────────────────────────
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored?: string | null) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const test = scryptSync(password, salt, 64);
  const orig = Buffer.from(hash, "hex");
  return orig.length === test.length && timingSafeEqual(orig, test);
}

export async function createSession(userId: string) {
  const exp = Date.now() + THIRTY_DAYS * 1000;
  const payload = `${userId}.${exp}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, // JavaScript can never read the session
    sameSite: "lax", // blocks cross-site POSTs carrying the cookie (CSRF)
    // Tie this to how the site is actually served, not to the build mode: a
    // `secure` cookie is silently dropped over plain HTTP, which locks everyone
    // out. It turns itself on as soon as SITE_URL is an https:// address.
    secure: (process.env.SITE_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSessionUser() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  if (sign(`${id}.${exp}`) !== sig || Date.now() > Number(exp)) return null;
  return db.user.findUnique({ where: { id } });
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}
