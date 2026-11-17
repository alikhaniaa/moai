/**
 * The money conversion for دیجی‌پی, kept free of `server-only` and of any
 * environment access so `tools/digipaytest.mjs` can import and check it
 * directly. `src/lib/digipay.ts` re-exports both of these.
 */

/**
 * Prices are stored in Toman; DigiPay, like every Iranian gateway, takes Rial.
 *
 * The UPG document never actually states the unit - this follows the Iranian
 * banking convention and matches what the SEP integration does. It is
 * deliberately the ONLY place the conversion happens, so if a first real
 * payment ever shows a 10× discrepancy, this one function is the fix.
 */
export const tomanToRial = (toman: number) => toman * 10;

/** IPG = an ordinary card payment. 11 = wallet, 5 = credit, 13 = BNPL. */
export const TYPE_IPG = 0;
