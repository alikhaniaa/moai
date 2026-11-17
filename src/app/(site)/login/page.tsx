import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import LoginFlow from "@/components/LoginFlow";

export const dynamic = "force-dynamic";
export const metadata = { title: "ورود | عضویت" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(next?.startsWith("/") ? next : "/account");

  return (
    <section className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-32">
      <div className="text-center">
        <div className="eyebrow">خوش آمدی به موآی…</div>
        <h1 className="font-display text-4xl font-bold text-sea-900 md:text-5xl">
          ورود / عضویت
        </h1>
        <p className="mt-3 text-sm leading-7 text-ink/75">
          با شماره موبایل وارد شو؛ اگر بار اولت است، همان لحظه عضو باشگاه موآی
          می‌شوی و ۵۰ امتیاز هدیه می‌گیری. 🐚
        </p>
      </div>
      <LoginFlow next={next?.startsWith("/") ? next : "/account"} />
    </section>
  );
}
