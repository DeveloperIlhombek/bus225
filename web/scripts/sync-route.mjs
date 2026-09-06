/**
 * data/route.json -> web/public/route.json
 *
 * Loyihada yagona ma'lumot manbai bor: repo ildizidagi `data/route.json`.
 * Bot uni to'g'ridan-to'g'ri o'qiydi, frontend esa statik fayl sifatida
 * `public/` orqali xizmat qiladi. Bu skript ikkalasini sinxron ushlab turadi
 * va `dev`/`build` dan oldin avtomatik ishga tushadi.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "../../data/route.json");
const target = resolve(here, "../public/route.json");

try {
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  console.log(`✓ route.json sinxronlandi: ${source} -> ${target}`);
} catch (error) {
  console.error(`✗ route.json ni ko'chirib bo'lmadi: ${error.message}`);
  process.exit(1);
}
