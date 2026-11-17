import "server-only";

/**
 * پرداخت الکترونیک سامان (SEP) - internet payment gateway client.
 * Implemented from the official "راهنمای استفاده از درگاه پرداخت اینترنتی" v3.6.
 *
 * Flow: requestToken() → browser POSTs the token to SEP_PAY_URL (form, so the
 * Referrer header is sent - SEP rejects entries without it) → SEP POSTs the
 * result back to our callback → verifyTransaction() confirms it.
 *
 * Two rules the callback route enforces: never trust the callback body for
 * amounts, and never let one RefNum settle two orders.
 */

export const SEP_PAY_URL = "https://sep.shaparak.ir/OnlinePG/OnlinePG";
const SEP_TOKEN_URL = "https://sep.shaparak.ir/onlinepg/onlinepg";
const SEP_VERIFY_URL =
  "https://sep.shaparak.ir/verifyTxnRandomSessionkey/ipg/VerifyTransaction";
const SEP_REVERSE_URL =
  "https://sep.shaparak.ir/verifyTxnRandomSessionkey/ipg/ReverseTransaction";

/** Prices are stored in Toman; SEP expects Rial. */
export const tomanToRial = (toman: number) => toman * 10;

export const sepTerminalId = () => process.env.SEP_TERMINAL_ID?.trim() ?? "";

/** Local fake gateway, so the whole flow is testable before the server IP is whitelisted. */
export const sepSandbox = () => process.env.SEP_SANDBOX === "1";

const post = async (url: string, body: unknown) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
    cache: "no-store",
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`پاسخ نامعتبر از درگاه (HTTP ${res.status})`);
  }
};

/** وضعیت تراکنش - status codes from the doc's جدول وضعیت تراکنش (page 14). */
export const SEP_STATE_FA: Record<string, string> = {
  CanceledByUser: "پرداخت توسط شما لغو شد.",
  OK: "پرداخت با موفقیت انجام شد.",
  Failed: "پرداخت انجام نشد.",
  SessionIsNull: "زمان پرداخت به پایان رسید.",
  InvalidParameters: "اطلاعات ارسالی به درگاه نامعتبر بود.",
  MerchantIpAddressIsInvalid: "آدرس سرور فروشگاه نزد بانک مجاز نیست.",
  TokenNotFound: "توکن پرداخت یافت نشد.",
  TokenRequired: "این ترمینال فقط تراکنش توکنی می‌پذیرد.",
  TerminalNotFound: "شماره ترمینال یافت نشد.",
  MultisettlePolicyErrors: "محدودیت‌های مدل چند حسابی رعایت نشده است.",
};

/** ResultCode meanings for verify/reverse (page 19). */
export const SEP_VERIFY_RESULT_FA: Record<number, string> = {
  0: "موفق",
  2: "درخواست تکراری",
  5: "تراکنش برگشت خورده است.",
  [-2]: "تراکنش یافت نشد.",
  [-6]: "بیش از نیم ساعت از زمان تراکنش گذشته است.",
  [-104]: "ترمینال غیرفعال است.",
  [-105]: "ترمینال در سیستم موجود نیست.",
  [-106]: "آی‌پی درخواستی غیرمجاز است.",
};

export type TokenResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

/**
 * مرحله ۱ - دریافت توکن.
 * NOTE: SEP only issues tokens to IPs registered on the merchant profile.
 */
export async function requestToken(args: {
  amountRial: number;
  resNum: string;
  redirectUrl: string;
  cellNumber?: string;
}): Promise<TokenResult> {
  const terminalId = sepTerminalId();
  if (!terminalId) return { ok: false, error: "شماره ترمینال تنظیم نشده است." };

  // Field names are case-sensitive per the doc (نکته ۴, page 27).
  const payload: Record<string, unknown> = {
    action: "token",
    TerminalId: terminalId,
    Amount: args.amountRial,
    ResNum: args.resNum,
    RedirectUrl: args.redirectUrl,
  };
  // Optional: lets the buyer pick a saved card. SEP wants it without the leading 0.
  if (args.cellNumber) payload.CellNumber = args.cellNumber.replace(/^0/, "");

  try {
    const data = await post(SEP_TOKEN_URL, payload);
    if (Number(data.status) === 1 && typeof data.token === "string") {
      return { ok: true, token: data.token };
    }
    const desc = typeof data.errorDesc === "string" ? data.errorDesc : "";
    const code = data.errorCode ? ` (کد ${data.errorCode})` : "";
    return { ok: false, error: `${desc || "دریافت توکن پرداخت ناموفق بود."}${code}` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "ارتباط با درگاه برقرار نشد.",
    };
  }
}

export type VerifyResult =
  | {
      ok: true;
      amountRial: number; // OrginalAmount - must be compared with what we charged
      affectiveAmountRial: number;
      rrn?: string;
      maskedPan?: string;
      traceNo?: string;
      duplicate: boolean; // ResultCode 2 = already verified earlier
    }
  | { ok: false; error: string; resultCode?: number };

/** مرحله ۲ - تایید تراکنش. Must run within 30 minutes or SEP auto-reverses. */
export async function verifyTransaction(refNum: string): Promise<VerifyResult> {
  try {
    const data = await post(SEP_VERIFY_URL, {
      RefNum: refNum,
      TerminalNumber: Number(sepTerminalId()),
    });

    const code = Number(data.ResultCode);
    const detail = (data.TransactionDetail ?? {}) as Record<string, unknown>;
    const success = data.Success === true && (code === 0 || code === 2);

    if (!success) {
      return {
        ok: false,
        resultCode: code,
        error:
          SEP_VERIFY_RESULT_FA[code] ??
          (typeof data.ResultDescription === "string"
            ? data.ResultDescription
            : "تایید تراکنش ناموفق بود."),
      };
    }

    return {
      ok: true,
      amountRial: Number(detail.OrginalAmount ?? 0),
      affectiveAmountRial: Number(detail.AffectiveAmount ?? detail.OrginalAmount ?? 0),
      rrn: detail.RRN ? String(detail.RRN) : undefined,
      maskedPan: detail.MaskedPan ? String(detail.MaskedPan) : undefined,
      traceNo: detail.StraceNo ? String(detail.StraceNo) : undefined,
      duplicate: code === 2,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "ارتباط با سرویس تایید برقرار نشد.",
    };
  }
}

/**
 * برگشت تراکنش - used when the verified amount doesn't match the invoice,
 * where the doc requires refunding the buyer in full.
 */
export async function reverseTransaction(refNum: string) {
  try {
    const data = await post(SEP_REVERSE_URL, {
      RefNum: refNum,
      TerminalNumber: Number(sepTerminalId()),
    });
    return { ok: data.Success === true && Number(data.ResultCode) === 0 };
  } catch {
    return { ok: false };
  }
}
