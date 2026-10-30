// /t/<slug>: the invitation page with the couple's names and cover photo in the link preview
// (Zalo, Facebook, Messenger read these tags), and the invitation itself filled in, so guests skip a round trip.
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const p2 = (n) => String(n).padStart(2, "0");

export default async function handler(req, res) {
  const slug = String(req.query.s || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
  const host = req.headers["x-forwarded-host"] || req.headers.host, origin = `${req.headers["x-forwarded-proto"] || "https"}://${host}`;
  const fallback = () => { res.setHeader("Location", "/thiep.html?s=" + encodeURIComponent(slug)); res.status(302).end(); };
  let page;
  try { const r = await fetch(origin + "/thiep.html"); if (!r.ok) return fallback(); page = await r.text(); } catch { return fallback(); }

  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  let inv = null;
  if (slug && url && key) {
    try {
      const h = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
      const r = await fetch(url + "/rest/v1/rpc/get_invite", { method: "POST", headers: h, body: JSON.stringify({ p_slug: slug }) });
      inv = r.ok ? await r.json() : null;
      if (inv) {
        const d = inv.data || {}, pics = Array.isArray(d.pics) && d.pics.length ? d.pics : inv.photos.slice(0, 18);
        const want = [...new Set([d.cover || inv.photos[0], ...pics, d.music].filter(Boolean))];
        inv.url = {};
        if (want.length) {
          const s = await fetch(url + "/storage/v1/object/sign/media", { method: "POST", headers: h, body: JSON.stringify({ expiresIn: 7 * 86400, paths: want }) });
          if (s.ok) for (const x of await s.json()) if (x.signedURL) inv.url[x.path] = url + "/storage/v1" + x.signedURL;
        }
      }
    } catch { inv = null; }
  }

  if (inv) {
    const d = inv.data || {}, g = inv.groom || "Chú rể", b = inv.bride || "Cô dâu";
    const [y, m, dd] = String(inv.date || "").split("-");
    const title = `Thiệp cưới ${d.order === "bride" ? b + " & " + g : g + " & " + b}`;
    const desc = (y ? `${p2(dd)}.${p2(m)}.${y} · ` : "") + (d.greet ? d.greet : "Trân trọng kính mời bạn đến chung vui cùng gia đình chúng tôi.");
    const img = inv.url[d.cover || inv.photos[0]];
    const tags = [`<meta property="og:type" content="website">`, `<meta property="og:title" content="${esc(title)}">`, `<meta property="og:description" content="${esc(desc)}">`,
      `<meta property="og:url" content="${esc(origin + "/t/" + slug)}">`, img ? `<meta property="og:image" content="${esc(img)}">` : "", `<meta name="twitter:card" content="summary_large_image">`].join("\n");
    page = page.replace("<title>Thiệp cưới</title>", `<title>${esc(title)}</title>`)
      .replace("<!--og-->", tags + `\n<script>window.__INVITE=${JSON.stringify(inv).replace(/</g, "\\u003c")}</script>`);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.status(200).send(page);
}
