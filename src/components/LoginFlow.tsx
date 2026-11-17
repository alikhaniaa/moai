"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const RESEND_SECONDS = 120; // matches the server's resend throttle (>90s) with margin

export default function LoginFlow({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const doRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), name, password }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت‌نام ناموفق بود");
      setBusy(false);
    }
  };
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0); // seconds until resend is allowed
  const codeRef = useRef<HTMLInputElement>(null);

  const passwordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), password }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      router.push(data.isAdmin ? "/admin" : next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ورود ناموفق بود");
      setBusy(false);
    }
  };

  // countdown tick
  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [left]);

  const sendCode = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      if (data.devCode) setDevCode(data.devCode); // fallback if SMS ever disabled
      setStep("code");
      setLeft(RESEND_SECONDS);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ارسال کد");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      router.push(data.isAdmin ? "/admin" : next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "کد درست نیست");
      setBusy(false);
    }
  };

  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <div className="card mt-8 p-7">
      {/* mode toggle */}
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-sand-100 p-1 text-sm font-bold">
        <button
          onClick={() => { setMode("otp"); setError(""); }}
          className={`rounded-full py-2 transition-colors ${mode === "otp" ? "bg-clay-500 text-sand-50" : "text-ink/60"}`}
        >
          کد پیامکی
        </button>
        <button
          onClick={() => { setMode("password"); setError(""); }}
          className={`rounded-full py-2 transition-colors ${mode === "password" ? "bg-clay-500 text-sand-50" : "text-ink/60"}`}
        >
          رمز عبور
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={register ? doRegister : passwordLogin} className="space-y-4">
          {register && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-sea-900">نام و نام خانوادگی</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">شماره موبایل</label>
            <input
              className="input" dir="ltr" inputMode="tel" placeholder="09XXXXXXXXX"
              value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
              maxLength={11} autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-sea-900">رمز عبور</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                className="input pr-11" dir="ltr"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? "پنهان کردن رمز" : "نمایش رمز"}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink/50 hover:text-sea-900"
              >
                {showPw ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.4 5.2A9 9 0 0 1 21 12a9.8 9.8 0 0 1-2.3 3.1M6.1 6.1A9.8 9.8 0 0 0 3 12a9 9 0 0 0 12 6.4"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <button disabled={busy || phone.length !== 11 || password.length < 6} className="btn btn-primary w-full disabled:opacity-50">
            {busy ? "لطفاً صبر کن…" : register ? "ثبت‌نام و ورود" : "ورود"}
          </button>
          <button
            type="button"
            onClick={() => { setRegister((r) => !r); setError(""); }}
            className="block w-full text-center text-xs font-semibold text-clay-600 underline underline-offset-4"
          >
            {register ? "حساب داری؟ وارد شو" : "حساب نداری؟ همین‌جا ثبت‌نام کن (بدون پیامک)"}
          </button>
        </form>
      ) : step === "phone" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
          className="space-y-4"
        >
          <label className="block text-sm font-semibold text-sea-900">شماره موبایل</label>
          <input
            className="input"
            dir="ltr"
            inputMode="tel"
            placeholder="09XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
            maxLength={11}
            autoFocus
          />
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <button disabled={busy || phone.length !== 11} className="btn btn-primary w-full disabled:opacity-50">
            {busy ? "در حال ارسال…" : "دریافت کد ورود"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-sea-900">
              کد ۵ رقمی پیامک‌شده به <span dir="ltr">{phone}</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError("");
                setLeft(0);
              }}
              className="text-xs text-clay-600 underline underline-offset-4"
            >
              ویرایش شماره
            </button>
          </div>
          <input
            ref={codeRef}
            className="input otp-box"
            inputMode="numeric"
            placeholder="•••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
            maxLength={5}
          />

          {/* countdown / resend */}
          <div className="text-center text-xs text-ink/60">
            {left > 0 ? (
              <span>
                ارسال مجدد کد تا <b className="font-mono text-clay-600" dir="ltr">{mmss}</b> دیگر
              </span>
            ) : (
              <button
                type="button"
                onClick={sendCode}
                disabled={busy}
                className="font-semibold text-clay-600 underline underline-offset-4 disabled:opacity-50"
              >
                {busy ? "در حال ارسال…" : "کد را دریافت نکردی؟ ارسال مجدد"}
              </button>
            )}
          </div>

          {devCode && (
            <p className="rounded-xl border border-dashed border-gold bg-gold/10 px-4 py-3 text-center text-xs leading-6 text-clay-700">
              🔧 حالت آزمایشی: کد شما{" "}
              <b className="text-base tracking-widest" dir="ltr">{devCode}</b>
            </p>
          )}
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <button disabled={busy || code.length !== 5} className="btn btn-primary w-full disabled:opacity-50">
            {busy ? "در حال بررسی…" : "ورود"}
          </button>
        </form>
      )}
    </div>
  );
}
