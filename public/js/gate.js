/* ===== Gate photo: one large print for the wedding entrance (names, date, lunar date), plus mockups on an easel or a wall ===== */
(function (G) {
"use strict";

/* ----- solar to Vietnamese lunar date (Ho Ngoc Duc's method, time zone UTC+7) ----- */
const INT = Math.floor, TZ = 7, PI = Math.PI;
function jdOf(d, m, y) { const a = INT((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3; return d + INT((153 * mm + 2) / 5) + 365 * yy + INT(yy / 4) - INT(yy / 100) + INT(yy / 400) - 32045; }
function newMoon(k) {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180, s = (x) => Math.sin(dr * x);
  let jd = 2415020.75933 + 29.53058868 * k + .0001178 * T2 - .000000155 * T3 + .00033 * s(166.56 + 132.87 * T - .009173 * T2);
  const M = 359.2242 + 29.10535608 * k - .0000333 * T2 - .00000347 * T3, Mp = 306.0253 + 385.81691806 * k + .0107306 * T2 + .00001236 * T3, F = 21.2964 + 390.67050646 * k - .0016528 * T2 - .00000239 * T3;
  let c = (.1734 - .000393 * T) * s(M) + .0021 * s(2 * M) - .4068 * s(Mp) + .0161 * s(2 * Mp) - .0004 * s(3 * Mp) + .0104 * s(2 * F) - .0051 * s(M + Mp)
    - .0074 * s(M - Mp) + .0004 * s(2 * F + M) - .0004 * s(2 * F - M) - .0006 * s(2 * F + Mp) + .001 * s(2 * F - Mp) + .0005 * s(2 * Mp + M);
  const dt = T < -11 ? .001 + .000839 * T + .0002261 * T2 - .00000845 * T3 - .000000081 * T * T3 : -.000278 + .000265 * T + .000262 * T2;
  jd += c - dt; return INT(jd + .5 + TZ / 24);
}
function sunLong(jdn) {
  const T = (jdn - 2451545.5 - TZ / 24) / 36525, T2 = T * T, dr = PI / 180, M = 357.5291 + 35999.0503 * T - .0001559 * T2 - .00000048 * T * T2;
  let L = 280.46645 + 36000.76983 * T + .0003032 * T2 + (1.9146 - .004817 * T - .000014 * T2) * Math.sin(dr * M) + (.019993 - .000101 * T) * Math.sin(dr * 2 * M) + .00029 * Math.sin(dr * 3 * M);
  L *= dr; L -= PI * 2 * INT(L / (PI * 2)); return INT(L / PI * 6);
}
function month11(y) { const k = INT((jdOf(31, 12, y) - 2415021) / 29.530588853); let nm = newMoon(k); if (sunLong(nm) >= 9) nm = newMoon(k - 1); return nm; }
function leapOffset(a11) {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + .5); let last, i = 1, arc = sunLong(newMoon(k + i));
  do { last = arc; i++; arc = sunLong(newMoon(k + i)); } while (arc !== last && i < 14);
  return i - 1;
}
function lunar(d, m, y) {
  const day = jdOf(d, m, y), k = INT((day - 2415021.076998695) / 29.530588853);
  let start = newMoon(k + 1); if (start > day) start = newMoon(k);
  let a11 = month11(y), b11 = a11, ly;
  if (a11 >= start) { ly = y; a11 = month11(y - 1); } else { ly = y + 1; b11 = month11(y + 1); }
  const ld = day - start + 1, diff = INT((start - a11) / 29); let lm = diff + 11, leap = false;
  if (b11 - a11 > 365) { const lo = leapOffset(a11); if (diff >= lo) { lm = diff + 10; leap = diff === lo; } }
  if (lm > 12) lm -= 12; if (lm >= 11 && diff < 4) ly--;
  return { d: ld, m: lm, y: ly, leap, canchi: CAN[(ly + 6) % 10] + " " + CHI[(ly + 8) % 12] };
}
const CAN = ["Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý"], CHI = ["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"];
const p2 = (n) => String(n).padStart(2, "0");
// "2024-09-17" -> "Tức ngày 15 tháng 08 năm Giáp Thìn"
function lunarText(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number); if (!y || !m || !d) return "";
  const l = lunar(d, m, y); return `Tức ngày ${p2(l.d)} tháng ${p2(l.m)}${l.leap ? " nhuận" : ""} năm ${l.canchi}`;
}
const WEEK = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
function solarText(iso) { const [y, m, d] = String(iso || "").split("-").map(Number); if (!y) return ""; return `${WEEK[new Date(y, m - 1, d).getDay()]}, ngày ${p2(d)} . ${p2(m)} . ${y}`; }

/* ----- the print ----- */
const SIZES = { "40x60": [40, 60], "50x75": [50, 75], "60x90": [60, 90], "60x120": [60, 120], "90x60": [90, 60] };
const SERIF = '"Playfair Display",Georgia,serif', CORM = '"Cormorant Garamond",Georgia,serif', SANS = '"Be Vietnam Pro",system-ui,sans-serif';
const TPL = {
  classic: { name: "Ảnh tràn, chữ dưới" },
  frame: { name: "Khung trắng thanh lịch" },
  red: { name: "Đỏ vàng Song Hỷ" },
  arch: { name: "Vòm nhà thờ" },
};
function cover(ctx, src, x, y, w, h) {
  const s = Math.max(w / src.width, h / src.height), dw = src.width * s, dh = src.height * s, fx = src.fx == null ? .5 : src.fx, fy = src.fy == null ? .5 : src.fy;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.drawImage(src, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh); ctx.restore();
}
function fit(ctx, s, font, size, maxW) { let z = size; ctx.font = font.replace("{s}", z); while (ctx.measureText(s).width > maxW && z > 8) { z *= .94; ctx.font = font.replace("{s}", z); } return z; }
function spaced(ctx, s, x, y, gap) { // letter-spaced line centred on x
  const cs = [...s], ws = cs.map((c) => ctx.measureText(c).width), tot = ws.reduce((a, b) => a + b, 0) + gap * (cs.length - 1); let at = x - tot / 2;
  const al = ctx.textAlign; ctx.textAlign = "left"; cs.forEach((c, i) => { ctx.fillText(c, at, y); at += ws[i] + gap; }); ctx.textAlign = al;
}
/* o: { img, groom, bride, title, date (solar line), lunar, script (CSS family of the name font), scale (name size factor), tpl, logo: {img,pos,size,op}, mark } */
function draw(ctx, W, H, o) {
  const S = Math.min(W, H), cx = W / 2, sc = o.script || '"Great Vibes",cursive', k = o.scale || 1.4, t = TPL[o.tpl] ? o.tpl : "classic";
  ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const names = (ink, y, maxW, z = 1) => {
    const g = o.groom || "Chú rể", b = o.bride || "Cô dâu", size = S * .13 * k * z;
    ctx.fillStyle = ink; fit(ctx, g + " & " + b, `400 {s}px ${sc}`, size, maxW); ctx.fillText(g + " & " + b, cx, y);
  };
  const lines = (ink, soft, y, gap) => {
    if (o.title) { ctx.fillStyle = ink; fit(ctx, o.title.toUpperCase(), `500 {s}px ${SERIF}`, S * .045, W * .8); spaced(ctx, o.title.toUpperCase(), cx, y, S * .012); }
    ctx.fillStyle = soft; let yy = y + gap;
    if (o.date) { fit(ctx, o.date, `400 {s}px ${SANS}`, S * .032, W * .84); ctx.fillText(o.date, cx, yy); yy += gap * .8; }
    if (o.lunar) { fit(ctx, "(" + o.lunar + ")", `italic 500 {s}px ${CORM}`, S * .034, W * .84); ctx.fillText("(" + o.lunar + ")", cx, yy); }
  };
  if (t === "classic") {
    cover(ctx, o.img, 0, 0, W, H);
    const g = ctx.createLinearGradient(0, H * .5, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(10,6,4,.78)"); ctx.fillStyle = g; ctx.fillRect(0, H * .5, W, H * .5);
    ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = S * .02;
    names("#fffaf2", H * .8, W * .9); ctx.shadowBlur = S * .008; lines("#fffaf2", "rgba(255,250,242,.9)", H * .865, S * .055);
  } else if (t === "frame") {
    ctx.fillStyle = "#fbf8f2"; ctx.fillRect(0, 0, W, H);
    const m = S * .06, ph = H * .64; ctx.save(); ctx.shadowColor = "rgba(60,40,20,.25)"; ctx.shadowBlur = S * .02; ctx.fillStyle = "#fff"; ctx.fillRect(m, m, W - 2 * m, ph); ctx.restore();
    cover(ctx, o.img, m + S * .012, m + S * .012, W - 2 * m - S * .024, ph - S * .024);
    ctx.strokeStyle = "#b89a6a"; ctx.lineWidth = Math.max(1, S * .002); ctx.strokeRect(m * .45, m * .45, W - m * .9, H - m * .9);
    names("#3b2f25", m + ph + (H - m - ph) * .42, W * .86, .85); lines("#6d5636", "#7a6a58", m + ph + (H - m - ph) * .6, S * .05);
  } else if (t === "red") {
    const g = ctx.createRadialGradient(cx, H * .4, 0, cx, H * .4, Math.max(W, H) * .75); g.addColorStop(0, "#b3242c"); g.addColorStop(1, "#5e0d12"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const gold = "#e8c57a", m = S * .05; ctx.strokeStyle = gold; ctx.lineWidth = S * .006; ctx.strokeRect(m, m, W - 2 * m, H - 2 * m); ctx.lineWidth = S * .002; ctx.strokeRect(m * 1.5, m * 1.5, W - 3 * m, H - 3 * m);
    ctx.fillStyle = gold; ctx.font = `700 ${S * .09}px ${SERIF}`; ctx.fillText("囍", cx, m * 1.5 + S * .11);
    const pw = W * .7, ph = H * .5, px = cx - pw / 2, py = m * 1.5 + S * .15; ctx.fillStyle = gold; ctx.fillRect(px - S * .008, py - S * .008, pw + S * .016, ph + S * .016); cover(ctx, o.img, px, py, pw, ph);
    names(gold, py + ph + (H - py - ph) * .4, W * .82, .85); lines("#fff3d9", "rgba(255,243,217,.88)", py + ph + (H - py - ph) * .58, S * .05);
  } else { // arch: photo in a church window on cream, text below
    ctx.fillStyle = "#f4efe6"; ctx.fillRect(0, 0, W, H);
    const aw = W * .74, ax = cx - aw / 2, ay = H * .06, ah = H * .6, R = aw / 2;
    const path = () => { ctx.beginPath(); ctx.moveTo(ax, ay + ah); ctx.lineTo(ax, ay + R); ctx.arc(cx, ay + R, R, PI, 0); ctx.lineTo(ax + aw, ay + ah); ctx.closePath(); };
    ctx.save(); path(); ctx.clip(); cover(ctx, o.img, ax, ay, aw, ah); ctx.restore();
    ctx.save(); ctx.translate(0, 0); ctx.strokeStyle = "#a88a5a"; ctx.lineWidth = Math.max(1, S * .003); ctx.beginPath(); ctx.moveTo(ax - S * .02, ay + ah); ctx.lineTo(ax - S * .02, ay + R); ctx.arc(cx, ay + R, R + S * .02, PI, 0); ctx.lineTo(ax + aw + S * .02, ay + ah); ctx.stroke(); ctx.restore();
    names("#3a3028", ay + ah + (H - ay - ah) * .4, W * .86, .85); lines("#7a5e36", "#6e6255", ay + ah + (H - ay - ah) * .58, S * .05);
  }
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
  if (o.logo && o.logo.img) { const L = o.logo, lw = S * (L.size || .12), lh = lw * L.img.height / L.img.width, pad = S * .035; ctx.globalAlpha = L.op == null ? .9 : L.op; ctx.drawImage(L.img, cx - lw / 2, H - pad - lh, lw, lh); ctx.globalAlpha = 1; }
  if (o.mark) { ctx.font = `500 ${S * .016}px ${SANS}`; ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = S * .004; ctx.fillText(o.mark, W - S * .02, H - S * .02); }
  ctx.restore();
}

/* ----- mockups: the finished print standing on a wooden easel, or hung on a wall in a thick frame ----- */
function mockup(ctx, W, H, poster, kind) {
  const ar = poster.width / poster.height;
  if (kind === "wall") {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#e9e2d6"); g.addColorStop(1, "#d6ccbc"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#b9a58a"; ctx.fillRect(0, H * .86, W, H * .14); ctx.fillStyle = "rgba(0,0,0,.08)"; ctx.fillRect(0, H * .86, W, H * .01);
    let ph = H * .66, pw = ph * ar; if (pw > W * .6) { pw = W * .6; ph = pw / ar; }
    const x = (W - pw) / 2, y = H * .43 - ph / 2, f = Math.min(pw, ph) * .06;
    ctx.save(); ctx.shadowColor = "rgba(40,25,10,.4)"; ctx.shadowBlur = f * 1.6; ctx.shadowOffsetY = f * .6; ctx.fillStyle = "#3a2a1c"; ctx.fillRect(x - f, y - f, pw + 2 * f, ph + 2 * f); ctx.restore();
    const fg = ctx.createLinearGradient(x - f, y - f, x + pw + f, y + ph + f); fg.addColorStop(0, "#c9a35e"); fg.addColorStop(.5, "#f0d999"); fg.addColorStop(1, "#a37b3a"); ctx.fillStyle = fg; ctx.fillRect(x - f, y - f, pw + 2 * f, ph + 2 * f);
    ctx.fillStyle = "#fff"; ctx.fillRect(x - f * .15, y - f * .15, pw + f * .3, ph + f * .3);
    ctx.drawImage(poster, x, y, pw, ph);
    const gl = ctx.createLinearGradient(x, y, x + pw, y + ph); gl.addColorStop(0, "rgba(255,255,255,.14)"); gl.addColorStop(.4, "rgba(255,255,255,0)"); ctx.fillStyle = gl; ctx.fillRect(x, y, pw, ph);
    return;
  }
  // easel at a wedding entrance: soft blurred garden light, flowers at the foot
  const g = ctx.createRadialGradient(W * .5, H * .35, 0, W * .5, H * .4, Math.max(W, H) * .8); g.addColorStop(0, "#f6efe3"); g.addColorStop(.6, "#d9cdb8"); g.addColorStop(1, "#a99a80"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) { const a = (i * 137.5) % 360, r = (i * 53 % 100) / 100; ctx.fillStyle = `rgba(255,255,255,${.06 + (i % 5) * .02})`; ctx.beginPath(); ctx.arc(W * ((a / 360 * 1.3 + r) % 1), H * (.1 + (i * 29 % 60) / 100), Math.min(W, H) * (.02 + (i % 4) * .015), 0, PI * 2); ctx.fill(); }
  ctx.fillStyle = "rgba(90,70,50,.18)"; ctx.beginPath(); ctx.ellipse(W / 2, H * .94, W * .3, H * .025, 0, 0, PI * 2); ctx.fill();
  let ph = H * .62, pw = ph * ar; if (pw > W * .55) { pw = W * .55; ph = pw / ar; }
  const x = (W - pw) / 2, y = H * .08, wood = (x1, y1, x2, y2, w) => { ctx.strokeStyle = "#7a5634"; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.strokeStyle = "rgba(255,230,190,.25)"; ctx.lineWidth = w * .3; ctx.stroke(); };
  const lw = Math.min(W, H) * .016;
  wood(W / 2, y - H * .03, W / 2, H * .9, lw * .9); // back leg
  wood(W / 2 - pw * .12, y - H * .02, x - pw * .08, H * .94, lw); wood(W / 2 + pw * .12, y - H * .02, x + pw * 1.08, H * .94, lw);
  ctx.save(); ctx.shadowColor = "rgba(40,25,10,.45)"; ctx.shadowBlur = lw * 3; ctx.shadowOffsetY = lw; ctx.fillStyle = "#fff"; ctx.fillRect(x, y, pw, ph); ctx.restore();
  ctx.drawImage(poster, x, y, pw, ph);
  wood(x - pw * .06, y + ph + lw * .6, x + pw * 1.06, y + ph + lw * .6, lw * 1.3); // ledge
  // flowers at the foot of the easel
  const fl = (fx, fy, r, c) => { for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * r * .55, fy + Math.sin(a) * r * .55, r * .5, 0, PI * 2); ctx.fill(); } ctx.fillStyle = "#e9c46a"; ctx.beginPath(); ctx.arc(fx, fy, r * .28, 0, PI * 2); ctx.fill(); };
  const R = Math.min(W, H) * .035, by = y + ph + lw * 2.4;
  [[-1.1, 0, "#f4f1ea"], [-.7, .5, "#f2c6c2"], [-.25, .1, "#ffffff"], [.2, .55, "#f6d7d2"], [.65, .05, "#f4f1ea"], [1.05, .45, "#f2c6c2"]].forEach(([dx, dy, c]) => {
    ctx.fillStyle = "#6f8b5a"; ctx.beginPath(); ctx.ellipse(W / 2 + dx * pw * .45 + R, by + dy * R + R * .6, R * 1.1, R * .4, .5, 0, PI * 2); ctx.fill();
    fl(W / 2 + dx * pw * .45, by + dy * R, R, c);
  });
}

G.GatePrint = { lunar, lunarText, solarText, SIZES, TPL, draw, mockup };
})(window);
