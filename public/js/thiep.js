/* ===== Online wedding invitation, the page guests open (/t/<slug>) and the editor's live preview (?preview=1) ===== */
(function () {
"use strict";
const $ = (id) => document.getElementById(id);
const P = new URLSearchParams(location.search);
const PREVIEW = P.get("preview") === "1", THUMB = P.get("thumb") === "1";
if (THUMB) document.body.classList.add("thumb");
const LAYS = ["classic", "envelope", "arch", "magazine", "film", "scrapbook", "hy"];
const guestName = (P.get("k") || "").trim().slice(0, 60);
const slugOf = () => { const m = location.pathname.match(/^\/t\/([a-z0-9-]+)/i); return (m ? m[1] : P.get("s") || "").toLowerCase(); };

// Couple-name fonts, the same keys the studio saves in settings.nameFont.
const NAMEF = { vibes: "Great Vibes", dancing: "Dancing Script:wght@600", pinyon: "Pinyon Script", alex: "Alex Brush", playball: "Playball", charm: "Charm:wght@700", corinthia: "Corinthia", pacifico: "Pacifico", lobster: "Lobster", patrick: "Patrick Hand" };
function useFont(k) {
  const f = NAMEF[k] || NAMEF.vibes, fam = f.split(":")[0];
  if (fam !== "Great Vibes" && !document.querySelector(`link[data-nf="${k}"]`)) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.dataset.nf = k;
    l.href = "https://fonts.googleapis.com/css2?family=" + f.replace(/ /g, "+") + "&display=swap"; document.head.appendChild(l);
  }
  document.documentElement.style.setProperty("--script", `"${fam}","Great Vibes",cursive`);
}

const p2 = (n) => String(n).padStart(2, "0");
const WEEK = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const parse = (iso) => { const [y, m, d] = String(iso || "").split("-").map(Number); return y && m && d ? { y, m, d } : null; };
const dotDate = (iso) => { const t = parse(iso); return t ? `${p2(t.d)} . ${p2(t.m)} . ${t.y}` : ""; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const text = (el, s) => { el.textContent = s || ""; return el; };

/* ----- reveal on scroll ----- */
const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 }) : null;
const reveal = (el) => { if (io && !PREVIEW) io.observe(el); else el.classList.add("in"); };

let M = null, pics = [], timer = 0;

/* M: { slug, groom, bride, date, data, photos: [path], tracks: [{path,name}], wishes: [{name,wish,at}], url: {path: signed url} } */
function render(model) {
  M = model; const d = M.data || {};
  document.body.dataset.tpl = d.tpl || "ivory";
  const lay = LAYS.includes(d.layout) ? d.layout : "classic"; document.body.dataset.lay = lay;
  useFont(d.nameFont);
  const g = (M.groom || "Chú rể").trim(), b = (M.bride || "Cô dâu").trim();
  const brideFirst = d.order === "bride";
  const [n1, n2] = brideFirst ? [b, g] : [g, b];
  document.title = `Thiệp cưới ${n1} & ${n2}`;

  text($("gG"), n1); text($("gB"), n2); text($("gDate"), dotDate(M.date));
  text($("hG"), n1); text($("hB"), n2); text($("hDate"), dotDate(M.date));
  text($("heroKick"), d.kicker || (lay === "magazine" ? "Số đặc biệt" : "Save the date"));
  text($("eN"), [...n1][0] + " & " + [...n2][0]); text($("eD"), dotDate(M.date));
  text($("issue"), "Vol. 01 · " + (dotDate(M.date) || "Our wedding"));
  for (const id of ["gGuest", "guest"]) { $(id).hidden = !guestName; text($(id), guestName ? `Trân trọng kính mời ${guestName}` : ""); }

  const cover = M.url[d.cover] || M.url[M.photos[0]] || "";
  $("heroImg").style.backgroundImage = cover ? `url("${cover}")` : "";
  $("hero").classList.toggle("noimg", !cover);
  $("gate").style.setProperty("--img", cover ? `url("${cover}")` : "none");
  const strip = (Array.isArray(d.pics) && d.pics.length ? d.pics : M.photos).filter((p) => M.url[p] && p !== (d.cover || M.photos[0])).slice(0, 4);
  $("strip").innerHTML = strip.map((p) => `<i style="background-image:url('${esc(M.url[p])}')"></i>`).join("");

  // the two families
  const fam = (f, who) => f && (f.father || f.mother || f.addr) ? `<div class="fam"><small>${who}</small>${f.father ? `<b>Ông ${esc(f.father)}</b>` : ""}${f.mother ? `<b>Bà ${esc(f.mother)}</b>` : ""}${f.addr ? `<span>${esc(f.addr)}</span>` : ""}</div>` : "";
  const fg = fam(d.groomFam, "Nhà trai"), fb = fam(d.brideFam, "Nhà gái");
  $("fams").innerHTML = brideFirst ? fb + fg : fg + fb; $("fams").hidden = !(fg || fb);
  text($("greet"), d.greet || "Trân trọng báo tin lễ thành hôn của con chúng tôi");
  const cg = $("fG").parentElement, cb = $("fB").parentElement;
  text($("fG"), d.groomFull || g); text($("fB"), d.brideFull || b);
  cg.parentElement.insertBefore(brideFirst ? cb : cg, cg.parentElement.firstChild); cg.parentElement.appendChild(brideFirst ? cg : cb);
  text($("text"), d.text || "Sự hiện diện của quý khách là niềm vinh hạnh cho gia đình chúng tôi.");

  // the date, big, with the weekday and the lunar date
  const t = parse(M.date);
  $("bigdate").innerHTML = t ? `<span>${WEEK[new Date(t.y, t.m - 1, t.d).getDay()]}</span><b>${p2(t.d)}</b><span>Tháng ${p2(t.m)} · ${t.y}</span>` : "";
  text($("lunar"), t && window.GatePrint ? "(" + GatePrint.lunarText(M.date) + ")" : "");
  $("calBlk").hidden = !t || d.cal === false;
  if (t) {
    const first = (new Date(t.y, t.m - 1, 1).getDay() + 6) % 7, days = new Date(t.y, t.m, 0).getDate(); // weeks start on Monday
    text($("calH"), `Tháng ${t.m} · ${t.y}`);
    $("cal").innerHTML = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((w) => `<b>${w}</b>`).join("") + "<span></span>".repeat(first) +
      Array.from({ length: days }, (_, i) => i + 1 === t.d ? `<span class="day"><em>${i + 1}</em></span>` : `<span>${i + 1}</span>`).join("");
  }

  // countdown to the first event that has a time, else the wedding day
  const ev = (d.events || []).filter((e) => e && (e.title || e.place || e.date));
  const first = ev.find((e) => e.date) || null, at = first ? `${first.date}T${first.time || "10:00"}:00` : M.date ? `${M.date}T10:00:00` : "";
  clearInterval(timer);
  $("countBlk").hidden = !at || d.count === false;
  if (at) { const tick = () => count(new Date(at)); tick(); timer = setInterval(tick, 1000); }

  $("events").innerHTML = ev.map((e) => {
    const dt = parse(e.date), when = [e.time && e.time.replace(":", "h"), dt && `${WEEK[new Date(dt.y, dt.m - 1, dt.d).getDay()]}, ${p2(dt.d)}/${p2(dt.m)}/${dt.y}`].filter(Boolean).join(" · ");
    const lun = dt && window.GatePrint ? GatePrint.lunarText(e.date).replace("Tức ngày", "Ngày") + " âm lịch" : "";
    const map = e.map || (e.addr || e.place ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([e.place, e.addr].filter(Boolean).join(", ")) : "");
    return `<article class="ev"><h3>${esc(e.title || "Tiệc cưới")}</h3>${when ? `<p class="when">${esc(when)}</p>` : ""}${lun ? `<p class="lun">${esc(lun)}</p>` : ""}
      ${e.place ? `<p class="place">${esc(e.place)}</p>` : ""}${e.addr ? `<p class="addr">${esc(e.addr)}</p>` : ""}
      <div class="ev-act">${map ? `<a class="pill" href="${esc(map)}" target="_blank" rel="noopener">📍 Chỉ đường</a>` : ""}${dt ? `<a class="pill" href="${esc(calLink(e))}" target="_blank" rel="noopener">🗓 Lưu vào lịch</a>` : ""}</div></article>`;
  }).join("");
  $("evBlk").hidden = !ev.length;

  // the photos the couple picked (all of the album's when none picked), cover first
  const chosen = Array.isArray(d.pics) && d.pics.length ? d.pics.filter((p) => M.url[p]) : M.photos.slice(0, 18);
  pics = chosen.map((p) => M.url[p]).filter(Boolean);
  $("gal").innerHTML = pics.map((u, i) => `<button class="ph" data-i="${i}" aria-label="Xem ảnh ${i + 1}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join("");
  $("galBlk").hidden = !pics.length;

  $("rsvpBlk").hidden = d.rsvp === false;
  $("wishBlk").hidden = d.wishes === false;
  wishes(M.wishes || []);

  const gifts = (d.gifts || []).filter((x) => x && (x.acc || x.bank));
  $("gifts").innerHTML = gifts.map((x, i) => {
    const qr = x.bin && x.acc ? `https://img.vietqr.io/image/${encodeURIComponent(x.bin)}-${encodeURIComponent(x.acc.replace(/\s/g, ""))}-compact.png?accountName=${encodeURIComponent(x.holder || "")}` : "";
    return `<div class="gift"><small>${esc(x.who || "Mừng cưới")}</small>${qr ? `<img src="${esc(qr)}" alt="Mã QR chuyển khoản" loading="lazy" onerror="this.remove()">` : ""}<b>${esc(x.bank || "")}</b><span class="acc">${esc(x.acc || "")}</span><span>${esc(x.holder || "")}</span>${x.acc ? `<button class="pill" data-copy="${i}">Sao chép số tài khoản</button>` : ""}</div>`;
  }).join("");
  $("gifts").querySelectorAll("[data-copy]").forEach((bt) => bt.onclick = () => copy(gifts[+bt.dataset.copy].acc.replace(/\s/g, ""), bt));
  $("giftBlk").hidden = !gifts.length;

  text($("thanks"), d.thanksTitle || "Thank you");
  text($("thanksTxt"), d.thanks || "Rất hân hạnh được đón tiếp!");

  // music: the track picked in the editor
  const tr = (M.tracks || []).find((x) => x.path === d.music);
  const src = tr ? M.url[tr.path] : "";
  if ($("audio").dataset.src !== src) { $("audio").dataset.src = src; if (src) $("audio").src = src; else $("audio").removeAttribute("src"); }
  $("music").hidden = !src || PREVIEW;

  document.querySelectorAll(".blk, .ev, .end").forEach(reveal);
  $("state").hidden = true;
  if (THUMB) { const g = lay === "envelope" || lay === "hy"; $("card").hidden = g; $("gate").hidden = !g; }
  else if (PREVIEW) { $("card").hidden = false; $("gate").hidden = true; }
  else if (!opened) { $("gate").hidden = false; }
  petals(d.petals !== false && !THUMB);
}

function count(to) {
  const s = Math.max(0, Math.floor((to - Date.now()) / 1000)), v = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60];
  $("clock").querySelectorAll("b").forEach((b, i) => b.textContent = p2(v[i]));
}
function calLink(e) {
  const t = parse(e.date), [h, mi] = (e.time || "10:00").split(":").map(Number);
  const st = new Date(t.y, t.m - 1, t.d, h || 10, mi || 0), en = new Date(st.getTime() + 3 * 3600e3);
  const f = (x) => x.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const g = M.groom || "Chú rể", b = M.bride || "Cô dâu";
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(`${e.title || "Đám cưới"} ${g} & ${b}`) +
    "&dates=" + f(st) + "/" + f(en) + "&location=" + encodeURIComponent([e.place, e.addr].filter(Boolean).join(", "));
}
function wishes(list) {
  $("wishes").innerHTML = list.length ? list.map((w) => `<figure class="wish"><blockquote>${esc(w.wish)}</blockquote><figcaption>${esc(w.name)}</figcaption></figure>`).join("")
    : `<p class="sub">Chưa có lời chúc nào. Bạn là người đầu tiên nhé!</p>`;
}
function copy(s, bt) {
  const done = () => { const o = bt.textContent; bt.textContent = "Đã sao chép ✓"; setTimeout(() => bt.textContent = o, 1600); };
  if (navigator.clipboard) navigator.clipboard.writeText(s).then(done, () => prompt("Số tài khoản", s)); else prompt("Số tài khoản", s);
}

/* ----- opening the card starts the music (browsers allow sound only after a tap) ----- */
let opened = false;
$("openBtn").onclick = () => {
  opened = true;
  // the envelope opens its flap and lifts the card first
  const env = document.body.dataset.lay === "envelope" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (env) $("gate").classList.add("opening");
  setTimeout(() => { $("gate").classList.add("out"); $("card").hidden = false; scrollTo(0, 0); }, env ? 1300 : 0);
  setTimeout(() => $("gate").hidden = true, env ? 2200 : 900);
  if ($("audio").getAttribute("src")) play(true);
};
function play(on) {
  const a = $("audio");
  if (on) a.play().then(() => setMusic(true), () => setMusic(false)); else { a.pause(); setMusic(false); }
}
const setMusic = (on) => { $("music").setAttribute("aria-pressed", String(on)); $("music").classList.toggle("on", on); };
$("music").onclick = () => play($("audio").paused);

/* ----- photo viewer ----- */
let at = 0;
const show = (i) => { at = (i + pics.length) % pics.length; $("lbImg").src = pics[at]; };
$("gal").onclick = (e) => { const b = e.target.closest(".ph"); if (!b || PREVIEW) return; show(+b.dataset.i); $("lb").hidden = false; };
$("lbX").onclick = () => $("lb").hidden = true;
$("lbP").onclick = () => show(at - 1); $("lbN").onclick = () => show(at + 1);
$("lb").onclick = (e) => { if (e.target === $("lb")) $("lb").hidden = true; };
document.addEventListener("keydown", (e) => { if ($("lb").hidden) return; if (e.key === "Escape") $("lb").hidden = true; if (e.key === "ArrowLeft") show(at - 1); if (e.key === "ArrowRight") show(at + 1); });
let sx = 0; $("lb").addEventListener("touchstart", (e) => sx = e.touches[0].clientX, { passive: true });
$("lb").addEventListener("touchend", (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) show(at + (dx < 0 ? 1 : -1)); });

/* ----- a few petals drifting down ----- */
function petals(on) {
  const box = $("petals"); box.innerHTML = "";
  if (!on || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < 10; i++) {
    const s = document.createElement("i");
    s.style.left = Math.random() * 100 + "%"; s.style.animationDelay = -Math.random() * 14 + "s"; s.style.animationDuration = 10 + Math.random() * 8 + "s";
    s.style.setProperty("--s", (.6 + Math.random() * .7).toFixed(2)); s.style.setProperty("--dx", (Math.random() * 120 - 60).toFixed(0) + "px");
    box.appendChild(s);
  }
}

/* ----- talking to Supabase without the client library (guests never sign in) ----- */
let cfg = null;
async function api(path, body) {
  cfg = cfg || await fetch("/api/config").then((r) => r.json());
  const r = await fetch(cfg.supabaseUrl + path, { method: "POST", headers: { apikey: cfg.supabaseAnonKey, Authorization: "Bearer " + cfg.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function signAll(paths) {
  if (!paths.length) return {};
  const out = await api("/storage/v1/object/sign/media", { expiresIn: 7 * 86400, paths });
  return Object.fromEntries(out.filter((x) => x.signedURL).map((x) => [x.path, cfg.supabaseUrl + "/storage/v1" + x.signedURL]));
}
async function load() {
  const slug = slugOf();
  if (window.__INVITE) return render(window.__INVITE); // filled in by /api/thiep, with signed links
  if (!slug) return fail("Link thiệp chưa đúng.");
  const inv = await api("/rest/v1/rpc/get_invite", { p_slug: slug });
  if (!inv) return fail("Thiệp này chưa mở hoặc đã đóng.");
  const d = inv.data || {}, wanted = new Set([d.cover, ...(d.pics && d.pics.length ? d.pics : inv.photos.slice(0, 18)), d.music].filter(Boolean));
  if (!d.cover && inv.photos[0]) wanted.add(inv.photos[0]);
  inv.url = await signAll([...wanted]);
  render(inv);
}
function fail(msg) { $("state").innerHTML = `<p>${esc(msg)}</p>`; }

$("rsvp").onsubmit = async (e) => {
  e.preventDefault(); if (PREVIEW) return;
  const f = new FormData(e.target), name = String(f.get("name") || "").trim(), btn = e.target.querySelector("button");
  if (!name) { $("rsvpMsg").textContent = "Bạn nhập tên giúp mình nhé."; e.target.name.focus(); return; }
  btn.disabled = true; $("rsvpMsg").textContent = "Đang gửi...";
  try {
    const r = await api("/rest/v1/rpc/reply_invite", { p_slug: M.slug, p_name: name, p_phone: f.get("phone"), p_attend: f.get("attend"), p_guests: +f.get("guests"), p_side: f.get("side"), p_wish: f.get("wish") });
    if (r !== "ok") throw new Error(r);
    const a = f.get("attend");
    $("rsvpMsg").textContent = a === "no" ? "Cảm ơn bạn đã báo, tiếc quá! Lời chúc của bạn đã được gửi tới cô dâu chú rể." : "Cảm ơn bạn! Hẹn gặp bạn ở ngày vui nhé.";
    const w = String(f.get("wish") || "").trim();
    if (w && M.data.wishes !== false) { M.wishes = [{ name, wish: w }, ...(M.wishes || [])]; wishes(M.wishes); }
    e.target.reset(); e.target.name.value = "";
  } catch (err) {
    $("rsvpMsg").textContent = /full/.test(err.message) ? "Đang có nhiều người gửi quá, bạn thử lại sau ít phút nhé." : /closed/.test(err.message) ? "Thiệp đã đóng phần xác nhận." : "Chưa gửi được, bạn thử lại nhé.";
  }
  btn.disabled = false;
};

if (PREVIEW) {
  // The editor sends the whole invitation each time something changes.
  addEventListener("message", (e) => { if (e.origin === location.origin && e.data && e.data.type === "invite") render(e.data.model); });
  parent.postMessage({ type: "invite-ready" }, location.origin);
} else load().catch(() => fail("Chưa mở được thiệp, bạn tải lại trang thử nhé."));
})();
