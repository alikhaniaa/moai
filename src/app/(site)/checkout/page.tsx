import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getShippingMethods } from "@/lib/coupon";
import { digipayEnabled } from "@/lib/digipay";
import { snapppayEnabledFor } from "@/lib/snapppay-api";
import { getSettings } from "@/lib/settings";
import CheckoutForm from "@/components/CheckoutForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "تسویه حساب" };

export default async function CheckoutPage() {
  const [user, methods, settings] = await Promise.all([
    getSessionUser(),
    getShippingMethods(),
    getSettings(),
  ]);

  const [firstName = "", ...rest] = (user?.name ?? "").trim().split(" ");

  return (
    <section className="mx-auto max-w-6xl px-6 pb-24 pt-32 md:px-8 md:pt-40">
      <div className="eyebrow">یک قدم تا دریا…</div>
      <h1 className="font-display text-4xl font-bold text-sea-900 md:text-6xl">تسویه حساب</h1>

      {!user ? (
        <div className="card mt-10 flex flex-col items-center gap-5 p-12 text-center">
          <span className="text-5xl">🔐</span>
          <p className="max-w-sm leading-8 text-ink/82">
            برای ثبت سفارش اول با شماره موبایلت وارد شو — عضویت همان لحظه و رایگان
            انجام می‌شود و امتیاز باشگاه هم می‌گیری.
          </p>
          <Link href="/login?next=/checkout" className="btn btn-primary">
            ورود / عضویت با کد یکبارمصرف
          </Link>
        </div>
      ) : (
        <CheckoutForm
          defaults={{
            firstName,
            lastName: rest.join(" "),
            phone: user.phone,
            email: user.email ?? "",
            province: user.province ?? "",
            city: user.city ?? "",
            address: user.address ?? "",
            unit: user.unit ?? "",
            postalCode: user.postalCode ?? "",
          }}
          methods={methods}
          digipay={digipayEnabled()}
          snapppay={snapppayEnabledFor(user.phone)}
          whatsapp={settings.shopWhatsapp}
          snapppayNote={settings.snapppayNote}
        />
      )}
    </section>
  );
}
