(() => {
  if (window.top !== window || document.getElementById("brain-send-btn")) return;
  const B = globalThis.Brain;

  const btn = document.createElement("button");
  btn.id = "brain-send-btn";
  btn.textContent = "🧠 送去大腦";
  btn.style.cssText = "position:fixed;right:18px;bottom:90px;z-index:2147483647;padding:10px 14px;border:0;border-radius:999px;background:#4f46e5;color:#fff;font:600 14px/1 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer";
  function postLinkFromViewport() {
    const mid = innerHeight / 2;
    const articles = [...document.querySelectorAll("article, [role=article]")];
    let best = null, bestDist = Infinity;
    for (const a of articles) {
      const r = a.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < bestDist) { best = a; bestDist = d; }
    }
    return best ? B.postLinkIn(best) : null;
  }

  btn.addEventListener("click", async () => {
    const url = B.currentPageLink() || postLinkFromViewport() || location.href;
    btn.disabled = true;
    await B.send({ url, title: document.title, selection: String(getSelection() || "") });
    btn.disabled = false;
  });

  const syncBtn = () => { btn.style.display = (B.site === "fb" && /^\/reel\//.test(location.pathname)) || ((B.site === "x" || B.site === "tt" || B.site === "dy" || B.site === "xhs" || (B.site === "yt" && /^\/shorts\//.test(location.pathname))) && document.querySelector(".brain-post-btn")) ? "none" : ""; };
  syncBtn();
  setInterval(syncBtn, 1000);
  document.body.append(btn);
})();
