/**
 * Is دیجی‌پی actually reachable and are the credentials accepted?
 *
 *   node tools/digipaycheck.mjs           # token only - cannot spend anything
 *   node tools/digipaycheck.mjs --ticket  # also issues ONE unpaid test ticket
 *
 * The default run asks for an OAuth token and stops. `--ticket` additionally
 * creates a payment ticket for 1,000 Toman and prints the URL - it does NOT pay
 * it, and an unpaid ticket simply expires. That is the only honest way to
 * confirm the amount unit, because the UPG document never says whether `amount`
 * is Rial or Toman: open the URL and read what DigiPay shows the buyer.
 *
 * Secrets are never printed.
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^\s*[A-Z_]+\s*=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
for (const [k, v] of Object.entries(env)) process.env[k] ??= v;

const BASE = (env.DIGIPAY_BASE || "https://api.mydigipay.com/digipay/api").replace(/\/$/, "");
const need = ["DIGIPAY_CLIENT_ID", "DIGIPAY_CLIENT_SECRET", "DIGIPAY_USERNAME", "DIGIPAY_PASSWORD"];

let fails = 0;
const check = (label, ok, extra = "") => {
  if (!ok) fails++;
  console.log(`   ${ok ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
};

console.log(`\nbase: ${BASE}`);
console.log("─── credentials present ───");
for (const k of need) {
  const v = env[k] ?? "";
  check(k, !!v, v ? `${v.length} chars` : "MISSING from .env");
}
if (fails) {
  console.log("\nCannot continue without every credential.\n");
  process.exit(1);
}

// ── 1. reachability ──
console.log("\n─── reachability ───");
try {
  const res = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    body: new URLSearchParams({ grant_type: "password" }),
    signal: AbortSignal.timeout(20_000),
  });
  check("DigiPay answers", res.status > 0, `HTTP ${res.status}`);
} catch (e) {
  check("DigiPay answers", false, e.message);
  console.log("\nThe gateway is not reachable from this machine.\n");
  process.exit(1);
}

// ── 2. token ──
console.log("\n─── oauth token ───");
const basic = Buffer.from(`${env.DIGIPAY_CLIENT_ID}:${env.DIGIPAY_CLIENT_SECRET}`).toString("base64");
let token = "";
try {
  const res = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      username: env.DIGIPAY_USERNAME,
      password: env.DIGIPAY_PASSWORD,
      grant_type: "password",
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const data = await res.json().catch(() => ({}));
  token = typeof data.access_token === "string" ? data.access_token : "";
  check("credentials accepted", res.ok && !!token, `HTTP ${res.status}`);
  if (token) console.log(`         token received (${token.length} chars), valid ${data.expires_in ?? "?"}s`);
  else console.log(`         ${JSON.stringify(data).slice(0, 200)}`);
} catch (e) {
  check("credentials accepted", false, e.message);
}

if (!token) {
  console.log("\nNo token — the ticket and verify calls cannot be checked.\n");
  process.exit(1);
}

// ── 3. verify endpoint reachable and authenticated ──
// Asking about a transaction that does not exist proves the endpoint accepts
// our bearer token; a business error here is the CORRECT answer, not a failure.
console.log("\n─── verify endpoint ───");
try {
  const res = await fetch(`${BASE}/purchases/verify?type=0`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      Agent: "WEB",
      "Digipay-Version": "2022-02-02",
    },
    body: JSON.stringify({ trackingCode: "moai-connectivity-probe", providerId: "moai-connectivity-probe" }),
    signal: AbortSignal.timeout(25_000),
  });
  const data = await res.json().catch(() => ({}));
  check("verify endpoint accepts our token", res.status !== 401 && res.status !== 403, `HTTP ${res.status}`);
  console.log(`         answered: ${JSON.stringify(data).slice(0, 220)}`);
} catch (e) {
  check("verify endpoint accepts our token", false, e.message);
}

// ── 4. optional: one unpaid ticket, to read the amount unit off DigiPay ──
if (process.argv.includes("--ticket")) {
  console.log("\n─── test ticket (1,000 Toman — NOT paid) ───");
  const providerId = `moai-check-${Date.now()}`;
  const amountRial = 1_000 * 10; // what the app would send for 1,000 Toman
  try {
    const res = await fetch(`${BASE}/tickets/business?type=0`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        Agent: "WEB",
        "Digipay-Version": "2022-02-02",
      },
      body: JSON.stringify({
        amount: amountRial,
        providerId,
        callbackUrl: `${(env.SITE_URL || "https://moaigallery.ir").replace(/\/$/, "")}/api/payment/digipay/callback`,
        cellNumber: env.DIGIPAY_TEST_CELL || "09121230000",
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const data = await res.json().catch(() => ({}));
    const status = Number(data?.result?.status ?? -1);
    check("ticket issued", res.ok && status === 0, `HTTP ${res.status}, result.status ${status}`);
    if (data.redirectUrl) {
      console.log(`\n   sent amount = ${amountRial} (Rial for 1,000 Toman)`);
      console.log(`   open this and check DigiPay shows ۱٬۰۰۰ تومان — do NOT pay it:`);
      console.log(`   ${data.redirectUrl}\n`);
    } else {
      console.log(`         ${JSON.stringify(data).slice(0, 260)}`);
    }
  } catch (e) {
    check("ticket issued", false, e.message);
  }
}

console.log(fails === 0 ? "\n✓ دیجی‌پی is reachable and the credentials work\n" : `\n✗ ${fails} check(s) failed\n`);
process.exit(fails === 0 ? 0 : 1);
