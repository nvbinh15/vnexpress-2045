// Convert all hero JPEGs in public/images to AVIF for ~50% additional
// payload reduction. Browsers since ~2022 (Safari 16+, Chrome 85+,
// Firefox 93+) support AVIF; below that share is negligible for our
// audience.
//
// Run: node scripts/convert-to-avif.mjs

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const IMAGES_DIR = path.join(ROOT, "public/images");
const QUALITY = 60;

const files = (await fs.readdir(IMAGES_DIR)).filter(
  (f) => /\.(jpe?g|png)$/i.test(f) && !f.includes("@sm"),
);

let totalBefore = 0;
let totalAfter = 0;

for (const file of files) {
  const fullPath = path.join(IMAGES_DIR, file);
  const before = (await fs.stat(fullPath)).size;
  totalBefore += before;

  const buf = await fs.readFile(fullPath);
  const avif = await sharp(buf)
    .avif({ quality: QUALITY, effort: 4 })
    .toBuffer();
  const outPath = fullPath.replace(/\.(jpe?g|png)$/i, ".avif");
  await fs.writeFile(outPath, avif);

  totalAfter += avif.length;
  console.log(
    `${file}: ${(before / 1024).toFixed(0)} KB → ${(avif.length / 1024).toFixed(
      0,
    )} KB (${((avif.length / before) * 100).toFixed(0)}%)`,
  );
}

console.log(
  `\ntotal: ${(totalBefore / 1024 / 1024).toFixed(1)} MB → ${(
    totalAfter /
    1024 /
    1024
  ).toFixed(1)} MB (${((totalAfter / totalBefore) * 100).toFixed(0)}%)`,
);
