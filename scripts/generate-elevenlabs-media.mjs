// Batch ElevenLabs media generator for VnExpress 2045.
// Generates static narration, podcasts, broadcasts, and 2045 FM assets.
//
// Run from repo root:
//   node scripts/generate-elevenlabs-media.mjs --dry-run --profile=aggressive
//   node scripts/generate-elevenlabs-media.mjs --profile=aggressive
//   node scripts/generate-elevenlabs-media.mjs --kind=narration --only=slug
//
// The browser app never calls ElevenLabs. This script loads the API key from
// ../.env and writes committed static assets under public/.

import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const PARENT_ENV = path.resolve(ROOT, "../.env");
const ARTICLES_DIR = path.join(ROOT, "content/articles");
const CATALOG_PATH = path.join(ROOT, "content/audio/catalog.json");
const STATE_FILE = path.join(ROOT, "scripts/.audio-state.json");
const PUBLIC_AUDIO = path.join(ROOT, "public/audio");
const PUBLIC_BROADCASTS = path.join(ROOT, "public/broadcasts");
const PUBLIC_IMAGES = path.join(ROOT, "public/images");

const API_BASE = "https://api.elevenlabs.io";
const OUTPUT_FORMAT = "mp3_44100_128";
const TTS_MODEL = "eleven_v3";
const MUSIC_MODEL = "music_v2";
const SFX_MODEL = "eleven_text_to_sound_v2";

const FEATURED_NARRATION_SLUGS = [
  "100-nam-quoc-khanh-khat-vong-viet-nam-cong-bo",
  "boc-tham-vinhomes-can-gio-floating-city",
  "duong-sat-bac-nam-doan-vinh-dong-ha-lui-tien-do-2052",
  "tuyen-phong-thu-ven-bien-le-ky-niem-100-nam",
  "boc-tran-hoi-tu-thien-tam-lanh-ai-deepfake-23-ty",
  "goc-nhin-con-bot-cua-toi-noi-chuyen-voi-con-bot-cua-me",
  "doi-tuyen-vong-loai-world-cup-2046-philippines",
  "cau-be-thu-vien-lang-thu-khoa-olympic-ai-quoc-gia",
  "10-nam-sau-dai-hong-thuy-chung-ta-da-hoc-duoc-gi",
];

const FALLBACK_VOICES = [
  { role: "anchor", name: "Voice A", voice_id: "JBFqnCBsd6RMkjVDRZzb" },
  { role: "host", name: "Voice B", voice_id: "Aw4FAjKCGjjNkVhN1Xmq" },
  { role: "analyst", name: "Rachel", voice_id: "21m00Tcm4TlvDq8ikWAM" },
  { role: "field", name: "Antoni", voice_id: "ErXwobaYiN019PkySvjV" },
  { role: "reader", name: "Bella", voice_id: "EXAVITQu4vr4xnSDxMaL" },
  { role: "fm", name: "Josh", voice_id: "TxGEqnHWrfWFTfGW9XjX" },
];

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const RETRY_ONLY = args.has("--retry");
const profileArg = process.argv.find((arg) => arg.startsWith("--profile="));
const PROFILE = profileArg ? profileArg.slice("--profile=".length) : "aggressive";
const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const ONLY = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean)) : null;
const kindArg = process.argv.find((arg) => arg.startsWith("--kind="));
const KINDS = kindArg ? new Set(kindArg.slice("--kind=".length).split(",").map((s) => s.trim()).filter(Boolean)) : null;

function wants(kind) {
  return !KINDS || KINDS.has(kind);
}

function onlyMatches(...ids) {
  if (!ONLY) return true;
  return ids.some((id) => id && ONLY.has(id));
}

function loadEnvFile(file) {
  return fs.readFile(file, "utf8")
    .then((raw) => {
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq < 1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    })
    .catch(() => {});
}

async function loadState() {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, "utf8"));
  } catch {
    return { runs: [], failed: [] };
  }
}

async function saveState(state) {
  await fs.writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (!val) {
      data[key] = "";
    } else if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.slice(1, -1).trim();
      data[key] = inner ? inner.split(",").map((item) => stripQuotes(item.trim())) : [];
    } else if (val === "true" || val === "false") {
      data[key] = val === "true";
    } else if (/^-?\d+(\.\d+)?$/.test(val)) {
      data[key] = Number(val);
    } else {
      data[key] = stripQuotes(val);
    }
  }
  return { data, body: match[2] ?? "" };
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function cleanMarkdown(raw) {
  return raw
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/^- /gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(text, maxChars) {
  if (text.length <= maxChars) return text;
  const clipped = text.slice(0, maxChars - 1);
  const sentence = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("? "), clipped.lastIndexOf("! "));
  if (sentence > maxChars * 0.55) return `${clipped.slice(0, sentence + 1).trim()}`;
  return `${clipped.trim()}...`;
}

function normalizeForSpeech(text) {
  return text
    .replace(/2045/g, "hai nghìn không trăm bốn mươi lăm")
    .replace(/2050/g, "hai nghìn không trăm năm mươi")
    .replace(/2052/g, "hai nghìn không trăm năm mươi hai")
    .replace(/AI/g, "A I")
    .replace(/VnExpress/g, "Vi En Express")
    .replace(/VnE/g, "Vi En E")
    .replace(/TP\.HCM/g, "thành phố Hồ Chí Minh")
    .replace(/TP HCM/g, "thành phố Hồ Chí Minh");
}

async function loadArticles() {
  const files = (await fs.readdir(ARTICLES_DIR)).filter((f) => f.endsWith(".mdx")).sort();
  const articles = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(ARTICLES_DIR, file), "utf8");
    const { data, body } = parseFrontmatter(raw);
    if (!data.slug || !data.title) continue;
    articles.push({
      ...data,
      file,
      body,
      plainBody: cleanMarkdown(body),
      url: `/${data.section}/${data.slug}.html`,
    });
  }
  return articles;
}

function bySlug(articles) {
  return new Map(articles.map((article) => [article.slug, article]));
}

function articleLine(article) {
  return `${article.title}. ${article.summary}`;
}

function makeNarrationScript(article) {
  const body = truncateText(article.plainBody, 2400);
  return normalizeForSpeech(
    `[calm, professional Vietnamese news reading] Bạn đang nghe VnExpress hai nghìn không trăm bốn mươi lăm. ${article.title}. ${article.summary}. ${body}. ${article.author} thực hiện.`,
  );
}

function dialogueText(turns) {
  return turns.map((turn) => `${turn.name}: ${turn.text}`).join("\n");
}

function makeDialogueEpisode({ id, title, summary, articleSlugs, turns, posterSlug, kind, publishedAt }) {
  return { id, kind, title, summary, articleSlugs, turns, posterSlug, publishedAt };
}

function buildPodcastDefs(articleMap) {
  const pick = (slug) => articleMap.get(slug);
  const short = (slug) => truncateText(articleLine(pick(slug)), 210);
  return [
    makeDialogueEpisode({
      id: "podcast-khat-vong-2050",
      kind: "podcast",
      title: "VnExpress Podcast: Khát vọng 2045, hẹn lại 2050",
      summary: "Hai biên tập viên bóc lớp hào nhoáng của đại lễ, tuyến biển và đường sắt lùi tiến độ.",
      posterSlug: "100-nam-quoc-khanh-khat-vong-viet-nam-cong-bo",
      articleSlugs: [
        "100-nam-quoc-khanh-khat-vong-viet-nam-cong-bo",
        "tuyen-phong-thu-ven-bien-le-ky-niem-100-nam",
        "duong-sat-bac-nam-doan-vinh-dong-ha-lui-tien-do-2052",
      ],
      publishedAt: "2045-04-30T07:00:00+07:00",
      turns: [
        { role: "host", name: "Minh Anh", text: `[warm] Mở đầu bản tin âm thanh hôm nay là câu hỏi không mới: khi một mục tiêu quốc gia đổi mốc, người dân nghe thấy hy vọng hay nghe thấy tiếng lịch bị xé?` },
        { role: "analyst", name: "Quang Dũng", text: short("100-nam-quoc-khanh-khat-vong-viet-nam-cong-bo") },
        { role: "host", name: "Minh Anh", text: `[curious] Cùng lúc, tuyến phòng thủ ven biển được gọi là biểu tượng ý chí, còn đoạn Vinh - Đông Hà lại hẹn thông tuyến cuối hai nghìn không trăm năm mươi hai.` },
        { role: "analyst", name: "Quang Dũng", text: `${short("tuyen-phong-thu-ven-bien-le-ky-niem-100-nam")} ${short("duong-sat-bac-nam-doan-vinh-dong-ha-lui-tien-do-2052")}` },
        { role: "host", name: "Minh Anh", text: `[dry] Một thế kỷ độc lập, và một nghệ thuật rất Việt Nam: vừa cắt băng, vừa gia hạn.` },
      ],
    }),
    makeDialogueEpisode({
      id: "podcast-nha-dat-vang",
      kind: "podcast",
      title: "Tài chính cá nhân 2045: Nhà nổi, vàng nổi, người chìm",
      summary: "Tập về bốc thăm căn hộ, vàng SJC giá tỷ tám và phản xạ trú ẩn của tầng lớp trung lưu.",
      posterSlug: "boc-tham-vinhomes-can-gio-floating-city",
      articleSlugs: [
        "boc-tham-vinhomes-can-gio-floating-city",
        "kinh-doanh-vang-sjc-1-8-ty-xep-hang-ha-noi",
        "kinh-doanh-vinfast-lai-tri-an-lao-dong-huu-nghi",
      ],
      publishedAt: "2045-04-30T08:30:00+07:00",
      turns: [
        { role: "host", name: "Linh Chi", text: `[brisk] Hôm nay chúng ta đi từ căn hộ nổi đến vàng miếng, tức là từ ước mơ có nhà đến ước mơ giữ được tiền.` },
        { role: "analyst", name: "Hải Nam", text: short("boc-tham-vinhomes-can-gio-floating-city") },
        { role: "host", name: "Linh Chi", text: `[amused] Tỷ lệ trúng một trên tám trăm bốn mươi bảy nghe như thi đại học, chỉ khác là bài làm là sổ hộ khẩu, hồ sơ vay và lòng tin.` },
        { role: "analyst", name: "Hải Nam", text: `${short("kinh-doanh-vang-sjc-1-8-ty-xep-hang-ha-noi")} ${short("kinh-doanh-vinfast-lai-tri-an-lao-dong-huu-nghi")}` },
        { role: "host", name: "Linh Chi", text: `Kết luận ngắn: ở hai nghìn không trăm bốn mươi lăm, nhà có thể nổi, xe có thể bay, nhưng nỗi sợ mất giá thì vẫn đi bộ rất bền.` },
      ],
    }),
    makeDialogueEpisode({
      id: "podcast-gia-dinh-agent",
      kind: "podcast",
      title: "Gia đình và agent: Khi con bot báo hiếu hộ",
      summary: "Những câu chuyện gia đình 2045: bot của con, bot của mẹ, mẹ chồng Bicol và dịch vụ ngủ ghép.",
      posterSlug: "goc-nhin-con-bot-cua-toi-noi-chuyen-voi-con-bot-cua-me",
      articleSlugs: [
        "goc-nhin-con-bot-cua-toi-noi-chuyen-voi-con-bot-cua-me",
        "tam-su-me-chong-bicol-giuc-sinh-con-thu-ba",
        "doi-song-ngu-ghep-quan-7-co-don",
      ],
      publishedAt: "2045-04-30T10:00:00+07:00",
      turns: [
        { role: "host", name: "Mai Hương", text: `[softly] Nếu hai bot nói chuyện với nhau mỗi tối, người con có còn được tính là hiếu thảo không?` },
        { role: "analyst", name: "Bảo Khánh", text: short("goc-nhin-con-bot-cua-toi-noi-chuyen-voi-con-bot-cua-me") },
        { role: "host", name: "Mai Hương", text: `[laughing lightly] Một bên là mẹ thật, một bên là mẹ chồng qua Zalo, và ở giữa là người trẻ cố thuê thêm một chút bình yên.` },
        { role: "analyst", name: "Bảo Khánh", text: `${short("tam-su-me-chong-bicol-giuc-sinh-con-thu-ba")} ${short("doi-song-ngu-ghep-quan-7-co-don")}` },
        { role: "host", name: "Mai Hương", text: `Công nghệ thay đổi cách ta tránh né cuộc gọi gia đình, nhưng chưa thay đổi được nội dung cuộc gọi.` },
      ],
    }),
    makeDialogueEpisode({
      id: "podcast-ai-tam-linh-phap-luat",
      kind: "podcast",
      title: "Hồ sơ âm thanh: AI tâm linh và luật Đan Sa",
      summary: "Từ giọng người đã khuất đến deepfake từ thiện, pháp luật 2045 chạy theo niềm tin được tự động hóa.",
      posterSlug: "boc-tran-hoi-tu-thien-tam-lanh-ai-deepfake-23-ty",
      articleSlugs: [
        "ai-thay-cung-ai-tu-vi-lua-dao-ponzi-47-ty",
        "boc-tran-hoi-tu-thien-tam-lanh-ai-deepfake-23-ty",
        "khoi-to-giam-doc-logistics-vi-pham-luat-ai-2042",
      ],
      publishedAt: "2045-04-30T11:30:00+07:00",
      turns: [
        { role: "host", name: "Hoàng Long", text: `[serious] Khi một cuộc gọi mang giọng người thân đã mất, người nghe phản ứng bằng lý trí hay bằng tang thương?` },
        { role: "analyst", name: "Thùy Vân", text: short("ai-thay-cung-ai-tu-vi-lua-dao-ponzi-47-ty") },
        { role: "host", name: "Hoàng Long", text: `Và khi ảnh trẻ em trong chiến dịch từ thiện là deepfake, câu hỏi không còn là có bị lừa không, mà là lừa bao lâu mới thấy đau.` },
        { role: "analyst", name: "Thùy Vân", text: `${short("boc-tran-hoi-tu-thien-tam-lanh-ai-deepfake-23-ty")} ${short("khoi-to-giam-doc-logistics-vi-pham-luat-ai-2042")}` },
        { role: "host", name: "Hoàng Long", text: `[low] Đan Sa không chỉ là chuẩn kỹ thuật. Nó là hàng rào muộn màng quanh những thứ từng gọi là lòng tin.` },
      ],
    }),
    makeDialogueEpisode({
      id: "podcast-giao-duc-ai",
      kind: "podcast",
      title: "Trường học 2045: Thủ khoa không có agent",
      summary: "Một tập giáo dục về đề văn, AI miễn phí ở thư viện làng và cô giáo ảo học cách yêu mẹ.",
      posterSlug: "cau-be-thu-vien-lang-thu-khoa-olympic-ai-quoc-gia",
      articleSlugs: [
        "cau-be-thu-vien-lang-thu-khoa-olympic-ai-quoc-gia",
        "de-thi-van-2045-nguoi-me-hue-nguyen-ngoc-tu",
        "doi-song-co-giao-ao-gen-beta-yeu-me",
      ],
      publishedAt: "2045-04-30T13:00:00+07:00",
      turns: [
        { role: "host", name: "An Nhiên", text: `[bright] Bảng vàng Olympic A I năm nay có một chi tiết làm phụ huynh bối rối: thủ khoa không có agent riêng.` },
        { role: "analyst", name: "Tuấn Kiệt", text: short("cau-be-thu-vien-lang-thu-khoa-olympic-ai-quoc-gia") },
        { role: "host", name: "An Nhiên", text: `[thoughtful] Trong khi đó, đề văn vẫn biết cách làm cả nước tranh luận như thể mạng xã hội chưa từng được phát minh.` },
        { role: "analyst", name: "Tuấn Kiệt", text: `${short("de-thi-van-2045-nguoi-me-hue-nguyen-ngoc-tu")} ${short("doi-song-co-giao-ao-gen-beta-yeu-me")}` },
        { role: "host", name: "An Nhiên", text: `Ở cuối cùng, câu hỏi cũ vẫn ở đó: học để làm người, hay học để máy hiểu người hơn?` },
      ],
    }),
    makeDialogueEpisode({
      id: "podcast-giai-tri-deepfake",
      kind: "podcast",
      title: "Giải trí: Sân khấu, deepfake và phần trăm thật",
      summary: "Hoa hậu AI, scandal có 31% deepfake, livestream tám tiếng và biệt thự Thảo Điền.",
      posterSlug: "hoa-hau-quoc-te-2045-thi-sinh-viet-nam-tranh-cai-ai",
      articleSlugs: [
        "hoa-hau-quoc-te-2045-thi-sinh-viet-nam-tranh-cai-ai",
        "scandal-ngoi-sao-deepfake-do-uong-co-con-xin-loi",
        "livestreamer-bao-tram-deepfake-8-tieng-vang",
        "nha-thiet-ke-dang-hoai-anh-bi-bat-chat-cam-thao-dien",
      ],
      publishedAt: "2045-04-30T15:00:00+07:00",
      turns: [
        { role: "host", name: "Khánh Ly", text: `[playful] Tuần này showbiz có đủ mọi chất liệu: người thật, người ảo, lỗi thật, và lời xin lỗi không ai chắc là thật.` },
        { role: "analyst", name: "Đức Anh", text: `${short("hoa-hau-quoc-te-2045-thi-sinh-viet-nam-tranh-cai-ai")} ${short("scandal-ngoi-sao-deepfake-do-uong-co-con-xin-loi")}` },
        { role: "host", name: "Khánh Ly", text: `[mock serious] Câu hỏi nghề nghiệp mới: nếu clip chỉ deepfake ba mươi mốt phần trăm, trách nhiệm đạo đức tính theo tỉ lệ nào?` },
        { role: "analyst", name: "Đức Anh", text: `${short("livestreamer-bao-tram-deepfake-8-tieng-vang")} ${short("nha-thiet-ke-dang-hoai-anh-bi-bat-chat-cam-thao-dien")}` },
        { role: "host", name: "Khánh Ly", text: `Khi sự thật bị chia nhỏ thành phần trăm, khán giả chỉ còn một kỹ năng: nghe xin lỗi với tai nghi ngờ.` },
      ],
    }),
    makeDialogueEpisode({
      id: "podcast-the-thao-lao-dong",
      kind: "podcast",
      title: "Thể thao 2045: Đội tuyển, VAR AI và liên đoàn",
      summary: "Tuyển Việt Nam thắng Philippines, V-League cãi AI VAR và kỳ thủ trẻ thắng máy.",
      posterSlug: "doi-tuyen-vong-loai-world-cup-2046-philippines",
      articleSlugs: [
        "doi-tuyen-vong-loai-world-cup-2046-philippines",
        "v-league-hagl-thua-vff-ai-var-tranh-cai",
        "ky-thu-le-bao-han-thang-ai-blitz-lien-doan-co-vua",
      ],
      publishedAt: "2045-04-30T17:00:00+07:00",
      turns: [
        { role: "host", name: "Minh Trí", text: `[energetic] Bản tin thể thao bắt đầu với tuyển Việt Nam, nhưng câu chuyện vượt khỏi sân cỏ: lao động nhập cư, căn cước, và niềm vui rất thật.` },
        { role: "analyst", name: "Phương Nam", text: short("doi-tuyen-vong-loai-world-cup-2046-philippines") },
        { role: "host", name: "Minh Trí", text: `Ở trong nước, V-League vẫn chứng minh rằng dù trọng tài là người hay máy, tranh cãi vẫn là môn thể thao quốc dân.` },
        { role: "analyst", name: "Phương Nam", text: `${short("v-league-hagl-thua-vff-ai-var-tranh-cai")} ${short("ky-thu-le-bao-han-thang-ai-blitz-lien-doan-co-vua")}` },
        { role: "host", name: "Minh Trí", text: `[laughing] Chúng ta đã dạy máy chơi cờ, nhưng chưa dạy cổ động viên tha thứ cho V A R.` },
      ],
    }),
    makeDialogueEpisode({
      id: "podcast-do-thi-di-chuyen",
      kind: "podcast",
      title: "Đô thị di chuyển: Bay trên kẹt xe, chờ dưới đường ray",
      summary: "Tập về eVTOL, hạn chế xe máy, Hà Giang ngủ ghép và hành trình tàu-xe-tàu.",
      posterSlug: "vinair-evtol-tp-hcm-vung-tau-mo-tuyen",
      articleSlugs: [
        "vinair-evtol-tp-hcm-vung-tau-mo-tuyen",
        "ha-noi-han-che-xe-may-vanh-dai-3-2050",
        "du-lich-ha-giang-ngu-ghep-le-30-4",
        "duong-sat-bac-nam-tau-xe-khach-tau-ban-doan-mien-trung",
      ],
      publishedAt: "2045-04-30T18:30:00+07:00",
      turns: [
        { role: "host", name: "Diệp Anh", text: `[fast] Có người bay từ thành phố Hồ Chí Minh ra Vũng Tàu, có người vẫn đổi tàu sang xe khách ở miền Trung. Cùng một đất nước, nhiều tầng vận tốc.` },
        { role: "analyst", name: "Việt Hoàng", text: `${short("vinair-evtol-tp-hcm-vung-tau-mo-tuyen")} ${short("ha-noi-han-che-xe-may-vanh-dai-3-2050")}` },
        { role: "host", name: "Diệp Anh", text: `[curious] Du lịch cũng vậy: tour ngủ ghép nở rộ, còn hạ tầng thì ngủ chập chờn.` },
        { role: "analyst", name: "Việt Hoàng", text: `${short("du-lich-ha-giang-ngu-ghep-le-30-4")} ${short("duong-sat-bac-nam-tau-xe-khach-tau-ban-doan-mien-trung")}` },
        { role: "host", name: "Diệp Anh", text: `Hai nghìn không trăm bốn mươi lăm có phương tiện bay. Điều chưa bay được là cảm giác chờ.` },
      ],
    }),
  ];
}

function buildBroadcastDefs(articleMap) {
  const pick = (slug) => articleMap.get(slug);
  const short = (slug) => truncateText(articleLine(pick(slug)), 190);
  return [
    makeDialogueEpisode({
      id: "broadcast-ban-tin-sang",
      kind: "broadcast",
      title: "Bản tin sáng 2045: Đại lễ, đường sắt, tuyến biển",
      summary: "Bản tin video ngắn theo phong cách truyền hình báo điện tử.",
      posterSlug: "100-nam-quoc-khanh-khat-vong-viet-nam-cong-bo",
      articleSlugs: [
        "100-nam-quoc-khanh-khat-vong-viet-nam-cong-bo",
        "duong-sat-bac-nam-doan-vinh-dong-ha-lui-tien-do-2052",
        "tuyen-phong-thu-ven-bien-le-ky-niem-100-nam",
      ],
      publishedAt: "2045-04-30T06:30:00+07:00",
      turns: [
        { role: "anchor", name: "BTV Lan Phương", text: `[authoritative] Kính chào quý vị. Bản tin sáng của VnExpress hai nghìn không trăm bốn mươi lăm bắt đầu với chương trình kỷ niệm một trăm năm Quốc khánh.` },
        { role: "anchor", name: "BTV Lan Phương", text: `${short("100-nam-quoc-khanh-khat-vong-viet-nam-cong-bo")} ${short("duong-sat-bac-nam-doan-vinh-dong-ha-lui-tien-do-2052")}` },
        { role: "field", name: "Phóng viên hiện trường", text: `[outdoor ambience] Tại tuyến ven biển, các hạng mục mới được giới thiệu như biểu tượng thích ứng khí hậu của thế kỷ hai mốt.` },
        { role: "anchor", name: "BTV Lan Phương", text: short("tuyen-phong-thu-ven-bien-le-ky-niem-100-nam") },
      ],
    }),
    makeDialogueEpisode({
      id: "broadcast-nha-o-vang",
      kind: "broadcast",
      title: "Tâm điểm kinh tế: Căn hộ nổi và vàng tỷ tám",
      summary: "Video điểm tin kinh tế về bốc thăm nhà và dòng tiền trú ẩn.",
      posterSlug: "boc-tham-vinhomes-can-gio-floating-city",
      articleSlugs: [
        "boc-tham-vinhomes-can-gio-floating-city",
        "kinh-doanh-vang-sjc-1-8-ty-xep-hang-ha-noi",
      ],
      publishedAt: "2045-04-30T09:00:00+07:00",
      turns: [
        { role: "anchor", name: "BTV Nam Khánh", text: `[newscaster] Chuyên mục kinh tế hôm nay nhìn vào hai hàng xếp dài nhất: hàng bốc thăm nhà và hàng mua vàng.` },
        { role: "analyst", name: "Chuyên gia tài chính", text: `${short("boc-tham-vinhomes-can-gio-floating-city")} ${short("kinh-doanh-vang-sjc-1-8-ty-xep-hang-ha-noi")}` },
        { role: "anchor", name: "BTV Nam Khánh", text: `Các chuyên gia gọi đây là nhu cầu trú ẩn tài sản. Người dân gọi ngắn hơn: sợ.` },
      ],
    }),
    makeDialogueEpisode({
      id: "broadcast-phap-luat-ai",
      kind: "broadcast",
      title: "Pháp luật: Deepfake từ thiện và AI tâm linh",
      summary: "Video hồ sơ về các vụ lừa đảo dùng giọng nói và hình ảnh tổng hợp.",
      posterSlug: "boc-tran-hoi-tu-thien-tam-lanh-ai-deepfake-23-ty",
      articleSlugs: [
        "boc-tran-hoi-tu-thien-tam-lanh-ai-deepfake-23-ty",
        "ai-thay-cung-ai-tu-vi-lua-dao-ponzi-47-ty",
      ],
      publishedAt: "2045-04-30T12:00:00+07:00",
      turns: [
        { role: "anchor", name: "BTV Thanh Hà", text: `[grave] Bản tin pháp luật mở đầu bằng những vụ án khiến ranh giới giữa niềm tin và bằng chứng ngày càng mong manh.` },
        { role: "field", name: "Phóng viên pháp luật", text: `${short("boc-tran-hoi-tu-thien-tam-lanh-ai-deepfake-23-ty")} ${short("ai-thay-cung-ai-tu-vi-lua-dao-ponzi-47-ty")}` },
        { role: "anchor", name: "BTV Thanh Hà", text: `Cơ quan điều tra khuyến cáo người dân xác minh nguồn âm thanh, hình ảnh và tuyệt đối không chuyển tiền theo cảm xúc.` },
      ],
    }),
    makeDialogueEpisode({
      id: "broadcast-giao-duc",
      kind: "broadcast",
      title: "Giáo dục: Thủ khoa thư viện làng",
      summary: "Video chân dung và phản ứng xã hội quanh giáo dục A I.",
      posterSlug: "cau-be-thu-vien-lang-thu-khoa-olympic-ai-quoc-gia",
      articleSlugs: [
        "cau-be-thu-vien-lang-thu-khoa-olympic-ai-quoc-gia",
        "de-thi-van-2045-nguoi-me-hue-nguyen-ngoc-tu",
      ],
      publishedAt: "2045-04-30T14:00:00+07:00",
      turns: [
        { role: "anchor", name: "BTV Ngọc Mai", text: `[optimistic] Một học sinh dùng A I miễn phí ở thư viện làng trở thành thủ khoa Olympic A I quốc gia.` },
        { role: "analyst", name: "Biên tập viên giáo dục", text: `${short("cau-be-thu-vien-lang-thu-khoa-olympic-ai-quoc-gia")} ${short("de-thi-van-2045-nguoi-me-hue-nguyen-ngoc-tu")}` },
        { role: "anchor", name: "BTV Ngọc Mai", text: `[warm] Câu chuyện khiến nhiều phụ huynh đặt lại câu hỏi: lợi thế học tập đến từ thiết bị riêng, hay từ quyền được tiếp cận?` },
      ],
    }),
    makeDialogueEpisode({
      id: "broadcast-the-thao",
      kind: "broadcast",
      title: "Thể thao: Chiến thắng và căn cước mới",
      summary: "Video thể thao về tuyển Việt Nam, nhập cư và tranh cãi A I V A R.",
      posterSlug: "doi-tuyen-vong-loai-world-cup-2046-philippines",
      articleSlugs: [
        "doi-tuyen-vong-loai-world-cup-2046-philippines",
        "v-league-hagl-thua-vff-ai-var-tranh-cai",
      ],
      publishedAt: "2045-04-30T19:00:00+07:00",
      turns: [
        { role: "anchor", name: "BTV Đức Minh", text: `[excited] Tuyển Việt Nam thắng Philippines hai một, trong trận đấu được nhắc tới không chỉ vì tỷ số.` },
        { role: "field", name: "Phóng viên thể thao", text: `${short("doi-tuyen-vong-loai-world-cup-2046-philippines")} ${short("v-league-hagl-thua-vff-ai-var-tranh-cai")}` },
        { role: "anchor", name: "BTV Đức Minh", text: `[laughing] Nếu A I V A R có cảm xúc, tuần này nó chắc chắn đã tắt thông báo mạng xã hội.` },
      ],
    }),
    makeDialogueEpisode({
      id: "broadcast-giai-tri",
      kind: "broadcast",
      title: "Giải trí tối: Hoa hậu AI và scandal phần trăm",
      summary: "Video giải trí tổng hợp những câu chuyện thật-ảo của tuần.",
      posterSlug: "hoa-hau-quoc-te-2045-thi-sinh-viet-nam-tranh-cai-ai",
      articleSlugs: [
        "hoa-hau-quoc-te-2045-thi-sinh-viet-nam-tranh-cai-ai",
        "scandal-ngoi-sao-deepfake-do-uong-co-con-xin-loi",
        "livestreamer-bao-tram-deepfake-8-tieng-vang",
      ],
      publishedAt: "2045-04-30T21:00:00+07:00",
      turns: [
        { role: "anchor", name: "BTV Hà My", text: `[bright] Giải trí tối nay có hoa hậu A I, clip ba mươi mốt phần trăm deepfake và một livestream vàng kéo dài tám tiếng.` },
        { role: "analyst", name: "Biên tập viên giải trí", text: `${short("hoa-hau-quoc-te-2045-thi-sinh-viet-nam-tranh-cai-ai")} ${short("scandal-ngoi-sao-deepfake-do-uong-co-con-xin-loi")} ${short("livestreamer-bao-tram-deepfake-8-tieng-vang")}` },
        { role: "anchor", name: "BTV Hà My", text: `Khi mọi thứ đều có thể dựng lại, ngôi sao hiếm nhất là người vẫn dám xuất hiện không chỉnh sửa.` },
      ],
    }),
  ];
}

function buildFmDefs(articleMap) {
  const pick = (slug) => articleMap.get(slug);
  const short = (slug) => truncateText(articleLine(pick(slug)), 170);
  return [
    makeDialogueEpisode({
      id: "fm-dau-gio-06",
      kind: "fm",
      title: "2045 FM: Đầu giờ 06:00",
      summary: "Cụm tin sáng với jingle, giọng dẫn nhanh và tín hiệu giao thông bay.",
      posterSlug: "100-nam-quoc-khanh-khat-vong-viet-nam-cong-bo",
      articleSlugs: [
        "100-nam-quoc-khanh-khat-vong-viet-nam-cong-bo",
        "vinair-evtol-tp-hcm-vung-tau-mo-tuyen",
      ],
      publishedAt: "2045-04-30T06:00:00+07:00",
      turns: [
        { role: "fm", name: "2045 FM", text: `[radio announcer][energetic] Sáu giờ sáng trên hai nghìn không trăm bốn mươi lăm F M. Tin đầu giờ: ${short("100-nam-quoc-khanh-khat-vong-viet-nam-cong-bo")}` },
        { role: "fm", name: "2045 FM", text: `[fast] Giao thông bay cập nhật: ${short("vinair-evtol-tp-hcm-vung-tau-mo-tuyen")}` },
      ],
    }),
    makeDialogueEpisode({
      id: "fm-trua-12",
      kind: "fm",
      title: "2045 FM: Trưa không ngủ",
      summary: "Tin trưa về nhà ở, vàng và những hàng xếp dài.",
      posterSlug: "boc-tham-vinhomes-can-gio-floating-city",
      articleSlugs: [
        "boc-tham-vinhomes-can-gio-floating-city",
        "kinh-doanh-vang-sjc-1-8-ty-xep-hang-ha-noi",
      ],
      publishedAt: "2045-04-30T12:00:00+07:00",
      turns: [
        { role: "fm", name: "2045 FM", text: `[radio announcer] Mười hai giờ, quý vị đang nghe chuyên mục trưa không ngủ, dành cho người chưa trúng nhà và chưa mua được vàng.` },
        { role: "fm", name: "2045 FM", text: `${short("boc-tham-vinhomes-can-gio-floating-city")} ${short("kinh-doanh-vang-sjc-1-8-ty-xep-hang-ha-noi")}` },
      ],
    }),
    makeDialogueEpisode({
      id: "fm-chieu-17",
      kind: "fm",
      title: "2045 FM: Tan tầm dưới trời drone",
      summary: "Cụm tin tan tầm về xe, đường sắt và đô thị nhiều tầng.",
      posterSlug: "ha-noi-han-che-xe-may-vanh-dai-3-2050",
      articleSlugs: [
        "ha-noi-han-che-xe-may-vanh-dai-3-2050",
        "duong-sat-bac-nam-tau-xe-khach-tau-ban-doan-mien-trung",
      ],
      publishedAt: "2045-04-30T17:00:00+07:00",
      turns: [
        { role: "fm", name: "2045 FM", text: `[radio announcer][slightly rushed] Mười bảy giờ, tan tầm dưới trời drone. Tin giao thông: ${short("ha-noi-han-che-xe-may-vanh-dai-3-2050")}` },
        { role: "fm", name: "2045 FM", text: `Trên trục Bắc Nam, hành khách tiếp tục quen với công thức tàu, xe khách, rồi lại tàu. ${short("duong-sat-bac-nam-tau-xe-khach-tau-ban-doan-mien-trung")}` },
      ],
    }),
    makeDialogueEpisode({
      id: "fm-dem-23",
      kind: "fm",
      title: "2045 FM: Đêm bot nói chuyện",
      summary: "Cụm tin đêm về gia đình, bot và những cuộc gọi tự động.",
      posterSlug: "goc-nhin-con-bot-cua-toi-noi-chuyen-voi-con-bot-cua-me",
      articleSlugs: [
        "goc-nhin-con-bot-cua-toi-noi-chuyen-voi-con-bot-cua-me",
        "ai-thay-cung-ai-tu-vi-lua-dao-ponzi-47-ty",
      ],
      publishedAt: "2045-04-30T23:00:00+07:00",
      turns: [
        { role: "fm", name: "2045 FM", text: `[whispering] Hai mươi ba giờ trên hai nghìn không trăm bốn mươi lăm F M. Nếu bot của bạn đang gọi bot của mẹ, xin giảm âm lượng.` },
        { role: "fm", name: "2045 FM", text: `${short("goc-nhin-con-bot-cua-toi-noi-chuyen-voi-con-bot-cua-me")} ${short("ai-thay-cung-ai-tu-vi-lua-dao-ponzi-47-ty")}` },
      ],
    }),
  ];
}

const JINGLE_DEFS = [
  {
    id: "vne-2045-fm-jingle",
    title: "VnExpress 2045 FM station jingle",
    prompt: "A polished 12-second Vietnamese future-news radio station jingle for VnExpress 2045 FM: confident percussion, subtle dan bau-inspired motif, bright broadcast identity, no copyrighted melody, no artist imitation.",
    durationMs: 12000,
  },
];

const SFX_DEFS = [
  {
    id: "breaking-news-stinger",
    title: "Breaking news stinger",
    text: "A crisp Vietnamese digital newspaper breaking-news stinger, fast notification sweep, light percussion hit, broadcast safe, not alarming",
    durationSeconds: 4,
  },
  {
    id: "coastal-drone-ambience",
    title: "Coastal drone ambience",
    text: "Soft coastal wind, distant drone camera hum, light waves against a modern seawall, documentary background ambience",
    durationSeconds: 8,
  },
  {
    id: "future-newsroom-bed",
    title: "Future newsroom bed",
    text: "Low subtle newsroom ambience in 2045, quiet keyboards, notification pings, distant editors, calm and loopable",
    durationSeconds: 10,
    loop: true,
  },
  {
    id: "zalo-family-ping",
    title: "Family group ping",
    text: "A playful futuristic family chat notification ping, warm, tiny, comedic, not a recognizable app sound",
    durationSeconds: 3,
  },
  {
    id: "evtol-flyover",
    title: "eVTOL flyover",
    text: "A quiet electric vertical takeoff aircraft passing overhead above a dense Vietnamese city street, realistic but not too loud",
    durationSeconds: 6,
  },
  {
    id: "ai-var-whistle",
    title: "AI VAR whistle",
    text: "Short sports broadcast transition: referee whistle, synthetic review beep, stadium murmur, comedic timing",
    durationSeconds: 5,
  },
];

function roleVoice(voices, role) {
  return voices.find((voice) => voice.role === role) ?? voices[0] ?? FALLBACK_VOICES[0];
}

async function loadVoicePool(apiKey) {
  if (DRY_RUN) return FALLBACK_VOICES;
  try {
    const url = `${API_BASE}/v2/voices?page_size=100&voice_type=default&include_total_count=false`;
    const res = await fetch(url, { headers: { "xi-api-key": apiKey } });
    if (!res.ok) {
      const err = await res.text();
      console.warn(`voice list lookup failed (${res.status}): ${err.slice(0, 160)}; using documented defaults`);
      return FALLBACK_VOICES;
    }
    const json = await res.json();
    const defaultVoices = (json.voices ?? [])
      .filter((voice) => !["cloned", "professional"].includes(voice.category))
      .slice(0, 8);
    if (defaultVoices.length < 2) return FALLBACK_VOICES;
    const roles = ["anchor", "host", "analyst", "field", "reader", "fm"];
    return roles.map((role, index) => {
      const voice = defaultVoices[index % defaultVoices.length];
      return { role, name: voice.name ?? `Voice ${index + 1}`, voice_id: voice.voice_id };
    });
  } catch (err) {
    console.warn(`voice list lookup failed: ${err.message}; using documented defaults`);
    return FALLBACK_VOICES;
  }
}

async function ensureDirs() {
  await fs.mkdir(path.join(PUBLIC_AUDIO, "narration"), { recursive: true });
  await fs.mkdir(path.join(PUBLIC_AUDIO, "podcasts"), { recursive: true });
  await fs.mkdir(path.join(PUBLIC_AUDIO, "broadcasts"), { recursive: true });
  await fs.mkdir(path.join(PUBLIC_AUDIO, "fm"), { recursive: true });
  await fs.mkdir(path.join(PUBLIC_AUDIO, "music"), { recursive: true });
  await fs.mkdir(path.join(PUBLIC_AUDIO, "sfx"), { recursive: true });
  await fs.mkdir(PUBLIC_BROADCASTS, { recursive: true });
  await fs.mkdir(path.dirname(CATALOG_PATH), { recursive: true });
}

async function existsNonEmpty(file) {
  try {
    const stat = await fs.stat(file);
    return stat.size > 1024;
  } catch {
    return false;
  }
}

async function callBinary(endpoint, body, outPath, apiKey, label) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${label} failed ${res.status}: ${txt.slice(0, 300)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error(`${label} returned too little audio (${buf.length} bytes)`);
  await fs.writeFile(outPath, buf);
  return buf.length;
}

async function getDurationSeconds(file) {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      file,
    ]);
    const value = Number(stdout.trim());
    return Number.isFinite(value) ? Math.round(value) : null;
  } catch {
    return null;
  }
}

async function concatAudio(inputPaths, outPath) {
  if (inputPaths.length === 1) {
    await fs.copyFile(inputPaths[0], outPath);
    return;
  }
  const listPath = `${outPath}.concat.txt`;
  const body = inputPaths.map((item) => `file '${item.replace(/'/g, "'\\''")}'`).join("\n");
  await fs.writeFile(listPath, body);
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", listPath,
      "-c", "copy",
      outPath,
    ], { maxBuffer: 1024 * 1024 * 10 });
  } finally {
    await fs.rm(listPath, { force: true });
  }
}

async function makeBroadcastVideo({ audioPath, posterPath, outPath }) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-stream_loop", "-1",
    "-i", posterPath,
    "-i", audioPath,
    "-vf", "fps=24,scale=1280:-2,format=yuv420p",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "stillimage",
    "-c:a", "aac",
    "-b:a", "128k",
    "-shortest",
    "-movflags", "+faststart",
    outPath,
  ], { maxBuffer: 1024 * 1024 * 10 });
}

function dialogueChunks(turns, voices, maxChars = 1800) {
  const chunks = [];
  let current = [];
  let currentChars = 0;
  for (const turn of turns) {
    const text = normalizeForSpeech(turn.text);
    const input = { text, voice_id: roleVoice(voices, turn.role).voice_id };
    const size = text.length + 20;
    if (current.length && currentChars + size > maxChars) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(input);
    currentChars += size;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

async function generateDialogueAudio(def, voices, outPath, apiKey) {
  const chunks = dialogueChunks(def.turns, voices);
  const chunkPaths = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = `${outPath}.part-${i + 1}.mp3`;
    chunkPaths.push(chunkPath);
    if (await existsNonEmpty(chunkPath)) continue;
    await callBinary(
      `${API_BASE}/v1/text-to-dialogue?output_format=${OUTPUT_FORMAT}`,
      { inputs: chunks[i], model_id: TTS_MODEL, language_code: "vi" },
      chunkPath,
      apiKey,
      `${def.kind} ${def.id} chunk ${i + 1}`,
    );
  }
  await concatAudio(chunkPaths, outPath);
  for (const chunkPath of chunkPaths) await fs.rm(chunkPath, { force: true });
}

function posterPathFor(article) {
  const fromArticle = typeof article?.heroImage === "string" ? article.heroImage.replace(/^\/+/, "") : "";
  const candidate = fromArticle ? path.join(ROOT, "public", fromArticle) : "";
  if (candidate) return candidate;
  return path.join(PUBLIC_IMAGES, `${article.slug}.avif`);
}

function publicPath(file) {
  return `/${path.relative(path.join(ROOT, "public"), file).split(path.sep).join("/")}`;
}

function catalogEpisode(def, srcPath, posterArticle, durationSeconds, extra = {}) {
  return {
    id: def.id,
    kind: def.kind,
    title: def.title,
    summary: def.summary,
    src: publicPath(srcPath),
    poster: posterArticle?.heroImage ?? `/images/${def.posterSlug}.avif`,
    publishedAt: def.publishedAt,
    durationSeconds,
    articleSlugs: def.articleSlugs,
    transcript: dialogueText(def.turns),
    modelId: TTS_MODEL,
    ...extra,
  };
}

async function generateNarrations({ articles, articleMap, voices, apiKey, catalog, state, failures }) {
  if (!wants("narration")) return;
  const readerVoice = roleVoice(voices, "reader");
  const targets = FEATURED_NARRATION_SLUGS
    .map((slug) => articleMap.get(slug))
    .filter(Boolean)
    .filter((article) => onlyMatches(article.slug));

  for (const article of targets) {
    const id = `narration:${article.slug}`;
    if (RETRY_ONLY && !state.failed.includes(id)) continue;
    const outPath = path.join(PUBLIC_AUDIO, "narration", `${article.slug}.mp3`);
    const transcript = makeNarrationScript(article);
    if (DRY_RUN) {
      console.log(`[dry-run] narration ${article.slug} chars=${transcript.length}`);
      continue;
    }
    try {
      if (!(await existsNonEmpty(outPath))) {
        console.log(`[narration] ${article.slug}`);
        await callBinary(
          `${API_BASE}/v1/text-to-speech/${readerVoice.voice_id}?output_format=${OUTPUT_FORMAT}`,
          {
            text: transcript,
            model_id: TTS_MODEL,
            language_code: "vi",
            voice_settings: { stability: 0.48, similarity_boost: 0.76, style: 0.25, use_speaker_boost: true },
            apply_text_normalization: "auto",
          },
          outPath,
          apiKey,
          `narration ${article.slug}`,
        );
      } else {
        console.log(`[narration] skip exists ${article.slug}`);
      }
      catalog.articles[article.slug] = {
        src: publicPath(outPath),
        title: `Nghe bài viết: ${article.title}`,
        durationSeconds: await getDurationSeconds(outPath),
        transcript,
        modelId: TTS_MODEL,
        voiceName: readerVoice.name,
      };
    } catch (err) {
      failures.push({ id, error: err.message });
      console.error(`[narration] FAIL ${article.slug}: ${err.message}`);
    }
  }
}

async function generateEpisodes({ defs, voices, apiKey, catalog, state, failures, articleMap, kind }) {
  if (!wants(kind)) return;
  const targets = defs.filter((def) => onlyMatches(def.id, ...(def.articleSlugs ?? [])));
  for (const def of targets) {
    const id = `${kind}:${def.id}`;
    if (RETRY_ONLY && !state.failed.includes(id)) continue;
    const folder = kind === "podcast" ? "podcasts" : kind === "broadcast" ? "broadcasts" : "fm";
    const outPath = path.join(PUBLIC_AUDIO, folder, `${def.id}.mp3`);
    const posterArticle = articleMap.get(def.posterSlug);
    if (DRY_RUN) {
      const chars = dialogueChunks(def.turns, voices).map((chunk) => chunk.reduce((sum, item) => sum + item.text.length, 0));
      console.log(`[dry-run] ${kind} ${def.id} chunks=${chars.join("+")} chars`);
      continue;
    }
    try {
      if (!(await existsNonEmpty(outPath))) {
        console.log(`[${kind}] ${def.id}`);
        await generateDialogueAudio(def, voices, outPath, apiKey);
      } else {
        console.log(`[${kind}] skip exists ${def.id}`);
      }
      const durationSeconds = await getDurationSeconds(outPath);
      const extra = {};
      if (kind === "broadcast") {
        const videoPath = path.join(PUBLIC_BROADCASTS, `${def.id}.mp4`);
        if (!(await existsNonEmpty(videoPath))) {
          console.log(`[broadcast] render video ${def.id}`);
          await makeBroadcastVideo({
            audioPath: outPath,
            posterPath: posterPathFor(posterArticle),
            outPath: videoPath,
          });
        }
        extra.videoSrc = publicPath(videoPath);
      }
      upsertEpisode(catalog, catalogEpisode(def, outPath, posterArticle, durationSeconds, extra));
    } catch (err) {
      failures.push({ id, error: err.message });
      console.error(`[${kind}] FAIL ${def.id}: ${err.message}`);
    }
  }
}

async function generateMusic({ apiKey, catalog, state, failures }) {
  if (!wants("music") && !wants("fm")) return;
  for (const item of JINGLE_DEFS.filter((def) => onlyMatches(def.id))) {
    const id = `music:${item.id}`;
    if (RETRY_ONLY && !state.failed.includes(id)) continue;
    const outPath = path.join(PUBLIC_AUDIO, "music", `${item.id}.mp3`);
    if (DRY_RUN) {
      console.log(`[dry-run] music ${item.id} duration=${item.durationMs}ms`);
      continue;
    }
    try {
      if (!(await existsNonEmpty(outPath))) {
        console.log(`[music] ${item.id}`);
        await callBinary(
          `${API_BASE}/v1/music?output_format=${OUTPUT_FORMAT}`,
          { prompt: item.prompt, music_length_ms: item.durationMs, model_id: MUSIC_MODEL, force_instrumental: false },
          outPath,
          apiKey,
          `music ${item.id}`,
        );
      } else {
        console.log(`[music] skip exists ${item.id}`);
      }
      upsertAsset(catalog.assets.jingles, {
        id: item.id,
        title: item.title,
        src: publicPath(outPath),
        durationSeconds: await getDurationSeconds(outPath),
        modelId: MUSIC_MODEL,
      });
    } catch (err) {
      failures.push({ id, error: err.message });
      console.error(`[music] FAIL ${item.id}: ${err.message}`);
    }
  }
}

async function generateSfx({ apiKey, catalog, state, failures }) {
  if (!wants("sfx") && !wants("fm")) return;
  for (const item of SFX_DEFS.filter((def) => onlyMatches(def.id))) {
    const id = `sfx:${item.id}`;
    if (RETRY_ONLY && !state.failed.includes(id)) continue;
    const outPath = path.join(PUBLIC_AUDIO, "sfx", `${item.id}.mp3`);
    if (DRY_RUN) {
      console.log(`[dry-run] sfx ${item.id} duration=${item.durationSeconds}s`);
      continue;
    }
    try {
      if (!(await existsNonEmpty(outPath))) {
        console.log(`[sfx] ${item.id}`);
        await callBinary(
          `${API_BASE}/v1/sound-generation?output_format=${OUTPUT_FORMAT}`,
          {
            text: item.text,
            duration_seconds: item.durationSeconds,
            prompt_influence: 0.45,
            model_id: SFX_MODEL,
            loop: !!item.loop,
          },
          outPath,
          apiKey,
          `sfx ${item.id}`,
        );
      } else {
        console.log(`[sfx] skip exists ${item.id}`);
      }
      upsertAsset(catalog.assets.sfx, {
        id: item.id,
        title: item.title,
        src: publicPath(outPath),
        durationSeconds: await getDurationSeconds(outPath),
        loop: !!item.loop,
        modelId: SFX_MODEL,
      });
    } catch (err) {
      failures.push({ id, error: err.message });
      console.error(`[sfx] FAIL ${item.id}: ${err.message}`);
    }
  }
}

function emptyCatalog() {
  return {
    generatedAt: new Date().toISOString(),
    articles: {},
    episodes: [],
    assets: { jingles: [], sfx: [] },
  };
}

async function loadCatalog() {
  try {
    const parsed = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8"));
    return {
      generatedAt: new Date().toISOString(),
      articles: parsed.articles ?? {},
      episodes: parsed.episodes ?? [],
      assets: {
        jingles: parsed.assets?.jingles ?? [],
        sfx: parsed.assets?.sfx ?? [],
      },
    };
  } catch {
    return emptyCatalog();
  }
}

function upsertEpisode(catalog, episode) {
  const index = catalog.episodes.findIndex((item) => item.id === episode.id);
  if (index >= 0) {
    catalog.episodes[index] = episode;
  } else {
    catalog.episodes.push(episode);
  }
}

function upsertAsset(collection, asset) {
  const index = collection.findIndex((item) => item.id === asset.id);
  if (index >= 0) {
    collection[index] = asset;
  } else {
    collection.push(asset);
  }
}

async function main() {
  await loadEnvFile(PARENT_ENV);
  await ensureDirs();
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!DRY_RUN && !apiKey) {
    console.error(`ELEVENLABS_API_KEY missing. Expected it in ${PARENT_ENV}`);
    process.exit(1);
  }

  const articles = await loadArticles();
  const articleMap = bySlug(articles);
  const voices = await loadVoicePool(apiKey);
  const podcastDefs = buildPodcastDefs(articleMap);
  const broadcastDefs = buildBroadcastDefs(articleMap);
  const fmDefs = buildFmDefs(articleMap);
  const state = await loadState();
  const catalog = await loadCatalog();
  const failures = [];

  console.log(`profile=${PROFILE} dryRun=${DRY_RUN} kinds=${KINDS ? [...KINDS].join(",") : "all"} only=${ONLY ? [...ONLY].join(",") : "all"}`);
  console.log(`articles=${articles.length} narrations=${FEATURED_NARRATION_SLUGS.length} podcasts=${podcastDefs.length} broadcasts=${broadcastDefs.length} fm=${fmDefs.length}`);
  console.log(`voices=${voices.map((voice) => `${voice.role}:${voice.name}`).join(", ")}`);
  console.log("");

  await generateNarrations({ articles, articleMap, voices, apiKey, catalog, state, failures });
  await generateEpisodes({ defs: podcastDefs, voices, apiKey, catalog, state, failures, articleMap, kind: "podcast" });
  await generateEpisodes({ defs: broadcastDefs, voices, apiKey, catalog, state, failures, articleMap, kind: "broadcast" });
  await generateMusic({ apiKey, catalog, state, failures });
  await generateSfx({ apiKey, catalog, state, failures });
  await generateEpisodes({ defs: fmDefs, voices, apiKey, catalog, state, failures, articleMap, kind: "fm" });

  if (!DRY_RUN) {
    catalog.episodes.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    await fs.writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
    state.runs.push({
      ts: new Date().toISOString(),
      profile: PROFILE,
      kinds: KINDS ? [...KINDS] : ["all"],
      failed: failures.length,
      episodes: catalog.episodes.length,
      narrations: Object.keys(catalog.articles).length,
    });
    state.failed = failures.map((failure) => failure.id);
    await saveState(state);
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(`narrations in catalog: ${Object.keys(catalog.articles).length}`);
  console.log(`episodes in catalog:   ${catalog.episodes.length}`);
  console.log(`jingles in catalog:    ${catalog.assets.jingles.length}`);
  console.log(`sfx in catalog:        ${catalog.assets.sfx.length}`);
  console.log(`failed:                ${failures.length}`);
  for (const failure of failures) console.log(`  - ${failure.id}: ${failure.error}`);
  if (DRY_RUN) console.log("\ndry run complete; no files were generated or changed");
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
