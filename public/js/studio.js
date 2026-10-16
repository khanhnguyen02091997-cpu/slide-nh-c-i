// Studio page: edit one album, autosave to Supabase, play / export with the shared slide engine.
const SE = window.SlideEngine;
const albumId = new URLSearchParams(location.search).get("album");
let client, user;
let photos = [];   // {id?, path?, thumb, ph, sample?, name, w, h}
let tracks = [];   // {id?, path?, name, url, file?}
const removed = { photos: [], tracks: [] };
let loading = true;

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
    const s = readSettings();
    let r = await client.from("albums").update({
      groom: $("groom").value.trim(), bride: $("bride").value.trim(), wedding_date: $("date").value || null,
      message: $("msg").value.trim(), mode: val("mode"), style: val("style"), settings: s, updated_at: new Date().toISOString(),
    }).eq("id", albumId);
    if (r.error) throw r.error;

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
    status("Chưa lưu được, sẽ thử lại khi bạn sửa tiếp (" + (e.message || e) + ")", true);
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
  if (s.cues) $("cues").value = s.cues;
  $("fitMusic").checked = s.fit !== false;
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
    d.innerHTML = `<img alt="" src="${p.thumb}"><span class="n">${i + 1}</span><div class="tools"><button data-a="l" aria-label="Đưa lên trước">‹</button><button data-a="c" aria-label="Tạo ảnh chibi từ ảnh này">✨</button><button data-a="x" aria-label="Xóa ảnh">✕</button><button data-a="r" aria-label="Đưa ra sau">›</button></div>`;
    d.querySelector("img").alt = p.name;
    d.querySelectorAll("button").forEach((b) => b.onclick = () => {
      const a = b.dataset.a;
      if (a === "c") return chibiPick(p);
      if (a === "x") { if (p.path) removed.photos.push(p); else if (!p.sample && p.thumb.startsWith("blob:")) URL.revokeObjectURL(p.thumb); photos.splice(i, 1); }
      if (a === "l" && i > 0) [photos[i - 1], photos[i]] = [photos[i], photos[i - 1]];
      if (a === "r" && i < photos.length - 1) [photos[i + 1], photos[i]] = [photos[i], photos[i + 1]];
      renderPhotos(); refresh(); changed();
    });
    grid.appendChild(d);
  });
  $("count").textContent = photos.length + " ảnh";
  $("photoHint").textContent = photos.some((p) => p.sample) ? "Đang có ảnh mẫu. Thêm ảnh của bạn là ảnh mẫu tự biến mất. Kéo thả ảnh vào khung cũng được." : "Dùng ‹ › để đổi thứ tự, ✕ để xóa. Kéo thả thêm ảnh vào khung.";
}
async function addFiles(files) {
  const imgs = [...files].filter((f) => f.type.startsWith("image/")); if (!imgs.length) return;
  imgs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  $("photoHint").textContent = "Đang xử lý " + imgs.length + " ảnh...";
  const added = [];
  for (const f of imgs) {
    const u = URL.createObjectURL(f);
    try { const im = new Image(); im.src = u; await im.decode(); added.push({ thumb: u, ph: SE.prep(im), name: f.name }); } catch { URL.revokeObjectURL(u); }
  }
  if (added.length) photos = photos.filter((p) => !p.sample).concat(added);
  renderPhotos(); refresh(); changed();
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
  return { groom: g, bride: b, names: g + " & " + b, date: fmtDate($("date").value), msg: $("msg").value.trim().normalize("NFC"), cap: $("cap").checked };
}
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
    const M = fitInfo.dur; sec = (M - 13) / n; if (sec >= 6) sec = (M - 7) / (n + 1);
    sec = Math.min(15, Math.max(2.5, sec));
  }
  if (!fitInfo.bpm) return { sec, auto: true };
  let beat = 60 / fitInfo.bpm; while (beat < 0.45) beat *= 2;
  return { sec: Math.max(2, Math.round(sec / beat)) * beat, beat, beat0: fitInfo.beat0, bpm: fitInfo.bpm, auto: true };
}
function cfg() { const f = fitted(val("mode")); return { sec: f.sec, beat: f.beat || 0, beat0: f.beat0 || 0, every: +$("every").value, shuffle: $("shuffle").checked, cues: $("cues").value.split("\n").map((s) => s.trim().normalize("NFC")).filter(Boolean) }; }
function readSettings() { return { fit: $("fitMusic").checked, sec: +$("sec").value, every: +$("every").value, shuffle: $("shuffle").checked, cues: $("cues").value, vfmt: $("vfmt").value, cap: $("cap").checked, stageMusic: $("stageMusic").checked }; }
function fmtDur(s) { s = Math.round(s); const m = Math.floor(s / 60); return m ? `${m} phút ${s % 60} giây` : `${s} giây`; }

/* ----- live preview ----- */
const pv = $("pv"); let pvEng = null, pvLast = 0, pvHold = false;
function sizePv() { const r = pv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); pv.width = Math.max(320, Math.round(r.width * dpr)); pv.height = Math.max(180, Math.round(r.height * dpr)); }
function startPreview() {
  const mode = val("mode"), c = cfg();
  $("pvBox").classList.toggle("v", mode === "video" && $("vfmt").value === "v"); sizePv();
  const mk = () => SE.build(mode, photos.length, c);
  pvEng = SE.Engine(pv, { style: val("style"), photos: photos.map((p) => p.ph), info: info(), sec: c.sec, scenes: mk(), auto: true, loop: true, onLoop: mk,
    onScene: (i, sc) => $("pvScene").textContent = "Xem trước · " + sc.name });
  $("pvScene").textContent = "Xem trước · " + pvEng.scene.name;
}
function pvFrame(n) { const dt = Math.min(.1, (n - pvLast) / 1000); pvLast = n; if (pvEng && !pvHold) { pvEng.step(dt); pvEng.render(); } requestAnimationFrame(pvFrame); }
new ResizeObserver(() => { if (pvEng && !pvHold) sizePv(); }).observe(pv);

/* ----- mode-dependent action ----- */
const GO = { party: "▶ Bắt đầu chiếu ở tiệc", stage: "▶ Mở màn hình sân khấu", video: "⬇ Xuất video", deliver: "⬇ Tải bộ slide cho khách" };
function refresh() {
  const mode = val("mode"); document.body.dataset.mode = mode;
  $("go").textContent = GO[mode]; $("go").disabled = !photos.length && mode !== "stage";
  const c = cfg(), n = photos.length, sc = SE.build(mode === "stage" ? "party" : mode, n, c);
  const notes = {
    party: `Một vòng chiếu khoảng ${fmtDur(SE.total(sc))}, chạy lặp lại tới khi bạn thoát. Màn hình tự phóng to, giữ sáng và ẩn chuột.`,
    stage: `${c.cues.length} màn theo chương trình. Bấm → hoặc bút trình chiếu để chuyển, B để che đen. Khung xem trước tự chạy để bạn xem từng màn.`,
    video: `Video dài khoảng ${fmtDur(SE.total(sc))}. Video dựng theo thời gian thật nên mất đúng chừng đó thời gian, giữ tab này mở trong lúc xuất.` + (tracks.length ? "" : " Chưa có nhạc, video sẽ không có tiếng."),
    deliver: `Tạo một file .html chứa ${n} ảnh${tracks.length ? `, ${tracks.length} bài nhạc` : ""} và hiệu ứng. Gửi file cho khách qua Zalo, email hoặc USB, khách mở bằng Chrome hay Safari là xem được.`,
  };
  $("goNote").textContent = notes[mode]; $("goNote").classList.remove("err");
  showSec(mode);
  $("pvInfo").textContent = n + " ảnh" + (tracks.length ? " · " + tracks.length + " bài nhạc" : "");
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
$("go").onclick = () => { const m = val("mode"); if (m === "party" || m === "stage") openPlayer(m); else if (m === "video") exportVideo(); else exportDeliver(); };
$("tryDeliver").onclick = () => openPlayer("deliver");
function fail(t) { $("goNote").textContent = t; $("goNote").classList.add("err"); }
const slug = () => { const i = info(); return ("slide-cuoi-" + i.groom + "-" + i.bride).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+$/, "").toLowerCase(); };

/* ----- video export ----- */
let cancelRec = null;
function pickMime() { for (const m of ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]) if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; return null; }
async function exportVideo() {
  const mime = pickMime(); if (!mime || !HTMLCanvasElement.prototype.captureStream) return fail("Trình duyệt này không quay được video. Dùng Chrome hoặc Edge trên máy tính nhé.");
  const vertical = $("vfmt").value === "v", W = vertical ? 1080 : 1920, H = vertical ? 1920 : 1080;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cfg(), scenes = SE.build("video", photos.length, c), dur = SE.total(scenes);
  const eng = SE.Engine(cv, { style: val("style"), photos: photos.map((p) => p.ph), info: info(), sec: c.sec, scenes, auto: true, loop: false });
  eng.render();
  const stream = cv.captureStream(30); let ac = null;
  $("go").disabled = true; $("vprog").hidden = false; $("vbar").style.width = "0"; $("vtxt").textContent = "Đang chuẩn bị...";
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
    stream.getTracks().forEach((t) => t.stop()); ac && ac.close(); pvHold = false; $("go").disabled = false; $("vprog").hidden = true;
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
  $("go").disabled = true; $("goNote").textContent = "Đang đóng gói ảnh và nhạc...";
  try {
    if (!engineSrc) engineSrc = await (await fetch("/js/engine.js")).text();
    const I = info(), data = { style: val("style"), info: I, cfg: cfg(), photos: photos.map((p) => jpeg(p.ph)), tracks: [] };
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
  $("go").disabled = false;
}
const bootSrc = `(async function(){
  const D=window.__SLIDE,SE=window.SlideEngine,bg=document.getElementById("bg"),go=document.getElementById("go"),cv=document.getElementById("cv");
  const photos=(await Promise.all(D.photos.map(src=>{const im=new Image();im.src=src;return im.decode().then(()=>SE.prep(im)).catch(()=>null)}))).filter(Boolean);
  await SE.ready;
  let raf=0,last=performance.now(),eng=null;
  function size(){const d=Math.min(2,devicePixelRatio||1);bg.width=innerWidth*d;bg.height=innerHeight*d}
  function idle(){size();const mk=()=>SE.build("deliver",photos.length,D.cfg);eng=SE.Engine(bg,{style:D.style,photos,info:D.info,sec:D.cfg.sec,scenes:mk(),auto:true,loop:true,onLoop:mk});last=performance.now();raf=requestAnimationFrame(f)}
  function f(n){eng.step(Math.min(.1,(n-last)/1000));last=n;eng.render();raf=requestAnimationFrame(f)}
  addEventListener("resize",size);idle();
  go.disabled=false;go.textContent=D.tracks.length?"▶ Xem slide cùng nhạc":"▶ Xem slide";
  go.onclick=()=>{cancelAnimationFrame(raf);cv.hidden=true;SE.Player({mode:"deliver",style:D.style,photos,info:D.info,cfg:D.cfg,tracks:D.tracks,musicOn:true,onClose:()=>{cv.hidden=false;idle()}})};
})();`;

/* ----- AI music finder (server-side, uses the site's own AI key) ----- */
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
        r.status === 429 ? `Hôm nay bạn đã dùng hết ${j.limit || ""} lượt AI, mai thử lại nhé.` :
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
      if (r.status === 429) $("aiNote").textContent = `Hôm nay bạn đã dùng hết ${j.limit || ""} lượt tìm nhạc, mai thử lại nhé.`;
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
  $("email").textContent = user.email || "";
  $("out").onclick = signOut;
  fetch("/api/config").then((r) => r.json()).then((c) => { setupAI(c.aiEnabled); if (c.chibiEnabled) setupChibi(); }).catch(() => {});
  if (!(await load())) return;
  renderPhotos(); renderTracks();
  document.querySelectorAll(".main input, .main select, .main textarea").forEach((el) => {
    if (el.type === "file" || el.id === "aiQ") return;
    const ev = el.tagName === "TEXTAREA" || el.type === "text" ? "input" : "change";
    el.addEventListener(ev, () => { refresh(); changed(); });
  });
  loading = false;
  status("Đã lưu");
  refresh(); pvLast = performance.now(); requestAnimationFrame(pvFrame);
  SE.ready.then(refresh);
})();
