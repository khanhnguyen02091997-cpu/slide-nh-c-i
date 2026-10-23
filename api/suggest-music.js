// AI music suggestions. Signed-in users only, with a daily limit per user.
// Provider order: Claude (ANTHROPIC_API_KEY), ChatGPT (OPENAI_API_KEY), Gemini (GEMINI_API_KEY, has a free tier).

const STYLE_NAME = {
  lux: "sang trọng, vàng champagne",
  korea: "Hàn Quốc, trắng kem, nhẹ nhàng",
  cinema: "cinematic, tối, điện ảnh",
  modern: "hiện đại, chuyển cảnh nhanh",
  vintage: "vintage, hoài cổ",
  floral: "hoa pastel, lãng mạn",
  red: "truyền thống, đỏ vàng, lễ gia tiên",
  mono: "tối giản, đen trắng",
  garden: "sân vườn, xanh lá, tự nhiên",
  editorial: "thư tình, kem thanh lịch, nhẹ nhàng sâu lắng",
};
const MODE_NAME = {
  party: "chiếu ảnh liên tục ở tiệc cưới",
  stage: "màn hình sân khấu lúc làm lễ",
  video: "video ảnh cưới có nhạc",
  deliver: "bộ slide giao cho cô dâu chú rể",
};

export async function supabaseUser(token) {
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  return r.ok ? r.json() : null;
}

export async function bumpUsage(token) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/bump_ai_usage`, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!r.ok) throw new Error("usage_failed");
  return r.json();
}

// Pro (activation code) or free. Before the plan functions exist in Supabase everyone counts as Pro.
export async function planOf(token) {
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/my_plan`, {
      method: "POST",
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
    });
    return r.ok ? await r.json() : { pro: true };
  } catch { return { pro: true }; }
}

// Daily AI requests: AI_DAILY_LIMIT for Pro, AI_FREE_LIMIT for the free plan.
export async function dailyLimit(token) {
  const plan = await planOf(token);
  return plan && plan.pro ? Number(process.env.AI_DAILY_LIMIT || 30) : Number(process.env.AI_FREE_LIMIT || 3);
}

async function askClaude(prompt) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error("ai_failed " + r.status);
  const data = await r.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

async function askOpenAI(prompt) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error("ai_failed " + r.status);
  const data = await r.json();
  return data.choices?.[0]?.message?.content || "";
}

async function askGemini(prompt) {
  // Try a few model names: Google renames them often, and free-tier quotas differ per model.
  const models = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-3.8-flash", "gemini-flash-lite-latest", "gemini-3.8-flash-lite"].filter(Boolean);
  const key = process.env.GEMINI_API_KEY.trim();
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  });
  const errors = [];
  const tried = new Set();
  let busy = 0;
  while (models.length && tried.size < 7) {
    const model = models.shift();
    if (tried.has(model)) continue;
    tried.add(model);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    let r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
    if (r.status === 503) {
      // Overload spikes are usually brief: wait a moment and retry the same model once.
      await new Promise((ok) => setTimeout(ok, 1200));
      r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
    }
    if (r.ok) {
      const data = await r.json();
      return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    }
    const err = await r.json().catch(() => ({}));
    const msg = err.error?.message || "";
    errors.push(`${model} ${r.status} ${msg.slice(0, 120)}`);
    if (r.status === 503 || r.status === 429) busy++;
    console.error("gemini", model, r.status, msg);
    // A retired model's 404 names its replacement ("use models/gemini-x-flash"): try that next.
    const hint = msg.match(/models\/(gemini-[\w.-]+)/g);
    if (hint) models.unshift(...hint.map((h) => h.slice(7)).filter((m) => !tried.has(m)));
    if (r.status !== 404 && r.status !== 429 && r.status !== 503) break;
  }
  const e = new Error("gemini: " + errors.join(" | "));
  e.busy = busy > 0 && busy === errors.filter((x) => !/ 404 /.test(x)).length;
  throw e;
}

const hasAI = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
function ask(prompt) {
  if (process.env.ANTHROPIC_API_KEY) return askClaude(prompt);
  if (process.env.OPENAI_API_KEY) return askOpenAI(prompt);
  return askGemini(prompt);
}

function parseList(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
  let list = JSON.parse(body || text);
  if (!Array.isArray(list)) list = Object.values(list || {}).find(Array.isArray) || [];
  return list
    .filter((s) => s && s.title)
    .slice(0, 10)
    .map((s) => ({
      title: String(s.title).slice(0, 120),
      artist: String(s.artist || "").slice(0, 120),
      why: String(s.why || "").slice(0, 300),
      moment: String(s.moment || "").slice(0, 60),
    }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!hasAI())
    return res.status(503).json({ error: "ai_not_configured" });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !(await supabaseUser(token))) return res.status(401).json({ error: "signed_out" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const query = String(body.query || "").trim().slice(0, 300);
  if (!query) return res.status(400).json({ error: "empty" });

  const limit = await dailyLimit(token);
  let used;
  try {
    used = await bumpUsage(token);
  } catch {
    return res.status(500).json({ error: "usage_failed", detail: "Supabase bump_ai_usage" });
  }
  if (used > limit) return res.status(429).json({ error: "limit", limit });

  const prompt = `Bạn là người chọn nhạc cho đám cưới ở Việt Nam.
Yêu cầu của người dùng: "${query.replace(/"/g, "'")}"
Bối cảnh: slide ảnh cưới dùng để ${MODE_NAME[body.mode] || MODE_NAME.party}, phong cách ${STYLE_NAME[body.style] || STYLE_NAME.lux}, khoảng ${Number(body.photos) || 0} ảnh.
Gợi ý 8 bài hát CÓ THẬT, nổi tiếng, dễ tìm trên YouTube. Không bịa tên bài. Nếu không chắc ca sĩ thì ghi ca sĩ nổi tiếng nhất đã hát bài đó.
Chỉ trả về một mảng JSON, mỗi phần tử: {"title": tên bài, "artist": ca sĩ, "why": một câu tiếng Việt vì sao hợp, "moment": lúc nên dùng, vài chữ tiếng Việt}.`;

  try {
    const text = await ask(prompt);
    return res.status(200).json({ songs: parseList(text), used, limit });
  } catch (e) {
    console.error(e);
    if (e.busy) return res.status(503).json({ error: "ai_busy" });
    return res.status(502).json({ error: "ai_failed", detail: String(e.message || e).slice(0, 600) });
  }
}
