/**
 * Is اسنپ‌پی reachable, would a real purchase be accepted, and is anything left
 * half-finished?
 *
 *   node tools/snapppaycheck.mjs              # pre-flight, spends nothing
 *   node tools/snapppaycheck.mjs --unsettled  # also lists verified-but-unsettled rows
 *   node tools/snapppaycheck.mjs --settle     # ...and settles them (captures money)
 *   node tools/snapppaycheck.mjs --reconcile  # attempts whose callback never came
 *   node tools/snapppaycheck.mjs --reconcile --fix   # ...and finishes them
 *
 * The default run is the certification pre-flight. Without moving a ریال it
 * proves that:
 *
 *   · every credential is present and accepted - 401 means the username, the
 *     password or the client key is wrong; 403 means this server's IP is not on
 *     اسنپ‌پی's whitelist, which is a completely different problem with a
 *     completely different fix
 *   · اسنپ‌پی's amount limits are where we think they are, probed at their
 *     edges rather than somewhere comfortable in the middle
 *   · a توکن پرداخت built exactly the way /checkout/snapppay-ipg/[orderId]
 *     builds it is accepted: the same cart shape, and the returnURL that
 *     SITE_URL actually produces
 *
 * That last one is the check worth having. An unpaid payment token costs
 * nothing and expires by itself, and asking for one is the only honest way to
 * learn - before a buyer does - that the return address is not registered
 * (1051) or that the basket is a shape اسنپ‌پی refuses (1005).
 *
 * `--unsettled` is the one that matters operationally. A SnappPay purchase is
 * only finished once تسویه (settle) succeeds; if the callback verified the
 * withdrawal but the settle call failed, the buyer's credit is spent, the goods
 * are owed, and the shop has NOT been paid. Those rows are PAID with a null
 * settledAt, and the API doc requires them settled by the end of the day.
 *
 * `--settle` actually captures the money for each of them. It is irreversible
 * (after settle you can only cancel, not revert), so it is opt-in - and each
 * one it sends is written to PaymentOperation, exactly like an admin's own
 * تغییر سبد, with no userId because a tool sent it rather than a person.
 *
 * Secrets are never printed.
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^\s*[A-Z_]+\s*=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
for (const [k, v] of Object.entries(env)) process.env[k] ??= v;

const BASE = (env.SNAPPPAY_BASE_URL || "").replace(/\/$/, "");
const SITE = (env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const need = [
  "SNAPPPAY_BASE_URL",
  "SNAPPPAY_CLIENT_ID",
  "SNAPPPAY_CLIENT_SECRET",
  "SNAPPPAY_USERNAME",
  "SNAPPPAY_PASSWORD",
];

let passes = 0;
let fails = 0;
/** Answers that arrived fine but disagree with what stage measured. */
let diffs = 0;
const failed = [];

const check = (label, ok, extra = "") => {
  if (ok) passes++;
  else {
    fails++;
    failed.push(label);
  }
  console.log(`   ${ok ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
};
const differs = (label, extra) => {
  diffs++;
  console.log(`   DIFF  ${label} — ${extra}`);
};

console.log(`\nbase: ${BASE || "(unset)"}`);
console.log(`site: ${SITE}`);
console.log("─── credentials present ───");
for (const k of need) {
  const v = env[k] ?? "";
  check(k, !!v, v ? `${v.length} chars` : "MISSING from .env");
}
if (fails) {
  console.log("\nCannot continue without every credential.\n");
  process.exit(1);
}

// ─── JWT ───────────────────────────────────────────────────────────
console.log("─── oauth token ───");
const basic = Buffer.from(
  `${env.SNAPPPAY_CLIENT_ID}:${env.SNAPPPAY_CLIENT_SECRET}`
).toString("base64");

let token = "";
let tokenStatus = 0;
try {
  const res = await fetch(`${BASE}/api/online/v1/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "password",
      scope: "online-merchant",
      username: env.SNAPPPAY_USERNAME,
      password: env.SNAPPPAY_PASSWORD,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  tokenStatus = res.status;
  const data = await res.json().catch(() => null);
  token = typeof data?.access_token === "string" ? data.access_token : "";
  check(
    `POST /api/online/v1/oauth/token`,
    res.ok && !!token,
    res.ok ? `expires_in ${data?.expires_in ?? "?"}s` : `HTTP ${res.status}`
  );
  // The two failures worth telling apart: the fix for one is a line in .env,
  // the fix for the other is a ticket at portal.snapppay.ir.
  check("credentials accepted", tokenStatus !== 401, tokenStatus === 401 ? "HTTP 401" : "");
  check(
    "this server's IP is whitelisted",
    tokenStatus !== 403,
    tokenStatus === 403 ? "HTTP 403" : ""
  );
} catch (err) {
  check("POST /api/online/v1/oauth/token", false, err.message);
}

if (tokenStatus === 401) {
  console.log(
    "\n   نام کاربری، رمز یا کلید اسنپ‌پی پذیرفته نشد — یکی از پنج مقدار SNAPPPAY_* در .env اشتباه است.\n" +
      "   SnappPay rejected the credentials themselves. This is not an IP problem: fix .env.\n"
  );
} else if (tokenStatus === 403) {
  console.log(
    "\n   آی‌پی این سرور نزد اسنپ‌پی whitelist نشده است. ممکن است اعتبارنامه‌ها کاملاً درست باشند؛\n" +
      "   تا وقتی اسنپ‌پی آی‌پی ثابت این سرور را اضافه نکند، هیچ درخواستی پذیرفته نمی‌شود.\n" +
      "   This server's IP is NOT on SnappPay's whitelist — the credentials may be perfectly fine.\n" +
      "   Run this from the production VPS, or ask SnappPay to whitelist this machine's IP.\n"
  );
}
if (!token) {
  console.log("Cannot continue without a token.\n");
  process.exit(1);
}

const api = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  const data = await res.json().catch(() => null);
  return { res, data };
};

/** `{successful:false, errorData:{errorCode, message, data:{errorField}}}`, flattened. */
const errOf = (data) => {
  const e = data?.errorData ?? {};
  return {
    code: Number(e.errorCode ?? 0),
    message: typeof e.message === "string" ? e.message : "",
    field: typeof e.data?.errorField === "string" ? e.data.errorField : "",
  };
};

const fa = (n) => n.toLocaleString("fa-IR");

// ─── eligibility, at the edges ─────────────────────────────────────
/**
 * اسنپ‌پی decides basket by basket and the doc forbids hard-coding any of it,
 * so these are not rules - they are what stage answered on 2026-09-07, kept
 * here only so a silent change gets noticed. Production has its own limits by
 * contract, which is why a disagreement prints DIFF and not FAIL: the call
 * worked, the limits simply moved.
 */
const LIMITS = [
  { toman: 4_000, expect: false, why: "زیر کف مبلغ" },
  { toman: 5_000, expect: true, why: "درست بالای کف" },
  { toman: 500_000, expect: true, why: "یک سبد واقعی" },
  { toman: 10_000_000, expect: true, why: "خودِ سقف" },
  { toman: 10_000_001, expect: false, why: "یک تومان بالای سقف" },
];

console.log("─── merchant eligibility, probed at the edges ───");
/** The smallest basket اسنپ‌پی actually financed - the token probe reuses it. */
let smallestEligible = 0;

for (const { toman, expect, why } of LIMITS) {
  const label = `${fa(toman)} تومان (${why})`;
  try {
    const { res, data } = await api("GET", `/api/online/offer/v1/eligible?amount=${toman * 10}`);
    if (!res.ok || data?.successful !== true) {
      check(label, false, `HTTP ${res.status} ${JSON.stringify(data?.errorData ?? {})}`);
      continue;
    }
    const yes = data.response?.eligible === true;
    if (yes && !smallestEligible) smallestEligible = toman;
    const said = yes ? `قابل تقسیط — ${data.response?.title_message ?? ""}` : "NOT eligible";
    if (yes === expect) check(label, true, said);
    else differs(label, `expected ${expect ? "eligible" : "NOT eligible"}, got ${said}`);
  } catch (err) {
    check(label, false, err.message);
  }
}

// ─── a real token request, exactly as checkout builds one ──────────
/**
 * Two things can only be learned by asking for a token, and both stay invisible
 * until a buyer hits them:
 *
 *   1. returnURL - اسنپ‌پی refuses any address outside the base registered for
 *      the merchant, with 1051. `http://localhost:3000/...` is refused,
 *      `https://moaigallery.ir/...` is accepted, so this is only meaningful
 *      when it runs with the SITE_URL the site really serves on.
 *   2. the shape of the basket - the body is deserialized BEFORE the return
 *      address is looked at, so a body اسنپ‌پی cannot read answers 1005 and
 *      never reaches the 1051 check. That ordering is what makes the probe
 *      below readable both ways: a 1051 is itself proof that the cart shape was
 *      accepted.
 *
 * The basket is one line at the smallest amount اسنپ‌پی just said it would
 * finance, shaped exactly the way `snapppayItems()` shapes one - including the
 * numeric `id`, which is the whole point: اسنپ‌پی refuses a cuid there with 1005,
 * so this check is what stands between a code change and every checkout
 * silently failing.
 */
console.log("─── a real token request (nothing is charged) ───");

const PROBE_MOBILE = "+989121117755";
/** FNV-1a folded to 31 bits - the same function as `numericLineId` in src/lib/snapppay-cart.ts. */
const numericLineId = (id) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 1) || 1;
};

// a cuid, like OrderItem.id - hashed the way the app hashes it
const PROBE_ITEM_ID = numericLineId("cmg2q8x1t0000abcd1234wxyz");
const SHAPE = "basket shape as checkout sends it (numeric line id, commissionType 100)";
const newRef = () => String(Math.floor(100_000_000 + Math.random() * 900_000_000));
const returnURL = `${SITE}/api/payment/snapppay/callback`;
const probeToman = smallestEligible || 500_000;
const probeRial = probeToman * 10;

const tokenProbe = async (itemId, transactionId) => {
  const { res, data } = await api("POST", "/api/online/payment/v1/token", {
    amount: probeRial,
    mobile: PROBE_MOBILE,
    returnURL,
    transactionId,
    discountAmount: 0,
    externalSourceAmount: 0,
    cartList: [
      {
        cartId: 1,
        isShipmentIncluded: true,
        isTaxIncluded: true,
        shippingAmount: 0,
        taxAmount: 0,
        totalAmount: probeRial,
        cartItems: [
          {
            id: itemId,
            name: "بررسی پیش‌پرواز",
            amount: probeRial,
            count: 1,
            category: "پوشاک",
            commissionType: 100,
          },
        ],
      },
    ],
  });
  return { created: res.ok && data?.successful === true, status: res.status, ...errOf(data) };
};

/** Said wherever the run ends up creating one, so nobody goes looking for it. */
const announce = (ref) => {
  console.log(`   NOTE  a live payment token was created, transactionId ${ref}`);
  console.log(`         (${fa(probeToman)} تومان). Nothing to clean up: an unpaid token is never`);
  console.log("         charged and expires by itself. It is not stored, and not printed.");
};

const ref = newRef();
const asCheckoutSendsIt = await tokenProbe(PROBE_ITEM_ID, ref);

if (asCheckoutSendsIt.created) {
  check(SHAPE, true);
  check(`returnURL accepted — ${returnURL}`, true);
  announce(ref);
} else if (asCheckoutSendsIt.code === 1051) {
  // The body was read and liked; only the address was refused.
  check(SHAPE, true, "body deserialized");
  check(`returnURL accepted — ${returnURL}`, false, `1051 ${asCheckoutSendsIt.message}`);
  console.log(
    "         آدرس بازگشت با آدرس ثبت‌شده نزد اسنپ‌پی هم‌خوانی ندارد.\n" +
      `         SnappPay refuses every returnURL outside the registered base. SITE_URL is ${SITE};\n` +
      "         run this on the production server, or have SnappPay register this base — a form\n" +
      "         plus a ticket at portal.snapppay.ir, and it cannot be changed from here."
  );
} else if (asCheckoutSendsIt.code === 1005 && asCheckoutSendsIt.field === "mobile") {
  check(SHAPE, false, `1005 ${asCheckoutSendsIt.message}`);
  console.log(
    `         the probe's own mobile (${PROBE_MOBILE}) was refused; it must match \\+98\\d{10}.`
  );
} else if (asCheckoutSendsIt.code === 1005) {
  // 1005 with no errorField is «couldn't deserialize the request body».
  check(SHAPE, false, `1005 ${asCheckoutSendsIt.message}`);
  console.log(
    "         اسنپ‌پی همین سبد را از سایت هم رد می‌کند — یعنی هیچ خرید قسطی‌ای ثبت نخواهد شد.\n" +
      "         The basket the checkout page builds is refused outright. Compare what\n" +
      "         `snapppayItems()` sends with the doc's cartItems, field by field — stage takes\n" +
      "         cartItems[].id only as a number, and a cuid is refused there."
  );
  // Ask again with a numeric id, so the returnURL still gets an answer today.
  const ref2 = newRef();
  const numeric = await tokenProbe(1, ref2);
  if (numeric.created) {
    check(`returnURL accepted — ${returnURL}`, true, "probed with a numeric item id");
    announce(ref2);
  } else {
    check(
      `returnURL accepted — ${returnURL}`,
      false,
      `${numeric.code || `HTTP ${numeric.status}`} ${numeric.message}`
    );
  }
} else {
  check(SHAPE, false, `HTTP ${asCheckoutSendsIt.status} ${asCheckoutSendsIt.message}`);
  if (asCheckoutSendsIt.code === 1009) {
    console.log(`         transactionId ${ref} has been used before — run again for a new one.`);
  }
}

// ─── unsettled purchases ───────────────────────────────────────────
// ─── reconcile: attempts whose callback never arrived ──────────────
//
// The callback is the only thing that normally moves a SnappPay attempt out of
// PENDING, and it claims the row into VERIFYING before it calls anything. Two
// ordinary events leave a row stranded there forever:
//
//   • the buyer paid but the browser never came back - the tab was closed, or
//     the POST never reached the VPS;
//   • the Node process restarted (a deploy, an OOM kill) between the claim and
//     the write that follows it.
//
// In both cases اسنپ‌پی has taken the buyer's credit and the shop knows nothing.
// Get Payment Status is the authority the doc requires us to consult «بصورت
// خودکار در کد ... به دلیل عدم مغایرت», and this is where that happens for
// attempts no callback will ever come back for.
//
//   node tools/snapppaycheck.mjs --reconcile        # report only
//   node tools/snapppaycheck.mjs --reconcile --fix  # act on what اسنپ‌پی says
const wantReconcile = process.argv.includes("--reconcile") || process.argv.includes("--settle");
const doFix = process.argv.includes("--fix") || process.argv.includes("--settle");

if (wantReconcile) {
  console.log("─── attempts with no result yet (استعلام وضعیت) ───");
  const { PrismaClient } = await import("@prisma/client");
  // The app's own fulfilment, loaded as-is. Two hints are needed for that:
  // `server-only` is a marker package that throws outside a Server Component,
  // and `@/lib/x` is a tsconfig path Node has never heard of. Node strips the
  // types by itself. Same shim as tools/snapppaytest.mjs.
  const { register } = await import("node:module");
  const SRC = new URL("../src/", import.meta.url).href;
  register(
    "data:text/javascript," +
      encodeURIComponent(
        `const SRC = ${JSON.stringify(SRC)};
         export function resolve(specifier, context, next) {
           if (specifier === "server-only") {
             return { url: "data:text/javascript,", shortCircuit: true };
           }
           if (specifier.startsWith("@/")) return next(SRC + specifier.slice(2) + ".ts", context);
           // the app writes relative imports without an extension ("./db"),
           // which Node only accepts once it is told which file that is - 
           // everything under src/ is TypeScript
           const last = specifier.split("/").pop();
           if (specifier.startsWith(".") && !last.includes(".")) {
             return next(specifier + ".ts", context);
           }
           return next(specifier, context);
         }`
      )
  );
  const { fulfilPaidOrder } = await import(`${SRC}lib/fulfil.ts`);
  const db = new PrismaClient();

  // Give a payment in flight a few minutes before calling it stranded - a
  // buyer still on اسنپ‌پی's page is a PENDING row that is perfectly healthy.
  const STALE_MINUTES = 20;
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000);

  const stranded = await db.payment.findMany({
    where: {
      provider: "SNAPPPAY",
      status: { in: ["PENDING", "VERIFYING", "SETTLEMENT_PENDING"] },
      token: { not: null },
      createdAt: { lt: cutoff },
    },
    include: { order: { select: { id: true, status: true, total: true, fullName: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (stranded.length === 0) {
    check(`no اسنپ‌پی attempt older than ${STALE_MINUTES} minutes is still unresolved`, true);
  } else {
    console.log(
      `   ${stranded.length} attempt(s) older than ${STALE_MINUTES} minutes with no result — asking اسنپ‌پی\n`
    );
  }

  for (const p of stranded) {
    const label = `${p.resNum} (${fa(p.amountRial / 10)} تومان، سفارش ${p.orderId.slice(-8).toUpperCase()})`;
    const { res, data } = await api(
      "GET",
      `/api/online/payment/v1/status?paymentToken=${encodeURIComponent(p.token)}`
    );
    const state = data?.successful === true ? String(data.response?.status ?? "") : "";

    if (!state) {
      const e = errOf(data);
      console.log(
        `   ?     ${label} — استعلام ناموفق: HTTP ${res.status} ${e.code || ""} ${e.message}`.trimEnd()
      );
      differs("status could not be read", label);
      continue;
    }

    // What each answer means for a row the callback never finished.
    if (state === "PENDING") {
      console.log(`   ·     ${label} — هنوز نزد اسنپ‌پی PENDING است؛ دست نخورد.`);
      continue;
    }

    if (state === "REVERT" || state === "CANCEL") {
      console.log(`   ✓     ${label} — ${state}: پول برگشته، چیزی بدهکار نیستیم.`);
      if (doFix) {
        await db.payment.update({
          where: { id: p.id },
          data: {
            status: "REVERSED",
            message: `استعلام وضعیت: ${state} — مبلغ به اعتبار مشتری برگشته بود.`,
          },
        });
      }
      continue;
    }

    // VERIFY or SETTLE - the buyer's credit HAS been taken and the goods are
    // owed. This is the case that must never stay invisible.
    console.log(
      `   ⚠     ${label} — اسنپ‌پی می‌گوید ${state}: مبلغ از مشتری کم شده و سفارش «${p.order?.status}» مانده.`
    );
    if (!doFix) {
      console.log("         با --fix تسویه و نهایی‌سازی انجام می‌شود.");
      differs("paid attempt left unfinished", label);
      continue;
    }

    let settled = state === "SETTLE";
    if (!settled) {
      const { data: sd } = await api("POST", "/api/online/payment/v1/settle", {
        paymentToken: p.token,
      });
      settled = sd?.successful === true;
      console.log(`         settle → ${settled ? "ok" : errOf(sd).message || "ناموفق"}`);
    }

    await db.payment.update({
      where: { id: p.id },
      data: {
        status: settled ? "PAID" : "SETTLEMENT_PENDING",
        paidAt: settled ? (p.paidAt ?? new Date()) : null,
        settledAt: settled ? new Date() : null,
        message: settled ? null : "پرداخت تأیید شد اما تسویه با اسنپ‌پی انجام نشد.",
      },
    });
    // Exactly the call the callback makes, so points, stock and coupon usage
    // land the same way whichever path finished the order.
    if (!settled) {
      console.log("         تسویه تأیید نشد؛ سفارش نهایی نشد و باید دوباره استعلام شود.");
      continue;
    }
    const done = await fulfilPaidOrder(p.orderId);
    console.log(`         سفارش ${done ? "نهایی شد ✓" : "قبلاً نهایی شده بود"}`);
  }

  await db.$disconnect();
  console.log("");
}

const wantUnsettled = process.argv.includes("--unsettled") || process.argv.includes("--settle");
const doSettle = process.argv.includes("--settle");

if (wantUnsettled) {
  console.log(`─── verified but NOT settled ───`);
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const rows = await db.payment.findMany({
    where: { provider: "SNAPPPAY", status: "PAID", settledAt: null },
    orderBy: { paidAt: "asc" },
  });

  if (rows.length === 0) {
    console.log("   none — every verified purchase is settled.");
  }
  for (const p of rows) {
    const label = `#${p.orderId.slice(-8).toUpperCase()} ${fa(p.amountRial / 10)} تومان`;
    if (!doSettle) {
      console.log(`   UNSETTLED  ${label}  (paid ${p.paidAt?.toISOString() ?? "?"})`);
      continue;
    }
    if (!p.token) {
      console.log(`   SKIP  ${label} — no paymentToken stored, settle by hand in the portal`);
      continue;
    }
    /** Written whichever way it goes, so a refusal reads as clearly as a success. */
    const record = (status, code, message) =>
      db.paymentOperation.create({
        data: {
          paymentId: p.id,
          kind: "SETTLE",
          status,
          code: code || null,
          amountRial: p.amountRial,
          message,
          // Nobody pressed a button: a tool sent this one.
          userId: null,
          userName: null,
        },
      });
    try {
      const { res, data } = await api("POST", "/api/online/payment/v1/settle", {
        paymentToken: p.token,
      });
      const e = errOf(data);
      let ok = res.ok && data?.successful === true;
      let how = "تسویهٔ دستی با tools/snapppaycheck.mjs";

      // The doc's recovery path (p.20–21): a settle that answers false may still
      // have gone through, and Get Payment Status is the authority on that.
      if (!ok) {
        const asked = await api(
          "GET",
          `/api/online/payment/v1/status?paymentToken=${encodeURIComponent(p.token)}`
        );
        const said = String(asked.data?.response?.status ?? "").toUpperCase();
        if (said === "SETTLE") {
          ok = true;
          how = "تسویه از پیش نزد اسنپ‌پی ثبت شده بود (طبق استعلام وضعیت).";
        }
      }

      if (ok) {
        await db.payment.update({
          where: { id: p.id },
          data: { settledAt: new Date(), message: null },
        });
        await record("OK", 0, how);
        console.log(`   SETTLED  ${label} — ${how}`);
        passes++;
      } else {
        await record("FAILED", e.code, `تسویهٔ دستی ناموفق بود — ${e.message || `HTTP ${res.status}`}`);
        console.log(
          `   FAIL  ${label} — HTTP ${res.status} ${JSON.stringify(data?.errorData ?? {})}`
        );
        failed.push(`settle ${label}`);
        fails++;
      }
    } catch (err) {
      await record("FAILED", 0, `تسویهٔ دستی ناموفق بود — ${err.message}`).catch(() => {});
      console.log(`   FAIL  ${label} — ${err.message}`);
      failed.push(`settle ${label}`);
      fails++;
    }
  }
  await db.$disconnect();
}

// ─── summary ───────────────────────────────────────────────────────
console.log("─── summary ───");
console.log(
  `   ${passes} passed, ${fails} failed` +
    (diffs ? `, ${diffs} differing from the figures measured on stage` : "")
);
for (const f of failed) console.log(`   ✗  ${f}`);

console.log(
  fails
    ? `\nNOT ready — fix the above before certification.\n`
    : `\nAll checks passed. SNAPPPAY_ENABLED=${env.SNAPPPAY_ENABLED ?? "0"}\n`
);
process.exit(fails ? 1 : 0);
