// Shared helpers: Supabase client (config comes from /api/config so no keys live in the repo) and auth guards.
const $ = (id) => document.getElementById(id);

let _sb = null, _cfg = null;
async function config() {
  if (_cfg) return _cfg;
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Không tải được cấu hình máy chủ.");
  return (_cfg = await res.json());
}
async function sb() {
  if (_sb) return _sb;
  const cfg = await config();
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error("Máy chủ chưa cấu hình Supabase (xem README).");
  _sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  return _sb;
}

// Which external logins (google, ...) are switched on in Supabase Auth.
async function enabledProviders() {
  try {
    const cfg = await config();
    const r = await fetch(cfg.supabaseUrl + "/auth/v1/settings", { headers: { apikey: cfg.supabaseAnonKey } });
    return r.ok ? (await r.json()).external || {} : {};
  } catch { return {}; }
}

// Free or Pro (activation code). Until the plan functions are installed in Supabase, everyone is Pro.
const MARK = "Làm bằng Slide Ảnh Cưới";
let _plan = null;
async function myPlan(fresh) {
  if (_plan && !fresh) return _plan;
  try {
    const { data, error } = await (await sb()).rpc("my_plan");
    _plan = error || !data ? { pro: true, missing: true } : data;
  } catch { _plan = { pro: true, missing: true }; }
  return _plan;
}
function fmtTime(v) { return v ? new Date(v).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""; }

// Redirect to the login page when signed out; resolves with the user.
async function requireUser() {
  const client = await sb();
  const { data } = await client.auth.getSession();
  if (!data.session) {
    location.replace("/?next=" + encodeURIComponent(location.pathname + location.search));
    return new Promise(() => {});
  }
  return data.session.user;
}

async function signOut() {
  const client = await sb();
  await client.auth.signOut();
  location.href = "/";
}

function fmtDate(v) {
  if (!v) return "";
  const [y, m, d] = v.split("-");
  return `${d} . ${m} . ${y}`;
}

// Offer a generated file to the user as a normal browser download.
function saveFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
