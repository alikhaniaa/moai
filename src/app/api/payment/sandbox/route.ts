import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sepSandbox } from "@/lib/sep";
import { toman } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * درگاه شبیه‌سازی‌شده - a stand-in for the SEP payment page.
 *
 * Exists only so the whole purchase flow (token → gateway → callback → verify)
 * can be exercised before the production server's IP is registered with SEP.
 * Disabled unless SEP_SANDBOX=1.
 */
export async function POST(req: Request) {
  if (!sepSandbox()) return new NextResponse("Not found", { status: 404 });

  const form = await req.formData();
  const resNum = String(form.get("Token") ?? "");
  const payment = await db.payment.findUnique({ where: { resNum } });
  if (!payment) return new NextResponse("پرداخت یافت نشد", { status: 404 });

  const site = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const amount = toman(Math.round(payment.amountRial / 10));

  const html = `<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>درگاه آزمایشی پرداخت</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f2c28;
       font-family:system-ui,sans-serif;color:#1b211e;padding:24px}
  .card{background:#fff;border-radius:24px;padding:36px;max-width:420px;width:100%;
        box-shadow:0 30px 60px -20px rgba(0,0,0,.5)}
  h1{margin:0 0 6px;font-size:20px}
  .muted{color:#6b7280;font-size:13px;margin:0 0 22px}
  .row{display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid #eee;font-size:14px}
  .amt{font-weight:800;font-size:20px;color:#0f2c28}
  .warn{background:#fef3c7;border:1px dashed #d1a13a;color:#7c3e26;border-radius:12px;
        padding:10px 14px;font-size:12px;line-height:1.9;margin:18px 0}
  button{width:100%;padding:14px;border:0;border-radius:999px;font-size:15px;font-weight:700;
         cursor:pointer;font-family:inherit;margin-top:10px}
  .pay{background:#bc6c4a;color:#fff}
  .cancel{background:#f3f4f6;color:#374151}
</style></head><body>
<div class="card">
  <h1>درگاه پرداخت آزمایشی</h1>
  <p class="muted">شبیه‌سازی پرداخت الکترونیک سامان (سپ)</p>
  <div class="row"><span>پذیرنده</span><b>موآی گالری</b></div>
  <div class="row"><span>شماره پیگیری</span><span dir="ltr">${resNum.slice(-10)}</span></div>
  <div class="row"><span>مبلغ</span><span class="amt">${amount}</span></div>
  <div class="warn">🔧 این صفحه واقعی نیست و هیچ پولی جابه‌جا نمی‌شود. برای اتصال به
    بانک، در فایل .env مقدار SEP_SANDBOX را ۰ کن.</div>
  <form method="post" action="${site}/api/payment/callback">
    <input type="hidden" name="ResNum" value="${resNum}">
    <input type="hidden" name="RefNum" value="SBX-${resNum.slice(-12)}">
    <input type="hidden" name="State" value="OK">
    <input type="hidden" name="Status" value="2">
    <input type="hidden" name="TraceNo" value="${Math.floor(Math.random() * 900000 + 100000)}">
    <input type="hidden" name="RRN" value="${Math.floor(Math.random() * 9e10 + 1e10)}">
    <input type="hidden" name="SecurePan" value="621986****8080">
    <button class="pay" type="submit">پرداخت موفق</button>
  </form>
  <form method="post" action="${site}/api/payment/callback">
    <input type="hidden" name="ResNum" value="${resNum}">
    <input type="hidden" name="State" value="CanceledByUser">
    <input type="hidden" name="Status" value="1">
    <button class="cancel" type="submit">انصراف از پرداخت</button>
  </form>
</div></body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
