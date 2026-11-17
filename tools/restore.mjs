/**
 * Restore the shop from a backup folder made by tools/backup.mjs.
 *
 *   node tools/restore.mjs backups/moai-backup-2026-07-21_19-21
 *
 * STOP THE WEBSITE FIRST (Ctrl+C on the server) - Windows will not let the
 * database file be replaced while it is open, and on Linux a running server
 * would keep serving the old data from its open handle.
 *
 * The current database is never thrown away: it is renamed with a .before-restore
 * suffix, so a mistaken restore can still be undone.
 */
import { copyFile, rename, cp, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const src = process.argv[2];
if (!src) {
  console.error("usage: node tools/restore.mjs <backup-folder>");
  process.exit(1);
}

const root = process.cwd();
const backupDb = path.join(src, "moai.db");
const liveDb = path.join(root, "prisma", "dev.db");

if (!existsSync(backupDb)) {
  console.error(`no database found at ${backupDb}`);
  process.exit(1);
}

try {
  if (existsSync(liveDb)) {
    const aside = `${liveDb}.before-restore-${Date.now()}`;
    await rename(liveDb, aside);
    console.log(`· previous database kept at ${path.basename(aside)}`);
  }

  await copyFile(backupDb, liveDb);
  console.log("✓ database restored");

  const backupUploads = path.join(src, "uploads");
  if (existsSync(backupUploads)) {
    const liveUploads = path.join(root, "public", "uploads");
    await mkdir(liveUploads, { recursive: true });
    await cp(backupUploads, liveUploads, { recursive: true });
    console.log("✓ uploaded photos restored");
  }

  console.log(
    "\nDone. If .env was lost too, copy env.txt from the backup back to .env," +
      "\nthen start the site again (npm run build && npx next start)."
  );
} catch (err) {
  console.error("RESTORE FAILED:", err.message);
  process.exit(1);
}
