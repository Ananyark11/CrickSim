# CrickSim

Found your own IPL-style franchise, win a live auction against 9 AI rivals, build your
XI from player-seasons spanning 2010-2026, then simulate a full campaign and chase the
season no team has ever had: a perfect **16-0**.

## Run it

No build step, no dependencies. Any static file server works.

**With Node (recommended):**

```bash
node serve.js
```

Then open http://localhost:4310

**Or** just open `index.html` directly in a browser. Everything is self-contained
(fonts and GSAP are bundled locally), so it works fully offline.

## Progressive Web App (installable, offline)

CrickSim is an installable PWA — on a phone, open the deployed URL and use
"Add to Home Screen"; it launches full-screen with its own icon and runs offline.

- `manifest.webmanifest` — app metadata, icons, standalone/portrait display.
- `sw.js` — service worker: precaches the app shell and runtime-caches assets, so
  after the first online load it works with no signal. **When you change any
  asset, bump `CACHE` in `sw.js`** so clients pick up the new build.
- `js/pwa.js` — registers the service worker and drives the in-app "Install" button.
- Fonts are self-hosted in `css/fonts/` (no third-party requests). To regenerate:
  `node tools/fetch-fonts.mjs`. Icons: `node tools/make-icons.mjs` (needs `npm i sharp`).

Service workers need HTTPS (Vercel provides it) or `localhost`. See `DEPLOY.md`.

## Mobile

Responsive down to ~360px. The auction reflows to a single column; the XI picker
uses a Squad ⇄ XI tab toggle with tap-to-assign (drag-and-drop is desktop-only,
since touchscreens don't fire drag events).

## What's inside

```
CrickSim/
├── index.html        # all 7 screens (landing, setup, auction, squad, season, verdict, history)
├── serve.js          # tiny zero-dependency static server (port 4310)
├── css/
│   └── style.css     # broadcast night-auction design system
└── js/
    ├── data.js       # player-season card pool (ratings, sub-ratings, season stats)
    ├── game.js       # auction AI, valuations, phase-based season sim, playoffs, awards
    └── ui.js         # DOM rendering, GSAP motion, auction flow, mini-game, share card
```

## How to play

1. **Found a franchise** — name, city, colours, and an auction purse (₹50cr up to Unlimited).
2. **The auction** — bid against 9 AI franchises. Use the `+ / -` stepper to compose a
   custom raise, view the full set list, skip sets, or hit **Quick Auction** to auto-build
   a balanced squad within a price band.
3. **Pick your XI** — 15 signed, 11 shirts. Max 4 overseas. Phase ratings preview your
   team's strengths and weak links.
4. **The season** — 14 league games then the playoffs. The sim is phase-based: your
   weakest link caps your ceiling. A perfect season is 16-0.
5. **The verdict** — Orange Cap and Purple Cap top-10s, your best players, a downloadable
   season card, and an emoji result to share. Past seasons are saved locally.

Also on the landing page: a **Take Strike** top-down batting mini-game — time your swing
to middle the ball to the rope.

Built as a fan project. Player ratings are editorial and season-specific.
