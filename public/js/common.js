// Shared helpers: Supabase client (config comes from /api/config so no keys live in the repo) and auth guards.
const $ = (id) => document.getElementById(id);

let _sb = null;
async function sb() {
  if (_sb) return _sb;
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Không tải được cấu hình máy chủ.");
  const cfg = await res.json();
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error("Máy chủ chưa cấu hình Supabase (xem README).");
  _sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  return _sb;
}

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
