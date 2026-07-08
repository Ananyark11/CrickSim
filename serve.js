// Minimal static server for CrickSim (no dependencies)
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = 4310;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    let file = path.join(ROOT, path.normalize(urlPath).replace(/^([.][.][\\/])+/, ""));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    // Emulate Vercel cleanUrls: /terms -> /terms.html when the extensionless file is missing
    if (!path.extname(file) && !fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end("Not found"); }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    });
  })
  .listen(PORT, () => console.log(`CrickSim on http://localhost:${PORT}`));
