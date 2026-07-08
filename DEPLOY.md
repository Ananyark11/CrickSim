# Deploying CrickSim (GitHub + Vercel)

CrickSim is a **static site** (HTML/CSS/vanilla JS, no backend, no build step, no
secrets). It hosts anywhere static. These are the exact steps to put it on
GitHub (private) and go live on Vercel.

## Security posture (already done)

- **No third-party JavaScript.** GSAP is self-hosted at `js/vendor/gsap.min.js`,
  so the CSP forbids all off-site scripts (`script-src 'self'`).
- **No secrets in the repo.** The game is fully client-side; there are no API
  keys, tokens, or `.env` files. `.gitignore` also blocks `graphify-out/`,
  `.venv/`, `.vercel/`, editor/OS cruft.
- **HTTP security headers** are set in `vercel.json` for every route:
  - `Content-Security-Policy` (locked to self + the Google/Fontshare font hosts)
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (+ CSP
    `frame-ancestors 'none'`) — clickjacking protection
  - `Referrer-Policy`, `Permissions-Policy` (camera/mic/geolocation off),
    `Strict-Transport-Security` (HSTS), `Cross-Origin-Opener-Policy`
- Vercel serves HTTPS automatically.

## Step 1 — put it on GitHub (private)

Open a **new terminal** (so the freshly installed `gh` is on your PATH), then:

```bash
gh auth login          # GitHub.com -> HTTPS -> "Login with a web browser"
cd C:\Users\V\CrickSim
gh repo create cricksim --private --source=. --remote=origin --push
```

That creates a **private** repo `cricksim` under your account and pushes `main`.

## Step 2 — deploy on Vercel

1. Go to https://vercel.com -> **Add New… -> Project -> Import Git Repository**.
2. If prompted, authorize Vercel's GitHub app and **grant access to the
   `cricksim` repo** (private repos need this).
3. Select `cricksim`. Settings:
   - **Framework Preset:** Other
   - **Root Directory:** `./`
   - **Build Command:** (leave empty)
   - **Output Directory:** (leave empty — served from root)
4. Click **Deploy**. You get a live `https://cricksim-*.vercel.app` URL.

Every `git push` to `main` from now on auto-deploys.

## Updating after changes

```bash
cd C:\Users\V\CrickSim
git add -A
git commit -m "describe the change"
git push
```

## Custom domain (optional)

In the Vercel project: **Settings -> Domains -> Add**, then point your DNS as
Vercel instructs. HTTPS + HSTS apply automatically.
