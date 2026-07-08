// ============================================================
// CrickSim — UI layer (DOM + GSAP + flow control)
// ============================================================

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

// sound removed — these are no-ops so existing call sites stay harmless
function beep() {}
function gavel() {}
function fanfare() {}

// ---------- screen router ----------
let activeScreen = "landing";
function showScreen(name) {
  const cur = document.querySelector(".screen.active");
  const next = $("screen-" + name);
  if (!next || cur === next) return;
  activeScreen = name;
  if (cur) cur.classList.remove("active");
  next.classList.add("active");
  window.scrollTo(0, 0);
  if (window.gsap) {
    gsap.fromTo(next, { opacity: 0, y: 26, filter: "blur(6px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8, ease: "power3.out" });
  }
  if (name === "history") renderHistory();
  if (name === "landing") { playHeroCricket(); window.dispatchEvent(new Event("cricksim:landing")); }
}
document.querySelectorAll("[data-nav]").forEach((b) =>
  b.addEventListener("click", () => {
    const to = b.dataset.nav;
    if (to === "setup") resetToSetup();
    else showScreen(to);
  })
);
$("howBtn").addEventListener("click", () => $("how").scrollIntoView({ behavior: "smooth" }));
$("toTopBtn").addEventListener("click", () => {
  const top = document.querySelector(".hero") || $("screen-landing");
  if (top) top.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  else window.scrollTo(0, 0);
});
$("modeAI").addEventListener("click", () => resetToSetup());

// ---------- landing marquee ----------
(function marquee() {
  const legends = PLAYER_POOL.filter((c) => c.o >= 92).sort((a, b) => b.o - a.o).slice(0, 22);
  const track = $("marqueeTrack");
  const items = legends.concat(legends); // loop
  items.forEach((c) => {
    track.appendChild(el("div", "mq-item",
      `<span class="mq-name">${c.n} &rsquo;${String(c.y).slice(2)}</span><span class="mq-ovr">${c.o}</span>`));
  });
})();

// ---------- setup ----------
let setupColor = TEAM_COLORS[0].v;
let setupPurseVal = 10000; // lakhs; Infinity when slider maxed

function purseFromSlider(v) {
  return v * 100; // 50..300 cr
}
function purseLabel(lakh) { return "₹" + lakh / 100 + "cr"; }
function purseHintFor(lakh) {
  if (lakh <= 6000) return "Brutal. Every crore is a knife fight.";
  if (lakh <= 10000) return "The classic league purse. Balanced.";
  if (lakh <= 20000) return "Comfortable. The rivals will still push you.";
  return "Deep pockets. The max any team can hold is ₹300cr.";
}

function initSetup() {
  const sw = $("swatches");
  sw.innerHTML = "";
  TEAM_COLORS.forEach((c, i) => {
    const b = el("button", "swatch" + (c.v === setupColor ? " sel" : ""));
    b.style.background = `linear-gradient(145deg, ${c.v}, ${shade(c.v, -25)})`;
    b.title = c.name;
    b.addEventListener("click", () => {
      setupColor = c.v;
      sw.querySelectorAll(".swatch").forEach((s) => s.classList.remove("sel"));
      b.classList.add("sel");
      paintPreview();
    });
    sw.appendChild(b);
  });
  const slider = $("purseSlider");
  const syncSlider = () => {
    const v = +slider.value;
    setupPurseVal = purseFromSlider(v);
    const pct = ((v - 50) / (300 - 50)) * 100;
    slider.style.setProperty("--fill", pct + "%");
    paintPreview();
  };
  slider.addEventListener("input", syncSlider);
  syncSlider();
}
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + pct / 100))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function paintPreview() {
  const name = $("teamName").value.trim();
  const city = $("teamCity").value.trim();
  $("previewName").textContent = name || "Your Franchise";
  $("previewCity").textContent = city || "—";
  $("crestInitials").textContent = initials(name);
  $("crestPreview").style.background = `linear-gradient(145deg, ${shade(setupColor, 25)}, ${setupColor})`;
  $("previewPurse").textContent = purseLabel(setupPurseVal);
  $("purseHint").textContent = purseHintFor(setupPurseVal);
  $("startAuctionBtn").disabled = name.length < 2;
}
$("teamName").addEventListener("input", paintPreview);
$("teamCity").addEventListener("input", paintPreview);
initSetup();

// every franchise gets the SAME purse the user chose (₹50cr–₹300cr)
function rivalPurse() {
  return G.user.purse0;
}

function resetToSetup() {
  clearTimeout(aucTimer);
  clearInterval(driftTimer);
  PAUSED = false; SPEED = 1; resumeFn = null;
  showScreen("setup");
}

// ---------- auction ----------
let aucTimer = null;
let userOut = false;
let savedThisSeason = false;
let userBidAmt = 0;      // the user's composed raise (lakhs)
let composing = false;   // true while the user is dialing a custom amount

// speed-aware, pausable scheduler for the auction loop
let PAUSED = false;
let SPEED = 1;              // 1x, 2x, 4x
let resumeFn = null;       // step to replay when unpaused
function schedule(fn, ms) {
  clearTimeout(aucTimer);
  if (PAUSED) { resumeFn = () => schedule(fn, ms); return; }
  aucTimer = setTimeout(() => {
    if (PAUSED) { resumeFn = fn; return; }
    fn();
  }, Math.max(60, ms / SPEED));
}
function pauseAuction() {
  PAUSED = true;
  clearTimeout(aucTimer);
  $("pauseBtn").classList.add("paused");
  $("pauseIco").innerHTML = "&#9654;";
  $("pauseTxt").textContent = "Resume";
  $("bidStatus").innerHTML = "Auction paused. Take your time.";
}
function resumeAuction() {
  if (!PAUSED) return;
  PAUSED = false;
  $("pauseBtn").classList.remove("paused");
  $("pauseIco").innerHTML = "&#10073;&#10073;";
  $("pauseTxt").textContent = "Pause";
  const f = resumeFn; resumeFn = null;
  if (f) f();
}
function resumeIfPaused() {
  if (PAUSED) {
    PAUSED = false; resumeFn = null;
    $("pauseBtn").classList.remove("paused");
    $("pauseIco").innerHTML = "&#10073;&#10073;";
    $("pauseTxt").textContent = "Pause";
  }
}

$("startAuctionBtn").addEventListener("click", () => {
  const name = $("teamName").value.trim();
  const city = $("teamCity").value.trim();
  G.user = { name, city, color: setupColor, purse: setupPurseVal, purse0: setupPurseVal, squad: [], xi: [] };
  G.rivals = RIVALS.map((r) => ({ ...r, purse: rivalPurse(), core: [], buys: [], maxBid: 0 }));
  savedThisSeason = false;
  // skin the app in franchise colour
  document.documentElement.style.setProperty("--accent", setupColor);
  document.documentElement.style.setProperty("--accent-soft", setupColor + "29");
  $("aucCrest").textContent = initials(name);
  $("aucCrest").style.background = setupColor;
  $("aucTeamName").textContent = name;
  buildAuctionPool();
  renderRivalsRail();
  renderSquadDrawer();
  renderSetDots();
  $("logList").innerHTML = "";
  log(`Welcome to the auction, <b>${name}</b>. ${G.flatLots.length} lots tonight. Purse: ${fmtMoney(G.user.purse)}.`);
  showScreen("auction");
  startPitchDrift();
  showCatGate(0, true);   // gate the first category behind a Start click
});
// gate overlay mode: "gate" before a category, "complete" when the auction is over
let aucGateMode = "gate";
// the start-gate overlay, reused before every category
function showCatGate(s, first) {
  aucGateMode = "gate";
  G.gateTarget = s;
  const setName = G.sets[s].name;
  const lots = G.setRanges[s].end - G.setRanges[s].start;
  $("aucBeginEyebrow").textContent = first ? "The room is set" : "Next up";
  $("aucBeginTitle").textContent = first ? "Ready when you are." : setName + " set";
  $("aucBeginNote").innerHTML = first
    ? `Nine franchises are seated and your purse is counted. First up: the <b>${setName}</b> set (${lots} lots). The gavel goes up only when you say so.`
    : `The <b>${setName}</b> set is loaded (${lots} lots). Bidding starts when you are ready.`;
  $("aucBeginLabel").textContent = first ? "Start the auction" : "Start " + setName + " auction";
  $("aucBegin").hidden = false;
}
$("aucBeginBtn").addEventListener("click", () => {
  $("aucBegin").hidden = true;
  if (aucGateMode === "complete") { endAuction(); return; }
  beginSet(G.gateTarget != null ? G.gateTarget : 0);
});
// last category done — celebrate the close and send the user to pick their XI
function showAuctionComplete() {
  G.setRanges[G.curSet].state = "done";
  updateSetUI();
  aucGateMode = "complete";
  const n = G.user.squad.length;
  $("aucBeginEyebrow").textContent = "That's the hammer";
  $("aucBeginTitle").textContent = "Auction complete.";
  $("aucBeginNote").innerHTML = `Every lot is gone. You signed <b>${n}</b> player${n !== 1 ? "s" : ""}${n < SQUAD_CAP ? ` — we'll round your squad to fifteen with uncapped reserves` : ""}. Now the real decision: pick the eleven who take the field.`;
  $("aucBeginLabel").textContent = "Select your XI";
  $("aucBegin").hidden = false;
}
function beginSet(s) {
  G.curSet = s;
  G.setRanges[s].state = "live";
  clearTimeout(aucTimer);
  resumeIfPaused();
  schedule(nextLot, 350);
}
// current category exhausted -> mark done, gate the next one (or finish)
function finishCurrentCategory() {
  G.setRanges[G.curSet].state = "done";
  const next = nextPendingSet(G.curSet);
  if (next >= 0) { updateSetUI(); showCatGate(next); }
  else showAuctionComplete();
}

function renderSetDots() {
  const dots = $("setDots");
  dots.innerHTML = "";
  G.sets.forEach(() => dots.appendChild(el("span", "set-dot")));
}
function currentSetIndex() { return G.curSet; }
function updateSetUI() {
  const idx = G.curSet;
  $("setLabel").textContent = G.sets[idx].name;
  $("setDots").querySelectorAll(".set-dot").forEach((d, i) => {
    d.className = "set-dot" + (i === idx ? " now" : G.setRanges[i].state === "done" ? " done" : "");
  });
  const prev = $("prevCatBtn"), next = $("nextCatBtn");
  if (prev) prev.disabled = !G.setRanges.some((r) => r.state === "done");   // any finished category to review
  if (next) next.disabled = nextPendingSet(idx) < 0;                        // any category left to move to
}

function log(html, cls = "") {
  const li = el("li", cls, html);
  $("logList").prepend(li);
  while ($("logList").children.length > 42) $("logList").lastChild.remove();
}

function renderRivalsRail() {
  const rail = $("rivalsRail");
  rail.innerHTML = "";
  G.rivals.forEach((r) => {
    const d = el("div", "rival", `
      <p class="rival-name"><span class="rival-dot"></span>${r.name}</p>
      <p class="rival-purse mono">${fmtMoney(r.purse)}</p>
      <p class="rival-ct">${10 + r.buys.length}/15 &middot; ${r.blurb}</p>`);
    d.style.setProperty("--rc", r.color);
    d.id = "rival-" + r.id;
    rail.appendChild(d);
  });
}
function pulseRival(r) {
  const d = $("rival-" + r.id);
  if (!d) return;
  d.classList.add("bidding");
  setTimeout(() => d.classList.remove("bidding"), 900);
}

function renderTopBar() {
  $("aucPurse").textContent = fmtMoney(G.user.purse);
  $("aucSlots").textContent = G.user.squad.length;
  $("aucOverseas").textContent = G.user.squad.filter((c) => c.c !== "IN").length;
}

function renderLot() {
  const b = G.bid, c = b.card;
  $("lotRole").textContent = ROLE_INFO[c.r].label.toUpperCase();
  $("lotSeason").textContent = `${c.t} · ${c.y}`;
  const flag = $("lotFlag");
  flag.textContent = c.c === "IN" ? "IND" : c.c;
  flag.className = "lot-flag" + (c.c !== "IN" ? " ovr" : "");
  $("lotName").textContent = c.n;
  $("lotFlavor").textContent = c.x || "";
  const stEl = $("lotStats");
  stEl.textContent = c.st || "";
  stEl.style.display = c.st ? "" : "none";
  $("lotOvr").textContent = c.o;
  const subs = $("lotSubs");
  subs.innerHTML = "";
  ROLE_INFO[c.r].subs.forEach((label, i) => {
    const row = el("div", "sub-row", `
      <span class="sub-label">${label}</span>
      <span class="sub-bar"><span class="sub-fill" style="width:${c.s[i]}%"></span></span>
      <span class="sub-val mono">${c.s[i]}</span>`);
    subs.appendChild(row);
  });
  $("soldStamp").style.opacity = 0;
  if (window.gsap) {
    gsap.fromTo("#lotCard", { opacity: 0, y: 30, filter: "blur(8px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "power3.out" });
    subs.querySelectorAll(".sub-fill").forEach((f, i) => {
      gsap.fromTo(f, { scaleX: 0 }, { scaleX: 1, duration: 0.9, delay: 0.15 + i * 0.1, ease: "power3.out", transformOrigin: "left" });
    });
  }
}

function renderBidState(statusHtml) {
  const b = G.bid;
  $("bidValue").textContent = fmtMoney(b.price);
  $("bidLeaderLabel").textContent = b.leader === null ? "Base price"
    : b.leader === G.user ? "Leading bid — YOU" : `Leading bid — ${b.leader.name}`;
  if (statusHtml !== undefined) $("bidStatus").innerHTML = statusHtml;
  composing = false;             // any fresh state cancels an in-progress compose
  refreshBidUI();
  const can = userCanBid();
  if (!can.ok && !userOut && b.leader !== G.user) $("bidStatus").innerHTML = `<span style="color:var(--bad)">${can.why}</span>`;
  if (window.gsap) gsap.fromTo("#bidValue", { scale: 1.12 }, { scale: 1, duration: 0.4, ease: "power2.out" });
}

// keep the stepper amount legal and update the +/- / submit buttons
function refreshBidUI() {
  const b = G.bid;
  if (!b) return;
  const min = minNextBid();
  const cap = G.user.purse; // Infinity when unlimited
  if (!composing || userBidAmt < min) userBidAmt = min;   // never below the standing bid
  if (cap !== Infinity) userBidAmt = Math.min(userBidAmt, cap);
  const can = userCanBid();
  const active = !userOut && !b.sold && b.leader !== G.user && can.ok;
  $("bidAmt").textContent = fmtMoney(userBidAmt);
  $("bidBtn").disabled = !active;
  $("bidMinus").disabled = !active || userBidAmt <= min;
  $("bidPlus").disabled = !active || (cap !== Infinity && userBidAmt + bidIncrement(userBidAmt) > cap);
  $("passBtn").disabled = userOut || b.sold;
}

function nextLot() {
  clearTimeout(aucTimer);
  const idx = nextLotInCurrentSet();
  if (idx == null) return finishCurrentCategory();   // this category is done
  const bid = startLot(idx);
  if (!bid) return endAuction();
  userOut = G.user.squad.length >= SQUAD_CAP;
  updateSetUI();
  renderLot();
  renderQueue();
  renderTopBar();
  renderBidState("The gavel is up&hellip;");
  log(`${bid.set}: <b>${bid.card.n}</b> (${bid.card.y}, ${bid.card.o} OVR) — base ${fmtMoney(bid.card.b)}`);
  schedule(aiTurn, rnd(800, 1500));
}

let onceStage = 0; // 0 none, 1 once, 2 twice
function aiTurn() {
  clearTimeout(aucTimer);
  const b = G.bid;
  if (b.sold) return;
  const challenger = aiChallenger();
  if (challenger) {
    onceStage = 0;
    placeBid(challenger);
    pulseRival(challenger);
    beep(430, 0.06, "square", 0.03);
    renderBidState(`<b>${challenger.name}</b> raises the paddle.`);
    schedule(aiTurn, userOut ? rnd(280, 620) : rnd(900, 1900));
  } else {
    // nobody wants to top it — countdown
    if (b.leader === null) {
      // no interest at all
      if (onceStage === 0) { onceStage = 1; renderBidState("No takers&hellip; going once."); schedule(aiTurn, 1200); return; }
      if (onceStage === 1) { onceStage = 2; renderBidState("Going twice&hellip;"); schedule(aiTurn, 1100); return; }
      onceStage = 0;
      concludeSale();   // routes through sellLot() so the lot is marked sold (no re-loop)
      return;
    }
    if (onceStage === 0) { onceStage = 1; renderBidState(`Going once at <b>${fmtMoney(b.price)}</b>&hellip;`); beep(520, 0.05, "sine", 0.03); schedule(aiTurn, 1250); return; }
    if (onceStage === 1) { onceStage = 2; renderBidState("Going twice&hellip;"); beep(520, 0.05, "sine", 0.03); schedule(aiTurn, 1150); return; }
    onceStage = 0;
    concludeSale();
  }
}

function concludeSale() {
  const res = sellLot();
  gavel();
  if (res.unsold) {
    stamp("UNSOLD", false);
    log(`<b>${res.card.n}</b> goes unsold.`);
  } else if (res.mine) {
    stamp("SOLD", true);
    ballCelebration(true);
    log(`SOLD! <b>${res.card.n}</b> joins <b>you</b> for ${fmtMoney(res.price)}.`, "log-sold log-me");
    renderTopBar();
    renderSquadDrawer();
  } else {
    stamp("SOLD", false);
    pulseRival(res.rival);
    log(`SOLD — <b>${res.card.n}</b> to <b>${res.rival.name}</b> for ${fmtMoney(res.price)}.`, "log-sold");
    const d = $("rival-" + res.rival.id);
    if (d) {
      d.querySelector(".rival-purse").textContent = fmtMoney(res.rival.purse);
      d.querySelector(".rival-ct").innerHTML = `${10 + res.rival.buys.length}/15 &middot; ${res.rival.blurb}`;
    }
  }
  renderBidState("");
  schedule(nextLot, 1400);
}

function stamp(text, mine) {
  const s = $("soldStamp");
  s.textContent = text;
  s.className = "sold-stamp" + (mine ? " mine" : "");
  if (window.gsap) {
    gsap.fromTo(s, { opacity: 0, scale: 3, rotate: -14 },
      { opacity: 1, scale: 1, rotate: -14, duration: 0.35, ease: "power4.in" });
    gsap.to(s, { opacity: 0, delay: 1.0, duration: 0.3 });
  }
}

// dialing the amount freezes the room so you have time to compose a raise
function startComposing() {
  if (composing) return;
  composing = true;
  clearTimeout(aucTimer);
  $("bidStatus").innerHTML = "Dialing your bid &mdash; submit or sit out.";
}
function stepBid(dir) {
  if ($(dir > 0 ? "bidPlus" : "bidMinus").disabled) return;
  startComposing();
  const inc = bidIncrement(userBidAmt);
  const min = minNextBid();
  userBidAmt = dir > 0 ? userBidAmt + inc : Math.max(min, userBidAmt - inc);
  refreshBidUI();
}
// press-and-hold to fly the amount up/down quickly
function holdRepeat(btn, fn) {
  let t1, t2;
  const stop = () => { clearTimeout(t1); clearInterval(t2); };
  const startHold = (e) => {
    if (btn.disabled) return;
    if (e.type === "mousedown" && e.button !== 0) return;
    fn();
    t1 = setTimeout(() => { t2 = setInterval(fn, 90); }, 320);
  };
  btn.addEventListener("mousedown", startHold);
  btn.addEventListener("touchstart", (e) => { e.preventDefault(); startHold(e); }, { passive: false });
  ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach((ev) => btn.addEventListener(ev, stop));
}
holdRepeat($("bidPlus"), () => stepBid(1));
holdRepeat($("bidMinus"), () => stepBid(-1));

$("bidBtn").addEventListener("click", () => {
  const can = userCanBid();
  if (!can.ok || G.bid.sold || G.bid.leader === G.user) return;
  const amt = Math.max(minNextBid(), userBidAmt);
  onceStage = 0;
  composing = false;
  placeBidAmount(G.user, amt);
  renderBidState(`<b>You</b> bid ${fmtMoney(amt)}.`);
  clearTimeout(aucTimer);
  schedule(aiTurn, rnd(700, 1400));
});
$("passBtn").addEventListener("click", () => {
  userOut = true;
  composing = false;
  renderBidState("You sit this one out.");
  clearTimeout(aucTimer);
  schedule(aiTurn, 350);
});

$("drawerToggle").addEventListener("click", () => $("drawerBody").classList.toggle("open"));
function renderSquadDrawer() {
  $("drawerCount").textContent = G.user.squad.length;
  const ul = $("squadList");
  ul.innerHTML = "";
  if (!G.user.squad.length) {
    ul.appendChild(el("li", "sq-empty", "No players yet. Win a lot to start your squad."));
    return;
  }
  G.user.squad.slice().sort((a, b) => b.o - a.o).forEach((c) => {
    const yy = String(c.y).slice(2);
    const info = c.st || `${ROLE_INFO[c.r].label} · ${c.t} '${yy}`;
    ul.appendChild(el("li", "sq-card", `
      <span class="sq-ovr">${c.o}</span>
      <span class="sq-body">
        <span class="sq-top"><b class="sq-name">${c.n}</b><span class="sq-tag${c.c !== "IN" ? " ovs" : ""}">${c.c === "IN" ? "IND" : c.c}</span></span>
        <span class="sq-role">${ROLE_INFO[c.r].label} &middot; ${c.t} &rsquo;${yy}</span>
        <span class="sq-info mono">${info}</span>
      </span>
      <span class="sq-paid mono">${c.paid ? fmtMoney(c.paid) : "—"}</span>`));
  });
}

function endAuction() {
  clearTimeout(aucTimer);
  const added = completeUserSquad();
  completeRivalSquads();
  enforceUniqueSquads();
  if (added.length)
    log(`Auction closed. ${added.length} uncapped reserve${added.length > 1 ? "s" : ""} complete your fifteen.`);
  setTimeout(() => { initSquadScreen(); showScreen("squad"); }, 250);
}

// ---------- squad / XI ----------
let xiMap = [];
let selCard = null;

function initSquadScreen() {
  xiMap = new Array(11).fill(null);
  selCard = null;
  // inject auto-pick button once
  if (!$("autoXIBtn")) {
    const b = el("button", "btn btn-ghost btn-wide", "<span>Auto-pick my best XI</span>");
    b.id = "autoXIBtn";
    $("startSeasonBtn").before(b);
    b.addEventListener("click", autoPickXI);
  }
  $("squadGrid").dataset.show = "pool";   // mobile: start on the Squad tab
  $("squadTabs").querySelectorAll(".squad-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === "pool"));
  renderPool();
  renderSlots();
  renderChecks();
}
// mobile Squad ⇄ XI tab toggle (on desktop both panels always show)
$("squadTabs").addEventListener("click", (e) => {
  const t = e.target.closest(".squad-tab");
  if (!t) return;
  $("squadGrid").dataset.show = t.dataset.tab;
  $("squadTabs").querySelectorAll(".squad-tab").forEach((x) => x.classList.toggle("active", x === t));
});

// on mobile the Squad/XI tabs are exclusive, so follow the tap flow:
// picking a player jumps to the XI tab, placing one returns to Squad.
function mobileTab(name) {
  const tabs = $("squadTabs");
  if (!tabs || getComputedStyle(tabs).display === "none") return; // desktop: both visible
  $("squadGrid").dataset.show = name;
  tabs.querySelectorAll(".squad-tab").forEach((x) => x.classList.toggle("active", x.dataset.tab === name));
}

let dragSrc = null; // {card} from pool, or {slot:i} from a filled slot
let touchDragging = false; // true mid touch-drag, so the tap handlers stand down
// place a card into slot i (bumping any occupant back to the pool); enforce overseas cap
function placeInSlot(i, card) {
  const j = xiMap.indexOf(card);
  if (j >= 0) xiMap[j] = null;                 // if already in XI, move it
  const prospectiveOvs = xiMap.filter((x, k) => x && k !== i).concat([card]).filter((x) => x.c !== "IN").length;
  if (card.c !== "IN" && prospectiveOvs > OVERSEAS_XI_CAP) { flashChecks(); return false; }
  xiMap[i] = card;
  return true;
}
// apply a drop of dragSrc onto slot i (shared by mouse DnD and touch DnD)
function performXIDrop(i) {
  if (!dragSrc) return;
  if (dragSrc.slot != null) {                 // slot -> slot: swap
    const j = dragSrc.slot;
    const tmp = xiMap[i]; xiMap[i] = xiMap[j]; xiMap[j] = tmp;
  } else if (dragSrc.card) {                   // pool -> slot: place (may bump occupant to pool)
    placeInSlot(i, dragSrc.card);
  }
  dragSrc = null; selCard = null;
  renderPool(); renderSlots(); renderChecks();
}
function slotFromPoint(x, y) {
  const e = document.elementFromPoint(x, y);
  return e ? e.closest(".xi-slot") : null;
}
// touch-based drag: native HTML5 DnD doesn't fire on touchscreens, so we roll our
// own with a follow-the-finger ghost. `getSrc()` returns the dragSrc descriptor.
function attachTouchDrag(node, getSrc) {
  node.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    const t0 = e.touches[0], sx = t0.clientX, sy = t0.clientY;
    let started = false, ghost = null, gw = 0, hot = null;
    const cleanup = () => {
      if (ghost) { ghost.remove(); ghost = null; }
      if (hot) { hot.classList.remove("drop-hot"); hot = null; }
      node.classList.remove("dragging");
      node.removeEventListener("touchmove", move);
      node.removeEventListener("touchend", end);
      node.removeEventListener("touchcancel", end);
    };
    const move = (ev) => {
      const t = ev.touches[0];
      if (!started) {
        if (Math.hypot(t.clientX - sx, t.clientY - sy) < 10) return;   // still a tap
        const src = getSrc();
        if (!src) { cleanup(); return; }
        dragSrc = src; started = true; touchDragging = true;
        node.classList.add("dragging");
        const r = node.getBoundingClientRect(); gw = r.width;
        ghost = node.cloneNode(true);
        ghost.style.cssText = `position:fixed;left:0;top:0;width:${gw}px;margin:0;pointer-events:none;` +
          `z-index:999;opacity:0.92;box-shadow:0 18px 40px rgba(0,0,0,0.5);`;
        document.body.appendChild(ghost);
      }
      ev.preventDefault();   // hold the page still while dragging
      ghost.style.transform = `translate(${t.clientX - gw / 2}px, ${t.clientY - 24}px) scale(0.97)`;
      const slot = slotFromPoint(t.clientX, t.clientY);
      if (hot && hot !== slot) hot.classList.remove("drop-hot");
      if (slot) slot.classList.add("drop-hot");
      hot = slot;
    };
    const end = (ev) => {
      if (started) {
        ev.preventDefault();   // suppress the synthetic click that follows a drag
        const t = ev.changedTouches && ev.changedTouches[0];
        const slot = t ? slotFromPoint(t.clientX, t.clientY) : null;
        if (slot && slot.dataset.slot != null) performXIDrop(+slot.dataset.slot);
        setTimeout(() => { touchDragging = false; }, 60);
      }
      cleanup();
    };
    node.addEventListener("touchmove", move, { passive: false });
    node.addEventListener("touchend", end, { passive: false });
    node.addEventListener("touchcancel", end, { passive: false });
  }, { passive: true });
}
function subBarsHTML(c) {
  return ROLE_INFO[c.r].subs.map((label, i) => `
    <div class="psub"><span class="psub-l">${label}</span>
    <span class="psub-bar"><span class="psub-fill" style="width:${c.s[i]}%"></span></span></div>`).join("");
}
function renderPool() {
  const ul = $("poolList");
  ul.innerHTML = "";
  G.user.squad.slice().sort((a, b) => b.o - a.o).forEach((c) => {
    const placed = xiMap.includes(c);
    const yy = String(c.y).slice(2);
    const li = el("li", "pool-card" + (placed ? " placed" : "") + (selCard === c ? " sel" : ""), `
      <div class="pool-top">
        <span class="pool-ovr">${c.o}</span>
        <span class="pool-id">
          <span class="pool-name">${c.n}</span>
          <span class="pool-meta">${ROLE_INFO[c.r].label} · ${c.t} '${yy}${c.filler ? " · reserve" : ""}</span>
        </span>
        <span class="pool-tag${c.c !== "IN" ? " ovs" : ""}">${c.c === "IN" ? "IND" : c.c}</span>
      </div>
      ${c.st ? `<p class="pool-stat mono">${c.st}</p>` : ""}
      <div class="pool-subs">${subBarsHTML(c)}</div>
      ${placed ? `<span class="pool-placed-tag">In XI</span>` : ""}`);
    li.addEventListener("click", () => {
      if (xiMap.includes(c)) { // remove from XI on tap
        xiMap[xiMap.indexOf(c)] = null;
        selCard = null;
      } else {
        selCard = selCard === c ? null : c;
      }
      renderPool(); renderSlots(); renderChecks();
      if (selCard) mobileTab("xi");   // picked a player -> show the slots to drop into
    });
    // drag support: drag a player onto any slot
    li.draggable = true;
    li.addEventListener("dragstart", (e) => { dragSrc = { card: c }; e.dataTransfer.effectAllowed = "move"; li.classList.add("dragging"); });
    li.addEventListener("dragend", () => { li.classList.remove("dragging"); });
    ul.appendChild(li);
  });
}

function renderSlots() {
  const wrap = $("xiSlots");
  wrap.innerHTML = "";
  XI_SLOTS.forEach((slot, i) => {
    const c = xiMap[i];
    const oop = c && !slot.accepts.includes(c.r);        // out of natural position
    const hot = selCard && !c;                            // any card can go anywhere now
    const warn = selCard && !c && !slot.accepts.includes(selCard.r);
    const d = el("div", "xi-slot" + (c ? " filled" : "") + (hot ? " hot" : "") + (warn ? " warn" : "") + (oop ? " oop" : ""), c ? `
      <span class="slot-pos">${slot.pos}</span>
      <span><span class="slot-who">${c.n}${oop ? ` <em class="oop-tag">out of role</em>` : ""}</span><br><span class="slot-sub">${c.o} OVR · ${ROLE_INFO[c.r].label}${c.c !== "IN" ? " · OVS" : ""}</span></span>
      <button class="slot-x" title="Remove">✕</button>` : `
      <span class="slot-pos">${slot.pos}</span>
      <span class="slot-sub">${slot.accepts.map((r) => ROLE_INFO[r].label).join(" / ")}</span>`);
    d.dataset.slot = i;
    d.addEventListener("click", (ev) => {
      if (touchDragging) return;   // a touch-drag just finished; ignore the trailing tap
      if (ev.target.classList.contains("slot-x")) { xiMap[i] = null; renderPool(); renderSlots(); renderChecks(); return; }
      if (selCard && !xiMap[i]) {
        if (!placeInSlot(i, selCard)) return;
        selCard = null;
        renderPool(); renderSlots(); renderChecks();
        mobileTab("pool");   // placed -> back to the squad to pick the next
      }
    });
    // drag-and-drop: drag a filled slot to reorder; drop a player/slot onto any slot
    if (c) {
      d.draggable = true;
      d.addEventListener("dragstart", (e) => { dragSrc = { slot: i }; e.dataTransfer.effectAllowed = "move"; d.classList.add("dragging"); });
      d.addEventListener("dragend", () => d.classList.remove("dragging"));
      attachTouchDrag(d, () => (xiMap[i] ? { slot: i } : null));   // touch: drag to reorder/swap
    }
    d.addEventListener("dragover", (e) => { if (dragSrc) { e.preventDefault(); d.classList.add("drop-hot"); } });
    d.addEventListener("dragleave", () => d.classList.remove("drop-hot"));
    d.addEventListener("drop", (e) => {
      e.preventDefault();
      d.classList.remove("drop-hot");
      performXIDrop(i);
    });
    wrap.appendChild(d);
  });
}

function flashChecks() {
  if (window.gsap) gsap.fromTo("#checkList", { x: -6 }, { x: 0, duration: 0.4, ease: "elastic.out(1, 0.4)" });
}

function renderChecks() {
  const checks = xiChecks(xiMap);
  const ul = $("checkList");
  ul.innerHTML = "";
  let hardOk = true;
  checks.forEach((c) => {
    if (c.hard && !c.ok) hardOk = false;
    // hard failures are red; soft failures are amber warnings (you can still play)
    const cls = c.ok ? "ok" : c.hard || c.bad ? "bad" : "warn";
    ul.appendChild(el("li", cls, c.label));
  });
  $("startSeasonBtn").disabled = !hardOk;
  // live phase bars (use the sim-ready effective XI so penalties show)
  const bars = $("phaseBars");
  bars.innerHTML = "";
  const xi = buildEffectiveXI(xiMap);
  if (xi.length >= 6) {
    const phases = computePhases(xi.length === 11 ? xi : xi.concat(new Array(11 - xi.length).fill({ n: "", c: "IN", r: "MID", o: 40, s: [40, 40, 40] })));
    Object.entries(phases).forEach(([k, v]) => {
      const val = Math.round(v);
      const color = val >= 85 ? "var(--good)" : val >= 72 ? "var(--gold)" : "var(--bad)";
      bars.appendChild(el("div", "sub-row phase-row", `
        <span class="sub-label">${k}</span>
        <span class="sub-bar"><span class="sub-fill" style="width:${val}%; background:${color}"></span></span>
        <span class="sub-val mono">${val}</span>`));
    });
  } else {
    bars.appendChild(el("p", "fld-hint", "Fill at least six slots to preview your team's phase ratings."));
  }
}

function autoPickXI() {
  xiMap = new Array(11).fill(null);
  const pool = G.user.squad.slice().sort((a, b) => b.o - a.o);
  const order = [6, 9, 7, 0, 1, 8, 10, 2, 3, 4, 5]; // restrictive slots first
  // ensure a keeper lands somewhere it fits
  const wk = pool.filter((c) => c.r === "WK").sort((a, b) => b.o - a.o)[0];
  const used = new Set();
  const ovsCount = () => xiMap.filter(Boolean).filter((c) => c.c !== "IN").length;
  if (wk) {
    const slotForWk = XI_SLOTS.find((s, i) => s.accepts.includes("WK") && !xiMap[i]);
    if (slotForWk) { xiMap[slotForWk.id] = wk; used.add(wk); }
  }
  for (const si of order) {
    if (xiMap[si]) continue;
    const slot = XI_SLOTS[si];
    for (const c of pool) {
      if (used.has(c)) continue;
      if (!slot.accepts.includes(c.r)) continue;
      if (c.c !== "IN" && ovsCount() >= OVERSEAS_XI_CAP) continue;
      xiMap[si] = c; used.add(c);
      break;
    }
  }
  // repair pass: greedy can strand slots when the overseas cap fills early.
  for (const si of order) {
    if (xiMap[si]) continue;
    const slot = XI_SLOTS[si];
    const unused = pool.filter((c) => !used.has(c));
    // best unused Indian that fits
    const ind = unused.find((c) => c.c === "IN" && slot.accepts.includes(c.r));
    if (ind) { xiMap[si] = ind; used.add(ind); continue; }
    const ovs = unused.find((c) => c.c !== "IN" && slot.accepts.includes(c.r));
    if (!ovs) continue;
    if (ovsCount() < OVERSEAS_XI_CAP) { xiMap[si] = ovs; used.add(ovs); continue; }
    // cap full: evict the weakest placed overseas player whose slot an unused Indian can cover
    let evictIdx = -1, evictRepl = null;
    for (let j = 0; j < 11; j++) {
      const p = xiMap[j];
      if (!p || p.c === "IN" || j === si) continue;
      const repl = unused.find((c) => c.c === "IN" && c !== ovs && XI_SLOTS[j].accepts.includes(c.r));
      if (repl && (evictIdx === -1 || p.o < xiMap[evictIdx].o)) { evictIdx = j; evictRepl = repl; }
    }
    if (evictIdx >= 0) {
      used.delete(xiMap[evictIdx]);
      xiMap[evictIdx] = evictRepl; used.add(evictRepl);
      xiMap[si] = ovs; used.add(ovs);
    }
  }
  selCard = null;
  renderPool(); renderSlots(); renderChecks();
}

// mobile Fixtures ⇄ League tab toggle (desktop shows both panels)
$("seasonTabs").addEventListener("click", (e) => {
  const t = e.target.closest(".squad-tab");
  if (!t) return;
  $("seasonGrid").dataset.show = t.dataset.stab;
  $("seasonTabs").querySelectorAll(".squad-tab").forEach((x) => x.classList.toggle("active", x === t));
});

$("startSeasonBtn").addEventListener("click", () => {
  G.user.xi = buildEffectiveXI(xiMap);   // apply out-of-position penalties for the sim
  buildSeason();
  $("matchStack").innerHTML = "";
  $("seasonGrid").dataset.show = "fixtures";   // mobile: start on the Fixtures tab
  $("seasonTabs").querySelectorAll(".squad-tab").forEach((x) => x.classList.toggle("active", x.dataset.stab === "fixtures"));
  renderSeasonHead();
  renderTable();
  $("nextMatchBtn").querySelector("span").textContent = "Play match 1";
  $("simAllBtn").style.display = "";
  showScreen("season");
});

// ---------- season ----------
function renderSeasonHead() {
  const s = G.season;
  const w = s.played.filter((r) => r.win).length;
  const l = s.played.length - w;
  $("seasonRecord").textContent = `${w}–${l}`;
  const knockout = s.phase === "playoffs";
  $("screen-season").classList.toggle("knockout-mode", knockout);
  if (s.phase === "league") {
    $("seasonPhaseLabel").textContent = `League stage · match ${Math.min(s.played.length + 1, 14)} of 14`;
  } else if (knockout) {
    const nx = nextPlayoffMatch();
    $("seasonPhaseLabel").textContent = `Playoffs · ${nx ? nx.tag : ""}`;
  } else {
    $("seasonPhaseLabel").textContent = "Season complete";
  }
  renderUpcoming();
}

function renderUpcoming() {
  const s = G.season, banner = $("nextMatchBanner");
  let opp = null, tag = "";
  if (s.phase === "league" && s.played.length < 14) {
    opp = s.myFixtures[s.played.length];
    tag = `Match ${s.played.length + 1} of 14`;
  } else if (s.phase === "playoffs") {
    const nx = nextPlayoffMatch();
    if (nx) { opp = nx.oppId; tag = nx.tag; }
  }
  if (!opp) { banner.hidden = true; return; }
  banner.hidden = false;
  banner.className = "next-match" + (s.phase === "playoffs" ? " knockout" : "");
  const seed = tableSorted().findIndex((t) => t.id === opp) + 1;
  banner.innerHTML = `
    <span class="nm-label">${s.phase === "playoffs" ? "&#127942; Knockout" : "Up next"} &middot; ${tag}</span>
    <span class="nm-vs">
      <span class="nm-team nm-you"><span class="rival-dot" style="background:${teamColor("YOU")}"></span>${G.user.name}</span>
      <span class="nm-x">vs</span>
      <span class="nm-team nm-opp">${teamName(opp)}<span class="rival-dot" style="background:${teamColor(opp)}"></span></span>
    </span>
    <span class="nm-seed">${seed ? "#" + seed + " on the table" : ""}</span>`;
}

function teamName(id) {
  const t = G.season.teams.find((t) => t.id === id);
  return t ? t.name : id;
}
function teamColor(id) {
  const t = G.season.teams.find((t) => t.id === id);
  return t ? t.color : "#888";
}

function renderMatchCard(res, n) {
  const card = el("article", "match-card " + (res.win ? "win" : "loss"), `
    <div class="mc-top">
      <span class="mc-opp"><span class="rival-dot" style="background:${teamColor(res.oppId)}"></span>${teamName(res.oppId)}</span>
      <span class="mc-tag">${res.tag || "Match " + n}</span>
      <span class="mc-res ${res.win ? "w" : "l"}">${res.win ? "WON" : "LOST"}</span>
    </div>
    <p class="mc-line">${res.margin.charAt(0).toUpperCase() + res.margin.slice(1)}. ${res.line}</p>
    <span class="mc-view">View scorecard &rarr;</span>`);
  card.addEventListener("click", () => openScorecard(res));
  $("matchStack").prepend(card);
  if (window.gsap) gsap.fromTo(card, { opacity: 0, y: -22, filter: "blur(5px)" },
    { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.6, ease: "power3.out" });
}

// ---------- scorecard modal ----------
const HOW_ABBR = {}; // reserved
function openScorecard(res) {
  const sc = buildScorecard(res);
  if (!sc) return;
  const nm = (id) => (id === "YOU" ? G.user.name : teamName(id));
  $("scoreEyebrow").textContent = res.tag || "League match";
  $("scoreTitle").textContent = `${nm(sc.firstId)} v ${nm(sc.secondId)}`;
  $("scoreResult").innerHTML = res.potm ? `Player of the match: <b>${res.potm}</b>` : "";
  const winnerId = res.win ? "YOU" : sc.firstId === "YOU" ? sc.secondId : sc.firstId;
  const mg = res.margin.replace(/^(won|lost) by /, "");
  $("scorecardBody").innerHTML =
    inningsHTML(sc.firstId, sc.secondId, sc.inn1, nm) +
    inningsHTML(sc.secondId, sc.firstId, sc.inn2, nm) +
    `<div class="sc2-result">${nm(winnerId).toUpperCase()} WON BY ${mg.toUpperCase()}</div>`;
  scorePrevScreen = activeScreen;
  showScreen("scorecard");
}
let scorePrevScreen = "season";
$("scoreCloseBtn").addEventListener("click", () => showScreen(scorePrevScreen));
$("scoreCloseBtn2").addEventListener("click", () => showScreen(scorePrevScreen));
// broadcast "match summary" innings: run-makers left, wicket-takers right
function inningsHTML(batId, bowlId, inn, nm) {
  const batted = inn.batting.filter((b) => !b.dnb);
  const dnb = inn.batting.filter((b) => b.dnb).map((b) => b.name);
  const batRows = batted.map((b) => `
    <div class="sc2-row">
      <span class="sc2-name">${b.name}<span class="sc2-sub">${b.how}</span></span>
      <span class="sc2-fig">${b.runs}${b.out ? "" : "*"} <small>(${b.balls})</small></span>
    </div>`).join("");
  const bowlRows = inn.bowling.map((b) => `
    <div class="sc2-row">
      <span class="sc2-name">${b.name}<span class="sc2-sub">${b.overs} ov &middot; ${b.econ} econ</span></span>
      <span class="sc2-fig">${b.wkts}-${b.runs}</span>
    </div>`).join("");
  return `
    <div class="sc2-inn" style="--team:${teamColor(batId)}">
      <div class="sc2-head">
        <span class="sc2-team"><span class="sc2-dot"></span>${nm(batId)}</span>
        <span class="sc2-total">${inn.total}/${inn.wkts}<small> (${inn.overs})</small></span>
      </div>
      <div class="sc2-grid">
        <div class="sc2-side">
          <p class="sc2-colhead">Batters</p>
          ${batRows}
          <div class="sc2-extras">Extras <b>${inn.extras}</b></div>
          ${dnb.length ? `<div class="sc2-dnb">Did not bat: ${dnb.join(", ")}</div>` : ""}
        </div>
        <div class="sc2-side sc2-bowlside">
          <p class="sc2-colhead">Wicket-takers &mdash; ${nm(bowlId)}</p>
          ${bowlRows}
        </div>
      </div>
    </div>`;
}

function renderTable() {
  const rows = tableSorted();
  const tbl = $("pointsTable");
  tbl.innerHTML = `<tr><th></th><th>Team</th><th>P</th><th>W</th><th>L</th><th>Pts</th></tr>` +
    rows.map((r, i) => `
      <tr class="${r.id === "YOU" ? "me" : ""}">
        <td class="pt-q mono">${i + 1}</td>
        <td><span class="pt-team"><span class="rival-dot" style="background:${teamColor(r.id)}"></span>${teamName(r.id)}</span></td>
        <td class="mono">${r.p}</td><td class="mono">${r.w}</td><td class="mono">${r.l}</td>
        <td class="mono">${r.pts}</td>
      </tr>`).join("");
}

function playNext() {
  const s = G.season;
  if (s.phase === "league") {
    const oppId = s.myFixtures[s.played.length];
    const res = playMyMatch(oppId);
    applyResult(res);
    if (res.win) beep(760, 0.12, "triangle", 0.05); else beep(220, 0.2, "sawtooth", 0.04);
    renderMatchCard(res, s.played.length);
    renderTable();
    if (s.played.length >= 14) {
      startPlayoffs();
      if (s.phase === "done") return seasonOver();
      $("simAllBtn").style.display = "none";
      const nx = nextPlayoffMatch();
      $("nextMatchBtn").querySelector("span").textContent = "Play " + nx.tag;
    } else {
      $("nextMatchBtn").querySelector("span").textContent = "Play match " + (s.played.length + 1);
    }
    renderSeasonHead();
    return;
  }
  if (s.phase === "playoffs") {
    const nx = nextPlayoffMatch();
    if (!nx) return seasonOver();
    const res = playMyMatch(nx.oppId, nx.tag);
    s.played.push(res); // playoff games don't touch the league table
    advancePlayoffs(res);
    if (res.win) fanfare(); else beep(180, 0.35, "sawtooth", 0.05);
    renderMatchCard(res);
    renderSeasonHead();
    if (s.phase === "done") return setTimeout(seasonOver, 1200);
    const nx2 = nextPlayoffMatch();
    if (nx2) $("nextMatchBtn").querySelector("span").textContent = "Play " + nx2.tag;
    return;
  }
  seasonOver();
}
$("nextMatchBtn").addEventListener("click", playNext);
$("simAllBtn").addEventListener("click", () => {
  const s = G.season;
  if (s.phase !== "league") return;
  while (s.phase === "league" && s.played.length < 14) {
    const oppId = s.myFixtures[s.played.length];
    const res = playMyMatch(oppId);
    applyResult(res);
    renderMatchCard(res, s.played.length);
  }
  renderTable();
  startPlayoffs();
  renderSeasonHead();
  if (s.phase === "done") return setTimeout(seasonOver, 900);
  $("simAllBtn").style.display = "none";
  const nx = nextPlayoffMatch();
  $("nextMatchBtn").querySelector("span").textContent = "Play " + nx.tag;
});

// ---------- verdict ----------
function seasonOver() {
  const v = computeVerdict();
  $("verdictKicker").textContent = v.perfect ? "History made" : v.champion ? "Champions" : "Season complete";
  const titleEl = $("verdictTitle");
  titleEl.textContent = v.perfect ? `${v.w}–0` : v.title;
  titleEl.classList.toggle("is-word", /[A-Za-z]/.test(titleEl.textContent));
  $("verdictSub").textContent = v.sub;
  $("emojiStrip").textContent = emojiStrip();
  renderAwards(generateSeasonAwards());
  renderReview(computeReview());
  renderShareCard(v);
  renderVerdictDetail(v);
  if (!savedThisSeason) { saveHistory(v); savedThisSeason = true; }
  showScreen("verdict");
}

const ROLE_BADGE = { OPN: "OPN", MID: "BAT", WK: "WK", AR: "AR", PAC: "PACE", SPN: "SPIN" };
function renderReview(r) {
  if (!r) { $("reviewBlock").innerHTML = ""; return; }
  const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const gradeClass = (g) => "g-" + g.toLowerCase().replace(/\s+/g, "");
  const tiles = `
    <div class="rv-tiles">
      <div class="rv-tile"><span class="rv-k">Finished</span><span class="rv-v">${ord(r.finished)}</span></div>
      <div class="rv-tile"><span class="rv-k">Projected</span><span class="rv-v rv-dim">${ord(r.projected)}</span></div>
      <div class="rv-tile rv-verdict ${gradeClass(r.tag)}"><span class="rv-k">Verdict</span><span class="rv-v">${r.tag}</span></div>
    </div>
    ${r.campaign ? `<div class="rv-campaign ${gradeClass(r.tag)}"><span class="rv-camp-k">Campaign</span><span class="rv-camp-v">${r.campaign}</span></div>` : ""}`;
  const grades = `
    <div class="rv-grades">
      ${r.grades.map((x) => `<span class="rv-grade"><span class="rv-grade-k">${x.k}</span><b class="${gradeClass(x.g)}">${x.g}</b></span>`).join("")}
      <span class="rv-weak">Built around the ${r.grades.slice().sort((a, b) => b.v - a.v)[0].k.toLowerCase()}; the ${r.weak.name.toLowerCase()} was the weak link.</span>
    </div>`;
  const note = `
    <div class="rv-note">
      <p class="rv-note-h">${r.headline}</p>
      <p class="rv-note-b">${r.body}</p>
    </div>`;
  const lineup = `
    <div class="rv-lineup">
      <div class="rv-lu-head"><span></span><span>Your XI</span><span class="rv-lu-n">Runs</span><span class="rv-lu-n">Wkts</span><span class="rv-lu-n">OVR</span></div>
      ${r.lineup.map((row) => {
        const c = row.c;
        return `<div class="rv-lu-row">
          <span class="rv-pos">${ROLE_BADGE[c.r] || c.r}</span>
          <span class="rv-name">${c.n}${c.filler ? "" : ""}<span class="rv-club">${c.t} '${String(c.y).slice(2)}</span></span>
          <span class="rv-stat rv-runs">${row.runs || "-"}</span>
          <span class="rv-stat rv-wkts">${row.wkts || "-"}</span>
          <span class="rv-ovr mono">${c.o}</span>
        </div>`;
      }).join("")}
    </div>`;
  $("reviewBlock").innerHTML = tiles + grades + note + lineup;
}

function renderAwards(a) {
  if (!a || !a.orange) { $("awardsBlock").innerHTML = ""; return; }
  const cap = (cls, label, p, unit, val) => `
    <div class="aw-cap ${cls}">
      <span class="aw-cap-label">${label}</span>
      <span class="aw-cap-name">${p.name}</span>
      <span class="aw-cap-val mono">${val} ${unit}</span>
      <span class="aw-cap-team">${p.team}</span>
    </div>`;
  const chip = (label, p, extra) => p ? `
    <div class="aw-chip"><span class="aw-chip-l">${label}</span><b>${p.name}</b>${extra ? ` <span class="mono">${extra}</span>` : ""}</div>` : "";
  const list = (rows, unit, key) => rows.map((p, i) => `
    <li class="aw-row${p.teamId === "YOU" ? " me" : ""}">
      <span class="aw-rank mono">${i + 1}</span>
      <span class="aw-row-name">${p.name}<span class="aw-row-team">${p.team}</span></span>
      <span class="aw-row-val mono">${p[key]}<small>${unit}</small></span>
    </li>`).join("");
  $("awardsBlock").innerHTML = `
    <p class="aw-title">The season in numbers</p>
    <div class="aw-mine">
      ${chip("Your player of the season", a.mvp, "")}
      ${chip("Your top batter", a.topRun, a.topRun ? a.topRun.runs + " runs" : "")}
      ${chip("Your top wicket-taker", a.topWkt, a.topWkt ? a.topWkt.wkts + " wkts" : "")}
    </div>
    <div class="aw-caps">
      ${cap("aw-orange", "Orange Cap", a.orange, "runs", a.orange.runs)}
      ${cap("aw-purple", "Purple Cap", a.purple, "wkts", a.purple.wkts)}
    </div>
    <div class="aw-lists">
      <div class="aw-listcol">
        <p class="aw-list-title aw-orange-t">Orange Cap · top 10</p>
        <ol class="aw-list">${list(a.orangeList || [], " runs", "runs")}</ol>
      </div>
      <div class="aw-listcol">
        <p class="aw-list-title aw-purple-t">Purple Cap · top 10</p>
        <ol class="aw-list">${list(a.purpleList || [], " wkts", "wkts")}</ol>
      </div>
    </div>`;
}

function renderVerdictDetail(v) {
  const s = G.season;
  const spend = G.user.squad.reduce((a, c) => a + (c.paid || 0), 0);
  const biggest = G.user.squad.slice().sort((a, b) => (b.paid || 0) - (a.paid || 0))[0];
  const phases = s.uPhases;
  const weak = weakestPhase(phases);
  const strong = Object.entries(phases).reduce((a, b) => (b[1] > a[1] ? b : a));
  $("verdictDetail").innerHTML = `
    <h4>The autopsy</h4>
    <p>Auction spend: <b style="color:var(--gold-2)">${fmtMoney(spend)}</b> of ${fmtMoney(G.user.purse0)} ·
       Biggest buy: <b>${biggest ? biggest.n + " (" + fmtMoney(biggest.paid || 0) + ")" : "—"}</b><br>
       Strongest phase: <b style="color:var(--good)">${strong[0]} (${Math.round(strong[1])})</b> ·
       Weakest phase: <b style="color:var(--bad)">${weak.name} (${Math.round(weak.v)})</b></p>
    <h4>Your XI</h4>
    <div class="vd-xi">${G.user.xi.map((c) => `<span><b>${c.o}</b> ${c.n} <small>· ${ROLE_INFO[c.r].label}</small></span>`).join("")}</div>`;
}

function renderShareCard(v) {
  const cv = $("shareCanvas"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  // backdrop
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0A0F1A"); g.addColorStop(1, "#05070D");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 210, 40, W / 2, 210, 620);
  glow.addColorStop(0, hexA(G.user.color, 0.4)); glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  // crest
  ctx.fillStyle = G.user.color;
  roundRect(ctx, W / 2 - 90, 130, 180, 180, 48); ctx.fill();
  ctx.fillStyle = "#0B0E14";
  ctx.font = "700 84px 'Clash Display', sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(initials(G.user.name), W / 2, 226);
  // name
  ctx.fillStyle = "#F2EFE6";
  ctx.font = "600 64px 'Clash Display', sans-serif";
  ctx.fillText(G.user.name, W / 2, 410);
  ctx.fillStyle = "rgba(242,239,230,0.5)";
  ctx.font = "500 34px Satoshi, sans-serif";
  ctx.fillText((G.user.city ? G.user.city + " · " : "") + "CrickSim season", W / 2, 470);
  // record
  ctx.font = "700 260px 'Clash Display', sans-serif";
  const rg = ctx.createLinearGradient(0, 560, 0, 860);
  rg.addColorStop(0, "#F6D488"); rg.addColorStop(1, "#E4B454");
  ctx.fillStyle = rg;
  ctx.fillText(`${v.w}–${v.l}`, W / 2, 720);
  ctx.fillStyle = "#F2EFE6";
  ctx.font = "600 44px 'Clash Display', sans-serif";
  ctx.fillText(v.perfect ? "A PERFECT SEASON" : v.champion ? "CHAMPIONS" : v.madePlayoffs ? "PLAYOFFS" : "LEAGUE STAGE", W / 2, 900);
  // xi
  ctx.font = "500 30px Satoshi, sans-serif";
  ctx.fillStyle = "rgba(242,239,230,0.65)";
  const xi = G.user.xi;
  xi.forEach((c, i) => {
    const col = i < 6 ? 0 : 1;
    const row = i % 6;
    ctx.textAlign = col === 0 ? "right" : "left";
    ctx.fillText(`${c.n} ${c.o}`, col === 0 ? W / 2 - 30 : W / 2 + 30, 990 + row * 46);
  });
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(242,239,230,0.35)";
  ctx.font = "500 26px Satoshi, sans-serif";
  ctx.fillText("cricksim · can you go 16–0?", W / 2, H - 60);
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

$("downloadCardBtn").addEventListener("click", () => {
  const a = document.createElement("a");
  a.download = "cricksim-season.png";
  a.href = $("shareCanvas").toDataURL("image/png");
  a.click();
});
$("copyEmojiBtn").addEventListener("click", async () => {
  const v = computeVerdict();
  const txt = `CrickSim — ${G.user.name} went ${v.w}–${v.l}${v.perfect ? " · A PERFECT SEASON" : v.champion ? " · CHAMPIONS" : ""}\n${emojiStrip()}`;
  try {
    await navigator.clipboard.writeText(txt);
    $("copyEmojiBtn").querySelector("span").textContent = "Copied!";
    setTimeout(() => ($("copyEmojiBtn").querySelector("span").textContent = "Copy result"), 1600);
  } catch (e) { /* clipboard unavailable */ }
});

// ---------- history ----------
function ordinal(n) { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function saveHistory(v) {
  try {
    const r = G.season.review || {};
    const camp = r.campaign || "";
    let outcome;
    if (v.perfect) outcome = "Perfect season, champions";
    else if (v.champion) outcome = "won the title";
    else if (v.madePlayoffs) outcome = /lost the Final/.test(camp) ? "runners-up (lost the final)" : "made the playoffs";
    else outcome = "league stage only";
    const h = JSON.parse(localStorage.getItem("cricksim_history") || "[]");
    h.unshift({
      date: new Date().toISOString().slice(0, 10),
      name: G.user.name, color: G.user.color,
      purse: G.user.purse0 === Infinity ? "∞" : fmtMoney(G.user.purse0),
      w: v.w, l: v.l, perfect: v.perfect, champion: v.champion,
      finished: r.finished || null, outcome,
      xi: G.user.xi.map((c) => `${c.n} '${String(c.y).slice(2)}`),
    });
    localStorage.setItem("cricksim_history", JSON.stringify(h.slice(0, 40)));
  } catch (e) { /* storage unavailable */ }
}
function loadHistory() {
  try { return JSON.parse(localStorage.getItem("cricksim_history") || "[]"); } catch (e) { return []; }
}
function saveHistoryList(h) {
  try { localStorage.setItem("cricksim_history", JSON.stringify(h)); } catch (e) {}
}
function renderHistory() {
  const wrap = $("historyList");
  const h = loadHistory();
  $("clearHistoryBtn").hidden = h.length === 0;
  if (!h.length) {
    wrap.innerHTML = `<p class="hist-empty">No seasons yet. The gavel awaits.</p>`;
    return;
  }
  wrap.innerHTML = "";
  h.forEach((s, i) => {
    const item = el("div", "hist-item", `
      <span class="hist-main">
        <span class="hist-name"><span class="rival-dot" style="background:${s.color}; display:inline-block; margin-right:0.5rem"></span>${s.name}</span><br>
        <span class="hist-meta">${s.date} · purse ${s.purse}${s.finished ? ` · finished ${ordinal(s.finished)} in the league` : ""}${s.outcome ? ` · ${s.outcome}` : (s.perfect ? " · perfect season" : s.champion ? " · champions" : "")}</span>
      </span>
      <span class="hist-rec">${s.w}–${s.l}</span>
      <button class="hist-del" title="Remove this season" aria-label="Remove this season">&times;</button>`);
    item.querySelector(".hist-del").addEventListener("click", () => {
      const list = loadHistory();
      list.splice(i, 1);
      saveHistoryList(list);
      renderHistory();
    });
    wrap.appendChild(item);
  });
}
$("clearHistoryBtn").addEventListener("click", () => {
  if (!confirm("Clear all saved seasons? This cannot be undone.")) return;
  saveHistoryList([]);
  renderHistory();
});

// ============================================================
// Queue rail — next lots, click to jump one to the front
// ============================================================
function renderQueue() {
  const track = $("queueTrack");
  const up = upcomingLots(5);
  track.innerHTML = "";
  if (!up.length) { $("queueRail").style.display = "none"; return; }
  $("queueRail").style.display = "";
  up.forEach((lot, i) => {
    const c = lot.card;
    const chip = el("div", "queue-chip" + (i === 0 ? " qc-next" : ""), `
      <span class="qc-pos mono">${i + 1}</span>
      <span class="qc-ovr">${c.o}</span>
      <span><span class="qc-name">${c.n}</span><br><span class="qc-role">${ROLE_INFO[c.r].label} · '${String(c.y).slice(2)}</span></span>`);
    track.appendChild(chip);
  });
}

// ============================================================
// Toolbar: pause / speed / restart / browse-set / quick-auction
// ============================================================
$("pauseBtn").addEventListener("click", () => (PAUSED ? resumeAuction() : pauseAuction()));
$("speedBtn").addEventListener("click", () => {
  SPEED = SPEED === 1 ? 2 : SPEED === 2 ? 4 : 1;
  $("speedTxt").innerHTML = SPEED + "&times;";
  beep(500, 0.04, "square", 0.03);
});
$("restartBtn").addEventListener("click", () => {
  if (!confirm("Restart the auction with a fresh pool? Your current squad is lost.")) return;
  clearTimeout(aucTimer);
  PAUSED = false; SPEED = 1; resumeFn = null;
  $("speedTxt").innerHTML = "1&times;";
  $("pauseBtn").classList.remove("paused");
  $("pauseIco").innerHTML = "&#10073;&#10073;";
  $("pauseTxt").textContent = "Pause";
  G.user.squad = [];
  G.user.purse = G.user.purse0;
  G.rivals = RIVALS.map((r) => ({ ...r, purse: rivalPurse(), core: [], buys: [], maxBid: 0 }));
  buildAuctionPool();
  renderRivalsRail();
  renderSquadDrawer();
  renderSetDots();
  $("logList").innerHTML = "";
  log(`Fresh auction. ${G.flatLots.length} new lots on the block.`);
  showCatGate(0, true);
});

// Next category: confirm in a modal, then quick-sim the current set before moving on
$("nextCatBtn").addEventListener("click", () => {
  const next = nextPendingSet(G.curSet);
  if (next < 0) return;
  $("skipFromName").textContent = G.sets[G.curSet].name;
  $("skipFromName2").textContent = G.sets[G.curSet].name;
  $("skipToName").textContent = "the " + G.sets[next].name + " set";
  if (!PAUSED) pauseAuction();
  openModal("skipModal");
});
$("skipConfirmBtn").addEventListener("click", () => {
  closeModal("skipModal");
  clearTimeout(aucTimer);
  const fromName = G.sets[G.curSet].name;
  const n = quickSimSet(G.curSet);                 // finalise this category to the AI field
  renderRivalsRail();
  log(`You skip the rest of the <b>${fromName}</b> set. ${n} player${n !== 1 ? "s" : ""} quick-simmed to the field.`, "log-me");
  const next = nextPendingSet(G.curSet);
  if (next >= 0) { updateSetUI(); showCatGate(next); }
  else { showAuctionComplete(); }
});

// Prev category: read-only auction floor of the finished categories
$("prevCatBtn").addEventListener("click", () => {
  const done = G.setRanges.map((r, s) => s).filter((s) => G.setRanges[s].state === "done");
  if (!done.length) return;
  renderFloor(done);
  if (!PAUSED) pauseAuction();
  openModal("floorModal");
});
function renderFloor(doneSets) {
  const nm = (s) => G.sets[s].name;
  $("floorBody").innerHTML = doneSets.map((s) => `
    <div class="floor-cat">
      <p class="floor-cat-name">${nm(s)}</p>
      ${setFloor(s).map((row) => `
        <div class="floor-row">
          <span class="floor-player"><b>${row.card.n}</b><span class="floor-meta">${ROLE_INFO[row.card.r].label} &middot; ${row.card.o} OVR</span></span>
          <span class="floor-team"><span class="rival-dot" style="background:${row.color}"></span>${row.team}</span>
          <span class="floor-price mono">${row.price ? fmtMoney(row.price) : "&mdash;"}</span>
        </div>`).join("")}
    </div>`).join("");
}

$("browseSetBtn").addEventListener("click", () => {
  const set = G.sets[currentSetIndex()];
  $("setModalTitle").textContent = set.name + " set";
  const soldNames = new Set(
    G.user.squad.map((c) => c.n)
      .concat(G.rivals.flatMap((r) => r.buys.concat(r.core).map((c) => c.n)))
  );
  const sold = set.lots.filter((c) => soldNames.has(c.n)).length;
  $("setModalNote").textContent = `${set.lots.length} players in this set · ${sold} already gone. Plan your bids.`;
  const ul = $("setModalList");
  ul.innerHTML = "";
  set.lots.slice().sort((a, b) => b.o - a.o).forEach((c) => {
    const gone = soldNames.has(c.n);
    ul.appendChild(el("li", "set-row" + (gone ? " gone" : ""), `
      <span class="sr-ovr">${c.o}</span>
      <span><span class="sr-name">${c.n}</span><br><span class="sr-meta">${ROLE_INFO[c.r].label} · ${c.t} '${String(c.y).slice(2)}</span></span>
      <span class="sr-stat">${c.st || ""}</span>
      <span class="sr-tag${c.c !== "IN" ? " ovs" : ""}">${gone ? "SOLD" : c.c === "IN" ? "IND" : c.c}</span>`));
  });
  openModal("setModal");
  if (!PAUSED) pauseAuction();
});

// ---------- modals plumbing ----------
function openModal(id) {
  $(id).hidden = false;
  if (window.gsap) gsap.fromTo(`#${id} .modal-card`, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" });
}
function closeModal(id) { $(id).hidden = true; }
document.querySelectorAll("[data-close]").forEach((b) =>
  b.addEventListener("click", () => { closeModal(b.dataset.close); if (activeScreen === "auction") resumeAuction(); })
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelectorAll(".modal:not([hidden])").forEach((m) => (m.hidden = true));
});

// ---------- quick auction ----------
$("quickAucBtn").addEventListener("click", () => { updateQuickSummary(); openModal("quickModal"); if (!PAUSED) pauseAuction(); });
function updateQuickSummary() {
  let lo = +$("qMin").value, hi = +$("qMax").value;
  if (lo > hi) { $("qMax").value = lo; hi = lo; }
  $("qMinVal").textContent = fmtMoney(lo);
  $("qMaxVal").textContent = fmtMoney(hi);
  const have = G.user ? G.user.squad.length : 0;
  const need = Math.max(0, 15 - have);
  const purse = G.user ? G.user.purse : 10000;    // remaining money
  const worst = lo * need;
  const kept = have ? `Keeps your <b>${have}</b> signed so far and adds <b>${need}</b> more. ` : "";
  $("qSummary").innerHTML = purse !== Infinity && worst > purse
    ? `<span style="color:var(--bad)">${kept}Even at the floor that is ${fmtMoney(worst)} for ${need} — over your remaining ${fmtMoney(purse)}. Lower the minimum.</span>`
    : `${kept}Fills to a balanced fifteen, each new player ${fmtMoney(lo)} to ${fmtMoney(hi)}.`;
}
$("qMin").addEventListener("input", updateQuickSummary);
$("qMax").addEventListener("input", updateQuickSummary);
$("qBuildBtn").addEventListener("click", () => {
  const { squad, added, spent } = buildQuickSquad(+$("qMin").value, +$("qMax").value);
  G.user.squad = squad;
  if (G.user.purse !== Infinity) G.user.purse -= spent;
  closeModal("quickModal");
  clearTimeout(aucTimer);
  ensureSquadLegal(0);
  completeRivalSquads();      // rivals fill to 15 for a proper season
  enforceUniqueSquads();      // no player on two teams
  log(`Quick auction: ${added.length} player${added.length !== 1 ? "s" : ""} auto-signed for ${fmtMoney(spent)}${G.user.squad.length > added.length ? ", keeping your earlier buys" : ""}.`, "log-me");
  setTimeout(() => { initSquadScreen(); showScreen("squad"); }, 300);
});

// ============================================================
// CRICKET MOTION
// ============================================================
const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function playHeroCricket() {
  const els = [".hero-kicker", ".hero-h1", ".hero-sub", ".hero-ctas"]
    .map((s) => document.querySelector(s)).filter(Boolean);
  if (!window.gsap || reduceMotion) { els.forEach((e) => (e.style.opacity = 1)); return; }
  gsap.fromTo(els,
    { opacity: 0, y: 30, filter: "blur(10px)" },
    { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.05, ease: "power3.out", stagger: 0.13 });
}

let driftTimer = null;
function startPitchDrift() {
  if (reduceMotion) return;
  const fx = $("pitchFx");
  if (!fx) return;
  fx.innerHTML = "";
  clearInterval(driftTimer);
  driftTimer = setInterval(() => {
    if (activeScreen !== "auction") return;
    const d = el("span", "drift");
    d.style.left = (10 + Math.random() * 80) + "%";
    d.style.bottom = "-20px";
    const dur = 6 + Math.random() * 5;
    d.style.animation = `drift ${dur}s linear forwards`;
    fx.appendChild(d);
    setTimeout(() => d.remove(), dur * 1000 + 200);
  }, 1500);
}

function ballCelebration(mine) {
  if (reduceMotion || !window.gsap) return;
  const stage = document.querySelector(".auc-stage-core");
  if (!stage) return;
  const b = el("span", "seam-ball");
  b.style.cssText = "position:absolute;left:10%;top:70%;opacity:1;z-index:5;";
  stage.appendChild(b);
  gsap.to(b, { x: stage.clientWidth * 0.7, y: -stage.clientHeight * 0.5, rotate: 720, duration: 0.9, ease: "power2.out", onComplete: () => b.remove() });
  if (mine) { stage.classList.add("screen-flash"); setTimeout(() => stage.classList.remove("screen-flash"), 650); }
}

// ============================================================
// TAKE-STRIKE — top-down batting mini-game (canvas)
// ============================================================
(function pitchGame() {
  const cv = $("pitchGame");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  const PITCH_X = W / 2, PITCH_W = 74;
  const BAT_Y = 396, SWEET = 400, WIN_TOP = 364, WIN_BOT = 444;

  const S = {
    running: false, phase: "idle", // idle|runup|delivery|hit|wait
    t: 0, speed: 3.2, line: PITCH_X, missed: false,
    ball: { x: PITCH_X, y: 66, vx: 0, vy: 0 },
    bat: 0, batAnim: 0, lastRuns: 0, wait: 0,
    runs: 0, balls: 0, best: 0, raf: null,
  };
  try { S.best = +(localStorage.getItem("cricksim_bat_best") || 0); } catch (e) {}

  const hud = () => { $("gRuns").textContent = S.runs; $("gBalls").textContent = S.balls; $("gBest").textContent = S.best; };
  const feed = (txt, big) => { const f = $("gFeed"); f.textContent = txt; f.classList.toggle("big", !!big); };
  hud();

  function nextBall() {
    S.phase = "runup"; S.t = 0; S.missed = false;
    S.speed = 2.9 + Math.random() * 1.7;
    // ~55% of deliveries are aimed at the stumps (miss it = bowled); the rest go wide (safe to miss)
    S.onStumps = Math.random() < 0.55;
    S.line = S.onStumps
      ? PITCH_X + (Math.random() - 0.5) * 10
      : PITCH_X + (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * (PITCH_W / 2 - 14));
    S.ball.x = PITCH_X; S.ball.y = 60; S.ball.vx = S.ball.vy = 0;
  }
  const pop = (txt, cls, sub, persist) => {
    const p = $("gPop"); if (!p) return;
    clearTimeout(pop._t);
    p.innerHTML = `<span class="sp-main">${txt}</span>` + (sub ? `<span class="sp-sub">${sub}</span>` : "");
    p.className = "strike-pop show " + (cls || "") + (persist ? " hold" : "");
    if (!persist) pop._t = setTimeout(() => { p.className = "strike-pop"; }, 1100);
  };
  const clearPop = () => { const p = $("gPop"); if (p) p.className = "strike-pop"; };
  function start() {
    S.running = true; S.runs = 0; S.balls = 0; S.fours = 0; S.sixes = 0; S.phase = "runup";
    clearPop();
    feed("Here it comes..."); hud();
    $("gStart").querySelector("span").textContent = "Restart";
    $("gSwing").textContent = "Swing";
    nextBall();
    if (!S.raf) loop();
  }
  function swing() {
    if (!S.running) return;
    S.batAnim = 1;
    if (S.phase !== "delivery") { feed("Too early!"); return; }   // no ball at the bat yet
    const y = S.ball.y;
    if (y >= WIN_TOP && y <= WIN_BOT) {
      const q = Math.max(0.12, 1 - Math.abs(y - SWEET) / ((WIN_BOT - WIN_TOP) / 2));
      hit(q);
    } else {
      resolveMiss("swung");                                 // missed — out only if it hits the stumps
    }
  }
  // a miss is only OUT if the delivery was on the stumps; otherwise it's a safe dot ball
  function resolveMiss(reason) {
    const bowled = Math.abs(S.line - PITCH_X) <= 12;        // line heading at the stumps?
    if (bowled) { out(reason); return; }
    S.balls++;
    feed(reason === "swung" ? "Swing and a miss — but it's wide of the stumps. Safe!" : "Left it — missed the stumps. Safe!");
    pop("MISS", "miss");
    hud();
    S.phase = "wait"; S.wait = 40;                          // play on
  }
  function hit(q) {
    S.phase = "hit";
    const runs = q > 0.85 ? 6 : q > 0.6 ? 4 : q > 0.35 ? 2 : 1;
    if (runs === 6) S.sixes++; else if (runs === 4) S.fours++;
    S.runs += runs; S.balls++;
    if (S.runs > S.best) { S.best = S.runs; try { localStorage.setItem("cricksim_bat_best", S.best); } catch (e) {} }
    hud();
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15;
    const power = 8.5 + q * 7.5;
    S.ball.vx = Math.cos(ang) * power; S.ball.vy = Math.sin(ang) * power;
    feed(runs === 6 ? "SIX!" : runs === 4 ? "FOUR!" : runs + " runs", true);
    pop(runs === 6 ? "SIX!" : runs === 4 ? "FOUR!" : runs === 2 ? "2 runs" : runs + " run", "runs");
  }
  // getting out ends the innings: bank the best, reset runs, wait for "Play again"
  function out(reason) {
    if (!S.running) return;
    S.balls++;
    if (S.runs > S.best) { S.best = S.runs; try { localStorage.setItem("cricksim_bat_best", S.best); } catch (e) {} }
    S.running = false; S.phase = "out";
    // innings summary before the counter resets
    const how = reason === "left" ? "Bowled — left one that crashed into the stumps" : "Bowled through the gate";
    const summary = `${S.runs} off ${S.balls} ball${S.balls !== 1 ? "s" : ""} &middot; ${S.fours}&times;4 &middot; ${S.sixes}&times;6`;
    feed(`${how}. OUT!`);
    pop("YOU'RE OUT", "out", summary, true);                 // summary sits under the OUT text on the pitch
    S.runs = 0; hud();                                       // reset the run counter
    $("gSwing").textContent = "Play again";
  }

  function draw() {
    // field
    const g = ctx.createRadialGradient(W / 2, H * 0.5, 40, W / 2, H * 0.5, H * 0.7);
    g.addColorStop(0, "#123021"); g.addColorStop(1, "#0A1D14");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // boundary rope
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(W / 2, H / 2, W / 2 - 12, H / 2 - 14, 0, 0, Math.PI * 2); ctx.stroke();
    // pitch
    ctx.fillStyle = "#C9A97A"; ctx.globalAlpha = 0.9;
    ctx.fillRect(PITCH_X - PITCH_W / 2, 56, PITCH_W, 360);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
    ctx.strokeRect(PITCH_X - PITCH_W / 2, 56, PITCH_W, 360);
    // creases
    ctx.beginPath(); ctx.moveTo(PITCH_X - PITCH_W / 2, 84); ctx.lineTo(PITCH_X + PITCH_W / 2, 84);
    ctx.moveTo(PITCH_X - PITCH_W / 2, BAT_Y); ctx.lineTo(PITCH_X + PITCH_W / 2, BAT_Y); ctx.stroke();
    // stumps (batting end)
    ctx.strokeStyle = "#EFE7D6"; ctx.lineWidth = 2.5;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(PITCH_X + i * 6, 414); ctx.lineTo(PITCH_X + i * 6, 428); ctx.stroke(); }
    // bowler marker
    if (S.phase === "runup") {
      const p = Math.min(1, S.t / 26);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath(); ctx.arc(PITCH_X, 60 + p * 18, 6, 0, Math.PI * 2); ctx.fill();
    }
    // bat (pivot near batsman, right side)
    const pivotX = PITCH_X + 20, pivotY = BAT_Y + 6;
    const angle = -0.5 + (1 - S.batAnim) * 1.25 + Math.sin(Date.now() / 600) * 0.02;
    ctx.save(); ctx.translate(pivotX, pivotY); ctx.rotate(angle);
    ctx.fillStyle = "#E4B454"; ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(-4, -46, 8, 40); ctx.strokeRect(-4, -46, 8, 40);
    ctx.fillStyle = "#8a6a2f"; ctx.fillRect(-2.5, -8, 5, 16);
    ctx.restore();
    // batsman dot
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath(); ctx.arc(PITCH_X, BAT_Y + 6, 6, 0, Math.PI * 2); ctx.fill();
    // ball
    if (S.phase === "delivery" || S.phase === "hit") {
      ctx.beginPath(); ctx.arc(S.ball.x, S.ball.y, 7, 0, Math.PI * 2);
      const bg = ctx.createRadialGradient(S.ball.x - 2, S.ball.y - 2, 1, S.ball.x, S.ball.y, 7);
      bg.addColorStop(0, "#F6D488"); bg.addColorStop(1, "#B0271A");
      ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(S.ball.x, S.ball.y, 7, -0.6, 0.9); ctx.stroke();
    }
  }

  function step() {
    if (S.batAnim > 0) S.batAnim = Math.max(0, S.batAnim - 0.12);
    if (S.phase === "runup") { S.t++; if (S.t > 26) S.phase = "delivery"; }
    else if (S.phase === "delivery") {
      S.ball.y += S.speed; S.ball.x += (S.line - S.ball.x) * 0.08;
      if (S.ball.y > 452) resolveMiss("left");         // left it — out only if it hits the stumps
    } else if (S.phase === "hit") {
      S.ball.x += S.ball.vx; S.ball.y += S.ball.vy; S.ball.vy *= 0.99;
      if (S.ball.x < -16 || S.ball.x > W + 16 || S.ball.y < -16) { S.phase = "wait"; S.wait = 40; }
    } else if (S.phase === "wait") {
      if (--S.wait <= 0) { if (S.running) nextBall(); else S.phase = "idle"; }
    }
  }

  function canRun() { return S.running && activeScreen === "landing" && !document.hidden; }
  function loop() {
    step(); draw();
    S.raf = canRun() ? requestAnimationFrame(loop) : null;
  }
  function kick() { if (canRun() && !S.raf) loop(); }

  // input — when out, the same action becomes "play again"
  const act = (e) => { if (e) e.preventDefault(); if (S.phase === "out" || !S.running) start(); else swing(); };
  cv.addEventListener("click", act);
  $("gSwing").addEventListener("click", act);
  $("gStart").addEventListener("click", start);
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && activeScreen === "landing") { e.preventDefault(); act(); }
  });
  document.addEventListener("visibilitychange", kick);
  window.addEventListener("cricksim:landing", kick); // resumed when returning to landing
  draw(); // paint idle frame

  // debug hook (harmless): lets automated checks tick the sim without rAF
  window.__pitch = {
    start, swing,
    tick(n) { for (let i = 0; i < n; i++) step(); draw(); return { phase: S.phase, y: Math.round(S.ball.y), runs: S.runs, balls: S.balls }; },
    state: () => ({ phase: S.phase, y: Math.round(S.ball.y), runs: S.runs, balls: S.balls, best: S.best }),
  };
})();

// kick off the hero animation on first load
playHeroCricket();
