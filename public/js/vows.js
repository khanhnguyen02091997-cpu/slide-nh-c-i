/* ===== Vow cards: a cover with both names, then one card per vow, printed as a PDF ===== */
(function (G) {
"use strict";
const PB = G.PhotoBook, F = PB.F;

const TPL = {
  classic: { name: "Cổ điển", desc: "Viền đôi mảnh, chữ giữa" },
  arch: { name: "Khung vòm", desc: "Viền vòm cong phía trên" },
  floral: { name: "Cành lá", desc: "Cành lá ở hai góc" },
  minimal: { name: "Tối giản", desc: "Không viền, chữ canh trái" },
};
// Body fonts for the vow text: [canvas font, line height]
const FONTS = {
  corm: ["Cormorant Garamond", `italic 500 {s}px "Cormorant Garamond",Georgia,serif`, 1.32],
  play: ["Playfair Display", `italic 400 {s}px "Playfair Display",Georgia,serif`, 1.5],
  sans: ["Be Vietnam Pro", `300 {s}px "Be Vietnam Pro",system-ui,sans-serif`, 1.6],
  dancing: ["Dancing Script", `600 {s}px "Dancing Script",cursive`, 1.3],
  charm: ["Charm", `700 {s}px "Charm",cursive`, 1.4],
  patrick: ["Patrick Hand", `400 {s}px "Patrick Hand",cursive`, 1.35],
};
const SAMPLE = {
  groom: "Anh hứa sẽ yêu thương em trong những ngày nắng đẹp lẫn khi giông bão. Anh hứa lắng nghe em, tôn trọng em và cùng em xây một mái ấm bình yên. Từ hôm nay, mọi con đường anh đi đều có em bên cạnh.",
  bride: "Em hứa sẽ là bạn đồng hành, là người tin anh nhất. Em hứa cùng anh vượt qua mọi khó khăn và trân trọng từng ngày bình thường bên nhau. Em chọn anh, hôm nay và mãi mãi.",
};
const LABEL = { groom: "Lời thề của chú rể", bride: "Lời thề của cô dâu" };

const font = (t, s) => t.replace("{s}", Math.round(s));
function spaced(ctx, str, x, y, sp, align = "center") {
  const chars = [...str], ws = chars.map((c) => ctx.measureText(c).width), tw = ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
  let px = align === "center" ? x - tw / 2 : align === "right" ? x - tw : x;
  const a = ctx.textAlign; ctx.textAlign = "left";
  chars.forEach((c, i) => { ctx.fillText(c, px, y); px += ws[i] + sp; });
  ctx.textAlign = a; return tw;
}
// Script font for names and the title: the picked couple-name font, or Great Vibes.
const nameFont = (d, s) => { const n = d.nameF || ["Great Vibes", 1.4, 400]; return { f: `${n[2] || 400} ${Math.round(s * n[1] / 1.4)}px "${n[0]}",cursive`, k: n[1] / 1.4 }; };
function fitName(ctx, d, s, str, maxW) { let f = nameFont(d, s); ctx.font = f.f; const w = ctx.measureText(str).width; if (w > maxW) { s *= maxW / w; f = nameFont(d, s); ctx.font = f.f; } return s; }
function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of text.split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean); let line = "";
    if (!words.length) { out.push(""); continue; }
    for (const w of words) { const t = line ? line + " " + w : w; if (line && ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t; }
    out.push(line);
  }
  return out;
}
// Largest body size whose wrapped lines fit the box.
function fitBody(ctx, fd, text, w, h, s0) {
  let s = s0, lines;
  for (let k = 0; k < 40; k++) { ctx.font = font(fd[1], s); lines = wrap(ctx, text, w); if (lines.length * s * fd[2] <= h || s < s0 * .3) break; s *= .94; }
  return { s, lines };
}
function ornament(ctx, cx, y, w, col) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1, w * .012);
  ctx.beginPath(); ctx.moveTo(cx - w / 2, y); ctx.lineTo(cx - w * .08, y); ctx.moveTo(cx + w * .08, y); ctx.lineTo(cx + w / 2, y); ctx.stroke();
  const r = w * .035; ctx.beginPath(); ctx.moveTo(cx, y - r); ctx.lineTo(cx + r, y); ctx.lineTo(cx, y + r); ctx.lineTo(cx - r, y); ctx.closePath(); ctx.fill();
}
function sprig(ctx, x, y, len, ang, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1, len * .012);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * .5, -len * .12, len, 0); ctx.stroke();
  for (let i = 1; i <= 6; i++) {
    const t = i / 7, px = len * t, py = -len * .12 * 4 * t * (1 - t) * .5, r = len * .07 * (1 - t * .45);
    for (const sd of [-1, 1]) { ctx.save(); ctx.translate(px, py); ctx.rotate(sd * .7 - .2); ctx.beginPath(); ctx.ellipse(r, 0, r, r * .4, 0, 0, 7); ctx.globalAlpha = .75; ctx.fill(); ctx.restore(); }
  }
  ctx.restore();
}
function frame(ctx, tpl, W, H, c) {
  const u = Math.min(W, H), m = u * .045, lw = Math.max(1, u * .0025);
  ctx.strokeStyle = c.acc; ctx.lineWidth = lw;
  if (tpl === "classic") {
    ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
    const g = u * .018; ctx.lineWidth = lw * .6; ctx.strokeRect(m + g, m + g, W - 2 * (m + g), H - 2 * (m + g));
  } else if (tpl === "arch") {
    for (const [g, k] of [[0, 1], [u * .018, .6]]) {
      const x = m + g, w = W - 2 * x, r = w / 2, top = m + g + r, bot = H - m - g;
      ctx.lineWidth = lw * k; ctx.beginPath(); ctx.moveTo(x, bot); ctx.lineTo(x, top); ctx.arc(W / 2, top, r, Math.PI, 0); ctx.lineTo(x + w, bot); ctx.closePath(); ctx.stroke();
    }
  } else if (tpl === "floral") {
    sprig(ctx, m * .6, m * .6, u * .25, .45, c.acc); sprig(ctx, m * .6, m * .6, u * .17, 1.2, c.soft);
    sprig(ctx, W - m * .6, H - m * .6, u * .25, .45 + Math.PI, c.acc); sprig(ctx, W - m * .6, H - m * .6, u * .17, 1.2 + Math.PI, c.soft);
  }
}

/* card: "cover" | "groom" | "bride"; d: { tpl, style, title, vows: {groom, bride}, font, nameF, groom, bride, date, mark } */
function render(ctx, { W, H }, card, d) {
  const c = PB.STY[d.style] || PB.STY.lux, tpl = TPL[d.tpl] ? d.tpl : "classic", u = Math.min(W, H), cx = W / 2, left = tpl === "minimal";
  ctx.save(); ctx.textBaseline = "alphabetic";
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
  frame(ctx, tpl, W, H, c);
  const pad = tpl === "arch" ? u * .15 : tpl === "minimal" ? u * .1 : u * .13, x0 = pad, w = W - 2 * pad, title = (d.title || "Our Vows").trim();
  const tx = left ? x0 : cx; ctx.textAlign = left ? "left" : "center";
  if (card === "cover") {
    const g = d.groom || "Chú rể", b = d.bride || "Cô dâu";
    const top = H * (tpl === "arch" ? .3 : .24);
    ctx.fillStyle = c.soft; ctx.font = font(`400 {s}px ${F.sans}`, u * .026); spaced(ctx, title.toUpperCase(), tx, top, u * .012, left ? "left" : "center");
    const s = fitName(ctx, d, Math.min(u * .16, H * .11), g.length > b.length ? g : b, w); ctx.fillStyle = c.ink;
    const lh = s * 1.3, y1 = H * .44;
    ctx.font = nameFont(d, s).f; ctx.fillText(g, tx, y1);
    ctx.fillStyle = c.acc; ctx.font = font(`italic 400 {s}px ${F.corm}`, s * .55); ctx.fillText("&", tx, y1 + lh * .55);
    ctx.fillStyle = c.ink; ctx.font = nameFont(d, s).f; ctx.fillText(b, tx, y1 + lh * 1.3);
    const oy = y1 + lh * 1.3 + s * .5;
    if (left) { ctx.strokeStyle = c.acc; ctx.lineWidth = Math.max(1, u * .003); ctx.beginPath(); ctx.moveTo(x0, oy); ctx.lineTo(x0 + w * .3, oy); ctx.stroke(); }
    else ornament(ctx, cx, oy, u * .34, c.acc);
    if (d.date) { ctx.fillStyle = c.soft; ctx.font = font(`400 {s}px ${F.sans}`, u * .028); spaced(ctx, d.date, tx, oy + u * .075, u * .01, left ? "left" : "center"); }
  } else {
    const who = card === "groom" ? d.groom || "Chú rể" : d.bride || "Cô dâu", text = ((d.vows && d.vows[card]) || SAMPLE[card]).normalize("NFC");
    const top = tpl === "arch" ? H * .17 + u * .05 : tpl === "minimal" ? H * .12 : tpl === "floral" ? Math.max(H * .13, u * .17) : H * .13;
    ctx.fillStyle = c.soft; ctx.font = font(`400 {s}px ${F.sans}`, u * .022); spaced(ctx, LABEL[card].toUpperCase(), tx, top, u * .01, left ? "left" : "center");
    const ts = fitName(ctx, d, u * .1, title, w); ctx.fillStyle = c.acc; ctx.fillText(title, tx, top + ts * 1.05);
    let y = top + ts * 1.05 + u * .045;
    if (left) { ctx.strokeStyle = c.acc; ctx.lineWidth = Math.max(1, u * .003); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w * .3, y); ctx.stroke(); }
    else ornament(ctx, cx, y, u * .3, c.acc);
    y += u * .06;
    const ns = Math.min(u * .085, H * .06), bottom = H - pad * (tpl === "minimal" ? .9 : .75) - ns * 1.6 - (d.date ? u * .04 : 0);
    const fd = FONTS[d.font] || FONTS.corm, fb = fitBody(ctx, fd, text, w, bottom - y, u * .058), lh = fb.s * fd[2];
    ctx.fillStyle = c.ink; ctx.font = font(fd[1], fb.s);
    const y0 = y + Math.max(0, (bottom - y - fb.lines.length * lh) / 2) + fb.s;
    fb.lines.forEach((ln, i) => ctx.fillText(ln, tx, y0 + i * lh));
    const sy = bottom + ns * 1.35;
    const nx = left ? x0 + w : tx; ctx.textAlign = left ? "right" : "center";
    fitName(ctx, d, ns, who, w); ctx.fillStyle = c.ink; ctx.fillText(who, nx, sy);
    if (d.date) { ctx.fillStyle = c.soft; ctx.font = font(`400 {s}px ${F.sans}`, u * .022); spaced(ctx, d.date, nx, sy + u * .05, u * .008, left ? "right" : "center"); }
  }
  if (d.mark) { ctx.globalAlpha = .55; ctx.fillStyle = c.soft; ctx.textAlign = "center"; ctx.font = font(`400 {s}px ${F.sans}`, u * .018); ctx.fillText(d.mark, cx, H - u * .018); }
  ctx.restore();
}

async function pdf(cards, d, { wCm, hCm, px = 2000, onPage }) {
  const pxW = Math.round(wCm >= hCm ? px : px * wCm / hCm), pxH = Math.round(hCm >= wCm ? px : px * hCm / wCm);
  const cv = document.createElement("canvas"); cv.width = pxW; cv.height = pxH;
  return PB.imgPdf(cards.length, (i) => { render(cv.getContext("2d"), { W: pxW, H: pxH }, cards[i], d); return { cv, wCm, hCm }; }, onPage);
}

G.Vows = { render, pdf, TPL, FONTS, SAMPLE, LABEL };
})(window);
