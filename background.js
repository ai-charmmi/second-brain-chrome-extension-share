import { sendToBrain } from "./send.js";

const MENU_ID = "send-to-brain";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: "送去第二大腦", contexts: ["page", "selection", "link"] });
});

async function notify(result, tabId) {
  const text = result.ok ? "✓" : "!";
  const color = result.ok ? "#16a34a" : "#dc2626";
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 4000);
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: result.ok ? (result.duplicate ? "第二大腦：重複" : "第二大腦：已送出") : "第二大腦：送出失敗",
    message: result.message,
  });
  if (tabId != null) chrome.tabs.sendMessage(tabId, { type: "brain-result", result }).catch(() => {});
}

async function selectionOf(tabId) {
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: () => String(getSelection() || "") });
    return r?.result || "";
  } catch { return ""; }
}

chrome.action.onClicked.addListener(async (tab) => {
  const selection = await selectionOf(tab.id);
  notify(await sendToBrain({ url: tab.url, title: tab.title, selection }), tab.id);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const url = info.linkUrl || info.pageUrl || tab?.url;
  const title = info.linkUrl ? "" : tab?.title;
  notify(await sendToBrain({ url, title, selection: info.selectionText || "" }), tab?.id);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "send") return;
  sendToBrain({ url: msg.url, title: msg.title, selection: msg.selection }).then((result) => {
    notify(result, null);
    sendResponse(result);
  });
  return true;
});
