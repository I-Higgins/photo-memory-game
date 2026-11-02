# design/: reference only (don’t serve or precache)

The design for the Photo Pairs memory game (working title), exported from the design canvas.

## Read in this order
1. **`SPEC.md`**: screens, card grid table and formula, card states, component measurements, motion, copy, decisions.
2. **`tokens.css`**: copy to `css/tokens.css` as is. Themes switch with `[data-theme="dark" | "contrast"]` and text size with `[data-text="large" | "xl"]` on `<html>`.
3. **`assets/`**: use these SVGs directly.
4. **`boards/`**: how each screen looks, for checking details.

## assets/
| Folder | What |
|---|---|
| `app/app-icon-1024.svg` | App icon master, full bleed. Generate 512, 192 and 180 PNGs from it. |
| `app/app-icon-maskable-1024.svg` | Maskable version (art scaled to 80%, teal bleed). Generate a 512 maskable PNG. |
| `app/card-back.svg` | The one card back (300×250 viewBox; scale to the card, keeping the 11 px frame inset and the motif at ≈42% of card width). |
| `app/album-placeholder.svg` | Cover for an album with no cover photo yet. |
| `ui-icons/` | 17 icons on a 24×24 grid. Stroke `currentColor` (the heart is filled amber). Always shown with a text label. |
| `starter-packs/<pack>/` | 4 packs × 10 square pictures (100×100 viewBox) with a tinted background, subject kept inside the middle 80% so any centre crop is safe. |
| `demo-photos/` | 10 illustrated stand-in “family photos” in mixed shapes (portrait, landscape, square). For tests and README screenshots only, never shipped as content. |

## boards/
`.dc.html` files are the canvas’s own component format. They need the canvas runtime (`support.js`, not included), so they **won’t render if opened directly**. Read them as annotated markup: the inline styles hold the exact sizes, colours and copy, and the `<script>` holds the demo logic (e.g. the grid maths in `Main.dc.html` and `Layout.dc.html`). Image paths point at `../assets/demo-photos/`.

| Board | Screen |
|---|---|
| `Home`, `PhoneHome` | Home / albums |
| `Difficulty` | Choose how many pairs |
| `Main` | Game (iPad landscape): all states, peek, match moment, round complete, restart confirm |
| `GamePortrait`, `PhoneGame`, `PhoneMatch` | Portrait iPad and iPhone versions |
| `HelperUnlock`, `HelperAlbums`, `HelperAlbum` | Family helper area |
| `Settings` | Settings (live theme and text-size preview) |
| `Pieces` | Update banner, install card, errors, how-to-play |
| `Icon`, `StarterPacks` | Artwork sheets |
| `Tokens`, `Layout`, `Components`, `Motion`, `Notes` | Handoff specs (the same content as SPEC.md, drawn) |

If the boards and SPEC.md ever disagree, SPEC.md and tokens.css win. Ask before guessing.
