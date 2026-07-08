// PWA: register the service worker and wire the "Install" button.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* offline / unsupported */ });
  });
  // When a NEW service worker (a fresh deploy) takes control of a page that
  // already had one, reload once so the new HTML and JS/CSS load together —
  // otherwise the page keeps running the old cached assets until manual refresh.
  // Guard on an existing controller so a first-ever visit doesn't reload.
  if (navigator.serviceWorker.controller) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }
}

let deferredPrompt = null;
const installBtn = () => document.getElementById("installBtn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();          // stop Chrome's mini-infobar; we drive it ourselves
  deferredPrompt = e;
  const b = installBtn();
  if (b) b.hidden = false;
});

document.addEventListener("click", async (e) => {
  if (e.target.id !== "installBtn") return;
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  const b = installBtn();
  if (b) b.hidden = true;
});

window.addEventListener("appinstalled", () => {
  const b = installBtn();
  if (b) b.hidden = true;
});
