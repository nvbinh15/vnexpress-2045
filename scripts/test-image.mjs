import fs from "node:fs/promises";
import path from "node:path";

const STYLE = "documentary photojournalism, natural lighting, Vietnamese setting, AP wire photo style, candid composition, 35mm film aesthetic, soft overcast light";

const SUBJECT = "A long concrete coastal seawall stretching along the Sơn Trà peninsula coastline in Đà Nẵng, Vietnam. Modern engineered sea defense, partially visible from elevated angle, ocean waves on the right, low scattered clouds, distant cargo ships on horizon. A few small construction workers in helmets and reflective vests in the mid-distance for scale. The seawall has a pedestrian walkway on top with railings. Realistic, restrained, no people in foreground.";

const prompt = `${SUBJECT} ${STYLE}`;

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY missing — run with: node --env-file=.env scripts/test-image.mjs");
  process.exit(1);
}

const tryModel = async (model, size, quality) => {
  const t0 = Date.now();
  console.log(`→ trying model=${model} size=${size} quality=${quality}`);
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, prompt, size, quality, n: 1 }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) {
    const txt = await res.text();
    console.log(`   ✗ ${res.status} in ${ms}ms`);
    console.log(`   ${txt.slice(0, 400)}`);
    return null;
  }
  const json = await res.json();
  console.log(`   ✓ ok in ${ms}ms`);
  return json;
};

let result =
  (await tryModel("gpt-image-2", "1536x1024", "medium")) ??
  (await tryModel("gpt-image-1", "1536x1024", "medium"));

if (!result) {
  console.error("Both models failed.");
  process.exit(1);
}

const item = result.data?.[0];
if (!item) {
  console.error("No image in response:", JSON.stringify(result).slice(0, 400));
  process.exit(1);
}

const outPath = path.join(
  "public/images",
  "seawall-da-nang-2045.jpg",
);

if (item.b64_json) {
  await fs.writeFile(outPath, Buffer.from(item.b64_json, "base64"));
} else if (item.url) {
  const r = await fetch(item.url);
  const buf = Buffer.from(await r.arrayBuffer());
  await fs.writeFile(outPath, buf);
} else {
  console.error("Unknown response shape:", Object.keys(item));
  process.exit(1);
}

const stat = await fs.stat(outPath);
console.log(`saved → ${outPath} (${(stat.size / 1024).toFixed(1)} KB)`);
if (result.usage) console.log("usage:", JSON.stringify(result.usage));
