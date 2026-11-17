import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { toman, faNum } from "@/lib/format";
import { pointsForOrder } from "@/lib/club";
import { getClubConfig } from "@/lib/club-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "نتیجه پرداخت" };

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  const user = await getSessionUser();
  if (!user || !orderId) redirect("/");

  const order = await db.order.findFirst({
    where: { id: orderId, userId: user.id },
    include: { items: true, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) redirect("/");
  // Manual orders have their own result pages; this one talks about the bank.
  if (order.paymentMethod === "SNAPPPAY") redirect(`/checkout/snapppay/${order.id}`);
  if (order.paymentMethod === "CARD") redirect(`/checkout/transfer/${order.id}`);
  const { pointsPer100k } = await getClubConfig();

  const paid = order.status !== "AWAITING_PAYMENT";
  const last = order.payments[0];
  const settling = !paid && order.payments.some((p) =>
    p.provider === "SNAPPPAY" && ["VERIFYING", "SETTLEMENT_PENDING"].includes(p.status)
  );
  const code = order.id.slice(-8).toUpperCase();
  // اسنپ‌پی's certification asks that the buyer see the transaction id shared
  // between shop and gateway once the purchase succeeds. That id is `resNum` - 
  // the number we minted and sent as `transactionId` - so it is the one handle
  // both sides can look a purchase up by. The bank's own RRN below stays where
  // it is; a SEP or دیجی‌پی attempt never reaches this branch.
  // The PAID اسنپ‌پی attempt, which is not necessarily the newest row: opening
  // the payment link in a second tab writes another PENDING attempt, and that
  // one would otherwise hide the transaction id on the receipt of the purchase
  // that actually went through.
  const snapp = paid
    ? (order.payments.find((p) => p.provider === "SNAPPPAY" && p.status === "PAID") ?? null)
    : null;

  return (
    <section className="mx-auto max-w-3xl px-6 pb-24 pt-36 text-center md:px-8">
      <div
        className={`mx-auto grid h-20 w-20 place-items-center rounded-full text-4xl ${
          paid ? "bg-sea-100" : "bg-clay-300/25"
        }`}
      >
        {paid ? "🎉" : "😕"}
      </div>

      <h1 className="mt-6 font-display text-4xl font-bold text-sea-900 md:text-5xl">
        {paid ? "پرداخت با موفقیت انجام شد!" : settling ? "پرداخت در حال بررسی است" : "پرداخت کامل نشد"}
      </h1>

      {paid ? (
        <p className="mx-auto mt-4 max-w-md leading-8 text-ink/82">
          سفارشت ثبت و پرداخت شد. کد پیگیری:{" "}
          <span className="font-bold text-clay-600" dir="ltr">{code}</span>
          {/* Second line rather than the receipt card alone: the id has to be
              readable without scrolling on a phone. */}
          {snapp && (
            <>
              <br />
              شناسه تراکنش اسنپ‌پی:{" "}
              <span className="select-all font-bold tracking-wider text-[#0062c4]" dir="ltr">
                {snapp.resNum}
              </span>
            </>
          )}
          <br />
          به‌زودی برای هماهنگی ارسال با تو تماس می‌گیریم.
          {order.pointsAwarded && (
            <>
              <br />
              <span className="text-sea-700">
                🐚 {faNum(pointsForOrder(order.total, pointsPer100k))} امتیاز باشگاه به حسابت اضافه شد.
              </span>
            </>
          )}
        </p>
      ) : (
        <>
          <p className="mx-auto mt-4 max-w-md leading-8 text-ink/82">
            سفارشت با کد <span className="font-bold text-clay-600" dir="ltr">{code}</span>{" "}
            {settling ? "ثبت شده و نتیجهٔ نهایی پرداخت در حال بررسی است. لطفاً دوباره پرداخت نکن." : "ثبت شده و منتظر پرداخت است."}
          </p>
          {last?.message && (
            <p className="mx-auto mt-4 max-w-md rounded-2xl bg-red-50 px-5 py-3 text-sm leading-7 text-red-700">
              {last.message}
            </p>
          )}
        </>
      )}

      <div className="card mx-auto mt-10 max-w-md p-6 text-right">
        <ul className="space-y-3 text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between">
              <span className="text-ink/80">
                {i.nameFa}
                {i.sizeLabel && <span className="text-sea-700"> — سایز {i.sizeLabel}</span>}
                {i.colorName && <span className="text-clay-700"> — رنگ {i.colorName}</span>}
                {" "}× {faNum(i.qty)}
              </span>
              <span className="font-semibold text-sea-900">{toman(i.unitPrice * i.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-sand-200 pt-4">
          <span className="font-bold">جمع کل</span>
          <span className="price-lg text-sea-900">{toman(order.total)}</span>
        </div>
        {paid && last?.rrn && (
          <div className="mt-3 flex justify-between border-t border-sand-200 pt-3 text-xs text-ink/68">
            <span>شماره مرجع بانکی</span>
            <span dir="ltr">{last.rrn}</span>
          </div>
        )}
        {snapp && (
          <div className="mt-3 flex justify-between border-t border-sand-200 pt-3 text-xs text-ink/68">
            <span>شناسه تراکنش اسنپ‌پی</span>
            {/* select-all so one tap picks the whole number up, the way the
                card-to-card box does it */}
            <span className="select-all font-bold tracking-wider text-[#0062c4]" dir="ltr">
              {snapp.resNum}
            </span>
          </div>
        )}
        {/* Usually the same number echoed back; shown only when اسنپ‌پی
            answered verify with an id of its own. */}
        {snapp?.refNum && snapp.refNum !== snapp.resNum && (
          <div className="mt-3 flex justify-between border-t border-sand-200 pt-3 text-xs text-ink/68">
            <span>شماره مرجع اسنپ‌پی</span>
            <span className="select-all" dir="ltr">{snapp.refNum}</span>
          </div>
        )}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        {paid ? (
          <>
            <Link href="/account" className="btn btn-primary">پیگیری سفارش</Link>
            <Link href="/products" className="btn btn-ghost">ادامه خرید</Link>
          </>
        ) : (
          <>
            {!settling && <Link href={`/checkout/pay/${order.id}`} className="btn btn-primary">
              تلاش دوباره برای پرداخت
            </Link>}
            <a
              href={`https://wa.me/989121230000?text=${encodeURIComponent(`سلام! درباره سفارش ${code} سوال داشتم.`)}`}
              target="_blank"
              rel="noopener"
              className="btn btn-ghost"
            >
              راهنمایی در واتس‌اپ
            </a>
          </>
        )}
      </div>
    </section>
  );
}
