import "server-only";

/**
 * SMS.ir verification (OTP) sender.
 *
 * Uses the "verify" endpoint, which delivers a templated one-time code to any
 * number (no prior opt-in needed). The template and its `CODE` variable are
 * created in the SMS.ir panel → برنامه‌نویسان → لیست قالب‌ها.
 *
 * Activates only when SMS_API_KEY and SMS_TEMPLATE_ID are both set, so the site
 * keeps working (with the on-screen preview code) until the template is approved.
 */
const ENDPOINT = "https://api.sms.ir/v1/send/verify";

export const smsConfigured = () =>
  !!process.env.SMS_API_KEY?.trim() && !!process.env.SMS_TEMPLATE_ID?.trim();

export type SmsResult = { ok: true } | { ok: false; error: string };

export async function sendOtp(phone: string, code: string): Promise<SmsResult> {
  const apiKey = process.env.SMS_API_KEY?.trim();
  const templateId = Number(process.env.SMS_TEMPLATE_ID?.trim());
  const paramName = process.env.SMS_PARAM_NAME?.trim() || "CODE";

  if (!apiKey || !templateId) {
    return { ok: false, error: "سرویس پیامک تنظیم نشده است." };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        mobile: phone,
        templateId,
        parameters: [{ name: paramName, value: code }],
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });

    const data = (await res.json().catch(() => ({}))) as {
      status?: number;
      message?: string;
    };

    // SMS.ir returns status 1 on success
    if (res.ok && Number(data.status) === 1) return { ok: true };

    console.error("[SMS.ir] send failed:", res.status, data);
    return { ok: false, error: data.message || "ارسال پیامک ناموفق بود." };
  } catch (err) {
    console.error("[SMS.ir] request error:", err);
    return { ok: false, error: "ارتباط با سرویس پیامک برقرار نشد." };
  }
}
