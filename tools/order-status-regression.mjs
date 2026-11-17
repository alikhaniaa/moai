// Isolated checks: no database, SMS, payment gateway, or HTTP server is contacted.
// Run with Node 24: node tools/order-status-regression.mjs
import assert from "node:assert/strict";
import { register } from "node:module";

const SRC = new URL("../src/", import.meta.url).href;
register("data:text/javascript," + encodeURIComponent(`
const src = ${JSON.stringify(SRC)};
const mocks = {
  '@/lib/db': 'export const db = globalThis.__orderStatusTest.db',
  '@/lib/auth': 'export async function requireAdmin(){return globalThis.__orderStatusTest.admin} export async function getSessionUser(){return {id:"buyer"}} export async function destroySession(){} export function hashPassword(){throw new Error("unexpected password change")}',
  'next/cache': 'export function revalidatePath(path){globalThis.__orderStatusTest.revalidated.push(path)}',
  'next/navigation': 'export function redirect(url){throw new Error("REDIRECT:"+url)}',
  '@/lib/club': 'export function pointsForOrder(){throw new Error("dispatch must not grant points")}',
  '@/lib/club-data': 'export async function getClubConfig(){throw new Error("dispatch must not approve payment")}',
  '@/lib/stock': 'export function takeStock(){throw new Error("dispatch must not reserve stock again")} export function returnStock(){globalThis.__orderStatusTest.stockReturns++;return []} export async function syncProductStock(){}',
  '@/lib/variants': 'export function safeHex(){} export async function syncVariantPrices(){}',
  '@/lib/snapppay-api': 'export async function update(){throw new Error("unexpected gateway call")} export async function cancel(){throw new Error("unexpected gateway call")} export async function paymentStatus(){throw new Error("unexpected gateway call")} export function tomanToRial(n){return n*10}'
};
export function resolve(specifier, context, next) {
  if(specifier === 'server-only') return {url:'data:text/javascript,',shortCircuit:true};
  if(specifier === './db' && context.parentURL === src+'lib/coupon.ts') specifier = '@/lib/db';
  if(mocks[specifier]) return {url:'data:text/javascript,'+encodeURIComponent(mocks[specifier]),shortCircuit:true};
  if(specifier.startsWith('@/')) return next(src+specifier.slice(2)+'.ts',context);
  return next(specifier,context);
}
`));

const state = globalThis.__orderStatusTest = {
  admin: { id: "admin" },
  order: null,
  stockReturns: 0,
  revalidated: [],
  requests: [],
  coupon: {
    id: "coupon", code: "ONCE", active: true, startsAt: null, endsAt: null,
    maxUses: null, usedCount: 1, userId: null, allowInstallments: true,
    minSubtotal: 0, perUserLimit: 1, type: "FIXED", value: 1000,
    freeShipping: false,
  },
};
state.db = {
  order: {
    findUnique: async () => state.order,
    findFirst: async () => state.order,
    update: async ({ data }) => Object.assign(state.order, data),
    count: async ({ where }) =>
      state.order.userId === where.userId && state.order.couponId === where.couponId &&
      where.status.in.includes(state.order.status) ? 1 : 0,
  },
  coupon: { findUnique: async () => state.coupon },
  snappPayChangeRequest: { create: async ({ data }) => { state.requests.push(data); return data; } },
  $transaction: async (operations) => Promise.all(operations),
};

const { setOrderStatus, setTracking } = await import(SRC + "app/admin/actions.ts");
const { requestSnapppayCancel, requestSnapppayUpdate } = await import(SRC + "app/(site)/account/actions.ts");
const { applyCoupon } = await import(SRC + "lib/coupon.ts");
const { ORDER_STATUS_FA, ORDER_STATUS_COLOR } = await import(SRC + "lib/format.ts");
assert.equal(ORDER_STATUS_FA.DISPATCHING, "در حال آماده سازی");
assert.ok(ORDER_STATUS_COLOR.DISPATCHING);

const form = (fields) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const paidOrder = (paymentMethod = "CARD") => ({
  id: "order", userId: "buyer", paymentMethod, status: "PAID", couponId: "coupon",
  pointsAwarded: true, stockApplied: true, snapppayApprovedAt: null,
  total: 40000, goodsTotal: 40000, discount: 0, shippingCost: 0,
  items: [{ id: "item", productId: "product", qty: 2, unitPrice: 20000, nameFa: "کالا" }],
  payments: [{ provider: "SNAPPPAY", status: "PAID", token: "test", settledAt: new Date() }],
});

for (const paymentMethod of ["GATEWAY", "CARD", "SNAPPPAY", "SNAPPPAY_IPG", "DIGIPAY"]) {
  for (const save of [setOrderStatus, setTracking]) {
    state.order = paidOrder(paymentMethod);
    state.stockReturns = 0;
    const fields = { id: "order", status: "DISPATCHING", trackingCode: "12345" };
    await save(form(fields));
    await save(form(fields));
    assert.equal(state.order.status, "DISPATCHING");
    assert.equal(state.order.trackingCode, "12345");
    assert.equal(state.order.pointsAwarded, true);
    assert.equal(state.order.stockApplied, true);
    assert.equal(state.stockReturns, 0);
    assert.ok(state.revalidated.includes("/account"));
    await save(form({ ...fields, status: "SHIPPED" }));
    assert.equal(state.order.status, "SHIPPED");
  }
}
console.log("PASS: both admin forms accept dispatching for all five payment methods; repeat saves preserve payment, points, and stock");

state.order = { ...paidOrder(), status: "DISPATCHING" };
await setTracking(form({ id: "order", trackingCode: "12345" }));
assert.equal(state.order.status, "SHIPPED");
state.order.status = "DISPATCHING";
await setTracking(form({ id: "order" }));
assert.equal(state.order.status, "DISPATCHING");
console.log("PASS: tracking-only updates advance dispatching when a tracking code is supplied");

for (const save of [setOrderStatus, setTracking]) {
  state.order = { ...paidOrder(), status: "DISPATCHING" };
  state.stockReturns = 0;
  await save(form({ id: "order", status: "CANCELLED" }));
  await save(form({ id: "order", status: "CANCELLED" }));
  assert.equal(state.order.status, "CANCELLED");
  assert.equal(state.order.stockApplied, false);
  assert.equal(state.stockReturns, 1);
}
console.log("PASS: cancelling a dispatching order returns stock once through either admin form");

state.order = { ...paidOrder(), status: "DISPATCHING" };
assert.equal((await applyCoupon("ONCE", 40000, "buyer", "CARD")).ok, false);
state.order.status = "AWAITING_PAYMENT";
assert.equal((await applyCoupon("ONCE", 40000, "buyer", "CARD")).ok, true);
console.log("PASS: dispatching purchases consume the per-customer coupon allowance; unpaid purchases do not");

state.order = { ...paidOrder("SNAPPPAY_IPG"), status: "DISPATCHING" };
await assert.rejects(requestSnapppayCancel(form({ id: "order" })), /snappRequest=created/);
await assert.rejects(requestSnapppayUpdate(form({ id: "order", "qty:item": "1" })), /snappRequest=created/);
assert.deepEqual(state.requests.map((request) => request.kind), ["CANCEL", "UPDATE"]);
assert.equal(state.order.status, "DISPATCHING");
console.log("PASS: dispatching SnappPay orders retain customer cancellation and change requests");

state.admin = null;
await assert.rejects(setOrderStatus(form({ id: "order", status: "SHIPPED" })), /REDIRECT:\/login/);
await assert.rejects(setTracking(form({ id: "order", status: "SHIPPED" })), /REDIRECT:\/login/);
assert.equal(state.order.status, "DISPATCHING");
console.log("PASS: both status-saving actions still require an admin");
