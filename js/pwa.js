// PWA: register the service worker and wire the "Install" button.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* offline / unsupported */ });
  });
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
