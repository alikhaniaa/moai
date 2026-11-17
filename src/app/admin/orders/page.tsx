import Link from "next/link";
import { db } from "@/lib/db";
import { toman, faNum, faDate, orderCode, ORDER_STATUS_FA, ORDER_STATUS_COLOR } from "@/lib/format";
import { setOrderStatus } from "../actions";

/**
 * The part of a search term that is safe to hand to a LIKE-backed filter.
 *
 * Prisma's SQLite connector emits a bare `LIKE ?` with no ESCAPE clause, so a
 * `%` or `_` typed into the box is a wildcard, not a character - «%» alone
 * would match every row and report the whole table as search hits. Nothing we
 * actually search by (transaction ids, order codes, phone numbers, Persian
 * names) contains either, so they are simply dropped.
 */
const likeSafe = (q: string) => q.replace(/[%_]/g, "");

/** Next hands back an array when a key repeats; take the first and move on. */
const oneParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminOrders({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[] }>;
}) {
  const { q } = (await searchParams) ?? {};
  // The code is rendered as «#A1B2C3D4», and a reviewer pastes what they see - 
  // so the hash is dropped rather than searched for.
  const query = oneParam(q)?.trim().replace(/^#/, "");
  const like = query ? likeSafe(query) : "";

  const orders = await db.order.findMany({
    where: query
      ? {
          OR: [
            // The transactionId اسنپ‌پی was handed is Payment.resNum; refNum and
            // traceNo are what it echoed back. All three are one-per-attempt
            // ids, so they are matched whole rather than as a substring.
            { payments: { some: { OR: [{ resNum: query }, { refNum: query }, { traceNo: query }] } } },
            // «#A1B2C3D4» on the card is the last ۸ characters of the cuid,
            // uppercased - and a cuid is lowercase, so it goes back down here.
            ...(like
              ? [
                  { id: { endsWith: like.toLowerCase() } },
                  { fullName: { contains: like } },
                  { phone: { contains: like } },
                ]
              : []),
            { id: query },
          ],
        }
      : {},
    include: {
      user: true,
      items: true,
      // only what the card paints - the id we sent and the one that came back
      payments: {
        select: { provider: true, status: true, resNum: true, refNum: true, traceNo: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-bold text-sea-900">سفارش‌ها</h1>
        <p className="mt-1 text-sm text-ink/68">
          {query ? `${faNum(orders.length)} نتیجه برای «${query}»` : `${faNum(orders.length)} سفارش`}
        </p>
      </div>

      {/* A plain GET form: the query ends up in the URL, so a search is a link
          the admin can keep, share or reload - nothing here needs to become a
          client component. */}
      <form method="get" className="card flex flex-wrap items-center gap-3 p-4">
        <input
          name="q"
          defaultValue={query ?? ""}
          placeholder="جستجو: شناسه تراکنش اسنپ‌پی، کد سفارش، نام یا موبایل"
          className="input min-w-0 flex-1 !py-2.5 text-sm"
        />
        <button className="btn btn-primary shrink-0 !px-6 !py-2.5 text-sm">جستجو</button>
        {query && (
          <Link href="/admin/orders" className="btn btn-ghost shrink-0 !px-5 !py-2.5 text-sm">
            همه سفارش‌ها
          </Link>
        )}
      </form>

      <div className="space-y-4">
        {orders.map((o) => {
          // the attempt اسنپ‌پی knows this order by: the one that went through if
          // there is one, otherwise the latest try
          const snapppay = o.payments.filter((p) => p.provider === "SNAPPPAY");
          // When the admin searched for a specific id, show THAT attempt - an
          // order can carry several, and printing a different number than the
          // one they just pasted reads as «wrong order».
          const tx =
            (query &&
              snapppay.find(
                (p) => p.resNum === query || p.refNum === query || p.traceNo === query
              )) ||
            snapppay.find((p) => p.status === "PAID") ||
            snapppay[0];
          return (
            <div key={o.id} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-bold text-clay-600 hover:underline" dir="ltr">#{orderCode(o.id)}</Link>
                    <span className={`chip ${ORDER_STATUS_COLOR[o.status] ?? "bg-sand-100"}`}>
                      {ORDER_STATUS_FA[o.status] ?? o.status}
                    </span>
                    {o.paymentMethod === "SNAPPPAY" && (
                      <span className="chip bg-[#007DFA]/10 text-[#0062c4]">اسنپ‌پی ۴ قسطه</span>
                    )}
                    {o.paymentMethod === "SNAPPPAY_IPG" && (
                      <span className="chip bg-[#007DFA]/10 text-[#0062c4]">اسنپ‌پی (درگاه)</span>
                    )}
                    {o.paymentMethod === "CARD" && (
                      <span className="chip bg-gold/20 text-clay-800">کارت به کارت</span>
                    )}
                    {o.paymentMethod === "DIGIPAY" && (
                      <span className="chip bg-[#003eff]/10 text-[#003eff]">دیجی‌پی</span>
                    )}
                    <span className="text-xs text-ink/60">{faDate(o.createdAt)}</span>
                  </div>
                  <div className="mt-3 text-sm leading-7 text-ink/82">
                    <b className="text-sea-900">{o.fullName}</b> · <span dir="ltr">{o.phone}</span>
                    <br />
                    {o.city}، {o.address}
                    {o.postalCode && <> · کدپستی: <span dir="ltr">{o.postalCode}</span></>}
                    {o.note && <div className="mt-1 text-xs text-clay-600">یادداشت: {o.note}</div>}
                  </div>
                  {/* the same id the اسنپ‌پی panel shows, so the admin can match
                      what they pasted in the box above against the order in
                      front of them */}
                  {tx && (
                    <div className="mt-3 text-xs leading-6 text-ink/60">
                      شناسه تراکنش اسنپ‌پی:{" "}
                      <span className="font-mono font-bold text-[#0062c4]" dir="ltr">{tx.resNum}</span>
                      {tx.refNum && tx.refNum !== tx.resNum && (
                        <>
                          {" "}· رسید اسنپ‌پی:{" "}
                          <span className="font-mono font-bold text-[#0062c4]" dir="ltr">{tx.refNum}</span>
                        </>
                      )}
                    </div>
                  )}
                  <ul className="mt-3 space-y-1 text-sm text-ink/75">
                    {o.items.map((i) => (
                      <li key={i.id}>
                        • {i.nameFa}
                        {i.sizeLabel && (
                          <b className="text-sea-700"> — سایز {i.sizeLabel}</b>
                        )}
                        {i.colorName && (
                          <b className="text-clay-700"> — رنگ {i.colorName}</b>
                        )}
                        {" "}× {faNum(i.qty)} — {toman(i.unitPrice * i.qty)}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* On a phone this drops below the details and fills the card;
                    the status dropdown is wider than a narrow screen, so it has to
                    be allowed to shrink rather than run off the edge. */}
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end sm:gap-4">
                  <div className="price-lg text-sea-900">{toman(o.total)}</div>
                  <form action={setOrderStatus} className="flex w-full items-center gap-2 sm:w-auto">
                    <input type="hidden" name="id" value={o.id} />
                    <select
                      name="status"
                      defaultValue={o.status}
                      className="input min-w-0 flex-1 !py-2 text-sm sm:!w-auto sm:flex-none"
                    >
                      {Object.entries(ORDER_STATUS_FA).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <button className="btn btn-dark shrink-0 !px-4 !py-2.5 text-sm">به‌روزرسانی</button>
                  </form>
                </div>
              </div>
            </div>
          );
        })}
        {orders.length === 0 && (
          <div className="card p-16 text-center text-ink/60">
            {query ? (
              <>
                <p className="font-bold text-sea-900">سفارشی با «{query}» پیدا نشد.</p>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-7">
                  شناسه تراکنش اسنپ‌پی باید کامل و بدون فاصله وارد شود. کد سفارش هم
                  همان ۸ کاراکتر آخر است، نه شناسه کامل سفارش. با نام یا شماره موبایل
                  خریدار هم می‌شود گشت.
                </p>
                <Link href="/admin/orders" className="btn btn-ghost mt-5 !px-5 !py-2.5 text-sm">
                  همه سفارش‌ها
                </Link>
              </>
            ) : (
              "هنوز سفارشی ثبت نشده."
            )}
          </div>
        )}
      </div>
    </div>
  );
}
