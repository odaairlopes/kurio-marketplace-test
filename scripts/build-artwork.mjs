// Gera as artes dos NFTs servidas em public/nft a partir dos originais (1254 px) em artwork/.
// Duas resoluções por arte: 800 px (detalhe, hero, telas 2x) e 400 px (cards e miniaturas).
// Uso: node scripts/build-artwork.mjs
import { mkdirSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "artwork");
const outDir = join(root, "public", "nft");
mkdirSync(outDir, { recursive: true });

const SIZES = [
  { suffix: "", size: 800, quality: 86 },
  { suffix: "-sm", size: 400, quality: 82 },
];

for (const file of readdirSync(srcDir).filter((f) => /\.(webp|png|jpe?g)$/i.test(f))) {
  const name = basename(file).replace(/\.[^.]+$/, "");
  for (const { suffix, size, quality } of SIZES) {
    const out = join(outDir, `${name}${suffix}.webp`);
    await sharp(join(srcDir, file))
      .resize(size, size, { fit: "cover", kernel: "lanczos3" })
      .webp({ quality, effort: 6, smartSubsample: true })
      .toFile(out);
    console.log("✓", out);
  }
}
