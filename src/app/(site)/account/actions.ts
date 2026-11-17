"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser, destroySession, hashPassword } from "@/lib/auth";
import { repriceOrder } from "@/lib/snapppay-cart";

export async function updateName(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length >= 2) {
    await db.user.update({ where: { id: user.id }, data: { name } });
  }
  revalidatePath("/account");
}

export async function updateAddress(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const g = (k: string) => String(formData.get(k) ?? "").trim() || null;
  await db.user.update({
    where: { id: user.id },
    data: {
      name: String(formData.get("name") ?? "").trim() || user.name,
      email: g("email"),
      province: g("province"),
      city: g("city"),
      address: g("address"),
      unit: g("unit"),
      postalCode: g("postalCode"),
    },
  });
  revalidatePath("/account");
}

export async function setPassword(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const password = String(formData.get("password") ?? "");
  if (password.length >= 6) {
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(password) },
    });
  }
  revalidatePath("/account");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

// ── درخواست مشتری برای تغییر/لغو سفارش اسنپ‌پی ──────────────────

async function customerSnapppayOrder(orderId: string, userId: string) {
  const order = await db.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) return { error: "notfound" } as const;
  if (order.paymentMethod !== "SNAPPPAY_IPG") return { error: "noteligible" } as const;
  if (!["PAID", "DISPATCHING", "SHIPPED", "DELIVERED"].includes(order.status)) {
    return { error: "closed" } as const;
  }
  const payment = order.payments.find(
    (p) => p.provider === "SNAPPPAY" && p.status === "PAID" && p.token && p.settledAt
  );
  if (!payment) return { error: "notready" } as const;
  return { order, payment };
}

async function createChangeRequest(data: {
  orderId: string;
  userId: string;
  kind: "UPDATE" | "CANCEL";
  requestedItems: string;
  summary: string;
}) {
  try {
    await db.snappPayChangeRequest.create({
      data: { ...data, pendingKey: data.orderId },
    });
    return true;
  } catch (error) {
    // `pendingKey` is unique. This is both a friendly duplicate-tab guard and
    // a real concurrency guarantee; never replace an earlier open request.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return false;
    }
    throw error;
  }
}

export async function requestSnapppayUpdate(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");
  const orderId = String(formData.get("id") ?? "");
  if (!orderId) redirect("/account?snappRequest=notfound");

  const found = await customerSnapppayOrder(orderId, user.id);
  if ("error" in found) redirect(`/account?snappRequest=${found.error}`);
  const { order } = found;

  const lines = order.items.map((item) => {
    const raw = formData.get(`qty:${item.id}`);
    const asked = raw === null ? item.qty : Math.round(Number(raw) || 0);
    return { ...item, newQty: Math.max(0, Math.min(item.qty, asked)) };
  });
  const changed = lines.filter((line) => line.newQty !== line.qty);
  if (changed.length === 0) redirect("/account?snappRequest=nochange");
  if (lines.every((line) => line.newQty === 0)) redirect("/account?snappRequest=emptycart");

  const priced = repriceOrder(
    lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      nameFa: line.nameFa,
      sizeLabel: line.sizeLabel,
      colorName: line.colorName,
      unitPrice: line.unitPrice,
      qty: line.newQty,
    })),
    {
      goodsTotal: order.goodsTotal,
      discount: order.discount,
      shippingCost: order.shippingCost,
    }
  );
  if (priced.total >= order.total) redirect("/account?snappRequest=nochange");

  const requestedItems = JSON.stringify(lines.map((line) => ({ id: line.id, qty: line.newQty })));
  const summary = changed
    .map((line) =>
      line.newQty === 0
        ? `حذف ${line.nameFa}`
        : `${line.nameFa}: ${line.qty} ← ${line.newQty}`
    )
    .join("، ");
  const created = await createChangeRequest({
    orderId,
    userId: user.id,
    kind: "UPDATE",
    requestedItems,
    summary: `${summary} — بازگشت تقریبی ${order.total - priced.total} تومان`,
  });

  revalidatePath("/account");
  revalidatePath(`/admin/orders/${orderId}`);
  redirect(`/account?snappRequest=${created ? "created" : "pending"}#order-${orderId}`);
}

export async function requestSnapppayCancel(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");
  const orderId = String(formData.get("id") ?? "");
  if (!orderId) redirect("/account?snappRequest=notfound");

  const found = await customerSnapppayOrder(orderId, user.id);
  if ("error" in found) redirect(`/account?snappRequest=${found.error}`);
  const created = await createChangeRequest({
    orderId,
    userId: user.id,
    kind: "CANCEL",
    requestedItems: "[]",
    summary: `درخواست لغو کامل سفارش و بازگشت ${found.order.total} تومان`,
  });

  revalidatePath("/account");
  revalidatePath(`/admin/orders/${orderId}`);
  redirect(`/account?snappRequest=${created ? "created" : "pending"}#order-${orderId}`);
}

export async function withdrawSnapppayRequest(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");
  const requestId = String(formData.get("requestId") ?? "");
  const request = requestId
    ? await db.snappPayChangeRequest.findFirst({
        where: { id: requestId, userId: user.id, status: "PENDING" },
      })
    : null;
  if (!request) redirect("/account?snappRequest=notfound");

  await db.snappPayChangeRequest.update({
    where: { id: request.id },
    data: {
      status: "WITHDRAWN",
      pendingKey: null,
      reviewedAt: new Date(),
      resolution: "درخواست توسط مشتری پس گرفته شد.",
    },
  });
  revalidatePath("/account");
  revalidatePath(`/admin/orders/${request.orderId}`);
  redirect(`/account?snappRequest=withdrawn#order-${request.orderId}`);
}
