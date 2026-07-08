// Loaded first. Global safety net: if anything throws uncaught, don't die silently
// (blank/frozen screen). Log it and show a dismissible reload banner instead.
(function () {
  var shown = false;
  function banner(msg) {
    if (shown) return;
    shown = true;
    try {
      var b = document.createElement("div");
      b.setAttribute("role", "alert");
      b.style.cssText =
        "position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:13px 16px;" +
        "background:#2a1416;color:#ffd7d0;font:600 14px/1.45 system-ui,-apple-system,sans-serif;" +
        "text-align:center;border-top:1px solid #b0271a;box-shadow:0 -8px 24px rgba(0,0,0,.45)";
      var span = document.createElement("span");
      span.textContent = msg;
      var btn = document.createElement("button");
      btn.textContent = "Reload";
      btn.style.cssText =
        "margin-left:12px;padding:5px 14px;border-radius:999px;border:1px solid #b0271a;" +
        "background:transparent;color:#ffd7d0;font-weight:700;cursor:pointer";
      btn.addEventListener("click", function () { location.reload(); });
      b.appendChild(span);
      b.appendChild(btn);
      (document.body || document.documentElement).appendChild(b);
    } catch (e) { /* last-resort: nothing we can do */ }
  }
  window.addEventListener("error", function (e) {
    console.error("CrickSim error:", (e && (e.error || e.message)) || e);
    banner("CrickSim hit a snag. A reload usually fixes it.");
  });
  window.addEventListener("unhandledrejection", function (e) {
    console.error("CrickSim unhandled rejection:", e && e.reason);
  });
})();
