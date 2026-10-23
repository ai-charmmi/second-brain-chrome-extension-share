export const DEFAULT_BASE = "";

export async function getConfig() {
  const { token = "", base = DEFAULT_BASE } = await chrome.storage.local.get(["token", "base"]);
  return { token: token.trim(), base: (base || DEFAULT_BASE).trim().replace(/\/+$/, "") };
}

const GENERIC_TITLES = /^(facebook|instagram|threads|x|linkedin|tiktok|douyin|抖音|小红书|小紅書|xiaohongshu|youtube|\(\d+\)\s*(facebook|instagram|threads|x|linkedin|tiktok|douyin|抖音|youtube))$/i;

export function buildPayload({ url, title, selection }) {
  const payload = { url };
  const parts = [];
  if (title && !GENERIC_TITLES.test(title.trim())) parts.push(title.trim());
  if (selection && selection.trim()) parts.push(selection.trim());
  if (parts.length) payload.text = parts.join("\n\n").slice(0, 4000);
  return payload;
}

const TRACKING = /^(utm_|fbclid|igshid|igsh|mibextid|gclid|si$|ref$|__cft__|__tn__|s$|t$|pp$|feature$|index$|list$|ab_channel$|trk|lipi|licu|rcm|_r$|_t$|is_from_webapp|sender_device|web_id)/i;

export function normalizeUrl(raw) {
  try {
    const u = new URL(raw.trim());
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    u.hash = "";
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return `${host}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return raw.trim();
  }
}

const CACHE_TTL_MS = 120000;
const MAX_SENT = 2000;

async function readCache() {
  const { sentUrls = {}, urlCache = null } = await chrome.storage.local.get(["sentUrls", "urlCache"]);
  return { sentUrls, urlCache };
}

async function rememberSent(url, info) {
  const { sentUrls, urlCache } = await readCache();
  const key = normalizeUrl(url);
  sentUrls[key] = { title: info.title || "", path: info.path || "", at: Date.now() };
  const keys = Object.keys(sentUrls);
  if (keys.length > MAX_SENT) for (const k of keys.sort((x, y) => sentUrls[x].at - sentUrls[y].at).slice(0, keys.length - MAX_SENT)) delete sentUrls[k];
  const patch = { sentUrls };
  if (urlCache) { urlCache.map[key] = { title: info.title || "", path: info.path || "" }; patch.urlCache = urlCache; }
  await chrome.storage.local.set(patch);
}

async function findExisting(base, token, url) {
  const key = normalizeUrl(url);
  const { sentUrls, urlCache } = await readCache();
  if (sentUrls[key]) return sentUrls[key];
  if (urlCache && urlCache.base === base && Date.now() - urlCache.at < CACHE_TTL_MS) return urlCache.map[key] || null;
  try {
    const res = await fetch(`${base}/api/items`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    const items = Array.isArray(data) ? data : data.items || [];
    const map = {};
    for (const i of items) if (i.sourceUrl) map[normalizeUrl(i.sourceUrl)] = { title: i.title || "", path: i.path || "" };
    await chrome.storage.local.set({ urlCache: { at: Date.now(), base, map } });
    return map[key] || null;
  } catch {
    return null;
  }
}

export async function sendToBrain(input) {
  const { token, base } = await getConfig();
  if (!base) return { ok: false, kind: "config", message: "未設定大腦網址：請喺 extension 設定頁填大腦網址" };
  if (!token) return { ok: false, kind: "token", message: "未設定 token：請喺 extension 設定頁填 DASHBOARD_TOKEN" };
  if (!/^https?:\/\//i.test(input.url || "")) return { ok: false, kind: "url", message: "呢頁唔係一般網址，無法送出" };
  const existing = await findExisting(base, token, input.url);
  if (existing) {
    return { ok: true, duplicate: true, message: `已喺大腦（重複，未再加入）：${existing.title || existing.path}`, path: existing.path };
  }
  let res;
  try {
    res = await fetch(`${base}/api/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(buildPayload(input)),
    });
  } catch {
    return { ok: false, kind: "network", message: "網絡錯誤：連唔到第二大腦，請檢查網絡" };
  }
  if (res.status === 401) return { ok: false, kind: "token", message: "token 錯誤：請喺設定頁重新填 DASHBOARD_TOKEN" };
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok || !data || data.ok === false) {
    return { ok: false, kind: "server", message: `大腦回應錯誤（${res.status}）${data?.error ? "：" + data.error : ""}` };
  }
  if (data.duplicate) {
    return { ok: true, duplicate: true, message: data.pending ? "已喺 INBOX（重複，未再加入）" : "已喺知識庫（重複，未再加入）", path: data.existingArticle };
  }
  await rememberSent(input.url, { title: input.title, path: data.path });
  return { ok: true, message: "已送去 INBOX", path: data.path };
}
