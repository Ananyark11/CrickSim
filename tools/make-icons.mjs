// Generate PWA icons from an inline SVG (gold "diamond" mark on dark navy),
// matching CrickSim's nav brand-mark. Outputs PNGs into icons/.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const ICON_DIR = path.join(ROOT, "icons");
await mkdir(ICON_DIR, { recursive: true });

// scale = side length of the (unrotated) gold square as a fraction of 512.
// smaller for maskable so the mark survives a circular/rounded mask.
function svg(scale) {
  const S = 512, c = S / 2, d = S * scale, x = c - d / 2;
  const r = d * 0.16;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A0F1A"/><stop offset="1" stop-color="#05070D"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="44%" r="55%"><stop offset="0" stop-color="rgba(228,180,84,0.38)"/><stop offset="1" stop-color="rgba(228,180,84,0)"/></radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6D488"/><stop offset="1" stop-color="#E4B454"/></linearGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#bg)"/>
  <rect width="${S}" height="${S}" fill="url(#glow)"/>
  <g transform="rotate(45 ${c} ${c})">
    <rect x="${x}" y="${x}" width="${d}" height="${d}" rx="${r}" fill="#E4B454" opacity="0.55" filter="url(#soft)"/>
    <rect x="${x}" y="${x}" width="${d}" height="${d}" rx="${r}" fill="url(#gold)"/>
    <rect x="${x + d * 0.2}" y="${x + d * 0.2}" width="${d * 0.6}" height="${d * 0.6}" rx="${r * 0.6}" fill="none" stroke="rgba(11,14,20,0.35)" stroke-width="${d * 0.03}"/>
  </g>
</svg>`;
}

const regular = Buffer.from(svg(0.46));
const maskable = Buffer.from(svg(0.34));

const jobs = [
  ["icon-192.png", regular, 192],
  ["icon-512.png", regular, 512],
  ["icon-maskable-192.png", maskable, 192],
  ["icon-maskable-512.png", maskable, 512],
  ["apple-touch-icon.png", regular, 180],
  ["favicon-32.png", regular, 32],
];
for (const [name, buf, size] of jobs) {
  await sharp(buf).resize(size, size).png().toFile(path.join(ICON_DIR, name));
}
console.log(`Wrote ${jobs.length} icons to icons/`);
