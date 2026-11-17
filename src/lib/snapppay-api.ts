import "server-only";

/**
 * اسنپ‌پی - خرید اقساطی (SnappPay Online Merchant Purchase).
 * Implemented from the official "Online Purchase by Merchants REST API"
 * **ویرایش 2.1، 2026-01-19** (snappayStuff/…/API Document SnappPay.pdf) plus the
 * full error-code table shipped alongside it.
 *
 * Flow:
 *   eligible() → paymentToken() → browser goes to `paymentPageUrl` → SnappPay
 *   POSTs a form back to our returnURL → verify() → settle().
 *   Afterwards the admin may update() (partial refund) or cancel() (full refund).
 *
 * Rules the callback route enforces, all of them straight out of the doc:
 *
 *   1. The callback is a *nudge*, not proof. It carries no signature, so the
 *      only thing it is trusted for is telling us WHICH attempt finished. That
 *      money actually moved is established by calling verify ourselves.
 *   2. «فقط یک بار سرویس verify را فراخوانی کند» (p.9) - so the callback claims
 *      the attempt atomically before it calls anything.
 *   3. state=OK → verify then settle; state=FAILED → revert. A withdrawal that
 *      is neither settled nor reverted is money left hanging.
 *   4. verify and settle must fall back to Get Payment Status when they time out
 *      or answer false (p.20–21) - that is `finalize()` below, and it is what
 *      keeps our record of an order from diverging from SnappPay's.
 *
 * This file is deliberately separate from `snapppay.ts`, which is the *display*
 * mirror of the instalment schedule and must stay importable from the browser.
 *
 * NOTE: SnappPay only accepts requests whose `returnURL` matches the base URL
 * registered for the merchant, and only from whitelisted server IPs. Verified
 * against staging on 2026-09-07: `https://moaigallery.ir/...` is accepted,
 * `http://localhost:3000/...` is refused with 1051. Changing the registered
 * base is a paperwork process on their side (a form plus a ticket at
 * portal.snapppay.ir) - it cannot be changed from here.
 */

const TIMEOUT_MS = 25_000;

/**
 * verify gets its own, longer budget: the doc (p.20) defines the timeout branch
 * as «۳۰ ثانیه», and answering earlier than that would send us down the Get
 * Payment Status path while SnappPay is still deciding.
 */
const VERIFY_TIMEOUT_MS = 30_000;

/**
 * The whole verify+settle recovery, end to end.
 *
 * Each fetch is bounded on its own, but `call()` also sleeps and retries on
 * 1053, so the documented recovery path can chain into minutes - and it runs
 * inside the buyer's own callback request, with a proxy in front of it that
 * will hang up long before that. Past this point the attempt is left for
 * tools/snapppaycheck.mjs to finish rather than held open in front of a person.
 */
const FINALIZE_BUDGET_MS = 75_000;

/** Prices are stored in Toman; SnappPay works entirely in Rial (IRR). */
export const tomanToRial = (toman: number) => toman * 10;

/**
 * Merchant-specific - SnappPay hands this over at activation. There is no
 * sensible default: production and stage live on different hosts, and guessing
 * one would point real orders at the wrong place. Stage, for reference, is
 * https://fms-gateway-staging.apps.public.okd4.teh-1.snappcloud.io
 */
export const snapppayBase = () =>
  (process.env.SNAPPPAY_BASE_URL ?? "").trim().replace(/\/$/, "");

const clientId = () => process.env.SNAPPPAY_CLIENT_ID?.trim() ?? "";
const clientSecret = () => process.env.SNAPPPAY_CLIENT_SECRET ?? "";
const username = () => process.env.SNAPPPAY_USERNAME?.trim() ?? "";
const password = () => process.env.SNAPPPAY_PASSWORD ?? "";

/**
 * Every credential must be present, or the option must not be offered at all.
 *
 * SITE_URL counts as one of them. It is what the returnURL is built from, and
 * SnappPay refuses any returnURL outside the base registered for the merchant
 * (1051) - so an unset SITE_URL after a deploy would advertise instalments at
 * checkout and then kill every one of those orders on the redirect page.
 */
export const snapppayConfigured = () =>
  !!(
    snapppayBase() &&
    clientId() &&
    clientSecret() &&
    username() &&
    password() &&
    (process.env.SITE_URL ?? "").trim()
  );

/**
 * The اسنپ‌پی *gateway* only appears at checkout when it is switched on AND
 * fully configured - a buyer must never reach a half-set-up gateway.
 *
 * With this off, اسنپ‌پی stays exactly as it is today: arranged by hand over
 * واتس‌اپ. Nothing about that flow runs through this file.
 */
export const snapppayEnabled = () =>
  process.env.SNAPPPAY_ENABLED === "1" && snapppayConfigured();

/**
 * The certification test has to run on the live domain - اسنپ‌پی refuses any
 * returnURL outside the registered base (1051), so there is nowhere else for a
 * real purchase to come back to. But the live domain is the actual shop, and
 * pointing it at اسنپ‌پی's *staging* gateway would offer real buyers an
 * instalment option that cannot take their money.
 *
 * `SNAPPPAY_TEST_PHONES` is the way through: while it holds anything, اسنپ‌پی is
 * offered to those numbers and to nobody else. Empty (the normal state) means
 * the gateway behaves for everyone exactly as `SNAPPPAY_ENABLED` says.
 *
 * It fails closed on purpose - a typo in the list hides the gateway rather than
 * exposing a test gateway to the shop.
 */
const normPhone = (p: string) =>
  p.replace(/\D/g, "").replace(/^(?:0098|98)/, "").replace(/^0/, "");

const testPhones = () =>
  (process.env.SNAPPPAY_TEST_PHONES ?? "").split(",").map(normPhone).filter(Boolean);

/**
 * True while `SNAPPPAY_BASE_URL` points at اسنپ‌پی's *staging* cluster rather
 * than a production gateway. The staging host lives on the OKD dev cluster
 * (`…snappcloud.io`) and carries `staging` in its name; a real production base,
 * whatever SnappPay hands over, will be neither.
 *
 * This is the safety hinge below: a staging gateway must never be shown to a
 * real buyer, because it cannot take their money.
 */
export const snapppayStagingBase = () => {
  const b = snapppayBase().toLowerCase();
  return b.includes("staging") || b.includes("snappcloud.io");
};

/**
 * True only if this buyer may be shown the gateway right now.
 *
 * The allow-list means opposite things on the two bases, on purpose:
 *
 *  - **staging base** - an empty list means **nobody**. This is what makes the
 *    certification switch-flip safe: setting `SNAPPPAY_ENABLED="1"` and
 *    forgetting `SNAPPPAY_TEST_PHONES` hides the gateway instead of pointing
 *    every customer at a staging gateway that cannot charge them.
 *  - **production base** - an empty list means **everybody**, which is the
 *    normal live behaviour once real credentials are in.
 *
 * Either way, a non-empty list restricts to exactly those numbers.
 */
export function snapppayEnabledFor(phone: string | null | undefined): boolean {
  if (!snapppayEnabled()) return false;
  const allow = testPhones();
  if (allow.length === 0) return !snapppayStagingBase();
  return allow.includes(normPhone(phone ?? ""));
}

/**
 * Whether the shop is currently gating اسنپ‌پی to test numbers - true when a
 * list is set, or when a staging base is live at all (which is itself a test
 * posture). Drives the admin banner and the check tool's warning.
 */
export const snapppayTestMode = () => testPhones().length > 0 || snapppayStagingBase();

/**
 * SnappPay validates the mobile against `\+98\d{10}` and rejects anything else
 * with error 1005 - a bare `09123456789` does NOT pass. (Confirmed against
 * staging on 2026-09-07: it is the first thing the token endpoint refuses.)
 * Everything we store is in the 09xxxxxxxxx form, so it is converted here, in
 * the one place that talks to them, rather than at every call site.
 */
export function toSnappMobile(mobile: string): string {
  const digits = (mobile ?? "").replace(/\D/g, "");
  // 0098… → 98…, 09… → 9…, 9… stays
  const local = digits.replace(/^(?:0098|98)/, "").replace(/^0/, "");
  return `+98${local}`;
}

/** Cheap pre-flight so we fail with a Persian message instead of an API error. */
export const isValidSnappMobile = (mobile: string) =>
  /^\+989\d{9}$/.test(toSnappMobile(mobile));

// ── Error table (full version, from "SnappPay Error Codes - full version.xlsx")

export const SNAPPPAY_ERROR_FA: Record<number, string> = {
  100: "تراکنش موردنظر نزد اسنپ‌پی پیدا نشد.",
  1000: "خطای داخلی سرویس اسنپ‌پی. لطفاً چند لحظه بعد دوباره تلاش کنید.",
  1003: "توکن اسنپ‌پی معتبر نیست.",
  1005: "اطلاعات ارسالی به اسنپ‌پی ناقص یا نامعتبر است.",
  1007: "توکن پرداخت اسنپ‌پی پیدا نشد.",
  1008: "این تراکنش تکراری است.",
  1009: "برای این شماره تراکنش قبلاً درخواست ثبت شده است.",
  1011: "وضعیت تراکنش برای این عملیات مناسب نیست.",
  1013: "پذیرنده نزد اسنپ‌پی مسدود است.",
  1036: "برای این توکن پرداخت سفارشی نزد اسنپ‌پی پیدا نشد.",
  1042: "مبلغ جدید باید کمتر یا مساوی مبلغ سفارش قبلی باشد.",
  1048: "این توکن پرداخت متعلق به این فروشگاه نیست.",
  1051: "آدرس بازگشت با آدرس ثبت‌شده نزد اسنپ‌پی هم‌خوانی ندارد.",
  1053: "درخواست قبلی هنوز در حال پردازش است؛ چند لحظه بعد دوباره تلاش کنید.",
  1078: "سفارش‌هایی که با کد تخفیف اسنپ‌پی ثبت شده‌اند قابل ویرایش نیستند؛ فقط می‌توان کل سفارش را لغو کرد.",
};

/**
 * The «previous request is still being processed» lock (p. error table, 1053).
 * The documented remedy is literally «با چند ثانیه تاخیر مجددا سرویس را کال
 * کنید», so it is the one error worth retrying by itself.
 */
const ONGOING_PROCESS = 1053;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── OAuth (doc p.5) ──────────────────────────────────────────────────

type Cached = { token: string; expiresAt: number };
let cached: Cached | null = null;

/**
 * A JWT, cached until shortly before it expires.
 *
 * Tokens last an hour; asking for a fresh one on every checkout would be a
 * needless round trip in front of a buyer who is trying to pay. The doc's
 * warning about caching (FAQ 5) is about caching *past* the expiry - hence the
 * one-minute safety margin below.
 */
export async function accessToken(
  force = false
): Promise<{ ok: true; token: string } | { ok: false; error: string; status?: number }> {
  if (!force && cached && Date.now() < cached.expiresAt) {
    return { ok: true, token: cached.token };
  }
  if (!snapppayConfigured()) {
    return { ok: false, error: "تنظیمات اسنپ‌پی کامل نیست." };
  }

  const basic = Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64");
  try {
    const res = await fetch(`${snapppayBase()}/api/online/v1/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "password",
        scope: "online-merchant",
        username: username(),
        password: password(),
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
            ? "نام کاربری، رمز یا کلید اسنپ‌پی پذیرفته نشد."
            : res.status === 403
              ? "آی‌پی این سرور نزد اسنپ‌پی whitelist نشده است."
              : "دریافت توکن اسنپ‌پی ناموفق بود.",
      };
    }

    // refresh a minute early rather than racing the expiry
    const ttl = Number(data?.expires_in ?? 3600);
    cached = { token, expiresAt: Date.now() + Math.max(60, ttl - 60) * 1000 };
    return { ok: true, token };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "ارتباط با اسنپ‌پی برقرار نشد.",
    };
  }
}

/** Drops the cached JWT - used by the check tool. */
export const forgetToken = () => {
  cached = null;
};

// ── Envelope (doc p.4) ───────────────────────────────────────────────

/**
 * Every endpoint answers `{successful, response}` or `{successful, errorData}`.
 * HTTP 200 alone means nothing - `successful` is the real answer.
 */
type Envelope = { successful?: boolean; response?: unknown; errorData?: unknown };

type CallResult =
  | { ok: true; response: Record<string, unknown> }
  | { ok: false; error: string; code?: number; timedOut?: boolean };

async function call(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  opts: { retryOn401?: boolean; timeoutMs?: number; retriesOn1053?: number } = {}
): Promise<CallResult> {
  const { retryOn401 = true, timeoutMs = TIMEOUT_MS, retriesOn1053 = 2 } = opts;
  const auth = await accessToken();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const res = await fetch(`${snapppayBase()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${auth.token}`,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    // A JWT can expire mid-session; get a fresh one and go round once.
    if (res.status === 401 && retryOn401) {
      forgetToken();
      return call(method, path, body, { ...opts, retryOn401: false });
    }

    const data = (await res.json().catch(() => null)) as Envelope | null;
    if (!data) {
      return { ok: false, error: `پاسخ نامعتبر از اسنپ‌پی (HTTP ${res.status})` };
    }

    if (data.successful === true) {
      return {
        ok: true,
        response: (data.response ?? {}) as Record<string, unknown>,
      };
    }

    const err = (data.errorData ?? {}) as Record<string, unknown>;
    const code = Number(err.errorCode ?? 0);
    const message = typeof err.message === "string" ? err.message : "";

    // 1053 means «the previous call is still in flight» - the documented fix is
    // simply to wait a moment and ask again, so it is retried here rather than
    // surfaced to an admin who can only do the same thing by hand.
    if (code === ONGOING_PROCESS && retriesOn1053 > 0) {
      await sleep(3_000);
      return call(method, path, body, { ...opts, retriesOn1053: retriesOn1053 - 1 });
    }

    return {
      ok: false,
      code,
      error:
        SNAPPPAY_ERROR_FA[code] ??
        (message || `درخواست اسنپ‌پی ناموفق بود (HTTP ${res.status}).`),
    };
  } catch (err) {
    // A timeout is not the same as a refusal: the doc's verify/settle recovery
    // hangs on telling them apart, so it is flagged rather than flattened.
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return {
      ok: false,
      timedOut,
      error: timedOut
        ? "اسنپ‌پی در مهلت مقرر پاسخ نداد."
        : err instanceof Error
          ? err.message
          : "ارتباط با اسنپ‌پی برقرار نشد.",
    };
  }
}

// ── Check merchant eligibility (doc p.6–7) ───────────────────────────

export type EligibleResult =
  | { ok: true; eligible: boolean; title?: string; description?: string }
  | { ok: false; error: string };

/**
 * Whether اسنپ‌پی will finance a basket of this size, and - when it will - the
 * exact wording to show.
 *
 * The doc is unusually strict about this one (FAQ 6): the option may only be
 * shown when this answers true, `title_message` and `description` must be
 * rendered **verbatim and unchanged**, nothing may be hard-coded on our side,
 * and the service has to be called again on every change of amount because the
 * instalment figures are computed dynamically. Staging refuses baskets under
 * ۴٬۰۰۰ تومان and over ۱۰٬۰۰۰٬۰۰۰ تومان (measured 2026-09-07); production uses
 * different limits, which is precisely why we must never guess them locally.
 */
export async function eligible(
  amountRial: number,
  paymentMethodTypes?: Array<"POSTPAID" | "INSTALLMENT" | "FINANCING">
): Promise<EligibleResult> {
  const q = new URLSearchParams({ amount: String(Math.round(amountRial)) });
  if (paymentMethodTypes?.length) q.set("paymentMethodTypes", paymentMethodTypes.join(","));

  const res = await call("GET", `/api/online/offer/v1/eligible?${q.toString()}`);
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    eligible: res.response.eligible === true,
    title: typeof res.response.title_message === "string" ? res.response.title_message : undefined,
    description:
      typeof res.response.description === "string" ? res.response.description : undefined,
  };
}

// ── Cart arithmetic (doc p.14) ───────────────────────────────────────

export type SnappPayCartItem = {
  id: string | number;
  name: string;
  /** Unit price in Rial, before any order-level discount (doc p.14). */
  amountRial: number;
  count: number;
  category: string;
  /**
   * Commission bucket agreed in the contract. The doc marks it mandatory and
   * says to send 100 when the shop has no per-category split, which is our case
   * - MOAI sells one category.
   */
  commissionType?: number;
};

export type SnappPayBasket = {
  items: SnappPayCartItem[];
  discountRial?: number;
  shippingRial?: number;
  taxRial?: number;
  /** paid from a wallet/gift card alongside the instalments; we never use it */
  externalSourceRial?: number;
};

const DEFAULT_COMMISSION_TYPE = 100;

/**
 * The one piece of arithmetic SnappPay checks by hand during certification
 * («محاسبات شما طبق این فرمول باشد»), so it lives in exactly one place:
 *
 *   totalAmount = Σ(cart items) + shipping + tax        ← BEFORE the discount
 *   amount      = totalAmount − (discount + externalSource)
 *
 * The distinction matters the moment a coupon is used. MOAI stores
 * `order.total` already net of the discount, so passing it as `totalAmount`
 * would understate the basket by exactly the discount and leave `amount` and
 * `totalAmount` equal - which is only ever correct for an order with no coupon.
 */
export function buildCartList(basket: SnappPayBasket) {
  const discountAmount = Math.max(0, Math.round(basket.discountRial ?? 0));
  const shippingAmount = Math.max(0, Math.round(basket.shippingRial ?? 0));
  const taxAmount = Math.max(0, Math.round(basket.taxRial ?? 0));
  const externalSourceAmount = Math.max(0, Math.round(basket.externalSourceRial ?? 0));

  const cartItems = basket.items.map((i) => ({
    id: i.id,
    name: i.name,
    amount: Math.round(i.amountRial),
    count: i.count,
    category: i.category,
    commissionType: i.commissionType ?? DEFAULT_COMMISSION_TYPE,
  }));

  const goods = cartItems.reduce((s, i) => s + i.amount * i.count, 0);
  const totalAmount = goods + shippingAmount + taxAmount;
  const amount = totalAmount - (discountAmount + externalSourceAmount);

  return {
    amount,
    totalAmount,
    discountAmount,
    externalSourceAmount,
    cartList: [
      {
        cartId: 1,
        // SnappPay certification explicitly requires both flags to be true.
        // Shipping and tax still remain explicit fields and are included in
        // totalAmount rather than being folded into each item's unit price.
        isShipmentIncluded: true,
        isTaxIncluded: true,
        shippingAmount,
        taxAmount,
        totalAmount,
        cartItems,
      },
    ],
  };
}

// ── Get payment token (doc p.10–14) ──────────────────────────────────

export type TokenResult =
  | { ok: true; paymentToken: string; paymentPageUrl: string; amountRial: number }
  | { ok: false; error: string; code?: number };

/**
 * مرحله ۱ - دریافت توکن پرداخت.
 *
 * `transactionId` must be unique per purchase attempt in our system; the doc
 * asks for 5–10 characters and a letter if it runs to ten, which is what
 * `newTransactionRef()` produces. It is the handle SnappPay and the shop share:
 * it comes back on the callback, it is what the buyer is shown, and it is what
 * the admin searches by. Re-using one is refused with 1009.
 */
export async function paymentToken(args: {
  transactionId: string;
  returnURL: string;
  mobile: string;
  forcedPaymentMethodTypes?: Array<"POSTPAID" | "INSTALLMENT" | "FINANCING">;
} & SnappPayBasket): Promise<TokenResult> {
  if (!isValidSnappMobile(args.mobile)) {
    return { ok: false, error: "شماره موبایل برای اسنپ‌پی معتبر نیست." };
  }

  const cart = buildCartList(args);

  const res = await call("POST", "/api/online/payment/v1/token", {
    amount: cart.amount,
    mobile: toSnappMobile(args.mobile),
    returnURL: args.returnURL,
    transactionId: args.transactionId,
    discountAmount: cart.discountAmount,
    externalSourceAmount: cart.externalSourceAmount,
    cartList: cart.cartList,
    ...(args.forcedPaymentMethodTypes?.length
      ? { forcedPaymentMethodTypes: args.forcedPaymentMethodTypes }
      : {}),
  });

  if (!res.ok) return { ok: false, error: res.error, code: res.code };

  const token = typeof res.response.paymentToken === "string" ? res.response.paymentToken : "";
  const pageUrl =
    typeof res.response.paymentPageUrl === "string" ? res.response.paymentPageUrl : "";

  if (!token || !pageUrl) {
    return { ok: false, error: "اسنپ‌پی توکن پرداخت برنگرداند." };
  }
  return { ok: true, paymentToken: token, paymentPageUrl: pageUrl, amountRial: cart.amount };
}

// ── verify / settle / revert / cancel (doc p.15–22) ──────────────────

export type TxResult =
  | { ok: true; transactionId: string }
  | { ok: false; error: string; code?: number; timedOut?: boolean };

/** The four one-field endpoints differ only in their path. */
const byToken = async (
  path: string,
  paymentToken: string,
  timeoutMs = TIMEOUT_MS
): Promise<TxResult> => {
  const res = await call("POST", path, { paymentToken }, { timeoutMs });
  if (!res.ok) return { ok: false, error: res.error, code: res.code, timedOut: res.timedOut };
  return {
    ok: true,
    transactionId:
      typeof res.response.transactionId === "string" ? res.response.transactionId : "",
  };
};

/**
 * مرحله ۲ - تایید. Confirms the withdrawal actually happened. Nothing is
 * marked paid until this says so: the callback itself is unauthenticated and
 * cannot be used as proof of payment. Not calling it inside SnappPay's window
 * hands the money back to the buyer automatically (p.9).
 */
export const verify = (paymentToken: string) =>
  byToken("/api/online/payment/v1/verify", paymentToken, VERIFY_TIMEOUT_MS);

/**
 * مرحله ۳ - تسویه. Finalises the purchase; after this it can no longer be
 * reverted, only cancelled. The doc requires it for every verified order, so it
 * is called straight after a successful verify rather than batched.
 */
export const settle = (paymentToken: string) =>
  byToken("/api/online/payment/v1/settle", paymentToken);

/**
 * برگشت تراکنش - the counterpart to verify. Called whenever the purchase is not
 * going to be honoured: state=FAILED, a verify that never succeeded, or an
 * amount that doesn't match the invoice. Impossible after settle.
 */
export const revert = (paymentToken: string) =>
  byToken("/api/online/payment/v1/revert", paymentToken);

/**
 * مرجوعی کامل - after a successful settle, undoes the whole purchase.
 * Irreversible, so the admin UI must confirm before calling it (doc p.22).
 */
export const cancel = (paymentToken: string) =>
  byToken("/api/online/payment/v1/cancel", paymentToken);

// ── Update - partial refund (doc p.23–25) ────────────────────────────

/**
 * مرجوعی جزئی - the basket after the admin has removed items or reduced
 * quantities. Only valid on a settled order, only downwards (1042 refuses a
 * larger amount), and an item removed entirely must disappear from `cartItems`
 * rather than linger at count 0. Irreversible, so the admin UI confirms first.
 *
 * `mobile` is required here as well; the error table lists a missing mobile
 * among the causes of 1005 on this endpoint.
 */
export async function update(
  args: { paymentToken: string; mobile: string } & SnappPayBasket
): Promise<TxResult & { amountRial?: number }> {
  if (!isValidSnappMobile(args.mobile)) {
    return { ok: false, error: "شماره موبایل برای اسنپ‌پی معتبر نیست." };
  }
  const cart = buildCartList(args);
  if (cart.cartList[0].cartItems.length === 0) {
    return {
      ok: false,
      error: "برای مرجوعی کامل باید سفارش را لغو کنید، نه این‌که همهٔ اقلام را حذف کنید.",
    };
  }

  const res = await call("POST", "/api/online/payment/v1/update", {
    amount: cart.amount,
    mobile: toSnappMobile(args.mobile),
    paymentToken: args.paymentToken,
    discountAmount: cart.discountAmount,
    externalSourceAmount: cart.externalSourceAmount,
    cartList: cart.cartList,
  });

  if (!res.ok) return { ok: false, error: res.error, code: res.code, timedOut: res.timedOut };
  return {
    ok: true,
    amountRial: cart.amount,
    transactionId:
      typeof res.response.transactionId === "string" ? res.response.transactionId : "",
  };
}

// ── Get Payment Status (doc p.19) ────────────────────────────────────

/** The five states an attempt can be in, per doc p.21. */
export type SnappPayStatus = "PENDING" | "VERIFY" | "SETTLE" | "REVERT" | "CANCEL";

export type StatusResult =
  | { ok: true; transactionId: string; status: SnappPayStatus | ""; amountRial: number | null }
  | { ok: false; error: string; code?: number };

/**
 * استعلام وضعیت - the authority whenever our own record might have drifted from
 * SnappPay's: a callback that never arrived, a verify that timed out, a settle
 * that answered false. The doc requires this to be wired into the code itself
 * rather than left to a human («بصورت خودکار در کد … الزامی می‌باشد»), which is
 * what `finalize()` does with it.
 */
export async function paymentStatus(paymentToken: string): Promise<StatusResult> {
  const res = await call(
    "GET",
    `/api/online/payment/v1/status?paymentToken=${encodeURIComponent(paymentToken)}`
  );
  if (!res.ok) return { ok: false, error: res.error, code: res.code };

  const raw = typeof res.response.status === "string" ? res.response.status.toUpperCase() : "";
  const known: SnappPayStatus[] = ["PENDING", "VERIFY", "SETTLE", "REVERT", "CANCEL"];
  const amount = Number(res.response.amount);

  return {
    ok: true,
    transactionId:
      typeof res.response.transactionId === "string" ? res.response.transactionId : "",
    status: (known as string[]).includes(raw) ? (raw as SnappPayStatus) : "",
    amountRial: Number.isFinite(amount) ? amount : null,
  };
}

// ── verify + settle, with the documented recovery paths (doc p.20–21) ─

export type FinalizeResult = {
  /** the buyer's credit was actually taken and confirmed */
  verified: boolean;
  /** the purchase is finished and the shop will be paid */
  settled: boolean;
  /** SnappPay's own transaction id, for the receipt and the admin panel */
  transactionId: string;
  /** what SnappPay last said the attempt's state was, when we had to ask */
  status?: SnappPayStatus | "";
  /**
   * اسنپ‌پی has already put the money back. The callback must NOT revert again - 
   * and must not treat the attempt as a sale.
   */
  reverted?: boolean;
  /** set when the attempt did not end verified - safe to show to a buyer */
  error?: string;
  /** every step taken, in order - written to the log for disputes */
  trail: string[];
};

/**
 * The whole «مدیریت درخواست VERIFY / SETTLE» flow from p.20–21, in code:
 *
 *   verify (30s)
 *     ├─ ok ──────────────────────────────► settle
 *     └─ timeout / failure ─► status ─┬─ VERIFY  ► settle
 *                                     ├─ PENDING ► verify again (once)
 *                                     ├─ SETTLE  ► already finished
 *                                     └─ other   ► treat the order as failed
 *   settle
 *     └─ false / no answer ─► status ─┬─ VERIFY  ► settle again (once)
 *                                     ├─ SETTLE  ► finished after all
 *                                     └─ other   ► verified but unsettled
 *
 * A verified-but-unsettled attempt is deliberately NOT a failure: the buyer's
 * credit is already spent and the goods are owed either way. It is recorded
 * with a null `settledAt` so tools/snapppaycheck.mjs can finish the job.
 */
export async function finalize(paymentToken: string): Promise<FinalizeResult> {
  const trail: string[] = [];
  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > FINALIZE_BUDGET_MS;
  let transactionId = "";
  let lastStatus: SnappPayStatus | "" | undefined;

  const askStatus = async () => {
    const s = await paymentStatus(paymentToken);
    if (!s.ok) {
      trail.push(`status→خطا: ${s.error}`);
      return null;
    }
    lastStatus = s.status;
    if (s.transactionId) transactionId = s.transactionId;
    trail.push(`status→${s.status || "؟"}`);
    return s;
  };

  // ── مرحله verify ────────────────────────────────────────────
  let verified = false;
  const first = await verify(paymentToken);
  trail.push(first.ok ? "verify→ok" : `verify→${first.timedOut ? "timeout" : first.error}`);
  if (first.ok) {
    verified = true;
    if (first.transactionId) transactionId = first.transactionId;
  } else {
    const s = await askStatus();
    if (s) {
      if (s.status === "VERIFY") {
        verified = true;
      } else if (s.status === "SETTLE") {
        // Nothing left to do - it finished without us hearing about it.
        return { verified: true, settled: true, transactionId, status: s.status, trail };
      } else if (s.status === "REVERT" || s.status === "CANCEL") {
        // Already given back - nothing to verify and nothing to revert again.
        return {
          verified: false,
          settled: false,
          transactionId,
          status: s.status,
          reverted: true,
          error: "مبلغ این تراکنش به اعتبار اسنپ‌پی برگشت خورده است.",
          trail,
        };
      } else if (s.status === "PENDING" && !outOfTime()) {
        const again = await verify(paymentToken);
        trail.push(again.ok ? "verify(2)→ok" : `verify(2)→${again.error}`);
        if (again.ok) {
          verified = true;
          if (again.transactionId) transactionId = again.transactionId;
        }
      }
    }
  }

  if (!verified) {
    return {
      verified: false,
      settled: false,
      transactionId,
      status: lastStatus,
      error: first.ok ? "تأیید تراکنش اسنپ‌پی انجام نشد." : first.error,
      trail,
    };
  }

  // ── مرحله settle ────────────────────────────────────────────
  let settled = false;
  const firstSettle = await settle(paymentToken);
  trail.push(firstSettle.ok ? "settle→ok" : `settle→${firstSettle.error}`);
  if (firstSettle.ok) {
    settled = true;
    if (firstSettle.transactionId) transactionId = firstSettle.transactionId;
  } else {
    const s = await askStatus();
    if (s?.status === "SETTLE") {
      settled = true;
    } else if (s?.status === "VERIFY" && !outOfTime()) {
      const again = await settle(paymentToken);
      trail.push(again.ok ? "settle(2)→ok" : `settle(2)→${again.error}`);
      if (again.ok) {
        settled = true;
        if (again.transactionId) transactionId = again.transactionId;
      }
    } else if (s?.status === "REVERT" || s?.status === "CANCEL") {
      // The withdrawal has been undone - by us, or by اسنپ‌پی itself, which
      // reverses a purchase that was not settled inside its window (p.9). The
      // buyer has their credit back and owes nothing, so this is NOT a
      // verified-but-unsettled sale: reporting it as one would mark the order
      // paid and ship goods against money that is no longer there.
      return {
        verified: false,
        settled: false,
        transactionId,
        status: s.status,
        reverted: true,
        error: "مبلغ این تراکنش به اعتبار اسنپ‌پی برگشت خورده است.",
        trail,
      };
    }
  }

  return { verified: true, settled, transactionId, status: lastStatus, trail };
}

// ── Our side of the shared transaction id (doc p.8) ──────────────────

/**
 * «تراکنش آیدی باید بین ۵ تا ۱۰ رقم باشد. (برای موارد ۱۰ رقم به بالا حتما از یک
 * حرف در آن استفاده شود)» - and it has to be unique per attempt, since a repeat
 * is refused with 1009.
 *
 * A cuid would technically be accepted (staging takes one), but this value is
 * read aloud on support calls, printed on the buyer's receipt and typed into
 * the admin search box, so it is kept to nine digits.
 *
 * Uniqueness is enforced by the unique index on `Payment.resNum`; the caller
 * retries on collision.
 */
export const newTransactionRef = () =>
  String(Math.floor(100_000_000 + Math.random() * 900_000_000));
