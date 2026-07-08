# CrickSim V2 — Multiplayer (vs a Friend) Design Doc

**Status:** Planned, not built. This document is the blueprint for the online
multiplayer mode. It is written so the feature can be built later without
touching the current single-player game.

## Guiding constraint: don't disturb v1

The current game (`CrickSim/`) is 100% client-side static files and must keep
working and deploying exactly as it does now. Multiplayer is a **separate build,
"CrickSim V2"**, with its own frontend entry and a backend server. The plan:

- Keep `CrickSim/` (v1) as-is — the single-player game, hosted static.
- Build v2 in its own place (a `v2/` folder or a separate repo). v2 **reuses**
  v1's pure logic as shared modules — the player pool (`data.js`), the auction
  valuation math, the phase-based season sim, and the scorecard generator are
  all framework-free and can be imported by both. Only the *driver* (who owns
  state, who broadcasts) differs.
- v1 needs no server. v2 needs a realtime server (below). They deploy
  independently; v1 never depends on v2 being up.

## Why multiplayer needs a backend

v1 works with no server because one browser owns all state. Multiplayer breaks
that: multiple browsers must share one live auction and one league. That needs a
server for four things:

1. **Rooms + invites** — create/join a room by code, password gate, presence.
2. **Authoritative live auction** — one source of truth for the current lot, the
   bid, and the going-once/twice clock, broadcast to everyone in real time.
3. **Server-side AI** — the 7 (or more) AI franchises bid inside the same shared
   auction, so all humans see identical state.
4. **Async match reconciliation** — track each user's fixtures; a human-vs-human
   game resolves only when *both* press Play, while vs-AI games can be played
   anytime, so players sit at different game counts.

## The user's spec (captured verbatim in intent)

- Host **creates a room** with a name + password and gets an **invite link**.
- Invitees **open the link, enter the password, and join**.
- Each joiner **creates their own team** (name + colours). They **cannot** choose
  the auction amount or rules — **only the host** sets those.
- If the host invites 2 people -> 3 human teams; the remaining **7 are AI** (a
  10-team league).
- After everyone joins, the **lobby shows a league table** with the human team
  names; empty slots are filled by AI teams.
- The **host chooses auction details** (purse, rules) and clicks **Start game**.
- Everyone lands in the **auction screen** and **bids against each other and the
  AI** — humans and AI try to outbid each other for players they want.
- **No Quick Auction (quick-sim) in multiplayer.**
- A player can **skip a category** (applies to them only) and can **go back to a
  previous category**. (This navigation was also added to single-player v1.)
- **Matches:** human-vs-human games require **both** players to press **Play
  match**; vs-AI games can be **played anytime**. So one player might be 6 games
  deep while another has played 1 — standings update as results land.

## Recommended architecture

**An authoritative room server.** A live auction with a shared clock and
server-run AI is a game-server problem, not a database-sync problem.

Recommended options (pick one at build time):

| Option | What it is | Fit | Hosting |
|---|---|---|---|
| **Colyseus** (recommended) | Node authoritative room framework; each room is a server-side state machine with automatic state sync + rooms/matchmaking | Excellent — built for exactly this (turns, timers, per-room actors) | Render / Railway / Fly (small always-on Node dyno) |
| **PartyKit** | One stateful actor per room on Cloudflare Durable Objects; WebSocket-native | Excellent — per-room isolation, cheap, scales to zero | Cloudflare |
| **Firebase / Supabase** | Hosted realtime DB + presence | OK for lobby/league, weak for authoritative bid timing/AI | Managed |

Frontend stays a thin client that renders server state and sends intents
(`bid`, `pass`, `skipCategory`, `ready`, `playMatch`). The **server is
authoritative** — it owns the auction clock, validates every bid against purse
and squad rules, runs the AI, and broadcasts state diffs.

### Room lifecycle (state machine on the server)

```
LOBBY  ->  AUCTION  ->  SELECTION  ->  SEASON  ->  DONE
```

- **LOBBY** — host creates room (code + hashed password); players join, submit
  team (name/colours); server fills remaining slots to 10 with AI; host sets
  purse/rules; host presses Start -> AUCTION.
- **AUCTION** — server drives the shared lot order. For each lot: open bidding,
  accept human bids + generate AI bids, run going-once/twice on a server timer,
  award to the highest bidder, advance. Broadcast every change. Enforce: no
  quick-sim; per-user category skip/back is a *view/preview* concern, the shared
  lot clock stays global (see Open Question 1).
- **SELECTION** — each human picks their XI (reuses v1's picker + effective-XI
  penalty logic); AI auto-pick. Barrier: season starts when all humans are ready
  (or host force-starts).
- **SEASON** — fixtures generated. vs-AI games resolve on demand for that user;
  human-vs-human games hold until both press Play, then the server simulates once
  and writes the result. Standings broadcast live.
- **DONE** — playoffs + verdict (reuse v1 sim + review + scorecard).

### Data model (sketch)

```
Room     { code, name, passwordHash, hostId, phase, rules:{purse}, createdAt }
Player   { id, roomId, name, colour, isAI, squad[], xi[], ready }
Auction  { lotOrder[], curLot, bid:{amount,leaderId}, clock, sold[] }
Fixture  { a:playerId, b:playerId, kind:'AI'|'H2H', aReady, bReady, result }
Season   { fixtures[], table, phase }
```

## Open design questions (resolve at build)

1. **"Skip category, only for me" in a shared auction.** Everyone is on the same
   lot at the same time, so a player can't literally jump the shared order.
   Proposed resolution: the shared auction proceeds in a fixed category order for
   all; "skip category (me)" = that player **auto-passes** the current category
   and can freely **browse/preview** upcoming and past sets in their own panel
   while the global clock runs. "Go back" = review a past set's results. This
   matches the single-player navigation feel without desyncing the room.
2. **Auction pacing with humans + AI + a clock.** Need a per-lot timer (e.g. 8–12s
   with a "reset on new bid, going-once at N seconds idle") tuned so humans have
   time but the room keeps moving. AFK handling: auto-pass.
3. **Disconnects / reconnects.** Player leaves mid-auction -> convert their team
   to AI (or pause briefly, then AI-take-over). Reconnect by room code + player
   token.
4. **Cheating / trust.** Server authoritative; never trust client bid amounts;
   validate purse + squad caps server-side.

## Security notes

- Room password: store only a salted hash; compare server-side.
- Invite link = URL with room code only; password still required to join.
- Rate-limit room creation and bids; cap rooms per IP.
- No PII; team name is user-chosen and profanity-filterable.

## Rough phased build plan

1. **Backend skeleton** — room create/join, password gate, presence, lobby league
   table, host rules. (Colyseus room + simple client.)
2. **Shared auction** — authoritative lot loop, human + AI bidding, clock,
   broadcast, category skip/preview. Port v1 valuation + AI walk-away math.
3. **Selection barrier** — XI pick per human, AI auto-pick, ready gate.
4. **Async season** — fixtures, vs-AI on demand, H2H both-ready resolution, live
   standings, playoffs, shared verdict + scorecards.
5. **Resilience** — reconnect, AFK -> AI takeover, room cleanup/TTL.
6. **Polish** — spectator view, rematch, share results.

## Effort / cost reality

This is a multi-phase build (a real game server), not an afternoon. It adds a
hosting cost (a small always-on Node service, or Cloudflare for PartyKit — both
have low/free starter tiers). Nothing here changes v1's zero-cost static hosting.

---

*When we start V2, begin from Phase 1 and keep everything under a separate
`v2/` build so `CrickSim/` (single-player) stays shippable throughout.*
