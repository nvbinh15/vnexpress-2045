// Batch hero-image generator for VnExpress 2045 satirical project.
// Reads content/articles/*.mdx, generates a hero AVIF for each via
// gpt-image-2 (PNG bytes piped through sharp → AVIF q60), tracks token
// spend with a hard cap, and is idempotent (skips files >40KB).
//
// Run: node --env-file=.env scripts/generate-images.mjs
//      node --env-file=.env scripts/generate-images.mjs --retry
//      node --env-file=.env scripts/generate-images.mjs --only=slug-1,slug-2

import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import sharp from "sharp";

const AVIF_QUALITY = 60;

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const ARTICLES_DIR = path.join(ROOT, "content/articles");
const IMAGES_DIR = path.join(ROOT, "public/images");
const STATE_FILE = path.join(ROOT, "scripts/.image-state.json");

const STYLE_PHOTO =
  "documentary photojournalism, natural lighting, Vietnamese setting, AP wire photo style, candid composition, no text or signs in image, 35mm film aesthetic";
const STYLE_ILLUSTRATION =
  "editorial newspaper illustration, clean vector-adjacent style, restrained palette, Vietnamese cultural details, no text, suitable for op-ed accompaniment";

const HARD_BUDGET_USD = 5.0;
const TOKEN_PRICE_PER_M = 30.0; // gpt-image-2 output tokens at $30/1M
const PER_IMAGE_FAILURE_LIMIT = 4;

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY missing — run with: node --env-file=.env scripts/generate-images.mjs");
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const RETRY_ONLY = args.has("--retry");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY_SLUGS = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",")) : null;

const loadState = async () => {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, "utf8"));
  } catch {
    return { runs: [], failed: [] };
  }
};
const saveState = async (s) => fs.writeFile(STATE_FILE, JSON.stringify(s, null, 2));

const buildPrompt = (article) => {
  const subject = article.imagePrompt;
  const style = article.imageStyle === "illustration" ? STYLE_ILLUSTRATION : STYLE_PHOTO;
  return `${subject} ${style}`;
};

const callImageApi = async (model, prompt) => {
  const t0 = Date.now();
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, prompt, size: "1536x1024", quality: "medium", n: 1 }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) {
    const txt = await res.text();
    return { ok: false, ms, status: res.status, error: txt.slice(0, 400) };
  }
  const json = await res.json();
  return { ok: true, ms, json };
};

const generateOne = async (article, state) => {
  const slug = article.slug;
  const outPath = path.join(IMAGES_DIR, `${slug}.avif`);

  // Idempotent skip (AVIF heroes typically 40–200KB)
  try {
    const stat = await fs.stat(outPath);
    if (stat.size > 40 * 1024 && !RETRY_ONLY) {
      return { slug, status: "skip", reason: "exists", sizeKB: (stat.size / 1024).toFixed(0) };
    }
  } catch {
    /* not present, generate */
  }

  if (RETRY_ONLY && !state.failed.includes(slug)) {
    return { slug, status: "skip", reason: "not-failed" };
  }

  const prompt = buildPrompt(article);
  let attempts = 0;
  let lastErr = null;
  let result = null;

  while (attempts < PER_IMAGE_FAILURE_LIMIT) {
    attempts++;
    const r = await callImageApi("gpt-image-2", prompt);
    if (r.ok) {
      result = r;
      break;
    }
    lastErr = r;
    console.log(`     attempt ${attempts}/${PER_IMAGE_FAILURE_LIMIT} failed: ${r.status} ${r.error?.slice(0, 120)}`);
    // Retry once with gpt-image-1 fallback on the last try
    if (attempts === PER_IMAGE_FAILURE_LIMIT - 1) {
      const r2 = await callImageApi("gpt-image-1", prompt);
      if (r2.ok) {
        result = r2;
        break;
      }
      lastErr = r2;
    }
  }

  if (!result) {
    return { slug, status: "fail", error: `${lastErr?.status} ${lastErr?.error?.slice(0, 200)}` };
  }

  const item = result.json.data?.[0];
  if (!item) return { slug, status: "fail", error: "no image in response" };

  let rawBytes;
  if (item.b64_json) {
    rawBytes = Buffer.from(item.b64_json, "base64");
  } else if (item.url) {
    const r = await fetch(item.url);
    rawBytes = Buffer.from(await r.arrayBuffer());
  } else {
    return { slug, status: "fail", error: "unknown response shape" };
  }

  // gpt-image-2 returns PNG by default — pipe through sharp to AVIF q60.
  const avifBytes = await sharp(rawBytes)
    .avif({ quality: AVIF_QUALITY, effort: 4 })
    .toBuffer();
  await fs.writeFile(outPath, avifBytes);

  const stat = await fs.stat(outPath);
  const tokens = result.json.usage?.output_tokens ?? 0;
  const cost = (tokens / 1_000_000) * TOKEN_PRICE_PER_M;
  return {
    slug,
    status: "ok",
    sizeKB: (stat.size / 1024).toFixed(0),
    ms: result.ms,
    tokens,
    cost,
  };
};

const main = async () => {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  const state = await loadState();

  const files = (await fs.readdir(ARTICLES_DIR))
    .filter((f) => f.endsWith(".mdx"))
    .filter((f) => !f.startsWith("placeholder-"))
    .filter((f) => !f.startsWith("_"))
    .sort();

  const articles = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(ARTICLES_DIR, f), "utf8");
    const { data } = matter(raw);
    if (!data.imagePrompt) {
      console.warn(`skip ${f}: missing imagePrompt frontmatter`);
      continue;
    }
    if (ONLY_SLUGS && !ONLY_SLUGS.has(data.slug)) continue;
    articles.push({ file: f, ...data });
  }

  console.log(`found ${articles.length} articles with imagePrompt`);
  console.log(`hard budget: $${HARD_BUDGET_USD.toFixed(2)}`);
  console.log("");

  let totalCost = 0;
  const ok = [];
  const fail = [];
  const skip = [];

  for (const a of articles) {
    process.stdout.write(`[${a.slug}] (${a.imageStyle}) ... `);
    if (totalCost >= HARD_BUDGET_USD) {
      console.log("BUDGET CAP REACHED — stopping");
      fail.push({ slug: a.slug, error: "budget cap reached before attempt" });
      continue;
    }
    const res = await generateOne(a, state);
    if (res.status === "ok") {
      totalCost += res.cost;
      ok.push(res);
      console.log(`OK ${res.sizeKB}KB ${res.ms}ms tokens=${res.tokens} $${res.cost.toFixed(4)} | total=$${totalCost.toFixed(4)}`);
    } else if (res.status === "skip") {
      skip.push(res);
      console.log(`SKIP (${res.reason}${res.sizeKB ? `, ${res.sizeKB}KB` : ""})`);
    } else {
      fail.push(res);
      console.log(`FAIL ${res.error}`);
    }
  }

  state.runs.push({ ts: new Date().toISOString(), ok: ok.length, fail: fail.length, totalCost });
  state.failed = fail.map((f) => f.slug);
  await saveState(state);

  console.log("");
  console.log("=".repeat(60));
  console.log(`succeeded: ${ok.length}`);
  console.log(`skipped:   ${skip.length}`);
  console.log(`failed:    ${fail.length}`);
  console.log(`total spent: $${totalCost.toFixed(4)}`);
  if (fail.length) {
    console.log("\nfailed slugs:");
    for (const f of fail) console.log(`  - ${f.slug}: ${f.error}`);
  }
};

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
