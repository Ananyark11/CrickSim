// Generate the social share image (Open Graph / Twitter card) for CrickSim.
// 1200x630 branded card: dark gradient, gold glow, diamond mark, wordmark + tagline.
// Output: icons/og-cover.png
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "icons");
await mkdir(OUT_DIR, { recursive: true });

const W = 1200, H = 630;

// gold diamond mark, matching the nav brand-mark / PWA icons
function diamond(cx, cy, d) {
  const x = cx - d / 2, y = cy - d / 2, r = d * 0.16;
  return `<g transform="rotate(45 ${cx} ${cy})">
    <rect x="${x}" y="${y}" width="${d}" height="${d}" rx="${r}" fill="#E4B454" opacity="0.5" filter="url(#soft)"/>
    <rect x="${x}" y="${y}" width="${d}" height="${d}" rx="${r}" fill="url(#gold)"/>
    <rect x="${x + d * 0.2}" y="${y + d * 0.2}" width="${d * 0.6}" height="${d * 0.6}" rx="${r * 0.6}" fill="none" stroke="rgba(11,14,20,0.35)" stroke-width="${d * 0.03}"/>
  </g>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A0F1A"/><stop offset="1" stop-color="#05070D"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="30%" r="60%"><stop offset="0" stop-color="rgba(228,180,84,0.30)"/><stop offset="1" stop-color="rgba(228,180,84,0)"/></radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6D488"/><stop offset="1" stop-color="#E4B454"/></linearGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  ${diamond(600, 150, 120)}

  <text x="600" y="330" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="104" fill="#F2EFE6" letter-spacing="1">CrickSim</text>

  <text x="600" y="410" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="52" fill="url(#gold)">Sixteen wins. Zero mercy.</text>

  <text x="600" y="480" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="400" font-size="30" fill="rgba(242,239,230,0.72)">Found a franchise. Win the auction. Chase a perfect 16&#8211;0 season.</text>

  <text x="600" y="560" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="24" fill="rgba(242,239,230,0.42)" letter-spacing="3">cricksim.vercel.app</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(path.join(OUT_DIR, "og-cover.png"));
console.log("Wrote icons/og-cover.png (1200x630)");
