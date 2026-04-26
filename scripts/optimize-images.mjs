// One-shot image optimizer: converts PNG-bytes-saved-as-.jpg into real
// JPEG, resizes to a sensible max width, and overwrites in place.
//
// gpt-image-2 returns PNG by default (so each "hero.jpg" is actually a
// 2-3MB PNG). For the web, we want real JPEG at quality 82, max width
// 1600px (covers 2x retina hero), and a smaller 800w mobile variant.
//
// Run: node scripts/optimize-images.mjs

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const IMAGES_DIR = path.join(ROOT, "public/images");
const QUALITY = 82;
const MAX_WIDTH = 1600;
const SM_WIDTH = 800;

const files = (await fs.readdir(IMAGES_DIR)).filter((f) =>
  /\.(jpe?g|png)$/i.test(f) && !f.includes("@sm")
);

let totalBefore = 0;
let totalAfter = 0;

for (const file of files) {
  const fullPath = path.join(IMAGES_DIR, file);
  const before = (await fs.stat(fullPath)).size;
  totalBefore += before;

  const buf = await fs.readFile(fullPath);
  const meta = await sharp(buf).metadata();
  const width = Math.min(meta.width ?? MAX_WIDTH, MAX_WIDTH);

  const optimized = await sharp(buf)
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: QUALITY, progressive: true, mozjpeg: true })
    .toBuffer();
  await fs.writeFile(fullPath, optimized);

  const smPath = fullPath.replace(/\.(jpe?g|png)$/i, "@sm.jpg");
  const sm = await sharp(buf)
    .resize({ width: SM_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: QUALITY, progressive: true, mozjpeg: true })
    .toBuffer();
  await fs.writeFile(smPath, sm);

  const after = optimized.length;
  totalAfter += after;
  console.log(
    `${file}: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB (${(
      (after / before) *
      100
    ).toFixed(0)}%)`,
  );
}

console.log(
  `\ntotal: ${(totalBefore / 1024 / 1024).toFixed(1)} MB → ${(
    totalAfter /
    1024 /
    1024
  ).toFixed(1)} MB (${((totalAfter / totalBefore) * 100).toFixed(0)}%)`,
);
