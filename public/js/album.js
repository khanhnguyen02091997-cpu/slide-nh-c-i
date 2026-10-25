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
const M = .075, GUT = .022, DGUT = GUT, CAP = .06; // margin, gutter, room for the page footer (fractions of the page's short side)
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

/* Group photos (kept in order) into pages, varying 1-4 photos per page, or by a library layout (d.layout) with titles (d.typo). */
function layout(ars, seed = 0, A = 1, d = {}) {
  const lay = LAYOUT[d.layout], typo = TYPO[d.typo] ? d.typo : "none", cover = COVER[d.cover] ? d.cover : "classic";
  const gut = d.gut != null ? d.gut : GUT;
  // "mix" draws from every library layout (or the ones in d.pool); a range d.min..d.max limits photos per page
  const pool = d.layout === "mix" ? (d.pool && d.pool.length ? d.pool : Object.keys(LAYOUT)).filter((k) => LAYOUT[k] && LAYOUT[k].pages) : lay && lay.pages ? [d.layout] : null;
  if (pool) return Object.assign(layoutLib(ars, seed, A, pool, d.min || 1, d.max || 99, d.layout === "mix", d.pages, d.over || {}), { typo, cover, gut, pool });
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
  return Object.assign(pages, { typo, cover, gut });
}


/* ===== Resource library: page layouts, title typography, and designs that combine them with a style ===== */
// A layout is a list of page templates: cells [x, y, w, h, rot] in the inner box (rot in degrees, around the cell's
// center), t = box for the page title. pol = polaroid frames. The library repeats the templates in order.
const g3 = (y0, rows, cols) => { const out = [], h = (1 - y0) / rows; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([c / cols, y0 + r * h, 1 / cols, h]); return out; };
const LAYOUT = {
  auto: { name: "Tự động", desc: "Mỗi trang 1 đến 4 ảnh, app tự chọn khung hợp ảnh" },
  grid: { name: "Lưới 9 ô", desc: "9 ảnh đều nhau, tiêu đề nhỏ phía trên", isNew: true,
    pages: [{ t: [0, 0, 1, .1], cells: g3(.12, 3, 3) }, { t: [0, 0, 1, .1], cells: g3(.12, 2, 3) }, { t: [0, 0, 1, .1], cells: g3(.12, 2, 2) }] },
  strip: { name: "Dải phim", desc: "Tiêu đề lớn, hàng ảnh bên dưới", isNew: true,
    pages: [{ t: [0, 0, 1, .44], cells: [[0, .48, 1 / 3, .52], [1 / 3, .48, 1 / 3, .52], [2 / 3, .48, 1 / 3, .52]] },
      { t: [0, .56, 1, .44], cells: [[0, 0, .5, .52], [.5, 0, .5, .52]] },
      { t: [0, 0, 1, .36], cells: [[0, .4, .25, .6], [.25, .4, .25, .6], [.5, .4, .25, .6], [.75, .4, .25, .6]] }] },
  hero: { name: "Ảnh lớn + chữ", desc: "Một ảnh lớn kiểu tạp chí, chữ và ảnh nhỏ bên cạnh", isNew: true,
    pages: [{ t: [.63, 0, .37, .46], cells: [[0, 0, .6, 1], [.63, .5, .37, .5]] },
      { t: [0, .78, 1, .22], cells: [[0, 0, 1, .76]] },
      { t: [0, 0, .37, .46], cells: [[.4, 0, .6, 1], [0, .5, .37, .5]] }] },
  diag: { name: "Cắt chéo", desc: "Ảnh xếp nghiêng theo đường chéo, chữ to ở góc", isNew: true,
    pages: [{ t: [.42, .7, .58, .3], cells: [[-.06, -.02, .6, .36, -18], [.5, .04, .6, .36, -18], [-.12, .36, .62, .34, -18], [.46, .38, .5, .3, -18]] },
      { t: [0, 0, .44, .3], cells: [[.46, -.04, .62, .36, -18], [-.04, .32, .6, .34, -18], [.52, .36, .56, .34, -18]] }] },
  scatter: { name: "Rải ảnh polaroid", desc: "Ảnh polaroid nghiêng nhẹ, chữ ký to phía trên", isNew: true,
    pages: [{ pol: true, t: [0, 0, 1, .3], cells: [[.02, .34, .3, .3, -6], [.35, .3, .3, .34, 3], [.68, .35, .3, .3, -3], [.1, .66, .36, .33, 4], [.52, .66, .36, .33, -5]] },
      { pol: true, t: [0, .7, 1, .3], cells: [[.04, .04, .44, .6, -4], [.52, .02, .44, .62, 5]] }] },
  mosaic: { name: "Lưới so le", desc: "8 ảnh nhỏ cao thấp xen kẽ", isNew: true,
    pages: [{ t: [0, 0, 1, .08], cells: [[0, .1, 1 / 3, .3], [0, .4, 1 / 3, .3], [0, .7, 1 / 3, .3], [1 / 3, .1, 1 / 3, .22], [1 / 3, .32, 1 / 3, .36], [1 / 3, .68, 1 / 3, .32], [2 / 3, .1, 1 / 3, .45], [2 / 3, .55, 1 / 3, .45]] },
      { t: [0, 0, 1, .08], cells: [[0, .1, 1 / 3, .45], [0, .55, 1 / 3, .45], [1 / 3, .1, 1 / 3, .3], [1 / 3, .4, 1 / 3, .3], [1 / 3, .7, 1 / 3, .3], [2 / 3, .1, 1 / 3, .22], [2 / 3, .32, 1 / 3, .36], [2 / 3, .68, 1 / 3, .32]] },
      { t: [0, 0, 1, .08], cells: [[0, .1, 1 / 3, .55], [0, .65, 1 / 3, .35], [1 / 3, .1, 1 / 3, .35], [1 / 3, .45, 1 / 3, .55], [2 / 3, .1, 1 / 3, .55], [2 / 3, .65, 1 / 3, .35]] },
      { t: [0, 0, 1, .08], cells: [[0, .1, 1 / 3, .25], [0, .35, 1 / 3, .4], [0, .75, 1 / 3, .25], [1 / 3, .1, 1 / 3, .4], [1 / 3, .5, 1 / 3, .25], [1 / 3, .75, 1 / 3, .25], [2 / 3, .1, 1 / 3, .25], [2 / 3, .35, 1 / 3, .25], [2 / 3, .6, 1 / 3, .4]] }] },
  // shape: arch or circle frames; bleed: cells and title box are fractions of the whole page, no margins; onPh: title sits on a photo
  arch: { name: "Khung vòm", desc: "Ảnh trong khung vòm kiểu cửa sổ nhà thờ", isNew: true,
    pages: [{ shape: "arch", t: [0, 0, 1, .26], cells: [[0, .3, 1 / 3, .7], [1 / 3, .3, 1 / 3, .7], [2 / 3, .3, 1 / 3, .7]] },
      { shape: "arch", t: [0, .74, 1, .26], cells: [[.04, 0, .44, .72], [.52, 0, .44, .72]] }] },
  circle: { name: "Khung tròn", desc: "Ảnh tròn lồng nhau, chữ bên dưới", isNew: true,
    pages: [{ shape: "circle", t: [0, .8, 1, .2], cells: [[0, 0, .5, .5], [.5, 0, .5, .5], [.25, .34, .5, .5]] },
      { shape: "circle", t: [0, .74, 1, .26], cells: [[.17, 0, .66, .72]] }] },
  bleed: { name: "Ảnh tràn trang", desc: "Một ảnh phủ kín trang, chữ nằm trên ảnh", isNew: true,
    pages: [{ bleed: true, onPh: true, t: [.08, .6, .84, .3], cells: [[0, 0, 1, 1]] },
      { bleed: true, t: [.1, .73, .8, .22], cells: [[0, 0, 1, .7]] },
      { bleed: true, onPh: true, t: [.04, .62, .92, .3], cells: [[0, 0, .5, 1], [.5, 0, .5, 1]] }] },
  collage: { name: "Ghép 5 ảnh", desc: "Một ảnh lớn, bốn ảnh nhỏ và ô chữ", isNew: true,
    pages: [{ t: [.62, 0, .38, .3], cells: [[0, 0, .6, .62], [.62, .32, .38, .3], [0, .64, .29, .36], [.31, .64, .29, .36], [.62, .64, .38, .36]] },
      { t: [0, 0, .38, .3], cells: [[.4, 0, .6, .62], [0, .32, .38, .3], [0, .64, .38, .36], [.4, .64, .29, .36], [.71, .64, .29, .36]] },
      { t: [0, 0, 1, .12], cells: [[0, .14, .5, .5], [.5, .14, .25, .25], [.75, .14, .25, .25], [.5, .39, .5, .25], [0, .64, .5, .36], [.5, .64, .5, .36]] }] },
};

const SCR = '"Great Vibes",cursive';
// Title typography: phrases rotate page by page; draw(ctx, st, box, phrase, page index, on a photo?).
const TYPO = {
  none: { name: "Không chữ", desc: "Chỉ tên cô dâu chú rể như cũ", phr: [["", ""]] },
  script: { name: "Chữ ký bay bổng", desc: "Sweet Memories, chữ viết tay lớn", isNew: true,
    phr: [["Sweet Memories", "Our wedding day"], ["Love Story", "Two hearts, one love"], ["Forever & Always", "Just married"], ["Happily Ever After", "Since this day"]] },
  serif: { name: "Serif thanh lịch", desc: "Moment IN TIME, nghiêng mảnh và in hoa giãn chữ", isNew: true,
    phr: [["Moment", "in time"], ["Pure", "love"], ["The day", "we said yes"], ["Always", "& forever"]] },
  bold: { name: "In hoa đậm", desc: "The Sacred VOWS, chữ to nổi bật", isNew: true,
    phr: [["The sacred", "Vows"], ["Our", "Love"], ["Just", "Married"], ["Pure", "Joy"]] },
  mag: { name: "Tạp chí", desc: "The Vows, Vol. 01, Chapter one", isNew: true,
    phr: [["The Vows", "Chapter one"], ["Our Day", "Chapter two"], ["Together", "Chapter three"], ["Celebration", "Chapter four"]] },
  love: { name: "Love & Grace", desc: "Chữ ký lồng chữ serif", isNew: true,
    phr: [["Love", "& Grace"], ["Forever", "Yours"], ["Mr & Mrs", "Hello"], ["Sweet", "Moments"]] },
  viet: { name: "Tiếng Việt cổ điển", desc: "Trăm năm hạnh phúc, chữ mềm có dấu", isNew: true,
    phr: [["Trăm năm hạnh phúc", "Ngày chung đôi"], ["Mãi bên nhau", "Trọn đời trọn kiếp"], ["Tình yêu", "Của chúng mình"], ["Về chung một nhà", "Hạnh phúc viên mãn"]] },
  gold: { name: "Chữ ký vàng", desc: "Chữ ký ánh vàng, dòng nhỏ có hoa văn", isNew: true,
    phr: [["Golden Day", "The wedding of"], ["Our Forever", "Begins today"], ["Cherish", "Every moment"], ["Together", "Hand in hand"]] },
  sans: { name: "Tối giản hiện đại", desc: "Chữ in hoa giãn rộng, gọn gàng", isNew: true,
    phr: [["Wedding Day", "Chapter 01"], ["Two of us", "Chapter 02"], ["The Party", "Chapter 03"], ["Always", "Chapter 04"]] },
  hand: { name: "Viết tay", desc: "Nét bút viết tay vui tươi", isNew: true,
    phr: [["Ngày vui của chúng mình", "Thương nhau trọn đời"], ["Yêu thương", "Ngày đầu tiên"], ["Bên nhau", "Hạnh phúc giản đơn"], ["Cảm ơn em", "Đã đến bên anh"]] },
};

// Cover pages.
const COVER = {
  classic: { name: "Cổ điển", desc: "Ảnh có khung, tên bên dưới" },
  bleed: { name: "Ảnh tràn bìa", desc: "Ảnh phủ kín bìa, tên nằm trên ảnh", isNew: true },
  split: { name: "Chia đôi", desc: "Ảnh nửa trang, tên và ngày bên cạnh", isNew: true },
  mono: { name: "Chữ lồng", desc: "Chữ cái đầu hai tên lồng nhau, ảnh tròn nhỏ", isNew: true },
  arch: { name: "Vòm cổ điển", desc: "Ảnh trong khung vòm lớn", isNew: true },
};

// Designs = cover + layout + typography + style, applied in one tap.
const DESIGN = {
  vows: { name: "The Vows", style: "korea", layout: "grid", typo: "mag", cover: "classic", isNew: true },
  moment: { name: "Moment in Time", style: "vintage", layout: "strip", typo: "serif", cover: "split", isNew: true },
  sacred: { name: "The Sacred Vows", style: "mono", layout: "diag", typo: "bold", cover: "bleed", isNew: true },
  sweet: { name: "Sweet Memories", style: "lux", layout: "scatter", typo: "script", cover: "mono", isNew: true },
  grace: { name: "Love & Grace", style: "garden", layout: "hero", typo: "love", cover: "arch", isNew: true },
  chapter: { name: "Chapter One", style: "editorial", layout: "mosaic", typo: "mag", cover: "split", isNew: true },
  vuquy: { name: "Ngày Vu Quy", style: "red", layout: "hero", typo: "script", cover: "mono", isNew: true },
  minimal: { name: "Tối giản", style: "modern", layout: "grid", typo: "bold", cover: "bleed", isNew: true },
  hanhphuc: { name: "Trăm Năm Hạnh Phúc", style: "korea", layout: "arch", typo: "viet", cover: "arch", isNew: true },
  cine: { name: "Cinematic", style: "cinema", layout: "bleed", typo: "sans", cover: "bleed", isNew: true },
  gardenparty: { name: "Garden Party", style: "garden", layout: "circle", typo: "hand", cover: "mono", isNew: true },
  tinhca: { name: "Tình Ca", style: "floral", layout: "collage", typo: "hand", cover: "classic", isNew: true },
  letter: { name: "Vintage Letter", style: "vintage", layout: "mosaic", typo: "serif", cover: "split", isNew: true },
  golden: { name: "Golden Day", style: "lux", layout: "bleed", typo: "gold", cover: "bleed", isNew: true },
  songhy: { name: "Song Hỷ", style: "red", layout: "arch", typo: "viet", cover: "arch", isNew: true },
  editorial2: { name: "Editorial", style: "mono", layout: "collage", typo: "sans", cover: "split", isNew: true },
};

// Default words for a title slot: "cover", "end", or the title's order among photo pages.
function phrase(typo, key) {
  if (key === "end") return ["Cảm ơn", ""];
  const p = (TYPO[typo] || TYPO.none).phr; return p[(key === "cover" ? 0 : +key) % p.length];
}
const FONTS = ['400 40px "Great Vibes"', 'italic 400 40px "Cormorant Garamond"', '500 40px "Playfair Display"', 'italic 500 40px "Playfair Display"', '700 40px Charm', '600 40px "Dancing Script"', '600 40px Montserrat', '300 40px "Be Vietnam Pro"'];
const fonts = () => G.document && document.fonts ? Promise.all(FONTS.map((f) => document.fonts.load(f, "Ắă").catch(() => {}))) : Promise.resolve();

// Biggest font size (up to s) that keeps str within maxW.
function fit(ctx, f, s, str, maxW) { ctx.font = font(f, s); const w = ctx.measureText(str).width; if (w > maxW) { s *= maxW / w; ctx.font = font(f, s); } return s; }
function spaced(ctx, str, x, y, sp, align = "center") {
  const ch = [...str], ws = ch.map((c) => ctx.measureText(c).width), tw = ws.reduce((a, b) => a + b, 0) + sp * (ch.length - 1);
  let cx = align === "center" ? x - tw / 2 : align === "right" ? x - tw : x; ctx.textAlign = "left";
  ch.forEach((c, i) => { ctx.fillText(c, cx, y); cx += ws[i] + sp; });
}
function drawTypo(ctx, st, id, b, ph, n, onPhoto, own) {
  const ty = TYPO[id]; if (!ty || id === "none") return;
  const [a, s2] = own || ty.phr[ph % ty.phr.length], ink = onPhoto ? "#fffaf2" : st.ink, acc = onPhoto ? "#fffaf2" : st.acc, soft = onPhoto ? "rgba(255,250,242,.9)" : st.soft;
  const S = Math.min(b.w, b.h * 2.4), cx = b.x + b.w / 2;
  ctx.save(); ctx.textBaseline = "alphabetic";
  if (onPhoto) { ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = b.h * .06; }
  if (id === "script") {
    const s = fit(ctx, `400 {s}px ${SCR}`, b.h * .62, a, b.w * .94); ctx.fillStyle = ink; ctx.textAlign = "center";
    ctx.fillText(a, cx, b.y + b.h * .5 + s * .28);
    ctx.font = font(`400 {s}px ${F.sans}`, Math.min(b.h * .07, S * .035)); ctx.fillStyle = soft; spaced(ctx, s2.toUpperCase(), cx, b.y + b.h * .5 + s * .28 + b.h * .2, b.h * .022);
  } else if (id === "serif") {
    const s = fit(ctx, `italic 400 {s}px ${F.corm}`, b.h * .56, a, b.w * .8); ctx.fillStyle = ink; ctx.textAlign = "center";
    const y = b.y + b.h * .52; ctx.fillText(a, cx - b.w * .04, y);
    const s3 = fit(ctx, `500 {s}px ${F.play}`, s * .34, s2.toUpperCase(), b.w * .5); ctx.fillStyle = acc;
    spaced(ctx, s2.toUpperCase(), cx + b.w * .1, y + s3 * 1.3, s3 * .35);
  } else if (id === "bold") {
    const big = s2.toUpperCase(), s = fit(ctx, `600 {s}px ${F.play}`, b.h * .7, big, b.w * .92); ctx.fillStyle = ink; ctx.textAlign = "right";
    const r = b.x + b.w * .96, y = b.y + b.h * .9; ctx.fillText(big, r, y);
    ctx.font = font(`500 {s}px ${F.play}`, Math.min(s * .2, b.h * .12)); ctx.fillStyle = soft; spaced(ctx, a.toUpperCase(), r, y - s * .82, s * .04, "right");
  } else if (id === "mag") {
    const s = fit(ctx, `italic 400 {s}px ${F.corm}`, b.h * .72, a, b.w * .5); ctx.fillStyle = ink; ctx.textAlign = "left";
    ctx.fillText(a, b.x, b.y + b.h * .5 + s * .3);
    const vol = (n ? `VOL. ${String(n).padStart(2, "0")}  ·  ` : "") + s2.toUpperCase(), s3 = fit(ctx, `400 {s}px ${F.sans}`, s * .3, vol, b.w * .34); ctx.fillStyle = soft;
    spaced(ctx, vol, b.x + b.w, b.y + b.h * .5 + s * .3, s3 * .2, "right");
    ctx.fillStyle = st.acc; ctx.fillRect(b.x, b.y + b.h * .5 + s * .55, b.w, Math.max(1, s * .02));
  } else if (id === "love") {
    const s = fit(ctx, `400 {s}px ${SCR}`, b.h * .5, a, b.w * .86); ctx.fillStyle = acc; ctx.textAlign = "center";
    const y = b.y + b.h * .46; ctx.fillText(a, cx, y);
    const s3 = fit(ctx, `italic 500 {s}px ${F.play}`, s * .5, s2, b.w * .8); ctx.fillStyle = ink; ctx.fillText(s2, cx + b.w * .08, y + s3 * 1.25);
  } else if (id === "viet") {
    const s = fit(ctx, `700 {s}px Charm,${SCR}`, b.h * .42, a, b.w * .92); ctx.fillStyle = ink; ctx.textAlign = "center";
    const y = b.y + b.h * .5 + s * .2; ctx.fillText(a, cx, y);
    const s3 = fit(ctx, `400 {s}px ${F.sans}`, Math.min(s * .26, b.h * .09), s2.toUpperCase(), b.w * .7); ctx.fillStyle = acc;
    spaced(ctx, s2.toUpperCase(), cx, y + s3 * 2.4, s3 * .3);
    if (s2) { const lw = b.w * .08, gy = y + s3 * 2; ctx.fillRect(cx - b.w * .36 - lw / 2, gy, lw, Math.max(1, s3 * .08)); ctx.fillRect(cx + b.w * .36 - lw / 2, gy, lw, Math.max(1, s3 * .08)); }
  } else if (id === "gold") {
    const s3 = Math.min(b.h * .085, b.w * .03), y0 = b.y + b.h * .26; ctx.font = font(`400 {s}px ${F.sans}`, s3); ctx.fillStyle = soft;
    spaced(ctx, s2.toUpperCase(), cx, y0, s3 * .35);
    const tw = ctx.measureText(s2.toUpperCase()).width + s3 * .35 * s2.length, lw = b.w * .1;
    if (s2) { ctx.fillStyle = acc; ctx.fillRect(cx - tw / 2 - lw - s3, y0 - s3 * .35, lw, Math.max(1, s3 * .07)); ctx.fillRect(cx + tw / 2 + s3, y0 - s3 * .35, lw, Math.max(1, s3 * .07)); }
    const s = fit(ctx, `400 {s}px ${SCR}`, b.h * .55, a, b.w * .92), y = y0 + s * .95, w = ctx.measureText(a).width;
    const gr = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); gr.addColorStop(0, "#a87a2f"); gr.addColorStop(.5, "#f3d48c"); gr.addColorStop(1, "#a87a2f");
    ctx.fillStyle = onPhoto ? "#fff3d6" : gr; ctx.textAlign = "center"; ctx.fillText(a, cx, y);
  } else if (id === "sans") {
    const A = a.toUpperCase(); let s = fit(ctx, `600 {s}px ${F.mont}`, b.h * .26, A, b.w * .8);
    const tw = ctx.measureText(A).width + s * .35 * ([...A].length - 1); if (tw > b.w * .94) { s *= b.w * .94 / tw; ctx.font = font(`600 {s}px ${F.mont}`, s); }
    const y = b.y + b.h * .5; ctx.fillStyle = ink;
    spaced(ctx, A, cx, y, s * .35);
    ctx.fillStyle = acc; ctx.fillRect(cx - b.w * .04, y + s * .5, b.w * .08, Math.max(1, s * .06));
    ctx.font = font(`300 {s}px ${F.sans}`, s * .42); ctx.fillStyle = soft; spaced(ctx, s2.toUpperCase(), cx, y + s * 1.25, s * .2);
  } else if (id === "hand") {
    const s = fit(ctx, `600 {s}px "Dancing Script",${SCR}`, b.h * .42, a, b.w * .92); ctx.fillStyle = acc; ctx.textAlign = "center";
    const y = b.y + b.h * .48 + s * .2; ctx.fillText(a, cx, y);
    const s3 = fit(ctx, `italic 400 {s}px ${F.corm}`, s * .46, s2, b.w * .8); ctx.fillStyle = ink; ctx.fillText(s2, cx, y + s3 * 1.3);
  }
  ctx.restore();
}

/* Pages for library layouts. One layout: its templates in order. Mix (Auto Design): for each page the template whose cells
   best fit the next photos' shapes and the wished photos per page, kept in min..max, rarely the same template twice in a row. */
function layoutLib(ars, seed, A, pool, min, max, mix, target, over) {
  // each template carries an id "layout:index" so a page can be pinned to one (over: first photo of the page -> id)
  const pages = [{ type: "cover", photo: 0 }], tps = pool.flatMap((k) => LAYOUT[k].pages.map((t, n) => Object.assign({ id: k + ":" + n }, t))), box = inner(A);
  const fitCost = (t, at) => { let c = 0; t.cells.forEach((cl, j) => { const car = (cl[2] * box.w) / (cl[3] * box.h); c += Math.abs(Math.log(car / ars[at + j])); }); return c / t.cells.length; };
  const jitter = (a, b) => ((Math.sin((a + 1) * 12.9898 + (b + 1) * 78.233 + seed * 37.719) * 43758.5453) % 1 + 1) % 1;
  let i = ars.length > 1 ? 1 : 0, r = seed, ph = 0, prev = null;
  // photos per page to aim for: from the wished page count, else the middle of the range
  const want = target ? Math.max(1, (ars.length - i) / target) : (min + Math.min(max, 9)) / 2;
  while (i < ars.length) {
    const left = ars.length - i; let t = null;
    const [pk, pn] = String(over[i] || "").split(":"), pt = LAYOUT[pk] && LAYOUT[pk].pages && LAYOUT[pk].pages[pn];
    const pin = pt && pt.cells.length <= left ? Object.assign({ id: over[i] }, pt) : null; // a pinned frame may come from any layout
    if (pin) { t = pin; if (!mix) r++; } // keep the template rotation of the pages after it
    else if (mix) {
      let top = Infinity;
      tps.forEach((x, n) => {
        const k = x.cells.length; if (k > left || k < Math.min(min, left) || k > max) return;
        const rest = left - k; // leaving fewer photos than a page can take makes an odd last page
        const score = fitCost(x, i) + .22 * Math.abs(k - want) + (x === prev ? 1 : 0) + (rest > 0 && rest < min ? .6 : 0) + jitter(ph, n) * .5;
        if (score < top) { top = score; t = x; }
      });
    } else {
      const tp = tps.filter((x) => x.cells.length >= Math.min(min, left) && x.cells.length <= max);
      t = tp.length ? tp[r++ % tp.length] : null;
      if (t && t.cells.length > left) t = tp.filter((x) => x.cells.length <= left).sort((x, y) => y.cells.length - x.cells.length)[0];
    }
    if (!t) { // fewer photos than any template: fall back to the automatic frames
      const k = Math.max(1, Math.min(4, left, max)), b = best(ars.slice(i, i + k), A);
      pages.push({ type: "photos", items: b.order.map((o, j) => ({ photo: i + o, cell: b.cells[j] })) }); i += k; continue;
    }
    pages.push({ type: "photos", tid: t.id, at: i, t: t.t, pol: t.pol, shape: t.shape, bleed: t.bleed, onPh: t.onPh, ph: ph++, items: t.cells.map((c, j) => ({ photo: i + j, cell: c })) });
    i += t.cells.length; prev = t;
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
function framed(ctx, st, S, src, x, y, w, h, contain, pol, shape) {
  const r = contain ? containRect(src.width / src.height, x, y, w, h) : { x, y, w, h };
  if (shape) { // arch window or circle, cut from the cell, with a ring in the page color and a thin accent line
    const d = Math.min(w, h), c = { x: x + w / 2, y: y + h / 2 }, path = () => { ctx.beginPath();
      if (shape === "circle") ctx.arc(c.x, c.y, d / 2, 0, Math.PI * 2);
      else { const R = w / 2; ctx.moveTo(x, y + h); ctx.lineTo(x, y + R); ctx.arc(x + R, y + R, R, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); } };
    ctx.save(); path(); ctx.fillStyle = st.bg; ctx.lineWidth = S * .012; ctx.strokeStyle = st.bg; ctx.stroke(); ctx.clip();
    if (shape === "circle") coverImg(ctx, src, c.x - d / 2, c.y - d / 2, d, d); else coverImg(ctx, src, x, y, w, h);
    ctx.restore(); ctx.save(); path(); ctx.strokeStyle = st.acc; ctx.lineWidth = Math.max(1, S * .0015); ctx.stroke(); ctx.restore(); return;
  }
  if (pol) { // polaroid: white card, wider at the bottom
    const p = Math.min(w, h) * .05; r.x += p; r.y += p; r.w -= 2 * p; r.h -= 3.2 * p;
    ctx.save(); ctx.shadowColor = "rgba(40,30,20,.28)"; ctx.shadowBlur = S * .014; ctx.shadowOffsetY = S * .005; ctx.fillStyle = "#fffdf8"; ctx.fillRect(x, y, w, h); ctx.restore();
    return coverImg(ctx, src, r.x, r.y, r.w, r.h);
  }
  if (st.mat) { ctx.save(); ctx.shadowColor = "rgba(80,60,40,.18)"; ctx.shadowBlur = S * .012; ctx.shadowOffsetY = S * .004; ctx.fillStyle = "#fff"; const p = S * .008; ctx.fillRect(r.x - p, r.y - p, r.w + 2 * p, r.h + 2 * p); ctx.restore(); }
  coverImg(ctx, src, r.x, r.y, r.w, r.h);
  if (st.line) { ctx.strokeStyle = st.acc; ctx.lineWidth = Math.max(1, S * .0012); ctx.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1); }
}
function text(ctx, st, s, f, size, x, y, color, align = "center") {
  ctx.font = font(f, size); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "alphabetic";
  ctx.fillText(st.upper && f === st.title ? s.toUpperCase() : s, x, y);
}

// Pixel rectangle of a cell: a bleed page measures cells on the whole page, others on the inner box with gutters.
const cellBox = (c, pg, b, W, H, S, g) => pg.bleed ? { x: c[0] * W, y: c[1] * H, w: c[2] * W, h: c[3] * H }
  : { x: (b.x + c[0] * b.w) * S + g * S / 2, y: (b.y + c[1] * b.h) * S + g * S / 2, w: c[2] * b.w * S - g * S, h: c[3] * b.h * S - g * S };
/* Photo cells of page n in pixels (rotation ignored), for picking a photo with the pointer. */
function hits(dims, pages, n) {
  const pg = pages[n], W = dims.W, H = dims.H, S = Math.min(W, H);
  if (!pg) return [];
  if (pg.type === "cover") return [{ photo: pg.photo, x: W * .14, y: H * .12, w: W * .72, h: H * .56 }];
  if (pg.type !== "photos") return [];
  const b = inner(W / H), g = pages.gut != null ? pages.gut : DGUT;
  return pg.items.map((it) => ({ photo: it.photo, ...cellBox(it.cell, pg, b, W, H, S, g) }));
}
/* Pages grouped two by two for a lay-flat book: the cover alone, then pairs (null = blank half). */
const spreads = (pages) => { const out = [[0]]; for (let i = 1; i < pages.length; i += 2) out.push([i, i + 1 < pages.length ? i + 1 : null]); return out; };

/* Draw page n onto a context: dims is the side of a square page, or {W, H} in pixels. */
function render(ctx, dims, pages, n, photos, style, info, mark) {
  if (G.SlideEngine) G.SlideEngine.names(ctx, info);
  const W = typeof dims === "number" ? dims : dims.W, H = typeof dims === "number" ? dims : dims.H, S = Math.min(W, H), cx = W / 2;
  const st = STY[style] || STY.lux, pg = pages[n];
  ctx.save(); ctx.fillStyle = st.bg; ctx.fillRect(0, 0, W, H);
  if (st.line) { ctx.strokeStyle = st.acc; ctx.lineWidth = Math.max(1, S * .0015); const p = S * .03; ctx.strokeRect(p, p, W - 2 * p, H - 2 * p); }
  if (st.bar && pg.type !== "photos") { ctx.fillStyle = st.acc; ctx.fillRect(S * M, S * .06, S * .08, S * .012); }
  const names = info.names || "", date = info.date || "", foot = H - S * M * .6, own = pages.text || {};
  if (pg.type === "cover") {
    const src = photos[pg.photo] && photos[pg.photo].c, cv = pages.cover || "classic", ty = pages.typo && pages.typo !== "none" ? pages.typo : "";
    const nameFit = (x, y, maxW, color, k = 1) => { ctx.font = font(st.title, S * (st.upper ? .052 : .068) * k); const w = ctx.measureText(st.upper ? names.toUpperCase() : names).width; text(ctx, st, names, st.title, S * (st.upper ? .052 : .068) * k * Math.min(1, maxW / w), x, y, color); };
    if (cv === "bleed") {
      if (src) coverImg(ctx, src, 0, 0, W, H);
      const g = ctx.createLinearGradient(0, H * .45, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.6)"); ctx.fillStyle = g; ctx.fillRect(0, H * .45, W, H * .55);
      if (ty) drawTypo(ctx, st, ty, { x: W * .1, y: H * .5, w: W * .8, h: H * .2 }, 0, 0, true, own.cover);
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = S * .01; nameFit(cx, H * .85, W * .8, "#fffaf2"); if (date) text(ctx, st, date, st.body, S * .026, cx, H * .9, "rgba(255,250,242,.9)"); ctx.restore();
    } else if (cv === "split") {
      if (src) coverImg(ctx, src, 0, 0, W * .5, H);
      const rx = W * .75, bw = W * .4;
      if (ty) drawTypo(ctx, st, ty, { x: W * .55, y: H * .2, w: bw, h: H * .24 }, 0, 0, false, own.cover);
      ctx.fillStyle = st.acc; ctx.fillRect(rx - S * .03, H * .52, S * .06, Math.max(1, S * .0015));
      nameFit(rx, H * .62, bw, st.ink, .8); if (date) text(ctx, st, date, st.body, S * .024, rx, H * .68, st.soft);
    } else if (cv === "mono") {
      const ini = [info.groom, info.bride].map((x) => (x || "").trim().split(/\s+/).pop().charAt(0).toUpperCase()).join(" & ");
      text(ctx, st, ini, `italic 400 {s}px ${F.corm}`, S * .16, cx, H * .3, st.acc);
      ctx.strokeStyle = st.acc; ctx.lineWidth = Math.max(1, S * .0015); ctx.beginPath(); ctx.arc(cx, H * .25, S * .2, 0, Math.PI * 2); ctx.stroke();
      if (src) framed(ctx, st, S, src, cx - S * .11, H * .48, S * .22, S * .22, false, false, "circle");
      if (ty) drawTypo(ctx, st, ty, { x: W * .15, y: H * .48 + S * .23, w: W * .7, h: H * .1 }, 0, 0, false, own.cover);
      nameFit(cx, H * .88, W * .8, st.ink, .75); if (date) text(ctx, st, date, st.body, S * .022, cx, H * .925, st.soft);
    } else {
      const arch = cv === "arch", fx = arch ? W * .22 : W * .14, fw = arch ? W * .56 : W * .72, fy = arch ? H * .08 : H * .12, fh = arch ? H * .62 : H * .56;
      if (src) framed(ctx, st, S, src, fx, fy, fw, fh, false, false, arch ? "arch" : "");
      if (src && ty) drawTypo(ctx, st, ty, { x: fx + fw * .03, y: fy + fh * .57, w: fw * .94, h: fh * .38 }, 0, 0, true, own.cover);
      nameFit(cx, H * .8, W * .84, st.ink); if (date) text(ctx, st, date, st.body, S * .026, cx, H * .86, st.soft);
      if (st.line) { ctx.fillStyle = st.acc; ctx.fillRect(cx - S * .04, H * .885, S * .08, Math.max(1, S * .0015)); }
    }
  } else if (pg.type === "end") {
    const end = own.end || [];
    text(ctx, st, end[0] != null ? end[0] : "Cảm ơn", st.title, S * (st.upper ? .07 : .09), cx, H * .46, st.ink);
    const msg = end[1] || info.msg || "Cảm ơn quý khách đã đến chung vui cùng gia đình chúng tôi";
    ctx.font = font(st.body, S * .026); const words = msg.split(" "), lines = []; let l = "";
    for (const w of words) { const t = l ? l + " " + w : w; if (ctx.measureText(t).width > W * .6 && l) { lines.push(l); l = w; } else l = t; }
    if (l) lines.push(l);
    lines.forEach((ln, j) => text(ctx, st, ln, st.body, S * .026, cx, H * .54 + j * S * .04, st.soft));
    text(ctx, st, names + (date ? " · " + date : ""), st.body, S * .022, cx, H * .86, st.soft);
  } else {
    const b = inner(W / H), solo = pg.items.length === 1 && !pg.t, lib = pg.ph != null, GUT = pages.gut != null ? pages.gut : DGUT;
    // a bleed page measures cells on the whole page; others on the inner box with gutters
    const box = (c) => cellBox(c, pg, b, W, H, S, GUT);
    for (const it of pg.items) {
      const src = photos[it.photo] && photos[it.photo].c; if (!src) continue;
      const c = it.cell, { x, y, w, h } = box(c);
      if (pg.bleed) { coverImg(ctx, src, x, y, w, h); continue; }
      if (!c[4]) { framed(ctx, st, S, src, x, y, w, h, solo, pg.pol, pg.shape); continue; }
      ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(c[4] * Math.PI / 180);
      if (!pg.pol) { ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = S * .01; ctx.fillStyle = st.bg; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.shadowColor = "transparent"; }
      framed(ctx, st, S, src, -w / 2, -h / 2, w, h, false, pg.pol); ctx.restore();
    }
    if (pg.t && pages.typo && pages.typo !== "none") {
      const t = pg.t, tb = pg.bleed ? box(t) : { x: (b.x + t[0] * b.w) * S + GUT * S / 2, y: (b.y + t[1] * b.h) * S, w: t[2] * b.w * S - GUT * S, h: t[3] * b.h * S };
      if (pg.onPh) { const g = ctx.createLinearGradient(0, tb.y - tb.h * .4, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.45)"); ctx.fillStyle = g; ctx.fillRect(0, tb.y - tb.h * .4, W, H - tb.y + tb.h * .4); }
      drawTypo(ctx, st, pages.typo, tb, pg.ph, n, !!pg.onPh, own[pg.ph]);
    }
    text(ctx, st, String(n), st.body, S * .018, cx, foot, st.soft);
    if ((n === 1 || n % 6 === 0) && !(lib && pages.typo !== "none")) text(ctx, st, names, st.title, S * .022, S * M + GUT * S / 2, foot, st.soft, "left");
  }
  if (mark) text(ctx, st, mark, st.body, S * .016, W - S * M - GUT * S / 2, foot, st.soft, "right");
  ctx.restore();
}

/* Minimal PDF: one JPEG per page. Pages are sizeCm square, or wCm x hCm; px is the long side. */
async function pdf(pages, photos, style, info, { px = 2400, sizeCm = 30, wCm = sizeCm, hCm = sizeCm, onPage, mark, spread } = {}) {
  // spread: the cover on its own page, then two pages side by side on a sheet twice as wide
  const sheets = spread ? spreads(pages) : pages.map((_, i) => [i]);
  const pxW = Math.round(wCm >= hCm ? px : px * wCm / hCm), pxH = Math.round(hCm >= wCm ? px : px * hCm / wCm), enc = new TextEncoder(), parts = [], offs = [];
  let len = 0; const put = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); body(); put("\nendobj\n"); };
  const page = document.createElement("canvas"); page.width = pxW; page.height = pxH; const pctx = page.getContext("2d");
  const N = sheets.length, kids = sheets.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  put("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, () => put("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => put(`<< /Type /Pages /Kids [${kids}] /Count ${N} >>`));
  for (let i = 0; i < N; i++) {
    const sh = sheets[i], wide = sh.length === 2, cv = wide ? document.createElement("canvas") : page;
    if (wide) {
      cv.width = pxW * 2; cv.height = pxH; const c = cv.getContext("2d");
      sh.forEach((n, k) => { if (n == null) { c.fillStyle = (STY[style] || STY.lux).bg; c.fillRect(k * pxW, 0, pxW, pxH); return; }
        render(pctx, { W: pxW, H: pxH }, pages, n, photos, style, info, mark); c.drawImage(page, k * pxW, 0); });
    } else render(pctx, { W: pxW, H: pxH }, pages, sh[0], photos, style, info, mark);
    const jpg = new Uint8Array(await (await new Promise((ok) => cv.toBlob(ok, "image/jpeg", .9))).arrayBuffer());
    const ptW = wCm / 2.54 * 72 * (wide ? 2 : 1), ptH = hCm / 2.54 * 72, p = 3 + i * 3, content = `q ${ptW.toFixed(2)} 0 0 ${ptH.toFixed(2)} 0 0 cm /Im0 Do Q`;
    obj(p, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW.toFixed(2)} ${ptH.toFixed(2)}] /Resources << /XObject << /Im0 ${p + 1} 0 R >> >> /Contents ${p + 2} 0 R >>`));
    obj(p + 1, () => { put(`<< /Type /XObject /Subtype /Image /Width ${cv.width} /Height ${cv.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); put(jpg); put("\nendstream"); });
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

G.PhotoBook = { layout, render, pdf, takenAt, phrase, fonts, hits, spreads, LAYOUT, TYPO, COVER, DESIGN };
})(window);
