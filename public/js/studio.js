// Studio page: edit one album, autosave to Supabase, play / export with the shared slide engine.
const SE = window.SlideEngine;
const albumId = new URLSearchParams(location.search).get("album");
let client, user;
let photos = [];   // {id?, path?, thumb, ph, sample?, name, w, h}
let tracks = [];   // {id?, path?, name, url, file?}
const removed = { photos: [], tracks: [] };
let loading = true;
let plan = { pro: true };
// Free plan: try everything in the preview, limits apply when showing or exporting.
const FREE = { photos: 10, styles: ["lux", "korea", "modern"], book: 20, trans: ["fade", "white", "black"], tfx: ["auto", "rise", "type", "hand"], looks: ["none", "korea", "warm", "bw"] };
// Manual transitions on the free plan: keep the app's pick when it is free, otherwise rotate the free ones.
const freeTr = (t, i) => plan.pro || FREE.trans.includes(t) ? t : FREE.trans[i % FREE.trans.length];
function proNeed(mode) {
  if (plan.pro) return "";
  const why = [];
  if (mode !== "vows" && photos.filter((p) => !p.sample).length > FREE.photos) why.push(`quá ${FREE.photos} ảnh`);
  if (!FREE.styles.includes(val("style"))) why.push("phong cách này");
  if (isBook(mode) && !bookFree()) why.push(`khổ ${bookDim().label} cm`);
  if (!isBook(mode) && val("tmode") === "manual" && transList().some((t) => !FREE.trans.includes(t))) why.push("hiệu ứng có chữ Pro ở phần tự chỉnh");
  if (!isBook(mode) && mode !== "vows" && !FREE.tfx.includes($("tfx").value)) why.push("mẫu chữ chuyển động này");
  if (!isBook(mode) && mode !== "vows" && [$("look").value, ...photos.map((p) => p.look)].some((k) => k && !FREE.looks.includes(k))) why.push("bộ lọc màu có chữ Pro");
  return why.length ? `Bản miễn phí chưa dùng được ${why.join(", ")}. Bạn vẫn xem thử thoải mái ở khung bên cạnh; để ${mode === "video" ? "xuất video" : isBook(mode) ? "tải album" : mode === "vows" ? "tải thiệp" : mode === "deliver" ? "tạo file gửi khách" : "trình chiếu"} thì đổi lại hoặc nhập mã Pro.` : "";
}
function markPro() {
  if (plan.pro) return;
  document.querySelectorAll('input[name="style"]').forEach((r) => { if (!FREE.styles.includes(r.value)) r.closest("label").querySelector("b").insertAdjacentHTML("beforeend", ' <em class="pro-tag">PRO</em>'); });
  $("tAll").querySelectorAll("button").forEach((b) => { if (b.dataset.v !== "app" && !FREE.trans.includes(b.dataset.v)) b.insertAdjacentHTML("beforeend", ' <em class="pro-tag">PRO</em>'); });
  document.querySelectorAll('.pick[data-for-select="tfx"] button').forEach((b) => { if (!FREE.tfx.includes(b.dataset.v)) b.insertAdjacentHTML("beforeend", ' <em class="pro-tag">PRO</em>'); });
  [...$("bookSize").options].forEach((o) => { if (!bookFree(o.value)) o.textContent += " (Pro)"; });
  $("vfmt").insertAdjacentHTML("afterend", '<span class="hint">Bản miễn phí xuất video 720p, Pro xuất Full HD 1080p.</span>');
  $("planNote").innerHTML = `Bản miễn phí: tối đa ${FREE.photos} ảnh, 3 phong cách (Sang trọng, Hàn Quốc, Hiện đại), video 720p, album in 20 cm, có dòng chữ nhỏ ở góc. Các mục có chữ PRO vẫn xem thử được. <a href="/albums.html#pro">Nhập mã Pro</a> để mở hết.`;
}

/* ----- sample photos for an empty album ----- */
function sample(i) {
  const land = i % 3 === 1, W = land ? 1500 : 1000, H = land ? 1000 : 1340, c = document.createElement("canvas");
  c.width = W; c.height = H; const g = c.getContext("2d");
  const pal = [["#ead7bd", "#6e5232"], ["#d6c8b4", "#4a3a2a"], ["#efe1cc", "#8a6a3a"], ["#cdc0b0", "#3b2f25"], ["#e8d7c3", "#715638"], ["#dccfc4", "#5a4a52"]][i % 6];
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.globalAlpha = .16; g.fillStyle = "#fff"; for (let k = 0; k < 16; k++) { g.beginPath(); g.arc((k * 137 + i * 90) % W, (k * 251 + i * 70) % H, 40 + (k * 23) % 140, 0, 7); g.fill(); }
  g.globalAlpha = .9; g.strokeStyle = "#fff"; g.lineWidth = 7; const cx = W / 2, cy = H * .44;
  g.beginPath(); g.arc(cx - 66, cy, 120, 0, 7); g.stroke(); g.beginPath(); g.arc(cx + 66, cy, 120, 0, 7); g.stroke();
  g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "italic 60px Georgia"; g.fillText("Ảnh mẫu " + (i + 1), cx, cy + 250);
  g.font = "32px Georgia"; g.globalAlpha = .75; g.fillText("thay bằng ảnh cưới của bạn", cx, cy + 300);
  return { thumb: c.toDataURL("image/jpeg", .7), ph: SE.prep(c), sample: true, name: "Ảnh mẫu " + (i + 1) };
}

/* ----- saving ----- */
let saveTimer = 0, saving = false, again = false;
function status(t, dirty) { $("saveState").textContent = t; $("saveState").classList.toggle("dirty", !!dirty); }
function changed() {
  if (loading) return;
  status("Chưa lưu", true);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 1500);
}
window.addEventListener("beforeunload", (e) => { if ($("saveState").classList.contains("dirty")) { e.preventDefault(); e.returnValue = ""; } });

const toBlob = (canvas) => new Promise((r) => canvas.toBlob(r, "image/jpeg", .88));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2));

async function save() {
  if (saving) { again = true; return; }
  saving = true; again = false;
  status("Đang lưu...");
  try {
    let r;
    const base = user.id + "/" + albumId;
    // removed files
    if (removed.photos.length) {
      const gone = removed.photos.splice(0);
      await client.from("album_photos").delete().in("id", gone.map((p) => p.id));
      await client.storage.from("media").remove(gone.map((p) => p.path));
    }
    if (removed.tracks.length) {
      const gone = removed.tracks.splice(0);
      await client.from("album_tracks").delete().in("id", gone.map((t) => t.id));
      await client.storage.from("media").remove(gone.map((t) => t.path));
    }
    // new photos: upload the prepared (max 2400px) JPEG, not the original
    const real = photos.filter((p) => !p.sample);
    const pending = real.filter((p) => !p.path).length;
    let done = 0;
    for (const p of real) {
      if (p.path) continue;
      status(`Đang tải ảnh lên ${++done}/${pending}...`);
      const blob = await toBlob(p.ph.c);
      const path = `${base}/photos/${uid()}.jpg`;
      r = await client.storage.from("media").upload(path, blob, { contentType: "image/jpeg" });
      if (r.error) throw r.error;
      p.path = path;
      p.id = uid();
    }
    if (real.length) {
      r = await client.from("album_photos").upsert(real.map((p, i) => ({ id: p.id, album_id: albumId, user_id: user.id, path: p.path, position: i, width: p.ph.c.width, height: p.ph.c.height })));
      if (r.error) throw r.error;
    }
    // album row last: its settings refer to photos by storage path, which new photos only have now
    r = await client.from("albums").update({
      groom: $("groom").value.trim(), bride: $("bride").value.trim(), wedding_date: $("date").value || null,
      message: $("msg").value.trim(), mode: val("mode"), style: val("style"), settings: readSettings(), updated_at: new Date().toISOString(),
    }).eq("id", albumId);
    if (r.error) throw r.error;
    for (const t of tracks) {
      if (t.path) continue;
      status("Đang tải nhạc lên: " + t.name + "...");
      const ext = (t.file.name || "").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "mp3";
      const path = `${base}/music/${uid()}.${ext}`;
      r = await client.storage.from("media").upload(path, t.file, { contentType: t.file.type || "audio/mpeg" });
      if (r.error) throw r.error;
      t.path = path;
      t.id = uid();
    }
    if (tracks.length) {
      r = await client.from("album_tracks").upsert(tracks.map((t, i) => ({ id: t.id, album_id: albumId, user_id: user.id, path: t.path, name: t.name, position: i })));
      if (r.error) throw r.error;
    }
    status("Đã lưu");
  } catch (e) {
    const m = String(e.message || e);
    status(/free_photo_limit|free photo limit/.test(m) ? `Bản miễn phí chỉ lưu được ${FREE.photos} ảnh mỗi album. Xóa bớt ảnh hoặc nhập mã Pro.` : "Chưa lưu được, sẽ thử lại khi bạn sửa tiếp (" + m + ")", true);
  }
  saving = false;
  if (again) save();
}

/* ----- loading ----- */
async function load() {
  const { data: a, error } = await client.from("albums").select("*").eq("id", albumId).single();
  if (error || !a) { document.querySelector(".page").innerHTML = '<div class="empty">Không tìm thấy album này. <a href="/albums.html">Về danh sách album</a></div>'; return false; }
  $("groom").value = a.groom; $("bride").value = a.bride; $("date").value = a.wedding_date || ""; $("msg").value = a.message;
  const set = (name, v) => { const el = document.querySelector(`input[name=${name}][value="${v}"]`); if (el) el.checked = true; };
  set("mode", a.mode); set("style", a.style);
  const s = a.settings || {};
  if (s.sec) $("sec").value = s.sec;
  if (s.every != null) $("every").value = String(s.every);
  if (s.vfmt) $("vfmt").value = s.vfmt;
  if (s.nameFont && SE.NAMEF[s.nameFont]) { $("nameFont").value = s.nameFont; SE.loadName(s.nameFont).then(refresh); }
  if (s.cues) $("cues").value = s.cues;
  $("letB").value = s.letB || ""; $("letG").value = s.letG || "";
  $("fitMusic").checked = s.fit !== false;
  if (s.book) $("bookSize").value = String(s.book);
  if (PhotoBook.LAYOUT[s.bookLay] || s.bookLay === "mix") bookLay = s.bookLay;
  if (s.bookAuto && typeof s.bookAuto === "object") bookAuto = { ...bookAuto, ...s.bookAuto };
  if (s.bookOver && typeof s.bookOver === "object") bookOver = s.bookOver;
  if (Array.isArray(s.bookSwap)) bookSwap = s.bookSwap;
  if (PhotoBook.PATTERN[s.bookPattern]) bookPattern = s.bookPattern;
  if (PhotoBook.TONE[s.bookTone]) bookTone = s.bookTone;
  const v = s.vows || {};
  if (Vows.TPL[v.tpl]) $("vowTpl").value = v.tpl;
  if (Vows.FONTS[v.font]) $("vowFont").value = v.font;
  if (VOW_SIZE[v.size]) $("vowSize").value = v.size;
  $("vowTitle").value = v.title || ""; $("vowG").value = v.groom || ""; $("vowB").value = v.bride || ""; $("vowCover").checked = v.cover !== false;
  syncVowNames();
  $("spread").checked = !!s.spread;
  if (PhotoBook.TYPO[s.bookTypo]) bookTypo = s.bookTypo;
  if (s.bookText && typeof s.bookText === "object") bookText = s.bookText;
  if (PhotoBook.COVER[s.bookCover]) bookCover = s.bookCover;
  tSeed = s.tseed || 0;
  const legacy = s.trans && s.trans !== "auto" && s.trans !== "mix" ? s.trans : null; // single kind chosen before per-photo existed
  document.querySelector(`input[name=tmode][value="${s.tmode || (legacy ? "manual" : "auto")}"]`).checked = true;
  if (s.frame) $("frame").value = s.frame;
  if (s.tfx && (s.tfx === "auto" || SE.TFX[s.tfx])) $("tfx").value = s.tfx;
  if (SE.LOOK[s.look]) $("look").value = s.look;
  $("chap").value = s.chap || ""; $("subs").value = s.subs || "";
  $("shuffle").checked = !!s.shuffle; $("cap").checked = s.cap !== false; $("stageMusic").checked = !!s.stageMusic;
  
  const [{ data: ps }, { data: ts }] = await Promise.all([
    client.from("album_photos").select("*").eq("album_id", albumId).order("position"),
    client.from("album_tracks").select("*").eq("album_id", albumId).order("position"),
  ]);
  const paths = [...(ps || []).map((p) => p.path), ...(ts || []).map((t) => t.path)];
  const signed = paths.length ? (await client.storage.from("media").createSignedUrls(paths, 86400)).data || [] : [];
  const url = Object.fromEntries(signed.map((x) => [x.path, x.signedUrl]));

  if (ps && ps.length) {
    $("photoHint").textContent = "Đang tải " + ps.length + " ảnh...";
    const loaded = await Promise.all(ps.map(async (p) => {
      try {
        const im = new Image(); im.crossOrigin = "anonymous"; im.src = url[p.path]; await im.decode();
        return { id: p.id, path: p.path, thumb: url[p.path], ph: SE.prep(im), name: "Ảnh " + (p.position + 1) };
      } catch { return null; }
    }));
    photos = loaded.filter(Boolean);
    const fm = s.focus || {}; for (const p of photos) if (fm[p.path]) SE.focus(p.ph, fm[p.path][0], fm[p.path][1]);
    const pt = s.ptrans || {}; for (const p of photos) { if (pt[p.path]) p.tr = pt[p.path]; else if (legacy) p.tr = legacy; }
    const pl = s.plook || {}; for (const p of photos) if (pl[p.path] && (pl[p.path] === "none" || SE.LOOK[pl[p.path]])) p.look = pl[p.path];
  } else {
    for (let i = 0; i < 6; i++) photos.push(sample(i));
  }
  tracks = (ts || []).map((t) => ({ id: t.id, path: t.path, name: t.name, url: url[t.path] }));
  return true;
}

/* ----- photos UI ----- */
function renderPhotos() {
  const grid = $("grid"); grid.innerHTML = "";
  photos.forEach((p, i) => {
    const d = document.createElement("div"); d.className = "thumb";
    d.innerHTML = `<img alt="" src="${p.thumb}"><span class="n">${i + 1}</span><div class="tools"><button data-a="f" aria-label="Chỉnh vùng cắt ảnh">✥</button><button data-a="c" aria-label="Tạo ảnh chibi từ ảnh này">✨</button><button data-a="x" aria-label="Xóa ảnh">✕</button></div>`;
    d.photo = p;
    const im = d.querySelector("img"); im.alt = p.name; im.title = "Bấm để chỉnh vùng cắt";
    im.style.objectPosition = `${(p.ph.fx ?? .5) * 100}% ${(p.ph.fy ?? .5) * 100}%`; im.draggable = false;
    im.onclick = () => { if (!dragJustEnded) openCrop(p); };
    dragSort(d);
    d.querySelectorAll("button").forEach((b) => b.onclick = () => {
      const a = b.dataset.a;
      if (a === "c") return chibiPick(p);
      if (a === "f") return openCrop(p);
      if (a === "x") { if (p.path) removed.photos.push(p); else if (!p.sample && p.thumb.startsWith("blob:")) URL.revokeObjectURL(p.thumb); photos.splice(i, 1); }
      renderPhotos(); refresh(); changed();
    });
    grid.appendChild(d);
  });
  $("count").textContent = photos.length + " ảnh";
  $("photoHint").textContent = photos.some((p) => p.sample) ? "Đang có ảnh mẫu. Thêm ảnh của bạn là ảnh mẫu tự biến mất. Kéo thả ảnh vào khung cũng được." : "Giữ chuột (hoặc giữ ngón tay) rồi kéo ảnh để đổi thứ tự, ✕ để xóa. Kéo thả thêm ảnh vào khung.";
}
/* Reorder by dragging a thumbnail. Mouse: drag past a few pixels. Touch: hold briefly first so the page can still scroll. */
let drag = null, dragJustEnded = false;
function dragSort(el) {
  el.addEventListener("pointerdown", (e) => {
    if (e.button || e.target.closest("button") || drag) return;
    const st = { el, id: e.pointerId, x: e.clientX, y: e.clientY, on: false, touch: e.pointerType !== "mouse" };
    drag = st;
    if (st.touch) st.timer = setTimeout(() => begin(st), 260);
  });
}
function begin(st) {
  st.on = true; const r = st.el.getBoundingClientRect();
  st.dx = st.x - r.left; st.dy = st.y - r.top;
  st.ghost = st.el.cloneNode(true); st.ghost.className = "thumb ghost"; st.ghost.style.width = r.width + "px";
  document.body.appendChild(st.ghost); st.el.classList.add("lifting"); place(st, st.x, st.y);
  navigator.vibrate?.(15);
}
function place(st, x, y) {
  st.ghost.style.transform = `translate(${x - st.dx}px,${y - st.dy}px) rotate(-2deg)`;
  const grid = $("grid"), over = document.elementFromPoint(x, y)?.closest("#grid .thumb");
  if (!over || over === st.el) return;
  const r = over.getBoundingClientRect(), after = x > r.left + r.width / 2;
  grid.insertBefore(st.el, after ? over.nextSibling : over);
}
addEventListener("pointermove", (e) => {
  const st = drag; if (!st || e.pointerId !== st.id) return;
  if (!st.on) {
    if (Math.hypot(e.clientX - st.x, e.clientY - st.y) < 6) return;
    if (st.touch) { clearTimeout(st.timer); drag = null; return; } // a swipe: let the page scroll
    begin(st);
  }
  e.preventDefault(); place(st, e.clientX, e.clientY);
}, { passive: false });
addEventListener("touchmove", (e) => { if (drag?.on) e.preventDefault(); }, { passive: false });
const endDrag = (e) => {
  const st = drag; if (!st || e.pointerId !== st.id) return;
  clearTimeout(st.timer); drag = null; if (!st.on) return;
  st.ghost.remove(); st.el.classList.remove("lifting");
  dragJustEnded = true; setTimeout(() => dragJustEnded = false, 50);
  const order = [...$("grid").children].map((d) => d.photo);
  if (order.some((p, i) => p !== photos[i])) { photos = order; renderPhotos(); refresh(); changed(); }
};
addEventListener("pointerup", endDrag); addEventListener("pointercancel", endDrag);

async function addFiles(files) {
  let imgs = [...files].filter((f) => f.type.startsWith("image/")); if (!imgs.length) return;
  let cut = 0;
  if (!plan.pro) { const room = Math.max(0, FREE.photos - photos.filter((p) => !p.sample).length); cut = Math.max(0, imgs.length - room); }
  // Order by capture time when every photo has it (phones and cameras mixed), otherwise by file name.
  const when = new Map(await Promise.all(imgs.map(async (f) => [f, await PhotoBook.takenAt(f)])));
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
  imgs.sort(imgs.every((f) => when.get(f)) ? (a, b) => when.get(a) - when.get(b) || byName(a, b) : byName);
  if (cut) imgs = imgs.slice(0, imgs.length - cut);
  if (!imgs.length) return renderPhotos(), $("photoHint").innerHTML = `Bản miễn phí tối đa ${FREE.photos} ảnh. <a href="/albums.html#pro">Nhập mã Pro</a> để thêm không giới hạn.`;
  $("photoHint").textContent = "Đang xử lý " + imgs.length + " ảnh...";
  const added = [];
  for (const f of imgs) {
    const u = URL.createObjectURL(f);
    try { const im = new Image(); im.src = u; await im.decode(); added.push({ thumb: u, ph: SE.prep(im), name: f.name }); } catch { URL.revokeObjectURL(u); }
  }
  if (added.length) photos = photos.filter((p) => !p.sample).concat(added);
  renderPhotos(); refresh(); changed();
  if (cut) $("photoHint").innerHTML = `Bản miễn phí tối đa ${FREE.photos} ảnh nên ${cut} ảnh cuối chưa được thêm. <a href="/albums.html#pro">Nhập mã Pro</a> để thêm không giới hạn.`;
}
$("photoInput").onchange = (e) => { addFiles(e.target.files); e.target.value = ""; };
const drop = $("drop");
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

/* ----- music UI ----- */
function renderTracks() {
  const ul = $("tracks"); ul.innerHTML = "";
  tracks.forEach((t, i) => {
    const li = document.createElement("li"); li.innerHTML = `<span></span><button aria-label="Bỏ bài này">✕</button>`;
    li.querySelector("span").textContent = (i + 1) + ". " + t.name;
    li.querySelector("button").onclick = () => { if (t.path) removed.tracks.push(t); else URL.revokeObjectURL(t.url); tracks.splice(i, 1); renderTracks(); refresh(); changed(); };
    ul.appendChild(li);
  });
  $("musicHint").hidden = !!tracks.length;
  analyzeAll();
}
$("musicInput").onchange = (e) => {
  [...e.target.files].filter((f) => f.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|aac)$/i.test(f.name))
    .forEach((f) => tracks.push({ name: f.name.replace(/\.[^.]+$/, ""), url: URL.createObjectURL(f), file: f }));
  e.target.value = ""; renderTracks(); refresh(); changed();
};
async function trackFile(t) { if (!t.file) t.file = await (await fetch(t.url)).blob(); return t.file; }

/* ----- settings ----- */
const val = (n) => (document.querySelector(`input[name=${n}]:checked`) || {}).value;
function info() {
  const g = ($("groom").value.trim() || "Chú rể").normalize("NFC"), b = ($("bride").value.trim() || "Cô dâu").normalize("NFC");
  return { groom: g, bride: b, names: g + " & " + b, nameFont: $("nameFont").value, date: fmtDate($("date").value), msg: $("msg").value.trim().normalize("NFC"), cap: $("cap").checked, letters: letters(g, b) };
}
// Love letters, only in the "Thư tình" template; an empty box drops its page.
const LETTER_STYLES = ["editorial"];
function letters(g, b) {
  if (!LETTER_STYLES.includes(val("style"))) return [];
  return [{ head: "Gửi em", sub: "Người anh thương", text: $("letB").value, sign: g, side: true }, { head: "Gửi anh", sub: "Người em thương", text: $("letG").value, sign: b, side: false }]
    .map((l) => ({ ...l, text: l.text.trim().normalize("NFC") })).filter((l) => l.text);
}
// Each letter stays long enough to be read as it is typed out.
const letterDur = () => letters("", "").map((l) => Math.min(24, Math.max(10, l.text.length / 22 + 5)));
/* ----- fit to music: length and beat of each track, measured in the browser ----- */
const ana = new Map(); // url -> Promise<{dur, bpm, beat0}|null>
function analyze(t) {
  if (!ana.has(t.url)) ana.set(t.url, (async () => {
    try {
      const ab = await (await trackFile(t)).arrayBuffer();
      const buf = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(ab);
      return { dur: buf.duration, ...beatOf(buf) };
    } catch { return null; }
  })());
  return ana.get(t.url);
}
function beatOf(buf) {
  const sr = buf.sampleRate, fps = 100, hop = Math.round(sr / fps), chs = [];
  for (let c = 0; c < buf.numberOfChannels; c++) chs.push(buf.getChannelData(c));
  const n = Math.floor(chs[0].length / hop), env = new Float32Array(n), on = new Float32Array(n);
  for (let i = 0; i < n; i++) { let e = 0; for (const ch of chs) for (let k = i * hop, end = k + hop; k < end; k++) e += ch[k] * ch[k]; env[i] = Math.log(1 + 1000 * e / hop); }
  for (let i = 1; i < n; i++) on[i] = Math.max(0, env[i] - env[i - 1]);
  // Tempo: autocorrelation of onsets over up to 90 s from the middle of the song, 60-180 BPM.
  const a = Math.max(1, Math.floor(n / 2 - 45 * fps)), b = Math.min(n, a + 90 * fps);
  let mean = 0; for (let i = a; i < b; i++) mean += on[i]; mean /= Math.max(1, b - a);
  const score = (lag) => { let s = 0; for (let i = a; i + lag < b; i++) s += (on[i] - mean) * (on[i + lag] - mean); return s / (b - a - lag); };
  let best = 0, bestS = -Infinity, sc = {};
  for (let lag = Math.floor(fps * 60 / 180); lag <= Math.ceil(fps * 60 / 60); lag++) {
    const bpm = 60 * fps / lag, w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 100), 2));
    sc[lag] = score(lag); if (sc[lag] * w > bestS) { bestS = sc[lag] * w; best = lag; }
  }
  if (!best || !(bestS > 0)) return { bpm: 0, beat0: 0 };
  const y0 = sc[best - 1] ?? sc[best], y2 = sc[best + 1] ?? sc[best], d = y0 - 2 * sc[best] + y2;
  const lag = best + (d < 0 ? 0.5 * (y0 - y2) / d : 0), P = lag;
  // Phase: where the beat grid lines up best within the first 30 s.
  let ph = 0, phS = -1; const lim = Math.min(n, 30 * fps);
  for (let o = 0; o < P; o++) { let s = 0; for (let x = o; x < lim; x += P) s += on[Math.round(x)] || 0; if (s > phS) { phS = s; ph = o; } }
  return { bpm: 60 * fps / lag, beat0: ph / fps };
}
let fitInfo = null; // {dur, bpm, beat0} of the current playlist
async function analyzeAll() {
  if (!tracks.length) { fitInfo = null; return; }
  const key = tracks.map((t) => t.url).join("|");
  const rs = await Promise.all(tracks.map(analyze));
  if (key !== tracks.map((t) => t.url).join("|")) return;
  const ok = rs.filter(Boolean);
  fitInfo = ok.length ? { dur: ok.reduce((s, r) => s + r.dur, 0), bpm: (rs[0] && rs[0].bpm) || 0, beat0: (rs[0] && rs[0].beat0) || 0 } : null;
  refresh();
}
function fitted(mode) {
  const base = +$("sec").value, n = Math.max(1, photos.length);
  if (!$("fitMusic").checked || !fitInfo || mode === "stage") return { sec: base };
  let sec = base;
  if (mode === "video" || mode === "deliver") {
    // Opening max(6,sec) + n photos + 7 s thank-you = length of the music.
    const L = letterDur().reduce((a, x) => a + x, 0), C = LETTER_STYLES.includes(val("style")) ? SE.nCollage(n) : 0;
    const M = fitInfo.dur - L; sec = (M - 13) / (n + C); if (sec >= 6) sec = (M - 7) / (n + 1 + C);
    sec = Math.min(15, Math.max(2.5, sec));
  }
  if (!fitInfo.bpm) return { sec, auto: true };
  let beat = 60 / fitInfo.bpm; while (beat < 0.45) beat *= 2;
  return { sec: Math.max(2, Math.round(sec / beat)) * beat, beat, beat0: fitInfo.beat0, bpm: fitInfo.bpm, auto: true };
}
function cfg(mode = val("mode")) { const f = fitted(mode); return { mark: plan.pro ? "" : MARK, trans: "auto", trs: transList(), frame: $("frame").value, ldur: letterDur(), collage: LETTER_STYLES.includes(val("style")), sec: f.sec, beat: f.beat || 0, beat0: f.beat0 || 0, every: +$("every").value, shuffle: $("shuffle").checked, cues: $("cues").value.split("\n").map((s) => s.trim().normalize("NFC")).filter(Boolean), ...fxCfg() }; }
// Title template, colour looks (whole slide and per photo), chapter cards keyed by photo index, one subtitle line per photo.
function fxCfg() {
  const chap = {}; for (const l of $("chap").value.split("\n")) { const m = l.match(/^\s*(\d+)\s*[:.)\-]\s*(.+)$/); if (m && +m[1] >= 1) chap[+m[1] - 1] = m[2].trim().normalize("NFC"); }
  return { tfx: $("tfx").value, look: $("look").value, looks: photos.map((p) => p.look || ""), chap, subs: $("subs").value.split("\n").map((s) => s.trim().normalize("NFC")) };
}
function lookMap() { const m = {}; for (const p of photos) if (p.path && p.look) m[p.path] = p.look; return m; }
function focusMap() { const m = {}; for (const p of photos) if (p.path && (p.ph.fx !== .5 || p.ph.fy !== .5) && p.ph.fx != null) m[p.path] = [+p.ph.fx.toFixed(3), +p.ph.fy.toFixed(3)]; return m; }
function transMap() { const m = {}; if (val("tmode") === "manual") for (const p of photos) if (p.path && p.tr) m[p.path] = p.tr; return m; }
function readSettings() { return { focus: focusMap(), tmode: val("tmode"), tseed: tSeed, ptrans: transMap(), frame: $("frame").value, tfx: $("tfx").value, look: $("look").value, plook: lookMap(), chap: $("chap").value, subs: $("subs").value, nameFont: $("nameFont").value, book: $("bookSize").value, bookLay, bookTypo, bookCover, bookText, bookAuto, bookOver, bookSwap, bookPattern, bookTone, spread: $("spread").checked, vows: { tpl: $("vowTpl").value, title: $("vowTitle").value, groom: $("vowG").value, bride: $("vowB").value, font: $("vowFont").value, size: $("vowSize").value, cover: $("vowCover").checked }, letB: $("letB").value, letG: $("letG").value, fit: $("fitMusic").checked, sec: +$("sec").value, every: +$("every").value, shuffle: $("shuffle").checked, cues: $("cues").value, vfmt: $("vfmt").value, cap: $("cap").checked, stageMusic: $("stageMusic").checked }; }
function fmtDur(s) { s = Math.round(s); const m = Math.floor(s / 60); return m ? `${m} phút ${s % 60} giây` : `${s} giây`; }

/* ----- live preview ----- */
const pv = $("pv"); let pvEng = null, pvLast = 0, pvHold = false;
function sizePv() { const r = pv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); pv.width = Math.max(320, Math.round(r.width * dpr)); pv.height = Math.max(180, Math.round(r.height * dpr)); }
/* ----- photo book ----- */
let bookPages = [], bookPage = 0, bookSeed = 0, bookLay = "auto", bookTypo = "none", bookCover = "classic", bookText = {};
// Auto Design: photos per page range, wished page count (0 = free), layouts to draw from (empty = all), gutter (% of page side)
let bookAuto = { min: 1, max: 6, pages: 0, pool: [], gut: 2.2 };
// Hand edits on top of the automatic pages: pinned frame per page (first photo index -> template id) and photo swaps (pairs of photo keys).
let bookOver = {}, bookSwap = [], bookPattern = "none", bookTone = "none";
const photoKey = (p, i) => p.path || "i" + i;
// Album part: automatic pages, no titles. Wedding story part: the library's layouts and titles, with the user's own words.
// Prewedding part: the same library, with the templates made for concept shoots.
const isLib = (m) => m === "story" || m === "pre";
const isBook = (m) => m === "album" || isLib(m);
const libKind = () => val("mode") === "pre" ? "pre" : "psc";
const fits = (it) => !it.for || it.for === libKind(); // a layout, typography or cover made for the part in use, or for both
const bookDesign = () => !isLib(val("mode")) ? {} : { layout: bookLay, typo: bookTypo, cover: bookCover, pattern: bookPattern, tone: bookTone, gut: bookAuto.gut / 100, over: bookOver,
  ...(bookLay === "mix" ? { min: bookAuto.min, max: bookAuto.max, pages: bookAuto.pages, pool: bookAuto.pool.length ? bookAuto.pool : Object.keys(LAYOUT).filter((k) => LAYOUT[k].pages && fits(LAYOUT[k])) } : {}) };
// Album page size in cm from the size picker: "20", "25", "30" are square, "30x20" is landscape, "20x30" portrait.
function bookDim(v = $("bookSize").value) { const [w, h] = String(v).split("x").map(Number); return { w, h: h || w, label: h ? `${w} × ${h}` : `${w} × ${w}`, sq: !h }; }
const bookFree = (v = $("bookSize").value) => String(v) === String(FREE.book);
function layoutBook() {
  const d = bookDim(); bookPages = PhotoBook.layout(photos.map((p) => p.ph.ar), bookSeed, d.w / d.h, bookDesign());
  if (isLib(val("mode"))) bookPages.text = bookText;
  // swaps: which photo shows in each slot, starting from the book order
  const idx = new Map(photos.map((p, i) => [photoKey(p, i), i])), show = photos.map((_, i) => i);
  for (const [a, b] of bookSwap) { const ia = idx.get(a), ib = idx.get(b); if (ia == null || ib == null) continue; const pa = show.indexOf(ia), pb = show.indexOf(ib); [show[pa], show[pb]] = [show[pb], show[pa]]; }
  for (const pg of bookPages) { if (pg.type === "cover") pg.photo = show[pg.photo]; if (pg.items) pg.items.forEach((it) => it.photo = show[it.photo]); }
  bookPage = Math.min(bookPage, bookPages.length - 1);
}
const isSpread = () => $("spread").checked;
// Sheets on screen: one page, or a spread (cover alone, then pairs). sheetOf(n) is the sheet holding page n.
const sheets = () => isSpread() ? PhotoBook.spreads(bookPages) : bookPages.map((_, i) => [i]);
const sheetOf = (n) => { const sh = sheets(); return Math.max(0, sh.findIndex((s) => s.includes(n))); };
// Where each page of the sheet sits on the preview canvas.
function sheetRects() {
  const sh = sheets()[sheetOf(bookPage)] || [0];
  if (sh.length === 1 && !isSpread()) return [{ n: sh[0], x: 0, W: pv.width, H: pv.height }];
  const W = pv.width / 2; return sh.length === 1 ? [{ n: sh[0], x: W, W, H: pv.height }] : sh.map((n, k) => ({ n, x: k * W, W, H: pv.height }));
}
function renderBook() {
  if (!isBook(val("mode"))) return;
  const ctx = pv.getContext("2d");
  ctx.clearRect(0, 0, pv.width, pv.height);
  for (const r of sheetRects()) {
    ctx.save(); ctx.translate(r.x, 0); ctx.beginPath(); ctx.rect(0, 0, r.W, r.H); ctx.clip();
    if (r.n == null) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, r.W, r.H); }
    else if (photos.length) PhotoBook.render(ctx, { W: r.W, H: r.H }, bookPages, r.n, photos.map((p) => p.ph), val("style"), info());
    if (isSpread() && r.n === bookPage && sheets()[sheetOf(bookPage)].length > 1) { ctx.strokeStyle = "rgba(139,94,46,.55)"; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, r.W - 3, r.H - 3); }
    ctx.restore();
  }
  if (isSpread()) { ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.fillRect(pv.width / 2 - 1, 0, 2, pv.height); } // fold
  if (drag2 && drag2.to) { const r = drag2.to; ctx.save(); ctx.strokeStyle = "#e0a040"; ctx.lineWidth = 4; ctx.setLineDash([10, 6]); ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.restore(); }
  const pg = bookPages[bookPage], label = !pg ? "" : pg.type === "cover" ? "Bìa" : pg.type === "end" ? "Trang cuối" : "Trang " + bookPage;
  const sh = sheets(), si = sheetOf(bookPage);
  $("pvScene").textContent = "Xem trước · " + label; $("pgNum").textContent = isSpread() ? `Tờ ${si + 1} / ${sh.length}` : (bookPage + 1) + " / " + bookPages.length;
  $("pgPrev").disabled = si <= 0; $("pgNext").disabled = si >= sh.length - 1;
  $("pgFrame").disabled = !(pg && pg.tid && bookPages.pool && frameAlts(pg).length > 1);
  if (isLib(val("mode"))) renderBookText(pg);
}
/* ----- wedding story: write your own words on the page shown ----- */
// Which title slot the page has: "cover" and "end" always, a photo page only when its layout has a title box.
const textKey = (pg) => !pg ? null : pg.type === "cover" ? (bookTypo === "none" ? null : "cover") : pg.type === "end" ? "end" : pg.t && bookTypo !== "none" ? String(pg.ph) : null;
function renderBookText(pg) {
  const key = textKey(pg), has = key != null;
  $("btEdit").hidden = !has;
  if (!has) { $("btLabel").textContent = "Trang này chưa có chữ"; $("btHint").innerHTML = 'Chọn một kiểu chữ trong <a href="#" id="btOpen">Thư viện mẫu → Typo</a>, hoặc chọn layout có ô chữ, là viết chữ được trên trang.'; $("btOpen").onclick = (e) => { e.preventDefault(); openLib("typo"); }; return; }
  const def = PhotoBook.phrase(bookTypo, key), own = bookText[key];
  $("btLabel").textContent = key === "cover" ? "Chữ trên bìa" : key === "end" ? "Chữ trang cuối" : "Chữ trên trang này";
  $("btB").placeholder = key === "end" ? "Lời cảm ơn (để trống thì dùng Lời nhắn)" : "Chữ nhỏ";
  if (document.activeElement !== $("btA")) $("btA").value = own ? own[0] : def[0];
  if (document.activeElement !== $("btB")) $("btB").value = own ? own[1] : def[1];
  $("btHint").textContent = own ? "Đang dùng chữ của bạn. Xóa hết chữ là trang không có chữ." : "Đang dùng chữ mẫu. Gõ vào ô để đổi, có dấu tiếng Việt thoải mái.";
  $("btReset").hidden = !own;
}
const typeText = () => { const key = textKey(bookPages[bookPage]); if (key == null) return; bookText[key] = [$("btA").value.normalize("NFC"), $("btB").value.normalize("NFC")]; bookPages.text = bookText; renderBook(); changed(); };
$("btA").addEventListener("input", typeText); $("btB").addEventListener("input", typeText);
$("btReset").onclick = () => { const key = textKey(bookPages[bookPage]); delete bookText[key]; renderBook(); changed(); };
const goSheet = (d) => { const sh = sheets(), si = Math.min(sh.length - 1, Math.max(0, sheetOf(bookPage) + d)); bookPage = sh[si].find((n) => n != null); renderBook(); };
$("pgPrev").onclick = () => goSheet(-1);
$("pgNext").onclick = () => goSheet(1);
/* ----- hand edits: another frame for one page, drag a photo onto another to swap them ----- */
// Templates from any library layout with as many photos as this page, so the pages after it stay the same.
const frameAlts = (pg) => Object.keys(PhotoBook.LAYOUT).filter((k) => PhotoBook.LAYOUT[k].pages).flatMap((k) => PhotoBook.LAYOUT[k].pages.map((t, i) => [k + ":" + i, t])).filter(([, t]) => t.cells.length === pg.items.length).map(([id]) => id);
$("pgFrame").onclick = () => {
  const pg = bookPages[bookPage]; if (!pg || !pg.tid) return;
  const alts = frameAlts(pg); bookOver[pg.at] = alts[(alts.indexOf(pg.tid) + 1) % alts.length];
  layoutBook(); renderBook(); changed();
};
let drag2 = null;
function hitAt(e) {
  const b = pv.getBoundingClientRect(), x = (e.clientX - b.left) * pv.width / b.width, y = (e.clientY - b.top) * pv.height / b.height;
  for (const r of sheetRects()) {
    if (r.n == null || x < r.x || x > r.x + r.W) continue;
    const c = PhotoBook.hits({ W: r.W, H: r.H }, bookPages, r.n).find((h) => x - r.x >= h.x && x - r.x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
    return { n: r.n, cell: c && { ...c, x: c.x + r.x } };
  }
  return null;
}
pv.addEventListener("pointerdown", (e) => {
  if (!isBook(val("mode"))) return;
  const h = hitAt(e); if (!h) return;
  if (h.n !== bookPage) { bookPage = h.n; renderBook(); }
  if (h.cell) { drag2 = { from: h.cell, to: null, x: e.clientX, y: e.clientY }; pv.setPointerCapture(e.pointerId); }
});
pv.addEventListener("pointermove", (e) => {
  if (!drag2) return; if (Math.hypot(e.clientX - drag2.x, e.clientY - drag2.y) < 6 && !drag2.to) return;
  const h = hitAt(e), to = h && h.cell && h.cell.photo !== drag2.from.photo ? h.cell : null;
  if ((to && to.photo) !== (drag2.to && drag2.to.photo)) { drag2.to = to; renderBook(); }
  pv.style.cursor = "grabbing";
});
const dropSwap = () => {
  const d = drag2; drag2 = null; pv.style.cursor = ""; if (!d) return;
  if (d.to) { bookSwap.push([photoKey(photos[d.from.photo], d.from.photo), photoKey(photos[d.to.photo], d.to.photo)]); layoutBook(); changed(); }
  renderBook();
};
pv.addEventListener("pointerup", dropSwap); pv.addEventListener("pointercancel", dropSwap);
$("pgShuffle").onclick = () => { bookSeed++; bookOver = {}; layoutBook(); renderBook(); refresh(); changed(); };
async function exportBook() {
  if (!photos.length) return fail("Thêm ảnh trước đã nhé.");
  await Promise.all([SE.loadName($("nameFont").value), PhotoBook.fonts()]);
  const d = bookDim();
  $("go").disabled = true; $("vprog").hidden = false; $("vcancel").hidden = true; $("vbar").style.width = "0";
  try {
    const blob = await PhotoBook.pdf(bookPages, photos.map((p) => p.ph), val("style"), info(), { wCm: d.w, hCm: d.h, px: Math.max(d.w, d.h) >= 30 ? 2400 : 2000, mark: plan.pro ? "" : MARK, spread: isSpread(),
      onPage: (i, n) => { $("vbar").style.width = (i / n * 100) + "%"; $("vtxt").textContent = `Đang tạo trang ${i} / ${n}`; } });
    saveFile(blob, slug() + ({ story: "-phong-su-cuoi.pdf", pre: "-prewedding.pdf" }[val("mode")] || "-album.pdf"));
    $("goNote").textContent = `Đã tải album PDF (${(blob.size / 1048576).toFixed(1)} MB, ${bookPages.length} trang ${d.label} cm). Gửi file này cho tiệm in là được.`;
  } catch (e) { fail("Chưa tạo được PDF: " + (e.message || e)); }
  $("vprog").hidden = true; $("vcancel").hidden = false; $("go").disabled = false;
}

function startPreview() {
  const mode = val("mode"), c = cfg();
  $("pvBox").classList.toggle("sq", isBook(mode));
  const bd = bookDim(), k = isBook(mode) && isSpread() ? 2 : 1; $("pvBox").style.aspectRatio = isBook(mode) ? `${bd.w * k} / ${bd.h}` : "";
  $("pvBox").style.maxWidth = isBook(mode) ? `min(100%, ${(70 * k * bd.w / bd.h).toFixed(1)}vh)` : "";
  if (isBook(mode)) { $("pvBox").classList.remove("v"); sizePv(); pvEng = null; layoutBook(); renderBook(); return; }
  if (mode === "vows") { const v = VOW_SIZE[$("vowSize").value]; $("pvBox").classList.remove("v"); $("pvBox").classList.add("sq"); $("pvBox").style.aspectRatio = `${v.w} / ${v.h}`; $("pvBox").style.maxWidth = `min(100%, ${(70 * v.w / v.h).toFixed(1)}vh)`; sizePv(); pvEng = null; renderVows(); return; }
  $("pvBox").classList.toggle("v", mode === "video" && $("vfmt").value === "v"); sizePv();
  const mk = () => SE.build(mode, photos.length, c);
  pvEng = SE.Engine(pv, { style: val("style"), photos: photos.map((p) => p.ph), info: info(), sec: c.sec, mark: c.mark, trans: c.trans, trs: c.trs, frame: c.frame, tfx: c.tfx, subs: c.subs, look: c.look, looks: c.looks, scenes: mk(), auto: true, loop: true, onLoop: mk,
    onScene: (i, sc) => $("pvScene").textContent = "Xem trước · " + sc.name });
  $("pvScene").textContent = "Xem trước · " + pvEng.scene.name;
}
function pvFrame(n) { const dt = Math.min(.1, (n - pvLast) / 1000); pvLast = n; if (pvEng && !pvHold) { pvEng.step(dt); pvEng.render(); } requestAnimationFrame(pvFrame); }
new ResizeObserver(() => { if (pvHold) return; if (pvEng) sizePv(); else if (isBook(val("mode"))) { sizePv(); renderBook(); } else if (val("mode") === "vows") { sizePv(); renderVows(); } }).observe(pv);

/* ----- per-photo transitions: the app picks (auto) or the user edits each photo (manual) ----- */
let tSeed = 0;
const TNAME = { fade: "Mờ dần", white: "Lóe sáng trắng", black: "Tối dần", heart: "Mở trái tim", circle: "Mở vòng tròn", zoom: "Phóng to", slide: "Trượt ngang", up: "Đẩy lên", wipe: "Quét ngang", diag: "Quét chéo", blinds: "Rèm dọc", flip: "Lật ảnh", tiles: "Ô vuông" };
function transList() { const auto = SE.autoTrans(val("style"), photos.length, tSeed); return val("tmode") === "manual" ? photos.map((p, i) => p.tr || freeTr(auto[i], i)) : auto; }
function previewPhoto(i) {
  if (!pvEng) return; const sc = pvEng.scenes, j = sc.findIndex((x) => x.type === "photo" && x.i === i); if (j < 0) return;
  pvHold = false; pvEng.go(j > 0 ? j - 1 : sc.length - 1); pvEng.go(j);
}
function renderTrans() {
  const manual = val("tmode") === "manual", list = transList();
  $("tAuto").hidden = manual; $("tManual").hidden = !manual;
  if (!manual) { const names = [...new Set(list)].map((t) => TNAME[t]); $("tAutoInfo").textContent = list.length ? "Đang dùng: " + names.join(", ") + "." : ""; return; }
  const used = [...new Set(list)].map((t) => TNAME[t]);
  $("tSum").textContent = list.length ? `· ${list.length} ảnh, ${used.length > 3 ? used.slice(0, 3).join(", ") + "..." : used.join(", ")}` : "";
  const ul = $("tList"); ul.innerHTML = "";
  const opts = Object.entries(TNAME).map(([v, t]) => `<option value="${v}">${t}${plan.pro || FREE.trans.includes(v) ? "" : " (Pro)"}</option>`).join("");
  photos.forEach((p, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<img alt=""><span>Ảnh ${i + 1}</span><select aria-label="Hiệu ứng chuyển sang ảnh ${i + 1}">${opts}</select><button type="button" aria-label="Xem thử hiệu ứng ảnh ${i + 1}">▶</button>`;
    li.querySelector("img").src = p.thumb; li.querySelector("img").style.objectPosition = `${(p.ph.fx ?? .5) * 100}% ${(p.ph.fy ?? .5) * 100}%`;
    const sel = li.querySelector("select"); sel.value = list[i];
    sel.onchange = (e) => { e.stopPropagation(); p.tr = sel.value; refresh(); changed(); previewPhoto(i); };
    li.querySelector("button").onclick = () => previewPhoto(i);
    ul.appendChild(li);
  });
}
document.querySelectorAll("input[name=tmode]").forEach((r) => r.addEventListener("change", () => {
  // switching to manual starts from what the app picked, so the user edits the app's version
  if (val("tmode") === "manual") { const auto = SE.autoTrans(val("style"), photos.length, tSeed); photos.forEach((p, i) => { if (!p.tr) p.tr = freeTr(auto[i], i); }); }
}));
$("tShuffle").onclick = () => { tSeed++; refresh(); changed(); if (photos.length) previewPhoto(0); };
$("tAll").querySelectorAll("button").forEach((b) => b.onclick = () => {
  const auto = SE.autoTrans(val("style"), photos.length, tSeed);
  photos.forEach((p, i) => p.tr = b.dataset.v === "app" ? freeTr(auto[i], i) : b.dataset.v); refresh(); changed(); if (photos.length) previewPhoto(0);
});

/* ----- transition and frame pickers (buttons that drive hidden selects) ----- */
function syncPick(id) { const v = $(id).value; document.querySelectorAll(`.pick[data-for-select="${id}"] button`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v))); }
document.querySelectorAll(".pick[data-for-select]").forEach((g) => g.querySelectorAll("button").forEach((b) => b.onclick = () => {
  const id = g.dataset.forSelect; $(id).value = b.dataset.v; syncPick(id); refresh(); changed();
  // name font: show the title card once the font has loaded; frame: move the preview to the first photo
  if (id === "nameFont") return SE.loadName(b.dataset.v).then(() => { refresh(); if (pvEng) { pvHold = false; pvEng.go(0); } });
  if (id === "tfx") return; // the restarted preview opens on the title card
  if (pvEng && photos.length) pvEng.go(1);
}));

/* ----- colour looks: a swatch of the first photo per look, and per-photo overrides ----- */
const LOOKS = [["none", "Màu gốc"], ...Object.entries(SE.LOOK).map(([k, l]) => [k, l.name])];
$("look").innerHTML = LOOKS.map(([k, n]) => `<option value="${k}">${n}</option>`).join("");
let lookSrc = null;
function renderLooks() {
  const src = photos[0] && photos[0].ph.c, box = $("lookPick");
  if (src !== lookSrc || !box.children.length) {
    lookSrc = src; box.innerHTML = "";
    let mini = null;
    if (src) { const k = 150 / Math.max(src.width, src.height); mini = document.createElement("canvas"); mini.width = Math.round(src.width * k); mini.height = Math.round(src.height * k); mini.getContext("2d").drawImage(src, 0, 0, mini.width, mini.height); }
    for (const [k, n] of LOOKS) {
      const b = document.createElement("button"); b.type = "button"; b.dataset.v = k;
      const cv = mini ? (k === "none" ? mini : SE.gradeC(mini, SE.LOOK[k])) : null;
      if (cv) { const im = document.createElement("img"); im.alt = ""; im.src = cv.toDataURL("image/jpeg", .8); b.append(im); }
      b.insertAdjacentHTML("beforeend", `<span></span>${plan.pro || FREE.looks.includes(k) ? "" : '<em class="pro-tag">PRO</em>'}`); b.querySelector("span").textContent = n;
      b.onclick = () => { $("look").value = k; refresh(); changed(); if (pvEng && photos.length) previewPhoto(0); };
      box.append(b);
    }
  }
  box.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === $("look").value)));
  const own = photos.filter((p) => p.look).length;
  $("lookSum").textContent = "· " + $("look").selectedOptions[0].textContent; $("lookPer").textContent = own ? `· ${own} ảnh chỉnh riêng` : "";
  const ul = $("lookList"); ul.innerHTML = "";
  const opts = `<option value="">Theo cả slide</option>` + LOOKS.map(([k, n]) => `<option value="${k}">${n}${plan.pro || FREE.looks.includes(k) ? "" : " (Pro)"}</option>`).join("");
  photos.forEach((p, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<img alt=""><span>Ảnh ${i + 1}</span><select aria-label="Màu của ảnh ${i + 1}">${opts}</select><button type="button" aria-label="Xem ảnh ${i + 1}">▶</button>`;
    li.querySelector("img").src = p.thumb; const sel = li.querySelector("select"); sel.value = p.look || "";
    sel.onchange = (e) => { e.stopPropagation(); p.look = sel.value; refresh(); changed(); previewPhoto(i); };
    li.querySelector("button").onclick = () => previewPhoto(i);
    ul.appendChild(li);
  });
  const c = fxCfg(), nc = Object.keys(c.chap).length, ns = c.subs.filter(Boolean).length;
  $("subSum").textContent = nc || ns ? `· ${nc} chương, ${ns} phụ đề` : "";
  $("tfxSum").textContent = "· " + $("tfx").selectedOptions[0].textContent;
}

/* ----- album resource library: layouts, title typography and ready designs, previewed with the user's photos ----- */
const { LAYOUT, TYPO, COVER, PATTERN, TONE, DESIGN } = PhotoBook;
let libTab = "all";
// "Mẫu của tôi": the user's own saved looks, kept in their account (auth user metadata) so every album and device sees them.
let mine = [];
// The part's designs, newest kinds first.
const rank = (d) => (d.tone ? 2 : 0) + (LAYOUT[d.layout].for ? 1 : 0); // luxury sets, then the part's own templates
const designsFor = () => Object.entries(DESIGN).filter(([, d]) => d.kind === libKind()).sort(([, a], [, b]) => rank(b) - rank(a));
const myLooks = () => mine.filter((m) => (m.kind || "psc") === libKind());
const isDesign = (d) => val("style") === d.style && bookLay === d.layout && bookTypo === d.typo && bookCover === d.cover && (d.pattern || "none") === bookPattern && (d.tone || "none") === bookTone;
function libSum() { const d = [...mine, ...Object.values(DESIGN)].find(isDesign); return (d ? d.name + " · " : "") + "Bìa " + COVER[bookCover].name.toLowerCase() + " · " + layName(bookLay) + " · " + TYPO[bookTypo].name + (bookPattern !== "none" ? " · nền " + PATTERN[bookPattern].name.toLowerCase() : "") + (bookTone !== "none" ? " · " + TONE[bookTone].name.toLowerCase() : ""); }
const layName = (id) => id === "mix" ? `Auto Design (${bookAuto.min}–${bookAuto.max} ảnh mỗi trang)` : LAYOUT[id].name;
const designSub = (it) => `Bìa ${COVER[it.cover].name.toLowerCase()} · ${it.layout === "mix" ? "Auto Design" : LAYOUT[it.layout].name} · ${TYPO[it.typo].name}${it.pattern && it.pattern !== "none" ? " · " + PATTERN[it.pattern].name : ""}${it.tone && it.tone !== "none" ? " · " + TONE[it.tone].name : ""}`;
function applyDesign(it) {
  document.querySelector(`input[name=style][value="${it.style}"]`).checked = true;
  bookLay = it.layout; bookTypo = it.typo; bookCover = it.cover; bookPattern = it.pattern || "none"; bookTone = it.tone || "none"; if (it.auto) bookAuto = { ...bookAuto, ...it.auto };
}
// Thumbnail: the first photo page that carries a title (or page 1) of the album as it would look with these choices.
function libThumb(style, lay, typo, cover, coverPage, pattern, tone) {
  const d = bookDim(), w = 300, cv = document.createElement("canvas"); cv.width = w; cv.height = Math.round(w * d.h / d.w);
  if (!photos.length) return cv;
  const pages = PhotoBook.layout(photos.map((p) => p.ph.ar), 0, d.w / d.h, { layout: lay, typo, cover, pattern, tone, min: bookAuto.min, max: bookAuto.max });
  const n = Math.max(1, pages.findIndex((p) => p.t)), i = coverPage ? 0 : pages[n] && pages[n].type === "photos" ? n : 0;
  PhotoBook.render(cv.getContext("2d"), { W: cv.width, H: cv.height }, pages, i, photos.map((p) => p.ph), style, info());
  return cv;
}
function libCard(kind, id, it, on, pro) {
  const b = document.createElement("button"); b.type = "button"; b.className = "lib-item"; b.setAttribute("aria-pressed", String(on)); b.dataset.id = id;
  const look = kind === "design" || kind === "mine", st = look ? it.style : val("style");
  // a typography card needs a layout with title space; a layout card shows its titles with the chosen typography (or a sample one)
  // a colour card needs a page with open background, so it shows the gallery layout with couture titles
  const lay = look ? it.layout : kind === "layout" ? id : kind === "tone" ? "gallery" : bookLay === "auto" ? "strip" : bookLay;
  const ty = look ? it.typo : kind === "typo" ? id : kind === "tone" ? "couture" : bookTypo === "none" ? "mag" : bookTypo;
  const cv = look ? it.cover : kind === "cover" ? id : bookCover, pt = look ? it.pattern || "none" : kind === "pattern" ? id : bookPattern;
  const tn = look ? it.tone || "none" : kind === "tone" ? id : bookTone;
  b.append(libThumb(st, lay, ty, cv, kind === "cover", pt, tn));
  b.insertAdjacentHTML("beforeend", `${it.isNew ? '<em class="new-tag">NEW</em>' : ""}${kind === "mine" ? '<em class="new-tag mine-tag">CỦA TÔI</em><span class="lib-del" role="button" tabindex="0" aria-label="Xóa mẫu này">✕</span>' : ""}${pro ? '<em class="pro-tag">PRO</em>' : ""}<b></b><small></small>`);
  b.querySelector("b").textContent = it.name;
  b.querySelector("small").textContent = look ? designSub(it) : it.desc;
  if (kind === "mine") b.querySelector(".lib-del").onclick = (e) => { e.stopPropagation(); if (confirm(`Xóa mẫu "${it.name}"?`)) { mine = mine.filter((m) => m.id !== it.id); saveMine(); } };
  b.onclick = () => {
    if (look) applyDesign(it);
    else if (kind === "layout") bookLay = id; else if (kind === "cover") bookCover = id; else if (kind === "pattern") bookPattern = id; else if (kind === "tone") bookTone = id; else bookTypo = id;
    bookSeed = 0; if (look || kind === "layout") bookOver = {};
    refresh(); changed(); if (!$("lib").hidden) renderLib();
    bookPage = kind === "cover" ? 0 : Math.min(1, bookPages.length - 1); renderBook();
  };
  return b;
}
function renderLib() {
  const body = $("libBody"); body.innerHTML = "";
  document.querySelectorAll(".lib-tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.t === libTab)));
  const group = (kind, title) => {
    if (libTab !== "all" && libTab !== kind) return;
    if (kind === "mine" && !myLooks().length) { if (libTab === "mine") body.insertAdjacentHTML("beforeend", '<p class="hint">Chưa có mẫu nào. Chỉnh album ưng ý rồi bấm 💾 Lưu làm mẫu của tôi ở mục Thư viện mẫu, lần sau chọn ở đây là xong.</p>'); return; }
    if (libTab === "all") body.insertAdjacentHTML("beforeend", `<h3>${title}</h3>`);
    const g = document.createElement("div"); g.className = "lib-grid";
    const src = kind === "mine" ? Object.fromEntries(myLooks().map((m) => [m.id, m])) : { design: Object.fromEntries(designsFor()), layout: LAYOUT, typo: TYPO, cover: COVER, pattern: PATTERN, tone: TONE }[kind];
    const cur = { layout: bookLay, typo: bookTypo, cover: bookCover, pattern: bookPattern, tone: bookTone }[kind];
    for (const [id, it] of Object.entries(src)) if (kind === "design" ? it.kind === libKind() : kind === "mine" || fits(it))
      g.append(libCard(kind, id, it, kind === "design" || kind === "mine" ? isDesign(it) : cur === id, kind === "design" && !plan.pro && !FREE.styles.includes(it.style)));
    body.append(g);
  };
  group("mine", "Mẫu của tôi"); group("design", "Mẫu thiết kế"); group("cover", "Bìa"); group("layout", "Layout"); group("typo", "Typo"); group("tone", "Bảng màu sang trọng"); group("pattern", "Họa tiết nền");
}
async function openLib(tab) {
  libTab = tab || "all"; $("libTitle").textContent = libKind() === "pre" ? "Thư viện Prewedding" : "Thư viện Phóng sự cưới"; $("lib").hidden = false; renderLib(); $("libX").focus();
  // script and serif fonts come from Google Fonts; draw again once they are in
  await PhotoBook.fonts();
  if (!$("lib").hidden) renderLib();
  renderBook();
}
const closeLib = () => { $("lib").hidden = true; };
document.querySelectorAll(".lib-btn").forEach((b) => b.onclick = () => openLib(b.dataset.lib));
/* Ready designs (the user's own first) in a strip on the page; thumbnails drawn again only when the photos, size, names or saved looks change. */
let stripKey = "";
function renderStrip() {
  if (!isLib(val("mode"))) return;
  const all = [...myLooks().map((m) => ["mine", m.id, m]), ...designsFor().map(([id, d]) => ["design", id, d])];
  const key = [libKind(), photos.length, photos[0] && photos[0].thumb, photos.length && photos[photos.length - 1].thumb, $("bookSize").value, info().names, mine.map((m) => m.id).join()].join("|");
  if (key !== stripKey) {
    stripKey = key; const g = $("libStrip"); g.innerHTML = "";
    for (const [kind, id, it] of all) g.append(libCard(kind, id, it, false, kind === "design" && !plan.pro && !FREE.styles.includes(it.style)));
  }
  [...$("libStrip").children].forEach((b, i) => all[i] && b.setAttribute("aria-pressed", String(isDesign(all[i][2]))));
}
async function saveMine() {
  stripKey = ""; renderStrip(); if (!$("lib").hidden) renderLib(); $("libSum").textContent = libSum();
  const { error } = await client.auth.updateUser({ data: { myDesigns: mine } });
  if (error) fail("Chưa lưu được Mẫu của tôi: " + error.message);
}
$("saveMine").onclick = () => {
  const name = (prompt("Đặt tên cho mẫu này:", "Mẫu của tôi " + (mine.length + 1)) || "").trim(); if (!name) return;
  mine.unshift({ id: uid(), kind: libKind(), name: name.slice(0, 40), style: val("style"), layout: bookLay, typo: bookTypo, cover: bookCover, pattern: bookPattern, tone: bookTone, auto: { ...bookAuto } });
  saveMine();
};

/* Auto Design: lay out the whole book from a few choices, like a designer's first pass. */
const autoOpts = (id, list, v) => { $(id).innerHTML = list.map(([k, t]) => `<option value="${k}">${t}</option>`).join(""); $(id).value = String(v); };
function autoDraft() {
  const d = $("autoDesign").value, ds = DESIGN[d], pool = $("autoPool").value;
  let min = +$("autoMin").value, max = +$("autoMax").value; if (min > max) [min, max] = [max, min];
  return { ds, lay: pool === "mix" ? "mix" : pool, a: { min, max, pages: +$("autoTarget").value, pool: [], gut: +$("autoGut").value } };
}
function autoPreview() {
  const { ds, lay, a } = autoDraft(), dm = bookDim();
  const pages = PhotoBook.layout(photos.map((p) => p.ph.ar), 0, dm.w / dm.h, { layout: lay, typo: ds ? ds.typo : bookTypo, min: a.min, max: a.max, pages: a.pages });
  const per = pages.filter((p) => p.type === "photos").map((p) => p.items.length);
  $("autoPages").textContent = per.length; $("autoRange").textContent = per.length ? `${Math.min(...per)} – ${Math.max(...per)}` : "0";
  $("autoGutV").textContent = a.gut ? a.gut + "%" : "sát nhau"; $("autoGo").textContent = `✨ Dàn trang (${pages.length} trang kể cả bìa)`;
}
function openAuto() {
  const n = photos.length; $("autoN").textContent = n;
  autoOpts("autoDesign", [["", "Giữ kiểu đang dùng"], ...Object.entries(DESIGN).filter(([, d]) => d.kind === libKind()).map(([k, d]) => [k, d.name + (plan.pro || FREE.styles.includes(d.style) ? "" : " (Pro)")])], "");
  autoOpts("autoPool", [["mix", "Trộn tất cả (khuyên dùng)"], ...Object.entries(LAYOUT).filter(([, l]) => l.pages && fits(l)).map(([k, l]) => [k, "Chỉ " + l.name])], bookLay === "mix" || !LAYOUT[bookLay] || !LAYOUT[bookLay].pages ? "mix" : bookLay);
  const opts = [[0, "Để app tự chọn"]]; for (let p = Math.max(2, Math.ceil(n / 9)); p <= Math.min(60, n); p++) opts.push([p, p + " trang"]);
  autoOpts("autoTarget", opts, opts.some((o) => o[0] === bookAuto.pages) ? bookAuto.pages : 0);
  const k = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => [x, x + " ảnh"]);
  autoOpts("autoMin", k, bookAuto.min); autoOpts("autoMax", k, bookAuto.max); $("autoGut").value = bookAuto.gut;
  $("auto").hidden = false; autoPreview(); $("autoGo").focus();
}
["autoDesign", "autoPool", "autoTarget", "autoMin", "autoMax", "autoGut"].forEach((id) => $(id).addEventListener("input", autoPreview));
$("autoOpen").onclick = openAuto;
$("autoX").onclick = $("autoCancel").onclick = () => { $("auto").hidden = true; };
$("auto").addEventListener("click", (e) => { if (e.target === $("auto")) $("auto").hidden = true; });
$("autoGo").onclick = () => {
  const { ds, lay, a } = autoDraft();
  if (ds) { document.querySelector(`input[name=style][value="${ds.style}"]`).checked = true; bookTypo = ds.typo; bookCover = ds.cover; bookPattern = ds.pattern || "none"; bookTone = ds.tone || "none"; }
  bookLay = lay; bookAuto = a; bookSeed = 0; bookOver = {}; bookPage = 1; $("auto").hidden = true; refresh(); changed();
};
document.querySelectorAll(".lib-tabs button").forEach((b) => b.onclick = () => { libTab = b.dataset.t; renderLib(); });
$("libX").onclick = closeLib;
$("lib").addEventListener("click", (e) => { if (e.target === $("lib")) closeLib(); });
addEventListener("keydown", (e) => { if (e.key !== "Escape") return; if (!$("lib").hidden) closeLib(); $("auto").hidden = true; });

/* ----- vows: a cover and one card per vow, printed as a PDF ----- */
const VOW_SIZE = { a5: { w: 14.8, h: 21, label: "A5" }, a6: { w: 10.5, h: 14.8, label: "A6" }, "5x7": { w: 12.7, h: 17.8, label: "5 × 7 inch" }, sq: { w: 15, h: 15, label: "vuông 15 cm" } };
let vowCard = "cover";
// Style cards show only their name; the description moves to a tooltip.
document.querySelectorAll("#styles .opt").forEach((o) => { const d = o.querySelector(":scope > span"); if (d) o.title = d.textContent; });
$("vowG").placeholder = Vows.SAMPLE.groom; $("vowB").placeholder = Vows.SAMPLE.bride;
const vowCards = () => ($("vowCover").checked ? ["cover"] : []).concat(["groom", "bride"]);
function vowData() {
  const i = info(), nf = $("nameFont").value;
  return { tpl: $("vowTpl").value, style: val("style"), title: $("vowTitle").value.normalize("NFC"), vows: { groom: $("vowG").value.trim(), bride: $("vowB").value.trim() },
    font: $("vowFont").value, nameF: SE.NAMEF[nf] || null, groom: i.groom, bride: i.bride, date: i.date, mark: plan.pro ? "" : MARK };
}
function renderVows() {
  if (!vowCards().includes(vowCard)) vowCard = vowCards()[0];
  document.querySelectorAll("[data-card]").forEach((b) => { b.hidden = !vowCards().includes(b.dataset.card); b.setAttribute("aria-pressed", String(b.dataset.card === vowCard)); });
  Vows.render(pv.getContext("2d"), { W: pv.width, H: pv.height }, vowCard, vowData());
  $("pvScene").textContent = "Xem trước · " + (vowCard === "cover" ? "Bìa" : Vows.LABEL[vowCard]);
}
document.querySelectorAll("[data-card]").forEach((b) => b.onclick = () => { vowCard = b.dataset.card; renderVows(); });
// The vows part has its own name and date boxes; they edit the album's names and date.
const VOW_SYNC = [["vGroom", "groom"], ["vBride", "bride"], ["vDate", "date"]];
function syncVowNames() { VOW_SYNC.forEach(([a, b]) => $(a).value = $(b).value); }
VOW_SYNC.forEach(([a, b]) => { $(a).addEventListener("input", () => $(b).value = $(a).value); $(b).addEventListener("input", () => $(a).value = $(b).value); });
const vowFile = () => slug().replace("slide-cuoi-", "vows-");
$("vowPng").onclick = async () => {
  await SE.loadName($("nameFont").value);
  const v = VOW_SIZE[$("vowSize").value], k = 2000 / Math.max(v.w, v.h), cv = document.createElement("canvas"); cv.width = Math.round(v.w * k); cv.height = Math.round(v.h * k);
  Vows.render(cv.getContext("2d"), { W: cv.width, H: cv.height }, vowCard, vowData());
  saveFile(await new Promise((ok) => cv.toBlob(ok, "image/png")), `${vowFile()}-${vowCard}.png`);
};
async function exportVows() {
  await Promise.all([SE.loadName($("nameFont").value), PhotoBook.fonts()]);
  const v = VOW_SIZE[$("vowSize").value], cards = vowCards();
  $("go").disabled = true;
  try {
    const blob = await Vows.pdf(cards, vowData(), { wCm: v.w, hCm: v.h, px: 2000 });
    saveFile(blob, vowFile() + ".pdf");
    $("goNote").textContent = `Đã tải thiệp vows PDF (${cards.length} trang ${v.label}). Gửi file này cho tiệm in là được.`;
  } catch (e) { fail("Chưa tạo được PDF: " + (e.message || e)); }
  $("go").disabled = false;
}

/* ----- parts: slide (party / stage / deliver), video, album ----- */
const partOf = (mode) => mode === "video" || mode === "vows" || isBook(mode) ? mode : "slide";
// Each library part opens on one of its own designs when the current look uses templates made for the other part.
function partLook() {
  if (!isLib(val("mode"))) return;
  const plain = libKind() === "pre" && bookLay === "auto" && bookTypo === "none"; // prewedding starts from a magazine look, not plain pages
  if (!plain && (bookLay === "mix" || fits(LAYOUT[bookLay])) && fits(TYPO[bookTypo]) && fits(COVER[bookCover])) return;
  const d = Object.values(DESIGN).find((x) => x.kind === libKind()); applyDesign(d); bookOver = {}; bookSeed = 0;
}
let lastSlide = "party";
function showPart(part) {
  document.querySelectorAll(".parts button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.part === part)));
  document.querySelectorAll("section[data-part]").forEach((sec) => sec.hidden = !sec.dataset.part.split(" ").includes(part));
  let n = 0; document.querySelectorAll(".main section").forEach((sec) => { if (!sec.hidden) { const el = sec.querySelector("h2 .n"); if (el) el.textContent = ++n; } });
  const h = { slide: "Slide Ảnh Cưới", video: "Video Ảnh Cưới", album: "Album Ảnh Cưới", story: "Phóng Sự Cưới", pre: "Album Prewedding", vows: "Vows Cưới" }[part];
  document.querySelector("h1").firstChild.textContent = h + " ";
}
document.querySelectorAll(".parts button").forEach((b) => b.onclick = () => {
  const part = b.dataset.part, cur = val("mode");
  if (partOf(cur) === part) return;
  if (partOf(cur) === "slide") lastSlide = cur;
  const mode = part === "slide" ? lastSlide : part;
  document.querySelector(`input[name=mode][value="${mode}"]`).checked = true;
  showPart(part); partLook(); refresh(); changed();
});

/* ----- mode-dependent action ----- */
const GO = { party: "▶ Bắt đầu chiếu ở tiệc", stage: "▶ Mở màn hình sân khấu", video: "⬇ Xuất video", deliver: "⬇ Tải bộ slide cho khách", album: "⬇ Tải album PDF để in", story: "⬇ Tải phóng sự cưới PDF", pre: "⬇ Tải album prewedding PDF", vows: "⬇ Tải thiệp vows PDF để in" };
function refresh() {
  const mode = val("mode"); document.body.dataset.mode = mode; showPart(partOf(mode));
  document.querySelectorAll("[data-for]").forEach((el) => el.hidden = !el.dataset.for.split(" ").includes(mode));
  syncPick("frame"); syncPick("nameFont"); syncPick("vowTpl"); syncPick("tfx"); renderTrans(); renderLooks();
  $("letters").hidden = !LETTER_STYLES.includes(val("style"));
  const optText = (id) => $(id).selectedOptions[0]?.textContent || "";
  $("frSum").textContent = "· " + optText("frame"); $("nfSum").textContent = "· " + optText("nameFont");
  document.querySelectorAll(".vnfSum").forEach((el) => el.textContent = "· " + (optText("nameFont") === "Theo phong cách" ? "Great Vibes" : optText("nameFont")));
  $("libSum").textContent = libSum(); renderStrip();
  const nm = info().names;
  document.querySelectorAll(".nf-pick button").forEach((b) => { if (b.dataset.v !== "auto") { b.querySelector(".nf-s").textContent = nm; b.title = b.querySelector(".nf-s").title = SE.NAMEF[b.dataset.v][0]; } });
  $("go").textContent = GO[mode]; $("go").disabled = !photos.length && mode !== "stage" && mode !== "vows";
  const c = cfg(), n = photos.length, sc = SE.build(mode === "stage" || mode === "vows" ? "party" : mode, n, c);
  const notes = {
    party: `Một vòng chiếu khoảng ${fmtDur(SE.total(sc))}, chạy lặp lại tới khi bạn thoát. Màn hình tự phóng to, giữ sáng và ẩn chuột.`,
    stage: `${c.cues.length} màn theo chương trình. Bấm → hoặc bút trình chiếu để chuyển, B để che đen. Khung xem trước tự chạy để bạn xem từng màn.`,
    video: `Video dài khoảng ${fmtDur(SE.total(sc))}. Video dựng theo thời gian thật nên mất đúng chừng đó thời gian, giữ tab này mở trong lúc xuất.` + (tracks.length ? "" : " Chưa có nhạc, video sẽ không có tiếng."),
    album: `${n} ảnh, ${PhotoBook.layout(photos.map((p) => p.ph.ar), bookSeed, bookDim().w / bookDim().h, bookDesign()).length} trang ${bookDim().sq ? "vuông " : ""}${bookDim().label} cm. Ảnh xếp theo thời gian chụp, mỗi trang tự dàn 1 đến 4 ảnh. Không ưng thì bấm Đổi bố cục.`,
    story: `Phóng sự cưới ${n} ảnh, ${PhotoBook.layout(photos.map((p) => p.ph.ar), bookSeed, bookDim().w / bookDim().h, bookDesign()).length} trang ${bookDim().label} cm. Chọn mẫu trong Thư viện mẫu hoặc bấm Auto Design, rồi gõ chữ của bạn vào ô dưới khung xem trước.`,
    vows: `${vowCards().length} trang thiệp ${VOW_SIZE[$("vowSize").value].label}: ${vowCards().map((k) => k === "cover" ? "bìa" : k === "groom" ? "lời chú rể" : "lời cô dâu").join(", ")}. Tải PDF gửi tiệm in, hoặc tải ảnh PNG từng trang để gửi Zalo.`,
    pre: `Album prewedding ${n} ảnh, ${PhotoBook.layout(photos.map((p) => p.ph.ar), bookSeed, bookDim().w / bookDim().h, bookDesign()).length} trang ${bookDim().label} cm. Mẫu kiểu tạp chí thời trang, ít ảnh mỗi trang, chữ lớn. Chọn mẫu trong Thư viện mẫu rồi gõ chữ của bạn vào ô dưới khung xem trước.`,
    deliver: `Tạo một file .html chứa ${n} ảnh${tracks.length ? `, ${tracks.length} bài nhạc` : ""} và hiệu ứng. Gửi file cho khách qua Zalo, email hoặc USB, khách mở bằng Chrome hay Safari là xem được.`,
  };
  const need = proNeed(mode);
  $("goNote").textContent = need || notes[mode]; $("goNote").classList.toggle("err", !!need);
  showSec(mode);
  $("pvInfo").textContent = mode === "vows" ? VOW_SIZE[$("vowSize").value].label : n + " ảnh" + (tracks.length ? " · " + tracks.length + " bài nhạc" : "");
  const i = info(); $("titleNames").textContent = i.names; document.title = i.names + " · Slide Ảnh Cưới";
  startPreview();
}
function showSec(mode) {
  const f = fitted(mode), whole = (mode === "video" || mode === "deliver") && f.auto;
  $("sec").disabled = whole;
  $("secVal").textContent = (f.auto ? "~" + f.sec.toFixed(1).replace(".0", "") : $("sec").value) + " giây" + (f.auto ? " · khớp nhạc" + (f.bpm ? ` ${Math.round(f.bpm)} BPM` : "") : "");
}
$("sec").addEventListener("input", () => showSec(val("mode")));

function openPlayer(mode) {
  pvHold = true;
  SE.Player({ mode, style: val("style"), photos: photos.map((p) => p.ph), info: info(), cfg: cfg(), tracks: tracks.map((t) => t.url),
    musicOn: mode === "stage" ? $("stageMusic").checked : true, onClose: () => { pvHold = false; sizePv(); } });
}
$("go").onclick = () => { const m = val("mode"); if (proNeed(m)) return fail(proNeed(m)); if (m === "party" || m === "stage") openPlayer(m); else if (m === "video") exportVideo(); else if (isBook(m)) exportBook(); else if (m === "vows") exportVows(); else exportDeliver(); };
$("tryDeliver").onclick = () => openPlayer("deliver");
// Download from the Slide part without switching tabs: an MP4 to send anywhere, or the self-contained .html slideshow.
const busy = (b) => { $("dlVideo").disabled = $("dlHtml").disabled = b; };
$("dlVideo").onclick = () => { const n = proNeed("video"); if (n) return fail(n); exportVideo(); };
$("dlHtml").onclick = () => { const n = proNeed("deliver"); if (n) return fail(n); exportDeliver(); };
function fail(t) { $("goNote").textContent = t; $("goNote").classList.add("err"); }
const slug = () => { const i = info(); return ("slide-cuoi-" + i.groom + "-" + i.bride).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+$/, "").toLowerCase(); };

/* ----- video export ----- */
let cancelRec = null;
function pickMime() { for (const m of ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]) if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; return null; }
async function exportVideo() {
  await SE.loadName($("nameFont").value);
  const mime = pickMime(); if (!mime || !HTMLCanvasElement.prototype.captureStream) return fail("Trình duyệt này không quay được video. Dùng Chrome hoặc Edge trên máy tính nhé.");
  const vertical = $("vfmt").value === "v", long = plan.pro ? 1920 : 1280, short = plan.pro ? 1080 : 720, W = vertical ? short : long, H = vertical ? long : short;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cfg("video"), scenes = SE.build("video", photos.length, c), dur = SE.total(scenes);
  const eng = SE.Engine(cv, { style: val("style"), photos: photos.map((p) => p.ph), info: info(), sec: c.sec, mark: c.mark, trans: c.trans, trs: c.trs, frame: c.frame, tfx: c.tfx, subs: c.subs, look: c.look, looks: c.looks, scenes, auto: true, loop: false });
  eng.render();
  const stream = cv.captureStream(30); let ac = null;
  $("go").disabled = true; busy(true); $("vprog").hidden = false; $("vbar").style.width = "0"; $("vtxt").textContent = "Đang chuẩn bị...";
  if (tracks.length) {
    ac = new AudioContext(); const dest = ac.createMediaStreamDestination(), gain = ac.createGain(); gain.connect(dest);
    const bufs = []; for (const t of tracks) { try { bufs.push(await ac.decodeAudioData(await (await trackFile(t)).arrayBuffer())); } catch {} }
    if (bufs.length) {
      const t0 = ac.currentTime + .25; let at = t0, j = 0;
      while (at < t0 + dur) { const s = ac.createBufferSource(); s.buffer = bufs[j % bufs.length]; s.connect(gain); const off = j === 0 ? Math.min(c.beat0 || 0, s.buffer.duration - 1) : 0; s.start(at, Math.max(0, off)); at += s.buffer.duration - Math.max(0, off); j++; }
      gain.gain.setValueAtTime(0, t0); gain.gain.linearRampToValueAtTime(1, t0 + 1.5); gain.gain.setValueAtTime(1, t0 + Math.max(1.6, dur - 3)); gain.gain.linearRampToValueAtTime(0, t0 + dur);
      stream.addTrack(dest.stream.getAudioTracks()[0]);
    }
  }
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: vertical ? 9e6 : 12e6 }), chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  let cancelled = false; cancelRec = () => { cancelled = true; finish(); };
  pvHold = true; const pctx = pv.getContext("2d"); $("pvBox").classList.toggle("v", vertical); sizePv();
  let iv = 0, t0 = 0, lastE = 0;
  function finish() { clearInterval(iv); if (rec.state !== "inactive") rec.stop(); }
  rec.onstop = () => {
    stream.getTracks().forEach((t) => t.stop()); ac && ac.close(); pvHold = false; $("go").disabled = false; busy(false); $("vprog").hidden = true;
    if (cancelled) { refresh(); return; }
    const ext = mime.startsWith("video/mp4") ? "mp4" : "webm", blob = new Blob(chunks, { type: mime.split(";")[0] });
    saveFile(blob, slug() + (vertical ? "-doc" : "") + "." + ext);
    $("goNote").textContent = "Đã xuất video " + ext.toUpperCase() + " (" + (blob.size / 1048576).toFixed(1) + " MB)." + (ext === "webm" ? " Trình duyệt này chỉ quay được WebM; muốn MP4 thì dùng Chrome bản mới." : "");
    startPreview();
  };
  rec.start(1000); t0 = performance.now();
  iv = setInterval(() => {
    const e = (performance.now() - t0) / 1000; eng.step(e - lastE); lastE = e; eng.render();
    pctx.drawImage(cv, 0, 0, pv.width, pv.height);
    $("vbar").style.width = Math.min(100, e / dur * 100) + "%"; $("vtxt").textContent = "Đang dựng video " + fmtDur(Math.min(e, dur)) + " / " + fmtDur(dur);
    if (e >= dur + .3) finish();
  }, 1000 / 30);
}
$("vcancel").onclick = () => cancelRec && cancelRec();

/* ----- deliverable single-file slideshow ----- */
function jpeg(ph) { const c = ph.c, k = Math.min(1, 1920 / Math.max(c.width, c.height)), o = document.createElement("canvas"); o.width = Math.round(c.width * k); o.height = Math.round(c.height * k); o.getContext("2d").drawImage(c, 0, 0, o.width, o.height); return o.toDataURL("image/jpeg", .86); }
const dataURL = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
let engineSrc = null;
async function exportDeliver() {
  $("go").disabled = true; busy(true); $("goNote").textContent = "Đang đóng gói ảnh và nhạc...";
  try {
    if (!engineSrc) engineSrc = await (await fetch("/js/engine.js")).text();
    const I = info(), data = { style: val("style"), info: I, cfg: cfg("deliver"), photos: photos.map((p) => jpeg(p.ph)), focus: photos.map((p) => [p.ph.fx ?? .5, p.ph.fy ?? .5]), tracks: [] };
    for (const t of tracks) data.tracks.push(await dataURL(await trackFile(t)));
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const fonts = document.querySelector("link[data-fonts]").outerHTML;
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(I.names)} · ${esc(I.date)}</title>
${fonts}
<style>html,body{margin:0;height:100%;background:#000;font-family:"Be Vietnam Pro",system-ui,sans-serif}#bg{position:fixed;inset:0;width:100%;height:100%}#cv{position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:center;padding:0 16px calc(48px + env(safe-area-inset-bottom,0px))}#cv[hidden]{display:none}#go{font:600 17px "Be Vietnam Pro",system-ui,sans-serif;color:#1d150d;background:#f6e7c1;border:0;border-radius:999px;padding:15px 30px;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.45)}#go:disabled{opacity:.6}</style></head>
<body><canvas id="bg"></canvas><div id="cv"><button id="go" disabled>Đang tải ảnh...</button></div>
<script>window.__SLIDE=${JSON.stringify(data).replace(/</g, "\\u003c")}<\/script>
<script>${engineSrc.replace(/<\/script/gi, "<\\/script")}<\/script>
<script>${bootSrc}<\/script></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    saveFile(blob, slug() + ".html");
    $("goNote").textContent = "Đã tải file (" + (blob.size / 1048576).toFixed(1) + " MB). Gửi file .html này cho khách, khách mở bằng trình duyệt là xem được" + (tracks.length ? ", có cả nhạc." : ".");
  } catch (e) { fail("Chưa tạo được file (" + (e.message || "lỗi") + ")."); }
  $("go").disabled = false; busy(false);
}
const bootSrc = `(async function(){
  const D=window.__SLIDE,SE=window.SlideEngine,bg=document.getElementById("bg"),go=document.getElementById("go"),cv=document.getElementById("cv");
  const photos=(await Promise.all(D.photos.map((src,i)=>{const im=new Image();im.src=src;const f=(D.focus||[])[i]||[.5,.5];return im.decode().then(()=>SE.focus(SE.prep(im),f[0],f[1])).catch(()=>null)}))).filter(Boolean);
  await SE.ready;
  let raf=0,last=performance.now(),eng=null;
  function size(){const d=Math.min(2,devicePixelRatio||1);bg.width=innerWidth*d;bg.height=innerHeight*d}
  function idle(){size();const mk=()=>SE.build("deliver",photos.length,D.cfg);eng=SE.Engine(bg,{style:D.style,photos,info:D.info,mark:D.cfg.mark,sec:D.cfg.sec,trans:D.cfg.trans,trs:D.cfg.trs,frame:D.cfg.frame,tfx:D.cfg.tfx,subs:D.cfg.subs,look:D.cfg.look,looks:D.cfg.looks,scenes:mk(),auto:true,loop:true,onLoop:mk});last=performance.now();raf=requestAnimationFrame(f)}
  function f(n){eng.step(Math.min(.1,(n-last)/1000));last=n;eng.render();raf=requestAnimationFrame(f)}
  addEventListener("resize",size);idle();
  go.disabled=false;go.textContent=D.tracks.length?"▶ Xem slide cùng nhạc":"▶ Xem slide";
  go.onclick=()=>{cancelAnimationFrame(raf);cv.hidden=true;SE.Player({mode:"deliver",style:D.style,photos,info:D.info,cfg:D.cfg,tracks:D.tracks,musicOn:true,onClose:()=>{cv.hidden=false;idle()}})};
})();`;

/* ----- AI music finder (server-side, uses the site's own AI key) ----- */
/* ----- crop focus editor ----- */
let cropP = null, cropA = 16 / 9, cropF = [.5, .5];
function openCrop(p) {
  cropP = p; cropF = [p.ph.fx ?? .5, p.ph.fy ?? .5]; $("cropImg").src = p.thumb; $("crop").hidden = false;
  $("cropImg").decode().catch(() => {}).then(() => { drawCrop(); $("cropStage").focus(); });
}
function cropBox() { const img = $("cropImg"), W = img.clientWidth, H = img.clientHeight; let w = W, h = H; if (W / H > cropA) w = H * cropA; else h = W / cropA; return { W, H, w, h }; }
function drawCrop() { const b = cropBox(), win = $("cropWin"); Object.assign(win.style, { width: b.w + "px", height: b.h + "px", left: (b.W - b.w) * cropF[0] + "px", top: (b.H - b.h) * cropF[1] + "px" }); }
function cropAt(x, y) { const b = cropBox(), cl = (v) => Math.max(0, Math.min(1, v)); cropF = [b.W > b.w ? cl((x - b.w / 2) / (b.W - b.w)) : cropF[0], b.H > b.h ? cl((y - b.h / 2) / (b.H - b.h)) : cropF[1]]; drawCrop(); }
(() => {
  const st = $("cropStage"); let down = false;
  const pos = (e) => { const r = st.getBoundingClientRect(); cropAt(e.clientX - r.left, e.clientY - r.top); };
  st.addEventListener("pointerdown", (e) => { down = true; st.setPointerCapture(e.pointerId); pos(e); });
  st.addEventListener("pointermove", (e) => { if (down) pos(e); });
  st.addEventListener("pointerup", () => { down = false; });
  st.addEventListener("keydown", (e) => { const d = { ArrowLeft: [-.04, 0], ArrowRight: [.04, 0], ArrowUp: [0, -.04], ArrowDown: [0, .04] }[e.key]; if (!d) return; e.preventDefault(); cropF = [Math.max(0, Math.min(1, cropF[0] + d[0])), Math.max(0, Math.min(1, cropF[1] + d[1]))]; drawCrop(); });
  $("cropAsp").querySelectorAll("button").forEach((b) => b.onclick = () => { cropA = +b.dataset.a; $("cropAsp").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); drawCrop(); });
  const close = () => { $("crop").hidden = true; cropP = null; };
  $("cropX").onclick = close;
  $("crop").addEventListener("click", (e) => { if (e.target === $("crop")) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("crop").hidden) close(); });
  $("cropReset").onclick = () => { cropF = [.5, .5]; drawCrop(); };
  $("cropOk").onclick = () => { if (cropP) { SE.focus(cropP.ph, cropF[0], cropF[1]); renderPhotos(); refresh(); changed(); } close(); };
  window.addEventListener("resize", () => { if (!$("crop").hidden) drawCrop(); });
})();

/* ----- chibi ----- */
let chPick = null, chStyle = "anime", chBlob = null, chCtl = null;
function chibiPick(p, scroll = true) {
  chPick = p; $("chSrc").src = p.thumb; $("chSrc").hidden = false; $("chSrcEmpty").hidden = true;
  $("chGo").disabled = false; $("chNote").textContent = p.sample ? "Đây là ảnh mẫu, chọn ảnh cưới thật sẽ ra đẹp hơn." : "Chọn kiểu rồi bấm Tạo chibi.";
  if (scroll) $("chibi").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
$("chStyles").querySelectorAll("button").forEach((b) => b.onclick = () => {
  chStyle = b.dataset.s; $("chStyles").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
});
function smallJpeg(c) { const k = Math.min(1, 1024 / Math.max(c.width, c.height)), o = document.createElement("canvas"); o.width = Math.round(c.width * k); o.height = Math.round(c.height * k); o.getContext("2d").drawImage(c, 0, 0, o.width, o.height); return o.toDataURL("image/jpeg", .88); }
$("chGo").onclick = async () => {
  if (!chPick) return;
  chCtl && chCtl.abort(); chCtl = new AbortController();
  $("chGo").disabled = true; $("chAdd").hidden = $("chSave").hidden = true; $("chOut").hidden = true; $("chOutEmpty").hidden = false;
  $("chOutEmpty").textContent = "AI đang vẽ..."; $("chOut").parentElement.classList.add("busy");
  $("chNote").textContent = "Thường mất 10 đến 30 giây.";
  try {
    const { data } = await client.auth.getSession();
    const r = await fetch("/api/chibi", { method: "POST", signal: chCtl.signal,
      headers: { "content-type": "application/json", authorization: "Bearer " + (data.session && data.session.access_token) },
      body: JSON.stringify({ image: smallJpeg(chPick.ph.c), style: chStyle }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.image) {
      chBlob = await (await fetch(j.image)).blob();
      $("chOut").src = j.image; $("chOut").hidden = false; $("chOutEmpty").hidden = true;
      $("chAdd").hidden = $("chSave").hidden = false;
      $("chNote").textContent = `Xong. Thích thì bấm Thêm vào album, chưa ưng thì bấm Tạo chibi lần nữa. Hôm nay đã dùng ${j.used}/${j.limit} lượt AI.`;
    } else {
      $("chOutEmpty").textContent = "Chưa tạo được";
      $("chNote").textContent =
        r.status === 429 ? `Hôm nay bạn đã dùng hết ${j.limit || ""} lượt AI, mai thử lại nhé.${plan.pro ? "" : " Nhập mã Pro ở trang Album của tôi để có thêm lượt."}` :
        r.status === 401 ? "Phiên đăng nhập hết hạn, tải lại trang rồi thử." :
        j.error === "need_billing" ? "Key Gemini miễn phí không được tạo ảnh. Cần bật thanh toán cho key trong Google AI Studio." :
        j.error === "ai_busy" ? "AI đang quá tải, đợi 1-2 phút rồi thử lại nhé." :
        "Chưa tạo được ảnh, thử lại hoặc chọn ảnh khác nhé." + (j.detail ? " (Chi tiết: " + j.detail + ")" : "");
    }
  } catch (e) {
    $("chOutEmpty").textContent = "Chưa tạo được"; $("chNote").textContent = "Chưa kết nối được AI, thử lại sau nhé.";
  }
  $("chOut").parentElement.classList.remove("busy"); $("chGo").disabled = false;
};
$("chAdd").onclick = () => {
  if (!chBlob) return;
  const base = (chPick && chPick.name || "anh").replace(/\.[^.]+$/, "");
  addFiles([new File([chBlob], "chibi-" + base + ".png", { type: chBlob.type || "image/png" })]);
  $("chAdd").hidden = true; $("chNote").textContent = "Đã thêm ảnh chibi vào cuối danh sách ảnh.";
};
$("chSave").onclick = () => chBlob && saveFile(chBlob, "chibi-" + slug() + ".png");

function setupChibi() {
  document.body.classList.add("has-chibi"); $("chibi").hidden = false;
  const first = photos.find((p) => !p.sample); if (first) chibiPick(first, false), $("chNote").textContent = "Chọn kiểu rồi bấm Tạo chibi, hoặc bấm ✨ trên ảnh khác.";
}
function setupAI(enabled) {
  if (!enabled) return;
  $("ai").hidden = false;
  let ctl = null;
  const link = (href, txt) => { const a = document.createElement("a"); a.href = href; a.target = "_blank"; a.rel = "noopener"; a.textContent = txt; return a; };
  async function ask(q) {
    q = q.trim(); if (!q) return $("aiQ").focus();
    ctl && ctl.abort(); ctl = new AbortController();
    $("aiGo").disabled = true; $("aiStop").hidden = false; $("aiNote").textContent = "Đang tìm nhạc..."; $("songs").innerHTML = "";
    try {
      const { data } = await client.auth.getSession();
      const r = await fetch("/api/suggest-music", {
        method: "POST", signal: ctl.signal,
        headers: { "content-type": "application/json", authorization: "Bearer " + (data.session && data.session.access_token) },
        body: JSON.stringify({ query: q, mode: val("mode"), style: val("style"), photos: photos.length }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429) $("aiNote").textContent = `Hôm nay bạn đã dùng hết ${j.limit || ""} lượt tìm nhạc, mai thử lại nhé.${plan.pro ? "" : " Nhập mã Pro ở trang Album của tôi để có thêm lượt."}`;
      else if (r.status === 401) $("aiNote").textContent = "Phiên đăng nhập hết hạn, tải lại trang rồi thử.";
      else if (j.error === "ai_busy") $("aiNote").textContent = "AI miễn phí đang quá tải, đợi 1-2 phút rồi bấm Tìm nhạc lại nhé.";
      else if (!r.ok) $("aiNote").textContent = "AI đang bận, thử lại sau nhé." + (j.detail ? " (Chi tiết: " + j.detail + ")" : "");
      else {
        const ul = $("songs");
        (j.songs || []).forEach((s) => {
          const li = document.createElement("li"), q2 = s.title + " " + s.artist;
          const w = document.createElement("div"); w.className = "when"; w.textContent = s.moment;
          const t = document.createElement("div"); const b = document.createElement("b"); b.textContent = s.title; t.append(b, document.createTextNode(s.artist ? " · " + s.artist : ""));
          const y = document.createElement("div"); y.className = "why"; y.textContent = s.why;
          const l = document.createElement("div"); l.className = "links";
          l.append(link("https://www.youtube.com/results?search_query=" + encodeURIComponent(q2), "▶ Nghe trên YouTube"), link("https://zingmp3.vn/tim-kiem/tat-ca?q=" + encodeURIComponent(q2), "Zing MP3"), link("https://open.spotify.com/search/" + encodeURIComponent(q2), "Spotify"));
          li.append(w, t, y, l); ul.appendChild(li);
        });
        $("aiNote").textContent = (j.songs || []).length ? `AI chỉ gợi ý tên bài, không tải nhạc giúp bạn. Nghe thử qua link, có file MP3 rồi bấm Thêm nhạc. Hôm nay đã dùng ${j.used}/${j.limit} lượt.` : "Chưa tìm được bài nào, thử mô tả khác nhé.";
      }
    } catch (e) {
      $("aiNote").textContent = e.name === "AbortError" ? "Đã dừng." : "Chưa kết nối được AI, thử lại sau nhé.";
    }
    $("aiGo").disabled = false; $("aiStop").hidden = true;
  }
  $("aiGo").onclick = () => ask($("aiQ").value);
  $("aiQ").addEventListener("keydown", (e) => { if (e.key === "Enter") ask($("aiQ").value); });
  $("aiStop").onclick = () => ctl && ctl.abort();
  $("aiChips").querySelectorAll("button").forEach((b) => b.onclick = () => { $("aiQ").value = b.dataset.q; ask(b.dataset.q); });
}

/* ----- boot ----- */
(async () => {
  if (!albumId) return location.replace("/albums.html");
  user = await requireUser();
  client = await sb();
  plan = await myPlan();
  $("planNote").hidden = plan.pro; markPro();
  $("email").textContent = user.email || "";
  mine = Array.isArray(user.user_metadata && user.user_metadata.myDesigns) ? user.user_metadata.myDesigns.filter((m) => m && (LAYOUT[m.layout] || m.layout === "mix")) : [];
  $("out").onclick = signOut;
  fetch("/api/config").then((r) => r.json()).then((c) => { setupAI(c.aiEnabled); if (c.chibiEnabled) setupChibi(); }).catch(() => {});
  if (!(await load())) return;
  if (!plan.pro && !bookFree()) $("bookSize").value = String(FREE.book);
  partLook();
  renderPhotos(); renderTracks();
  document.querySelectorAll(".main input, .main select, .main textarea").forEach((el) => {
    if (el.type === "file" || el.id === "aiQ") return;
    const ev = el.tagName === "TEXTAREA" || el.type === "text" ? "input" : "change";
    el.addEventListener(ev, () => { refresh(); changed(); });
  });
  loading = false;
  status("Đã lưu");
  refresh(); pvLast = performance.now(); requestAnimationFrame(pvFrame);
  SE.ready.then(refresh); PhotoBook.fonts().then(renderBook);
})();
