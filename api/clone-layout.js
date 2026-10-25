// Copy a layout from a sample album page: a Gemini vision model finds the photo frames and the text block.
// Signed-in users only; shares the daily AI limit with the music finder.
import { supabaseUser, bumpUsage, dailyLimit } from "./suggest-music.js";

const PROMPT = `This image is a sample page (or a two-page spread) from a printed wedding photo album design.
Find every photo frame: each rectangular area that holds a photograph. Ignore text, ornaments, borders and background textures.
Also find the main text block (title or caption area), if there is one.
Coordinates are fractions of the image: x and y from the top-left corner, w and h as width and height, all between 0 and 1.
Set "spread" to true only if the image clearly shows two facing pages side by side (a fold in the middle).
List photos in reading order: top to bottom, then left to right. At most 12 photos.
Return only JSON: {"spread": boolean, "photos": [[x, y, w, h], ...], "text": [x, y, w, h] or null}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key) return res.status(503).json({ error: "ai_not_configured" });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !(await supabaseUser(token))) return res.status(401).json({ error: "signed_out" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const image = String(body.image || "").replace(/^data:image\/\w+;base64,/, "");
  if (!image || image.length > 4_000_000) return res.status(400).json({ error: "bad_image" });

  const limit = await dailyLimit(token);
  let used;
  try { used = await bumpUsage(token); } catch { return res.status(500).json({ error: "usage_failed" }); }
  if (used > limit) return res.status(429).json({ error: "limit", limit });

  // Google renames models often: try a few, and follow the replacement a retired model's 404 names.
  const models = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-3.8-flash", "gemini-flash-lite-latest"].filter(Boolean);
  const tried = new Set(), errors = [];
  let busy = 0;
  while (models.length && tried.size < 6) {
    const model = models.shift();
    if (tried.has(model)) continue;
    tried.add(model);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: "image/jpeg", data: image } }, { text: PROMPT }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      }),
    });
    if (r.ok) {
      const data = await r.json();
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
      try {
        const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        return res.status(200).json({ spread: !!j.spread, photos: Array.isArray(j.photos) ? j.photos.slice(0, 12) : [], text: Array.isArray(j.text) ? j.text : null, used, limit });
      } catch {
        errors.push(`${model} bad_json`);
        continue;
      }
    }
    const err = await r.json().catch(() => ({}));
    const msg = err.error?.message || "";
    errors.push(`${model} ${r.status} ${msg.slice(0, 120)}`);
    console.error("clone-layout", model, r.status, msg);
    if (r.status === 503 || r.status === 429) busy++;
    const hint = msg.match(/models\/(gemini-[\w.-]+)/g);
    if (hint) models.unshift(...hint.map((h) => h.slice(7)).filter((m) => !tried.has(m)));
    if (r.status !== 404 && r.status !== 429 && r.status !== 503) break;
  }
  if (busy && busy === errors.filter((x) => !/ 404 /.test(x)).length) return res.status(503).json({ error: "ai_busy" });
  return res.status(502).json({ error: "ai_failed", detail: errors.join(" | ").slice(0, 600) });
}
