"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart, lineKey } from "@/lib/cart";
import { toman, faNum } from "@/lib/format";
import { PROVINCES } from "@/lib/provinces";

type Method = {
  id: string;
  nameFa: string;
  description: string | null;
  cost: number;
  freeFrom: number;
  estimatedDays: string | null;
};

type Applied = { code: string; discount: number; freeShipping: boolean; label: string };

/**
 * اسنپ‌پی's answer for the current amount - the two lines it wants shown, and
 * nothing of ours. Its presence IS the permission to show the row: we only ever
 * hold one when اسنپ‌پی said yes for the amount the buyer is looking at.
 */
/** The two lines اسنپ‌پی dictates for the row. Never written by us. */
type SnappOffer = { title: string; description: string };

/**
 * What اسنپ‌پی said, tagged with the amount it was asked about.
 *
 * A refusal is stored as an answer with `offer: null`, NOT as "no answer" - 
 * the two mean opposite things for the buyer's selection. اسنپ‌پی saying no has
 * to un-pick the method; اسنپ‌پی not having replied yet must leave it alone, or
 * every coupon applied after choosing instalments would quietly move the buyer
 * back to the bank gateway.
 *
 * The tag also stops last basket's instalment figures being shown against this
 * one - they are computed from the amount and belong to no other.
 */
type SnappAnswer = { forAmount: number; offer: SnappOffer | null };

export default function CheckoutForm({
  defaults,
  methods,
  digipay,
  snapppay,
  whatsapp,
  snapppayNote,
}: {
  defaults: {
    firstName: string; lastName: string; phone: string; email: string;
    province?: string; city?: string; address?: string; unit?: string; postalCode?: string;
  };
  methods: Method[];
  /** the دیجی‌پی option only exists when the server says it is ready */
  digipay: boolean;
  /**
   * Whether the اسنپ‌پی *gateway* is live. Off = اسنپ‌پی is still offered, but as
   * the واتس‌اپ hand-off it has always been; on = it becomes a real payment
   * method that redirects to اسنپ‌پی. Only the server decides which.
   */
  snapppay: boolean;
  /** shop number, for the اسنپ‌پی hand-off */
  whatsapp: string;
  /** what the اسنپ‌پی note says - editable in تنظیمات */
  snapppayNote: string;
}) {
  const { items, subtotal, clear } = useCart();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [payWith, setPayWith] = useState<
    "GATEWAY" | "CARD" | "DIGIPAY" | "SNAPPPAY_IPG"
  >("GATEWAY");
  const [form, setForm] = useState({
    firstName: defaults.firstName,
    lastName: defaults.lastName,
    company: "",
    province: defaults.province ?? "",
    city: defaults.city ?? "",
    address: defaults.address ?? "",
    unit: defaults.unit ?? "",
    postalCode: defaults.postalCode ?? "",
    phone: defaults.phone,
    email: defaults.email,
    note: "",
  });

  // coupon
  const [showCoupon, setShowCoupon] = useState(false);
  const [snappOpen, setSnappOpen] = useState(false);
  const snappWa = "https://wa.me/" + whatsapp + "?text=" + encodeURIComponent("سلام! می‌خواستم سفارشم را قسطی با اسنپ‌پی پرداخت کنم.");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<Applied | null>(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const method = methods.find((m) => m.id === methodId) ?? null;
  const discount = coupon?.discount ?? 0;
  const afterDiscount = Math.max(0, subtotal - discount);
  const shipping =
    !method || coupon?.freeShipping
      ? 0
      : method.freeFrom > 0 && afterDiscount >= method.freeFrom
        ? 0
        : method.cost;
  const payable = afterDiscount + shipping;

  const checkCoupon = async (code = couponInput, method = payWith) => {
    setCouponBusy(true);
    setCouponMsg("");
    try {
      const res = await fetch("/api/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          // sent so a code barred from instalments is refused here rather than
          // at the very end, after the buyer has filled the whole form in
          paymentMethod: method,
          items: items.map((i) => ({ id: i.id, qty: i.qty, sizeId: i.sizeId ?? null, colorId: i.colorId ?? null })),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setCoupon(data);
      setCouponMsg("");
    } catch (e) {
      setCoupon(null);
      setCouponMsg(e instanceof Error ? e.message : "کد معتبر نیست.");
    } finally {
      setCouponBusy(false);
    }
  };

  // A code accepted for the gateway may not be allowed on اسنپ‌پی / دیجی‌پی, so
  // changing the payment method re-asks the server. Without this the buyer sees
  // a discount that the checkout would then refuse.
  useEffect(() => {
    if (!coupon) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: coupon.code,
          paymentMethod: payWith,
          items: items.map((i) => ({ id: i.id, qty: i.qty, sizeId: i.sizeId ?? null, colorId: i.colorId ?? null })),
        }),
      }).catch(() => null);
      if (cancelled || !res) return;
      const data = await res.json().catch(() => null);
      if (cancelled || !data) return;
      if (data.ok) {
        setCoupon(data);
        setCouponMsg("");
      } else {
        setCoupon(null);
        setCouponMsg(data.error ?? "این کد با این روش پرداخت کار نمی‌کند.");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payWith]);

  // ── اسنپ‌پی eligibility ──
  //
  // The doc (FAQ 6) leaves us no room here: the instalment row may appear only
  // when eligible answers true, the title and description it returns are shown
  // exactly as they arrive, and since اسنپ‌پی computes the instalment figures
  // from the amount itself, the service is asked again on *every* change of the
  // payable total. So nothing below decides anything - it only relays.
  const [snappAnswer, setSnappAnswer] = useState<SnappAnswer | null>(null);

  useEffect(() => {
    if (!snapppay || payable <= 0) {
      setSnappAnswer(null);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();

    // the total moves while a coupon code is being typed, so let it settle
    const timer = setTimeout(async () => {
      const res = await fetch("/api/payment/snapppay/eligible", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountToman: payable }),
        signal: ctrl.signal,
      }).catch(() => null);
      const data = res ? await res.json().catch(() => null) : null;
      const asked = payable;
      // an answer about an amount we have already moved on from must never land
      // on top of a newer one
      if (cancelled) return;
      setSnappAnswer({
        forAmount: asked,
        offer:
          data?.ok === true &&
          data.eligible === true &&
          typeof data.title === "string" &&
          typeof data.description === "string"
            ? { title: data.title, description: data.description }
            // refused, no wording, or no answer at all - and the wording is not
            // ours to invent, so the row simply goes
            : null,
      });
    }, 400);

    // The previous answer is kept in state until this one arrives so the row
    // does not vanish and reflow the page, but it is NOT shown - see the
    // `forAmount` check where the row is rendered.
    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [snapppay, payable]);

  // An answer is only good for the amount it was quoted against.
  const snappAnswered = snappAnswer?.forAmount === payable ? snappAnswer : null;
  /** اسنپ‌پی's own wording for THIS amount, or null if there is no offer to show. */
  const snappCurrent = snappAnswered?.offer ?? null;
  /** Asked, not yet answered - a different state from «refused». */
  const snappWaiting = snapppay && payable > 0 && !snappAnswered;

  // اسنپ‌پی can withdraw the offer while the buyer is still on the page, and a
  // method that is no longer offered must not stay selected. But only a real
  // refusal counts: while a re-check is in flight the selection is left exactly
  // where the buyer put it.
  useEffect(() => {
    if (payWith !== "SNAPPPAY_IPG") return;
    if (!snapppay || (snappAnswered && !snappAnswered.offer)) setPayWith("GATEWAY");
  }, [snappAnswered, snapppay, payWith]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          shippingMethodId: methodId,
          couponCode: coupon?.code ?? "",
          paymentMethod: payWith,
          items: items.map((i) => ({ id: i.id, qty: i.qty, sizeId: i.sizeId ?? null, colorId: i.colorId ?? null })),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "خطایی پیش آمد.");
      clear();
      // trust the server's answer, not our own state, about where this order goes
      router.push(data.next ?? `/checkout/pay/${data.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطایی پیش آمد.");
      setBusy(false);
    }
  };

  if (items.length === 0)
    return (
      <div className="card mt-10 flex flex-col items-center gap-5 p-12 text-center">
        <span className="text-5xl">🏖️</span>
        <p className="text-ink/82">سبد خریدت خالی است.</p>
        <Link href="/products" className="btn btn-primary">رفتن به فروشگاه</Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="mt-10 grid gap-10 lg:grid-cols-5">
      {/* ── billing details ── */}
      <div className="space-y-4 lg:col-span-3">
        <h2 className="font-display text-2xl font-bold text-sea-900">جزئیات صورتحساب</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نام" required>
            <input required className="input" value={form.firstName} onChange={set("firstName")} />
          </Field>
          <Field label="نام خانوادگی" required>
            <input required className="input" value={form.lastName} onChange={set("lastName")} />
          </Field>
        </div>

        <Field label="نام شرکت (اختیاری)">
          <input className="input" value={form.company} onChange={set("company")} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="کشور / منطقه">
            <div className="input bg-sand-100 text-ink/75">ایران</div>
          </Field>
          <Field label="استان" required>
            <select required className="input" value={form.province} onChange={set("province")}>
              <option value="" disabled>یک گزینه انتخاب نمائید</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="شهر" required>
            <input required className="input" value={form.city} onChange={set("city")} />
          </Field>
        </div>

        <Field label="آدرس خیابان" required>
          <input
            required
            className="input"
            placeholder="نام خیابان و پلاک خانه"
            value={form.address}
            onChange={set("address")}
          />
        </Field>

        <Field label="آپارتمان، مجتمع، واحد و... (اختیاری)">
          <input className="input" value={form.unit} onChange={set("unit")} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="کدپستی (بدون فاصله و با اعداد انگلیسی)">
            <input
              className="input"
              dir="ltr"
              inputMode="numeric"
              maxLength={10}
              value={form.postalCode}
              onChange={(e) =>
                setForm((f) => ({ ...f, postalCode: e.target.value.replace(/[^0-9]/g, "") }))
              }
            />
          </Field>
          <Field label="تلفن" required>
            <input
              required
              className="input"
              dir="ltr"
              inputMode="tel"
              maxLength={11}
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value.replace(/[^0-9]/g, "") }))
              }
            />
          </Field>
        </div>

        <Field label="پست الکترونیک">
          <input
            type="email"
            className="input"
            dir="ltr"
            placeholder="info@example.com"
            value={form.email}
            onChange={set("email")}
          />
        </Field>

        <Field label="توضیحات سفارش (اختیاری)">
          <textarea
            className="input min-h-24 resize-y"
            placeholder="یادداشت‌ها درباره سفارش شما، برای مثال نکات مهم درباره نحوه تحویل سفارش."
            value={form.note}
            onChange={set("note")}
          />
        </Field>

        {/* ── shipping ── */}
        {methods.length > 0 && (
          <div className="pt-2">
            <h2 className="mb-4 font-display text-2xl font-bold text-sea-900">روش ارسال</h2>
            <div className="space-y-3">
              {methods.map((m) => {
                const free = m.freeFrom > 0 && afterDiscount >= m.freeFrom;
                return (
                  <label
                    key={m.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                      methodId === m.id
                        ? "border-clay-500 bg-clay-500/5"
                        : "border-sand-200 hover:border-sand-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      className="mt-1 h-4 w-4 accent-clay-500"
                      checked={methodId === m.id}
                      onChange={() => setMethodId(m.id)}
                    />
                    <span className="flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <b className="text-sea-900">{m.nameFa}</b>
                        <b className={m.cost === 0 || free ? "text-sea-600" : "text-clay-600"}>
                          {m.cost === 0 ? "پس‌کرایه" : free ? "رایگان" : toman(m.cost)}
                        </b>
                      </span>
                      {(m.description || m.estimatedDays) && (
                        <span className="mt-1 block text-xs leading-6 text-ink/72">
                          {m.description}
                          {m.estimatedDays && ` · ${m.estimatedDays}`}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* ── payment method ── */}
        <div className="pt-2">
          <h2 className="mb-4 font-display text-2xl font-bold text-sea-900">روش پرداخت</h2>
          <div className="space-y-3">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                payWith === "GATEWAY"
                  ? "border-clay-500 bg-clay-500/5"
                  : "border-sand-200 hover:border-sand-300"
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                className="mt-1 h-4 w-4 accent-clay-500"
                checked={payWith === "GATEWAY"}
                onChange={() => setPayWith("GATEWAY")}
              />
              <span className="flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <b className="text-sea-900">پرداخت آنلاین</b>
                  <b className="text-sea-600">{toman(payable)}</b>
                </span>
                <span className="mt-1 block text-xs leading-6 text-ink/72">
                  انتقال به درگاه امن بانک سامان (سپ) و پرداخت کل مبلغ
                </span>
              </span>
            </label>

            {digipay && (
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                  payWith === "DIGIPAY"
                    ? "border-[#003eff] bg-[#003eff]/5"
                    : "border-sand-200 hover:border-sand-300"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  className="mt-1 h-4 w-4 accent-[#003eff]"
                  checked={payWith === "DIGIPAY"}
                  onChange={() => setPayWith("DIGIPAY")}
                />
                <span className="flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2.5">
                      {/* kept the same box as the اسنپ‌پی mark: their style
                          guide asks for 32/40 and for every gateway's logo on
                          this page to be the one size */}
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white p-1 ring-1 ring-black/5 sm:h-10 sm:w-10">
                        <Image
                          src="/images/digipay-mark.svg"
                          alt="دیجی‌پی"
                          width={22}
                          height={22}
                          className="h-full w-full object-contain"
                        />
                      </span>
                      <b className="text-sea-900">پرداخت با دیجی‌پی</b>
                    </span>
                    <b className="text-[#003eff]">{toman(payable)}</b>
                  </span>
                  <span className="mt-1 block text-xs leading-6 text-ink/72">
                    پرداخت با کیف پول یا کارت بانکی از طریق درگاه دیجی‌پی.
                  </span>
                </span>
              </label>
            )}
            {/* اسنپ‌پی has two shapes, and only the server decides which.
                Gateway on  → a real payment method: the buyer is redirected to
                              اسنپ‌پی, and the shop is paid in full on the
                              verified callback. The row exists only while
                              eligible says so, and says only what it dictates.
                Gateway off → the option stays visible because buyers look for
                              it, but choosing it opens a note and hands them to
                              واتس‌اپ to arrange by hand - it never becomes a
                              selected payment method, so no order is created. */}
            {snapppay ? (
              !snappCurrent ? (
                // اسنپ‌پی has not answered for THIS amount yet. Their wording is
                // the only wording allowed here, so until it arrives the row
                // says nothing of theirs. It keeps its place - and, when the
                // buyer had already chosen instalments, keeps looking chosen - 
                // so nothing jumps or un-picks itself under their finger.
                snappWaiting && (
                  <div
                    className={`flex items-start gap-3 rounded-2xl border p-4 ${
                      payWith === "SNAPPPAY_IPG"
                        ? "border-[#007DFA] bg-[#007DFA]/5"
                        : "border-sand-200 opacity-60"
                    }`}
                  >
                    <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-sand-300" />
                    <Image
                      src="/images/snapppay-mark.svg"
                      alt="اسنپ‌پی"
                      width={40}
                      height={40}
                      className="h-8 w-8 shrink-0 sm:h-10 sm:w-10"
                    />
                    <span className="mt-1 flex-1 text-xs leading-6 text-ink/60">
                      در حال بررسی شرایط پرداخت اقساطی…
                    </span>
                  </div>
                )
              ) : (
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                    payWith === "SNAPPPAY_IPG"
                      ? "border-[#007DFA] bg-[#007DFA]/5"
                      : "border-sand-200 hover:border-sand-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    className="mt-1 h-4 w-4 accent-[#007DFA]"
                    checked={payWith === "SNAPPPAY_IPG"}
                    onChange={() => setPayWith("SNAPPPAY_IPG")}
                  />
                  {/* the official round mark carries its own blue, so it wants
                      no white tile - 32 on phones, 40 from sm: up, matching the
                      other gateways' marks */}
                  <Image
                    src="/images/snapppay-mark.svg"
                    alt="اسنپ‌پی"
                    width={40}
                    height={40}
                    className="h-8 w-8 shrink-0 sm:h-10 sm:w-10"
                  />
                  {/* both lines are اسنپ‌پی's own words, printed exactly as they
                      arrived - never appended to, reformatted or re-digited */}
                  <span className="flex-1">
                    <b className="block text-sea-900">{snappCurrent.title}</b>
                    <span className="mt-1 block text-xs font-normal leading-6 text-ink/72">
                      {snappCurrent.description}
                    </span>
                  </span>
                </label>
              )
            ) : (
              <button
                type="button"
                onClick={() => setSnappOpen(true)}
                className="flex w-full cursor-pointer items-start gap-3 rounded-2xl border border-sand-200 p-4 text-right transition-colors hover:border-[#007DFA]/50 hover:bg-[#007DFA]/5"
              >
                <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-sand-300" />
                <span className="flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white p-1 ring-1 ring-black/5">
                        <Image
                          src="/images/snapppay.svg"
                          alt="اسنپ‌پی"
                          width={80}
                          height={80}
                          className="h-full w-full object-contain"
                        />
                      </span>
                      <b className="text-sea-900">خرید قسطی با اسنپ‌پی</b>
                    </span>
                    <b className="whitespace-nowrap text-[#0062c4]">هماهنگی در واتس‌اپ</b>
                  </span>
                  <span className="mt-1 block text-xs leading-6 text-ink/72">
                    {snapppayNote}
                  </span>
                </span>
              </button>
            )}

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                payWith === "CARD"
                  ? "border-clay-500 bg-clay-500/5"
                  : "border-sand-200 hover:border-sand-300"
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                className="mt-1 h-4 w-4 accent-clay-500"
                checked={payWith === "CARD"}
                onChange={() => setPayWith("CARD")}
              />
              <span className="flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <b className="text-sea-900">کارت به کارت</b>
                  <b className="text-sea-600">{toman(payable)}</b>
                </span>
                <span className="mt-1 block text-xs leading-6 text-ink/72">
                  واریز مبلغ به کارت فروشگاه و ارسال رسید در واتس‌اپ.
                  شماره کارت پس از ثبت سفارش نمایش داده می‌شود.
                </span>
              </span>
            </label>
          </div>

          {payWith === "CARD" && (
            <p className="mt-3 rounded-xl bg-gold/12 px-4 py-3 text-xs leading-6 text-ink/78">
              سفارش بلافاصله ثبت می‌شود و کالا برایت کنار گذاشته می‌شود، اما پس از
              بررسی رسید واریز توسط ما نهایی می‌شود.
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
        )}
      </div>

      {/* ── order summary ── */}
      <aside className="lg:col-span-2">
        <div className="card sticky top-28 p-6">
          <h2 className="mb-5 font-display text-2xl font-bold text-sea-900">سفارش شما</h2>

          <ul className="space-y-4">
            {items.map((i) => (
              <li key={lineKey(i)} className="flex items-center gap-3">
                <Image src={i.image} alt={i.nameFa} width={56} height={64} className="h-16 w-14 rounded-lg object-cover" />
                <div className="flex-1 text-sm">
                  <div className="font-semibold leading-6 text-sea-900">{i.nameFa}</div>
                  {i.sizeLabel && (
                    <div className="text-xs font-bold text-sea-700">سایز {i.sizeLabel}</div>
                  )}
                  {i.colorName && (
                    <div className="text-xs font-bold text-clay-700">رنگ {i.colorName}</div>
                  )}
                  <div className="text-xs text-ink/68">{faNum(i.qty)} × {toman(i.unitPrice)}</div>
                </div>
                <span className="text-sm font-semibold text-sea-900">
                  {toman(i.unitPrice * i.qty)}
                </span>
              </li>
            ))}
          </ul>

          {/* coupon */}
          <div className="mt-5 border-t border-sand-200 pt-4">
            {!showCoupon && !coupon && (
              <button
                type="button"
                onClick={() => setShowCoupon(true)}
                className="text-sm font-semibold text-clay-600 underline underline-offset-4"
              >
                کد تخفیف دارید؟ برای نوشتن کد اینجا کلیک کنید
              </button>
            )}

            {showCoupon && !coupon && (
              <div className="flex gap-2">
                <input
                  className="input !py-2.5 text-sm"
                  dir="ltr"
                  placeholder="کد تخفیف"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                />
                <button
                  type="button"
                  onClick={() => checkCoupon()}
                  disabled={couponBusy || !couponInput.trim()}
                  className="btn btn-dark !px-5 !py-2.5 text-sm disabled:opacity-50"
                >
                  {couponBusy ? "…" : "اعمال"}
                </button>
              </div>
            )}

            {coupon && (
              <div className="flex items-center justify-between rounded-xl bg-sea-100 px-4 py-2.5 text-sm">
                <span className="font-bold text-sea-700">
                  ✓ {coupon.code} — {coupon.label}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCoupon(null);
                    setCouponInput("");
                    setShowCoupon(true);
                  }}
                  className="text-xs text-ink/68 underline"
                >
                  حذف
                </button>
              </div>
            )}

            {couponMsg && <p className="mt-2 text-xs font-semibold text-red-600">{couponMsg}</p>}
          </div>

          {/* totals */}
          <div className="mt-5 space-y-2 border-t border-sand-200 pt-4 text-sm">
            <Row label="جمع جزء" value={toman(subtotal)} />
            {discount > 0 && (
              <Row label="تخفیف" value={`− ${toman(discount)}`} accent="text-sea-600" />
            )}
            <Row
              label="ارسال"
              value={
                methods.length === 0
                  ? "پس از ثبت هماهنگ می‌شود"
                  : shipping > 0
                    ? toman(shipping)
                    : // zero can mean two very different things: the method itself
                      // is freight-collect, or a threshold/coupon made it free
                      method && method.cost > 0
                      ? "رایگان"
                      : "پس‌کرایه (هنگام تحویل)"
              }
            />
            <div className="flex items-center justify-between pt-2">
              <span className="font-bold text-sea-900">مجموع</span>
              <span className="price-lg text-sea-900">{toman(payable)}</span>
            </div>
          </div>

          {/* اسنپ‌پی re-quotes on every change of the total, so an order must not
              be sent while the current amount is still unanswered - the buyer
              would be committing to instalments اسنپ‌پی has not agreed to. */}
          <button
            disabled={busy || (payWith === "SNAPPPAY_IPG" && snappWaiting)}
            className="btn btn-primary mt-6 w-full text-base disabled:opacity-60"
          >
            {busy
              ? "در حال ثبت…"
              : payWith === "SNAPPPAY_IPG" && snappWaiting
                ? "در حال بررسی شرایط اقساط…"
              : payWith === "CARD"
                  ? "ثبت سفارش و نمایش شماره کارت"
                  : payWith === "DIGIPAY"
                    ? "ثبت سفارش و پرداخت با دیجی‌پی"
                    : payWith === "SNAPPPAY_IPG"
                      ? "ثبت سفارش و پرداخت با اسنپ‌پی"
                      : "ثبت سفارش و پرداخت"}
          </button>

          <p className="mt-4 rounded-xl border border-dashed border-sand-300 bg-sand-100/70 px-4 py-3 text-xs leading-6 text-ink/75">
            {payWith === "CARD"
                ? "🧾 پس از ثبت سفارش، شماره کارت و مبلغ دقیق نمایش داده می‌شود؛ رسید را در واتس‌اپ برای ما بفرست."
                : payWith === "DIGIPAY"
                  ? "🔐 پرداخت در سایت دیجی‌پی انجام می‌شود و اطلاعات کارت شما هرگز در سایت ما وارد یا ذخیره نمی‌شود."
                  : payWith === "SNAPPPAY_IPG"
                    // deliberately says nothing about instalments - that wording
                    // belongs to اسنپ‌پی and is already on the option itself
                    ? "🔐 پرداخت در سایت اسنپ‌پی انجام می‌شود و اطلاعات کارت شما هرگز در سایت ما وارد یا ذخیره نمی‌شود."
                    : "🔐 پرداخت از طریق درگاه امن بانک انجام می‌شود و اطلاعات کارت شما هرگز در سایت ما وارد یا ذخیره نمی‌شود."}
          </p>
        </div>
      </aside>

      {/* اسنپ‌پی - arranged by hand, so this explains and hands over to واتس‌اپ */}
      {snappOpen && (
        <div
          className="fixed inset-0 z-[240] flex items-end justify-center p-0 sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="خرید قسطی با اسنپ‌پی"
        >
          <div className="absolute inset-0 bg-sea-900/55 backdrop-blur-sm" onClick={() => setSnappOpen(false)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-sand-200 bg-sand-50 shadow-2xl sm:rounded-3xl">
            <div className="flex items-center gap-3 bg-[#007DFA] px-6 py-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white p-1.5">
                <Image src="/images/snapppay.svg" alt="" width={80} height={80} className="h-full w-full object-contain" />
              </span>
              <div>
                <p className="font-display text-2xl font-bold text-white">خرید قسطی با اسنپ‌پی</p>
                <p className="text-xs text-white/85">با هماهنگی، در واتس‌اپ</p>
              </div>
            </div>

            <div className="px-6 py-6">
              <p className="whitespace-pre-line text-sm leading-8 text-ink/82">{snapppayNote}</p>

              <a
                href={snappWa}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setSnappOpen(false)}
                className="btn mt-6 w-full bg-[#25D366] text-white hover:brightness-95"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4 0-.5.1-.7l.5-.6c.1-.2.1-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.9.9-1.2 2.1-.6 3.5a12 12 0 0 0 4.6 4.9c1.7 1 2.6 1 3.5.8.6-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.2-.2-.3-.4-.4Z" />
                </svg>
                هماهنگی در واتس‌اپ
              </a>

              <button
                type="button"
                onClick={() => setSnappOpen(false)}
                className="btn btn-ghost mt-2 w-full"
              >
                یک روش دیگر انتخاب می‌کنم
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-sea-900">
        {label} {required && <span className="text-clay-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink/75">{label}</span>
      <span className={`font-semibold ${accent ?? "text-sea-900"}`}>{value}</span>
    </div>
  );
}
