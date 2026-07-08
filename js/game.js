// ============================================================
// CrickSim — game engine (no DOM in this file)
// Money is handled internally in LAKHS. 100 lakh = 1 crore.
// ============================================================

// ---------- tiny utils ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function fmtMoney(l) {
  if (l === Infinity) return "∞";
  if (l >= 100) return "₹" + (l / 100).toFixed(2).replace(/\.00$/, "") + "cr";
  return "₹" + Math.round(l) + "L";
}

// ---------- static config ----------
const COST_MULT = 0.8; // player costs cut 20% across the board

// ---------- static config ----------
const ROLE_INFO = {
  OPN: { label: "Opener",        subs: ["Power", "Anchor", "vs Spin"] },
  MID: { label: "Middle Order",  subs: ["Power", "Anchor", "vs Spin"] },
  WK:  { label: "Keeper-Bat",    subs: ["Power", "Anchor", "Gloves"] },
  AR:  { label: "All-Rounder",   subs: ["Batting", "Bowling", "Death"] },
  PAC: { label: "Pace",          subs: ["New Ball", "Death", "Economy"] },
  SPN: { label: "Spin",          subs: ["Turn", "Control", "Economy"] },
};

const PURSE_OPTIONS = [
  { label: "₹50cr", v: 5000, hint: "Brutal. Every crore is a knife fight." },
  { label: "₹75cr", v: 7500, hint: "Tight. You can afford two stars, not five." },
  { label: "₹100cr", v: 10000, hint: "The classic IPL purse. Recommended." },
  { label: "₹125cr", v: 12500, hint: "Comfortable. The rivals will still fight you." },
  { label: "Unlimited", v: Infinity, hint: "Sandbox mode. You always win the bid — the simulation still judges you honestly." },
];

const TEAM_COLORS = [
  { name: "Auction Gold", v: "#E4B454" },
  { name: "Royal Blue",   v: "#4A7DFF" },
  { name: "Teal Surge",   v: "#2EC5B6" },
  { name: "Crimson",      v: "#E14B5A" },
  { name: "Violet",       v: "#8B5CF6" },
  { name: "Ember Orange", v: "#F0742E" },
  { name: "Emerald",      v: "#35C271" },
  { name: "Neon Pink",    v: "#E85B9A" },
];

// 9 real-inspired rival franchises. `aff` maps to the historical
// abbreviations whose players they prefer re-signing (retained cores).
const RIVALS = [
  { id: "CHK", name: "Chennai Kings",         color: "#F5C21B", aff: ["CSK"],          roles: ["AR", "SPN"], marquee: 1.0,  bargain: 1.0,  chaos: 0.05, blurb: "calm, veteran loyalty, ruthless late" },
  { id: "MBT", name: "Mumbai Titans",         color: "#2E6BE6", aff: ["MI"],           roles: ["PAC"],       marquee: 1.35, bargain: 0.9,  chaos: 0.08, blurb: "deep pockets, marquee hunters" },
  { id: "BLC", name: "Bengaluru Challengers", color: "#D3273E", aff: ["RCB"],          roles: ["OPN", "MID"],marquee: 1.25, bargain: 0.85, chaos: 0.12, blurb: "star batters or nothing" },
  { id: "KOL", name: "Kolkata Knights",       color: "#6C4BC1", aff: ["KKR"],          roles: ["SPN", "AR"], marquee: 0.95, bargain: 1.2,  chaos: 0.1,  blurb: "mystery spin and bargains" },
  { id: "HYD", name: "Hyderabad Risers",      color: "#F0742E", aff: ["SRH", "DEC"],   roles: ["PAC", "SPN"],marquee: 0.9,  bargain: 1.1,  chaos: 0.07, blurb: "bowling wins titles" },
  { id: "DEL", name: "Delhi Dynamos",         color: "#2A9BD6", aff: ["DC", "DD"],     roles: ["OPN", "WK"], marquee: 0.95, bargain: 1.05, chaos: 0.15, blurb: "young, fearless, streaky" },
  { id: "JPR", name: "Jaipur Royals",         color: "#E85B9A", aff: ["RR"],           roles: ["OPN", "AR"], marquee: 0.75, bargain: 1.35, chaos: 0.06, blurb: "moneyball, never overpays" },
  { id: "PBP", name: "Punjab Panthers",       color: "#C21F2F", aff: ["PBKS", "KXIP"], roles: ["MID", "PAC"],marquee: 1.15, bargain: 0.9,  chaos: 0.22, blurb: "chaotic, will bid on anything" },
  { id: "GJG", name: "Gujarat Giants",        color: "#1F3B63", aff: ["GT", "GL"],     roles: ["AR", "PAC"], marquee: 1.0,  bargain: 1.1,  chaos: 0.08, blurb: "quietly builds champions" },
];

// XI slot map: which roles a slot accepts
const XI_SLOTS = [
  { id: 0,  pos: "Opener",      accepts: ["OPN", "WK", "MID"] },
  { id: 1,  pos: "Opener",      accepts: ["OPN", "WK", "MID"] },
  { id: 2,  pos: "No. 3",       accepts: ["MID", "OPN", "WK"] },
  { id: 3,  pos: "No. 4",       accepts: ["MID", "WK", "AR", "OPN"] },
  { id: 4,  pos: "No. 5",       accepts: ["MID", "WK", "AR"] },
  { id: 5,  pos: "Finisher",    accepts: ["AR", "MID", "WK"] },
  { id: 6,  pos: "All-rounder", accepts: ["AR", "SPN", "PAC"] },
  { id: 7,  pos: "Pace",        accepts: ["PAC", "AR"] },
  { id: 8,  pos: "Pace / Seam", accepts: ["PAC", "AR", "SPN"] },
  { id: 9,  pos: "Spin",        accepts: ["SPN", "AR"] },
  { id: 10, pos: "Spin / Pace", accepts: ["SPN", "PAC"] },
];

const SQUAD_CAP = 15;
const OVERSEAS_SQUAD_CAP = 8;
const OVERSEAS_XI_CAP = 4;

// ---------- global game state ----------
const G = {
  user: null,       // {name, city, color, purse, purse0, squad:[], xi:[]}
  rivals: [],       // [{...RIVAL, purse, core:[], buys:[]}]
  sets: [],         // [{name, lots:[card]}]
  flatLots: [],
  lotIndex: -1,
  bid: null,        // {card, price, leader, nextInc}
  season: null,
  soundOn: true,
};

// ---------- auction construction ----------
function cardKey(c) { return c.n + "|" + c.y; }

let _poolNormalized = false;
function normalizePool() {
  if (_poolNormalized) return;
  _poolNormalized = true;
  for (const c of PLAYER_POOL) c.b = Math.max(20, Math.round((c.b * COST_MULT) / 5) * 5);
}

function buildAuctionPool() {
  normalizePool();
  // group all cards by player name, we will use max ONE season per player
  const byName = new Map();
  for (const c of PLAYER_POOL) {
    if (!byName.has(c.n)) byName.set(c.n, []);
    byName.get(c.n).push(c);
  }
  const usedNames = new Set();

  // one card per player = their PEAK season (highest overall), honoring
  // "no different variations of the same player" in a single auction.
  const peakOf = (cards, filter) => {
    const ok = cards.filter(filter);
    if (!ok.length) return null;
    return ok.slice().sort((a, b) => b.o - a.o)[0];
  };

  const takeFrom = (filter, n, sortBoost) => {
    let cands = [];
    for (const [name, cards] of byName) {
      if (usedNames.has(name)) continue;
      const best = peakOf(cards, filter);
      if (best) cands.push(best);
    }
    cands = shuffle(cands);
    if (sortBoost) cands.sort((a, b) => sortBoost(b) - sortBoost(a));
    const taken = cands.slice(0, n);
    taken.forEach((c) => usedNames.add(c.n));
    return taken;
  };

  const maxSub = (c) => Math.max(...c.s);
  const setDefs = [
    { name: "Marquee",         take: () => takeFrom((c) => c.o >= 93, 6, (c) => c.o + rnd(0, 4)) },
    { name: "Openers",         take: () => takeFrom((c) => c.r === "OPN" && c.o >= 82 && c.o <= 92, 6) },
    { name: "Middle Order",    take: () => takeFrom((c) => c.r === "MID" && c.o >= 80 && c.o <= 92, 6) },
    { name: "Wicketkeepers",   take: () => takeFrom((c) => c.r === "WK" && c.o >= 76, 4) },
    { name: "All-Rounders",    take: () => takeFrom((c) => c.r === "AR" && c.o >= 80, 7) },
    { name: "Pace Battery",    take: () => takeFrom((c) => c.r === "PAC" && c.o >= 80, 7) },
    { name: "Spin Kings",      take: () => takeFrom((c) => c.r === "SPN" && c.o >= 78, 6) },
    { name: "Overseas Stars",  take: () => takeFrom((c) => c.c !== "IN" && c.o >= 86, 4, (c) => c.o + rnd(0, 6)) },
    { name: "Hidden Gems",     take: () => takeFrom((c) => c.o >= 68 && c.o <= 80 && maxSub(c) >= 84, 4) },
  ];

  G.sets = [];
  for (const def of setDefs) {
    let lots = def.take();
    // relax if a set came up short
    if (lots.length < 4) {
      const extra = takeFrom((c) => c.o >= 74, 4 - lots.length);
      lots = lots.concat(extra);
    }
    G.sets.push({ name: def.name, lots: shuffle(lots) });
  }
  G.flatLots = G.sets.flatMap((s) => s.lots.map((c) => ({ card: c, set: s.name, sold: false })));
  G.lotIndex = -1;
  // flatLots is built in set order, so each set owns a contiguous index range.
  // `cur` is that set's resume cursor for navigation (skip / go back).
  G.setRanges = [];
  let _off = 0;
  // state: 'pending' (not started) | 'live' (auctioning now) | 'done' (finished/quick-simmed)
  for (const s of G.sets) { G.setRanges.push({ name: s.name, start: _off, end: _off + s.lots.length, cur: _off, state: "pending" }); _off += s.lots.length; }
  G.curSet = 0;

  // rival retained cores from players NOT in the lots
  for (const r of G.rivals) {
    r.core = [];
    const wants = [];
    for (const [name, cards] of byName) {
      if (usedNames.has(name)) continue;
      const best = cards.slice().sort((a, b) => b.o - a.o)[0];
      let score = best.o + rnd(-3, 3);
      if (r.aff.includes(best.t)) score += 9;               // franchise loyalty
      if (r.roles.includes(best.r)) score += 4;             // identity bias
      wants.push({ card: best, score });
    }
    wants.sort((a, b) => b.score - a.score);
    let ovs = 0;
    for (const w of wants) {
      if (r.core.length >= 10) break;
      if (usedNames.has(w.card.n)) continue;
      const isOvs = w.card.c !== "IN";
      if (isOvs && ovs >= 5) continue;
      r.core.push(w.card);
      if (isOvs) ovs++;
      usedNames.add(w.card.n);
    }
  }
}

// ---------- bidding ----------
function bidIncrement(price) {
  if (price < 100) return 10;
  if (price < 200) return 20;
  if (price < 500) return 25;
  if (price < 1000) return 50;
  return 100;
}

function priceCurve(o) {
  let v;
  if (o >= 96) v = rnd(1800, 2600);
  else if (o >= 93) v = rnd(1300, 2000);
  else if (o >= 90) v = rnd(950, 1500);
  else if (o >= 87) v = rnd(650, 1100);
  else if (o >= 84) v = rnd(400, 750);
  else if (o >= 80) v = rnd(220, 450);
  else if (o >= 75) v = rnd(90, 250);
  else v = rnd(40, 120);
  return v * COST_MULT;
}

function rivalGroupCount(r, role) {
  return r.core.concat(r.buys).filter((c) => c.r === role).length;
}

function rivalNeedMult(r, card) {
  const targets = { OPN: 3, MID: 3, WK: 2, AR: 3, PAC: 3, SPN: 2 };
  const have = rivalGroupCount(r, card.r);
  const want = targets[card.r] || 2;
  if (have < want - 1) return 1.3;
  if (have < want) return 1.1;
  return 0.55;
}

// upcoming PENDING lots in the CURRENT (live) set only — the auction runs one category at a time
function upcomingLots(n) {
  const out = [];
  const r = G.setRanges[G.curSet];
  for (let i = G.lotIndex + 1; i < r.end && out.length < n; i++) if (!G.flatLots[i].sold) out.push(G.flatLots[i]);
  return out;
}
// next pending lot within the current set (from its cursor); null when the set is done
function nextLotInCurrentSet() {
  const r = G.setRanges[G.curSet];
  for (let i = Math.max(r.cur, r.start); i < r.end; i++) if (!G.flatLots[i].sold) { r.cur = i; return i; }
  return null;
}
function setHasPending(s) {
  const r = G.setRanges[s];
  for (let i = r.start; i < r.end; i++) if (!G.flatLots[i].sold) return true;
  return false;
}
function pendingLotCount() { return G.flatLots.filter((l) => !l.sold).length; }
// first set index (after `from`) that still needs to be auctioned
function nextPendingSet(from) {
  for (let s = from + 1; s < G.setRanges.length; s++) if (G.setRanges[s].state !== "done" && setHasPending(s)) return s;
  return -1;
}
// quick-sim a whole category: auto-sell its remaining lots to the AI field, record winners
function quickSimSet(s) {
  const r = G.setRanges[s];
  let n = 0;
  for (let i = r.start; i < r.end; i++) {
    const l = G.flatLots[i];
    if (l.sold) continue;
    const res = autoAssignToRival(l.card);
    l.sold = true;
    l.wonBy = res ? res.rival.name : "Unsold";
    l.wonColor = res ? res.rival.color : "#888";
    l.price = res ? res.price : 0;
    n++;
  }
  r.state = "done";
  return n;
}
// finalise + hand every remaining pending lot to a rival (used by Finish)
function assignRemainingToRivals() {
  let n = 0;
  for (let s = 0; s < G.setRanges.length; s++) if (setHasPending(s)) n += quickSimSet(s);
  return n;
}
// read-only "auction floor" for a finished category: who got each player
function setFloor(s) {
  const r = G.setRanges[s];
  const rows = [];
  for (let i = r.start; i < r.end; i++) {
    const l = G.flatLots[i];
    rows.push({ card: l.card, team: l.wonBy || (l.sold ? "Sold" : "—"), color: l.wonColor || "#888", price: l.price || 0 });
  }
  return rows;
}

function startLot(idx) {
  if (idx == null || idx < 0 || idx >= G.flatLots.length) return null;
  G.lotIndex = idx;
  const { card, set } = G.flatLots[G.lotIndex];
  // each rival privately decides a walk-away price for this lot
  for (const r of G.rivals) {
    if (r.buys.length >= 5 || r.purse < card.b) { r.maxBid = 0; continue; }
    let v = priceCurve(card.o);
    v *= rivalNeedMult(r, card);
    if (card.o >= 90) v *= r.marquee;
    if (card.o < 82) v *= r.bargain;
    if (r.roles.includes(card.r)) v *= 1.12;
    if (r.aff.includes(card.t)) v *= 1.15;                  // wants its old hero back
    v *= rnd(1 - r.chaos, 1 + r.chaos * 1.6);
    // won't spend more than 65% of remaining purse on one player
    r.maxBid = Math.min(v, r.purse * 0.65);
    // some rivals simply skip lots they don't care about
    if (Math.random() < 0.18 && card.o < 90) r.maxBid = 0;
  }
  G.bid = { card, set, price: card.b, leader: null, sold: false };
  return G.bid;
}

// which rival (if any) wants to top the current bid
function aiChallenger() {
  const b = G.bid;
  const next = b.leader === null ? b.price : b.price + bidIncrement(b.price);
  const keen = G.rivals.filter(
    (r) => r !== b.leader && r.maxBid >= next && r.purse >= next && r.buys.length < 5
  );
  if (!keen.length) return null;
  keen.sort((a, x) => (x.maxBid - next) - (a.maxBid - next));
  // the keenest usually bids, others sometimes jump in
  const who = Math.random() < 0.75 ? keen[0] : pickOne(keen);
  return who;
}

function placeBid(who) {
  const b = G.bid;
  b.price = b.leader === null ? b.price : b.price + bidIncrement(b.price);
  b.leader = who; // null-> now user object or rival object
}

// place a specific custom amount (used by the user's +/- stepper)
function placeBidAmount(who, amount) {
  const b = G.bid;
  b.price = amount;
  b.leader = who;
}
// smallest legal next bid on the current lot
function minNextBid() {
  const b = G.bid;
  return b.leader === null || b.leader === G.user ? b.price : b.price + bidIncrement(b.price);
}

function userCanBid() {
  const b = G.bid;
  const next = b.leader === null ? b.price : b.price + bidIncrement(b.price);
  const u = G.user;
  if (u.squad.length >= SQUAD_CAP) return { ok: false, why: "Squad full (15)" };
  if (b.card.c !== "IN" && u.squad.filter((c) => c.c !== "IN").length >= OVERSEAS_SQUAD_CAP)
    return { ok: false, why: "Overseas cap reached (8)" };
  if (u.purse < next) return { ok: false, why: "Not enough purse" };
  return { ok: true, next };
}

function sellLot() {
  const b = G.bid;
  b.sold = true;
  const lot = G.flatLots[G.lotIndex];
  if (lot) { lot.sold = true; lot.price = b.price; }               // mark the lot done + record price
  if (!b.leader) { if (lot) { lot.wonBy = "Unsold"; lot.wonColor = "#888"; } return { unsold: true, card: b.card }; }
  if (b.leader === G.user) {
    if (lot) { lot.wonBy = G.user.name; lot.wonColor = G.user.color; }
    G.user.squad.push({ ...b.card, paid: b.price });
    if (G.user.purse !== Infinity) G.user.purse -= b.price;
    return { mine: true, card: b.card, price: b.price };
  }
  if (lot) { lot.wonBy = b.leader.name; lot.wonColor = b.leader.color; }
  b.leader.buys.push(b.card);
  b.leader.purse -= b.price;
  return { mine: false, rival: b.leader, card: b.card, price: b.price };
}

// auto-assign a skipped lot to a rival that still needs players
function autoAssignToRival(card) {
  const needy = G.rivals.filter((r) => r.buys.length < 5 && r.purse >= card.b);
  if (!needy.length) return null;
  needy.sort((a, b) => rivalNeedMult(b, card) - rivalNeedMult(a, card) + rnd(-0.1, 0.1));
  const r = needy[0];
  const paid = Math.min(Math.round(card.b * rnd(1, 1.4)), r.purse);
  r.buys.push(card);
  r.purse -= paid;
  return { rival: r, price: paid };
}

// fill an under-bought user squad with honest journeymen
const FILLER_NAMES = [
  "Dev Chauhan", "Arjun Bedi", "Ravi Ekka", "Kunal Deshmukh", "Sandeep Riyan",
  "Mohit Talwar", "Ishan Rawte", "Prakash Vaidya", "Aakash Munde", "Zubin Kalsi",
  "Tejas Bhonsle", "Nirmal Ghatge", "Yash Adhikari", "Sameer Kotak", "Harsh Vora",
];
function fillerCard(role, i) {
  const o = ri(58, 64);
  return { n: FILLER_NAMES[i % FILLER_NAMES.length], c: "IN", r: role, y: 2026, t: "UNC",
    o, s: [o - ri(0, 5), o - ri(0, 5), o - ri(0, 5)], b: 20, paid: 0, filler: true };
}
function completeUserSquad() {
  const u = G.user;
  const needRole = () => {
    const has = (r) => u.squad.filter((c) => c.r === r).length;
    if (!has("WK")) return "WK";
    if (has("PAC") < 2) return "PAC";
    if (has("SPN") < 1) return "SPN";
    if (has("OPN") < 2) return "OPN";
    if (has("AR") < 2) return "AR";
    return pickOne(["MID", "PAC", "AR"]);
  };
  let i = 0;
  const added = [];
  while (u.squad.length < 11 + 4) { // always land on 15
    if (u.squad.length >= SQUAD_CAP) break;
    const card = fillerCard(needRole(), i++);
    u.squad.push(card);
    added.push(card);
  }
  // league rules: a playable XI must be possible. If an essential role is
  // missing from a full squad, a reserve of that role replaces the most
  // expendable player.
  const swapped = ensureSquadLegal(i);
  return added.concat(swapped);
}

function ensureSquadLegal(fillerIdx) {
  const u = G.user;
  const cnt = (r) => u.squad.filter((c) => c.r === r).length;
  const bats = () => cnt("OPN") + cnt("MID") + cnt("WK");
  const mins = { WK: 1, PAC: 2, SPN: 1 };
  const swapped = [];
  let guard = 0;
  const deficits = () => {
    const d = [];
    if (cnt("WK") < mins.WK) d.push("WK");
    if (cnt("PAC") < mins.PAC) d.push("PAC");
    if (cnt("SPN") < mins.SPN) d.push("SPN");
    if (bats() < 4) d.push(cnt("OPN") < 2 ? "OPN" : "MID");
    return d;
  };
  while (guard++ < 8) {
    const d = deficits();
    if (!d.length) break;
    const role = d[0];
    // most expendable: lowest-rated player whose role sits above its floor
    const canDrop = (c) => {
      const floor = mins[c.r] || 0;
      if (cnt(c.r) <= floor) return false;
      if (["OPN", "MID", "WK"].includes(c.r) && bats() <= 4) return false;
      return true;
    };
    const victim = u.squad.slice().sort((a, b) => a.o - b.o).find(canDrop);
    if (!victim) break;
    u.squad.splice(u.squad.indexOf(victim), 1);
    if (G.user.purse !== Infinity && victim.paid) G.user.purse += victim.paid; // refund
    const sub = fillerCard(role, fillerIdx + guard);
    sub.swappedFor = victim.n;
    u.squad.push(sub);
    swapped.push(sub);
  }
  return swapped;
}

// ---------- Quick Auction: KEEP the user's existing signings, auto-fill the rest ----------
// Reads G.user.squad (already-bought players) and G.user.purse (remaining money).
// Only adds the missing players to reach a balanced 15, within the price band.
function buildQuickSquad(minPer, maxPer) {
  normalizePool();
  const existing = G.user.squad.slice();
  if (existing.length >= SQUAD_CAP) return { squad: existing, added: [], spent: 0 };

  const byName = new Map();
  for (const c of PLAYER_POOL) {
    if (!byName.has(c.n)) byName.set(c.n, []);
    byName.get(c.n).push(c);
  }
  // exclude players you already own AND anyone on a rival roster
  const taken = new Set(
    existing.map((c) => c.n).concat(G.rivals.flatMap((r) => r.core.concat(r.buys).map((c) => c.n)))
  );
  const peaks = [...byName.values()]
    .map((cs) => cs.slice().sort((a, b) => b.o - a.o)[0])
    .filter((c) => !taken.has(c.n));
  const priceFor = (o) => clamp(Math.round(priceCurve(o) / 5) * 5, minPer, maxPer);

  const squad = existing.slice();
  const used = new Set(squad.map((c) => c.n));
  let ovs = squad.filter((c) => c.c !== "IN").length;
  const inf = G.user.purse === Infinity;
  const remaining = inf ? Infinity : G.user.purse;
  let spent = 0;

  // fill role deficits first (legal XI), then round out the 15 with the thinnest roles
  const has = (r) => squad.filter((c) => c.r === r).length;
  const targets = { WK: 1, PAC: 3, SPN: 1, AR: 2, OPN: 2, MID: 3 };
  const nextRole = () => {
    for (const r of ["WK", "PAC", "SPN", "AR", "OPN", "MID"]) if (has(r) < targets[r]) return r;
    return ["OPN", "MID", "WK", "AR", "PAC", "SPN"].sort((a, b) => has(a) - has(b))[0];
  };

  while (squad.length < SQUAD_CAP) {
    const role = nextRole();
    const slotsLeft = SQUAD_CAP - squad.length;
    const reserve = (slotsLeft - 1) * minPer;
    const budgetLeft = inf ? Infinity : remaining - spent;
    const cap = inf ? maxPer : Math.max(minPer, Math.min(maxPer, budgetLeft - reserve));
    const canOvs = (c) => c.c === "IN" || ovs < OVERSEAS_SQUAD_CAP;
    let pick = peaks.filter((c) => !used.has(c.n) && c.r === role && canOvs(c) && priceFor(c.o) <= cap)
      .sort((a, b) => b.o - a.o)[0];
    if (!pick) pick = peaks.filter((c) => !used.has(c.n) && c.r === role && canOvs(c))
      .sort((a, b) => priceFor(a.o) - priceFor(b.o))[0];
    if (!pick) pick = peaks.filter((c) => !used.has(c.n) && canOvs(c))     // any role, cheapest
      .sort((a, b) => priceFor(a.o) - priceFor(b.o))[0];
    if (!pick) break;
    let paid = priceFor(pick.o);
    if (!inf) paid = Math.round(Math.max(0, Math.min(paid, budgetLeft - reserve)));
    else paid = Math.round(paid);
    used.add(pick.n);
    if (pick.c !== "IN") ovs++;
    const card = { ...pick, paid };
    squad.push(card);
    spent += paid;
  }
  return { squad, added: squad.slice(existing.length), spent };
}

// rivals top up their 15 from leftovers (cheap, off-screen)
function completeRivalSquads() {
  for (const r of G.rivals) {
    let i = 3;
    while (r.core.length + r.buys.length < 15) {
      const roles = ["OPN", "MID", "PAC", "SPN", "AR", "WK"];
      const have = {};
      r.core.concat(r.buys).forEach((c) => (have[c.r] = (have[c.r] || 0) + 1));
      const role = roles.sort((a, b) => (have[a] || 0) - (have[b] || 0))[0];
      const o = ri(62, 70);
      r.buys.push({ n: r.name.split(" ")[0] + " Reserve " + i, c: "IN", r: role, y: 2026, t: "UNC",
        o, s: [o - 3, o - 3, o - 3], filler: true });
      i++;
    }
  }
}

// hard guarantee: no player name appears on more than one franchise.
// User keeps their signings (claimed first); rival duplicates become reserves.
function enforceUniqueSquads() {
  const seen = new Set();
  let fi = 0;
  const dedup = (arr) => {
    for (let i = 0; i < arr.length; i++) {
      const c = arr[i];
      if (!c) continue;
      if (seen.has(c.n)) arr[i] = fillerCard(c.r, fi++);
      else seen.add(c.n);
    }
  };
  dedup(G.user.squad);
  for (const r of G.rivals) { dedup(r.core); dedup(r.buys); }
}

// ---------- team strength / phases ----------
function batScore(c) { // generic batting value of a card
  if (c.r === "AR") return c.s[0];
  if (c.r === "PAC" || c.r === "SPN") return 35;
  return c.o;
}
function computePhases(xi) {
  const by = (r) => xi.filter((c) => c.r === r);
  const sortD = (arr, f) => arr.slice().sort((a, b) => f(b) - f(a));

  const bats = xi.filter((c) => ["OPN", "MID", "WK"].includes(c.r));
  const ars = by("AR");

  // powerplay batting: two best opening options
  const openers = sortD(by("OPN").length >= 2 ? by("OPN") : bats, (c) => c.o).slice(0, 2);
  const ppBat = openers.length
    ? openers.reduce((s, c) => s + c.o * 0.6 + c.s[0] * 0.4, 0) / openers.length
    : 35;

  // middle overs batting: anchors of MID/WK + AR batting
  const midGroup = bats.filter((c) => c.r !== "OPN").concat(ars);
  const midBat = midGroup.length
    ? sortD(midGroup, (c) => batScore(c)).slice(0, 4).reduce((s, c) => s + (c.r === "AR" ? c.s[0] : c.o * 0.55 + c.s[1] * 0.45), 0) / Math.min(4, midGroup.length)
    : 35;

  // death hitting: two biggest power ratings among bats/ARs
  const hitters = sortD(bats.concat(ars), (c) => (c.r === "AR" ? c.s[0] : c.s[0])).slice(0, 2);
  const deathBat = hitters.length ? hitters.reduce((s, c) => s + c.s[0], 0) / hitters.length : 35;

  // new ball: two best pacers
  const pacs = sortD(by("PAC"), (c) => c.o * 0.5 + c.s[0] * 0.5).slice(0, 2);
  const nbBowl = pacs.length === 2
    ? pacs.reduce((s, c) => s + c.o * 0.5 + c.s[0] * 0.5, 0) / 2
    : pacs.length === 1 ? (pacs[0].o * 0.5 + pacs[0].s[0] * 0.5) * 0.82 : 30;

  // middle overs spin: spinners + AR bowling
  const spins = by("SPN").concat(ars.filter((c) => c.s[1] >= 70));
  const spinBowl = spins.length
    ? sortD(spins, (c) => (c.r === "SPN" ? c.o : c.s[1] - 6)).slice(0, 2)
        .reduce((s, c) => s + (c.r === "SPN" ? c.o : c.s[1] - 6), 0) / Math.min(2, spins.length)
    : 32;

  // death bowling: best death skills among PAC (s[1]) and AR (s[2])
  const deathCands = by("PAC").map((c) => c.s[1]).concat(ars.map((c) => c.s[2]));
  deathCands.sort((a, b) => b - a);
  const deathBowl = deathCands.length >= 2 ? (deathCands[0] + deathCands[1]) / 2
    : deathCands.length === 1 ? deathCands[0] * 0.8 : 28;

  // glovework
  const wks = by("WK");
  const glove = wks.length ? Math.max(...wks.map((c) => c.s[2])) : 34;

  const depth = xi.reduce((s, c) => s + c.o, 0) / xi.length;

  return {
    "Powerplay batting": ppBat,
    "Middle-overs batting": midBat,
    "Death hitting": deathBat,
    "New-ball attack": nbBowl,
    "Spin control": spinBowl,
    "Death bowling": deathBowl,
    "Glovework": glove,
    "Squad depth": depth,
  };
}

function teamStrength(phases) {
  const vals = Object.values(phases);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const min = Math.min(...vals);
  return mean * 0.56 + min * 0.44; // the weak link drags hard
}

// auto-select a legal-ish XI for AI squads
function autoXI(squad) {
  const sorted = squad.slice().sort((a, b) => b.o - a.o);
  const xi = [];
  const count = (f) => xi.filter(f).length;
  const wk = sorted.find((c) => c.r === "WK");
  if (wk) xi.push(wk);
  for (const need of [["PAC", 2], ["SPN", 1], ["OPN", 2], ["AR", 1]]) {
    for (const c of sorted) {
      if (xi.includes(c)) continue;
      if (c.r === need[0] && count((x) => x.r === need[0]) < need[1]) {
        if (c.c !== "IN" && count((x) => x.c !== "IN") >= OVERSEAS_XI_CAP) continue;
        xi.push(c);
      }
    }
  }
  for (const c of sorted) {
    if (xi.length >= 11) break;
    if (xi.includes(c)) continue;
    if (c.c !== "IN" && count((x) => x.c !== "IN") >= OVERSEAS_XI_CAP) continue;
    xi.push(c);
  }
  return xi.slice(0, 11);
}

// a card played out of its natural slot role: penalised and re-tagged to the
// slot's primary role, so the season sim reflects the mismatch. Always clones.
const OOP_PENALTY = 12;
function effectiveCard(card, slot) {
  const c = { ...card, s: card.s.slice() };
  if (!slot.accepts.includes(card.r)) {
    c.trueRole = card.r;
    c.r = slot.accepts[0];
    c.o = Math.max(50, card.o - OOP_PENALTY);
    c.s = card.s.map((x) => Math.max(45, x - OOP_PENALTY));
    c.outOfPos = true;
  }
  return c;
}
// build the sim-ready XI from slot assignments; if there's no keeper, the best
// anchor keeps wicket as a makeshift (glovework takes a hit).
function buildEffectiveXI(xiMap) {
  const xi = [];
  xiMap.forEach((c, i) => { if (c) xi.push(effectiveCard(c, XI_SLOTS[i])); });
  if (xi.length && !xi.some((c) => c.r === "WK")) {
    const cands = xi.filter((c) => !["PAC", "SPN"].includes(c.trueRole || c.r));
    const keeper = (cands.length ? cands : xi).slice().sort((a, b) => b.s[1] - a.s[1])[0];
    keeper.trueRole = keeper.trueRole || keeper.r;
    keeper.r = "WK";
    keeper.s = [keeper.s[0], keeper.s[1], Math.max(45, keeper.s[2] - 14)];
    keeper.makeshiftWK = true;
  }
  return xi;
}

// ---------- XI validation for the user ----------
// hard rules block the start; soft rules only warn (you can play, at a penalty)
function xiChecks(xiMap) {
  const xi = xiMap.filter(Boolean);
  const ovs = xi.filter((c) => c.c !== "IN").length;
  const wk = xi.some((c) => c.r === "WK");
  const bowlOpts = xi.filter((c) => ["PAC", "SPN", "AR"].includes(c.r)).length;
  const pacs = xi.filter((c) => c.r === "PAC").length;
  const oop = xiMap.filter((c, i) => c && !XI_SLOTS[i].accepts.includes(c.r)).length;
  return [
    { label: `Eleven selected (${xi.length}/11)`, ok: xi.length === 11, hard: true },
    { label: `Overseas players ${ovs}/4`, ok: ovs <= OVERSEAS_XI_CAP, bad: ovs > OVERSEAS_XI_CAP, hard: true },
    { label: wk ? `Wicketkeeper in the XI` : `No specialist keeper — makeshift gloves`, ok: wk },
    { label: `Five bowling options (${bowlOpts}/5)`, ok: bowlOpts >= 5 },
    { label: `Two frontline pacers (${pacs}/2)`, ok: pacs >= 2 },
    ...(oop ? [{ label: `${oop} player${oop > 1 ? "s" : ""} out of position (rating penalty)`, ok: false }] : []),
  ];
}

// ---------- season ----------
function buildSeason() {
  const teams = [{ id: "YOU", name: G.user.name, color: G.user.color, me: true }].concat(
    G.rivals.map((r) => ({ id: r.id, name: r.name, color: r.color, rival: r }))
  );
  // strengths
  const uPhases = computePhases(G.user.xi);
  const uStr = teamStrength(uPhases);
  const strengths = { YOU: uStr };
  for (const r of G.rivals) {
    const xi = autoXI(r.core.concat(r.buys));
    strengths[r.id] = teamStrength(computePhases(xi)) * rnd(0.97, 1.03);
  }

  // fixtures: user plays 5 rivals twice + 4 once (14 games)
  const order = shuffle(G.rivals.map((r) => r.id));
  const twice = order.slice(0, 5);
  const once = order.slice(5);
  const myFixtures = shuffle(twice.concat(twice, once));

  // full table starts at zero; AI-vs-AI results pre-simulated (14 games each)
  const table = {};
  teams.forEach((t) => (table[t.id] = { id: t.id, p: 0, w: 0, l: 0, pts: 0, nrr: rnd(-0.2, 0.2) }));

  // circulant extra-graph so each of the 10 teams lands on exactly 14 games:
  // everyone plays everyone once (9) + doubles vs offsets {1,2,5} of the ring (5).
  const ids = ["YOU"].concat(order); // ring order, YOU = 0
  const pairs = [];
  for (let i = 0; i < 10; i++)
    for (let j = i + 1; j < 10; j++) pairs.push([ids[i], ids[j]]);
  for (let i = 0; i < 10; i++) {
    for (const off of [1, 2]) {
      const j = (i + off) % 10;
      pairs.push([ids[Math.min(i, j)], ids[Math.max(i, j)]]);
    }
    if (i < 5) pairs.push([ids[i], ids[(i + 5) % 10]]);
  }
  // dedupe user pairs down to the myFixtures count (user games are played live)
  const aiPairs = pairs.filter(([a, b]) => a !== "YOU" && b !== "YOU");

  const aiResults = aiPairs.map(([a, b]) => {
    const pa = 1 / (1 + Math.pow(10, (strengths[b] - strengths[a]) / 11));
    const winner = Math.random() < pa ? a : b;
    return { a, b, winner };
  });

  // pre-season projected finish: rank all teams by strength (1 = strongest)
  const projectedRank = Object.keys(strengths)
    .sort((a, b) => strengths[b] - strengths[a]).indexOf("YOU") + 1;

  G.season = {
    phase: "league", // league | playoffs | done
    myFixtures, played: [], strengths, table, teams,
    aiResults, aiRevealed: 0,
    uPhases, projectedRank,
    playoff: null, // {q1, elim, q2, final, myAlive, label}
    champion: null,
  };
}

function weakestPhase(phases) {
  let name = null, v = 1e9;
  for (const [k, val] of Object.entries(phases)) {
    if (k === "Squad depth") continue;
    if (val < v) { v = val; name = k; }
  }
  return { name, v };
}

const LOSS_REASONS = {
  "Powerplay batting": "Two down inside the powerplay — the chase never recovered.",
  "Middle-overs batting": "Overs 7–15 crawled at a run a ball. Fatal.",
  "Death hitting": "Needed 42 off the last four. Nobody could clear the rope.",
  "New-ball attack": "Their openers put on 70 in six. Game gone early.",
  "Spin control": "Their spinners strangled the middle overs; yours leaked.",
  "Death bowling": "Defending 12 off the last over. It went for 16.",
  "Glovework": "A dropped chance and a missed stumping — both cost dearly.",
};

function playMyMatch(oppId, tag) {
  const s = G.season;
  const my = s.strengths.YOU;
  const opp = s.strengths[oppId] * rnd(0.97, 1.05); // form on the day
  let p = 1 / (1 + Math.pow(10, (opp - my) / 11));
  p = clamp(p, 0.05, 0.95);
  const win = Math.random() < p;

  // ----- structured scoreline (consistent with win + margin) -----
  const youBattedFirst = Math.random() < 0.5;
  const firstWins = youBattedFirst ? win : !win; // did the team batting first win?
  const oversFromBalls = (balls) => Math.floor(balls / 6) + "." + (balls % 6);
  let first, second, margin;
  if (firstWins) {
    const marginRuns = ri(8, 46);
    const t1 = ri(150, 208), w1 = ri(4, 8);
    const allOut = Math.random() < 0.5;
    const w2 = allOut ? 10 : ri(6, 9);
    const ov2 = allOut ? oversFromBalls(ri(96, 116)) : "20.0";
    first = { runs: t1, wkts: w1, overs: "20.0" };
    second = { runs: t1 - marginRuns, wkts: w2, overs: ov2 };
    margin = `${firstWins === youBattedFirst && win ? "won" : "lost"} by ${marginRuns} runs`;
  } else {
    const marginWkts = ri(2, 7), ballsLeft = ri(2, 17);
    const t1 = ri(142, 196), w1 = ri(5, 9);
    first = { runs: t1, wkts: w1, overs: "20.0" };
    second = { runs: t1 + ri(1, 5), wkts: 10 - marginWkts, overs: oversFromBalls(120 - ballsLeft) };
    margin = `${win ? "won" : "lost"} by ${marginWkts} wicket${marginWkts > 1 ? "s" : ""} (${ballsLeft} ball${ballsLeft > 1 ? "s" : ""} left)`;
  }
  const sl = { youBattedFirst, first, second };

  let line, potm;
  if (win) {
    const stars = G.user.xi.filter((c) => !c.filler);
    const p = pickOne(stars.length ? stars : G.user.xi);
    potm = p.n;
    const feats = {
      OPN: [`${ri(55, 96)}(${ri(30, 52)}) up top`, `a ${ri(40, 70)}-ball hundred`],
      MID: [`an unbeaten ${ri(48, 88)}`, `${ri(45, 80)}(${ri(28, 46)}) under pressure`],
      WK: [`${ri(40, 78)}(${ri(24, 40)}) and two stumpings`],
      AR: [`${ri(28, 52)}(${ri(14, 24)}) and 2-${ri(18, 30)}`],
      PAC: [`${ri(3, 5)}-${ri(12, 26)} with the new ball`, `${ri(2, 4)} wickets at the death`],
      SPN: [`${ri(2, 4)}-${ri(14, 24)} in the middle overs`],
    };
    line = `<b>${potm}</b> — ${pickOne(feats[p.r] || feats.MID)}. Player of the match.`;
  } else {
    const weak = weakestPhase(s.uPhases);
    line = LOSS_REASONS[weak.name] || "Outplayed on the night.";
  }
  return { win, oppId, tag, margin, line, potm, sl };
}

// ---------- full scorecard generation (lazy, cached on the result) ----------
function teamXIById(id) {
  if (id === "YOU") return G.user.xi.slice();
  const r = G.rivals.find((x) => x.id === id);
  return r ? autoXI(r.core.concat(r.buys)) : [];
}
function orderBatting(xi) {
  const rank = { OPN: 0, WK: 1, MID: 2, AR: 3, SPN: 4, PAC: 5 };
  return xi.slice().sort((a, b) => (rank[a.r] - rank[b.r]) || (b.o - a.o));
}
function pickBowlers(xi) {
  const bowlers = xi.filter((c) => ["PAC", "SPN", "AR"].includes(c.r));
  const q = (c) => (c.r === "AR" ? c.s[1] : c.o);
  const sorted = bowlers.sort((a, b) => q(b) - q(a));
  return (sorted.length >= 4 ? sorted : xi.slice()).slice(0, Math.min(5, Math.max(4, sorted.length || 4)));
}
function distributeInnings(batXI, bowlXI, total, wkts, overs) {
  const bat = orderBatting(batXI);
  const bowlers = pickBowlers(bowlXI);
  const wkNames = bowlXI.filter((c) => c.r === "WK").map((c) => c.n);
  const keeper = wkNames[0] || (bowlXI[0] && bowlXI[0].n) || "keeper";
  const extras = Math.min(Math.round(total * 0.12), ri(3, 17));
  let batRuns = Math.max(0, total - extras);

  const battedCount = wkts >= 10 ? Math.min(bat.length, 10 + (Math.random() < 0.5 ? 1 : 0)) : Math.min(bat.length, wkts + ri(1, 3));
  const batQ = (c) => (["PAC", "SPN"].includes(c.r) ? 0.35 : c.r === "AR" ? c.s[0] / 90 : c.o / 90);
  const weights = [];
  for (let i = 0; i < battedCount; i++) weights.push(Math.max(0.18, (battedCount - i)) * (0.55 + batQ(bat[i])) * rnd(0.55, 1.45));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const runsArr = weights.map((w) => Math.round(batRuns * w / wsum));
  // fix rounding to hit batRuns exactly
  let diff = batRuns - runsArr.reduce((a, b) => a + b, 0);
  if (runsArr.length) runsArr[0] = Math.max(0, runsArr[0] + diff);

  const notOut = Math.max(0, battedCount - wkts);
  const srBase = { OPN: 138, MID: 132, WK: 142, AR: 146, PAC: 118, SPN: 116 };
  const dismiss = (bowler, fielder) => {
    const rollo = Math.random();
    if (rollo < 0.12) return "run out (" + fielder + ")";
    if (rollo < 0.5) return "c " + fielder + " b " + bowler;
    if (rollo < 0.68) return "b " + bowler;
    if (rollo < 0.8) return "lbw b " + bowler;
    if (rollo < 0.9) return "c & b " + bowler;
    return "st " + keeper + " b " + bowler;
  };

  let runOuts = 0;
  const batting = [];
  for (let i = 0; i < battedCount; i++) {
    const c = bat[i], runs = runsArr[i] || 0;
    const isOut = i < battedCount - notOut;
    const sr = (srBase[c.r] || 125) * rnd(0.8, 1.25);
    const balls = runs === 0 ? ri(1, 7) : Math.max(1, Math.round(runs / (sr / 100)));
    let sixes = Math.min(Math.floor(runs / 14), Math.round(runs * rnd(0, 0.05)));
    let fours = Math.min(Math.floor((runs - sixes * 6) / 4), Math.round(runs * rnd(0.06, 0.12)));
    if (fours < 0) fours = 0;
    const bowler = pickOne(bowlers).n;
    const fielder = pickOne(bowlXI).n;
    const how = isOut ? dismiss(bowler, fielder) : "not out";
    if (how.startsWith("run out")) runOuts++;
    batting.push({ name: c.n, role: c.r, runs, balls, fours, sixes,
      sr: (runs / balls * 100).toFixed(1), how, out: isOut });
  }
  // any batters who didn't come to the crease
  for (let i = battedCount; i < Math.min(bat.length, 11); i++) {
    batting.push({ name: bat[i].n, role: bat[i].r, dnb: true, how: "did not bat" });
  }

  // bowling — overs sum to full innings, wickets = wkts - runOuts
  const oversInt = Math.round(parseFloat(overs));
  const nb = bowlers.length;
  const oversEach = [];
  let remOvers = oversInt;
  for (let i = 0; i < nb; i++) {
    const left = nb - i;
    const share = i === nb - 1 ? remOvers : clamp(Math.round(remOvers / left) + ri(-1, 1), 1, 4);
    const o = clamp(share, 1, Math.min(4, remOvers - (left - 1)));
    oversEach.push(o); remOvers -= o;
  }
  let bowlerWk = Math.max(0, wkts - runOuts);
  const bwArr = new Array(nb).fill(0);
  const bq = bowlers.map((c) => (c.r === "AR" ? c.s[1] : c.o) + rnd(0, 8));
  while (bowlerWk > 0) {
    let idx = 0, best = -1;
    for (let i = 0; i < nb; i++) { const s = bq[i] - bwArr[i] * 22; if (s > best && bwArr[i] < 4 && bwArr[i] < oversEach[i] * 2) { best = s; idx = i; } }
    bwArr[idx]++; bowlerWk--;
  }
  const byes = ri(0, 5);
  let bowlRuns = Math.max(0, total - byes);
  const rWeights = oversEach.map((o) => o * rnd(0.7, 1.4));
  const rsum = rWeights.reduce((a, b) => a + b, 0);
  const runsEach = rWeights.map((w) => Math.round(bowlRuns * w / rsum));
  let rdiff = bowlRuns - runsEach.reduce((a, b) => a + b, 0);
  if (runsEach.length) runsEach[0] += rdiff;
  const bowling = bowlers.map((c, i) => ({
    name: c.n, overs: oversEach[i] + ".0", maidens: Math.random() < 0.12 ? 1 : 0,
    runs: Math.max(0, runsEach[i]), wkts: bwArr[i],
    econ: (Math.max(0, runsEach[i]) / oversEach[i]).toFixed(2),
  }));

  return { batting, bowling, extras, total, wkts, overs, runOuts };
}
function buildScorecard(res) {
  if (res.sc || !res.sl) return res.sc;
  const sl = res.sl;
  const firstId = sl.youBattedFirst ? "YOU" : res.oppId;
  const secondId = sl.youBattedFirst ? res.oppId : "YOU";
  const firstXI = teamXIById(firstId), secondXI = teamXIById(secondId);
  res.sc = {
    firstId, secondId,
    inn1: distributeInnings(firstXI, secondXI, sl.first.runs, sl.first.wkts, sl.first.overs),
    inn2: distributeInnings(secondXI, firstXI, sl.second.runs, sl.second.wkts, sl.second.overs),
  };
  return res.sc;
}

function applyResult(res) {
  const s = G.season;
  s.played.push(res);
  const t = s.table;
  t.YOU.p++; t[res.oppId].p++;
  if (res.win) { t.YOU.w++; t.YOU.pts += 2; t[res.oppId].l++; }
  else { t.YOU.l++; t[res.oppId].w++; t[res.oppId].pts += 2; }
  // reveal a proportional slice of AI results
  const perMatch = Math.ceil(s.aiResults.length / 14);
  const until = Math.min(s.aiResults.length, s.aiRevealed + perMatch);
  for (; s.aiRevealed < until; s.aiRevealed++) {
    const r = s.aiResults[s.aiRevealed];
    t[r.a].p++; t[r.b].p++;
    if (r.winner === r.a) { t[r.a].w++; t[r.a].pts += 2; t[r.b].l++; }
    else { t[r.b].w++; t[r.b].pts += 2; t[r.a].l++; }
  }
}

function tableSorted() {
  return Object.values(G.season.table).sort((a, b) => b.pts - a.pts || b.nrr - a.nrr);
}

function startPlayoffs() {
  const s = G.season;
  s.phase = "playoffs";
  const top4 = tableSorted().slice(0, 4).map((t) => t.id);
  s.playoff = { top4, stage: null, results: [] };
  if (!top4.includes("YOU")) { s.phase = "done"; return; }
  s.playoff.myAlive = true;
  const rank = top4.indexOf("YOU");
  s.playoff.stage = rank <= 1 ? "Q1" : "ELIM";
}

// resolve an AI-only playoff game
function aiBeats(aId, bId) {
  const s = G.season;
  const pa = 1 / (1 + Math.pow(10, (s.strengths[bId] - s.strengths[aId]) / 11));
  return Math.random() < pa ? aId : bId;
}

// returns {oppId, tag} for the user's next playoff match, advancing AI games as needed
function nextPlayoffMatch() {
  const s = G.season, po = s.playoff, top4 = po.top4;
  const others = top4.filter((id) => id !== "YOU");
  if (po.stage === "Q1") {
    return { oppId: top4[top4.indexOf("YOU") === 0 ? 1 : 0], tag: "Qualifier 1" };
  }
  if (po.stage === "ELIM") {
    return { oppId: top4[top4.indexOf("YOU") === 2 ? 3 : 2], tag: "Eliminator" };
  }
  if (po.stage === "Q2") {
    // loser of Q1 among AI teams
    const q1Teams = top4.slice(0, 2).filter((id) => id !== "YOU");
    const opp = q1Teams.length === 2 ? aiBeats(q1Teams[0], q1Teams[1]) : q1Teams[0];
    return { oppId: po.q2opp || opp, tag: "Qualifier 2" };
  }
  if (po.stage === "FINAL") {
    return { oppId: po.finalOpp, tag: "The Final" };
  }
  return null;
}

// advance playoff state after the user's playoff result
function advancePlayoffs(res) {
  const s = G.season, po = s.playoff, top4 = po.top4;
  po.results.push(res);
  const others = top4.filter((id) => id !== "YOU");
  if (res.tag === "Qualifier 1") {
    if (res.win) {
      po.stage = "FINAL";
      // final opponent: winner of Q2 = (Q1 loser) vs (Elim winner), both AI
      const elimW = aiBeats(top4[2], top4[3]);
      po.finalOpp = aiBeats(res.oppId, elimW);
    } else {
      po.stage = "Q2";
      po.q2opp = aiBeats(top4[2], top4[3]); // eliminator winner
      po.finalSeed = res.oppId;             // the team that beat us in Q1 waits in the final
    }
  } else if (res.tag === "Eliminator") {
    if (res.win) {
      po.stage = "Q2";
      po.q2opp = null; // Q1 loser, resolved in nextPlayoffMatch
      const q1 = top4.slice(0, 2);
      const q1w = aiBeats(q1[0], q1[1]);
      po.q2opp = q1[0] === q1w ? q1[1] : q1[0];
      po.finalSeed = q1w;
    } else { po.myAlive = false; s.phase = "done"; }
  } else if (res.tag === "Qualifier 2") {
    if (res.win) { po.stage = "FINAL"; po.finalOpp = po.finalSeed; }
    else { po.myAlive = false; s.phase = "done"; }
  } else if (res.tag === "The Final") {
    s.champion = res.win;
    s.phase = "done";
  }
}

// ---------- verdict ----------
function computeVerdict() {
  const s = G.season;
  const all = s.played;
  const w = all.filter((r) => r.win).length;
  const l = all.length - w;
  const perfect = l === 0 && s.champion === true && all.length >= 16;
  const madePlayoffs = !!(s.playoff && s.playoff.top4.includes("YOU"));
  let title, sub;
  if (perfect) {
    title = `${w}–0`;
    sub = "A perfect season. Sixteen games, sixteen wins. No franchise, real or imagined, has ever done this. Frame it.";
  } else if (s.champion) {
    title = "CHAMPIONS";
    sub = `${w}–${l}. Not perfect — but the trophy is in the cabinet and nobody remembers the losses.`;
  } else if (madePlayoffs) {
    title = `${w}–${l}`;
    sub = "Playoffs reached, title missed. The auction table giveth; the death overs taketh away.";
  } else if (w >= 7) {
    title = `${w}–${l}`;
    sub = "Mid-table. Respectable league season, but respectable doesn't lift trophies.";
  } else {
    title = `${w}–${l}`;
    sub = "A season to forget. The weak link the simulator warned you about? It found you.";
  }
  return { title, sub, w, l, perfect, champion: !!s.champion, madePlayoffs };
}

// ---------- season awards (Orange/Purple cap, MVP, top run/wkt) ----------
function seasonStatFor(card, matches) {
  const isBat = ["OPN", "MID", "WK", "AR"].includes(card.r);
  const isBowl = ["PAC", "SPN", "AR"].includes(card.r);
  let runs = 0, wkts = 0;
  if (isBat) {
    const base = card.r === "AR" ? (card.s[0] - 46) * 0.5 : (card.o - 42) * 0.85;
    runs = Math.max(0, Math.round(base * matches * rnd(0.82, 1.24)));
  }
  if (isBowl) {
    const per = card.r === "AR" ? (card.s[1] - 55) / 26 : (card.o - 56) / 20;
    wkts = Math.max(0, Math.min(34, Math.round(per * matches * rnd(0.8, 1.2))));
  }
  return { runs, wkts };
}

function generateSeasonAwards() {
  const s = G.season;
  const userMatches = Math.max(14, s.played.length);
  // compute the user's per-card stats ONCE and cache, so the lineup view and
  // the caps/awards agree on the same numbers.
  s.userStats = new Map();
  const teams = [{ id: "YOU", name: G.user.name, players: G.user.xi }];
  for (const r of G.rivals) teams.push({ id: r.id, name: r.name, players: autoXI(r.core.concat(r.buys)) });
  const all = [];
  for (const t of teams) {
    const m = t.id === "YOU" ? userMatches : 14;
    for (const p of t.players) {
      if (p.filler) continue;
      const st = seasonStatFor(p, m);
      if (t.id === "YOU") s.userStats.set(p, st);
      all.push({ name: p.n, team: t.name, teamId: t.id, role: p.r, o: p.o, runs: st.runs, wkts: st.wkts });
    }
  }
  const byRuns = all.slice().sort((a, b) => b.runs - a.runs);
  const byWkts = all.slice().sort((a, b) => b.wkts - a.wkts);
  const mine = all.filter((p) => p.teamId === "YOU");
  const impact = (p) => p.runs / 25 + p.wkts * 2;
  s.awards = {
    orange: byRuns[0],
    purple: byWkts[0],
    orangeList: byRuns.slice(0, 10),
    purpleList: byWkts.filter((p) => p.wkts > 0).slice(0, 10),
    topRun: mine.slice().sort((a, b) => b.runs - a.runs)[0],
    topWkt: mine.slice().sort((a, b) => b.wkts - a.wkts)[0],
    mvp: mine.slice().sort((a, b) => impact(b) - impact(a))[0],
  };
  return s.awards;
}

// ---------- FM-style season review (finish vs projected, grades, note, lineup) ----------
function gradeOf(v) {
  return v >= 90 ? "Excellent" : v >= 82 ? "Very good" : v >= 74 ? "Good" : v >= 66 ? "Modest" : "Poor";
}
function computeReview() {
  const s = G.season;
  const table = tableSorted();
  const finished = table.findIndex((t) => t.id === "YOU") + 1;
  const projected = s.projectedRank || finished;
  const w = s.played.filter((r) => r.win).length;
  const l = s.played.length - w;
  const p = s.uPhases;
  const batting = (p["Powerplay batting"] + p["Middle-overs batting"] + p["Death hitting"]) / 3;
  const bowling = (p["New-ball attack"] + p["Spin control"] + p["Death bowling"]) / 3;
  const keeping = p["Glovework"];
  const grades = [
    { k: "Batting", v: batting, g: gradeOf(batting) },
    { k: "Bowling", v: bowling, g: gradeOf(bowling) },
    { k: "Fielding", v: keeping, g: gradeOf(keeping) },
  ];
  const weak = weakestPhase(p);

  let tag;
  if (s.champion) tag = "CHAMPIONS";
  else if (finished <= projected - 2) tag = "OVERPERFORMED";
  else if (finished >= projected + 2) tag = "UNDERPERFORMED";
  else tag = "AS PROJECTED";

  // lineup with per-player runs/wkts (cached from awards, else recompute)
  const m = Math.max(14, s.played.length);
  const stats = s.userStats || new Map();
  const lineup = G.user.xi.map((c) => {
    const st = stats.get(c) || seasonStatFor(c, m);
    return { c, runs: st.runs, wkts: st.wkts };
  });
  const a = s.awards || {};
  const topBat = lineup.slice().sort((x, y) => y.runs - x.runs)[0];
  const topBowl = lineup.slice().sort((x, y) => y.wkts - x.wkts)[0];

  // narrative note
  const strong = grades.slice().sort((x, y) => y.v - x.v)[0];
  const ord = (n) => { const sfx = ["th", "st", "nd", "rd"], v = n % 100; return n + (sfx[(v - 20) % 10] || sfx[v] || sfx[0]); };
  let headline, body;
  if (s.champion && l === 0) {
    headline = "IMMORTAL.";
    body = `Sixteen out of sixteen. A season with no blemish, the one no franchise had ever managed. ${topBat.c.n} and ${topBowl.c.n} led it, and there is nothing left to win.`;
  } else if (s.champion) {
    headline = "CHAMPIONS, THE HARD WAY.";
    body = `Projected to finish ${ord(projected)}, they lifted the trophy at ${w}-${l}. ${strong.k.toLowerCase()} was the engine; the ${weak.name.toLowerCase()} nearly undid them in the knockouts. It held.`;
  } else if (tag === "OVERPERFORMED") {
    headline = "NOBODY SAW THAT COMING.";
    body = `Written off at ${ord(projected)} before a ball was bowled, they finished ${ord(finished)}. ${topBat.c.n} bossed the batting; ${topBowl.c.n} led the attack. The ${weak.name.toLowerCase()} is the one thing still holding them back.`;
  } else if (tag === "UNDERPERFORMED") {
    headline = "A SEASON THAT NEVER CLICKED.";
    body = `Fancied for ${ord(projected)}, they limped to ${ord(finished)} at ${w}-${l}. ${strong.k} did its job, but the ${weak.name.toLowerCase()} leaked all year and the table punished it.`;
  } else {
    headline = "ABOUT WHAT IT SAYS ON THE TIN.";
    body = `Projected ${ord(projected)}, finished ${ord(finished)}. ${topBat.c.n} carried the runs and ${topBowl.c.n} the wickets. Fix the ${weak.name.toLowerCase()} and there is another gear here.`;
  }

  // how far the campaign went — spell out the playoff path (e.g. reached Q1, lost)
  const po = s.playoff;
  const dispTag = (t) => (t === "The Final" ? "the Final" : t);
  let campaign;
  if (!po || !po.top4 || !po.top4.includes("YOU")) {
    campaign = `Missed the playoffs — finished ${ord(finished)} in the league`;
  } else if (s.champion) {
    const wins = (po.results || []).filter((r) => r.win).map((r) => dispTag(r.tag));
    campaign = "Champions — won " + (wins.length ? wins.join(", then ") : "the Final");
  } else {
    const path = (po.results || []).map((r) => (r.win ? "won " : "lost ") + dispTag(r.tag));
    campaign = path.length ? "Reached the playoffs: " + path.join(", then ") : "Reached the playoffs";
  }

  s.review = { finished, projected, tag, w, l, grades, weak, lineup, headline, body, campaign,
    topRuns: a.topRun, topWkts: a.topWkt };
  return s.review;
}

function emojiStrip() {
  const s = G.season;
  const league = s.played.filter((r) => !r.tag);
  const po = s.played.filter((r) => r.tag);
  let str = league.map((r) => (r.win ? "\u{1F7E9}" : "\u{1F7E5}")).join("");
  if (po.length) str += " │ " + po.map((r) => (r.win ? "\u{1F3C6}" : "\u{1F480}")).join("");
  return str;
}
