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

function makeLongform2045Episode(articleMap) {
  const turns = [
    {
      role: "host",
      name: "Minh Anh",
      text: `[warm, intimate] Hôm nay mình không làm kiểu điểm tin. Tôi chỉ muốn rủ Quang Dũng ngồi xuống như hai người bạn vừa hết một tuần quá dài, gọi cà phê, nhìn thành phố ngoài cửa kính và tự hỏi: sống ở Việt Nam năm hai nghìn không trăm bốn mươi lăm thực ra có cảm giác như thế nào. Không phải cảm giác đọc tin, mà là cảm giác làm con, đi làm, trả tiền nhà, gọi về cho bố mẹ, và tự nhủ là chắc mình vẫn theo kịp thời đại.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[measured] Tôi thích cách anh nói là cảm giác sống chứ không phải cảm giác đọc. Vì càng nhìn kỹ, tôi càng thấy cái năm hai nghìn không trăm bốn mươi lăm này không hề bay bổng như mấy poster tương lai hay vẽ. Nó không bắt đầu bằng xe bay hay robot. Nó bắt đầu bằng những thứ rất quen: một cuộc gọi lỡ của mẹ, một hóa đơn đến sớm hơn lương, một câu hỏi xem có nên mua vàng không, có nên chuyển nhà không, có nên để agent gọi thay mình không. Công nghệ có ở khắp nơi, nhưng nỗi lo vẫn là nỗi lo cũ. Chỉ là nó mặc quần áo mới và nói giọng lịch sự hơn.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[thoughtful] Tôi có cảm giác rất lạ vào sáng mùng một tháng năm, sau cái không khí đại lễ một trăm năm Quốc khánh. Trên màn hình là cờ, là những lời rất lớn về khát vọng Việt Nam, là hình ảnh tuyến phòng thủ ven biển như một biểu tượng của ý chí quốc gia. Nhưng cùng lúc đó, có một bản tin khác về đoạn Vinh - Đông Hà của đường sắt cao tốc lại lùi thêm lần nữa. Tức là trong cùng một buổi sáng, mình vừa được mời bước vào một tương lai rất hùng tráng, vừa bị kéo lại bằng một cảm giác quen đến phát chán: à, lại hẹn tiếp.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[calm] Đúng. Và điều làm tôi thấy buồn cười, nhưng cũng hơi chua, là mình đã quá quen với việc sống trong hai nhịp thời gian cùng một lúc. Một nhịp là ngôn ngữ chính thức: quyết tâm, biểu tượng, bước ngoặt, khát vọng, đồng lòng. Nhịp kia là ngôn ngữ đời thường: thôi kệ, chắc còn lâu, cứ liệu đường mà sống. Thành ra người dân không còn phản ứng mạnh khi nghe một mục tiêu được dời mốc. Họ chỉ lặng lẽ điều chỉnh kỳ vọng. Tôi nghĩ đó là tâm thế rất Việt Nam trong tương lai này: vẫn yêu những lời lớn, nhưng không còn đặt hết cuộc đời mình vào chúng.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[more personal] Tôi nhớ tối hôm đó gọi về cho bố mẹ. Bố tôi vừa xem đại lễ xong, giọng vẫn còn hào hứng. Ông nói nghe bài phát biểu mà thấy nở trong lòng, kiểu mình đã đi được một quãng rất dài. Rồi chỉ năm phút sau, ông hỏi luôn là thế giờ có nên chốt vàng không, tại thấy hàng xóm bảo sắp lên nữa. Tôi không cười nổi, vì tôi thấy thương. Thế hệ của bố mẹ mình vẫn giữ khả năng xúc động trước lịch sử, nhưng họ cũng đã trải qua đủ nhiều để biết cuối cùng mình vẫn phải tự lo phần an toàn cho gia đình. Hai tâm trạng đó ở trong cùng một con người, cùng một cuộc điện thoại, và tôi nghĩ đó là chân dung rất thật của xã hội này.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[gentle] Tức là mình vẫn xúc động thật khi xem đại lễ, nhưng xúc động xong vẫn phải mở ứng dụng ngân hàng, vẫn phải xem giá vàng, vẫn phải cân nhắc có nên đặt cọc một căn hộ nổi nào đó không. Tôi thấy cái tương lai của mình trong bộ bài này không phải là tương lai của những nhà hoạch định. Nó là tương lai của tầng lớp phải tự xoay. Và tự xoay ở đây không chỉ là kiếm tiền. Nó là liên tục đoán xem cuộc chơi đang đổi luật theo hướng nào để mình không bị văng ra ngoài.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[personal, descriptive] Sáng hôm sau tôi đi làm bằng tuyến commuter, đứng trên sân ga nhìn bảng điện tử cứ lùi từng phút một. Phía bên kia đường là màn hình công cộng chạy lại những hình ảnh rất đẹp của đại lễ đêm trước. Tôi không thấy mỉa mai theo kiểu cay độc đâu, chỉ thấy đó là trạng thái bình thường của đời sống mình bây giờ. Mình có thể thật lòng rung động trước một biểu tượng quốc gia, rồi ngay sau đó cũng thật lòng bực bội vì chuyến tàu chậm mười bảy phút và cuộc họp đầu ngày sắp trễ. Hai trạng thái không triệt tiêu nhau. Chúng chỉ sống cạnh nhau. Có lẽ trưởng thành trong xã hội này là học cách chứa đồng thời cả tự hào lẫn dè chừng mà không phát điên.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[conversational] Anh nói đến căn hộ nổi làm tôi nhớ ngay cái cơn sốt bốc thăm ở Cần Giờ. Tôi có một cậu em họ, hai vợ chồng làm không tệ, lương khá, đều có agent hỗ trợ công việc, nhìn trên giấy tờ là người đã bắt kịp thời đại. Nhưng đến lúc đứng trước bài toán mua nhà thì vẫn hoảng loạn y hệt bố mẹ mình ngày xưa. Họ biết tỷ lệ trúng cực thấp, biết căn hộ đó không phải giải pháp hoàn hảo, biết giá đã bị đẩy quá xa so với thu nhập. Thế mà họ vẫn nộp hồ sơ. Vì với họ, điều đáng sợ nhất không phải trả giá cao. Điều đáng sợ nhất là cảm giác nếu không tham gia thì mình sẽ bị bỏ lại ở bên ngoài cánh cửa duy nhất còn hé mở.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[half-laughing] Và nếu không lao vào nhà nổi thì lao vào vàng. Cái bản năng trú ẩn ấy không hề mất đi trong thời đại e V T O L và agent gia đình. Nó chỉ đổi từ chuyện tích gạo, tích đô, sang chuyện tích thứ gì có vẻ còn đứng yên khi xung quanh mọi thứ quá biến động. Tôi thấy buồn cười ở chỗ người ta có thể nói cả ngày về đổi mới sáng tạo, nhưng tới cuối ngày vẫn xếp hàng mua vàng như một nghi thức trấn an. Nó không hẳn là tham lam đâu. Nhiều khi nó là cách duy nhất để cảm thấy mình vẫn còn nắm được thứ gì đó không phụ thuộc vào thuật toán của ai.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[steady, anecdotal] Tôi có một người bạn làm đám cưới năm ngoái, rất hiện đại, rất tỉnh táo, hai người sống với nhau nhiều năm rồi mới tổ chức. Tưởng đâu phần khó nhất là lên danh sách khách mời, ai ngờ phần khó nhất lại là trả lời câu hỏi bao giờ mua nhà. Bạn bè thì hỏi kiểu xã giao, họ hàng thì hỏi như một nghĩa vụ, còn bản thân hai đứa tự hỏi nhau như tự tra tấn nhau. Bọn nó kiếm ra tiền, không phải thất nghiệp, không phải thiếu cố gắng. Nhưng chỉ cần thiếu một căn nhà đúng nghĩa là cả hai tự thấy mình vẫn chưa được phép bước sang giai đoạn kế tiếp của cuộc đời. Tôi nghĩ đó là chỗ đau nhất: xã hội này nói rất nhiều về tương lai, nhưng quyền được trưởng thành vẫn bị gắn vào những cột mốc vật chất cực kỳ cứng.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[lower, more intimate] Cái khó nói nhất là sự xấu hổ âm thầm đi cùng những cột mốc ấy. Không ai tuyên bố thẳng là nếu anh còn thuê nhà thì anh kém cỏi. Nhưng cả xã hội được thiết kế để anh tự cảm thấy điều đó. Từ mẫu quảng cáo, từ cách ngân hàng nói chuyện với anh, từ cách họ hàng hỏi thăm, từ cả những câu đùa tưởng như vô hại. Thành ra nhiều người lao đầu vào một căn nhà hay một khoản vàng không chỉ để bảo toàn tài sản. Họ lao vào để xin lại phẩm giá của người trưởng thành. Tôi nghĩ đó là lý do các cuộc xếp hàng luôn đông hơn tính toán kinh tế thuần túy rất nhiều.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[quietly amused] Tôi đang ở tuổi mà đi dự ba đám cưới liền thì sẽ nghe cùng một câu ở ba bàn khác nhau: thôi thương nhau đến đâu thì thương, chứ có chỗ ở ổn định rồi tính tiếp. Câu đó nghe như lời khuyên, nhưng thực ra là một triết lý xã hội. Nó bảo rằng tình cảm chỉ được công nhận trọn vẹn khi đã có hạ tầng đi kèm. Nên nhiều người trẻ thành ra vừa lãng mạn vừa rất kế toán. Yêu nhau xong phải mở bảng tính. Muốn sinh con phải mở app giá thuê, giá học, giá chăm sóc y tế, giá đi lại. Tôi nghĩ sự mỏi mệt trong những bài báo về nhà ở không đến từ giá cao đơn thuần. Nó đến từ cảm giác mọi quyết định riêng tư nhất của đời người đều đang bị một thị trường khổng lồ đứng cạnh gật đầu hay lắc đầu.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[reflective] Và từ câu chuyện tiền bạc, tôi thấy mình bước rất tự nhiên sang câu chuyện gia đình. Bởi vì ở Việt Nam, chuyện nhà không bao giờ chỉ là tài sản. Nó luôn là đạo đức. Có nhà hay không liên quan đến việc có dám cưới không, có sinh con không, có đón bố mẹ lên ở cùng được không, có giữ được cảm giác mình là người trưởng thành tử tế không. Thành ra công nghệ càng phát triển, áp lực gia đình càng không biến mất. Nó chỉ chui vào những chỗ tinh vi hơn. Ví dụ bây giờ người ta có thể thuê agent gọi điện hỏi thăm bố mẹ, nhắc lịch khám bệnh, đặt hoa giỗ. Bề ngoài, mọi thứ trơn tru và chu đáo hơn. Nhưng bên trong thì xuất hiện một câu hỏi rất khó chịu: nếu máy đã làm thay phần chăm sóc bề mặt, phần yêu thương thật sự còn nằm ở đâu.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[softer] Tôi nghĩ nhiều người nghe đoạn này sẽ thấy nhói. Vì nó quá gần. Rất nhiều người trẻ không vô tâm. Họ chỉ quá mệt. Họ ở giữa một công việc đòi phản hồi liên tục, một thành phố đắt đỏ, một hôn nhân mong manh, một cuộc sống mà ngay cả nghỉ ngơi cũng phải lên lịch. Nên agent xuất hiện như một lối thoát đạo đức: mình vẫn làm tròn, nhưng đỡ kiệt sức hơn. Chỉ có điều lối thoát nào cũng có cái giá của nó. Khi bot của mình nói chuyện với bot của mẹ, khi mẹ chồng nhắn qua Zalo rồi một trợ lý tự tóm tắt lại cho mình đọc sau, mình bắt đầu thấy gia đình không còn là một nơi nữa. Nó thành một hệ thống cần vận hành trơn tru.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[hesitant] Tôi thú thật là tôi từng thử để agent gọi trước cho mẹ vài hôm liên tiếp. Nó làm rất tốt. Quá tốt luôn. Nhắc đúng giờ uống thuốc, nhớ cả chuyện cuối tuần bà muốn sang thăm dì út, còn tự động gửi cả mấy tấm ảnh cây cối ngoài ban công cho đỡ trống. Vấn đề là tối đó khi tôi thật sự rảnh để gọi lại, tôi bỗng có cảm giác như cuộc trò chuyện quan trọng nhất trong ngày đã diễn ra rồi, chỉ là không có tôi ở trong đó. Mẹ vẫn vui, mọi việc vẫn ổn, nhưng tôi thấy mình bị rút ra khỏi chính vai trò mà mình tưởng là không thể thay thế. Cảm giác ấy không hẳn là ghen với máy. Nó giống xấu hổ hơn.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[gentle, probing] Tôi nghĩ rất nhiều người sẽ nhận ra mình trong cái xấu hổ đó. Bởi vì thế hệ mình được nuôi dạy bằng một thứ đạo đức khá nghiêm: làm con thì phải có mặt, làm chồng làm vợ thì phải san sẻ, làm cha làm mẹ thì phải dõi theo từng bước. Đến khi đời sống khiến mình không đủ sức có mặt theo nghĩa cũ nữa, mình bắt đầu thương lượng với công nghệ để bù vào khoảng thiếu. Điều khó chịu là công nghệ thường hoàn thành phần việc rất gọn ghẽ, nên nó vô tình phơi ra sự vụng về của chính mình. Mình không còn bảo rằng mình bận. Mình buộc phải đối diện với chuyện có những lúc mình mệt quá, trống quá, hoặc tê quá để làm người thân theo kiểu mình từng được dạy.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[warm] Nhưng tôi không muốn thành người than công nghệ làm hỏng tình thân. Vấn đề không nằm ở công nghệ. Vấn đề là xã hội này khiến người ta kiệt sức tới mức phải thuê cả sự hiện diện. Tôi nghĩ đó mới là câu chuyện buồn ở bên dưới. Agent chỉ là băng gạc. Vết thương là nhịp sống. Và khi mình nhìn sang giáo dục thì cũng thấy đúng cái logic ấy. Nhà nào có tiền thì mua cho con một agent tốt hơn, một môi trường học yên tĩnh hơn, một hệ sinh thái tối ưu hơn. Nhà không có tiền thì bám vào thư viện công cộng, vào gói miễn phí, vào trí thông minh và sự lì của đứa trẻ. Chuyện cậu bé học ở thư viện làng đỗ thủ khoa A I làm mọi người xúc động, nhưng nó cũng lộ ra một sự thật không dễ nghe: bất bình đẳng không biến mất khi công cụ thông minh hơn. Nó chỉ trở nên lịch sự hơn, khó gọi tên hơn.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[observational] Và cái bất bình đẳng lịch sự đó mới đáng ngại. Vì hồi xưa mình còn nhìn thấy nó khá rõ: nhà nào có tiền cho con học thêm, nhà nào không. Bây giờ mọi người đều có thể nói nền tảng này miễn phí, thư viện kia mở cửa, gói cơ bản vẫn dùng được. Nghe rất dân chủ. Nhưng ai từng làm việc với mấy hệ thống này đều biết sự khác biệt thật nằm ở chất lượng agent, chất lượng dữ liệu cá nhân hóa, tốc độ phản hồi, thời gian người lớn có thể ngồi cùng con. Chênh lệch không nằm ở cánh cửa vào nữa. Nó nằm ở độ sâu mà mỗi đứa trẻ được phép đi tiếp sau khi bước vào cánh cửa đó.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[curious, natural] Đúng, và cái đau ở đây là ai cũng có thể nói mình đang trao cơ hội. Trường nói đã phổ cập nền tảng học. Doanh nghiệp nói đã tài trợ. Chính quyền nói hạ tầng tiếp cận đang tốt lên. Tất cả đều đúng một phần. Nhưng cuối cùng, một đứa trẻ vẫn phải tự chiến đấu để chứng minh mình xứng đáng được nhìn thấy. Tôi luôn thấy những đề văn gây tranh cãi trong xã hội mình thú vị ở chỗ đó. Người lớn cãi nhau về một tác phẩm khó hay dễ, quá nặng hay quá cảm tính, nhưng phía sau là nỗi sợ lớn hơn nhiều: con mình có đang bị kéo vào một cuộc thi mà luật chơi thay đổi nhanh hơn khả năng thích nghi của nó không.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[considered] Và sâu hơn nữa là câu hỏi xã hội này đang định nghĩa người thông minh là gì. Nếu một đứa trẻ biết dùng agent thật trơn tru, biết tối ưu lịch học, biết tìm đường tắt trong mọi hệ thống, thì đó là năng lực đáng khen hay chỉ là khả năng thích ứng với một môi trường vốn đã bất công. Tôi không có câu trả lời gọn. Nhưng tôi thấy lo khi người lớn bắt đầu nhầm giữa sự thành thạo công cụ với chiều sâu nội tâm. Một đứa trẻ có thể xử lý bài tập rất nhanh, mà vẫn không có lấy một khoảng yên để hình thành tiếng nói riêng. Mà giáo dục, ở tầng cuối cùng, nếu không bảo vệ được tiếng nói riêng đó thì nguy hiểm.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[slow, personal] Có lẽ vì tôi chưa có con nên tôi nhìn chuyện này hơi vòng vo, đi qua bạn bè trước. Nhưng nhìn bạn bè nuôi con trong thời đại agent mới thấy làm cha mẹ bây giờ gần như là một nghề toàn thời gian cộng thêm một nghề kiểm định. Họ phải chọn nền tảng nào, giới hạn mức tự động hóa ra sao, khi nào để máy kèm, khi nào bắt buộc chính mình phải ngồi xuống cùng con dù đã kiệt sức. Họ không chỉ lo con học tốt. Họ lo con sẽ lớn lên với cảm giác thế nào về chính giá trị của mình. Nếu mọi thứ đều được tối ưu hóa xung quanh đứa trẻ, thì làm sao để nó không tưởng rằng mình chỉ đáng yêu khi hoạt động hiệu quả.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[lower, serious] Và khi xã hội bước sang lĩnh vực pháp luật, nỗi sợ ấy chuyển thành một dạng mất đất khác: mất đất dưới chân của sự thật. Những vụ deepfake từ thiện, những cuộc gọi bằng giọng người đã khuất, những mô hình tâm linh tự động hóa, với tôi, không chỉ là chuyện lừa đảo công nghệ cao. Nó là chuyện lòng tin của người Việt bị khai thác ở chính những chỗ mềm nhất. Người ta không bị lừa vì ngu. Người ta bị lừa vì nhớ một giọng nói, vì muốn cứu một đứa trẻ, vì cần ai đó bảo rằng số phận mình rồi sẽ bớt xấu. Khi công nghệ đủ giỏi để giả được sự chân thành, pháp luật không còn chỉ đuổi theo hành vi sai. Nó phải đuổi theo cả cảm xúc đã bị chiếm dụng.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[quiet] Tôi thấy đây là đoạn làm cho năm hai nghìn không trăm bốn mươi lăm bớt vui hẳn. Vì tới một lúc, mình nhận ra xã hội này không thiếu dữ liệu, không thiếu xác thực, không thiếu chuẩn an toàn như Đan Sa. Cái nó thiếu là khoảng tin cậy tự nhiên giữa người với người. Mọi thứ đều cần một lớp chứng thực nữa, một lớp kiểm tra nữa, một con dấu nữa. Về kỹ thuật thì có thể hợp lý. Nhưng về cảm xúc, nó làm con người kiệt quệ. Nếu mỗi cuộc gọi từ người thân cũng cần hỏi đây là mẹ thật hay agent, nếu mỗi video kêu gọi quyên góp cũng cần mở thêm ba lớp xác minh, thì đời sống tinh thần sẽ trở nên rất mệt.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[serious, human] Tôi nghĩ người ta hay đánh giá thấp sự mệt này vì nó không nhìn thấy bằng mắt. Nó không giống kẹt xe hay ngập đường. Nó là thứ âm ỉ hơn: một ngày bạn phải nghi ngờ năm thứ trước đây từng rất tự nhiên, và tối về não bạn kiệt pin mà không hiểu tại sao. Mẹ gọi đến, bạn phải nhìn xác thực sinh trắc. Một clip quyên góp xuất hiện, bạn phải xem nguồn dựng. Một lời xin lỗi của nghệ sĩ lan ra, bạn phải tự hỏi giọng này đã qua xử lý chưa. Tới một điểm nào đó, con người không còn sống trong môi trường thông tin nữa, mà sống trong môi trường kiểm chứng. Mà kiểm chứng liên tục thì rất cô độc.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[low, honest] Tôi thấy cái cô độc ấy còn kéo theo một phản xạ khác, là thu mình. Khi mọi thứ đều có thể giả, người ta bắt đầu co lại vào những vòng tròn tin cậy nhỏ hơn: gia đình ruột, vài người bạn cũ, vài nhóm chat kín, vài nguồn thông tin quen. Điều này có mặt tốt là giúp mình sống sót tinh thần. Nhưng mặt xấu là xã hội dễ bị chia thành những hòn đảo ngày càng ít nói chuyện với nhau. Người nào cũng bảo mình chỉ cẩn thận thôi, nhưng cộng lại thì thành một bầu không khí rất khó cho sự đồng cảm. Muốn tin một người lạ đã khó, muốn thay đổi ý kiến sau khi đã nghi ngờ họ lại còn khó hơn.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[thoughtful] Mà anh để ý không, đúng lúc lòng tin cá nhân mong manh hơn thì câu hỏi về cộng đồng lại lớn hơn. Câu chuyện lao động hữu nghị, những gia đình nhập cư, đội tuyển quốc gia có con em lao động Philippines, tất cả những chuyện ấy làm tôi nghĩ nhiều về việc một quốc gia tự kể mình là ai. Trước đây mình quen tưởng tượng bản sắc là cái gì khá cố định. Nhưng đến hai nghìn không trăm bốn mươi lăm, bản sắc rõ ràng đã trở thành một cuộc thương lượng đang diễn ra mỗi ngày, trong nhà máy, trong lớp học, ngoài sân bóng, trong tiếng nói con cái, trong thực đơn gia đình. Tôi thấy đây là phần thú vị nhất của thế giới này, và cũng là phần nhạy cảm nhất.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[engaged] Tôi đồng ý, và tôi thấy cái nhạy cảm ấy nằm ở chỗ mọi người thường chỉ chấp nhận sự thay đổi khi nó đi qua một khung cảm xúc quen thuộc. Ví dụ trên sân bóng thì dễ chấp nhận hơn, vì chiến thắng giúp mọi người thấy gần nhau ngay lập tức. Nhưng ở đời sống hằng ngày, sự gần nhau chậm hơn nhiều. Nó đi qua chuyện con mình ngồi cạnh ai trong lớp, khu trọ nói những thứ tiếng nào, mẹ mình có khó chịu khi cháu nội nói lẫn giọng hay không, bữa cơm gia đình xuất hiện món ăn nào, tên gọi nào nghe vẫn còn lạ. Tức là bản sắc không đổi bằng nghị quyết. Nó đổi bằng bữa tối, bằng tiếng ru, bằng cách trẻ con đùa với nhau.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[more animated] Vì nó đụng vào thứ người Việt rất dễ vừa tự hào vừa phòng thủ, đó là cảm giác thuộc về. Một trận bóng có thể khiến mọi người mở lòng rất nhanh. Một tấm huy chương có thể làm câu chuyện nhập cư nghe dễ chịu hơn nhiều. Nhưng đời sống thì dài hơn chín mươi phút. Sau khi tiếng còi mãn cuộc hết vang, xã hội vẫn phải trả lời những câu khó hơn: ai được coi là người trong nhà, ai chỉ là lao động tạm trú, ai có quyền mơ về tương lai ở đây như một điều bình thường chứ không phải ân huệ. Tôi thấy năm hai nghìn không trăm bốn mươi lăm này đang buộc Việt Nam phải lớn lên theo nghĩa đó, dù có muốn hay không.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[thoughtful, vivid] Và có một biểu hiện rất nhỏ nhưng tôi thấy hay: ngôn ngữ. Khi trẻ con lớn lên trong những gia đình pha trộn, trong các khu dân cư và trường học đủ giọng vùng miền lẫn giọng nhập cư, tiếng Việt của tụi nhỏ tự nhiên rộng ra. Ngày xưa người lớn thường coi chuyện đó là lệch chuẩn. Nhưng có khi đó lại là lúc một xã hội thật sự thay da. Không phải ở chỗ treo khẩu hiệu đa dạng, mà ở chỗ nó chấp nhận để ngữ điệu của mình thay đổi một chút. Tôi nghĩ tương lai của một quốc gia nhiều khi hiện ra trước hết trong giọng nói của trẻ con, trước khi hiện ra trong mọi văn kiện chính thức.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[casual, vivid] Và lớn lên thì luôn tốn kém. Nhìn vào giao thông và đô thị là thấy ngay. Có người đi e V T O L cuối tuần từ thành phố Hồ Chí Minh ra Vũng Tàu như thể bắt taxi trên trời, trong khi người khác vẫn sống trong hành trình tàu, xe khách, tàu. Có quận được làm sạch tiếng ồn để đón tầng lớp mới, có khu dân cư phản ứng vì bầu trời phía trên tự nhiên thành đường bay. Tương lai đến không đều. Nó đáp xuống một số mái nhà trước, còn những mái khác chỉ nghe tiếng quạt gió từ xa. Thế nên khi nghe ai đó nói đất nước đã bước sang một kỷ nguyên mới, tôi luôn muốn hỏi thêm: với ai.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[laughing softly] Và với chi phí nào. Tôi thấy người Việt trong cái thế giới này rất thực tế. Họ không phản đối tương lai theo kiểu lãng mạn. Họ phản đối tiếng ồn, tiền thuê, giá vé, phí duy trì, điều khoản ẩn, quyền ưu tiên, thời gian chờ. Nói cách khác, họ không cãi với ý tưởng hiện đại hóa. Họ cãi với hóa đơn của hiện đại hóa. Điều này làm cho các bài về nhà đất, phương tiện, thậm chí du lịch ngủ ghép đều có chung một cảm giác: tương lai không miễn phí, và thường người đến sau sẽ phải trả đắt hơn để được bước vào cùng một căn phòng.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[dry, observant] Cụm từ hóa đơn của hiện đại hóa rất đúng. Vì nhiều khi tranh luận ở ta nghe như tranh luận văn hóa, nhưng đào xuống một lớp là tranh luận kế toán. Bao nhiêu tiền một tháng để duy trì agent gia đình. Bao nhiêu cho một chỗ ở không ngập. Bao nhiêu cho một chuyến di chuyển bớt mất thời gian. Bao nhiêu để con không bị tụt so với lứa bạn. Bao nhiêu để dữ liệu của mình được bảo vệ ở mức đủ yên tâm. Từng khoản riêng lẻ nghe có vẻ hợp lý, nhưng cộng lại thì thành một thứ áp lực vô hình: muốn sống như người hiện đại thì phải liên tục trả phí để giữ chỗ trong chính tương lai của mình.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[lighter, then serious] Còn giải trí thì sao. Tôi nghĩ đó là nơi xã hội tập dượt cảm giác sống chung với cái giả mà vẫn phải phản ứng thật. Hoa hậu A I, scandal ba mươi mốt phần trăm deepfake, livestream kéo tám tiếng để chứng minh độ thật, lời xin lỗi ai cũng nghe nhưng không ai chắc nên tin đến đâu. Showbiz trong năm hai nghìn không trăm bốn mươi lăm không chỉ là một ngành công nghiệp giải trí. Nó là phòng thí nghiệm đạo đức của công chúng. Ở đó, người ta học cách nghi ngờ hình ảnh, nghi ngờ giọng nói, nghi ngờ cả cảm xúc của chính mình. Và nếu khán giả tập nghi ngờ ở đó đủ lâu, thói quen ấy sẽ mang theo sang đời sống chính trị, pháp lý, gia đình.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[half amused, half tired] Có lúc tôi nghĩ khán giả Việt trong giai đoạn này thật ra rất giỏi. Giỏi đến mức tội. Họ phải tự nâng cấp trực giác mỗi ngày. Ngày xưa chỉ cần hỏi tin này có thật không. Bây giờ phải hỏi thêm: thật bao nhiêu phần trăm, thật ở đoạn nào, giả ở tầng nào, người đăng đang lợi dụng cảm xúc gì của mình. Nghe thì như kỹ năng truyền thông số, nhưng sống với nó lâu sẽ thành mỏi mệt tinh thần. Cứ phải tỉnh táo liên tục cũng là một dạng lao động, mà lại là dạng lao động hầu như không ai trả công.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[slower] Có lẽ vì vậy mà tôi không coi chuyện deepfake chỉ là chuyện kỹ thuật nữa. Nó làm bào mòn một kỹ năng xã hội rất căn bản là khả năng ngồi trước một gương mặt và tin rằng người kia đang thật. Nếu kỹ năng đó mòn đi, mọi thứ đều trở nên mệt hơn: yêu nhau mệt hơn, tha thứ mệt hơn, làm báo mệt hơn, tranh luận mệt hơn. Và rồi tới cả thể thao, thứ tưởng như đơn giản nhất, cũng không còn là chỗ trú. A I V A R chính xác hơn con người nhưng lại không làm con người thanh thản hơn. Vì cái người ta cần không phải chỉ là quyết định đúng. Họ cần cảm giác công bằng được cảm nhận bằng tim, chứ không chỉ được tính bằng dữ liệu.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[reflective, deepening] Nên cuối cùng chúng ta quay lại với khí hậu, với đại hồng thủy, với những bóng dài mà xã hội này vẫn mang theo. Tôi nghĩ có một điều rất thật là sau một biến cố lớn, người ta không nhắc nó mỗi ngày nữa, nhưng đời sống sẽ bị tổ chức lại quanh ký ức ấy. Tuyến phòng thủ ven biển, cơn sốt nhà ở nơi cao ráo, cách người ta nói về mùa lễ, du lịch, đầu tư, mọi thứ đều có dấu nước ở đâu đó. Và khi một xã hội vừa phải thích ứng với khí hậu, vừa phải thích ứng với A I, vừa phải thích ứng với dịch chuyển dân số, thì sự mệt mỏi của nó không phải thất bại đạo đức. Nó là trạng thái nền.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[quiet memory] Tôi còn nhớ rất rõ cảm giác sau đại hồng thủy, không phải nước dâng đến đâu, mà là tiếng người lớn nói chuyện về tương lai nhỏ lại hẳn. Trước đó ai cũng hay nói mười năm nữa, hai mươi năm nữa. Sau biến cố, mọi câu hỏi đều co về gần hơn: mùa này thế nào, khu này còn ở được không, năm sau có phải chuyển không. Nên khi nghe các dự án lớn về thích ứng khí hậu bây giờ, tôi luôn nghe bằng hai lớp tai. Một lớp muốn tin thật sự. Một lớp còn giữ ký ức rằng nước đã từng đi vào nhà nhanh hơn mọi lời trấn an. Có lẽ vì thế mà tương lai ở xã hội này không bao giờ là một đường thẳng. Nó luôn có bóng của một trận mưa cũ đi kèm.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[soft, gathering threads] Tôi nghĩ đây là lý do làm tôi thấy cái thế giới này đáng tin, dù nó hư cấu. Nó không cố thuyết phục mình bằng những món đồ kỳ lạ. Nó thuyết phục bằng sự mệt mỏi rất nhận ra được. Bằng cảm giác vừa tự hào về đất nước vừa không hoàn toàn tin vào lời hứa. Vừa yêu gia đình vừa thấy ngộp. Vừa muốn công nghệ giúp mình nhẹ đi vừa sợ nó lấy mất cái gì đó không gọi tên được. Vừa cười vì một bản tin phi lý vừa chột dạ vì hình như nó chỉ đẩy hiện tại đi xa thêm vài bước.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[reflective, meta but natural] Có lẽ vì thế mà một tờ báo giả lại làm tôi tin vào cảm giác thật. Bởi nó dùng đúng cái khung mình đã quen từ nhỏ: logo, chuyên mục, sapo, ảnh minh họa, bình luận, tin liên quan. Mình bước vào với tâm thế của người đọc báo hằng ngày, nên khi gặp những chi tiết lệch đi, mình không phản ứng như đang xem khoa học viễn tưởng. Mình phản ứng như đang đọc chính đời sống của mình bị đẩy nghiêng thêm vài độ. Và cái lệch vài độ đó đủ để làm hiện ra rất nhiều điều bình thường ngày thường mình không gọi tên được.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[softer, hopeful] Nhưng tôi cũng không muốn kết thúc chỉ bằng sự mệt. Có một điều tôi thấy đẹp trong cái bức tranh này, dù hơi buồn, là con người vẫn cố giữ những cử chỉ rất nhỏ. Vẫn có người xếp hàng chờ mua nhà vì muốn cho con một chỗ ở ổn định. Vẫn có người gọi về cho mẹ dù agent đã gọi rồi. Vẫn có đứa trẻ ngồi ở thư viện làng học đến khuya. Vẫn có những khán giả còn muốn phân biệt cái thật với cái giả thay vì buông luôn cho tiện. Tôi nghĩ xã hội còn cứu được là nhờ những cử chỉ nhỏ đó. Chúng không tạo nên diễn văn lớn, nhưng chúng giữ cho đời sống không trượt hẳn vào sự lạnh lẽo tối ưu.`,
    },
    {
      role: "analyst",
      name: "Quang Dũng",
      text: `[warm, natural close] Và có lẽ đó là storyline thật của năm hai nghìn không trăm bốn mươi lăm này. Không phải chuyện đất nước đã trở thành gì, mà là chuyện con người đang cố giữ mình nguyên vẹn như thế nào khi mọi thứ quanh họ tăng tốc. Ai cũng phải thương lượng một chút với thời đại: bớt tin một chút, bớt kỳ vọng một chút, thuê bớt sự hiện diện, mua thêm chút an tâm, và cố không đánh rơi phần người của mình giữa tất cả những hệ thống tối ưu hóa. Nếu nghe xong mà thấy tương lai này quen, thì có lẽ vì nó đã bắt đầu từ lâu rồi.`,
    },
    {
      role: "host",
      name: "Minh Anh",
      text: `[gentle signoff] Cảm ơn Quang Dũng. Và cảm ơn bạn đã ngồi lại với tụi tôi lâu như thế. Nếu có một điều còn đọng lại sau cuộc trò chuyện này, tôi mong đó không phải là danh sách các công nghệ của năm hai nghìn không trăm bốn mươi lăm. Tôi mong đó là câu hỏi rất bình thường thôi: trong một xã hội ngày càng tiện, ngày càng nhanh, ngày càng biết cách nói trơn tru, mình còn muốn giữ lại điều gì cho chậm, cho thật, cho người. Hẹn gặp lại bạn ở tập sau.`,
    },
  ];

  return makeDialogueEpisode({
    id: "podcast-longform-2045-mot-tuong-lai-rat-quen",
    kind: "podcast",
    title: "Longform: 2045, một tương lai rất quen",
    summary: "Một cuộc trò chuyện dài, tự nhiên giữa Minh Anh và Quang Dũng về cảm giác sống ở Việt Nam năm 2045: từ tiền nhà, gia đình, AI và lòng tin đến câu hỏi ai được bước vào tương lai trước.",
    posterSlug: "100-nam-quoc-khanh-khat-vong-viet-nam-cong-bo",
    articleSlugs: [
      "100-nam-quoc-khanh-khat-vong-viet-nam-cong-bo",
      "tuyen-phong-thu-ven-bien-le-ky-niem-100-nam",
      "duong-sat-bac-nam-doan-vinh-dong-ha-lui-tien-do-2052",
      "boc-tham-vinhomes-can-gio-floating-city",
      "kinh-doanh-vang-sjc-1-8-ty-xep-hang-ha-noi",
      "goc-nhin-con-bot-cua-toi-noi-chuyen-voi-con-bot-cua-me",
      "cau-be-thu-vien-lang-thu-khoa-olympic-ai-quoc-gia",
      "boc-tran-hoi-tu-thien-tam-lanh-ai-deepfake-23-ty",
      "ai-thay-cung-ai-tu-vi-lua-dao-ponzi-47-ty",
      "doi-tuyen-vong-loai-world-cup-2046-philippines",
      "the-gioi-manila-xuat-khau-lao-dong-dot-7",
      "vinair-evtol-tp-hcm-vung-tau-mo-tuyen",
      "ha-noi-han-che-xe-may-vanh-dai-3-2050",
      "hoa-hau-quoc-te-2045-thi-sinh-viet-nam-tranh-cai-ai",
      "scandal-ngoi-sao-deepfake-do-uong-co-con-xin-loi",
      "v-league-hagl-thua-vff-ai-var-tranh-cai",
      "10-nam-sau-dai-hong-thuy-chung-ta-da-hoc-duoc-gi",
    ],
    publishedAt: "2045-05-01T06:00:00+07:00",
    turns,
  });
}

function buildPodcastDefs(articleMap) {
  const pick = (slug) => articleMap.get(slug);
  const short = (slug) => truncateText(articleLine(pick(slug)), 210);
  return [
    makeLongform2045Episode(articleMap),
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
