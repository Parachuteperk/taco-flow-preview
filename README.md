# The Loli's Connection: A SIFE Operation

**The Loli's Connection**, subtitled **A SIFE Operation**, is an RCT-style isometric taco stand game in the TXST Quad. It tests one thing: does the RollerCoaster Tycoon loop of placing a stall, building its queue line, and watching students queue, buy and walk off with a taco feel good? The setting is the TXST Quad: a red-brick plaza, limestone walks, live oaks, and Old Main at the top. Design notes are in [DESIGN.md](DESIGN.md) and art sources in [ASSETS.md](ASSETS.md).

## Open it

Double-click `index.html`. It runs from `file://` in Chrome with no build step and no server.

## Taco Week (default) and Free Play

Opening `index.html` starts **Taco Week**: five days, each one PREP → OPEN (3 sim-minutes) → CLOSE (up to 20 s of overtime) → a report card.
- **Goals:** 12, 20, 24, 40 and 50 tacos. Hit 4 of 5 for the champion ending. Otherwise you get a consolation ending. Either ending offers **Play again** or **Free play**.
- **Setting up:**
  - Tap a glowing **★ Set up here** pin. Each pin shows its GOOD/OKAY/SLOW foot-traffic grade, and a pin for an off-screen spot sits on the screen edge with an arrow (tap it to pan there).
  - **Accept** the suggested line, then **OPEN**. The camera follows your first customer.
- **Shopping:** only in PREP, one big buy (a stand tier or the second stand) per day. Things unlock by day, and the menu's "Coming" line says when.
- **Day by day:**
  - Day 2 adds the grill, Ali, the second cooler and the Freshman Runner, who fetches crates from the TXST supply van at 25% stock while Jared keeps selling.
  - Day 4 adds a second stand ($125), run by a Freshman Cashier, with its own stock, line and tiers.
- **Old Main bells:** 1–2 class bells ring each day, with a 5 s countdown in the day chip, and send a wave of students out.
  - A Banner makes the wave bigger.
  - Pressing Antonio's **Hack agenda** during a countdown gives a bigger "Perfect timing" wave.
- **Line shape:** while building, the stand shows *Capacity N / path blocked / pickup clear*.
  - A queue across a plaza crossing slows passers-by.
  - A line hugging the pickup slows the hand-off.
- **Debug and build controls:** **Build** shows Move stand / Build line. **⚙** shows Crowd, zoom and Art. **🔍 Stand / 🗺 Quad** switches between a stand close-up and the whole quad.

`?mode=free` (or Free play from the ending) is the endless sandbox below, with tier-based unlocks.

## How to play

1. **Place stand.** Tap open grass or plaza. The stand is a 2×2 spot, and you start scrappy: a folding table and a cooler of pre-made tacos, with Jared selling. **R** or **↻** rotates it to pick which side the order window faces; the pickup side is next to it. Green means OK, red means not allowed.
2. **Build line.** Paint the queue RCT-style: start on the tile in front of the order window and tap or drag tile by tile. The line must be one chain with no branches, and it can go on grass or plaza but not on footpaths. Students only queue once the line's far end touches a footpath; until then you'll see **Line not connected to a path**. Each line tile holds 2 people. Tap a line tile while building to remove it and everything after it.
3. **▶ Play**, then **1× / 2× / 4×** to change speed.
4. **Restocks:** the cooler holds 8 tacos. When it runs out, Jared walks off the quad with it to restock and sales pause. Guests keep queueing, but some give up if he takes too long.
5. **Stand & crew** is one panel for both:
   - **Stand upgrades** build onto the stand in order, unlocked by tacos sold: Grill (cooking, much longer-lasting ingredients), Banner (wider draw zone), Serving station (its own pickup spot and faster hand-off; before it, guests wait at the table), then Canopy.
   - **Hire crew** unlocks people as the stand grows: Ali at the grill, Antonio (laptop + stream) and Phillip with the banner, Matt with the serving station, and Aaron with the canopy. Mrs. West can't be hired; she's a visitor (see below). Each hire shows up at the stand and speeds a station.
6. **Move stand** clears its line. Guests in line who haven't paid leave politely; guests who already paid are served at the new spot.

### Controls

- **Zoom:** the **+ / −** buttons, the mouse wheel, or pinch. The game starts zoomed in on the quad.
- **Crowd: Low / Normal / High:** sets how many students are around, up to about 50, 95 or 140. Rushes double the student flow for about 30 s, with a **Rush!** toast.

### Events and extras

- **Mrs. West** drops by from Old Main every 1–2 minutes once Ali is hired. While she chats, Ali stops cooking. She leaves a tip, or advice worth +10% on prices for 30 s.
- **Antonio:** with him hired, you get two buttons.
  - **Hack agenda** (90 s cooldown): Antonio types furiously, a glitchy "Classes dismissed early!" campus popup appears, and about 50 students pour out of Old Main.
  - **Twitch raid** (120 s cooldown): a RAID! toast, and about 36 students arrive from the map edges.
  - Both also happen on their own now and then.
- **Grackles** mob the stand every 1–2 minutes. Matt shoos them off; without him, ordering and hand-off run 50% slower for about 8 s.
- **Extras** in the *Stand & crew* menu:
  - **Phillip's Tortilla Cannon** (needs Phillip + Serving station): hand-off is twice as fast, and tacos fly to the pickup spot.
  - **AI Ali** (needs Ali + Canopy): a blue holo Ali chats with Mrs. West, so the real Ali keeps cooking.
- **Jared's side hustles:** a day is 3 sim-minutes.
  - **Gold/silver:** once a day Jared offers to stash 10% of the day's take in gold or silver. It pays back at closing, going up 75% of the time.
  - **Coin flip:** now and then at closing he offers double-or-nothing. The menu sets the standing policy: Always, Ask (shows a Flip/Skip card), or Never.
- **Thought bubbles** pop over students:
  - line too long
  - tasty
  - too pricey
  - waiting too long
- **Ambient campus life:** bikers ride the walks and students hang out on benches and lawns. They never buy anything.

**Art: painted / placeholder** switches between the Gemini RCT-style art and placeholder shapes; `?art=placeholder` starts in placeholder mode. Dragging the map pans it, except while building a line, when dragging paints.

## Verify

```bash
npm install
```

```bash
node tools/verify.mjs
```

This uses Playwright with your installed Google Chrome and writes screenshots to `shots/`.

## Debug hook

`window.__flow` exposes:
- **Game actions:** `placeStand`, `addLine`, `removeLine`, `rotate`, `play`, `pause`, `setSpeed`, `hire`, `buyTier`, `setArt`.
- **`stats()`:** spawned, served, completedLoop, money, errors, fps, queue, atPickup, leavingWithTaco, lineTiles, connected, capacity, tier, stock, restocks, crew, avgWait…
- **Test helpers:** `suggestStand`, `tileToClient`, `standToClient`, `standWallPixel`, `grantMoney`, `crewOverdraw`, `zoom`, `setCrowd`, `hack`, `raid`, `grackles`, `offerBet`, `offerFlip`, `endDay`.

`node tools/crew-shots.mjs` renders every stand tier × rotation to `shots/crew/` and checks that no crew member is covered by a stand piece.
