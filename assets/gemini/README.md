# RCT-style art

## Approved crew repaint v2

The active crew uses seven transparent, packed `crew_<id>_v2` atlases: West,
Phillip, Ali, Matt, Antonio, Jared, and Aaron. Each has `.png`, alpha-preserving
lossless `.webp`, a `.js` data URL for file:// loading, and a `.json` crop manifest.
Legacy crew sheets stay in the repository but no longer load at runtime.

Run `python3 tools/prep-crew.py` (Python 3 + Pillow) from any directory to rebuild
from the approved 1536x1024 sheets in `assets/repaint-src/`. The script flood-keys
border magenta at min(R,B)-G >= 40, keys enclosed pixels above 90, despills the
20–90 band, measures connected figures, assigns rows/columns by centroid order,
merges nearby detached props, and removes noise and Aaron's thumbs-up strokes.
One factor per character makes the front idle exactly 200 sheet pixels high;
work/crouch poses retain their relative height. Feet anchor each crop, with
explicit foot regions where an attached grill, register, or pipe reaches the floor.

The manifest has `toward` (idle + four walks), `away` (idle + four walks), `work`
(five poses), and `h` (200). Copy the printed `CREW` literal, also written to
`shots/repaint/crew-crops.js`, into `src/people.js` after changing source art.
`shots/repaint/prep-measurements.json` records source idle heights and factors.
Inspect `shots/repaint/prep-contact.png` for every pose at the same scale, with
red anchor crosses. `tools/compress-art.mjs` includes these atlases and preserves
canvas alpha when re-encoding at quality 0.88; prep uses lossless WebP.

Crew render at 31 px standing height at zoom 1; visiting West renders at 33 px.
West has voluminous auburn hair, a silver temple streak, sunglasses, an ivory
blazer, burgundy trousers, and a burgundy handbag. Jared wears teal and a cap;
Aaron has blond hair, a headset, and a maroon polo; Matt wears a green apron.
`TF.ArtPeople.POSES` / `pose(id, name)` expose pose indexes and
`drawCrewPose(ctx, id, name, sx, sy, z, mirror)` draws named work/special poses,
including Matt's `wrench` and `toolbox`. Portraits and AI Ali use front idle.
Jared and West now use real four-frame toward/away walks; Jared keeps the cooler.

Run `node tools/crew-compare-shots.mjs [output-directory]` for 1440x900 desktop
and 390x844 touch-phone captures (phone DPR 3), plus West's chat gag and Jared's
restock walk. Default output is `shots/repaint/after`; the script also works on
the old code for before captures. `node tools/crew-shots.mjs` checks stand/crew
occlusion across every tier and rotation. Both require locally launchable Chrome.

## Campus Cast (staged for 6D)

Six approved `cast_<id>_v1` atlases cover Boko, Maroonfield, Sage, Bigorder,
Brendan, and Big Greg. Rebuild offline with `python3 tools/prep-cast.py`
(Pillow); validate with `node tools/check-cast.mjs`. Each export has transparent
PNG, pixel-identical lossless WebP, file:// data-URL JS, and a JSON manifest
with `id`, `h`, `drawPx`, five `toward`, five `away`, and five named `poses`.
`src/data/cast.js` contains inline crops, behavior/effect/schedule data and
admission rules; spawning and art loading are deferred to 6D.

Prep shares crew blob/key helpers plus `sprite_prep.py` foot-anchor/packing
helpers. One idle-derived factor preserves pose proportions: humans 200 sheet
px / 31 game px, Boko 219 / ~34, Greg 97 / ~15. Greg's walk heights match their
row idle; human walks exceeding 4% drift are clamped. Anchors use the bottom
14% band (Sage's seated pose uses its bottom seat span). Greg keys only
near-pure enclosed magenta (G<40, R/B>200) and preserves enclosed feather
colours without despill; the ordinary enclosed >90 rule would erase 104
surviving feather pixels. Other characters retain the crew key/despill rules.

Inspect `shots/repaint/cast-keyed-contact.png`: all 90 frames on checkerboard,
red anchor dots, 3x game scale for readable labels, and an additional 2x Greg
strip. `cast-measurements.json` records every source cell, correction and
per-figure colour survival count; `cast-summary.md` summarizes mappings,
measurements and repaint concerns. Bigorder's approved source uses takeaway
boxes rather than exposed tacos and omits the planned coffee mug/midterm tote.

## Legacy sheets

The original Gemini sheets below are about 1024 px wide and chroma-keyed at load.
Cells are NOT on an exact grid — use measured sprite crops.

- oldmain_iso_v1.png (1024x572): Old Main, isometric, SE view. One sprite. Place at the top/back edge of the quad (it's big: ~8-10 tiles wide at map scale).
- stand_2x2_v1.png (1024x572): 2x2 taco kiosk, maroon/gold awning, register window LEFT-front face, pickup hatch RIGHT-front face, blank roof sign (draw "TACOS" on it in code if wanted). Mirror horizontally for the other orientation.
- quad_tiles_v1.png (1024x559): row 1 flat tiles (no outlines, seamless): grass, red brick plaza, limestone walk, rope-and-post queue tile. Row 2 props: live oak tree, brick planter with flowers, iron lamp post, bench.
- crew_rct_v1.png (1024x572): row 1 = Jared standing, Jared at register | (female figure at grill — WRONG for Ali, don't use) | Antonio standing (headphones/hoodie), Antonio at folding table with laptop | Matt standing (gold tee), Matt holding taco basket. Row 2 = (extra gold-tee guy, skip) Phillip standing (green apron), Phillip chopping at cutting board | (old man, skip) | Mrs. West standing, Mrs. West waving | Aaron with clipboard.
- crew_rct_v1b.png (1024x572): Ali (MAN, maroon tee, white apron) standing x2, Ali standing, Ali flipping taco at flat-top grill (x~380-530, row 1); row 1 right: Aaron with clipboard, Aaron pointing x2. Row 2: more Ali poses (one holding taco on spatula), Mrs. West x2, Aaron pointing.
- customers_rct_v1.png (1024x572): 4 visual rows of students, ~10 cells per row. Rows 1 (maroon hoodie), 2 (gold tank top), 4 (sundress, curly hair): cols 1-5 walk toward camera (down-right), cols 6-8 walk away (up-left), col 9 standing-ish, col 10 holding a taco. Row 3 is mixed (backpack/cap guy and ponytail denim-jacket girl): girl = cols 2-6 walk toward; cap guy = cols 7-10 (incl. away + taco). Mirror for the other two diagonals.
- rct_sheet_v1.png: the older first sheet (tiles have dark outlines -> grid lines; prefer quad_tiles_v1).
- stand_stages_v1.png (1024x559): 3x2 panels, each panel a slightly DIFFERENT magenta shade (key broadly: high R+B, low G). Row 1: (A) folding table + red/white cooler [tier 0], (B) black grill with smoke [tier 1], (C) maroon/gold banner on two poles [tier 2]. Row 2: (D) wooden serving/pickup counter [tier 3], (E) maroon/gold striped canopy [tier 4], (F) full stand assembled (reference for layout/scale).
- crew_walk_v1.png: historical ungenerated walk-sheet placeholder; superseded by the real v2 per-character walk rows.
- west_rct_v1.png (1024x572): historical turquoise-dress socialite sheet, superseded by `crew_west_v2`. Row 1: four toward walks. Row 2: four away walks. Row 3: six chat frames. Retained for historical reference only.
