import "server-only";

/**
 * Alerts the shop owner the moment an order is paid, so she doesn't have to sit
 * watching the admin panel.
 *
 * Telegram works today and costs nothing: create a bot with @BotFather, send it
 * a message, then put the token and your chat id in .env as TELEGRAM_BOT_TOKEN
 * and TELEGRAM_CHAT_ID. If those are unset this quietly does nothing.
 *
 * To send an SMS instead, add the provider call where marked once the SMS panel
 * is connected.
 */
export async function notifyShopOwner(
  orderId: string,
  customer: string,
  totalToman: number
) {
  const text =
    `🎉 سفارش جدید در موآی گالری\n\n` +
    `مشتری: ${customer}\n` +
    `مبلغ: ${totalToman.toLocaleString("fa-IR")} تومان\n` +
    `کد پیگیری: ${orderId.slice(-8).toUpperCase()}`;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (token && chatId) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      // never let a failed notification affect the customer's payment
    }
  }

  // TODO(SMS_API): optionally also text the owner here.

  console.log(`[order] ${text.replace(/\n/g, " · ")}`);
}
