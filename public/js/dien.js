/* ===== Couple fill-in page: /d/<token>. The bride and groom type their own details; they are saved into the invitation. ===== */
(() => {
"use strict";
const $ = (id) => document.getElementById(id);
const token = (location.pathname.match(/^\/d\/([A-Za-z0-9]{24,64})/) || [])[1] || new URLSearchParams(location.search).get("k") || "";
const BANKS = window.VN_BANKS;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Account holder as banks print it: capitals without accents.
const plain = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toUpperCase();

let cfg = null, M = null, events = [], gifts = [], timer = 0, saving = false, again = false, dirty = false;
async function api(path, body) {
  cfg = cfg || await fetch("/api/config").then((r) => r.json());
  const r = await fetch(cfg.supabaseUrl + path, { method: "POST", headers: { apikey: cfg.supabaseAnonKey, Authorization: "Bearer " + cfg.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
function fail(t) { $("lead").textContent = t; $("lead").classList.add("err"); }

/* ----- the two accounts: the gift with role groom / bride (or the first two gifts of an older invitation) ----- */
const ROLES = [["groom", "Chú rể", "Mừng cưới chú rể"], ["bride", "Cô dâu", "Mừng cưới cô dâu"]];
function account(role) {
  return gifts.find((g) => g.role === role) || gifts.find((g) => !g.role && new RegExp(role === "groom" ? "chú rể|nhà trai" : "cô dâu|nhà gái", "i").test(g.who || "")) || null;
}
let accs = {};
function drawAccs() {
  $("accs").innerHTML = ROLES.map(([role, label]) => {
    const g = accs[role];
    const qr = g.bin && g.acc ? `https://img.vietqr.io/image/${encodeURIComponent(g.bin)}-${encodeURIComponent(g.acc.replace(/\s/g, ""))}-compact.png?accountName=${encodeURIComponent(g.holder || "")}` : "";
    return `<fieldset class="iv-ev" data-role="${role}"><legend>Tài khoản ${label.toLowerCase()}</legend><div class="fields">
      <label class="f">Ngân hàng<select data-k="bin"><option value="">Chọn ngân hàng</option>${BANKS.map(([n, b]) => `<option value="${b}"${g.bin === b ? " selected" : ""}>${n}</option>`).join("")}<option value="other"${!g.bin && g.bank ? " selected" : ""}>Ngân hàng khác (không có QR)</option></select></label>
      ${!g.bin && g.bank !== undefined && g.other ? `<label class="f">Tên ngân hàng<input type="text" data-k="bank" maxlength="60" value="${esc(g.bank)}"></label>` : ""}
      <label class="f">Số tài khoản<input type="text" data-k="acc" maxlength="30" inputmode="numeric" value="${esc(g.acc)}"></label>
      <label class="f">Chủ tài khoản<input type="text" data-k="holder" maxlength="60" value="${esc(g.holder)}" placeholder="${role === "groom" ? "NGUYEN VAN MINH" : "TRAN THI LAN"}"></label>
      </div>${qr ? `<div class="cp-qr"><img src="${qr}" alt="Mã QR chuyển khoản ${label.toLowerCase()}" loading="lazy"><p class="hint">Khách sẽ thấy mã QR này trên thiệp. Bạn quét thử bằng app ngân hàng để chắc chắn đúng tài khoản.</p></div>` : ""}</fieldset>`;
  }).join("");
}
$("accs").addEventListener("input", (e) => {
  const f = e.target.closest("[data-role]"), k = e.target.dataset.k; if (!f || !k) return; const g = accs[f.dataset.role];
  if (k === "bin") {
    if (e.target.value === "other") { g.bin = ""; g.other = true; g.bank = g.bank || ""; }
    else { g.bin = e.target.value; g.other = false; const b = BANKS.find((x) => x[1] === g.bin); g.bank = b ? b[0] : ""; }
    drawAccs();
  } else g[k] = e.target.value;
  touch(k === "holder" || k === "acc" ? 1200 : 600);
});
$("accs").addEventListener("change", (e) => {
  const f = e.target.closest("[data-role]"); if (!f || e.target.dataset.k !== "holder") return;
  const g = accs[f.dataset.role]; g.holder = plain(g.holder).trim(); e.target.value = g.holder; drawAccs(); touch(300);
});

/* ----- events ----- */
function drawEvents() {
  $("evs").innerHTML = events.map((e, i) => `<fieldset class="iv-ev" data-i="${i}"><legend>${i + 1}. ${esc(e.title || "Sự kiện")}</legend><div class="fields">
    <label class="f">Tên<input type="text" data-k="title" maxlength="60" value="${esc(e.title)}" placeholder="Lễ Vu Quy, Lễ Thành Hôn, Tiệc Cưới..."></label>
    <label class="f">Ngày<input type="date" data-k="date" value="${esc(e.date)}"></label>
    <label class="f">Giờ<input type="time" data-k="time" value="${esc(e.time)}"></label>
    <label class="f">Nơi tổ chức<input type="text" data-k="place" maxlength="120" value="${esc(e.place)}" placeholder="Nhà hàng, tư gia..."></label>
    <label class="f wide">Địa chỉ<input type="text" data-k="addr" maxlength="200" value="${esc(e.addr)}" placeholder="Số nhà, đường, phường, quận"></label>
    <label class="f wide">Link Google Maps <small>(không bắt buộc)</small><input type="text" data-k="map" maxlength="300" value="${esc(e.map)}" placeholder="https://maps.app.goo.gl/..."></label>
    </div><div class="row"><button type="button" class="danger" data-del>Xóa</button></div></fieldset>`).join("") || `<p class="hint">Chưa có sự kiện nào, bấm Thêm.</p>`;
}
$("evs").addEventListener("input", (e) => { const f = e.target.closest("[data-i]"), k = e.target.dataset.k; if (!f || !k) return; events[+f.dataset.i][k] = e.target.value; if (k === "title") f.querySelector("legend").textContent = `${+f.dataset.i + 1}. ${e.target.value || "Sự kiện"}`; touch(1200); });
$("evs").addEventListener("click", (e) => { const f = e.target.closest("[data-i]"); if (f && e.target.matches("[data-del]")) { events.splice(+f.dataset.i, 1); drawEvents(); touch(300); } });
$("addEv").onclick = () => { events.push({ title: "", date: $("date").value, time: "", place: "", addr: "", map: "" }); drawEvents(); touch(1200); };

/* ----- load, read, save ----- */
const FAM = [["gFather", "groomFam", "father"], ["gMother", "groomFam", "mother"], ["gAddr", "groomFam", "addr"], ["bFather", "brideFam", "father"], ["bMother", "brideFam", "mother"], ["bAddr", "brideFam", "addr"]];
async function load() {
  if (!token) return fail("Link này chưa đúng. Bạn nhờ studio gửi lại link nhé.");
  try { M = await api("/rest/v1/rpc/couple_get", { p_token: token }); } catch { return fail("Chưa mở được, bạn tải lại trang thử nhé."); }
  if (!M) return fail("Link này đã hết hạn hoặc đã được đổi. Bạn nhờ studio gửi link mới nhé.");
  const d = M.data || {};
  $("title").innerHTML = `${esc(M.groom || "Chú rể")} <em>&amp;</em> ${esc(M.bride || "Cô dâu")}`;
  $("lead").textContent = "Hai bạn điền hoặc sửa thông tin bên dưới. Mọi thay đổi tự lưu và thiệp cưới online cập nhật ngay.";
  $("groom").value = M.groom || ""; $("bride").value = M.bride || ""; $("date").value = M.date || "";
  $("groomFull").value = d.groomFull || ""; $("brideFull").value = d.brideFull || "";
  for (const [id, fam, k] of FAM) $(id).value = (d[fam] || {})[k] || "";
  events = Array.isArray(d.events) ? d.events.map((e) => ({ ...e })) : [];
  gifts = Array.isArray(d.gifts) ? d.gifts.map((g) => ({ ...g })) : [];
  for (const [role, , who] of ROLES) { const g = account(role); accs[role] = g ? { ...g, role, other: !g.bin && !!g.bank } : { role, who, bin: "", bank: "", acc: "", holder: "" }; }
  if (M.published && M.slug) { $("view").href = "/t/" + M.slug; $("view").hidden = false; }
  drawEvents(); drawAccs(); $("form").hidden = false; $("state").textContent = "Đã lưu";
}
function collect() {
  const fam = (f) => Object.fromEntries(FAM.filter((x) => x[1] === f).map(([id, , k]) => [k, $(id).value.trim()]));
  // Keep any other gift the studio added; the two role accounts replace the gifts they came from.
  const mine = ROLES.map(([role]) => account(role)).filter(Boolean);
  const rest = gifts.filter((g) => !mine.includes(g));
  const two = ROLES.map(([role, , who]) => { const g = accs[role]; return { role, who: g.who || who, bin: g.bin || "", bank: g.bank || "", acc: (g.acc || "").trim(), holder: (g.holder || "").trim() }; }).filter((g) => g.acc);
  return { groomFull: $("groomFull").value.trim(), brideFull: $("brideFull").value.trim(), groomFam: fam("groomFam"), brideFam: fam("brideFam"),
    events: events.map((e) => ({ title: e.title || "", date: e.date || "", time: e.time || "", place: e.place || "", addr: e.addr || "", map: e.map || "" })), gifts: [...two, ...rest] };
}
function touch(ms) { dirty = true; $("state").textContent = "Chưa lưu"; clearTimeout(timer); timer = setTimeout(save, ms || 900); }
async function save() {
  clearTimeout(timer);
  if (saving) { again = true; return; }
  saving = true; $("state").textContent = "Đang lưu..."; $("saveBtn").disabled = true;
  const data = collect();
  let r = "err";
  try { r = await api("/rest/v1/rpc/couple_save", { p_token: token, p_groom: $("groom").value, p_bride: $("bride").value, p_date: $("date").value || null, p_data: data }); } catch {}
  saving = false; $("saveBtn").disabled = false;
  if (r === "ok") {
    gifts = data.gifts.map((g) => ({ ...g })); dirty = again;
    $("state").textContent = "Đã lưu, thiệp đã cập nhật ✓";
    $("title").innerHTML = `${esc($("groom").value.trim() || "Chú rể")} <em>&amp;</em> ${esc($("bride").value.trim() || "Cô dâu")}`;
  } else $("state").textContent = r === "closed" ? "Link này đã bị đổi, chưa lưu được. Bạn nhờ studio gửi link mới nhé." : "Chưa lưu được, bạn bấm Lưu thử lại nhé.";
  if (again) { again = false; save(); }
}
document.querySelectorAll("#groom,#bride,#groomFull,#brideFull,#gFather,#gMother,#gAddr,#bFather,#bMother,#bAddr").forEach((el) => el.addEventListener("input", () => touch(1200)));
$("date").addEventListener("change", () => touch(400));
$("form").onsubmit = (e) => { e.preventDefault(); save(); };
addEventListener("beforeunload", (e) => { if (dirty) { save(); e.preventDefault(); } });
load();
})();
