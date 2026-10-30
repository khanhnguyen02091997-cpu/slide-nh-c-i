/* ===== Online invitation editor: one invitation per album, saved in public.invites, guests open /t/<slug> ===== */
(async () => {
"use strict";
const albumId = new URLSearchParams(location.search).get("album");
if (!albumId) { location.replace("/albums.html"); return; }
const user = await requireUser();
const client = await sb();
$("email").textContent = user.email || "";
$("back").href = "/studio.html?album=" + albumId;
$("host").textContent = location.host + "/t/";

// Banks with their VietQR codes (BIN), for the transfer QR on the gift box.
const BANKS = [["Vietcombank", "970436"], ["VietinBank", "970415"], ["BIDV", "970418"], ["Agribank", "970405"], ["Techcombank", "970407"], ["MB Bank", "970422"], ["ACB", "970416"], ["VPBank", "970432"], ["TPBank", "970423"], ["Sacombank", "970403"], ["VIB", "970441"], ["HDBank", "970437"], ["SHB", "970443"], ["MSB", "970426"], ["OCB", "970448"], ["SeABank", "970440"], ["Eximbank", "970431"], ["LPBank", "970449"], ["Nam A Bank", "970428"]];
const DEF_EVENTS = [{ title: "Lễ Thành Hôn", time: "09:00", place: "Tư gia nhà trai" }, { title: "Tiệc Cưới", time: "11:00", place: "" }];
// The template library: a layout, a colour and a name font each. Thumbnails are live, with the album's own photos and names.
const PRESETS = [
  ["envelope", "beige", "pinyon", "Phong bì kem"], ["envelope", "navy", "alex", "Phong bì xanh navy"], ["arch", "ivory", "corinthia", "Vòm trắng ngà"],
  ["arch", "wine", "vibes", "Vòm đỏ đô"], ["magazine", "mono", "vibes", "Tạp chí đen trắng"], ["magazine", "blush", "playball", "Tạp chí hồng"],
  ["film", "night", "vibes", "Dải phim đêm"], ["film", "sage", "dancing", "Dải phim xanh lá"], ["scrapbook", "beige", "dancing", "Scrapbook giấy kraft"],
  ["scrapbook", "blush", "charm", "Scrapbook hồng"], ["hy", "red", "vibes", "Song Hỷ đỏ vàng"], ["hy", "wine", "pinyon", "Hỷ đỏ đô"],
  ["classic", "ivory", "vibes", "Ảnh tràn ngà"], ["classic", "sage", "alex", "Ảnh tràn xanh lá"], ["classic", "night", "pinyon", "Ảnh tràn đêm vàng"], ["classic", "navy", "corinthia", "Ảnh tràn navy"],
];
const FIELDS = ["layout", "tpl", "kicker", "groomFull", "brideFull", "greet", "text", "thanksTitle", "thanks", "nameFont", "order"];

let album = null, photos = [], tracks = [], url = {}, row = null, d = {}, replies = [];

/* ----- loading ----- */
const { data: a, error } = await client.from("albums").select("*").eq("id", albumId).single();
if (error || !a) { document.querySelector(".page").innerHTML = '<div class="empty">Không tìm thấy album này. <a href="/albums.html">Về danh sách album</a></div>'; return; }
album = a;
const [{ data: ps }, { data: ts }, inv, { data: lib }] = await Promise.all([
  client.from("album_photos").select("path,position").eq("album_id", albumId).order("position"),
  client.from("album_tracks").select("path,name,position").eq("album_id", albumId).order("position"),
  client.from("invites").select("*").eq("album_id", albumId).maybeSingle(),
  client.from("music_library").select("path,name,artist,mood").order("position").order("created_at"),
]);
const library = lib || []; // shared songs, empty until supabase/music-library.sql has run
photos = (ps || []).map((p) => p.path); tracks = ts || [];
const paths = [...photos, ...tracks.map((t) => t.path), ...library.map((m) => m.path)];
const signed = paths.length ? (await client.storage.from("media").createSignedUrls(paths, 86400)).data || [] : [];
url = Object.fromEntries(signed.map((x) => [x.path, x.signedUrl]));
const ready = !inv.error;
$("setup").hidden = ready;
row = inv.data;
d = row ? { ...row.data } : { tpl: "ivory", nameFont: (a.settings || {}).nameFont || "vibes", events: DEF_EVENTS.map((e) => ({ ...e, date: a.wedding_date || "" })), rsvp: true, wishes: true, gifts: [] };

/* ----- fill the form ----- */
$("groom").value = a.groom; $("bride").value = a.bride; $("date").value = a.wedding_date || "";
for (const k of FIELDS) if (d[k] != null) $(k).value = d[k];
const fam = (f) => f || {};
$("gFather").value = fam(d.groomFam).father || ""; $("gMother").value = fam(d.groomFam).mother || ""; $("gAddr").value = fam(d.groomFam).addr || "";
$("bFather").value = fam(d.brideFam).father || ""; $("bMother").value = fam(d.brideFam).mother || ""; $("bAddr").value = fam(d.brideFam).addr || "";
$("countOn").checked = d.count !== false; $("petalsOn").checked = d.petals !== false; $("calOn").checked = d.cal !== false;
$("rsvpOn").checked = d.rsvp !== false; $("wishOn").checked = d.wishes !== false;
$("slug").value = row ? row.slug : suggestSlug(); $("published").checked = row ? row.published : false;
if (!d.layout) d.layout = "classic";
function musicOptions() {
  const mine = tracks.map((t) => `<option value="${escH(t.path)}">${escH(t.name || "Bài nhạc")}</option>`).join("");
  const moods = [...new Set(library.map((m) => m.mood || "Nhạc có sẵn"))];
  $("music").innerHTML = `<option value="">Không có nhạc</option>` + (mine ? `<optgroup label="Nhạc của album">${mine}</optgroup>` : "") +
    moods.map((g) => `<optgroup label="${escH(g === "Nhạc có sẵn" ? g : "Có sẵn · " + g)}">${library.filter((m) => (m.mood || "Nhạc có sẵn") === g).map((m) => `<option value="${escH(m.path)}">${escH(m.name + (m.artist ? " · " + m.artist : ""))}</option>`).join("")}</optgroup>`).join("");
}
musicOptions();
$("music").value = d.music || (row ? "" : (tracks[0] || library[0] || {}).path || "");
if ($("music").selectedIndex < 0) $("music").value = "";
$("musicPlay").onclick = () => {
  const au = $("musicAudio"), src = url[$("music").value];
  if (!src) return;
  if (!au.paused && au.dataset.src === src) { au.pause(); $("musicPlay").textContent = "▶ Nghe thử"; return; }
  if (au.dataset.src !== src) { au.dataset.src = src; au.src = src; }
  au.play().then(() => $("musicPlay").textContent = "⏸ Dừng", () => {});
};
$("music").addEventListener("change", () => { $("musicAudio").pause(); $("musicPlay").textContent = "▶ Nghe thử"; });
// a song straight from this page: saved with the album's music, like in the studio
$("musicUp").onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  $("musicMsg").textContent = "Đang tải " + f.name + "...";
  const ext = (f.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp3";
  const path = `${user.id}/${albumId}/music/${crypto.randomUUID ? crypto.randomUUID() : Date.now()}.${ext}`, name = f.name.replace(/\.[^.]+$/, "");
  let r = await client.storage.from("media").upload(path, f, { contentType: f.type || "audio/mpeg" });
  if (!r.error) r = await client.from("album_tracks").insert({ album_id: albumId, user_id: user.id, path, name, position: tracks.length });
  if (r.error) { $("musicMsg").textContent = "Chưa tải được: " + r.error.message; return; }
  const s = await client.storage.from("media").createSignedUrls([path], 86400);
  if (s.data && s.data[0]) url[path] = s.data[0].signedUrl;
  tracks.push({ path, name }); musicOptions(); $("music").value = path; $("musicMsg").textContent = "Đã thêm " + name + "."; changed();
};

function escH(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function slugify(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function suggestSlug() {
  const n = slugify([a.groom, a.bride].filter(Boolean).join(" ")) || "thiep-cuoi", dt = (a.wedding_date || "").split("-");
  return (n + (dt[2] ? `-${dt[2]}${dt[1]}` : "-" + Math.random().toString(36).slice(2, 6))).slice(0, 60);
}

/* ----- the template picker ----- */
$("lib").innerHTML = PRESETS.map(([l, t, f, n], i) => `<button type="button" class="iv-card" data-i="${i}"><span class="iv-frame"><iframe src="/thiep.html?preview=1&thumb=1" loading="lazy" tabindex="-1" aria-hidden="true" title=""></iframe></span><b>${n}</b></button>`).join("");
if (window.ResizeObserver) { const ro = new ResizeObserver((es) => es.forEach((e) => e.target.style.setProperty("--k", e.contentRect.width / 390))); $("lib").querySelectorAll(".iv-frame").forEach((f) => ro.observe(f)); }
const markLib = () => $("lib").querySelectorAll(".iv-card").forEach((c) => { const [l, t, f] = PRESETS[+c.dataset.i]; c.setAttribute("aria-pressed", String(d.layout === l && d.tpl === t && d.nameFont === f)); });
$("lib").onclick = (e) => {
  const c = e.target.closest(".iv-card"); if (!c) return; const [l, t, f] = PRESETS[+c.dataset.i];
  $("layout").value = l; $("tpl").value = t; $("nameFont").value = f; changed();
};
function thumbs(only) {
  const m = model();
  $("lib").querySelectorAll("iframe").forEach((fr, i) => {
    if (only && fr.contentWindow !== only) return;
    const [l, t, f] = PRESETS[i]; try { fr.contentWindow.postMessage({ type: "invite", model: { ...m, data: { ...m.data, layout: l, tpl: t, nameFont: f } } }, location.origin); } catch {}
  });
}
let thumbT = 0; const thumbsSoon = () => { clearTimeout(thumbT); thumbT = setTimeout(thumbs, 800); };

/* ----- events ----- */
function drawEvents() {
  const ev = d.events || (d.events = []);
  $("evs").innerHTML = ev.map((e, i) => `<fieldset class="iv-ev" data-i="${i}"><legend>${i + 1}. ${escH(e.title || "Sự kiện")}</legend><div class="fields">
    <label class="f">Tên<input type="text" data-k="title" value="${escH(e.title)}" placeholder="Lễ Vu Quy, Lễ Thành Hôn, Tiệc Cưới..."></label>
    <label class="f">Ngày<input type="date" data-k="date" value="${escH(e.date)}"></label>
    <label class="f">Giờ<input type="time" data-k="time" value="${escH(e.time)}"></label>
    <label class="f">Nơi tổ chức<input type="text" data-k="place" value="${escH(e.place)}" placeholder="Nhà hàng, tư gia..."></label>
    <label class="f wide">Địa chỉ<input type="text" data-k="addr" value="${escH(e.addr)}" placeholder="Số nhà, đường, phường, quận"></label>
    <label class="f wide">Link Google Maps <small>(không bắt buộc, để trống thì tìm theo địa chỉ)</small><input type="text" data-k="map" value="${escH(e.map)}" placeholder="https://maps.app.goo.gl/..."></label>
    </div><div class="row"><button type="button" data-up>↑</button><button type="button" class="danger" data-del>Xóa</button></div></fieldset>`).join("") || `<p class="hint">Chưa có sự kiện nào.</p>`;
}
$("evs").oninput = (e) => { const f = e.target.closest("[data-i]"), k = e.target.dataset.k; if (!f || !k) return; d.events[+f.dataset.i][k] = e.target.value; if (k === "title") f.querySelector("legend").textContent = `${+f.dataset.i + 1}. ${e.target.value || "Sự kiện"}`; changed(); };
$("evs").onclick = (e) => {
  const f = e.target.closest("[data-i]"); if (!f) return; const i = +f.dataset.i;
  if (e.target.matches("[data-del]")) { d.events.splice(i, 1); drawEvents(); changed(); }
  if (e.target.matches("[data-up]") && i > 0) { [d.events[i - 1], d.events[i]] = [d.events[i], d.events[i - 1]]; drawEvents(); changed(); }
};
$("addEv").onclick = () => { (d.events = d.events || []).push({ title: "", date: $("date").value, time: "", place: "", addr: "" }); drawEvents(); changed(); };

/* ----- gift box ----- */
function drawGifts() {
  const gs = d.gifts || (d.gifts = []);
  $("gifts").innerHTML = gs.map((g, i) => `<fieldset class="iv-ev" data-i="${i}"><legend>${escH(g.who || "Mừng cưới")}</legend><div class="fields">
    <label class="f">Hiện là<input type="text" data-k="who" value="${escH(g.who)}" placeholder="Mừng cưới chú rể"></label>
    <label class="f">Ngân hàng<select data-k="bin"><option value="">Khác (không có QR)</option>${BANKS.map(([n, b]) => `<option value="${b}"${g.bin === b ? " selected" : ""}>${n}</option>`).join("")}</select></label>
    ${g.bin ? "" : `<label class="f">Tên ngân hàng<input type="text" data-k="bank" value="${escH(g.bank)}"></label>`}
    <label class="f">Số tài khoản<input type="text" data-k="acc" value="${escH(g.acc)}" inputmode="numeric"></label>
    <label class="f">Chủ tài khoản<input type="text" data-k="holder" value="${escH(g.holder)}" placeholder="NGUYEN VAN MINH"></label>
    </div><div class="row"><button type="button" class="danger" data-del>Xóa</button></div></fieldset>`).join("");
}
$("gifts").oninput = (e) => {
  const f = e.target.closest("[data-i]"), k = e.target.dataset.k; if (!f || !k) return; const g = d.gifts[+f.dataset.i];
  g[k] = e.target.value;
  if (k === "bin") { const b = BANKS.find((x) => x[1] === g.bin); g.bank = b ? b[0] : ""; drawGifts(); }
  if (k === "who") f.querySelector("legend").textContent = g.who || "Mừng cưới";
  changed();
};
$("gifts").onclick = (e) => { const f = e.target.closest("[data-i]"); if (f && e.target.matches("[data-del]")) { d.gifts.splice(+f.dataset.i, 1); drawGifts(); changed(); } };
$("addGift").onclick = () => { const n = (d.gifts = d.gifts || []).length; d.gifts.push({ who: n ? "Mừng cưới cô dâu" : "Mừng cưới chú rể", bin: "", bank: "", acc: "", holder: "" }); drawGifts(); changed(); };

/* ----- photos: in the gallery or not, and the cover ----- */
const inGal = () => Array.isArray(d.pics) ? d.pics : photos.slice(0, 18);
function drawPics() {
  const on = new Set(inGal()), cover = d.cover || photos[0];
  $("pics").innerHTML = photos.map((p, i) => `<div class="thumb${on.has(p) ? " on" : ""}" data-p="${escH(p)}"><img src="${escH(url[p] || "")}" alt="Ảnh ${i + 1}" loading="lazy"><span class="n">${on.has(p) ? "✓" : i + 1}</span><button type="button" class="iv-star${p === cover ? " is" : ""}" title="Làm ảnh bìa" aria-label="Làm ảnh bìa">★</button></div>`).join("")
    || `<p class="hint">Album chưa có ảnh. Thêm ảnh trong studio trước nhé.</p>`;
}
$("pics").onclick = (e) => {
  const t = e.target.closest("[data-p]"); if (!t) return; const p = t.dataset.p;
  if (e.target.closest(".iv-star")) d.cover = p;
  else { const cur = inGal().filter((x) => x !== p); d.pics = cur.length === inGal().length ? [...inGal(), p].sort((x, y) => photos.indexOf(x) - photos.indexOf(y)) : cur; }
  drawPics(); changed();
};
$("picAll").onclick = () => { d.pics = [...photos]; drawPics(); changed(); };
$("picNone").onclick = () => { d.pics = []; drawPics(); changed(); };

/* ----- link, QR, guest links ----- */
const link = (k) => location.origin + "/t/" + $("slug").value + (k ? "?k=" + encodeURIComponent(k) : "");
function linkUi() { $("openLink").href = link(); if (!$("qrBox").hidden) drawQr(); }
function copyText(s, btn) {
  const done = () => { const o = btn.textContent; btn.textContent = "Đã sao chép ✓"; setTimeout(() => btn.textContent = o, 1500); };
  navigator.clipboard ? navigator.clipboard.writeText(s).then(done, () => prompt("Link", s)) : prompt("Link", s);
}
$("copyLink").onclick = () => copyText(link(), $("copyLink"));
function drawQr() {
  if (!window.qrcode) return;
  const q = qrcode(0, "M"); q.addData(link()); q.make();
  const n = q.getModuleCount(), cv = $("qr"), ctx = cv.getContext("2d"), s = Math.floor(cv.width / (n + 4)), o = (cv.width - s * n) / 2;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.fillStyle = "#1d150d";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect(o + c * s, o + r * s, s, s);
}
$("qrBtn").onclick = () => { $("qrBox").hidden = !$("qrBox").hidden; drawQr(); };
$("qrSave").onclick = () => $("qr").toBlob((b) => saveFile(b, `qr-thiep-${$("slug").value}.png`));
function guestLinks() {
  const names = $("guestNames").value.split("\n").map((s) => s.trim()).filter(Boolean);
  $("guestLinks").innerHTML = names.map((n, i) => `<li><span><b>${escH(n)}</b><small>${escH(link(n))}</small></span><button type="button" data-i="${i}">Sao chép</button></li>`).join("");
  $("guestLinks").onclick = (e) => { const b = e.target.closest("button"); if (b) copyText(link(names[+b.dataset.i]), b); };
}
$("guestNames").oninput = guestLinks;

/* ----- read the form into d, preview, save ----- */
function read() {
  for (const k of FIELDS) d[k] = $(k).value.trim();
  d.groomFam = { father: $("gFather").value.trim(), mother: $("gMother").value.trim(), addr: $("gAddr").value.trim() };
  d.brideFam = { father: $("bFather").value.trim(), mother: $("bMother").value.trim(), addr: $("bAddr").value.trim() };
  d.count = $("countOn").checked; d.petals = $("petalsOn").checked; d.cal = $("calOn").checked; d.rsvp = $("rsvpOn").checked; d.wishes = $("wishOn").checked;
  d.music = $("music").value;
}
function model() {
  return { slug: $("slug").value, groom: $("groom").value.trim(), bride: $("bride").value.trim(), date: $("date").value || null, data: { ...d },
    photos, tracks, url, wishes: replies.filter((r) => r.wish && !r.hidden).map((r) => ({ name: r.name, wish: r.wish })) };
}
let pvReady = false;
addEventListener("message", (e) => {
  if (e.origin !== location.origin || !e.data || e.data.type !== "invite-ready") return;
  if (e.source === $("pv").contentWindow) { pvReady = true; preview(); } else thumbs(e.source);
});
// The preview may have loaded while this page was still fetching the album.
try { pvReady = $("pv").contentDocument.readyState === "complete"; } catch {}
$("pv").addEventListener("load", () => { pvReady = true; preview(); });
function preview() { if (pvReady) $("pv").contentWindow.postMessage({ type: "invite", model: model() }, location.origin); }

let timer = 0, saving = false, again = false;
function changed() { read(); preview(); markLib(); thumbsSoon(); $("saveState").textContent = "Chưa lưu"; $("saveState").classList.add("dirty"); clearTimeout(timer); timer = setTimeout(save, 900); }
async function save() {
  if (!ready) { $("saveState").textContent = "Chưa lưu được (thiếu bảng thiệp)"; return; }
  if (saving) { again = true; return; }
  const slug = $("slug").value;
  if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug)) { $("slugMsg").textContent = "Đuôi link cần 3 đến 60 ký tự: chữ không dấu, số và dấu gạch ngang."; $("slugMsg").classList.add("err"); return; }
  saving = true; $("saveState").textContent = "Đang lưu...";
  const al = { groom: $("groom").value.trim(), bride: $("bride").value.trim(), wedding_date: $("date").value || null };
  const [r1, r2] = await Promise.all([
    client.from("invites").upsert({ album_id: albumId, user_id: user.id, slug, published: $("published").checked, data: d, updated_at: new Date().toISOString() }),
    al.groom !== album.groom || al.bride !== album.bride || al.wedding_date !== album.wedding_date ? client.from("albums").update({ ...al, updated_at: new Date().toISOString() }).eq("id", albumId) : { error: null },
  ]);
  if (!r2.error) Object.assign(album, al);
  const err = r1.error || r2.error;
  if (r1.error && /duplicate|unique/i.test(r1.error.message)) { $("slugMsg").textContent = "Đuôi link này đã có người dùng, bạn đổi đuôi khác nhé."; $("slugMsg").classList.add("err"); }
  else if (!r1.error) { $("slugMsg").textContent = $("published").checked ? "Thiệp đang mở, khách vào link là xem được." : "Thiệp đang đóng, bật \"Mở thiệp cho khách xem\" khi sẵn sàng."; $("slugMsg").classList.remove("err"); }
  $("saveState").textContent = err ? "Chưa lưu được" : "Đã lưu"; $("saveState").classList.toggle("dirty", !!err);
  saving = false;
  if (again) { again = false; save(); }
}
document.querySelector(".main").addEventListener("input", (e) => {
  if (e.target.closest("#evs, #gifts, #guestNames")) return;
  if (e.target.id === "slug") { const v = slugify(e.target.value.replace(/-+$/, "")) + (/-$/.test(e.target.value) ? "-" : ""); if (v !== e.target.value) e.target.value = v; linkUi(); guestLinks(); }
  changed();
});
document.querySelector(".main").addEventListener("change", (e) => { if (e.target.matches("select, input[type=checkbox], input[type=date]") && !e.target.closest("#evs, #gifts")) changed(); });
addEventListener("beforeunload", (e) => { if ($("saveState").classList.contains("dirty")) { save(); e.preventDefault(); } });

/* ----- guest replies ----- */
const ATT = { yes: "Đến", no: "Không đến", maybe: "Chưa chắc" }, SIDE = { groom: "Nhà trai", bride: "Nhà gái", "": "" };
async function loadReplies() {
  if (!ready) return;
  const { data } = await client.from("invite_replies").select("*").eq("album_id", albumId).order("created_at", { ascending: false });
  replies = data || []; drawReplies(); preview();
}
function drawReplies() {
  const yes = replies.filter((r) => r.attend === "yes"), people = yes.reduce((s, r) => s + r.guests, 0);
  $("stats").innerHTML = `<div><b>${replies.length}</b><span>lượt trả lời</span></div><div><b>${yes.length}</b><span>sẽ đến</span></div><div><b>${people}</b><span>người dự kiến</span></div><div><b>${replies.filter((r) => r.attend === "no").length}</b><span>không đến</span></div>`;
  $("replies").innerHTML = replies.map((r) => `<tr data-id="${r.id}"${r.hidden ? ' class="off"' : ""}><td><b>${escH(r.name)}</b>${r.phone ? `<br><small>${escH(r.phone)}</small>` : ""}</td><td>${ATT[r.attend]}</td><td>${r.guests}</td><td>${SIDE[r.side] || ""}</td><td class="note-c">${escH(r.wish)}</td>
    <td><div class="row">${r.wish ? `<button data-hide>${r.hidden ? "Hiện" : "Ẩn"}</button>` : ""}<button class="danger" data-del>Xóa</button></div></td></tr>`).join("") || `<tr><td colspan="6" class="hint">Chưa có khách nào trả lời. Gửi link thiệp cho khách nhé.</td></tr>`;
}
$("replies").onclick = async (e) => {
  const tr = e.target.closest("[data-id]"); if (!tr) return; const r = replies.find((x) => x.id === tr.dataset.id);
  if (e.target.matches("[data-hide]")) { r.hidden = !r.hidden; await client.from("invite_replies").update({ hidden: r.hidden }).eq("id", r.id); drawReplies(); preview(); }
  if (e.target.matches("[data-del]")) {
    if (e.target.dataset.confirm !== "1") { e.target.dataset.confirm = "1"; e.target.textContent = "Bấm lần nữa"; return; }
    await client.from("invite_replies").delete().eq("id", r.id); replies = replies.filter((x) => x !== r); drawReplies(); preview();
  }
};
$("reload").onclick = loadReplies;
$("csv").onclick = () => {
  const q = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
  const lines = [["Tên", "Điện thoại", "Đến", "Số người", "Khách bên", "Lời chúc", "Thời gian"].map(q).join(","),
    ...replies.map((r) => [r.name, r.phone, ATT[r.attend], r.guests, SIDE[r.side], r.wish, new Date(r.created_at).toLocaleString("vi-VN")].map(q).join(","))];
  saveFile(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `khach-${$("slug").value}.csv`);
};

drawEvents(); drawGifts(); drawPics(); linkUi(); guestLinks();
read();
preview(); markLib(); thumbs();
loadReplies();
$("saveState").textContent = row ? "Đã lưu" : ready ? "Thiệp mới, sửa gì là tự lưu" : "Chưa cài bảng thiệp";
if (!row && ready) save();
})();
