# Photo Pairs: design spec

This file plus `tokens.css` and `assets/` is the source of truth. The `boards/` files show how each screen looks (see README for how to read them).

## 1. Screens

| Screen | Board | Key points |
|---|---|---|
| Home / albums | `Home.dc.html`, `PhoneHome.dc.html` | Family albums: 3-column tiles (cover 210 px, name, count, “Play” chip; whole tile is one link). Starter pictures: 4 tiles. Top right: “Settings” and “Family helper” (lock icon), 52 px quiet buttons. |
| Choose difficulty | `Difficulty.dc.html` | 4 big choices: 3/6/8/10 pairs, each with a mini card grid (real landscape grid for that count), “N cards”, and a “Played last time” chip on the remembered choice. Tapping a choice starts the game. A “Look at all the cards first” switch is below. Choices needing more photos than the album has are disabled with a plain reason. |
| Game | `Main.dc.html` (interactive), `GamePortrait.dc.html`, `PhoneGame.dc.html` | Top bar: Back (left), album name + “Find the matching photos” (centre), Hint + Restart (right). On iPhone, Hint/Restart sit in a bottom bar. During the peek, the subtitle reads “Have a good look — turning over in N” and Hint/Restart are replaced by “I’m ready”. |
| Match moment | in `Main.dc.html`, `PhoneMatch.dc.html` | Scrim `rgba(244,239,231,.97)`. Photo uncropped (`contain`) on a white 14 px mat, max 900×500 on iPad landscape. Caption 32 px / 600. “Keep playing” 72 px main button. “Read aloud” quiet button ONLY when that setting is on. 220×6 px progress bar + “Carries on by itself”; auto-closes after 6 s. |
| Round complete | in `Main.dc.html` | Heart, “You found every pair”, “Six lovely memories from {album}”, collage of matched photos (150×130 polaroids, 8 px mat, 26 px bottom, tilts −4, 3, −2, 4, −3, 2°), buttons “Choose another album” (quiet) and “Play again” (main). |
| Restart confirm | in `Main.dc.html` | “Start this round again?” / “The cards will be shuffled and turned face down.” Buttons: “Keep playing” (left, quiet), “Start again” (right, main). |
| Helper unlock | `HelperUnlock.dc.html` | 240 px circle, 12 px ring fills over 2 s while held; early release → “Keep holding until the circle is full”. Code mode: 4 dots + 3×4 keypad (96×80 keys), wrong code → “That code didn’t work. Try again.” “Forgot the code?” → holding for 10 s opens it and turns the code off. |
| Helper albums | `HelperAlbums.dc.html` | Album rows: cover 84, name, count, Rename / Cover / Delete (48 px). “New album”. Right column: Storage (“N photos saved on this iPad”, bar, plain-words space line, plus whether storage is persistent), Back up panel with the why-it-matters text, last backup date, “Back up an album”, “Restore from a backup file”. Delete confirm names the album and photo count. |
| Helper album detail | `HelperAlbum.dc.html` (tweak: Photos / Empty / Adding) | 5-column photo grid (150 px photo + caption line; missing caption = italic “Add a caption”; “Cover” chip). Tap a photo → dialog: uncropped preview, Caption input (max 60, placeholder “Where and when? e.g. Mooloolaba, 2019”), “Use as album cover”, “Remove photo” with an inline check, Cancel / Save. Empty state + progress state (“Adding 3 of 6 photos…”, bar, “Please keep this screen open.”). |
| Settings | `Settings.dc.html` | How it looks: Text size (Normal/Large/Extra large), Colours (Light/Dark/High contrast) + preview. Playing: Look at the cards first (on), Cards that don’t match stay up for (Short/Medium/Long, default Medium), Read captions aloud (off), Sounds (off). Family helper lock: when opened from Home, shows only “Open Family helper to change how it’s unlocked”; inside the helper area: “Ask for a 4-digit code” switch + “Change code”. About: free, open source, photos never leave this iPad. |
| Small pieces | `Pieces.dc.html` | Update banner, Install card (Safari tab only), photo-missing card face, iPad-full dialog, bad-backup dialog, wordless how-to-play overlay with “Got it”. |

## 2. Card grids

Pick `cols × rows` from the table, then size the cards with the formula. Gap is 20 px for ≤12 cards, 16 px above that, and 10 px on phones.

| Cards | iPad landscape 1180×820 | iPad portrait 820×1180 | iPhone 390×844 |
|---|---|---|---|
| 6 | 3×2 → 353×328 | 2×3 → 368×329 | 2×3 → 174×193 |
| 12 | 4×3 → 260×212 | 3×4 → 238×242 | 3×4 → 112×140 |
| 16 | 4×4 → 196×157 | 4×4 → 177×221 | 4×4 → 82×102 |
| 20 | 5×4 → 196×157 | 4×5 → 177×192 | 4×5 → 82×102 |

```js
// area = viewport − safe areas − side padding − top bar − (iPhone) bottom bar
const cellW = (areaW - (cols - 1) * gap) / cols;
const cellH = (areaH - (rows - 1) * gap) / rows;
const cardW = Math.floor(Math.min(cellW, cellH * 1.25)); // keep 4:5 … 5:4
const cardH = Math.floor(Math.min(cellH, cellW * 1.25));
```

- **Card area:** iPad side padding is 40 (landscape) or 32 (portrait). The cards start at y=120 (after a 108 px top bar) and leave 24 px (landscape) or 32 px (portrait) at the bottom. iPhone: 16 px sides, 52 px top bar at the safe-area top, 64 px bottom control bar above the home indicator.
- **Phone rules:** apply when the shorter side is < 600. A phone in landscape uses the landscape table with a 10 px gap.
- **Viewport:** use `viewport-fit=cover` and add `env(safe-area-inset-*)` to the padding. Recompute on resize and orientation change.
- **Never:** the game screen never scrolls, and card size never changes with text size.

## 3. Card

- Real `<button>`, radius 18 (12 on iPhone), `--shadow-card`.
- Face: 8 px `--surface` mat (5 on iPhone), with the photo inside at radius 12, `object-fit: cover; object-position: center`.
- Back: `assets/app/card-back.svg` (`--card-back`, 11 px inset frame, photo corners, centred motif ≈42% of card width).
- States:
  - **Face down.**
  - **First card:** 5 px `--pick` ring, lifts 4 px.
  - **Second card:** plain.
  - **Matched:** 4 px inset `--accent` ring + 40 px tick badge 14 px from the top-right; stays up, disabled.
  - **Not a match:** no styling change.
  - **Hint:** `--pick` glow pulse.
  - **Photo missing:** grey face, “This photo couldn’t be shown”; still matches its pair.
- ARIA labels: “Card 3, face down” → “Turned over: {caption or ‘Photo’}” → “Matched: {caption}”. Announce matches in a polite live region.

## 4. Components (measurements)

- **Buttons:**
  - Main: 72 px tall, radius 20, 24–26 px bold.
  - Player quiet: 60 px, radius 16, 22 px semibold, 2 px `--line` border.
  - Helper: 48 px, radius 12, 18 px.
  - Icons 24–28 px with a 10 px gap. Every button has a text label.
  - Pressed: `--accent-press` / `--surface-2`. Focus: 4 px `--focus` outline, 4 px offset. Disabled: 50% opacity.
- **Switch:** 76×44, 36 px knob, `role="switch"`, with the word On/Off shown beside it.
- **Segmented:** 5 px track padding on `--surface-2`, options ≥52 px tall, selected = `--accent` fill; `role="radiogroup"`.
- **Dialog:** 560–620 wide, padding 40, radius 24, `--shadow-dialog`, on `--scrim`. Safe choice left, action right. Tapping the scrim does NOT close it.
- **Album tile:** radius 24, cover 210 px tall; no cover → `album-placeholder.svg`.
- **Banner:** `--ink` background, `--bg` text, radius 18, “Tap to refresh” on a light button; stays until tapped.
- **Text input:** 62 px tall, radius 14, 2 px `#8E8377` border, white fill.

## 5. Motion

| Moment | Full motion | Reduced motion |
|---|---|---|
| Card press | lift 4 px + ring, 200ms ease-out | ring only |
| Flip | rotateY 180°, 420ms `cubic-bezier(.2,.7,.2,1)`, perspective 1400 px | cross-fade 220ms linear |
| Match | ring + badge fade/scale .8→1, 240ms; match moment opens 650ms after the tap | fade 220ms |
| Not a match | hold 1200/2000/3200ms, then both flip back together | hold, then fade |
| Hint | glow 0→12 px→0, 1300ms ease-in-out × 3 | steady 6 px ring for 4 s |
| Peek | all flip up, 5 s countdown, flip down left→right with 30ms stagger | fade, no stagger |
| Match moment | fade up from .97, 320ms; 6000ms linear auto bar | fade 200ms, no bar |
| Round complete | overlay 320ms; collage photos 400ms each, 80ms stagger | all fade together |
| Unlock hold | ring fills linearly over 2000ms while held | unchanged (it shows progress) |

## 6. Copy (use as written)

- **Game:** “Find the matching photos” · “Have a good look — turning over in 5” · “I’m ready” · “Hint” · “Restart” · “Back”
- **Match moment:** “Keep playing” · “Read aloud” · “Carries on by itself”
- **Round complete:** “You found every pair” · “Play again” · “Choose another album”
- **Home:** “Pick an album to play” · “Family albums” · “Starter pictures” · “Family helper” · “Settings”
- **Difficulty:** “How many pairs?” · “Played last time” · “A gentle start” · “The most cards” · “Look at all the cards first”
- **Helper:** “Done, lock again” · “N photos saved on this iPad”
- **Back up:** “The photos are only kept in this app on this iPad. If Safari’s website data is cleared, or the app is removed, they are lost. A backup file keeps a copy you can put back.”
- **Errors:**
  - “This photo couldn’t be shown” / “It still matches its pair”
  - “The iPad is full” / “We saved 9 of 14 photos. To add more, free up space in the iPad’s Settings, or remove photos you don’t need here.”
  - “That file couldn’t be opened” / “It doesn’t look like a Photo Pairs backup, or it may be damaged. Nothing on this iPad was changed.”
- **Install card:**
  - “Keep it on the Home Screen”
  - 1 “Tap Share at the top of Safari”
  - 2 “Choose ‘Add to Home Screen’”
  - 3 “Open it once while on Wi-Fi. After that it works without internet.”
  - “Not now”

## 7. Must follow / your call

See `boards/Notes.dc.html`. In short:

**Must follow:**
- Tokens only; no new colours.
- No timers, scores, move counters, lives or fail states.
- The grid table and formula.
- Centre crop on cards; uncropped at the match moment.
- Tap-target sizes.
- Controls away from the cards.
- Restart and delete always confirm.
- The helper unlock.
- A reduced-motion version of every animation.
- Read aloud absent when off.
- No network for photos.
- Real semantic controls.
- Original art only.

**Your call:**
- Code structure.
- IndexedDB layout.
- Backup format details.
- Shuffle and hint choice.
- Tightening copy.
- Service-worker strategy.
- Easing within ±60ms.
- Undrawn iPhone details.

## 8. Decisions that go beyond the brief

- **Pick colour:** a new token, `--pick` #A86B14 (amber), for the first-card ring and the hint glow. Darkened so it passes 3:1.
- **Difficulty:** tapping a choice starts the game straight away.
- **Settings from Home:** opened from Home, Settings can’t change the helper lock.
- **Forgotten code:** reset by a 10 s hold. Photos are never lost to a forgotten code.
- **App name:** “Photo Pairs” is a working title.
- **No word search tokens:** none existed when this was designed, so `tokens.css` is a new system. Reuse its names in the word search app.
