/* ===== Flip book: the finished album as a book that turns its pages, as a stand-alone .html file or as video frames ===== */
(function (G) {
"use strict";
const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* A self-contained page: pages are JPEG data URLs (page 0 = cover), ar = page width / height.
   Leaf k carries page 2k on its front and page 2k + 1 on its back, like paper. */
function html({ pages, ar = 1, title = "", sub = "", mark = "" }) {
  const leaves = [];
  for (let k = 0; k * 2 < pages.length; k++) leaves.push([pages[2 * k], pages[2 * k + 1] || ""]);
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%;background:radial-gradient(circle at 50% 40%,#3a312a,#141110);color:#f3ead8;font-family:system-ui,"Segoe UI",sans-serif;overflow:hidden}
header{position:fixed;top:0;left:0;right:0;text-align:center;padding:14px 16px 0}
header b{display:block;font:italic 500 clamp(20px,3.4vw,34px) Georgia,serif;letter-spacing:.02em}header span{font-size:13px;opacity:.7;letter-spacing:.2em;text-transform:uppercase}
.stage{position:absolute;inset:70px 16px 64px;display:grid;place-items:center;perspective:2600px}
.book{position:relative;transition:transform .9s cubic-bezier(.3,.7,.2,1)}
.leaf{position:absolute;top:0;left:50%;width:50%;height:100%;transform-origin:left center;transform-style:preserve-3d;transition:transform 1.1s cubic-bezier(.45,.05,.25,1)}
.leaf.on{transform:rotateY(-180deg)}
.leaf>div{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:#fff center/cover no-repeat;box-shadow:0 10px 30px rgba(0,0,0,.45)}
.leaf>.b{transform:rotateY(180deg)}
.leaf>.f::after,.leaf>.b::after{content:"";position:absolute;inset:0;pointer-events:none}
.leaf>.f::after{background:linear-gradient(90deg,rgba(0,0,0,.18),rgba(0,0,0,0) 8%)}
.leaf>.b::after{background:linear-gradient(270deg,rgba(0,0,0,.18),rgba(0,0,0,0) 8%)}
.leaf>.blank{background:transparent;box-shadow:none}
nav{position:fixed;bottom:12px;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:14px;font-size:14px}
nav button{font:inherit;color:inherit;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:8px 18px;cursor:pointer}
nav button:disabled{opacity:.35;cursor:default}
.mark{position:fixed;right:12px;bottom:14px;font-size:11px;opacity:.55}
</style></head><body>
<header><b>${esc(title)}</b><span>${esc(sub)}</span></header>
<div class="stage" id="stage"><div class="book" id="book">
${leaves.map(([f, b], k) => `<div class="leaf" style="z-index:${leaves.length - k}"><div class="f" style="background-image:url(${f})"></div><div class="b${b ? "" : " blank"}"${b ? ` style="background-image:url(${b})"` : ""}></div></div>`).join("\n")}
</div></div>
<nav><button id="pv" aria-label="Trang trước">‹ Trước</button><span id="pn"></span><button id="nx" aria-label="Trang sau">Sau ›</button></nav>
${mark ? `<div class="mark">${esc(mark)}</div>` : ""}
<script>
const AR=${+ar || 1},L=[...document.querySelectorAll(".leaf")],book=document.getElementById("book");let at=0;
function size(){const s=document.getElementById("stage").getBoundingClientRect();let h=s.height,w=h*AR*2;if(w>s.width){w=s.width;h=w/AR/2}book.style.width=w+"px";book.style.height=h+"px";show()}
function show(){L.forEach((l,k)=>{l.classList.toggle("on",k<at);l.style.zIndex=k<at?k+1:L.length-k});
  const last=${pages.length % 2 === 0};book.style.transform=at===0?"translateX(-25%)":at===L.length&&last?"translateX(25%)":"none";
  document.getElementById("pv").disabled=at===0;document.getElementById("nx").disabled=at===L.length;
  document.getElementById("pn").textContent=at===0?"Bìa":at===L.length?"Hết":"Trang "+(at*2-1)+" – "+Math.min(at*2,${pages.length - 1});}
const go=(d)=>{at=Math.max(0,Math.min(L.length,at+d));show()};
document.getElementById("pv").onclick=()=>go(-1);document.getElementById("nx").onclick=()=>go(1);
document.getElementById("stage").onclick=(e)=>go(e.clientX>innerWidth/2?1:-1);
addEventListener("keydown",(e)=>{if(e.key==="ArrowRight"||e.key===" ")go(1);if(e.key==="ArrowLeft")go(-1)});
let sx=null;addEventListener("touchstart",(e)=>sx=e.touches[0].clientX,{passive:true});addEventListener("touchend",(e)=>{if(sx==null)return;const d=e.changedTouches[0].clientX-sx;if(Math.abs(d)>40)go(d<0?1:-1);sx=null});
addEventListener("resize",size);size();
</script></body></html>`;
}

/* Video frame at second t: pages are canvases; each spread rests HOLD seconds, each page turn takes TURN seconds. */
const HOLD = 2.4, TURN = 1.3;
const duration = (n) => { const L = Math.ceil(n / 2); return (L + 1) * HOLD + L * TURN; };
const ease = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
function frame(ctx, W, H, pages, t, ar = 1, mark = "") {
  const n = pages.length, L = Math.ceil(n / 2), seg = HOLD + TURN, k = Math.min(L, Math.floor(t / seg)), lt = t - k * seg;
  const turning = k < L && lt >= HOLD, e = turning ? ease((lt - HOLD) / TURN) : 0;
  let ph = H * .8, pw = ph * ar; if (pw * 2 > W * .9) { pw = W * .45; ph = pw / ar; }
  // closed at the start (cover centred) and, with an even page count, at the end (last page centred)
  const shift = (s) => s === 0 ? -pw / 2 : s === L && n % 2 === 0 ? pw / 2 : 0;
  const sx = W / 2 + (turning ? shift(k) + (shift(k + 1) - shift(k)) * e : shift(k)), y = (H - ph) / 2;
  const g = ctx.createRadialGradient(W / 2, H * .45, 0, W / 2, H * .45, Math.max(W, H) * .7); g.addColorStop(0, "#3a312a"); g.addColorStop(1, "#141110");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const page = (i, x, w, side) => { // side: 1 right of the spine, -1 left; w < pw while turning
    const p = pages[i]; if (!p || w <= .5) return;
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = ph * .05; ctx.shadowOffsetY = ph * .015; ctx.fillStyle = "#fff";
    const x0 = side > 0 ? x : x - w; ctx.fillRect(x0, y, w, ph); ctx.restore();
    ctx.drawImage(p, x0, y, w, ph);
    const sg = ctx.createLinearGradient(x, 0, x + side * w * .1, 0); sg.addColorStop(0, "rgba(0,0,0,.2)"); sg.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = sg; ctx.fillRect(x0, y, w, ph);
  };
  const shade = (x, w, side, a) => { if (w <= .5) return; ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(side > 0 ? x : x - w, y, w, ph); };
  if (!turning) { page(2 * k - 1, sx, pw, -1); page(2 * k, sx, pw, 1); }
  else {
    page(2 * k - 1, sx, pw, -1); page(2 * k + 2, sx, pw, 1);
    const c = Math.cos(e * Math.PI), w = pw * Math.abs(c);
    if (c > 0) { page(2 * k, sx, w, 1); shade(sx, w, 1, .25 * (1 - c)); } else { page(2 * k + 1, sx, w, -1); shade(sx, w, -1, .25 * (1 + c)); }
  }
  if (mark) { const u = Math.min(W, H) / 1080; ctx.font = `500 ${Math.max(11, 17 * u)}px system-ui,sans-serif`; ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.fillText(mark, W - 22 * u, H - 18 * u); }
}

G.FlipBook = { html, frame, duration };
})(window);
