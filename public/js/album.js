/* ===== Photo book: lays photos out on square or 20 x 30 pages and exports a print PDF ===== */
(function (G) {
"use strict";
const F = { play: '"Playfair Display",Georgia,serif', corm: '"Cormorant Garamond",Georgia,serif', sans: '"Be Vietnam Pro",system-ui,sans-serif', mont: 'Montserrat,"Be Vietnam Pro",system-ui,sans-serif' };

const STY = {
  lux:    { bg: "#f7f0e2", ink: "#3a2a14", soft: "#8a6f45", acc: "#b8904a", title: `italic 500 {s}px ${F.play}`, body: `300 {s}px ${F.sans}`, line: true },
  korea:  { bg: "#fbf8f3", ink: "#6d5b48", soft: "#a08b74", acc: "#c9b49c", title: `italic 500 {s}px ${F.corm}`, body: `300 {s}px ${F.sans}`, mat: true },
  cinema: { bg: "#0e0e0f", ink: "#ece6da", soft: "#9a9286", acc: "#d9853b", title: `italic 500 {s}px ${F.corm}`, body: `300 {s}px ${F.sans}` },
  vintage: { bg: "#efe3cc", ink: "#4a3622", soft: "#8a7356", acc: "#a08560", title: `italic 500 {s}px ${F.corm}`, body: `400 {s}px ${F.sans}`, mat: true },
  floral: { bg: "#fbefef", ink: "#8f4352", soft: "#b07a83", acc: "#e7a3ae", title: `italic 500 {s}px ${F.play}`, body: `300 {s}px ${F.sans}`, mat: true },
  red: { bg: "#8e1116", ink: "#f3d48c", soft: "#e3b86a", acc: "#e8be6e", title: `italic 500 {s}px ${F.play}`, body: `300 {s}px ${F.sans}`, line: true },
  mono: { bg: "#f7f6f3", ink: "#111111", soft: "#777777", acc: "#111111", title: `500 {s}px ${F.play}`, body: `300 {s}px ${F.sans}` },
  garden: { bg: "#e8eee2", ink: "#2f4229", soft: "#6f8466", acc: "#7d9471", title: `italic 500 {s}px ${F.corm}`, body: `300 {s}px ${F.sans}`, mat: true },
  editorial: { bg: "#f6f2e4", ink: "#4a3a2c", soft: "#8b7560", acc: "#b08d57", title: `400 {s}px "Great Vibes",cursive`, body: `300 {s}px ${F.sans}`, mat: true },
  modern: { bg: "#f4f1ea", ink: "#121214", soft: "#6b6660", acc: "#ff5470", title: `800 {s}px ${F.mont}`, body: `400 {s}px ${F.sans}`, upper: true, bar: true },
};
const font = (t, s) => t.replace("{s}", Math.round(s));

/* Cell templates inside the page's inner box, as [x, y, w, h] fractions. */
const T = {
  1: [[[0, 0, 1, 1]]],
  2: [[[0, 0, .5, 1], [.5, 0, .5, 1]], [[0, 0, 1, .5], [0, .5, 1, .5]], [[0, 0, .62, 1], [.62, .25, .38, .5]], [[0, 0, .78, .5], [.22, .5, .78, .5]]],
  3: [[[0, 0, .6, 1], [.6, 0, .4, .5], [.6, .5, .4, .5]], [[0, 0, 1, .56], [0, .56, .5, .44], [.5, .56, .5, .44]],
      [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]], [[0, 0, .4, .5], [0, .5, .4, .5], [.4, 0, .6, 1]]],
  4: [[[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]], [[0, 0, .62, 1], [.62, 0, .38, 1 / 3], [.62, 1 / 3, .38, 1 / 3], [.62, 2 / 3, .38, 1 / 3]],
      [[0, 0, 1, .5], [0, .5, 1 / 3, .5], [1 / 3, .5, 1 / 3, .5], [2 / 3, .5, 1 / 3, .5]]],
};
const M = .075, GUT = .022, CAP = .06; // margin, gutter, room for the page footer (fractions of the page's short side)
const perms = (a) => a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
// Inner box in short-side units for a page of aspect A (width / height).
const inner = (A = 1) => { const W = Math.max(A, 1), H = Math.max(1 / A, 1); return { x: M, y: M, w: W - 2 * M, h: H - 2 * M - CAP, W, H }; };

function best(ars, A) {
  const k = ars.length, box = inner(A);
  if (k === 1) return { cost: .24, cells: T[1][0], order: [0] };
  let top = null;
  for (const cells of T[k]) for (const ord of perms([...Array(k).keys()])) {
    let cost = 0;
    cells.forEach((c, j) => { const car = (c[2] * box.w - GUT) / (c[3] * box.h - GUT); cost += Math.abs(Math.log(car / ars[ord[j]])); });
    cost /= k;
    if (!top || cost < top.cost) top = { cost, cells, order: ord };
  }
  return top;
}

/* Group photos (kept in order) into pages, varying 1-4 photos per page. */
function layout(ars, seed = 0, A = 1) {
  const pages = [{ type: "cover", photo: 0 }], rhythm = [2, 3, 1, 4, 2, 3, 4, 1, 3, 2];
  let i = ars.length > 1 ? 1 : 0, r = seed % rhythm.length;
  while (i < ars.length) {
    const left = ars.length - i, want = rhythm[r++ % rhythm.length];
    let pick = null;
    for (let k = 1; k <= Math.min(4, left); k++) {
      if (left - k === 1 && k > 1 && left > 2) continue; // avoid leaving one lonely photo when we can help it
      const b = best(ars.slice(i, i + k), A), score = b.cost + .14 * Math.abs(k - want);
      if (!pick || score < pick.score) pick = { k, b, score };
    }
    pages.push({ type: "photos", items: pick.b.order.map((o, j) => ({ photo: i + o, cell: pick.b.cells[j] })) });
    i += pick.k;
  }
  pages.push({ type: "end" });
  return pages;
}

function coverImg(ctx, src, x, y, w, h) {
  const s = Math.max(w / src.width, h / src.height), dw = src.width * s, dh = src.height * s;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); const fx = src.fx == null ? .5 : src.fx, fy = src.fy == null ? .5 : src.fy;
  ctx.drawImage(src, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh); ctx.restore();
}
function containRect(ar, x, y, w, h) { let fw = w, fh = w / ar; if (fh > h) { fh = h; fw = h * ar; } return { x: x + (w - fw) / 2, y: y + (h - fh) / 2, w: fw, h: fh }; }
function framed(ctx, st, S, src, x, y, w, h, contain) {
  const r = contain ? containRect(src.width / src.height, x, y, w, h) : { x, y, w, h };
  if (st.mat) { ctx.save(); ctx.shadowColor = "rgba(80,60,40,.18)"; ctx.shadowBlur = S * .012; ctx.shadowOffsetY = S * .004; ctx.fillStyle = "#fff"; const p = S * .008; ctx.fillRect(r.x - p, r.y - p, r.w + 2 * p, r.h + 2 * p); ctx.restore(); }
  coverImg(ctx, src, r.x, r.y, r.w, r.h);
  if (st.line) { ctx.strokeStyle = st.acc; ctx.lineWidth = Math.max(1, S * .0012); ctx.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1); }
}
function text(ctx, st, s, f, size, x, y, color, align = "center") {
  ctx.font = font(f, size); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "alphabetic";
  ctx.fillText(st.upper && f === st.title ? s.toUpperCase() : s, x, y);
}

/* Draw page n onto a context: dims is the side of a square page, or {W, H} in pixels. */
function render(ctx, dims, pages, n, photos, style, info, mark) {
  if (G.SlideEngine) G.SlideEngine.names(ctx, info);
  const W = typeof dims === "number" ? dims : dims.W, H = typeof dims === "number" ? dims : dims.H, S = Math.min(W, H), cx = W / 2;
  const st = STY[style] || STY.lux, pg = pages[n];
  ctx.save(); ctx.fillStyle = st.bg; ctx.fillRect(0, 0, W, H);
  if (st.line) { ctx.strokeStyle = st.acc; ctx.lineWidth = Math.max(1, S * .0015); const p = S * .03; ctx.strokeRect(p, p, W - 2 * p, H - 2 * p); }
  if (st.bar && pg.type !== "photos") { ctx.fillStyle = st.acc; ctx.fillRect(S * M, S * .06, S * .08, S * .012); }
  const names = info.names || "", date = info.date || "", foot = H - S * M * .6;
  if (pg.type === "cover") {
    const src = photos[pg.photo] && photos[pg.photo].c;
    if (src) framed(ctx, st, S, src, W * .14, H * .12, W * .72, H * .56, false);
    text(ctx, st, names, st.title, S * (st.upper ? .052 : .068), cx, H * .8, st.ink);
    if (date) text(ctx, st, date, st.body, S * .026, cx, H * .86, st.soft);
    if (st.line) { ctx.fillStyle = st.acc; ctx.fillRect(cx - S * .04, H * .885, S * .08, Math.max(1, S * .0015)); }
  } else if (pg.type === "end") {
    text(ctx, st, "Cảm ơn", st.title, S * (st.upper ? .07 : .09), cx, H * .46, st.ink);
    const msg = info.msg || "Cảm ơn quý khách đã đến chung vui cùng gia đình chúng tôi";
    ctx.font = font(st.body, S * .026); const words = msg.split(" "), lines = []; let l = "";
    for (const w of words) { const t = l ? l + " " + w : w; if (ctx.measureText(t).width > W * .6 && l) { lines.push(l); l = w; } else l = t; }
    if (l) lines.push(l);
    lines.forEach((ln, j) => text(ctx, st, ln, st.body, S * .026, cx, H * .54 + j * S * .04, st.soft));
    text(ctx, st, names + (date ? " · " + date : ""), st.body, S * .022, cx, H * .86, st.soft);
  } else {
    const b = inner(W / H), solo = pg.items.length === 1;
    for (const it of pg.items) {
      const src = photos[it.photo] && photos[it.photo].c; if (!src) continue;
      const c = it.cell, x = (b.x + c[0] * b.w) * S + GUT * S / 2, y = (b.y + c[1] * b.h) * S + GUT * S / 2;
      framed(ctx, st, S, src, x, y, c[2] * b.w * S - GUT * S, c[3] * b.h * S - GUT * S, solo);
    }
    text(ctx, st, String(n), st.body, S * .018, cx, foot, st.soft);
    if (n === 1 || n % 6 === 0) text(ctx, st, names, st.title, S * .022, S * M + GUT * S / 2, foot, st.soft, "left");
  }
  if (mark) text(ctx, st, mark, st.body, S * .016, W - S * M - GUT * S / 2, foot, st.soft, "right");
  ctx.restore();
}

/* Minimal PDF: one JPEG per page. Pages are sizeCm square, or wCm x hCm; px is the long side. */
async function pdf(pages, photos, style, info, { px = 2400, sizeCm = 30, wCm = sizeCm, hCm = sizeCm, onPage, mark } = {}) {
  const ptW = wCm / 2.54 * 72, ptH = hCm / 2.54 * 72, pxW = Math.round(wCm >= hCm ? px : px * wCm / hCm), pxH = Math.round(hCm >= wCm ? px : px * hCm / wCm), enc = new TextEncoder(), parts = [], offs = [];
  let len = 0; const put = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); body(); put("\nendobj\n"); };
  const cv = document.createElement("canvas"); cv.width = pxW; cv.height = pxH; const ctx = cv.getContext("2d");
  const N = pages.length, kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  put("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, () => put("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => put(`<< /Type /Pages /Kids [${kids}] /Count ${N} >>`));
  for (let i = 0; i < N; i++) {
    render(ctx, { W: pxW, H: pxH }, pages, i, photos, style, info, mark);
    const jpg = new Uint8Array(await (await new Promise((ok) => cv.toBlob(ok, "image/jpeg", .9))).arrayBuffer());
    const p = 3 + i * 3, content = `q ${ptW.toFixed(2)} 0 0 ${ptH.toFixed(2)} 0 0 cm /Im0 Do Q`;
    obj(p, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW.toFixed(2)} ${ptH.toFixed(2)}] /Resources << /XObject << /Im0 ${p + 1} 0 R >> >> /Contents ${p + 2} 0 R >>`));
    obj(p + 1, () => { put(`<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); put(jpg); put("\nendstream"); });
    obj(p + 2, () => put(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    onPage && onPage(i + 1, N);
    await new Promise((ok) => setTimeout(ok, 0));
  }
  const total = 3 + N * 3, xref = len;
  put(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) put(String(offs[n]).padStart(10, "0") + " 00000 n \n");
  put(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: "application/pdf" });
}

/* Capture time from a JPEG's EXIF (DateTimeOriginal, else DateTime). Returns ms or 0. */
async function takenAt(file) {
  try {
    const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (v.getUint16(0) !== 0xFFD8) return 0;
    let o = 2;
    while (o + 4 < v.byteLength) {
      const mk = v.getUint16(o), sz = v.getUint16(o + 2);
      if (mk === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10, le = v.getUint16(t) === 0x4949, u16 = (p) => v.getUint16(t + p, le), u32 = (p) => v.getUint32(t + p, le);
        const tags = (ifd) => { const out = {}, n = u16(ifd); for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; out[u16(e)] = e; } return out; };
        const str = (e) => { const cnt = u32(e + 4), off = cnt > 4 ? u32(e + 8) : e + 8; let s = ""; for (let i = 0; i < cnt - 1; i++) s += String.fromCharCode(v.getUint8(t + off + i)); return s; };
        const ifd0 = tags(u32(4)); let ds = "";
        if (ifd0[0x8769]) { const ex = tags(u32(ifd0[0x8769] + 8)); if (ex[0x9003]) ds = str(ex[0x9003]); }
        if (!ds && ifd0[0x0132]) ds = str(ifd0[0x0132]);
        const m = ds.match(/(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
        return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : 0;
      }
      if ((mk & 0xFF00) !== 0xFF00) break;
      o += 2 + sz;
    }
  } catch {}
  return 0;
}

G.PhotoBook = { layout, render, pdf, takenAt };
})(window);
