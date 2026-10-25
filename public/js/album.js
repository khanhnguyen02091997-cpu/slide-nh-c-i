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
  if (pool) return Object.assign(layoutLib(ars, seed, A, pool, d.min || 1, d.max || 99, d.layout === "mix", d.pages, d.over || {}, d.rate || {}), { typo, cover, gut, pool, pattern: d.pattern, tone: d.tone });
  const pages = [{ type: "cover", photo: 0 }], rhythm = [2, 3, 1, 4, 2, 3, 4, 1, 3, 2], over = d.over || {};
  let i = ars.length > 1 ? 1 : 0, r = seed % rhythm.length;
  while (i < ars.length) {
    const left = ars.length - i, want = rhythm[r++ % rhythm.length];
    // a page laid out again by hand keeps its photos and takes another frame set: over[first photo] = "T:k:v"
    const [tk, k0, v0] = String(over[i] || "").split(":");
    if (tk === "T" && T[k0] && T[k0][v0] && +k0 <= left) {
      const k = +k0, cells = T[k][v0], ar = ars.slice(i, i + k), bx = inner(A);
      let top = null; for (const ord of perms([...Array(k).keys()])) { let c = 0; cells.forEach((cl, j) => { c += Math.abs(Math.log((cl[2] * bx.w - GUT) / (cl[3] * bx.h - GUT) / ar[ord[j]])); }); if (!top || c < top.c) top = { c, ord }; }
      pages.push({ type: "photos", at: i, tv: over[i], items: top.ord.map((o, j) => ({ photo: i + o, cell: cells[j] })) }); i += k; continue;
    }
    let pick = null;
    for (let k = 1; k <= Math.min(4, left); k++) {
      if (left - k === 1 && k > 1 && left > 2) continue; // avoid leaving one lonely photo when we can help it
      const b = best(ars.slice(i, i + k), A), score = b.cost + .14 * Math.abs(k - want);
      if (!pick || score < pick.score) pick = { k, b, score };
    }
    pages.push({ type: "photos", at: i, tv: "T:" + pick.k + ":" + Math.max(0, T[pick.k].indexOf(pick.b.cells)), items: pick.b.order.map((o, j) => ({ photo: i + o, cell: pick.b.cells[j] })) });
    i += pick.k;
  }
  pages.push({ type: "end" });
  return Object.assign(pages, { typo, cover, gut, pattern: d.pattern, tone: d.tone });
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
  single: { name: "Một ảnh giữa trang", desc: "Một ảnh, nhiều khoảng trắng, chữ phía dưới", isNew: true,
    pages: [{ lift: true, t: [0, .78, 1, .22], cells: [[.12, .02, .76, .72]] }, { lift: true, t: [0, 0, 1, .22], cells: [[.2, .26, .6, .74]] }] },
  offset: { name: "Lệch tầng", desc: "Ảnh chồng lệch lên nhau, viền trắng đổ bóng", isNew: true,
    pages: [{ lift: true, t: [.44, .74, .56, .26], cells: [[0, 0, .62, .6], [.34, .32, .44, .4], [.02, .64, .4, .36]] },
      { lift: true, t: [0, 0, .4, .32], cells: [[.4, 0, .6, .56], [.16, .34, .42, .38], [.58, .62, .42, .38]] }] },
  film: { name: "Cuộn phim", desc: "Dải phim tối có lỗ, ảnh nằm trong khung phim", isNew: true,
    pages: [{ film: true, t: [0, 0, 1, .34], cells: [[.02, .44, .24, .34], [.26, .44, .24, .34], [.5, .44, .24, .34], [.74, .44, .24, .34]] },
      { film: true, t: [0, .7, 1, .3], cells: [[.02, .14, .32, .42], [.34, .14, .32, .42], [.66, .14, .32, .42]] }] },
  collage: { name: "Ghép 5 ảnh", desc: "Một ảnh lớn, bốn ảnh nhỏ và ô chữ", isNew: true,
    pages: [{ t: [.62, 0, .38, .3], cells: [[0, 0, .6, .62], [.62, .32, .38, .3], [0, .64, .29, .36], [.31, .64, .29, .36], [.62, .64, .38, .36]] },
      { t: [0, 0, .38, .3], cells: [[.4, 0, .6, .62], [0, .32, .38, .3], [0, .64, .38, .36], [.4, .64, .29, .36], [.71, .64, .29, .36]] },
      { t: [0, 0, 1, .12], cells: [[0, .14, .5, .5], [.5, .14, .25, .25], [.75, .14, .25, .25], [.5, .39, .5, .25], [0, .64, .5, .36], [.5, .64, .5, .36]] }] },
  // for: "pre" = made for prewedding (few photos, big type), "psc" = wedding-day reportage (many photos, chapters of the day)
  nine: { name: "Lưới 9 ô chữ giữa", desc: "8 ảnh quanh một ô chữ, kiểu moodboard", for: "pre", isNew: true,
    pages: [{ t: [1 / 3, 1 / 3, 1 / 3, 1 / 3], cells: g3(0, 3, 3).filter((_, i) => i !== 4) }, { t: [2 / 3, 0, 1 / 3, 1 / 3], cells: g3(0, 3, 3).filter((_, i) => i !== 2) }, { t: [0, 1 / 3, 1 / 3, 1 / 3], cells: g3(0, 3, 3).filter((_, i) => i !== 3) }] },
  magsplit: { name: "Tạp chí chia đôi", desc: "Ảnh lớn nửa trang, tiêu đề và ảnh nhỏ bên cạnh", for: "pre", isNew: true,
    pages: [{ bleed: true, t: [.53, .1, .44, .26], cells: [[0, 0, .5, 1], [.56, .42, .19, .3], [.77, .42, .19, .3]] },
      { t: [0, 0, 1, .28], cells: [[0, .32, .5, .58], [.5, .32, .5, .58]] },
      { bleed: true, t: [.04, .12, .42, .26], cells: [[.5, 0, .5, 1], [.08, .44, .34, .46]] }] },
  stagger: { name: "So le", desc: "Tiêu đề lớn một góc, ảnh dọc xếp so le", for: "pre", isNew: true,
    pages: [{ t: [0, .06, .58, .24], cells: [[.62, 0, .38, .36], [0, .38, .32, .34], [.34, .38, .32, .34], [.68, .38, .32, .34], [0, .74, .32, .26], [.34, .74, .32, .26]] },
      { t: [.36, .76, .64, .24], cells: [[0, 0, .32, .36], [.34, 0, .32, .36], [.68, 0, .32, .36], [0, .38, .34, .62], [.36, .38, .64, .36]] }] },
  poster: { name: "Poster", desc: "Một ảnh lớn như bìa tạp chí, chữ to trên ảnh", for: "pre", isNew: true,
    pages: [{ bleed: true, onPh: true, t: [.05, .05, .9, .26], cells: [[0, 0, 1, 1]] },
      { bleed: true, t: [.06, .78, .88, .16], cells: [[.06, .05, .88, .72]] },
      { bleed: true, onPh: true, t: [.05, .66, .9, .26], cells: [[0, 0, 1, 1]] }] },
  gallery: { name: "Gallery bảo tàng", desc: "Ảnh treo như phòng tranh, viền chỉ vàng mảnh, nhiều khoảng trắng", isNew: true,
    pages: [{ gal: true, t: [0, .8, 1, .2], cells: [[.06, .04, .4, .72], [.54, .04, .4, .72]] }, { gal: true, t: [0, 0, 1, .18], cells: [[.18, .24, .64, .72]] },
      { gal: true, t: [0, .84, 1, .16], cells: [[.02, .04, .29, .36], [.355, .04, .29, .36], [.69, .04, .29, .36], [.18, .44, .29, .36], [.53, .44, .29, .36]] }] },
  couture: { name: "Couture", desc: "Bố cục lệch, rất nhiều khoảng trắng như lookbook thời trang", for: "pre", isNew: true,
    pages: [{ t: [.46, .62, .54, .3], cells: [[0, 0, .42, .94], [.52, .06, .3, .42]] }, { t: [0, .04, .52, .26], cells: [[.56, 0, .44, .64], [.12, .36, .38, .56]] }] },
  chronicle: { name: "Biên niên", desc: "4 ảnh viền chỉ vàng, tiêu đề nghi lễ phía trên", for: "psc", isNew: true,
    pages: [{ gal: true, t: [0, 0, 1, .14], cells: [[.02, .18, .45, .38], [.53, .18, .45, .38], [.02, .6, .45, .38], [.53, .6, .45, .38]] },
      { gal: true, t: [0, 0, 1, .14], cells: [[.02, .2, .29, .78], [.355, .2, .29, .78], [.69, .2, .29, .78]] }] },
  report: { name: "Phóng sự dày", desc: "6 đến 7 ảnh mỗi trang, kể lại cả ngày cưới", for: "psc", isNew: true,
    pages: [{ t: [0, 0, .34, .32], cells: [[.36, 0, .64, .48], [0, .34, .34, .3], [.36, .5, .32, .25], [.68, .5, .32, .25], [0, .66, .34, .34], [.36, .75, .32, .25], [.68, .75, .32, .25]] },
      { t: [0, .84, 1, .16], cells: [[0, 0, .5, .41], [.5, 0, .25, .41], [.75, 0, .25, .41], [0, .41, .25, .41], [.25, .41, .25, .41], [.5, .41, .5, .41]] }] },
  timeline: { name: "Dòng thời gian", desc: "Giờ và tên từng nghi lễ, ảnh xếp theo diễn biến", for: "psc", isNew: true,
    pages: [{ t: [0, 0, 1, .15], cells: [[0, .17, 1 / 3, .42], [1 / 3, .17, 1 / 3, .42], [2 / 3, .17, 1 / 3, .42], [0, .59, .5, .41], [.5, .59, .5, .41]] },
      { t: [0, .32, .3, .36], cells: [[.32, 0, .68, .5], [.32, .5, .34, .5], [.66, .5, .34, .5]] }] },
  detail: { name: "Ảnh lớn + chi tiết", desc: "Một khoảnh khắc lớn và 3 ảnh chi tiết: nhẫn, hoa, váy", for: "psc", isNew: true,
    pages: [{ t: [0, .86, 1, .14], cells: [[0, 0, .7, .84], [.7, 0, .3, .28], [.7, .28, .3, .28], [.7, .56, .3, .28]] },
      { t: [0, 0, 1, .14], cells: [[.3, .16, .7, .84], [0, .16, .3, .28], [0, .44, .3, .28], [0, .72, .3, .28]] }] },
  pano: { name: "Toàn cảnh", desc: "Ảnh ngang toàn cảnh lễ đường, 4 ảnh nhỏ bên dưới", for: "psc", isNew: true,
    pages: [{ t: [0, .46, 1, .14], cells: [[0, 0, 1, .44], [0, .62, .25, .38], [.25, .62, .25, .38], [.5, .62, .25, .38], [.75, .62, .25, .38]] },
      { t: [0, 0, 1, .14], cells: [[0, .16, .25, .38], [.25, .16, .25, .38], [.5, .16, .25, .38], [.75, .16, .25, .38], [0, .56, 1, .44]] }] },
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
  engrave: { name: "Chữ khắc", desc: "Chữ in hoa viền nét, chữ ký lồng lên trên", isNew: true,
    phr: [["Love", "forever"], ["Vows", "always"], ["Joy", "together"], ["Bliss", "& grace"]] },
  frame: { name: "Khung chữ", desc: "Chữ serif nằm trong khung mảnh có góc", isNew: true,
    phr: [["Our Wedding", "Vol. 01"], ["Hạnh Phúc", "Chương hai"], ["Forever Us", "Vol. 03"], ["Bên Nhau", "Chương bốn"]] },
  poster: { name: "Poster serif", desc: "Pure HARMONY, chữ ký lồng chữ in hoa rất lớn", for: "pre", isNew: true,
    phr: [["Pure", "Harmony"], ["harper", "Arlington"], ["Eternal", "Vows"], ["Maison", "L'amour"], ["Vision", "Wedding"]] },
  grotesk: { name: "In hoa tạp chí", desc: "AMOUR, WILD VOWS, chữ đậm phủ ngang trang", for: "pre", isNew: true,
    phr: [["Amour", "de ma vie"], ["Vows", "Laura"], ["Wild", "Vows"], ["Elegance", "Pure blossom"], ["Chapter One", "Let's fall in love"]] },
  softly: { name: "Chữ thường mềm", desc: "subtle grace, softly sworn, chữ thường hai dòng", for: "pre", isNew: true,
    phr: [["subtle", "grace"], ["softly", "sworn"], ["hearts", "become one"], ["made of love", "& made to love"]] },
  savedate: { name: "Save of Date", desc: "SAVE of DATE, chữ ký nhỏ giữa hai chữ in hoa", for: "pre", isNew: true,
    phr: [["Save", "Date", "of"], ["Maison", "Amour", "de"], ["Love", "Mosaic", "of"], ["Sacred", "Union", "&"]] },
  couture: { name: "Couture", desc: "HAUTE COUTURE, chữ in hoa giãn rộng giữa hai đường chỉ", isNew: true,
    phr: [["Haute Couture", "The wedding collection"], ["Atelier", "Chapter one"], ["Le Mariage", "Paris · 2026"], ["Maison", "de l'amour"]] },
  didone: { name: "Didone sang trọng", desc: "Elegance, chữ nghiêng tương phản cao kiểu Vogue", isNew: true,
    phr: [["Elegance", "The art of love"], ["Opulence", "Since forever"], ["Grandeur", "A love story"], ["Timeless", "Yours, always"]] },
  roman: { name: "Số La Mã", desc: "I. Lễ Vu Quy, II. Rước Dâu... chương nghi lễ kiểu hoàng gia", for: "psc", noCover: true, isNew: true,
    phr: [["Lễ Vu Quy", "I"], ["Rước Dâu", "II"], ["Lễ Gia Tiên", "III"], ["Lễ Thành Hôn", "IV"], ["Tiệc Cưới", "V"]] },
  timeline: { name: "Giờ và nghi lễ", desc: "07:30 Getting ready, 09:00 Rước dâu... theo diễn biến ngày cưới", for: "psc", noCover: true, isNew: true,
    phr: [["Getting Ready", "07:30"], ["Rước Dâu", "09:00"], ["Lễ Gia Tiên", "10:00"], ["Lễ Thành Hôn", "11:00"], ["Tiệc Cưới", "18:00"], ["After Party", "21:00"]] },
  chapter: { name: "Chương nghi lễ", desc: "Chương 01, Lễ Vu Quy... chia album theo từng nghi lễ", for: "psc", noCover: true, isNew: true,
    phr: [["Lễ Vu Quy", "Chương 01"], ["Rước Dâu", "Chương 02"], ["Lễ Gia Tiên", "Chương 03"], ["Lễ Thành Hôn", "Chương 04"], ["Tiệc Cưới", "Chương 05"]] },
};

// Background patterns, drawn in the style's accent color over the page color.
const PATTERN = {
  none: { name: "Trơn", desc: "Nền một màu như phong cách" },
  paper: { name: "Giấy mỹ thuật", desc: "Vân giấy nhẹ, như in giấy mỹ thuật", isNew: true },
  dots: { name: "Chấm bi", desc: "Chấm nhỏ thưa, dịu mắt", isNew: true },
  lines: { name: "Kẻ sọc mảnh", desc: "Sọc dọc rất mảnh", isNew: true },
  grid: { name: "Lưới mảnh", desc: "Ô lưới mờ kiểu sổ tay", isNew: true },
  corners: { name: "Hoa văn góc", desc: "Họa tiết lá ở bốn góc", isNew: true },
  marble: { name: "Vân đá marble", desc: "Vân đá cẩm thạch mờ, sang trọng", isNew: true },
  linen: { name: "Vải lanh", desc: "Vân vải lanh mịn như giấy in cao cấp", isNew: true },
  gilded: { name: "Viền nhũ vàng", desc: "Hai đường viền vàng mảnh, góc hình thoi", isNew: true },
};
// Luxury colour sets laid over a style for the printed book only: dark or ivory pages with gold (foil = gold gradient type).
const TONE = {
  none: { name: "Theo phong cách", desc: "Màu của phong cách đang chọn" },
  noir: { name: "Đen nhũ vàng", desc: "Nền đen sâu, chữ và viền vàng ánh kim", isNew: true, bg: "#0e0c0a", ink: "#efe4cc", soft: "#a8957a", acc: "#c9a35b", line: true, foil: true, mat: false },
  emerald: { name: "Xanh lục bảo", desc: "Xanh ngọc lục bảo với vàng đồng", isNew: true, bg: "#10291f", ink: "#f1e7d0", soft: "#a9b8a5", acc: "#cfae67", line: true, foil: true, mat: false },
  navy: { name: "Navy champagne", desc: "Xanh navy đêm, vàng champagne", isNew: true, bg: "#0f1a2c", ink: "#f2eadb", soft: "#9aa6b8", acc: "#c9ab72", line: true, foil: true, mat: false },
  bordeaux: { name: "Đỏ rượu vang", desc: "Đỏ bordeaux nhung, vàng cổ", isNew: true, bg: "#3b0d16", ink: "#f4e4c6", soft: "#c79d8f", acc: "#d6b06a", line: true, foil: true, mat: false },
  ivory: { name: "Ngà nhũ vàng", desc: "Giấy ngà ấm, chữ vàng ánh kim", isNew: true, bg: "#f8f3e8", ink: "#2a241c", soft: "#8c7b62", acc: "#b08a46", line: true, foil: true },
  blush: { name: "Hồng satin", desc: "Hồng phấn satin, vàng hồng", isNew: true, bg: "#f6e9e4", ink: "#4a2c2a", soft: "#9c7a72", acc: "#b88a5a", foil: true, mat: true },
};
const toned = (style, tone) => { const t = TONE[tone]; return t && t.bg ? { ...(STY[style] || STY.lux), ...t } : STY[style] || STY.lux; };
// Gold foil: a metallic gradient across a box, for type and hairlines on luxury tones.
function foil(ctx, x, w) { const g = ctx.createLinearGradient(x, 0, x + w, 0); [["#9c7330", 0], ["#e9cf8a", .3], ["#b8893a", .5], ["#f3dc9a", .72], ["#a67c2e", 1]].forEach(([c, o]) => g.addColorStop(o, c)); return g; }
function pattern(ctx, st, id, W, H, S) {
  if (!id || id === "none") return;
  ctx.save(); ctx.fillStyle = st.acc; ctx.strokeStyle = st.acc;
  if (id === "paper") { // fixed pseudo-random speckles so every render looks the same
    ctx.globalAlpha = .07; let r = 7; for (let i = 0; i < 2600; i++) { r = (r * 16807) % 2147483647; const x = r % 10000 / 10000 * W; r = (r * 16807) % 2147483647; const y = r % 10000 / 10000 * H; ctx.fillRect(x, y, S * .0016, S * .0016); }
  } else if (id === "dots") { ctx.globalAlpha = .13; const g = S * .045; for (let y = g / 2; y < H; y += g) for (let x = (y / g) % 2 ? g : g / 2; x < W; x += g) { ctx.beginPath(); ctx.arc(x, y, S * .0028, 0, 7); ctx.fill(); } }
  else if (id === "lines") { ctx.globalAlpha = .1; ctx.lineWidth = Math.max(1, S * .001); for (let x = S * .02; x < W; x += S * .022) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } }
  else if (id === "grid") { ctx.globalAlpha = .1; ctx.lineWidth = Math.max(1, S * .001); const g = S * .04; for (let x = g; x < W; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = g; y < H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } }
  else if (id === "marble") { // soft veins: a few wandering curves, fixed so every render matches
    let r = 11; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    for (let v = 0; v < 9; v++) { ctx.globalAlpha = .05 + rnd() * .08; ctx.lineWidth = Math.max(1, S * (.001 + rnd() * .003)); ctx.strokeStyle = v % 3 ? st.soft : st.acc;
      ctx.beginPath(); let x = rnd() * W, y = -S * .05; ctx.moveTo(x, y);
      while (y < H + S * .05) { const nx = x + (rnd() - .5) * S * .3, ny = y + S * (.08 + rnd() * .12); ctx.quadraticCurveTo(x + (rnd() - .5) * S * .2, (y + ny) / 2, nx, ny); x = nx; y = ny; } ctx.stroke(); }
  } else if (id === "linen") { ctx.globalAlpha = .05; ctx.lineWidth = Math.max(1, S * .0008); const g = S * .006;
    for (let x = 0; x < W; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } ctx.globalAlpha = .035; for (let y = 0; y < H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  } else if (id === "gilded") { ctx.globalAlpha = .9; ctx.strokeStyle = st.foil ? foil(ctx, 0, W) : st.acc; ctx.fillStyle = ctx.strokeStyle;
    const a = S * .022, b = S * .031; ctx.lineWidth = Math.max(1, S * .0018); ctx.strokeRect(a, a, W - 2 * a, H - 2 * a); ctx.lineWidth = Math.max(1, S * .0008); ctx.strokeRect(b, b, W - 2 * b, H - 2 * b);
    const d = S * .009; for (const [x, y] of [[a, a], [W - a, a], [a, H - a], [W - a, H - a]]) { ctx.beginPath(); ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y); ctx.closePath(); ctx.fill(); }
  } else if (id === "corners") {
    ctx.globalAlpha = .35; ctx.lineWidth = Math.max(1, S * .0022);
    for (const [ox, oy, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]) {
      ctx.save(); ctx.translate(ox, oy); ctx.scale(sx, sy);
      ctx.beginPath(); ctx.moveTo(S * .02, S * .2); ctx.quadraticCurveTo(S * .03, S * .03, S * .2, S * .02); ctx.stroke();
      for (let k = 0; k < 5; k++) { const t = .2 + k * .16, px = S * (.02 + .17 * t * t), py = S * (.2 - .18 * t); ctx.save(); ctx.translate(px, py); ctx.rotate(-.8 + k * .35); ctx.beginPath(); ctx.ellipse(S * .012, 0, S * .014, S * .005, 0, 0, 7); ctx.fill(); ctx.restore(); }
      ctx.restore();
    }
  }
  ctx.restore();
}

// Cover pages.
const COVER = {
  classic: { name: "Cổ điển", desc: "Ảnh có khung, tên bên dưới" },
  bleed: { name: "Ảnh tràn bìa", desc: "Ảnh phủ kín bìa, tên nằm trên ảnh", isNew: true },
  split: { name: "Chia đôi", desc: "Ảnh nửa trang, tên và ngày bên cạnh", isNew: true },
  mono: { name: "Chữ lồng", desc: "Chữ cái đầu hai tên lồng nhau, ảnh tròn nhỏ", isNew: true },
  arch: { name: "Vòm cổ điển", desc: "Ảnh trong khung vòm lớn", isNew: true },
  duo: { name: "Hai ảnh", desc: "Hai ảnh cạnh nhau, tên bên dưới", isNew: true },
  text: { name: "Chỉ có chữ", desc: "Bìa chữ thanh lịch, không ảnh", isNew: true },
  magazine: { name: "Bìa tạp chí", desc: "Ảnh tràn bìa, chữ lớn ở đầu trang như tạp chí thời trang", for: "pre", isNew: true },
  frame: { name: "Khung trắng", desc: "Ảnh lớn viền trắng, chữ to bên dưới", for: "pre", isNew: true },
  reportage: { name: "Bìa phóng sự", desc: "4 ảnh ghép, dải tên ở giữa", for: "psc", isNew: true },
  crest: { name: "Huy hiệu chữ lồng", desc: "Chữ cái đầu trong vòng nguyệt quế, tên in hoa giãn rộng", isNew: true },
  foil: { name: "Khung nhũ vàng", desc: "Ảnh trong khung chỉ vàng đôi, tên ánh kim", isNew: true },
  passe: { name: "Passe-partout", desc: "Ảnh nằm trong khung giấy dày có đường chỉ, như ảnh treo tường", isNew: true },
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
  purelove: { name: "Pure Love", style: "korea", layout: "single", typo: "engrave", cover: "text", pattern: "paper", isNew: true },
  filmdiary: { name: "Film Diary", style: "vintage", layout: "film", typo: "hand", cover: "duo", pattern: "paper", isNew: true },
  modernframe: { name: "Modern Frame", style: "mono", layout: "offset", typo: "frame", cover: "split", pattern: "lines", isNew: true },
  hoacuoi: { name: "Hoa Cưới", style: "floral", layout: "arch", typo: "viet", cover: "arch", pattern: "corners", isNew: true },
  noir: { name: "Noir", style: "cinema", layout: "film", typo: "sans", cover: "bleed", isNew: true },
  vuonxuan: { name: "Vườn Xuân", style: "garden", layout: "offset", typo: "script", cover: "mono", pattern: "dots", isNew: true },
  hongphan: { name: "Hồng Phấn", style: "floral", layout: "single", typo: "gold", cover: "duo", pattern: "dots", isNew: true },
  dovang: { name: "Đỏ Vàng Song Hỷ", style: "red", layout: "collage", typo: "viet", cover: "text", pattern: "corners", isNew: true },
  // wedding-day reportage: many photos, the day told in order
  ngaycuoi: { name: "Ngày Cưới Của Chúng Mình", style: "korea", layout: "timeline", typo: "timeline", cover: "reportage", isNew: true },
  giatien: { name: "Lễ Gia Tiên", style: "red", layout: "detail", typo: "chapter", cover: "mono", pattern: "corners", isNew: true },
  documentary: { name: "Documentary", style: "mono", layout: "report", typo: "sans", cover: "reportage", isNew: true },
  bridaledit: { name: "The Bridal Edit", style: "cinema", layout: "pano", typo: "chapter", cover: "bleed", isNew: true },
  november: { name: "November Luxury", style: "editorial", layout: "detail", typo: "mag", cover: "classic", isNew: true },
  winter: { name: "Winter Wedding", style: "mono", layout: "pano", typo: "serif", cover: "reportage", pattern: "paper", isNew: true },
  tieccuoi: { name: "Tiệc Cưới", style: "floral", layout: "report", typo: "chapter", cover: "duo", isNew: true },
  ruocdau: { name: "Rước Dâu", style: "lux", layout: "timeline", typo: "timeline", cover: "split", pattern: "paper", isNew: true },
  // prewedding: concept shoots, few photos per page, fashion-magazine type
  vision: { kind: "pre", name: "Vision", style: "mono", layout: "poster", typo: "poster", cover: "frame", isNew: true },
  amour: { kind: "pre", name: "Amour", style: "floral", layout: "poster", typo: "grotesk", cover: "magazine", isNew: true },
  subtlegrace: { kind: "pre", name: "Subtle Grace", style: "floral", layout: "magsplit", typo: "softly", cover: "frame", isNew: true },
  savethedate: { kind: "pre", name: "Save the Date", style: "mono", layout: "stagger", typo: "savedate", cover: "frame", isNew: true },
  harmony: { kind: "pre", name: "Pure Harmony", style: "korea", layout: "magsplit", typo: "poster", cover: "magazine", isNew: true },
  lauravows: { kind: "pre", name: "Laura Vows", style: "garden", layout: "nine", typo: "grotesk", cover: "magazine", isNew: true },
  celestia: { kind: "pre", name: "Celestia Bond", style: "lux", layout: "magsplit", typo: "script", cover: "frame", isNew: true },
  elegance: { kind: "pre", name: "Elegance", style: "cinema", layout: "poster", typo: "poster", cover: "magazine", isNew: true },
  nicol: { kind: "pre", name: "Nicol Moodboard", style: "korea", layout: "nine", typo: "engrave", cover: "text", pattern: "paper", isNew: true },
  sacredunion: { kind: "pre", name: "Sacred Union", style: "garden", layout: "grid", typo: "script", cover: "frame", isNew: true },
  chapterone: { kind: "pre", name: "Chapter One", style: "floral", layout: "stagger", typo: "grotesk", cover: "magazine", isNew: true },
  maison: { kind: "pre", name: "Maison de L'amour", style: "mono", layout: "scatter", typo: "savedate", cover: "frame", pattern: "lines", isNew: true },
  alwaysforever: { kind: "pre", name: "Always & Forever", style: "vintage", layout: "nine", typo: "script", cover: "magazine", isNew: true },
  wildvows: { kind: "pre", name: "Wild Vows", style: "modern", layout: "magsplit", typo: "grotesk", cover: "magazine", isNew: true },
};
Object.assign(DESIGN, {
  // luxury sets: dark or ivory pages with gold foil (tone), for both parts
  noirgold: { kind: "pre", name: "Noir & Gold", style: "lux", tone: "noir", layout: "couture", typo: "didone", cover: "foil", pattern: "gilded", isNew: true },
  emeraldgrace: { kind: "pre", name: "Emerald Grace", style: "garden", tone: "emerald", layout: "gallery", typo: "couture", cover: "crest", isNew: true },
  hautecouture: { kind: "pre", name: "Haute Couture", style: "mono", tone: "ivory", layout: "couture", typo: "couture", cover: "passe", pattern: "linen", isNew: true },
  bordeauxroyale: { kind: "pre", name: "Bordeaux Royale", style: "lux", tone: "bordeaux", layout: "magsplit", typo: "didone", cover: "foil", pattern: "gilded", isNew: true },
  marblevows: { kind: "pre", name: "Marble Vows", style: "korea", tone: "ivory", layout: "gallery", typo: "poster", cover: "frame", pattern: "marble", isNew: true },
  midnight: { kind: "pre", name: "Midnight Navy", style: "cinema", tone: "navy", layout: "poster", typo: "couture", cover: "magazine", isNew: true },
  blushsatin: { kind: "pre", name: "Blush Satin", style: "floral", tone: "blush", layout: "couture", typo: "softly", cover: "passe", pattern: "linen", isNew: true },
  opulence: { kind: "pre", name: "Opulence", style: "editorial", tone: "noir", layout: "nine", typo: "didone", cover: "crest", pattern: "gilded", isNew: true },
  royalwedding: { name: "Royal Wedding", style: "lux", tone: "ivory", layout: "chronicle", typo: "roman", cover: "crest", pattern: "gilded", isNew: true },
  grandballroom: { name: "Grand Ballroom", style: "cinema", tone: "noir", layout: "pano", typo: "roman", cover: "foil", isNew: true },
  emeraldceremony: { name: "Emerald Ceremony", style: "garden", tone: "emerald", layout: "chronicle", typo: "chapter", cover: "passe", isNew: true },
  vuquynhung: { name: "Vu Quy Nhung Đỏ", style: "red", tone: "bordeaux", layout: "detail", typo: "roman", cover: "crest", pattern: "gilded", isNew: true },
  ivorychronicle: { name: "Ivory Chronicle", style: "korea", tone: "ivory", layout: "report", typo: "timeline", cover: "reportage", pattern: "marble", isNew: true },
  navygala: { name: "Navy Gala", style: "mono", tone: "navy", layout: "gallery", typo: "couture", cover: "foil", isNew: true },
});
// Designs without a kind belong to the wedding-day reportage (Phóng sự cưới).
Object.values(DESIGN).forEach((d) => { d.kind = d.kind || "psc"; });

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
  const [a, s2] = own || ty.phr[ph % ty.phr.length], ink = onPhoto ? "#fffaf2" : st.ink, acc = onPhoto ? "#fffaf2" : st.foil ? foil(ctx, b.x, b.w) : st.acc, soft = onPhoto ? "rgba(255,250,242,.9)" : st.soft;
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
  } else if (id === "engrave") {
    const A = a.toUpperCase(), s = fit(ctx, `500 {s}px ${F.play}`, b.h * .72, A, b.w * .9), y = b.y + b.h * .5 + s * .35;
    ctx.textAlign = "center"; ctx.lineWidth = Math.max(1, s * .02); ctx.strokeStyle = ink; ctx.strokeText(A, cx, y);
    const s3 = fit(ctx, `400 {s}px ${SCR}`, s * .42, s2, b.w * .6); ctx.fillStyle = acc; ctx.fillText(s2, cx + b.w * .1, y + s3 * .55);
  } else if (id === "frame") {
    const s = fit(ctx, `500 {s}px ${F.play}`, b.h * .3, a.toUpperCase(), b.w * .6), s3 = s * .36, fw = Math.min(b.w * .9, ctx.measureText(a.toUpperCase()).width + s * 2.2), fh = s * 2.6;
    const fx = cx - fw / 2, fy = b.y + (b.h - fh) / 2, k = s * .35, lw = Math.max(1, s * .03);
    ctx.strokeStyle = acc; ctx.lineWidth = lw; ctx.strokeRect(fx, fy, fw, fh);
    ctx.lineWidth = lw * 2.4; for (const [px, py, dx, dy] of [[fx, fy, 1, 1], [fx + fw, fy, -1, 1], [fx, fy + fh, 1, -1], [fx + fw, fy + fh, -1, -1]]) { ctx.beginPath(); ctx.moveTo(px, py + dy * k); ctx.lineTo(px, py); ctx.lineTo(px + dx * k, py); ctx.stroke(); }
    ctx.fillStyle = ink; spaced(ctx, a.toUpperCase(), cx, fy + fh * .55, s * .12);
    ctx.font = font(`italic 400 {s}px ${F.corm}`, s3 * 1.4); ctx.fillStyle = soft; ctx.textAlign = "center"; ctx.fillText(s2, cx, fy + fh * .82);
  } else if (id === "couture") { // spaced caps between two hairlines, a small italic line under
    const A = a.toUpperCase(); let s = fit(ctx, `400 {s}px ${F.play}`, b.h * .3, A, b.w * .7);
    const tw = ctx.measureText(A).width + s * .4 * ([...A].length - 1); if (tw > b.w * .92) { s *= b.w * .92 / tw; ctx.font = font(`400 {s}px ${F.play}`, s); }
    const y = b.y + b.h * .5 + s * .1; ctx.fillStyle = ink; spaced(ctx, A, cx, y, s * .4);
    ctx.fillStyle = acc; const lw = Math.max(1, s * .025); ctx.fillRect(cx - b.w * .3, y - s * 1.25, b.w * .6, lw); ctx.fillRect(cx - b.w * .3, y + s * .55, b.w * .6, lw);
    ctx.font = font(`italic 400 {s}px ${F.corm}`, s * .55); ctx.fillStyle = soft; ctx.textAlign = "center"; ctx.fillText(s2, cx, y + s * 1.35);
  } else if (id === "didone") { // big italic serif, small caps under it on the right
    const s = fit(ctx, `italic 400 {s}px ${F.play}`, b.h * .62, a, b.w * .92), y = b.y + b.h * .58; ctx.fillStyle = acc; ctx.textAlign = "center"; ctx.fillText(a, cx, y);
    ctx.font = font(`500 {s}px ${F.sans}`, Math.min(s * .16, b.h * .08)); ctx.fillStyle = ink; spaced(ctx, s2.toUpperCase(), b.x + b.w * .92, y + s * .38, s * .04, "right");
  } else if (id === "roman") { // roman numeral, a hairline, the ceremony in spaced caps
    const s = fit(ctx, `italic 400 {s}px ${F.play}`, b.h * .44, s2, b.w * .5), y = b.y + b.h * .48; ctx.fillStyle = acc; ctx.textAlign = "center"; ctx.fillText(s2, cx, y);
    ctx.fillRect(cx - b.w * .12, y + s * .22, b.w * .24, Math.max(1, s * .02));
    const A = a.toUpperCase(); let s3 = fit(ctx, `500 {s}px ${F.play}`, s * .34, A, b.w * .6); const tw = ctx.measureText(A).width + s3 * .3 * ([...A].length - 1);
    if (tw > b.w * .92) { s3 *= b.w * .92 / tw; ctx.font = font(`500 {s}px ${F.play}`, s3); } ctx.fillStyle = ink; spaced(ctx, A, cx, y + s * .3 + s3 * 1.5, s3 * .3);
  } else if (id === "poster") { // big uppercase serif, script word laid over its top left
    const B = s2.toUpperCase(), s = fit(ctx, `400 {s}px ${F.play}`, b.h * .6, B, b.w * .96), y = b.y + b.h * .88;
    ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.fillText(B, cx, y);
    const s3 = fit(ctx, `400 {s}px ${SCR}`, s * .95, a, b.w * .6); ctx.fillStyle = acc; ctx.fillText(a, cx - b.w * .14, y - s * .62);
  } else if (id === "grotesk") { // heavy uppercase across the box, script line over its lower right
    const A = a.toUpperCase(), s = fit(ctx, `800 {s}px ${F.mont}`, b.h * .7, A, b.w * .98), y = b.y + b.h * .5 + s * .36;
    ctx.fillStyle = acc; ctx.textAlign = "center"; ctx.fillText(A, cx, y);
    const s3 = fit(ctx, `400 {s}px ${SCR}`, s * .5, s2, b.w * .5); ctx.fillStyle = ink; ctx.textAlign = "right"; ctx.fillText(s2, b.x + b.w * .96, y + s3 * .7);
  } else if (id === "softly") { // two lowercase lines, the second italic and shifted right
    const s = Math.min(fit(ctx, `500 {s}px ${F.play}`, b.h * .42, a, b.w * .8), fit(ctx, `italic 400 {s}px ${F.play}`, b.h * .42, s2, b.w * .8));
    ctx.fillStyle = acc; ctx.textAlign = "left"; ctx.font = font(`500 {s}px ${F.play}`, s); const y = b.y + b.h * .45;
    ctx.fillText(a, b.x + b.w * .06, y); ctx.font = font(`italic 400 {s}px ${F.play}`, s); ctx.textAlign = "right"; ctx.fillText(s2, b.x + b.w * .94, y + s * .9);
  } else if (id === "savedate") { // SAVE of DATE on one line
    const mid = (ty.phr[ph % ty.phr.length] || [])[2] || "of", A = a.toUpperCase(), B = s2.toUpperCase();
    let s = b.h * .5; const meas = () => { ctx.font = font(`400 {s}px ${F.play}`, s); const wa = ctx.measureText(A).width, wb = ctx.measureText(B).width; ctx.font = font(`400 {s}px ${SCR}`, s * .7); const wm = ctx.measureText(mid).width; return [wa, wm, wb]; };
    let [wa, wm, wb] = meas(), tw = wa + wm + wb + s * .3; if (tw > b.w * .94) { s *= b.w * .94 / tw; [wa, wm, wb] = meas(); tw = wa + wm + wb + s * .3; }
    const x0 = cx - tw / 2, y = b.y + b.h * .5 + s * .35; ctx.textAlign = "left";
    ctx.font = font(`400 {s}px ${F.play}`, s); ctx.fillStyle = ink; ctx.fillText(A, x0, y); ctx.fillText(B, x0 + wa + wm + s * .3, y);
    ctx.font = font(`400 {s}px ${SCR}`, s * .7); ctx.fillStyle = acc; ctx.fillText(mid, x0 + wa + s * .15, y + s * .12);
  } else if (id === "timeline") { // the time large and light, a rule, the ceremony name below
    const s = fit(ctx, `300 {s}px ${F.sans}`, b.h * .38, s2, b.w * .9), y = b.y + b.h * .42; ctx.fillStyle = acc; ctx.textAlign = "center"; ctx.fillText(s2, cx, y);
    ctx.fillRect(cx - b.w * .05, y + s * .22, b.w * .1, Math.max(1, s * .03));
    const s3 = fit(ctx, `italic 500 {s}px ${F.play}`, s * .62, a, b.w * .92); ctx.fillStyle = ink; ctx.fillText(a, cx, y + s * .3 + s3 * 1.15);
  } else if (id === "chapter") { // CHƯƠNG 01 small and spaced, the ceremony name in italic serif
    const k = n ? String(ph + 1).padStart(2, "0") : "", lab = (s2 || "").toUpperCase(), s = fit(ctx, `italic 500 {s}px ${F.play}`, b.h * .42, a, b.w * .92);
    const y = b.y + b.h * .5 + s * .35; ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.fillText(a, cx, y);
    ctx.font = font(`500 {s}px ${F.sans}`, Math.min(s * .26, b.h * .1)); ctx.fillStyle = acc; spaced(ctx, lab || "CHƯƠNG " + k, cx, y - s * 1.05, s * .06);
    ctx.fillStyle = acc; ctx.fillRect(cx - b.w * .06, y + s * .38, b.w * .12, Math.max(1, s * .025));
  }
  ctx.restore();
}

/* Pages for library layouts. One layout: its templates in order. Mix (Auto Design): for each page the template whose cells
   best fit the next photos' shapes and the wished photos per page, kept in min..max, rarely the same template twice in a row. */
// rate: the user's stars per layout (1 to 5): Auto Design leans to well rated layouts and leaves out one-star ones.
function layoutLib(ars, seed, A, pool, min, max, mix, target, over, rate = {}) {
  // each template carries an id "layout:index" so a page can be pinned to one (over: first photo of the page -> id)
  const liked = mix ? pool.filter((k) => rate[k] !== 1) : pool, use = liked.length ? liked : pool;
  const pages = [{ type: "cover", photo: 0 }], tps = use.flatMap((k) => LAYOUT[k].pages.map((t, n) => Object.assign({ id: k + ":" + n, lay: k }, t))), box = inner(A);
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
        const score = fitCost(x, i) + .22 * Math.abs(k - want) + (x === prev ? 1 : 0) + (rest > 0 && rest < min ? .6 : 0) + jitter(ph, n) * .5 - (rate[x.lay] ? (rate[x.lay] - 3) * .12 : 0);
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
    pages.push({ type: "photos", tid: t.id, at: i, t: t.t, pol: t.pol, gal: t.gal, lift: t.lift, film: t.film, shape: t.shape, bleed: t.bleed, onPh: t.onPh, ph: ph++, items: t.cells.map((c, j) => ({ photo: i + j, cell: c })) });
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
  const st = toned(style, pages.tone), pg = pages[n];
  ctx.save(); ctx.fillStyle = st.bg; ctx.fillRect(0, 0, W, H); pattern(ctx, st, pages.pattern, W, H, S);
  if (st.line && pages.pattern !== "gilded") { ctx.strokeStyle = st.acc; ctx.lineWidth = Math.max(1, S * .0015); const p = S * .03; ctx.strokeRect(p, p, W - 2 * p, H - 2 * p); }
  if (st.bar && pg.type !== "photos") { ctx.fillStyle = st.acc; ctx.fillRect(S * M, S * .06, S * .08, S * .012); }
  const names = info.names || "", date = info.date || "", foot = H - S * M * .6, own = pages.text || {};
  if (pg.type === "cover") {
    // chapter-style titles name a moment of the day, so the cover shows the couple instead (unless the user wrote cover words)
    const src = photos[pg.photo] && photos[pg.photo].c, cv = pages.cover || "classic", ty = pages.typo && pages.typo !== "none" && (!TYPO[pages.typo].noCover || own.cover) ? pages.typo : "";
    const nameFit = (x, y, maxW, color, k = 1) => { ctx.font = font(st.title, S * (st.upper ? .052 : .068) * k); const w = ctx.measureText(st.upper ? names.toUpperCase() : names).width; text(ctx, st, names, st.title, S * (st.upper ? .052 : .068) * k * Math.min(1, maxW / w), x, y, color); };
    if (cv === "duo") {
      const s2 = photos[1] && photos[1].c;
      if (src) framed(ctx, st, S, src, W * .1, H * .12, W * .39, H * .56, false);
      if (s2) framed(ctx, st, S, s2, W * .51, H * .12, W * .39, H * .56, false);
      if (ty) drawTypo(ctx, st, ty, { x: W * .12, y: H * .5, w: W * .76, h: H * .16 }, 0, 0, true, own.cover);
      nameFit(cx, H * .8, W * .84, st.ink); if (date) text(ctx, st, date, st.body, S * .026, cx, H * .86, st.soft);
    } else if (cv === "crest") {
      const gold = st.foil ? foil(ctx, cx - S * .3, S * .6) : st.acc, ini = [info.groom, info.bride].map((x) => (x || "").trim().split(/\s+/).pop().charAt(0).toUpperCase()), R = S * .15, cy = H * .36;
      ctx.strokeStyle = gold; ctx.fillStyle = gold; ctx.lineWidth = Math.max(1, S * .002); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.lineWidth = Math.max(1, S * .0008); ctx.beginPath(); ctx.arc(cx, cy, R * .92, 0, 7); ctx.stroke();
      for (const sd of [-1, 1]) for (let k = 0; k < 9; k++) { const t = Math.PI / 2 + sd * (.5 + k * .2), px = cx + Math.cos(t) * R * 1.12, py = cy + Math.sin(t) * R * 1.12;
        ctx.save(); ctx.translate(px, py); ctx.rotate(t + sd * Math.PI / 2 + .5 * sd); ctx.beginPath(); ctx.ellipse(0, 0, S * .016, S * .006, 0, 0, 7); ctx.globalAlpha = .85; ctx.fill(); ctx.restore(); }
      ctx.font = font(`italic 400 {s}px ${F.play}`, R * .9); ctx.textAlign = "center"; ctx.fillText(ini[0] || "", cx - R * .28, cy + R * .1); ctx.fillText(ini[1] || "", cx + R * .28, cy + R * .42);
      ctx.font = font(`italic 400 {s}px ${F.corm}`, R * .35); ctx.fillText("&", cx + R * .02, cy + R * .2);
      if (ty) drawTypo(ctx, st, ty, { x: W * .12, y: H * .55, w: W * .76, h: H * .14 }, 0, 0, false, own.cover);
      ctx.fillStyle = st.ink; const nm = names.toUpperCase(); let s = fit(ctx, `400 {s}px ${F.play}`, S * .045, nm, W * .6); const tw = ctx.measureText(nm).width + s * .3 * ([...nm].length - 1);
      if (tw > W * .84) { s *= W * .84 / tw; ctx.font = font(`400 {s}px ${F.play}`, s); } spaced(ctx, nm, cx, H * (ty ? .78 : .7), s * .3);
      if (date) { ctx.font = font(`400 {s}px ${F.sans}`, S * .02); ctx.fillStyle = st.soft; spaced(ctx, date, cx, H * (ty ? .83 : .76), S * .008); }
    } else if (cv === "foil") {
      const gold = st.foil ? foil(ctx, W * .2, W * .6) : st.acc, fx = W * .2, fy = H * .2, fw = W * .6, fh = H * .5;
      ctx.font = font(`400 {s}px ${F.sans}`, S * .018); ctx.fillStyle = st.soft; spaced(ctx, "THE WEDDING OF", cx, H * .13, S * .008);
      if (src) coverImg(ctx, src, fx, fy, fw, fh);
      ctx.strokeStyle = gold; ctx.lineWidth = Math.max(1, S * .002); ctx.strokeRect(fx - S * .014, fy - S * .014, fw + S * .028, fh + S * .028); ctx.lineWidth = Math.max(1, S * .0008); ctx.strokeRect(fx - S * .024, fy - S * .024, fw + S * .048, fh + S * .048);
      if (ty) drawTypo(ctx, st, ty, { x: W * .1, y: H * .73, w: W * .8, h: H * .13 }, 0, 0, false, own.cover);
      else { ctx.fillStyle = gold; ctx.textAlign = "center"; fit(ctx, `400 {s}px ${SCR}`, S * .1, names, W * .8); ctx.fillText(names, cx, H * .82); }
      if (date) { ctx.font = font(`400 {s}px ${F.sans}`, S * .02); ctx.fillStyle = st.soft; spaced(ctx, (ty ? names.toUpperCase() + "  ·  " : "") + date, cx, H * .9, S * .006); }
    } else if (cv === "passe") {
      const m = S * .1, fx = m, fy = m, fw = W - 2 * m, fh = H * .62;
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = S * .012; ctx.shadowOffsetY = S * .004; ctx.fillStyle = st.bg; ctx.fillRect(fx, fy, fw, fh); ctx.restore();
      if (src) coverImg(ctx, src, fx, fy, fw, fh);
      ctx.strokeStyle = st.foil ? foil(ctx, fx, fw) : st.acc; ctx.lineWidth = Math.max(1, S * .0012); ctx.strokeRect(fx - S * .03, fy - S * .03, fw + S * .06, fh + S * .06);
      if (ty) drawTypo(ctx, st, ty, { x: W * .1, y: fy + fh + S * .06, w: W * .8, h: H * .16 }, 0, 0, false, own.cover); else nameFit(cx, fy + fh + S * .14, W * .8, st.ink);
      if (date) text(ctx, st, (ty ? names + " · " : "") + date, st.body, S * .022, cx, H - S * .06, st.soft);
    } else if (cv === "magazine") {
      if (src) coverImg(ctx, src, 0, 0, W, H);
      let g = ctx.createLinearGradient(0, 0, 0, H * .42); g.addColorStop(0, "rgba(0,0,0,.5)"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * .42);
      g = ctx.createLinearGradient(0, H * .7, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.5)"); ctx.fillStyle = g; ctx.fillRect(0, H * .7, W, H * .3);
      ctx.font = font(`400 {s}px ${F.sans}`, S * .016); ctx.fillStyle = "rgba(255,250,242,.9)";
      ["WEDDING", "PHOTOGRAPHY", "FASHION", "LUXURY"].forEach((w, k) => spaced(ctx, w, W * (.14 + k * .24), H * .045, S * .004));
      if (ty) drawTypo(ctx, st, ty, { x: W * .05, y: H * .07, w: W * .9, h: H * .24 }, 0, 0, true, own.cover);
      else { ctx.save(); ctx.fillStyle = "#fffaf2"; ctx.textAlign = "center"; const nm = names.toUpperCase(); fit(ctx, `400 {s}px ${F.play}`, S * .14, nm, W * .9); ctx.fillText(nm, cx, H * .22); ctx.restore(); }
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = S * .01; nameFit(cx, H * .9, W * .7, "#fffaf2", .7); if (date) text(ctx, st, date, st.body, S * .022, cx, H * .945, "rgba(255,250,242,.9)"); ctx.restore();
    } else if (cv === "frame") {
      if (src) coverImg(ctx, src, W * .06, H * .05, W * .88, H * .68);
      if (ty) drawTypo(ctx, st, ty, { x: W * .06, y: H * .74, w: W * .88, h: H * .15 }, 0, 0, false, own.cover);
      else nameFit(cx, H * .84, W * .84, st.ink, 1.1);
      ctx.fillStyle = st.ink; ctx.fillRect(W * .06, H * .915, W * .88, Math.max(1, S * .0012));
      ctx.font = font(`400 {s}px ${F.sans}`, S * .018); ctx.fillStyle = st.soft; ctx.textAlign = "left"; ctx.fillText(date ? `(${date})` : "", W * .06, H * .95);
      ctx.textAlign = "right"; ctx.fillText(`(${(info.names || "").toUpperCase()})`, W * .94, H * .95);
    } else if (cv === "reportage") {
      const hw = W / 2, hh = H / 2; [0, 1, 2, 3].forEach((k) => { const p = photos[k] && photos[k].c; if (p) coverImg(ctx, p, (k % 2) * hw, Math.floor(k / 2) * hh, hw, hh); });
      const bh = H * .2, by = hh - bh / 2; ctx.fillStyle = st.bg; ctx.globalAlpha = .93; ctx.fillRect(0, by, W, bh); ctx.globalAlpha = 1;
      ctx.font = font(`400 {s}px ${F.sans}`, S * .02); ctx.fillStyle = st.soft; spaced(ctx, "WEDDING REPORTAGE", cx, by + bh * .26, S * .008);
      if (ty) drawTypo(ctx, st, ty, { x: W * .1, y: by + bh * .3, w: W * .8, h: bh * .48 }, 0, 0, false, own.cover); else nameFit(cx, by + bh * .66, W * .8, st.ink, .9);
      if (date) text(ctx, st, (ty ? names + " · " : "") + date, st.body, S * .02, cx, by + bh * .9, st.soft);
    } else if (cv === "text") {
      ctx.fillStyle = st.acc; ctx.fillRect(cx - S * .12, H * .3, S * .24, Math.max(1, S * .0015)); ctx.fillRect(cx - S * .12, H * .72, S * .24, Math.max(1, S * .0015));
      if (ty) drawTypo(ctx, st, ty, { x: W * .12, y: H * .33, w: W * .76, h: H * .2 }, 0, 0, false, own.cover);
      nameFit(cx, H * (ty ? .62 : .52), W * .8, st.ink, ty ? .9 : 1.2); if (date) text(ctx, st, date, st.body, S * .026, cx, H * (ty ? .68 : .6), st.soft);
    } else if (cv === "bleed") {
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
    if (pg.film) { // dark film band behind the frames, with sprocket holes along both edges
      const bx = pg.items.map((it) => box(it.cell)), y0 = Math.min(...bx.map((r) => r.y)), y1 = Math.max(...bx.map((r) => r.y + r.h)), m = (y1 - y0) * .16;
      ctx.fillStyle = "#1c1a18"; ctx.fillRect(0, y0 - m, W, y1 - y0 + 2 * m); ctx.fillStyle = "#f3eee4";
      for (let x = S * .015; x < W; x += S * .035) { ctx.fillRect(x, y0 - m * .72, S * .016, m * .42); ctx.fillRect(x, y1 + m * .3, S * .016, m * .42); }
    }
    for (const it of pg.items) {
      const src = photos[it.photo] && photos[it.photo].c; if (!src) continue;
      const c = it.cell, { x, y, w, h } = box(c);
      if (pg.gal) { const p = S * .014; ctx.strokeStyle = st.acc; ctx.lineWidth = Math.max(1, S * .0012); ctx.strokeRect(x - p, y - p, w + 2 * p, h + 2 * p); coverImg(ctx, src, x, y, w, h); continue; }
      if (pg.lift) { const p = S * .012; ctx.save(); ctx.shadowColor = "rgba(30,20,10,.28)"; ctx.shadowBlur = S * .02; ctx.shadowOffsetY = S * .006; ctx.fillStyle = "#fffdf8"; ctx.fillRect(x - p, y - p, w + 2 * p, h + 2 * p); ctx.restore(); coverImg(ctx, src, x, y, w, h); continue; }
      if (pg.bleed) { coverImg(ctx, src, x, y, w, h); continue; }
      if (!c[4]) { framed(ctx, st, S, src, x, y, w, h, solo, pg.pol, pg.shape); continue; }
      ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(c[4] * Math.PI / 180);
      if (!pg.pol) { ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = S * .01; ctx.fillStyle = st.bg; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.shadowColor = "transparent"; }
      framed(ctx, st, S, src, -w / 2, -h / 2, w, h, false, pg.pol); ctx.restore();
    }
    if (pg.t && pages.typo && pages.typo !== "none") {
      const t = pg.t, tb = pg.bleed ? box(t) : { x: (b.x + t[0] * b.w) * S + GUT * S / 2, y: (b.y + t[1] * b.h) * S, w: t[2] * b.w * S - GUT * S, h: t[3] * b.h * S };
      if (pg.onPh && tb.y + tb.h / 2 < H / 2) { const g = ctx.createLinearGradient(0, 0, 0, tb.y + tb.h * 1.5); g.addColorStop(0, "rgba(0,0,0,.45)"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, tb.y + tb.h * 1.5); }
      else if (pg.onPh) { const g = ctx.createLinearGradient(0, tb.y - tb.h * .4, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.45)"); ctx.fillStyle = g; ctx.fillRect(0, tb.y - tb.h * .4, W, H - tb.y + tb.h * .4); }
      drawTypo(ctx, st, pages.typo, tb, pg.ph, n, !!pg.onPh, own[pg.ph]);
    }
    text(ctx, st, String(n), st.body, S * .018, cx, foot, st.soft);
    if ((n === 1 || n % 6 === 0) && !(lib && pages.typo !== "none")) text(ctx, st, names, st.title, S * .022, S * M + GUT * S / 2, foot, st.soft, "left");
  }
  if (mark) text(ctx, st, mark, st.body, S * .016, W - S * M - GUT * S / 2, foot, st.soft, "right");
  if (pages.logo) stamp(ctx, W, H, pages.logo);
  ctx.restore();
}

/* Studio logo: img at one of 9 spots (pos "tl" ... "br"), size = width as a share of the short side, op = opacity. */
function stamp(ctx, W, H, lg) {
  const im = lg && lg.img, iw = im && (im.naturalWidth || im.width), ih = im && (im.naturalHeight || im.height); if (!iw || !ih) return;
  const S = Math.min(W, H), w = S * (lg.size || .14), h = w * ih / iw, m = S * .035, p = lg.pos || "br";
  const x = p[1] === "l" ? m : p[1] === "r" ? W - m - w : (W - w) / 2, y = p[0] === "t" ? m : p[0] === "b" ? H - m - h : (H - h) / 2;
  ctx.save(); ctx.globalAlpha = lg.op == null ? .9 : lg.op; ctx.drawImage(im, x, y, w, h); ctx.restore();
}

/* Print sheets: one page each, or spreads (the cover alone, then two pages side by side) unless single is set.
   bleed (cm) adds a mirrored band around each sheet so the printer can trim without white edges. px is a page's long side. */
function printSheets(pages, photos, style, info, { px = 2400, sizeCm = 30, wCm = sizeCm, hCm = sizeCm, mark, spread, bleed = 0 } = {}) {
  const list = spread ? spreads(pages) : pages.map((_, i) => [i]);
  const pxW = Math.round(wCm >= hCm ? px : px * wCm / hCm), pxH = Math.round(hCm >= wCm ? px : px * hCm / wCm), b = Math.round(bleed * pxW / wCm);
  const page = document.createElement("canvas"); page.width = pxW; page.height = pxH; const pctx = page.getContext("2d");
  const sheet = (i) => {
    const sh = list[i], wide = sh.length === 2, cv = document.createElement("canvas"); cv.width = pxW * sh.length; cv.height = pxH; const c = cv.getContext("2d");
    sh.forEach((n, k) => { if (n == null) { c.fillStyle = toned(style, pages.tone).bg; c.fillRect(k * pxW, 0, pxW, pxH); return; }
      render(pctx, { W: pxW, H: pxH }, pages, n, photos, style, info, mark); c.drawImage(page, k * pxW, 0); });
    const out = b ? bleedOut(cv, b) : cv;
    return { cv: out, wCm: wCm * (wide ? 2 : 1) + 2 * bleed, hCm: hCm + 2 * bleed, pages: sh };
  };
  return { n: list.length, list, sheet };
}
// Mirror b pixels of the sheet's edges outward.
function bleedOut(src, b) {
  const w = src.width, h = src.height, out = document.createElement("canvas"); out.width = w + 2 * b; out.height = h + 2 * b; const c = out.getContext("2d");
  c.drawImage(src, b, b);
  c.save(); c.scale(-1, 1); c.drawImage(src, 0, 0, b, h, -b, b, b, h); c.drawImage(src, w - b, 0, b, h, -(2 * b + w), b, b, h); c.restore();
  const t = document.createElement("canvas"); t.width = out.width; t.height = out.height; t.getContext("2d").drawImage(out, 0, 0);
  c.save(); c.scale(1, -1); c.drawImage(t, 0, b, t.width, b, 0, -b, t.width, b); c.drawImage(t, 0, h, t.width, b, 0, -(2 * b + h), t.width, b); c.restore();
  return out;
}
/* Minimal PDF: one JPEG per sheet. */
async function pdf(pages, photos, style, info, opts = {}) {
  const ps = printSheets(pages, photos, style, info, opts);
  return imgPdf(ps.n, ps.sheet, opts.onPage);
}
/* The same sheets as JPEG files in a zip, named after the album and page numbers (00 = cover, 02-03 = a spread). */
async function jpgZip(pages, photos, style, info, opts = {}) {
  const ps = printSheets(pages, photos, style, info, opts), files = [], base = opts.name || "album", last = pages.length - 1;
  const tag = (n) => n === 0 ? "00-bia" : n === last ? String(n).padStart(2, "0") + "-cuoi" : String(n).padStart(2, "0");
  for (let i = 0; i < ps.n; i++) {
    const { cv, pages: sh } = ps.sheet(i);
    const blob = await new Promise((ok) => cv.toBlob(ok, "image/jpeg", .92));
    files.push({ name: `${base}-${sh.filter((n) => n != null).map(tag).join("-")}.jpg`, data: new Uint8Array(await blob.arrayBuffer()) });
    opts.onPage && opts.onPage(i + 1, ps.n); await new Promise((ok) => setTimeout(ok, 0));
  }
  return zip(files);
}
// Zip without compression (JPEGs are compressed already).
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (d) => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(files) {
  const enc = new TextEncoder(), parts = [], dir = []; let off = 0;
  const hdr = (n) => { const b = new DataView(new ArrayBuffer(n)); return b; };
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), h = hdr(30);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, nm.length, true);
    parts.push(h.buffer, nm, f.data);
    const c = hdr(46); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    dir.push(c.buffer, nm); off += 30 + nm.length + f.data.length;
  }
  const size = dir.reduce((a, x) => a + x.byteLength, 0), e = hdr(22);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...dir, e.buffer], { type: "application/zip" });
}
/* A PDF with one JPEG per page: sheet(i) returns { cv, wCm, hCm } for page i. */
async function imgPdf(N, sheet, onPage) {
  const enc = new TextEncoder(), parts = [], offs = [];
  let len = 0; const put = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); body(); put("\nendobj\n"); };
  const kids = Array.from({ length: N }, (_, i) => `${3 + i * 3} 0 R`).join(" ");
  put("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, () => put("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => put(`<< /Type /Pages /Kids [${kids}] /Count ${N} >>`));
  for (let i = 0; i < N; i++) {
    const { cv, wCm, hCm } = await sheet(i);
    const jpg = new Uint8Array(await (await new Promise((ok) => cv.toBlob(ok, "image/jpeg", .9))).arrayBuffer());
    const ptW = wCm / 2.54 * 72, ptH = hCm / 2.54 * 72, p = 3 + i * 3, content = `q ${ptW.toFixed(2)} 0 0 ${ptH.toFixed(2)} 0 0 cm /Im0 Do Q`;
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

G.PhotoBook = { layout, render, pdf, jpgZip, printSheets, stamp, variants: (k) => (T[k] || []).length, imgPdf, STY, F, TONE, takenAt, phrase, fonts, hits, spreads, LAYOUT, TYPO, COVER, PATTERN, DESIGN };
})(window);
