/**
 * Open a session for the test suites without spending an SMS request.
 *
 * `/api/auth/otp/request` allows 5 calls per IP per 10 minutes - a real guard,
 * because every one of them costs the shop an SMS. The suites between them need
 * more than that, so only tools/paytest.mjs drives the true request→verify login
 * through the browser; everything else seeds the code row directly and then goes
 * through the REAL `/api/auth/otp/verify`, which allows 20.
 *
 * Nothing here weakens the site: no endpoint is bypassed and no password is
 * left behind on an account. It only skips the step that would send a text.
 */
/**
 * One address per test process.
 *
 * The auth guards count per IP - 5 requests and 20 verifies per 10 minutes - so
 * running the suite twice inside that window would exhaust them and every suite
 * would fail at the login step for a reason that has nothing to do with what it
 * is testing. A fresh address per run keeps each run honest while leaving the
 * guards fully in force for real traffic (in production Caddy overwrites
 * X-Real-Ip with the true peer, so this cannot be done from outside).
 */
export const TEST_IP =
  "203.0." + (1 + Math.floor(Math.random() * 250)) + "." + (1 + Math.floor(Math.random() * 250));

export async function signIn(db, base, phone) {
  const code = String(Math.floor(10000 + Math.random() * 90000));
  await db.otp.deleteMany({ where: { phone } });
  await db.otp.create({
    data: { phone, code, expiresAt: new Date(Date.now() + 5 * 60_000) },
  });

  const res = await fetch(`${base}/api/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Real-Ip": TEST_IP },
    body: JSON.stringify({ phone, code }),
  });

  const pair = (res.headers.get("set-cookie") ?? "").split(";")[0];
  const at = pair.indexOf("=");
  return {
    ok: res.ok && at > 0,
    /** ready for a `Cookie:` header */
    cookie: pair,
    /** ready for puppeteer's page.setCookie() */
    name: pair.slice(0, at),
    value: pair.slice(at + 1),
  };
}

/** Same, but also hands the session to an open puppeteer page. */
export async function signInBrowser(db, base, phone, page) {
  const session = await signIn(db, base, phone);
  if (session.ok) {
    await page.setCookie({
      name: session.name,
      value: session.value,
      domain: new URL(base).hostname,
      path: "/",
    });
  }
  return session;
}
