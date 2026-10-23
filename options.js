const DEFAULT_BASE = "";
const $ = (id) => document.getElementById(id);
const OBS_KEYS = ["mode", "obsKey", "obsUrl", "obsFolder"];
function showMode() {
  const obs = $("mode").value === "obsidian";
  $("brainBox").hidden = obs;
  $("obsBox").hidden = !obs;
}
$("mode").onchange = showMode;
chrome.storage.local.get(["token", "base", ...OBS_KEYS]).then((c) => {
  $("token").value = c.token || "";
  $("base").value = c.base || DEFAULT_BASE;
  $("mode").value = c.mode || "brain";
  $("obsKey").value = c.obsKey || "";
  $("obsUrl").value = c.obsUrl || "http://127.0.0.1:27123";
  $("obsFolder").value = c.obsFolder || "Inbox/網頁收藏";
  showMode();
});
async function saveObsidian() {
  let origin;
  try { origin = new URL($("obsUrl").value.trim() || "http://127.0.0.1:27123").origin; } catch { $("msg").textContent = "✗ Obsidian 位址格式唔啱"; return false; }
  const pattern = `${origin}/*`;
  if (!(await chrome.permissions.contains({ origins: [pattern] })) && !(await chrome.permissions.request({ origins: [pattern] }))) {
    $("msg").textContent = "✗ 未授權連去 Obsidian，Chrome 提示要撳「允許」";
    return false;
  }
  await chrome.storage.local.set({ mode: "obsidian", obsKey: $("obsKey").value.trim(), obsUrl: origin, obsFolder: $("obsFolder").value.trim() });
  $("msg").textContent = "已儲存（Obsidian 模式）";
  return true;
}
async function save() {
  if ($("mode").value === "obsidian") return saveObsidian();
  await chrome.storage.local.set({ mode: "brain" });
  const base = ($("base").value.trim() || DEFAULT_BASE).replace(/\/+$/, "");
  if (!base) { $("msg").textContent = "✗ 請填大腦網址"; return false; }
  let origin;
  try { origin = new URL(base).origin; } catch { $("msg").textContent = "✗ 大腦網址格式唔啱（要 https://…）"; return false; }
  const pattern = `${origin}/*`;
  if (!(await chrome.permissions.contains({ origins: [pattern] })) && !(await chrome.permissions.request({ origins: [pattern] }))) {
    $("msg").textContent = "✗ 未授權連去呢個網址，Chrome 提示要撳「允許」";
    return false;
  }
  await chrome.storage.local.set({ token: $("token").value.trim(), base });
  $("msg").textContent = "已儲存（token 只存喺本機 chrome.storage）";
  return true;
}
$("save").onclick = save;
$("test").onclick = async () => {
  if (!(await save())) return;
  if ($("mode").value === "obsidian") {
    try {
      const res = await fetch(`${$("obsUrl").value.trim() || "http://127.0.0.1:27123"}/`, { headers: { Authorization: `Bearer ${$("obsKey").value.trim()}` } });
      const j = await res.json().catch(() => ({}));
      $("msg").textContent = res.ok && j.authenticated ? "✓ Obsidian 連線正常、API Key 正確" : "✗ API Key 錯誤";
    } catch { $("msg").textContent = "✗ 連唔到 Obsidian，請確認已開並啟用 Local REST API（HTTP 27123）"; }
    return;
  }
  try {
    const res = await fetch(`${($("base").value.trim() || DEFAULT_BASE).replace(/\/+$/, "")}/api/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${$("token").value.trim()}` },
      body: "{}",
    });
    $("msg").textContent = res.status === 401 ? "✗ token 錯誤" : "✓ token 正確、連線正常（測試冇新增任何項目）";
  } catch { $("msg").textContent = "✗ 網絡錯誤，連唔到大腦"; }
};
