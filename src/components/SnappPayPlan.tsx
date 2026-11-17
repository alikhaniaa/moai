import Image from "next/image";
import { toman, faNum, faDate } from "@/lib/format";
import { installmentPlan, remainingAmount, remainingCount } from "@/lib/snapppay";

/** The blue Snapp! Pay wordmark, on the white it is designed for. */
export function SnappPayMark({ size = 44 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl bg-white p-1.5 ring-1 ring-black/5"
      style={{ width: size, height: size }}
    >
      <Image
        src="/images/snapppay.svg"
        alt="اسنپ‌پی"
        width={80}
        height={80}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

/**
 * The four instalments of a SnappPay order.
 *
 * Dates are our own estimate (approval + 1/2/3 months) and are always labelled
 * as such - SnappPay's app holds the real schedule. Before the shop approves the
 * order there are no dates at all, only amounts.
 */
export default function SnappPayPlan({
  total,
  approvedAt,
  compact = false,
}: {
  total: number;
  approvedAt: Date | string | null;
  compact?: boolean;
}) {
  const plan = installmentPlan(total, approvedAt);
  const left = remainingAmount(plan);
  const leftCount = remainingCount(plan);

  if (compact) {
    return (
      <div className="mt-3 rounded-2xl bg-[#007DFA]/6 px-4 py-3 ring-1 ring-[#007DFA]/15">
        <div className="flex items-center gap-2.5">
          <SnappPayMark size={34} />
          <span className="text-xs font-bold text-[#0062c4]">خرید ۴ قسطه اسنپ‌پی</span>
        </div>
        <div className="mt-2.5 space-y-1 text-xs leading-6 text-ink/75">
          {approvedAt ? (
            <>
              <div>
                ✓ قسط اول ({toman(plan[0].amount)}) هنگام ثبت‌نام پرداخت شد.
              </div>
              <div className="font-semibold text-sea-900">
                {faNum(leftCount)} قسط باقی‌مانده — {toman(left)}
              </div>
            </>
          ) : (
            <div>
              پس از تأیید، در {faNum(4)} قسط پرداخت می‌شود — هر قسط حدود{" "}
              <b className="text-sea-900">{toman(plan[1].amount)}</b>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#007DFA]/6 p-5 ring-1 ring-[#007DFA]/15">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SnappPayMark />
          <div>
            <div className="font-bold text-[#0062c4]">خرید ۴ قسطه اسنپ‌پی</div>
            <div className="text-xs text-ink/68">بدون سود و کارمزد</div>
          </div>
        </div>
        <div className="text-left">
          <div className="text-xs text-ink/60">مبلغ کل</div>
          <div className="font-display text-xl font-black text-sea-900">{toman(total)}</div>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {plan.map((p) => (
          <li
            key={p.n}
            className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm ${
              p.paid ? "bg-white/70" : "bg-white/40"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${
                  p.paid ? "bg-[#007DFA] text-white" : "bg-sand-200 text-ink/55"
                }`}
              >
                {p.paid ? "✓" : faNum(p.n)}
              </span>
              <span className={p.paid ? "text-ink/72" : "font-semibold text-sea-900"}>
                قسط {faNum(p.n)}
                {p.n === 1 && " (هنگام ثبت‌نام)"}
              </span>
            </span>
            <span className="flex items-center gap-3">
              {p.due && (
                <span className="text-xs text-ink/55">
                  {p.paid ? faDate(p.due) : `~ ${faDate(p.due)}`}
                </span>
              )}
              <b className="text-sea-900">{toman(p.amount)}</b>
            </span>
          </li>
        ))}
      </ul>

      {approvedAt ? (
        <div className="mt-3 flex items-center justify-between border-t border-[#007DFA]/15 pt-3 text-sm">
          <span className="text-ink/72">{faNum(leftCount)} قسط باقی‌مانده</span>
          <b className="text-[#0062c4]">{toman(left)}</b>
        </div>
      ) : (
        <p className="mt-3 border-t border-[#007DFA]/15 pt-3 text-xs leading-6 text-ink/68">
          زمان‌بندی اقساط پس از تأیید سفارش مشخص می‌شود.
        </p>
      )}

      <p className="mt-2 text-[11px] leading-5 text-ink/50">
        تاریخ‌ها تقریبی‌اند؛ سررسید دقیق اقساط را در اپلیکیشن اسنپ‌پی ببین.
        دریافت اقساط توسط اسنپ‌پی انجام می‌شود.
      </p>
    </div>
  );
}
