# Crew Repaint Brief (PLAN_PASS6 §0)

**Goal:** repaint every crew sprite sheet in the game's **current RCT-style pixel art** (3/4 isometric view, same camera angle and scale as `crew_rct_v1`, `crew_rct_v1b` and `customers_rct_v2`), but with each character's **original approved design**: hair, face, skin tone, outfit colors and signature props.

**Sources**
- `/workspace/taco-flow/crew-compare/NOTES.md`
- `original-<id>.png`, the design layer: portraits and the ChatGPT animation rows from the live play link (`c0dd77e`)
- On the Mac: `src/people.js`, `src/artload.js` and `src/crew.js`

> ⚠️ **Repaint from the DESIGN art** (portraits + `crew-anim-chatgpt` rows), **not** from the original in-game iso sprites. Those swapped designs:
> - The in-game Jared wore Aaron's look (blond, headset, maroon polo).
> - The in-game Aaron wore Matt's look (curly brown, green apron).
> - Mrs. West's iso sprite was an auburn bun with a purple blouse.
>
> Ignore `ref/crew-lineup-1/2.png`, the placeholder lineup with a grey-haired West.

**Refs** (`refs/`): one PNG per character, `<id>-ref.png`.
- **Left:** the original design rows. **Match this look.**
- **Right:** the current in-game sprite in **grayscale**, for style, scale and pose only. Ignore its look.

The three current sheets are also copied there: `current-sheet-crew_rct_v1.png`, `current-sheet-crew_rct_v1b.png` and `current-sheet-west_rct_v1.png`.

---

## 1. Sheet layout to paint (new, uniform)

Today's crew sheets have **no grid**. The sheets are 1024×572, and every frame is a hand-measured crop `{sheet,x,y,w,h,ax,ay}` in `src/people.js`. The figures are ~189–215 px tall, drawn at `31*z/CREW_H` with `CREW_H = 200`. Mrs. West has her own sheet with `WEST_H = 172`, drawn at `33*z`.

Re-cropping is unavoidable, so paint **one sheet per character** on a uniform grid. Crops are then re-measured as connected non-magenta blobs, the same process used for `customers_rct_v2`.

| Spec | Value |
|---|---|
| Canvas | **1536 × 1024** (ChatGPT's landscape size) |
| Grid | **5 columns × 3 rows**; each cell is ~307 × 341 px |
| Figure height | **~230 px from the top of the head (or hair) to the soles, the same in every cell** |
| Foot anchor | Bottom-center between the feet, on a shared baseline **~20 px above the bottom of each cell**; the figure is centered in its cell |
| Gutter | **≥ 20 px of clean magenta** around every figure. Nothing touches a cell edge or another figure. |
| Facing | Row 1 faces toward the camera, down-right (SE, 3/4 front). Row 2 faces away, up-left (NW, 3/4 back). The code mirrors these for the other two directions. |
| Background | **Flat #FF00FF**: no gradient, no floor, no drop shadow, no text or labels, no sparkles or effect marks |

**Frames (crew)**

| Row | Col 1 | Col 2 | Col 3 | Col 4 | Col 5 |
|---|---|---|---|---|---|
| 1 (toward, SE) | **Idle stand** (also the hire-card portrait = frame [0]) | Walk A | Walk B | Walk C | Walk D |
| 2 (away, NW) | Idle back | Walk A | Walk B | Walk C | Walk D |
| 3 (work, facing SE) | Work 1 | Work 2 | Work 3 | Special 1 | Special 2 |

**Frames (Mrs. West).** Her layout matches today's `WEST = {toward:[4], away:[4], chat:[6]}`:
- **Row 1:** idle + 4 walk frames toward the camera.
- **Row 2:** idle back + 4 walk frames away.
- **Row 3:** 5 chat/reaction poses (code cycles them with modulo).

**Walk cycles:** 4-frame contact → pass → contact → pass, with arms swinging and the head height steady. Currently `drawWalker` fakes a walk by splitting frame [0] at 56% of `ay`. Real walk rows replace that hack (a code change, §5).

## 2. Magenta key rules (from `src/art.js slice()`)

The key flood-fills from the crop border wherever `min(R,B) − G ≥ 40`. It also keys enclosed pixels with `min(R,B) − G > 90`, and despills in the 20–90 range.

**Banned on characters:** pink, purple, lilac, magenta, hot-pink blush, pink sparkles, wine or plum that leans blue.

| Use instead | Hex (approx.) | Why it's safe |
|---|---|---|
| Maroon / TXST maroon | `#7A1F1F` | Blue is low |
| Burgundy (handbag, trousers) | `#6E1C1E`, shade `#4A1214` | Red-brown, not plum |
| Blush / cheeks | Warm peach `#E8A07A` | Not pink |
| Lips | Brick `#B5483A` | Not pink |

Outlines are dark brown or black, never purple.

## 3. Shared style

- Current RCT look: 3/4 isometric, readable at ~31 px in game, clean dark outlines and 2–3-tone cel shading with a warm palette.
- Keep the **original design's expressiveness**: a slightly bigger head than the current crew (head about 1/4.5 of height, between the old chunky look and the current lanky one) and clear faces.
- All 7 characters share one scale, so they stand together at the stand.

## 4. Per character (original design traits)

### Mrs. West: socialite investor and landlord (visitor)
- **Hair:** **big teased auburn / red-brown hair** (Aaron's direction). Keep the original's huge voluminous curly bouffant (about shoulder-wide and taller than her face), but shift the color from the original's copper-orange to **auburn**: base `#8B3A1E`, mid `#A84A28`, highlight `#C2602F`, shadow `#5A2414`. **Not bright red, not orange, not blonde.** Keep the small **silver streak** at the temple (grey, not lilac).
- **Signature:** **oversized dark tortoiseshell/gold-rim sunglasses pushed up on top of the hair.**
- **Face:** warm tan/light-brown skin, peach blush, thick lashes, big theatrical open-mouth laugh, brick lips.
- **Jewelry:** large pearl studs, a pearl necklace with a gold pendant, gold bangles and a gold watch.
- **Outfit:** a **cream/ivory blazer with gold buttons** over a white blouse, **burgundy trousers** (`#6E1C1E`, not plum) and dark heels.
- **Prop:** a **burgundy quilted designer handbag** with a gold chain strap and a gold clasp. Don't paint a real brand logo; use a generic gold "W" or a plain clasp.
- **Build:** **slim** ("skinny Texas socialite" in the story canon). The original design art is a bit curvier; see uncertainty #2.
- **Row 3 chat poses:** fists pumped, hand on cheek giggling, pointing, waving, and handing over a check or term sheet.

### Phillip: prep / restock (tortilla cannon in story)
- Tan skin, **dark-brown wavy hair**, **thick eyebrows**, a serious, stoic face.
- A **tall white chef's toque** (keep it in every frame, including work frames).
- White short-sleeve shirt, **mustard-yellow bib apron**, blue jeans, white sneakers, average build.
- **Row 3:** chopping in a steel pan, presenting a taco plate, carrying a crate, then specials: holding his **tortilla cannon** (a new prop, a cardboard and PVC tube) and firing it.

### Ali: grill
- Medium-brown skin, black hair, **full short black beard**, a big grin.
- A **red bandana/headband with trailing tied tails**.
- **Black tee with a small yellow-orange flame logo**, black apron, dark pants, white sneakers.
- **Row 3:** flipping meat on a flaming flat-top, tossing a tortilla, plating, then specials: **ranting with a fist raised and shouting** (the Mavs/Cowboys rant) and slumped, sulking.

### Matt: hand-off AND handyman/builder
- Light skin, rosy (peach) cheeks, **big messy spiky chestnut-brown hair with warm highlights**. Keep it browner than Mrs. West's auburn so they don't read alike.
- Wide open-mouth grin.
- White tee under a **green bib apron**, a **white towel over his shoulder**, black-and-white high-tops.
- **Row 3:** carrying a **black tray of tacos + a drink cup with a straw**, handing over a taco, running with the tray, then specials (**new, for the handyman role**): **swinging a wrench / kneeling with a wrench** and **carrying a red toolbox** (a hard hat is optional, see uncertainty #5).

### Antonio: tech, "wants to be a great hacker"
- Light-tan skin, **messy brown hair**, rosy (peach) cheeks, **chubby/stocky build**, a smug-grumpy look.
- **Charcoal/black hoodie with a gold bobcat-head logo** (generic bobcat, no official TXST mark), a green shirt collar peeking out, **olive cargo pants**, sneakers.
- **Row 3:** hunched typing on a **laptop with a taco sticker**, leaning back cocky with the laptop, a fist-pump "I'm in," then specials: hood up, "hacker mode," and facepalming at a failed hack.

### Jared: order / cashier
- Light-tan/olive skin, warm brown eyes, **dark-brown curly/wavy hair poking out under a teal baseball cap with a gold patch**.
- A **teal polo with a small gold name tag**, jeans, white sneakers, slim-average build, a friendly half-smile.
- **Row 3:** taking payment, handing over change, spatula pose, then specials: **pitching with a gold bar in hand** ("gold and silver, brother") and **flipping a coin**.

### Aaron: SIFE co-founder (the user)
- Fair skin, **spiky golden-blond hair**, blue eyes, a big smile.
- A **black over-ear headset with a mic**.
- A **maroon polo** (`#7A1F1F`) with a small gold paw/leaf print, jeans, brown shoes.
- **Prop:** a **clipboard**.
- **Row 3:** pointing with the clipboard, a thumbs-up, a fist-bump, then specials: **handing out a business card** and **"LinkedIn post" phone held up**. A **blazer-over-polo Gala variant** comes later.

## 5. Drop-in steps (after a sheet is approved)

1. Save `assets/gemini/crew_<id>_v2.png`, then generate `.webp` and the `.js` data-URL copy, following the existing pattern.
2. Add each sheet to `SHEETS` in `src/artload.js`.
3. Measure the crops as blobs, then rewrite `CREW[id]` and `WEST` in `src/people.js`, plus `CREW_H` and `WEST_H`, from the measured idle height.
4. Update `frameFor()` in `src/crew.js` to the new indexes, and switch `drawWalker` to real walk rows.
5. Fix `crew.js:414` West's palette (grey `#c9c9c9` → auburn `#8B3A1E`). Update `assets/gemini/README.md`, which still says blonde.
6. Cache-bust with `?v=`, then screenshot every character next to the original for Aaron's sign-off.

## 6. Open questions (could cause rework; confirm before painting all 7)

1. **Mrs. West's hair:** the approved original is a bright **copper-orange** curly afro-bouffant, and NOTES says "Aaron: she must have the BIG RED hair." Tonight's direction is **auburn/red-brown, not bright red**. I went with auburn and kept the original's curly volume. Confirm on her first sheet.
2. **Mrs. West's build:** the story canon says "skinny." The original design art is a bit curvier. I wrote slim.
3. **Proportions:** the original design art is chunky with big heads; the current RCT crew is lanky with small heads. I chose a middle ratio (head about 1/4.5 of height). Lock it on West before painting the others.
4. **Layout change:** the new 5×3 per-character sheets (1536×1024) don't drop into today's hand-measured crops. They need the code edits in §5 (re-cropping, the scale constants, `frameFor()`, real walk rows). ChatGPT may not hold a perfect grid or equal heights, so expect to re-measure the crops and maybe normalize heights.
5. **New props aren't in the original art:** Matt's wrench and toolbox, Phillip's tortilla cannon, Aaron's business card and phone, Jared's gold bar and coin, and Ali's rant pose. They follow the plan but haven't been approved visually. A hard hat for Matt is optional; I left it out.
6. **Design-to-name mapping:** this follows the NOTES conclusion. The old in-game sprites had Jared, Aaron and Matt swapped. Aaron should confirm his own look before the Aaron sheet is painted.
