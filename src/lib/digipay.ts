import "server-only";
import { TYPE_IPG } from "./digipay-units";

/**
 * دیجی‌پی (DigiPay UPG) - the shop's third payment method.
 * Implemented from https://www.mydigipay.com/developers/docs/upg
 *
 * Flow: token() → createTicket() → browser follows `redirectUrl` → DigiPay
 * POSTs the result to our callback → verifyPurchase() confirms it.
 *
 * The single most important thing about this gateway: **the callback carries no
 * signature and no hash of any kind**. Anyone who learns a callback URL can POST
 * `result=SUCCESS` at it. So the callback is treated purely as a nudge saying
 * "attempt N finished, go look" - whether money actually moved, and how much, is
 * only ever established by calling /purchases/verify ourselves. That is the same
 * rule the SEP integration follows, for the same reason.
 */

const TIMEOUT_MS = 25_000;

export const digipayBase = () =>
  (process.env.DIGIPAY_BASE || "https://api.mydigipay.com/digipay/api").replace(/\/$/, "");

const clientId = () => process.env.DIGIPAY_CLIENT_ID?.trim() ?? "";
const clientSecret = () => process.env.DIGIPAY_CLIENT_SECRET ?? "";
const username = () => process.env.DIGIPAY_USERNAME?.trim() ?? "";
const password = () => process.env.DIGIPAY_PASSWORD ?? "";

/** Every credential must be present, or the option must not be offered at all. */
export const digipayConfigured = () =>
  !!(clientId() && clientSecret() && username() && password());

/**
 * The «دیجی‌پی» option only appears at checkout when it is switched on AND fully
 * configured - a buyer must never reach a half-set-up gateway.
 */
export const digipayEnabled = () =>
  process.env.DIGIPAY_ENABLED === "1" && digipayConfigured();

// The money conversion lives in its own module so the test suite can import
// it without dragging `server-only` in; re-exported here so callers see one API.
export { tomanToRial, TYPE_IPG } from "./digipay-units";

// ── OAuth ────────────────────────────────────────────────────────────

type Cached = { token: string; expiresAt: number };
let cached: Cached | null = null;

/** Business error codes worth saying something specific about (table 49). */
export const DIGIPAY_ERROR_FA: Record<number, string> = {
  0: "موفق",
  9001: "توکن پرداخت نامعتبر است.",
  9003: "مهلت پرداخت به پایان رسیده است.",
  9009: "زمان تایید تراکنش به پایان رسید.",
  9010: "تایید تراکنش ناموفق بود.",
  9031: "امکان صدور بلیت پرداخت برای این کاربر نیست.",
};

/**
 * An access token, cached until shortly before it expires.
 *
 * DigiPay tokens last about an hour; asking for a fresh one on every checkout
 * would be a needless round trip in front of a buyer who is trying to pay.
 */
export async function accessToken(force = false): Promise<
  { ok: true; token: string } | { ok: false; error: string; status?: number }
> {
  if (!force && cached && Date.now() < cached.expiresAt) {
    return { ok: true, token: cached.token };
  }
  if (!digipayConfigured()) {
    return { ok: false, error: "تنظیمات دیجی‌پی کامل نیست." };
  }

  const basic = Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64");
  try {
    const res = await fetch(`${digipayBase()}/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        username: username(),
        password: password(),
        grant_type: "password",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const token = typeof data?.access_token === "string" ? data.access_token : "";

    if (!res.ok || !token) {
      return {
        ok: false,
        status: res.status,
        error:
          res.status === 401
            ? "نام کاربری، رمز یا کلید دیجی‌پی پذیرفته نشد."
            : "دریافت توکن دیجی‌پی ناموفق بود.",
      };
    }

    // refresh a minute early rather than racing the expiry
    const ttl = Number(data?.expires_in ?? 3599);
    cached = { token, expiresAt: Date.now() + Math.max(60, ttl - 60) * 1000 };
    return { ok: true, token };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "ارتباط با دیجی‌پی برقرار نشد.",
    };
  }
}

/** Drops the cached token - used by the test/verify tooling. */
export const forgetToken = () => {
  cached = null;
};

/** Shared plumbing for the two authenticated JSON endpoints. */
async function authed(
  path: string,
  body: unknown,
  retryOn401 = true
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const auth = await accessToken();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const res = await fetch(`${digipayBase()}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json; charset=UTF-8",
        Accept: "application/json",
        Agent: "WEB",
        "Digipay-Version": "2022-02-02",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    // A token can expire mid-session; get a fresh one and go round once.
    if (res.status === 401 && retryOn401) {
      forgetToken();
      return authed(path, body, false);
    }

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!data) return { ok: false, error: `پاسخ نامعتبر از دیجی‌پی (HTTP ${res.status})` };
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "ارتباط با دیجی‌پی برقرار نشد.",
    };
  }
}

/** `result.status` is DigiPay's real answer; HTTP 200 alone means nothing. */
const resultOf = (data: Record<string, unknown>) => {
  const r = (data.result ?? {}) as Record<string, unknown>;
  const status = Number(r.status ?? r.code ?? -1);
  const message =
    (typeof r.message === "string" && r.message) ||
    (typeof r.title === "string" && r.title) ||
    "";
  return { status, message };
};

// ── Ticket ───────────────────────────────────────────────────────────

export type TicketResult =
  | { ok: true; redirectUrl: string; ticket: string }
  | { ok: false; error: string };

/**
 * مرحله ۱ - صدور بلیت پرداخت. `providerId` is our own Payment row id, so the
 * callback can find exactly which attempt finished.
 */
export async function createTicket(args: {
  amountRial: number;
  providerId: string;
  callbackUrl: string;
  cellNumber: string;
}): Promise<TicketResult> {
  const res = await authed(`/tickets/business?type=${TYPE_IPG}`, {
    amount: args.amountRial,
    providerId: args.providerId,
    callbackUrl: args.callbackUrl,
    // DigiPay wants a bare 09xxxxxxxxx
    cellNumber: args.cellNumber.replace(/\D/g, ""),
  });
  if (!res.ok) return { ok: false, error: res.error };

  const { status, message } = resultOf(res.data);
  const redirectUrl = typeof res.data.redirectUrl === "string" ? res.data.redirectUrl : "";
  const ticket = typeof res.data.ticket === "string" ? res.data.ticket : "";

  if (status !== 0 || !redirectUrl) {
    return {
      ok: false,
      error: DIGIPAY_ERROR_FA[status] ?? (message || "صدور بلیت پرداخت دیجی‌پی ناموفق بود."),
    };
  }
  return { ok: true, redirectUrl, ticket };
}

// ── Verify ───────────────────────────────────────────────────────────

export type VerifyResult =
  | {
      ok: true;
      /** what DigiPay says was actually charged - compare with the invoice */
      amountRial: number;
      trackingCode: string;
      paymentGateway?: number;
    }
  | { ok: false; error: string; status?: number };

/**
 * مرحله ۲ - تایید خرید. Nothing is marked paid until this says so: the callback
 * itself is unauthenticated and cannot be used as proof of payment.
 */
export async function verifyPurchase(args: {
  trackingCode: string;
  providerId: string;
  type?: number;
}): Promise<VerifyResult> {
  const type = args.type ?? TYPE_IPG;
  const res = await authed(`/purchases/verify?type=${type}`, {
    trackingCode: args.trackingCode,
    providerId: args.providerId,
  });
  if (!res.ok) return { ok: false, error: res.error };

  const { status, message } = resultOf(res.data);
  if (status !== 0) {
    return {
      ok: false,
      status,
      error: DIGIPAY_ERROR_FA[status] ?? (message || "تایید پرداخت دیجی‌پی ناموفق بود."),
    };
  }

  return {
    ok: true,
    amountRial: Number(res.data.amount ?? 0),
    trackingCode: String(res.data.trackingCode ?? args.trackingCode),
    paymentGateway:
      res.data.paymentGateway === undefined ? undefined : Number(res.data.paymentGateway),
  };
}
