const DEFAULT_BASE = "";
const $ = (id) => document.getElementById(id);
chrome.storage.local.get(["token", "base"]).then(({ token = "", base = DEFAULT_BASE }) => {
  $("token").value = token;
  $("base").value = base;
});
async function save() {
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
  try {
    const res = await fetch(`${($("base").value.trim() || DEFAULT_BASE).replace(/\/+$/, "")}/api/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${$("token").value.trim()}` },
      body: "{}",
    });
    $("msg").textContent = res.status === 401 ? "✗ token 錯誤" : "✓ token 正確、連線正常（測試冇新增任何項目）";
  } catch { $("msg").textContent = "✗ 網絡錯誤，連唔到大腦"; }
};
