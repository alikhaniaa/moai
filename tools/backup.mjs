/**
 * Full backup of everything the shop cannot be rebuilt without.
 *
 *   node tools/backup.mjs [destination-folder]
 *
 * Produces  backups/moai-backup-YYYY-MM-DD_HH-mm/
 *   ├── moai.db      every order, customer, product, payment, setting
 *   ├── uploads/     photos uploaded through the admin panel
 *   └── env.txt      keys/secrets (terminal id, session secret …)
 *
 * The database is copied with SQLite's `VACUUM INTO`, which writes a
 * transactionally consistent snapshot. Plain file copies of a live SQLite
 * database can capture a half-written transaction and restore as corrupt.
 */
import { PrismaClient } from "@prisma/client";
import { mkdir, cp, copyFile, readdir } from "fs/promises";
import { existsSync, statSync } from "fs";
import path from "path";

const root = process.cwd();
const stamp = new Date()
  .toISOString()
  .slice(0, 16)
  .replace("T", "_")
  .replace(":", "-");

const destRoot = process.argv[2] ?? path.join(root, "backups");
const dest = path.join(destRoot, `moai-backup-${stamp}`);

const mb = (p) => (statSync(p).size / 1024 / 1024).toFixed(2) + " MB";

const db = new PrismaClient();

try {
  await mkdir(dest, { recursive: true });

  // 1. database - consistent snapshot, safe while the site is running
  const dbOut = path.join(dest, "moai.db").replace(/\\/g, "/");
  await db.$executeRawUnsafe(`VACUUM INTO '${dbOut}'`);
  console.log(`✓ database   ${mb(dbOut)}`);

  // 2. uploaded photos
  const uploads = path.join(root, "public", "uploads");
  if (existsSync(uploads)) {
    await cp(uploads, path.join(dest, "uploads"), { recursive: true });
    const n = (await readdir(uploads)).length;
    console.log(`✓ uploads    ${n} file(s)`);
  } else {
    console.log("· uploads    none yet");
  }

  // 3. secrets and configuration
  const env = path.join(root, ".env");
  if (existsSync(env)) {
    await copyFile(env, path.join(dest, "env.txt"));
    console.log("✓ .env       saved as env.txt");
  }

  // quick inventory, so a backup can be sanity-checked at a glance
  const counts = {
    users: await db.user.count(),
    orders: await db.order.count(),
    payments: await db.payment.count(),
    products: await db.product.count(),
  };
  console.log(
    `\nBackup complete → ${dest}\n` +
      `  ${counts.orders} orders · ${counts.payments} payments · ` +
      `${counts.users} users · ${counts.products} products`
  );
} catch (err) {
  console.error("BACKUP FAILED:", err.message);
  process.exit(1);
} finally {
  await db.$disconnect();
}
