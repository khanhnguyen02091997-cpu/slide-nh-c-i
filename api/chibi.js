// Turn one wedding photo into a chibi illustration with a Gemini image model.
// Signed-in users only; shares the daily AI limit with the music finder.
import { supabaseUser, bumpUsage } from "./suggest-music.js";

const STYLES = {
  anime: "a cute 2D anime chibi illustration with clean lineart and soft pastel colors",
  "3d": "a cute 3D chibi figurine render, soft studio lighting, glossy toy-like materials, Pixar-like",
  water: "a cute chibi watercolor painting with soft brush strokes on textured paper",
};

let cachedModels = null;
async function imageModels(key) {
  if (process.env.GEMINI_IMAGE_MODEL) return [process.env.GEMINI_IMAGE_MODEL];
  if (cachedModels) return cachedModels;
  const found = [];
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(key)}`);
    const j = await r.json();
    for (const m of j.models || []) {
      const name = m.name.replace(/^models\//, "");
      if (/image/.test(name) && !/imagen|embed/.test(name) && (m.supportedGenerationMethods || []).includes("generateContent")) found.push(name);
    }
  } catch {}
  // Prefer flash (cheaper, has had a free allowance), then newest version.
  const ver = (n) => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  found.sort((a, b) => (/flash/.test(b) - /flash/.test(a)) || (/preview/.test(a) - /preview/.test(b)) || ver(b) - ver(a));
  cachedModels = found.length ? found.slice(0, 3) : ["gemini-2.5-flash-image"];
  return cachedModels;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key) return res.status(503).json({ error: "ai_not_configured", detail: "Cần GEMINI_API_KEY để tạo ảnh chibi." });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !(await supabaseUser(token))) return res.status(401).json({ error: "signed_out" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const image = String(body.image || "").replace(/^data:image\/\w+;base64,/, "");
  if (!image || image.length > 4_000_000) return res.status(400).json({ error: "bad_image" });
  const style = STYLES[body.style] || STYLES.anime;

  const limit = Number(process.env.AI_DAILY_LIMIT || 30);
  let used;
  try { used = await bumpUsage(token); } catch { return res.status(500).json({ error: "usage_failed" }); }
  if (used > limit) return res.status(429).json({ error: "limit", limit });

  const prompt = `Redraw this wedding photo as ${style}. Keep the same people, poses and composition: same number of people, recognizable faces, same hairstyles, the same wedding outfits (wedding dress, suit or áo dài) and colors. Chibi proportions: big heads, small bodies about 2.5 heads tall, large sparkling eyes, happy expressions. Background inspired by the original scene, simplified and dreamy, with a few small hearts or flowers. No text, no watermark, no frame.`;

  const errors = [];
  for (const model of await imageModels(key)) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: "image/jpeg", data: image } }, { text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const part = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData || p.inline_data);
      const d = part && (part.inlineData || part.inline_data);
      if (d) return res.status(200).json({ image: `data:${d.mimeType || d.mime_type || "image/png"};base64,${d.data}`, used, limit });
      errors.push(`${model}: không trả về ảnh (${j.candidates?.[0]?.finishReason || "?"})`);
      continue;
    }
    const msg = j.error?.message || "";
    console.error("chibi", model, r.status, msg);
    errors.push(`${model} ${r.status} ${msg.slice(0, 160)}`);
    if (r.status === 429 && /free|limit: 0|billing/i.test(msg)) return res.status(402).json({ error: "need_billing", detail: msg.slice(0, 200) });
    if (r.status === 400 && /safety|blocked/i.test(msg)) break;
  }
  const busy = errors.length && errors.every((e) => / 503 /.test(e));
  return res.status(busy ? 503 : 502).json({ error: busy ? "ai_busy" : "ai_failed", detail: errors.join(" | ").slice(0, 600) });
}
