// Installable app: registers the service worker and shows a "Cài app" button where the browser allows it.
(function () {
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let deferred = null;
  function button() {
    let b = document.getElementById("installApp");
    if (b) return b;
    b = document.createElement("button"); b.id = "installApp"; b.className = "install"; b.textContent = "📲 Cài app";
    const host = document.querySelector(".topbar .who") || document.querySelector(".topbar");
    if (host) host.prepend(b); else { b.classList.add("float"); document.body.appendChild(b); }
    return b;
  }
  function tip(text) {
    let t = document.getElementById("installTip");
    if (!t) { t = document.createElement("div"); t.id = "installTip"; t.className = "install-tip"; t.setAttribute("role", "status"); document.body.appendChild(t); t.onclick = () => t.remove(); }
    t.textContent = text;
  }
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); deferred = e;
    button().onclick = async () => { deferred.prompt(); const r = await deferred.userChoice; if (r.outcome === "accepted") button().remove(); deferred = null; };
  });
  addEventListener("appinstalled", () => { const b = document.getElementById("installApp"); if (b) b.remove(); });
  // Safari has no install prompt: explain the two taps instead.
  if (ios) addEventListener("DOMContentLoaded", () => { button().onclick = () => tip("Trên iPhone, iPad: bấm nút Chia sẻ ⬆ ở dưới Safari, chọn “Thêm vào MH chính”. Bấm vào đây để đóng."); });
  else if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) addEventListener("DOMContentLoaded", () => { button().onclick = () => tip("Trên Safari máy Mac: bấm menu Tệp (File), chọn “Thêm vào Dock”. Bấm vào đây để đóng."); });
})();
