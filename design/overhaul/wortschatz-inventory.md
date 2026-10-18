# Wortschatz → GRE Vocab Tester: feature inventory

**Wortschatz repo (absolute path):** `C:\Users\Kallan-Daily\Documents\GitHub\Learning-German`

- Identified by `package.json` (`"name": "wortschatz"`) and `CLAUDE.md` ("Wortschatz - CLAUDE.md … Sister app to GRE Vocab Tester"). It was the only sibling folder of this repo matching either check, so no home-directory search was needed.
- State read: HEAD `78b3540` ("batch unify-pack-completions: wave 1", 2026-10-18), working tree clean.
- Read-only investigation. Nothing in Wortschatz was edited, and this file is the only write in this repo. Analysis date: 2026-10-18.

**Sources read:**
- `CLAUDE.md`
- `design/frontend-inventory.md`, plus the section and option structure of `home-preview.html`, `wordpacks-options.html`, `app-preview.html` and `test-mode-preview.html`
- `app/`, `components/`, `lib/` (including `lib/backgrounds/`), `styles/`, `scripts/` and `tests/`
- `public/manifest.webmanifest`, `public/_headers`, `next.config.mjs` and `wrangler.jsonc`
- the full git log (21 commits) with commit bodies
- the batch-runner prompts in `.batches/*.txt` and their reports in `.batch-runs/*/report.md`, which hold most of the bug history

**Conventions:**
- Every path below is relative to the Wortschatz root unless it is marked `GRE:`.
- `TM` = `components/TestMode.jsx` (2,101 lines).
- Line numbers are as of `78b3540`.
- Nothing was run in a browser. Behaviour comes from reading the code and the batch reports. Anything marked **(unverified)** was inferred, not confirmed.

**Tags:**

| Tag | Meaning |
|---|---|
| `PORT` | Applies to GRE as it is. |
| `ADAPT` | Needs a GRE equivalent; the item says what it would be. |
| `SKIP-AUDIO` | Pronunciation audio, speaker buttons, audio credits, and the German/English pronunciation toggles. |
| `SKIP-GERMAN` | German only. |

The right/wrong **feedback sound** toggle is `PORT`, not `SKIP-AUDIO`.

**Four GRE data facts drive most `ADAPT` notes** (see `GRE: design/overhaul/gre-data.md`):
- `gre_combined.json` has only `definition`, `example` and `fullDefinition`. There is no rank, level or part of speech.
- Packs reference words by **array index**.
- There is no direction concept.
- Storage today is just `marketplaceWordpack` and `wp_upvote_ledger_v2`.

---

## 0. Checklist verification (summary)

Each row points to the numbered item below that describes it in full.

| Checklist item | Status | Notes | Item |
|---|---|---|---|
| UI kit `styles/ui.css`, new tokens, `#050505` bg | Confirmed | `--bg #050505` is in `globals.css:5`, and matches `themeColor` and the manifest colours. | 1, 2 |
| Navbar: active underline + `aria-current` | Confirmed | | 3 |
| Navbar: burger below 760px | Confirmed | Breakpoint is `max-width: 760px`. Escape closes it and it closes on route change. There is no outside-click close and no focus trap. | 3 |
| Navbar: hidden on `/play/*` | Confirmed | | 3 |
| Home: derived counts | Confirmed | | 5 |
| Home: playable try-it card | Confirmed | | 6 |
| Home: "Pick up where you left off" | Confirmed | | 7 |
| Home: CSS mock-up tiles + featured Test tile | Confirmed | | 8 |
| Home: keyboard shortcuts | Confirmed | Keys 1–5. | 9 |
| Animated background system + Play/Pages settings + live previews + reduced motion + hidden-tab pause + fallback to plain | Confirmed | Has one likely sink bug (see Lessons). | 11–13 |
| Word packs: list layout, Up next panel + learning path | Confirmed | | 15 |
| Word packs: categories | Confirmed | | 16 |
| Word packs: equal-height rows | Confirmed | | 17 |
| Word packs: Normal + Harder bars always visible | Confirmed | | 18 |
| Word packs: medal counts | Confirmed | | 19 |
| Word packs: best mastered across rounds | Confirmed | | 20 |
| Word packs: Re-test | Confirmed | Now labelled "Start round N". | 20 |
| Word packs: pack context survives reload | **Partial** | Test mode only. Practice, Learn and Flashcards still lose the pack on reload. | 21 |
| Word packs: Level Review category | Confirmed | | 22 |
| Word packs: generator script with categories and priorities | Confirmed | | 23 |
| Test: visible pool of 5 with streaks | Confirmed | | 25 |
| Test: random pool draws | Confirmed | | 26 |
| Test: full answer card on a wrong answer | Confirmed | | 27 |
| Test: Choose Words with search, scoped to the pack | Confirmed | | 28 |
| Test: Cancel / Escape | Confirmed | | 28 |
| Test: subset progress counts toward the parent pack | Confirmed | | 29 |
| Test: completion screen | Confirmed | | 30 |
| Harder: scheduler, first-try retirement, 2 spaced corrects, cooldown | Confirmed | | 31 |
| Harder: separate storage | Confirmed | | 32 |
| Harder: resumable runs | Confirmed | | 32 |
| Harder: best first-try % | Confirmed | Shown on `/wordpacks` as a sort option. It is not shown in Test mode, and the row label no longer shows it. | 32 |
| Harder: end screen + "Drill missed words" | Confirmed | | 33 |
| Harder: fading caption | Confirmed | | 34 |
| Harder: 2-segment indicator | **Interpretation** | No element is named that. Taken to be the 2-pip relearn indicator. | 35 |
| Answer animations: pip pop with "+1" | Confirmed | | 36 |
| Answer animations: mastered/retired burst | Confirmed | | 37 |
| Answer animations: fly-to-bar + summary card | Confirmed | | 37 |
| Answer animations: overlay never delays advance | Confirmed | | 38 |
| Answer animations: green mastery colour | Confirmed | `--ok #5fd39a`. | 37 |
| Practice/Learn: check/cross + text feedback | Confirmed | | 40 |
| Practice/Learn: keys 1–4 | Confirmed | | 40 |
| Practice/Learn: neutral restart dialog | Confirmed | | 40 |
| Flashcards with key hints | Confirmed | | 42 |
| Daily review across packs | Confirmed | | 43 |
| Direction toggle with per-direction progress | Confirmed | Completion *counts* became direction-independent in the last commit. | 44 |
| Settings: auto-advance delay | Confirmed | | 46, 47 |
| Settings: backgrounds | Confirmed | | 46, 13 |
| Settings: feedback sound toggle | Confirmed | | 46, 48 |
| Settings: "where" labels on each setting | Confirmed | | 46 |
| Progress export/import, Reset all | Confirmed | | 49 |
| Dialogs: red only for destructive actions | Confirmed | | 50 |
| Dialogs: Cancel focused by default | **Confirmed for danger tone only** | Neutral dialogs focus Confirm. | 50 |
| Mobile: viewport-fit cover, safe areas, 100dvh | Confirmed | | 52 |
| Mobile: 16px inputs, autocorrect off | Confirmed | There is no `inputMode` anywhere. | 52 |
| Mobile: 44px targets, touch-action, overflow wrapping | Confirmed | | 52 |
| Mobile: PWA manifest | Confirmed | | 53 |
| Vocab pipeline: stats + validation scripts | Confirmed | | 56–58 |
| Vocab pipeline: grading-collision checks | **Confirmed, narrower than the name suggests** | Exact gloss equality only, as warnings. There is no fuzzy 0.6 collision check. | 59 |

**Additions beyond the checklist:**
- rounds model (20)
- Menu return-path and scroll restore (`dv_return`, 21)
- Daily review entry card (43)
- sentence prompt mode (39)
- the hydration-hidden header (25)
- double-submit and held-Enter guards (38)
- sound settings in their own key (48)
- `navigator.storage.persist()` (49)
- `next/font` and fixed metadata (54)
- `public/_headers` CSP (55)
- append-only pack ids (23)
- raw duplicate-key scanner (57)
- review CSV export (58)
- icon generator (53)
- unit-test suite (60)
- Cloudflare Workers deploy (55)

---

## A. Design system and app shell

### 1. Shared UI kit, `styles/ui.css` — `PORT`

**What the user sees:** one consistent set of buttons, pills, segmented controls, bars, tags, selects and key caps across every page.

**How it works:** loaded once in `app/layout.jsx:3` after `globals.css`. Every rule is a bare class, so page-scoped selectors win (`ui.css:2-6`).

| Class | Lines | What it is |
|---|---|---|
| `.btn-p` | 20-36 | Primary. Coral gradient `#f06554→#d6483a`, radius 10, weight 600. |
| `.btn-s` | 39-54 | Secondary. Outlined, `--line-strong`. |
| `.btn-q` | 57-68 | Quiet underlined text action. |
| `.btn-danger` | 71-82 | Red tint `rgba(255,107,94,.14)`, text `#ffb3aa`. |
| `.btn-neutral` | 85-95 | Near-white fill. |
| focus-visible | 97-104 | Shared 2px blue focus ring. |
| `.pill` | 107-123 | Rounded chip. |
| `.seg` / `.seg.big` | 127-158 | Segmented control with `aria-pressed`. |
| `.bar` / `.bar.done` | 162-177 | 5px coral bar; `.done` turns it `--ok` green. |
| `.tag.words/.forms/.phr/.done` | 180-203 | Small type tags. |
| `.select` | 206-225 | Pill select with a CSS chevron. |
| `kbd` | 228-237 | Key cap. |

Settings `.switch` lives in `settings.css:97-130` and the dialog styles in `dialog.css`.

**Keys:** none.

**GRE today:** GRE has no shared kit. Buttons are styled per page in `styles/components.css`, `home.css` and `wordpacks.css`.

**Port:** copy as is. Drop or rename `.tag.forms` and `.tag.phr`.

### 2. Design tokens and `#050505` background — `PORT`

**Tokens in `styles/globals.css:3-47`:**
- Base colours: `--bg #050505`, `--panel #0f0f11`, `--text #e8eef5`, `--soft #c4c4c8`, `--muted #a8b3c1`, `--accent #64b5ff`, `--coral #ea5746`, `--coral-light #ff8a7a`
- Verdict colours: `--ok #5fd39a` (mastery green), `--bad #ff6b5e`, `--success`, `--danger`
- Hairlines: `--line rgba(255,255,255,.08)`, `--line-strong .16`
- Radii: `--r-sm/md/lg` 8/14/18px
- Padding: `--pad-sm/pad/pad-lg`
- Type scale: `--fs-xs … --fs-xxl`
- Effects: `--blur`, `--ring`, `--ring-muted`, `--shadow-1/2`
- Noun gender: `--der/--die/--das` (German; skip)

`home.css:9-25` overrides some of these inside `#home-landing`.

**Where `#050505` is used:**
- painted by `body{background:var(--bg)}` (`globals.css:70`)
- `viewport.themeColor` (`app/layout.jsx:95`)
- the manifest's `background_color` and `theme_color`
- the navbar as `rgba(5,5,5,.6)`

**Base rules:**
- `html,body{overflow-x:hidden; overflow-x:clip}`, where `clip` is deliberate; see Lessons L13.
- Under `prefers-reduced-motion: reduce`, every animation and transition is zeroed with `!important` (`globals.css:78-83`).
- Do **not** give `html` a background (`globals.css:66-68`): it would paint over the background layer.

**GRE today:**
- GRE's tokens are `--coral`, `--coral-light`, `--accent`, and `#000`/`#050505` bg.
- There is no `--ok`/`--bad`, no line/radius/type scale, and no reduced-motion reset.

**Port:**
- Copy the token block and drop `--der/--die/--das`.
- Keep the GRE coral, since it is the same `#ea5746`.

### 3. Navbar: active state, burger, hidden on `/play/*` — `PORT`

**What the user sees:**
- A fixed 64px blurred bar with links Home, Word Packs, Phrase Packs, Grammar and Settings.
- A coral "Start training" CTA linking to `/play/test`.
- The current page's link has a 2px coral underline sitting on the nav's bottom hairline.
- At 760px and below, the links collapse into a burger. Its panel gives the active link a coral-tint background and shows a full-width CTA.

**How it works (`components/Navbar.jsx`, `styles/navbar.css`):**
- **Active state** (`:19-23`, `:58`):
  - `/` is active only on an exact match; any other link is also active on its sub-routes. Trailing slashes are stripped.
  - Sets `aria-current="page"`. The underline is at `navbar.css:58-71`.
- **Burger** (`navbar.css:112-142`, `@media (max-width: 760px)`):
  - `useState(false)`, toggled by the button.
  - Sets `aria-expanded` and `aria-controls="nav-panel"`.
  - Closes on route change (`useEffect(..., [pathname])`, `:37-39`).
  - Escape closes it and returns focus to the burger (`:42-52`).
  - **Not implemented:** outside-click close, focus trap, body scroll lock.
  - Both `<nav>` elements carry `aria-label="Main"`, a duplicate landmark name.
- **Hidden on `/play/*`:** `if (pathname?.startsWith("/play")) return null;` (`:55`), placed after all hooks so hook order stays valid.
- **Side duty:** calls `requestPersistentStorage()` (`navigator.storage.persist()`) once on mount (`:32-34`).
- **Safe area:** the nav pads by the top, left and right insets (`mobile.css:17-21`).

**Keys:** none.

**GRE today:**
- `GRE: components/Navbar.jsx` already hides on `/play/*`.
- No active state and no burger are documented for it.

**Port:**
- Copy as is with GRE links (Home, Word Packs, Settings).
- Consider adding outside-click close.

### 4. Root layout shell — `PORT`

`app/layout.jsx` mounts, in order:
1. `next/font` Inter (item 54)
2. the stylesheets, with `mobile.css` imported **last** so it wins at equal specificity
3. `<Navbar/>`
4. `<Background/>` (item 11), once
5. metadata and viewport (items 52–54)

The `/play/*` wrappers (`app/play/{test,practice,learn,cards,review}/page.jsx`) are thin client pages: `<XMode onBack={() => location.href = takeReturn("/play/x") || "/"} />`.

**Port:** copy as is, and drop `/play/review` if Daily review is not ported.

---

## B. Home page

### 5. Derived counts — `PORT`

**What the user sees:** the hero facts and footer show the real number of words, phrases and lessons.

**How it works (`app/page.jsx:24-29`):**
- `WORD_COUNT = Object.keys(words).length`, `PHRASE_COUNT`, `LESSON_COUNT`, formatted with `toLocaleString("en-US")`.
- The comment cites GRE's "800+" vs 679 mistake.
- The page is `"use client"` but still prerendered by the export.
- **Cost:** the JSON is bundled into the home page's JS. Wortschatz `sources.js:7-9` calls words.json "500 KB" and avoids bundling it elsewhere.

**Keys:** none.

**GRE today:** the homepage copy says "800+"; the data has 679.

**Port:**
- `Object.keys(gre_combined).length`.
- GRE's file is about 190 KB, so bundling it on the home page is acceptable. Alternatively compute the count in a server component.

### 6. Playable try-it card — `ADAPT`

**What the user sees:**
- A small live drill on the home page: five fixed words (`Hund, Straße, vergessen, Fenster, schnell`, `:36`) in DE→EN.
- Feedback lines:
  - "Correct"
  - "Correct, spelled: X" for a fuzzy match
  - "Not quite. The answer is X."
- Four streak bars. Reaching 4 shows "Mastered. That is how every word works." and then resets.

**How it works (`TryIt`, `app/page.jsx:52-144`):**
- Grades with the real `gradeWord` (`:71`).
- The next word comes 900ms after a correct answer and 1800ms after a wrong one (`:39-40`).
- A `lockedRef` blocks double submits, and the input is `readOnly` while the verdict shows.
- Focus returns with `preventScroll`.
- The input has `spellCheck={false} autoCapitalize="off" autoCorrect="off" autoComplete="off"` and an sr-only label.
- Nothing is saved.

**Keys:** none.

**GRE equivalent:**
- Five well-known GRE headwords (for example Abate, Mitigate, Laconic, Prodigal, Ephemeral), graded with GRE's own matcher: Dice 0.6 against `definition`.
- Show the full definition on a miss.

### 7. "Pick up where you left off" card — `PORT`

**What the user sees:** after any pack has been opened, a card shows the pack title, "x / N mastered" (with " with sentence prompts" in sentence mode) and a Resume button.

**How it works (`ContinueCard`, `app/page.jsx:149-189`):**
- In an effect it reads `loadLastPack()` (`dv_last_pack` = `{id,title,type,keys}`, `lib/progress.js:807-827`).
- It ignores `custom` ids and entries with missing keys or title.
- `dv_last_pack` is written only by `savePack(...)` when a title is passed, which pack rows and lesson buttons do.
- The count is `packSummary(direction, packProgressScope(pack, promptMode), keys).best`.
- Resume always opens Test: `savePack` then `location.href = packHref("/play/test", id)`.
- It renders nothing on the server or the first render.

**Keys:**
- `dv_last_pack`
- reads `dv_settings.direction` and `promptMode`, and `dv_progress_<dir>`

**Known gap:** `resetProgress()` does not clear `dv_last_pack`, so after "Reset all" the card still shows with 0 mastered.

**Port:** copy as is, and clear the key in Reset all.

### 8. CSS mock-up mode tiles and featured Test tile — `ADAPT`

**What the user sees:** each mode tile carries a pure-CSS miniature "screen":
- Test: word, typed input with a blinking caret, verdict, streak bars
- Practice: progress bar and 4 numbered options
- Learn: stacked rotated ghost cards behind a 2×2 option grid
- Phrases: glossed chunks plus an answer box
- Flashcards: a 3D card that flips on hover or `:focus-visible`, and on `:active`/`:focus` for touch

**How it works (`app/page.jsx:276-457`, `styles/home.css:406-719`):**
- The miniatures are `aria-hidden`, with hardcoded sample content.
- The tiles are plain `<a href>` with `accessKey="1".."5"`.
- **Featured Test tile:** `.mode-featured` spans the full grid width as a 2-column inner grid with a coral border and a 1.6rem title. It collapses to one column at 760px and below (`home.css:353-368`).
- Screens use a 3/2 aspect ratio (16/10 for the featured tile). At 480px and below they size to content (`home.css:426-434`).
- Safari needs `-webkit-` prefixes on the 3D properties (`home.css:649-650`).

**GRE today:** tiles with letter glyphs T/F/R on gradient backgrounds (`.tile-icon-styled`), no previews.

**GRE equivalent:**
- Keep Test (featured), Practice, Learn and Flashcards with GRE sample content.
- Drop the Phrases tile.
- GRE's "no emoji in chrome" rule is satisfied; the miniatures are CSS only.

### 9. Home keyboard shortcuts — `PORT`

**What the user sees:** keys 1–5 jump to Test, Practice, Learn, Phrase Packs and Flashcards (`app/page.jsx:42, 198-208`).

**How it works:**
- Ignored when Meta, Ctrl or Alt is held, or when focus is in an input, textarea, select or contentEditable.
- Navigation is a full page load.

**GRE today:** keys 1/2/3 exist.

**Port:**
- Extend to 1–4 (adding Flashcards).
- Add the guard against modifiers and form fields if GRE lacks it.

### 10. Home clears the return path — `PORT`

`clearReturn()` runs on mount (`app/page.jsx:195`). Home is the top of the tree, so a mode opened from here returns here. See item 21.

---

## C. Animated backgrounds

### 11. Background engine and registry — `PORT`

**What the user sees:**
- A full-screen animated layer behind all content.
- It reacts to answers:
  - correct boosts it
  - wrong cuts the boost
  - mastered triggers a big green burst
- It speeds up and brightens as the current word's streak rises.

**Files:**
- `lib/backgrounds/engine.js`, `bus.js`, `state.js`, `ids.js`, `sources.js`, `util.js`
- one module per background
- `components/Background.jsx`
- `styles/backgrounds.css`
- `tests/backgrounds.test.mjs`

**Background ids** (`ids.js`, dependency-free so `progress.js` can import it):

| id | Kind | Behaviour |
|---|---|---|
| `warp` | 2d | Default Play background. Starfield from the origin; speed follows heat; hyperspace plus green stars on master. |
| `constellation` | 2d | Words as stars. Mastered words glow green and link up; the current word gets a coral ring. |
| `liquid` | WebGL | fbm shader at half resolution. Flashes on answers. |
| `fireflies` | 2d | On master they are drawn to the origin, then scatter green. |
| `fireflies-red` | 2d | Default Pages background. Coral, red and orange palette. |
| `halftone` | 2d | Dot field that swells near the pointer and with heat. |
| `grid` | DOM | Spotlight grid with ripples. |
| `rain` | DOM | Word-rain marquee. |
| `aurora` | DOM | Drifting blurred blobs. |
| `ember` | DOM | Static glow. |
| `plain` | none | Body colour only. |

`ids.js` also exports `BACKGROUND_LABEL`, `BACKGROUND_DESC`, `isBackgroundId` and `isGameRoute` (`/^\/play(\/|$)/`).

**Engine, `mountBackground(host, id, {onFail, contained, words})` (`engine.js:55-307`):**
- **Module contract:** each module exports `{kind, flash?, grain?, create(ctx) → {resize, draw, pointer, words, on, destroy}}`.
- **One rAF loop:** `dt` is clamped to 50ms.
- **DPR:** capped at 2 (`MAX_DPR`).
- **Heat:** eased.
- **Origin:** defaults to the viewport centre at 45% height.
- **Shared grain overlay:** SVG feTurbulence at opacity .05.
- **DOM flash backgrounds:** answer flashes are `pulse-ok`, `pulse-bad` and `pulse-master` classes.

**Robustness:**
- **Hidden tab:** `visibilitychange` stops and starts the loop (`:250`), and `start()` refuses to run while `document.hidden`.
- **Reduced motion:** one static frame, no loop, and answer events ignored (`:150, :180, :288`). The CSS loops are also stopped.
- **Errors:** every create, draw, resize and handler call is guarded. On error the background is torn down and `onFail` fires; `err.fallback` names the replacement.
- **WebGL:** `liquid` throws with `fallback: "fireflies"` when there is no context, compile or link fails, or the context is lost (`liquid.js:27-79`).
- **`Background.jsx`:** keeps a `failed` map and resolves with a loop guard, defaulting to `plain`. An error boundary renders null on a crash.

**Mounting (`Background.jsx`):**
- Mounted once in the layout. It renders nothing until after mount, so there is no hydration mismatch.
- Chooses `game ? playBg : pagesBg`.
- Re-reads settings on `SETTINGS_EVENT` (`"dv-settings-change"`) and on `storage` events.
- Tears down on every id change.

**Layering:** `.bgx{position:fixed; inset:0; z-index:-1; pointer-events:none}`. Pages must not paint their own full-page background.

**Keys:** `dv_settings.playBg` and `dv_settings.pagesBg`.

**Port:**
- Copy nearly verbatim.
- GRE must strip its existing page-level backgrounds and glows (the coral home theme gradients, any `#main-section` ambient layer) so the canvas shows.

### 12. Background bus — `PORT`

**Exports (`lib/backgrounds/bus.js`):**
- `bgEvent("ok"|"bad"|"master")`
- `setBgHeat(0..1)`
- `setBgOrigin(x,y)`
- `getBgWords()`
- `setBgWords(list)`, taking strings or `{de, mastered, current}`, deduplicated, at most 200

All are no-ops when nothing is mounted. `state.js` holds `busState`, one global `sink` and the word listeners.

**Call sites:**
- **Test mode:**
  - `ok` on a non-mastery correct answer
  - `bad` on any miss
  - `master` in `playMastery`
  - heat = streak/4 in Normal, or `(2-needs)/2` while learning in Harder
  - origin = centre of the big word, updated on resize
  - words = the run's keys with durable mastery, via `packBgWords`
- **Practice, Learn, Flashcards and Review:** about 24 call sites in total.

**Port:** rename the `de` field in the word objects to `word`.

### 13. Play and Pages background settings with live previews — `PORT`

**What the user sees:**
- On `/settings` under "Background", two pickers: "Play background" ("Test, Practice, Learn, Flashcards and Daily review.") and "Pages background" ("Home, packs, grammar and settings.").
- Each picker is a radio list of name plus one-line description.
- Each has **one live preview** of the selected option.
- Choosing a Pages background changes the real page background immediately.

**How it works (`components/BackgroundPicker.jsx`):**
- `role="radiogroup"`.
- The preview calls `mountBackground(host, id, {contained:true, words, onFail})`, the real module, using `ResizeObserver` and host-relative pointer coordinates.
- The preview box is 16/10 and sticky at `top:5rem`; below 640px it moves above the list.
- `plain` shows "No animation"; a failure shows "Preview unavailable".

**Keys:** `dv_settings.playBg` (default `warp`) and `dv_settings.pagesBg` (default `fireflies-red`). Unknown ids are coerced to the defaults.

**Port:**
- Copy as is.
- Fix the sink restore bug first (Lessons L20).

### 14. Background word sources — `ADAPT`

**How it works (`lib/backgrounds/sources.js`):**
- **Play modes:** publish their scope with `packBgWords(keys, label, known, limit=60)`.
- **Other pages:** `loadPageWords(bgId, direction)` fetches `/data/packs.json`, caching the promise and retrying on failure.
  - Constellation gets up to 40 known words, topped up to 24 when fewer than 12 are known.
  - Rain gets a random 40.

**GRE equivalent:**
- Use GRE headwords, labelled by headword.
- GRE has no `packs.json` holding every word. Either fetch a small `/data/words-index.json` emitted at build time, or import `gre_combined.json`. At about 190 KB it is affordable, but only in the background chunk.

---

## D. Word Packs page

### 15. List layout: Up next panel and learning path — `ADAPT`

**What the user sees**, top to bottom:
1. Daily review card
2. "Up next" panel
3. sticky toolbar
4. collapsible category list

**Up next panel (`components/UpNext.jsx`):**
- Shows the first unfinished frequency band, with:
  - a kicker ("Up next", "Completed", "Selected band" or "Up next, in progress") and "Band i of n"
  - title, description and bar, plus "{mastered} of {count} mastered"
  - all four drill buttons
  - a Reset or "Start round N" link
- Beside it, the **learning path**: an `<ol>` of 34px bars, one per band, each filled from the bottom with its range label underneath.
  - Clicking a band focuses it in component state only; it is never stored.
- When every band is done: "Path complete".
- Before progress loads: "Loading your progress…", holding the panel's place.
- **Path CSS:** `repeat(auto-fill, minmax(46px,1fr))` (40px under 600px). The panel is 2 columns and collapses to 1 under 860px.

**Toolbar (`app/wordpacks/page.jsx:313-352`):**
- **Search:** `foldText` (lowercase, diacritics stripped, ß→ss) over title, description and tense name.
- **Filter chips:** All / In progress / Not started / Completed / Words / Conjugation. They overlap on purpose (`packMatchesStatus`).
- **Sort select:** Default / Most completed / Least completed / Highest accuracy / Lowest accuracy / Best Harder %.
- While filtering, an `aria-live` line shows "N packs match"; an empty result offers a "Clear search and filters" button.
- **Sticky:** `position:sticky; top:var(--pl-nav-h)`, with a full-bleed backing via `box-shadow 0 0 0 100vmax` plus `clip-path`.
- A ResizeObserver publishes `--pl-toolbar-h`, which rows use in `scroll-margin-top`.
- On phones the chips scroll horizontally with a fade mask.

**Files:**
- `app/wordpacks/page.jsx`, `components/UpNext.jsx`, `components/PackList.jsx`, `components/PackRow.jsx`
- `lib/packs.js`: `isBand`, `sortBands`, `packMatchesStatus`, `SORT_OPTIONS`, `foldText`
- `styles/pack-list.css`
- design reference `design/wordpacks-options.html`, combining option A's panel and path with option B's toolbar and list

**Keys:** reads `dv_progress_<dir>`, `dv_hard_<dir>`, `dv_counts` and `dv_settings`.

**GRE today:** a card grid of 12 community packs sorted by likes, with upvotes in `wp_upvote_ledger_v2`.

**GRE equivalent:**
- **Bands need an order.** GRE has no `rank`. Options:
  - add a `rank` field (GRE frequency from past papers)
  - use difficulty tiers
  - fall back to a curated order and accept that the path is "suggested order" rather than frequency
- Drop the Conjugation chip, keeping All / In progress / Not started / Completed.
- **Likes:** decide explicitly whether they survive. They are client-only today and cannot aggregate across users on a static host.

### 16. Categories — `ADAPT`

**What the user sees:**
- One collapsible section per category, in a fixed order: Core Vocabulary, Level Review, Verb Conjugation, Everyday Situations, People & Daily Life, Time & Numbers. Unknown categories land in "Other Packs".
- Level Review and Verb Conjugation start collapsed.
- Every category is forced open while searching or filtering.
- Bands appear in the list only as search or filter results.
- Category header:
  - chevron, name and pack count
  - a best/total bar (hidden under 900px)
  - "{best} / {total} mastered"
  - a green "{completed} / {n} packs" pill

**Files:**
- `lib/packs.js:16-23` (`WORD_PACK_CATEGORIES`)
- `scripts/lib/pack-categories.js`, the CommonJS copy that must stay in sync
- `components/PackList.jsx:14-68`
- `app/wordpacks/page.jsx:65` (`COLLAPSED_AT_START`)
- `groupSummary` in `lib/progress.js:685`

**Keys:** none of its own. Open/closed state lives in component state for the visit.

**GRE equivalent:** for example Core Frequency (bands), Level Review / Full Review, Themes (Argument & Rhetoric, Praise & Criticism, …), Community Packs. Drop the conjugation tense sub-grouping (`tenseOf`).

### 17. Equal-height pack rows — `PORT`

**What the user sees:** every row is exactly the same height regardless of content.

**How it works (`styles/pack-list.css:500-513, 736-792`):**
- One CSS grid per row.
- **Desktop:** `grid-template-columns: 140px minmax(0,1fr) 80px 232px 180px auto`, areas `"medals name size normal hard actions"`, `height: 88px`.
- **≤1380px:** two grid rows at 118px.
- **≤900px:** everything stacks at `height:auto`, with the four buttons in a 4-column grid.
- What holds the height fixed: title and description are `nowrap` with ellipsis, medal tiles are 66px, and the rail footer is a fixed 1.2rem.

**Port:** copy as is.

### 18. Separate Normal and Harder bars, always visible — `PORT`

**What the user sees:** each row has two rails, "NORMAL" and "HARDER", both always shown, including when empty.

**Normal rail (`components/PackRow.jsx:133-164`):**
- **Bar:** current-round % (`roundMastered/total`).
  - Solid green when the round is done (`complete`).
  - When the pack was finished before, a dim green full track (`banked`, about `rgba(95,198,131,.24)`) with the coral current-round fill on top, so the bar never looks empty after a completion.
- **Main text:** "**best** / N mastered", or "–" before progress loads.
- **Side slot**, in priority order:
  1. a green "Start round N" button with a redo icon
  2. "Round N: x / N"
  3. "Last run X%"

**Harder rail (`:166-182`):**
- **Bar:** `resumeRetired/total` while a run can be resumed; full green when a finished run exists and none is in progress.
- **Text:** "Resume: x / N retired", "Last run finished" or "Not run yet".

**Files:** `components/PackRow.jsx` (`Bar` at `:42-48`) and `lib/progress.js` (`packSummary` at `:632-664`).

**Keys:** `dv_progress_<dir>` (rounds, mastered) and `dv_hard_<dir>` (run).

**Port:** copy as is, after fixing the `stat.finished` crash (Lessons L1).

### 19. Medal completion counts — `PORT`

**What the user sees:** two square tiles on the left of each row, "N×" above "NORMAL" and "N×" above "HARDER".
- Dim grey at 0.
- Green text, background and border at 1 or more.
- Tooltip "Completed N times".
- There is no icon.
- Zeros show until progress has loaded: "no medal is ever shown that storage has not confirmed" (`PackRow.jsx:80-82`).

**How it works:**
- Counts come from `stat.completions` and `stat.hard.completions`.
- Since `78b3540` both are stored **direction-independently** in `dv_counts` = `{version:1, normal:{scopeId:n}, hard:{scopeId:n}}`.
- That store is migrated once by summing both directions (`readCounts()`, `lib/progress.js:298-386`).
- It is still split per prompt-mode scope (`:sentence`).
- Increments happen in `markScopeComplete` (Normal) and `recordHardRun` (Harder).

**Keys:** `dv_counts`. The per-direction `completions.count` is kept internally for `best`.

**Port:**
- Copy as is.
- GRE has no direction yet. If a direction toggle is added (item 44), start with the unified `dv_counts`-style store from day one so no migration is needed.

### 20. Rounds: best mastered persists, "Start round N" (Re-test) — `PORT`

**What the user sees:**
- Once a pack has been fully mastered, the list shows it as N / N **forever**.
- "Start round N" (formerly "Re-test") lets the user drill it again. A neutral dialog explains that the pack stays N / N and keeps its completions.
- While the pack is not finished, the same affordance is a plain "Reset" with a red dialog.

**How it works (`lib/progress.js`):**
- **Scope shape:** `{mastered, streaks, completions:{count, records[{at, accuracy, answered, backfilled}], credited}, round, known}`.
- `best = count > 0 ? total : roundMastered`.
- **`clearScopeProgress`** (`:557-572`):
  - When `credited`: round + 1, the round's ids move into `known`, `mastered`/`streaks` are cleared, completions are kept.
  - Otherwise: current-round mastery is cleared and nothing else.
- **`markScopeComplete`** (`:399-427`) is the only place a completion is counted. It is idempotent through `credited`.
- `computeStats` backfills old saves with `at:null, backfilled:true`.
- **Migration:** a missing `round` becomes `count + (credited?0:1)`.

**Which reader uses which mastery** (CLAUDE.md "Which mastery each reader uses"):

| Reader | Uses |
|---|---|
| Test mode | current round |
| Pack list, headers, Continue, Up next, Completed filter | best |
| In progress filter, Reset visibility | current round |
| Daily review seeding, Flashcards filter | durable (`known ∪ mastered`) |

**Helpers:** `lib/packs.js` (`isRetest`, `resetLabel`, `nextRoundLabel`) and `tests/pack-rounds.test.mjs`.

**Keys:** `dv_progress_<dir>`.

**Port:**
- Copy as is.
- Note the edge case in Lessons L9: a pack that grows after completion still shows N / N.

### 21. Pack context survives reload and Back; return path — `PORT`

**What the user sees:**
- `/play/test?pack=<id>` keeps the pack across reload and Back.
- The "← Menu" button returns to the exact page *and scroll position or row* the user launched from.
  - On `/wordpacks` it reopens a collapsed category or refocuses the band in Up next.

**How it works:**
- **`?pack=` handling** (`packHref(route,id)` and `packIdFromUrl()` in `lib/progress.js:782-786`; TM hydrate `:452-546`):
  - Reads `window.location.search` inside the hydrate effect, so no `useSearchParams` or Suspense is needed.
  - URL id matching the `dv_pack` id: use the stored keys.
  - Otherwise: resolve the keys from `packs.json` (`no-store`).
  - Unknown id: drop the param and use the global feed.
  - A bare `dv_pack` with no param: adopted, and its id written into the URL with `replaceState`.
  - Hydration runs once behind a ref (StrictMode-safe).
  - Choose Words "custom" selections strip the param (`TM:1218-1231`).
- **Return path, `dv_return`** (`lib/progress.js:829-938`):
  - `rememberReturn(toRoute, anchorId)` stores `{path, scroll, to, anchor?, anchorTop?}`.
  - `takeReturn(fromRoute)` re-arms the record as `{…, restore:true}`, honouring only a record whose `to` matches that route.
  - `consumeReturn` / `consumeReturnScroll` run once on the destination page.
  - `lib/use-return-scroll.js` waits 2–12 frames for the anchor, then honours `scroll-margin-top` so a returning row is never hidden under the sticky toolbar.
- **Gap:** `packHref` adds `?pack=` for Test only. Practice, Learn and Flashcards consume `dv_pack` once (`QuizMode.jsx:211-213`, `FlashcardMode.jsx:127-129`), so **a reload there falls back to the global feed.**

**Keys:** `dv_pack` (`{id, keys, type}`), `dv_return`, `dv_last_pack`.

**GRE today:**
- `/play/test?id=<packId>` or `?pack=1,5,9` (CSV indices).
- `localStorage["marketplaceWordpack"]` is consumed once.

**Port:**
- Copy, and extend `?pack=` to every mode.
- Pack keys must be headwords, not indices (item 24).

### 22. Level Review category — `ADAPT`

**What the user sees:** generated review packs that cut a whole CEFR level into 360-word parts in rank order, for example "A1 Review, Part 1 of 2". They sit in their own collapsed category after Core Vocabulary.

**How it works (`scripts/build-packs.js:399-437`):**
- `LEVEL_PART_SIZE = 360`.
- Ids are `gen-level-<lvl>-<n>`; A2's first part keeps `gen-level-a2` (`LEGACY_FIRST_PART_ID`).
- Priorities count from 1.
- A trailing part under 5 words waits until it has enough.
- Current output: a1-1, a1-2, a2, a2-2, b1-1, b1-2.

**GRE equivalent:**
- GRE has no CEFR levels.
- Use "Full Review, Part n": fixed-size slices of the whole list in rank order, or difficulty tiers if a `difficulty` field is added.
- Keep the same append-only id rules.

### 23. Pack generator: categories, priorities, append-only ids — `ADAPT`

**What it does (`scripts/build-packs.js`, run as npm `prebuild`):**
- Reads `data/packs-manual.json` (83 hand-curated packs).
- Appends deterministic `gen-` packs: frequency bands `gen-rank-<from>-<to>`, level parts, conjugation packs and phrase packs.
- Writes `public/data/packs.json` (132 packs). **Never hand-edit that file.**

**Frequency bands:**
- `Essential Words 1-50`, `51-120`, `121-200`, `201-300`, then bands of 100.
- Already-published bounds are frozen in `PUBLISHED_BAND_BOUNDS`.
- New bands take their *planned* range id up front, so a band fills in place rather than being renamed as words arrive.

**Append-only guarantee (`checkAppendOnly`, `:664-695`):**
- Every surviving key of an existing `gen-rank-*` / `gen-level-*` pack must stay a prefix of the rebuilt pack.
- `--allow-reshuffle` overrides the check, at the cost of resetting progress.

**The build fails on:**
- a manual id starting `gen-`
- an unknown category for the pack's type
- a missing or non-integer priority
- a duplicate id
- caps exceeded (`MAX_CONJUGATION_PACKS = 20`, `MAX_GENERATED_PHRASE_PACKS = 12`)
- orphaned phrases

**Other build behaviour:**
- A manual words pack's level label is *derived* from its items (`levelSpan`).
- Output is sorted by category order, then priority, then id.
- Lessons are stamped onto packs by `attachLessons` (German grammar).

**Keys:** none. Pack ids become `pack:<id>` progress scopes, which is why ids must be stable.

**GRE equivalent:**
- `data/packs-manual.json`: migrate the 12 current packs using their `words` mirror, so they hold headwords.
- Add a generator for bands and review parts; this needs a GRE `rank`.
- Keep `MIN_PACK_KEYS = 5`, category and priority validation, and append-only checks.
- Drop forms, phrases and lessons.
- This also retires GRE's `POST /api/wordpacks/create`, which cannot run on the static host.

### 24. Packs reference words by key, not index — `ADAPT`

**How it works:** Wortschatz packs store `keys` (lemmas). `scripts/sort-vocab.js` is therefore safe to run.

**GRE equivalent:**
- Migrate `indices` to headword `keys`. Every GRE pack already carries a `words` mirror that matches its `indices` exactly (gre-data.md).
- Then `npm run sort:vocab` stops being destructive.
- **Prerequisite** for items 15–23.

---

## E. Test mode

### 25. Visible pool of 5 with streak pips, and hydration-hidden header — `PORT`

**What the user sees:**
- A strip of up to five boxes, each with the word's label and 4 pips (coral when filled).
- The current word has a coral border and tint.
- A newly swapped-in word pops in (0.4s `tm-pop`).
- Caption: "Five words in rotation. Four in a row masters one, and the next word takes its place."
- A larger 4-pip streak row sits under the prompt.
- In-game header:
  - "← Menu" and the title
  - a progress bar with "N of M mastered"
  - Difficulty seg, Word/Sentence seg, sound control, delay select, direction pill
  - The middle and right sections stay `visibility:hidden` until settings hydrate, so default values never flash.
- The strip is hidden in Harder and during the final "Mastered" feedback.

**Files:**
- `TM:1877-1900` (strip), `:1955-1964` (streak), `:1711-1795` (header)
- `styles/testmode.css:349-482`
- constants in `lib/matching.js:6-17`: `POOL_SIZE 5`, `WORD_STREAK_TO_MASTER 4`

**Keys:** `dv_progress_<dir>.scopes[id].streaks` (written on every answer).

**GRE today:** a 5-word subset with mastery 4, without the visible pool strip.

**Port:** copy as is. The constants are identical to GRE's.

### 26. Random pool draws, streaks zeroed per run — `PORT`

**How it works:**
- **Initial pool:** `lib/pool.js` `buildPool(scopeKeys, masteredSet, opts)` draws up to 5 unmastered keys at random with no repeats. It uses `crypto.getRandomValues` by default; `rng` or `seed` can be injected for tests.
- **Refill:** `drawPoolRefill(scopeKeys, taken)` picks one random key outside the pool and the mastered set.
- **Next card:** `pickNext` (`TM:776-782`) chooses a random pool member other than the one just shown. It uses `Math.random`.
- **Every session start** (`startSelectionSession`, `TM:367-401`) zeroes the in-memory streaks and, in Normal, calls `clearScopeStreaks(dir, scopeId)`. That drops stored streaks but keeps mastered ids and completions.

**Tests:** `tests/pool.test.mjs`, `tests/run-streaks.test.mjs`.

**Keys:** `dv_progress_<dir>`.

**Port:**
- Copy as is.
- GRE CLAUDE.md forbids changing the 5-word subset and mastery 4; random selection changes neither.

### 27. Full answer card on a wrong answer — `ADAPT`

**What the user sees:**
- "✕ Not quite" in red.
- A word card (`components/WordFeedback.jsx:33-90`) with the answer language as the large line:
  - DE→EN: English glosses large, then article, German and plural small, then the example pair.
  - EN→DE: the reverse.
- On a correct but fuzzy answer: "Correct, spelled: **X**".
- A correct exact answer shows no visible verdict, only sr-only text.
- The feedback area has a fixed `min-height: 13rem`, so the layout never jumps.

**How the user continues:**
- **Normal:** retypes the same word immediately. The input is cleared and refocused with a red border; there is no wait.
- **Harder:** a fixed 1200ms lock (`HARD_WRONG_DELAY_MS`), then automatic advance.

**Files:** `components/WordFeedback.jsx`, `TM:1517-1685`, `styles/testmode.css:1424-1428`.

**Keys:** none.

**GRE equivalent:**
- The card shows headword, `definition` (large in word→definition), `fullDefinition` and `example`.
- Drop article colours and plurals.

### 28. Choose Words modal: search, Cancel/Escape, scoped to the pack — `PORT`

**What the user sees:**
- A quiet "Choose words" link under the answer area opens a modal with:
  - a search box
  - Select all / Clear, applying to the filtered rows
  - a checkbox list
  - footer "n of N selected", plus ". Pick at least 5." in coral when short
  - "Drill these" (disabled under 5) and Cancel
- Escape, Cancel or a backdrop mousedown leave the running drill untouched.
- Inside a pack it lists **only that pack's words**, and still the whole pack while a subset is running.

**How it works:**
- **Files:** `components/ChooseWords.jsx`; opened from `TM:1197-1248`.
- **Search:** folds case and diacritics over article + key + gloss + `enAlt`.
- **Offered list:** `pickerKeys || ALL_KEYS`, where `pickerKeys` is fixed at hydrate.
- **Initial selection:** filtered to the offered keys, so a stale selection never counts.
- **Modal behaviour:**
  - Focus goes to the search box.
  - Body scroll is locked.
  - Tab is trapped; `role="dialog" aria-modal`.
  - The drill's Enter listener and input focus are paused while it is open (`keysBlocked`).

**Keys:** writes into the target scope (item 29). The selection itself is not persisted.

**GRE today:** an overlay listing every word with checkboxes.

**Port:** copy as is.

### 29. Subset progress counts toward the parent pack — `PORT`

**How it works:**
- **Choosing the scope:** `selectionTarget(packId, packKeys, chosen)` (`lib/progress.js:703-709`).
  - Inside a pack, the subset runs **in that pack's own scope** `pack:<id>`, flagged as a subset unless every pack word was picked.
  - Outside a pack it uses `pack:custom`.
- **Crediting:** the pack is credited only when `allMastered(packKeys, mastered)`. A finished subset gets its own done screen but no pack completion and no "Next band".
- **Subset reset:** `clearScopeKeys` clears only the picked words. If that round was credited, it starts round + 1.
- **Harder subsets:** saved to `<scope>#subset` (`hardRunScope`). They resume only if `hardStateMatchesKeys` (the exact same key set).
- **Header title:** "{pack}: selection".

**Tests:** `tests/choose-words-subset.test.mjs`.

**Keys:** `dv_progress_<dir>` and `dv_hard_<dir>`.

**Port:** copy as is.

### 30. Normal completion screen — `ADAPT`

**What the user sees:**
- Heading "Alles gemeistert!".
- "You mastered all N words in {scope}, for {DE → EN · word prompts}."
- Stats: mastered count, answers given, first-try accuracy %.
- Primary button: "Next band: {range}" for a frequency band with a next band, otherwise "Back to Word Packs".
- Quiet button: "Start round N+1" (neutral dialog) or "Re-test" (danger dialog).
- The answer that masters the last word still shows its "Mastered" feedback for the advance delay before this screen appears.

**How it works:**
- `TM:1801-1839`.
- `complete = scopeMastered && !(advancing && feedback?.masteredNow)` (`TM:661`).
- Accuracy comes from session-only counters (`TM:244, 955-984`).
- `markScopeComplete` runs once from an effect (`TM:722-732`).

**Keys:** `dv_progress_<dir>` and `dv_counts`.

**GRE equivalent:**
- Heading "All words mastered" (English, professional).
- "Next band" only once bands exist.

### 31. Harder mode: scheduler — `PORT`

**What the user sees:**
- A Normal | Harder segmented toggle in the Test header.
- In Harder, there is no pool strip. Every word in the scope is in play, and the header reads "N of M retired".

**How it works (`lib/hard-scheduler.js`, pure and React-free):**
- **Statuses:** `unseen` → (correct on first draw) `retired` for the session, or (miss) `learning` with `needs = HARD_RELEARN_CORRECT` (2).
  - Each later correct answer decrements `needs`; at 0 the word is retired.
  - Any later miss resets `needs` to 2.
- **Cooldown:** after an answer that leaves a word unretired, it waits `HARD_COOLDOWN_CARDS` (3) other cards.
  - If everything is cooling down, the word with the soonest `availableAt` goes early.
- **Repeats:** never the same key twice in a row unless it is the only one left.
- **`next()`** is idempotent until `recordResult`, so a re-render can never skip a card.
- **`serialize()` and `restoreHardScheduler`** drop keys that left the scope, add new keys as unseen, and turn corrupt state into a fresh run.
- **`stats()`** returns `{totalWords, retired, retiredFirstTry, missed, cardsShown}`.
- Switching difficulty mid-session starts a fresh selection session over the same scope. It never splices a running pool into a scheduler or the reverse.

**Tests:** `tests/hard-scheduler.test.mjs`.

**Keys:** `dv_settings.difficulty` (`"normal"` or `"harder"`). The toggle is only in the Test header, not on `/settings`.

**Port:**
- Copy verbatim, moving the two constants with it.
- Does not alter Normal's mastery 4, the 0.6 threshold or the pool of 5.

### 32. Harder: separate storage, resumable runs, best first-try % — `PORT`

**How it works (`lib/progress.js:1069-1207`):**
- **Storage:** `dv_hard_<dir>` = `{scopes:{<scopeId>[#subset]:{run, count, runs:[{at, firstTryPct, totalWords}]}}}`.
- **Functions:**
  - `loadHardProgress`, `saveHardRun`
  - `recordHardRun`: appends the run, clears `run`, bumps `dv_counts.hard`
  - `restartHardRun`: clears `run`, keeps history
  - `resetHardScope`
  - `hardRetiredKeys`, `hardBestPct`, `hardLastPct`
- **It never touches `dv_progress_*`.** The only shared effect is that a retired word is enrolled in Daily review.
- **Resume** (`startHardRun`, `TM:403-434`):
  - Restores the saved run unless the run is `fresh` or `temp`.
  - Subsets also require an exact key match.
  - A restored run with nothing left to ask starts fresh instead.
- **Saving:** after every answer (`persistHardRun`, `TM:436-450`). The run is **recorded on the answer that retires the last word**, so a reload during the final feedback cannot lose it.
- **"Restart run"** under the answer area opens a neutral dialog and then `restartHardRun`.
- **Best first-try %** appears only as the "Best Harder %" sort on `/wordpacks`.

**Tests:** `tests/hard-progress.test.mjs`.

**Port:** copy as is.

### 33. Harder end screen with missed words and "Drill missed words" — `PORT`

**What the user sees** (`components/SessionSummary.jsx`; `TM:1840-1871`):
- Title "Session complete".
- Hero: "retiredFirstTry / totalWords" with a % pill, labelled "words known on the first try".
- Stats: cards shown, words missed.
- "Missed, hardest first:" list with a ×N badge per row, ordered by direction, or a "Perfect run" block.
- Actions:
  - **Drill missed words** (primary, only when there were misses): a temporary run over the missed keys that is never saved, resumed or recorded (`hardTemp`)
  - Start another session (fresh; replaces the saved run)
  - Menu

**Keys:** `dv_hard_<dir>`.

**Port:** copy as is. Replace the "★" in "Perfect run" with a non-emoji glyph or plain text, per GRE's no-emoji rule.

### 34. Harder fading caption — `PORT`

**What the user sees:** "**Harder:** Words you get right on the first try are retired. Missed words come back until you get them right twice." It appears under the header for 5s on every Harder run start, then fades out over 1s.

**How it works:**
- `TM:115-118, 619-631, 1790-1794`; `testmode.css:509-528`.
- `CAPTION_SHOW_MS 5000` and `CAPTION_FADE_MS 1000`.
- Absolutely positioned with `pointer-events:none`, so the page does not shift when it goes.

**Port:** copy as is.

### 35. Harder 2-segment relearn indicator — `PORT`

This is the interpretation of "2-segment indicator": no element is named that.

**What the user sees:**
- Under the prompt, two pips appear only while a word is `learning`. Filled pips show correct answers since the last miss, with aria text "X of 2 correct answers since the last miss".
- A first draw shows no pips.
- A word that just retired after relearning shows both pips green with the win stagger.

**Files:** `TM:1931-1954, 1013-1023`.

**Other two-part UI in Harder:** the Normal | Harder segmented toggle, and the Normal and Harder rails on pack rows (item 18).

**Port:** copy as is.

### 36. Correct-answer pip pop with "+1" — `PORT`

**What the user sees:** on a correct answer that does not master the word:
- The newly filled pip flashes green and bounces (`scale(1.35, 3.2)`, 0.6s).
- A "+1" floats up (1s).
- The word glows green, with the glow clamped to the advance delay (at most 850ms, or the full 850 in manual mode).

**How it works:**
- `popPip` (`components/MasteryFx.jsx:180-214`) places a fixed `.tm-popfx` node on `<body>`, positioned from the pip's rect measured **at grading time**.
- The node removes itself after 1000ms, so it survives the swap to the next word.
- CSS is in `testmode.css:780-865`.

**Port:** copy as is.

### 37. Mastered/retired burst, fly-to-bar, summary toast, green mastery colour — `PORT`

**What the user sees** on mastery (Normal) or retirement (Harder), via `playMastery`, `TM:862-905`:
1. `bgEvent("master")`. The pips turn green in sequence (70ms stagger), and the word turns green and scales to 1.08.
2. **Confetti** (`burstConfetti`, `MasteryFx.jsx:31-109`):
   - a fixed canvas on body with 110 pieces
   - colours `#5fd39a`, `#8be0a7`, `#ea5746`, `#ececef`
   - DPR at most 2
   - removes itself when the last piece fades
3. **Fly to bar** (`flyToBar`, `MasteryFx.jsx:115-174`):
   - starts at 380ms; a green ghost copy of the word animates for 900ms to the header bar's new fill position
   - the header bar holds the old count until the ghost lands, then fills and glows for 1100ms
4. **Summary toast** (`MasteryToast`, `MasteryFx.jsx:227-260`):
   - a portal on body, fixed, centred 12px below the answer row
   - content: ✓, "word → meaning", "Mastered · x of N" (or "Retired"), "+1"
   - shows for 1.6s, then fades over 0.4s
   - a new toast replaces the old one instead of stacking
   - `aria-hidden`; sr-only text carries the same announcement

**Green:** `--ok: #5fd39a` (`globals.css:19`).

**Reduced motion:** no confetti, no flight, no pip pop. The bar just updates and the toast still shows (`TM:875-878`; `testmode.css:979-994`).

**Port:**
- Copy as is.
- The ✓ glyph is a typographic mark, not an emoji, so it fits GRE's rules. Confirm with the owner.

### 38. Animations never delay auto-advance; input guards — `PORT`

**How it works:**
- **One gate:** `scheduleAdvance(nextKey, delay)` (`TM:924-930`) is the only thing between grading and the next card: one `setTimeout(delay*1000)`.
  - No animation callback calls `runAdvance` or `advanceTo`.
  - All lasting motion is a body-level fixed node or a portal with `pointer-events:none`.
- **On advance:** `releaseWordFx()` launches a pending flight from where the old word sat and drops only the word's own classes.
- **Full teardown:** `clearFx()` runs only on unmount and session restarts.
- **Guards:**
  - `submitLockRef` is a synchronous double-submit guard (`TM:247-255`).
  - The input's `onKeyDown` ignores a repeated Enter (`TM:1976-1981`), so a held Enter can't grade a blank answer.
  - The manual-advance listener ignores `e.repeat`, pauses while any dialog is open, and is removed once the completion screen is up.
  - Focus is keyed on an `attempt` counter rather than the current word, so it is restored even when the same word is re-presented.

**Port:** copy as is.

### 39. Sentence prompt mode — `ADAPT`

**What the user sees:**
- A "Word | Sentence" seg in the Test header.
- In Sentence mode the prompt is the example sentence: DE→EN shows `exampleDe` and expects `exampleEn`.
- After grading, feedback compares expected and given text and highlights the headword in the sentence.

**How it works:**
- Phrase mechanics: `gradePhrase`, Dice ≥ 0.75, streak 3.
- A separate `:sentence` scope suffix (`promptScope`, `packProgressScope`).
- Headword highlight uses a longest-prefix heuristic (`TM:146-196`).

**Keys:** `dv_settings.promptMode` (`"word"` or `"sentence"`) and `:sentence` scopes.

**GRE equivalent:**
- **"In context"** mode: show `example` with the headword blanked, and ask for the headword. This is cloze recall, graded like a word (0.6 or exact).
- Or show `example` and ask for the definition.
- Either needs its own scope suffix.
- Note: it must not change GRE's Normal word constants.

### 40. Practice and Learn: check/cross, text feedback, keys 1–4, neutral restart — `PORT`

**What the user sees** (`components/QuizMode.jsx`, wrapped by `PracticeMode.jsx` and `LearnMode.jsx`):
- Four options, each with a `<kbd>` number. Hint: "Press 1 to 4 to answer".
- **After an answer:**
  - ✓ or ✕ marks on the options; the correct option is revealed after a miss.
  - Text line "✓ Correct" or "✕ Not quite. It means "X"."
- **Timing:**
  - Wrong answers lock for a fixed `LOCKOUT_MS = 1200`.
  - Correct answers wait `advanceDelay`, or Enter/Space in manual mode.
- **Restart / Reshuffle pills:**
  - Practice: "Restart from the first word?"
  - Learn: "Reshuffle and start over?"
  - Both use **neutral** dialogs and end "Your mastery progress is not affected."
  - Hidden at position 0.
- **"Leave pack"** returns to the global feed in place.

**How it works:**
- **Keys 1–4** (`:325-345`): ignore repeats and modifiers, do nothing while a dialog is open, the answer is locked, or focus is in a SELECT/INPUT/TEXTAREA (the delay select reacts to number keys).
- **Distractors** (`pickDistractors`, `:117-170`): two options with the same display text are never shown together.
- Pack-aware through `dv_pack`.
- Practice persists its position per scope.
- **Gap:** the manual-advance listener does not check `e.repeat` here (Test and Review do).

**Keys:**
- `dv_practice_pos` = `{scopeId: index}`
- reads `dv_pack` and `dv_settings`
- Learn's deck lives in component state only

**GRE today:**
- Practice and Learn exist, with colour-only feedback, no number keys and no pack awareness.
- GRE's Learn already uses `crypto.getRandomValues`.

**Port:** copy as is. GRE also has multi-sense headwords with identical definitions, so the distractor de-duplication matters.

### 41. Pack awareness in every mode — `PORT`

Practice, Learn and Flashcards all read the same `dv_pack` handoff (`loadPack`, `clearPack`, `DATASETS`), so any pack can be drilled in any mode. Each pack row offers:
- "Type" (Test)
- "Multiple Choice" (Practice)
- "Shuffle" (Learn)
- "Browse" (Flashcards)

**GRE today:** packs open only in Test.

**Port:** copy as is, and add `?pack=` to every mode (item 21).

### 42. Flashcards mode with key hints — `PORT`

**What the user sees** (`/play/cards`, `components/FlashcardMode.jsx`, `styles/flashcards.css`):
- A 320px card that flips with a CSS `rotateY` transition (with `-webkit-` prefixes).
- Prev / Next / Restart controls; Restart has no dialog.
- Toggles:
  - "Shuffled | In order" (crypto shuffle, no repeats until the deck is exhausted)
  - "All | Mastered | Unmastered"
- A "Mastered" corner tag on known cards.
- On-screen key hints: "Space flip ← → move"; touch devices show "Tap the card to flip".

**Keyboard:**
- Space flips only when focus is on the card or the body, so one press never both flips and presses Next.
- Arrow keys move.
- Enter flips the focused card (not mentioned in the hint).

**Read-only, a permanent rule:**
- Flashcards never writes progress.
- It reads durable mastery (`loadKnown`) only, for the filter.

**Keys:** reads `dv_pack`, `dv_progress_<dir>` and `dv_settings`. Writes `dv_settings` only on a direction change.

**GRE equivalent:**
- Front: headword. Back: definition, fullDefinition, example.
- New route `/play/cards`.

### 43. Daily review across packs — `ADAPT`

**What the user sees:**
- A "Daily review" card on the home page and `/wordpacks`, with a count badge and "Start review" or "All caught up". It is hidden until at least one word is tracked.
- `/play/review` is a typed-recall session over words mastered anywhere.
- **Wrong answer:** "Not quite. This word comes back before the session ends." plus the word card.
- **Summary:** reviewed, correct first try and missed, with a "Review more" button when the cap allows.

**How it works:**
- **Scheduler** (`lib/review.js`, pure): ladder `REVIEW_INTERVALS [1,3,7,14,30,60,120]` days, with the top step repeating.
  - Only the **first** answer of a session moves a word: correct steps up, a miss drops it back to 1 day.
  - A miss re-queues the word `REVIEW_RETRY_GAP = 3` cards later until answered correctly.
  - Due dates are local `YYYY-MM-DD` strings (DST-safe).
- **Enrollment:** `enrollReview` on first mastery anywhere, Normal or Harder.
  - On the first run, existing mastery is seeded once, spread over 14 days (`REVIEW_SEED_SPREAD_DAYS`).
- **Daily cap:** `reviewCap`, default 50, options `[10,20,30,50,100,200]`, per direction per day.
- **Queue order:** most overdue first, then rank.
- Review never touches pack mastery or completions.

**Files:**
- `lib/review.js`
- `lib/progress.js:977-1067`
- `components/ReviewMode.jsx`, `components/DailyReviewEntry.jsx`
- `app/play/review/page.jsx`
- `tests/review.test.mjs`

**Keys:** `dv_review_<dir>` = `{seeded, words:{k:{interval,due}}, day:{date,reviewed}}`, and `dv_settings.reviewCap`.

**GRE equivalent:**
- Port `lib/review.js` verbatim.
- The rank tiebreak needs a GRE `rank`, or use alphabetical order.
- This gives GRE a real spaced-repetition feature, which matters because GRE marketing already says "spaced repetition" and its code has none (GRE CLAUDE.md).
- Tag `ADAPT` only because of the rank tiebreak and word fields.

### 44. Direction toggle with per-direction progress — `ADAPT`

**What the user sees:**
- A "DE → EN | EN → DE" pill in every mode's header and on `/settings` ("All modes.").
- Mastering a word in one direction does not master it in the other.

**How it works:**
- `dv_settings.direction`.
- Per direction: `dv_progress_<dir>`, `dv_review_<dir>`, `dv_hard_<dir>` (`DIRECTIONS`, `lib/progress.js:1213`).
- Since `78b3540`, completion **counts** (`dv_counts`) are direction-independent, while bars, best and the Completed filter remain per direction. See Lessons L5.
- **Gap:** `loadSettings` does not validate `direction`.

**GRE equivalent:**
- "Word → Definition" (today's mode) and "Definition → Word" (type the headword from its definition, graded exact or at 0.6).
- Definition → Word needs collision handling (item 59): GRE has identical definitions for some multi-sense headwords.

### 45. Rounds-aware reset copy and per-scope reset affordances — `PORT`

**What the user sees:**
- Reset dialogs state exactly what is cleared, for example "Reset Test progress for the global word feed (DE to EN, word prompts)?".
- `window.confirm()` is never used.
- Pack rows no longer carry a plain Reset (removed in batch `remove-row-reset`). Only "Start round N" remains.
- Test mode keeps a quiet "Reset progress" / "Restart run" link under the answer area, gated on `hasProgress()`.

**Files:** `TM:2023-2098` and `app/wordpacks/page.jsx:383-402`.

**Port:** copy as is.

---

## F. Settings, sound, backup, dialogs

### 46. Settings page with "where" labels — `PORT`

**What the user sees:** `/settings` with three groups (plus Backup, item 49), each row labelled with the modes it affects (`<span class="where">`):

| Group | Control | "Where" label (quoted) | Tag |
|---|---|---|---|
| Study | Direction | "All modes." | ADAPT (item 44) |
| Study | Prompt type (Word / Sentence) | "Test, word packs." | ADAPT (item 39) |
| Study | Daily review limit | "Daily review, per direction." | ADAPT (item 43) |
| Answers | Time before the next question | "Test, Practice and Learn." | PORT (item 47) |
| Answers | Strict articles | "Test, English to German." | SKIP-GERMAN |
| Answers | Sound (master pill plus three switches) | "Test, Practice, Learn, Flashcards and Daily review." | PORT for the feedback switch (item 48) |
| Answers | Audio credits | none | SKIP-AUDIO |
| Background | Play background | "Test, Practice, Learn, Flashcards and Daily review." | PORT (item 13) |
| Background | Pages background | "Home, packs, grammar and settings." | PORT (item 13) |

- Difficulty is *not* on `/settings`; it is in the Test header only.
- The page shows "Loading…" until hydrated.
- `update(patch)` calls `saveSettings`, which fires `SETTINGS_EVENT`.

**Files:** `app/settings/page.jsx` and `styles/settings.css`. The row grid drops to one column at 640px and below.

**Keys:** `dv_settings` and `dv_sound`.

**GRE today:** no settings page.

### 47. Auto-advance delay — `PORT`

**What the user sees:**
- A compact select in every grading mode's header (`aria-label` "Time before the next question").
- Segmented buttons on `/settings`.
- Options: 0.5s, 1.5s (default), 3s, 5s, Manual.
- Manual shows a "Press **Enter** to continue" button and accepts Enter or Space.

**How it works:**
- `ADVANCE_DELAY_OPTIONS`, `DEFAULT_ADVANCE_DELAY = 1.5`; unknown values are coerced to the default (`lib/progress.js:94-103, 160-165`).
- Never applies to wrong answers:
  - Test Normal retries immediately.
  - Harder and Quiz use a fixed 1200ms.
- A change mid-wait reschedules the same target.
- Every pending advance is cleared on unmount and on direction, prompt-mode or pack change.
- The input and Check button are disabled while advancing.

**Files:** `components/AdvanceDelayControl.jsx` and `TM:633-686, 907-947`.

**Keys:** `dv_settings.advanceDelay`.

**GRE today:** a fixed delay.

**Port:** copy as is.

### 48. Feedback sound toggle — `PORT`

**What the user sees:**
- In each play header: a "Sound on/off" master pill plus a "Sounds" popover with switches. The popover closes on outside pointerdown or Escape.
- The same control appears inline on `/settings`.
- The "Correct/incorrect sounds" switch gates `/sounds/yesmp3.mp3` and `/sounds/nomp3.mp3` (volume 0.1) in Test, Practice, Learn and Review.

**How it works:**
- `lib/sound-settings.js` stores `dv_sound` = `{feedbackSounds, pronounceGerman, pronounceEnglish, muted}` (defaults on, on, on, false).
- Its own key, because play modes save a stale copy of `dv_settings` on every direction or delay change.
- `isSoundEnabled("feedback")`.
- `useSyncExternalStore`, with `SOUND_EVENT` and cross-tab `storage` sync.
- Master mute keeps the channel flags.
- A one-time migration reads the legacy `dv_settings.sound === false`.

**Files:** `lib/sound-settings.js`, `components/SoundControl.jsx`, `styles/sound.css`.

**Keys:** `dv_sound`.

**Port:**
- Copy, keeping **only** `feedbackSounds` and `muted`.
- The two pronunciation channels are SKIP-AUDIO (item 63).
- GRE already ships the same two MP3s at volume 0.1.

### 49. Progress export, import, Reset all, persistent storage — `PORT`

**What the user sees** (`/settings` → "Backup", `app/settings/page.jsx:326-407`):
- **"Export progress"** downloads `wortschatz-progress-YYYY-MM-DD.json`.
- **"Import progress":**
  - a visually hidden file input inside a label, which iOS Safari still opens, plus a "paste the JSON instead" textarea
  - files over 2 MB are refused
  - a **danger** dialog "Replace progress on this device?" shows, per direction, "X learned in the file, Y on this device", with confirm "Overwrite and import"
  - status messages go to `role="status"`
- **"Reset all progress":** a danger dialog. Focus returns to the button afterwards.

**How it works (`lib/progress.js`):**
- **`exportProgress`** (`:1222-1240`) writes `{version:1, exportedAt, dv_settings, dv_practice_pos, dv_progress_*, dv_review_*, dv_hard_*}`.
  - Not exported: `dv_counts`, `dv_sound`, `dv_pack`, `dv_return`, `dv_last_pack`.
- **`prepareImport`** (`:1268-1328`):
  - rejects a version above 1, and requires a `dv_progress_*` entry
  - checks each scope's shape and accepts the pre-scopes flat shape
  - **repairs** review and hard data rather than rejecting it
- **`applyImport`** (`:1332-1356`) snapshots the old values, **rolls back if any write fails**, deletes `dv_counts` so it rebuilds, and fires `SETTINGS_EVENT`.
- **`resetProgress`** (`:1376-1394`) removes `dv_progress_*`, `dv_review_*`, `dv_hard_*`, `dv_practice_pos`, `dv_pack`, `dv_counts`.
  - Keeps `dv_settings`, `dv_sound`, `dv_last_pack` (see item 7 gap) and `dv_return`.
- **Persistent storage:** `requestPersistentStorage()` calls `navigator.storage.persist()` once, from the Navbar.

**Keys:** all of the above.

**Port:** copy, with a `grevocab-progress-YYYY-MM-DD.json` filename and the GRE key list.

### 50. ConfirmDialog: red only for destructive actions, Cancel focused — `PORT`

**API (`components/ConfirmDialog.jsx`, `styles/dialog.css`):** `{title, body, confirmLabel="Reset", cancelLabel="Cancel", tone="danger"|"neutral", onConfirm, onCancel}`.

**What the user sees:**

| Tone | Confirm button | Focused on open | Used for |
|---|---|---|---|
| `danger` | red `.btn-danger` | **Cancel**, so a stray Enter cannot erase anything | Reset round, Reset all, Import overwrite |
| `neutral` | white `.btn-neutral` | **Confirm** | Start round N, Restart, Reshuffle, Restart run |

- Focus is set once (effect keyed `[]`) so a parent re-render never steals it.
- Escape cancels.
- Tab cycles the two buttons.
- A backdrop mousedown on the backdrop itself cancels.
- `role="dialog" aria-modal aria-labelledby aria-describedby`.
- At 480px and below the actions stack `column-reverse`.
- **Missing:** scroll lock and focus restore (callers do the restore).

**Port:**
- Copy as is.
- If "Cancel focused" should apply to every dialog, make that an explicit change; Wortschatz focuses Confirm on neutral dialogs.

### 51. Settings robustness: coercion of stored values — `PORT`

`loadSettings` coerces `promptMode`, `advanceDelay`, `difficulty`, `reviewCap`, `playBg` and `pagesBg` to valid values. The reasons, from the comments:
- An unrecognized `promptMode` "would silently strand progress in a scope nothing else reads".
- A bad `advanceDelay` would mean "silently stalling every mode".

**Gap:** `direction` and `strictArticles` are not validated.

**Port:** copy, and validate every field.

---

## G. Mobile, PWA, metadata, deploy

### 52. Mobile pass — `PORT`

**What it covers** (`styles/mobile.css`, imported last; `app/layout.jsx:94-99`):

| Area | Implementation |
|---|---|
| Viewport | `{width:"device-width", initialScale:1, viewportFit:"cover", themeColor:"#050505"}`. No `maximumScale`, so zoom stays allowed. |
| Safe areas | `env(safe-area-inset-*)` padding on `body` (`:8-12`); the nav pads top, left and right (`:17-21`); `--pl-nav-h: calc(64px + env(safe-area-inset-top))`; bottom insets in `home.css`, `settings.css` and `testmode.css`. |
| Viewport height | `min-height:100vh` immediately followed by `min-height:100dvh` in settings, grammar, phrase-packs, packs and testmode CSS; `max-height:85dvh` for the Choose Words modal. |
| 16px inputs | ≤820px: every input (except checkbox, radio and file), textarea and select gets `font-size:16px !important`, because "iOS Safari zooms the page on focus of any input under 16px". |
| Input attributes | `autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}` on the Test, Review and try-it inputs and the import textarea. No `inputMode` anywhere. |
| 44px targets | `@media (pointer: coarse)`: `min-height:44px` on buttons, pills, nav links, the burger, chips, selects and summary; `min-width:44px` on icon buttons; list rows at least 44px; checkboxes at least 20px. |
| touch-action | `manipulation` on button, a, summary, select, label, `[role=button]`, checkbox and radio (removes the double-tap zoom delay). |
| Overflow | `overflow-wrap:anywhere` on the page roots; `max-width:100%` on table, img, svg, video and canvas; `-webkit-text-size-adjust:100%`; tap highlight transparent. |
| Hover-only affordances | The flashcard tile flip also triggers on `:active` and `:focus`. |
| Short viewports | Below 699px tall, Test drops vertical centring. |

**German-only part:** `hyphens:auto` on `[lang="de"]` (`SKIP-GERMAN`). GRE should still keep `overflow-wrap:anywhere`.

**Possible side effect (unverified):** bare `button{min-height:44px}` on coarse pointers may stretch the 26px `.switch` toggles.

**Port:** copy as is.

### 53. PWA manifest and icons — `PORT`

**Manifest (`public/manifest.webmanifest`):**
- `name` and `short_name`, description, `start_url "/"`, `scope "/"`, `display "standalone"`, background and theme colour `#050505`.
- Icons 192 and 512 (`purpose "any"`).
- Missing: maskable icon, `id`, `lang`, `orientation`.

**Layout metadata:**
- `appleWebApp {capable, title, statusBarStyle:"black-translucent"}` plus `apple-mobile-web-app-capable`.
- Icons (favicon.ico 32px, icon-192, icon-512, apple-touch-icon 180px, og-image 1200×630, each 0.5–8 KB) are **declared once** in metadata and live in `public/`, so Next does not auto-emit duplicate `<link>` tags.
- `scripts/generate-icons.js` is a zero-dependency PNG/ICO generator (draws a "W").

**Port:**
- Copy as is with GRE names.
- This also fixes GRE's 1.16 MiB logo being used as favicon, preload, apple-touch-icon and footer image (GRE CLAUDE.md image audit).

### 54. Fonts and metadata — `PORT`

**Font:** `next/font/google` Inter (`subsets:["latin"], display:"swap", variable:"--font-inter"`), self-hosted at build time and compatible with export.

**Metadata:**
- `metadataBase = SITE_URL` (still a `TODO` placeholder `https://wortschatz.app`)
- title template `"%s · Wortschatz"`
- `alternates.canonical`
- OG image 1200×630 with matching declared dimensions
- Twitter `summary_large_image`

**GRE today:**
- Inter is not loaded (it relies on a local install).
- No `metadataBase`.
- OG dimensions are wrong.
- A duplicate favicon link.

**Port:** copy as is with `metadataBase = https://grevocabtester.com`.

### 55. Security headers and deploy — `PORT`

**Headers (`public/_headers`, `/*`):**
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- CSP: `default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'`
- No HSTS and no Permissions-Policy.

**Config:**
- `next.config.mjs` has no `headers()`, since it is ignored under export, plus `reactStrictMode` and `poweredByHeader:false`.
- `wrangler.jsonc` serves `./out` as Cloudflare Workers assets with `not_found_handling:"404-page"`.
- There are no API routes and no middleware.

**GRE today:** `public/_headers` is referenced but missing. GRE has two API routes and middleware that cannot run on its static host.

**Port:**
- Copy `_headers` (only if GRE's host honours `_headers`; that is Cloudflare or Netlify style).
- Drop the API routes and middleware.
- The GRE host is not stated in its repo beyond the `onrender.com` OG URL, so confirm it first.

---

## H. Vocab and content pipeline

### 56. `vocab-stats.js` — `ADAPT`

**What it does:** prints the entry count, max rank, counts by level and by part of speech, and every key. It ends with NEXT TO ADD:
- Goethe A1/A2/B1 headwords missing from `words.json`, read from `data/goethe-raw/<lvl>/<letter>.tsv`
- ordered by the `de_50k` frequency list
- `--next N` and `--dropped`

**Workflow rule:** run it before any vocab edit.

**GRE equivalent:**
- Count, key list and duplicate report.
- A NEXT TO ADD list only if a GRE source list (for example a high-frequency GRE list) is checked in. The Goethe and `de_50k` parts are SKIP-GERMAN.

### 57. Validation scripts and the raw duplicate-key scanner — `ADAPT`

**`scripts/validate-vocab.js` checks:**
- duplicate keys (error), via `scripts/lib/scan-depth1-keys.js`, a raw-text depth-tracking scanner, because `JSON.parse` silently keeps only the last duplicate
- required fields
- ranks unique and contiguous from 1
- the key appearing in the example (warning)
- keys that collapse after lowercasing and transliteration (warning)
- every pack key existing

**`scripts/validate-packs.js` checks:**
- schema, category per type, priority
- unknown keys
- packs under 5 keys (warning)
- priority ties (warning)
- gloss collisions (item 59)
- staleness: rebuilds `packs.json` in memory and errors if the committed file differs

**Other scripts:**
- `npm run validate` chains all five validators.
- `validate-forms.js`, `validate-phrases.js` and `validate-lessons.js` are SKIP-GERMAN.

**GRE equivalent:**
- `validate-vocab.js` for `{definition, example, fullDefinition}`:
  - non-empty fields
  - headword appears in `example`, which would flag GRE's `Cavo;` and `Peurile`
  - no non-alphabetic keys
  - case-insensitive duplicates
  - plus `rank` if one is added
- `scan-depth1-keys.js` copies verbatim.
- `validate-packs.js`.

### 58. Review export and sort scripts — `PORT`

- **`scripts/export-review.js`:** writes `review/review-sheet.csv` (UTF-8 BOM, CRLF, columns `type,key,de,en,idiomaticEn,level,ok,comment`) with `--from-rank` and `--type`, for human content review in a spreadsheet. GRE columns would be `key,definition,example,fullDefinition,ok,comment`.
- **`scripts/sort-vocab.js`:** rewrites the vocab ordered by rank. It is safe because packs use keys.

### 59. Grading-collision checks — `ADAPT`

**What it does (`scripts/validate-packs.js:42-78, 192-253`), warnings only:**
- Within each words pack, manual and `gen-`, flags pairs whose normalized main glosses are identical, or where one word's main gloss equals another's `enAlt`. Bracketed qualifiers keep "number" and "number (figure)" apart.
- Globally, flags identical main glosses with no `acceptAlso` link.
- Prints the three counts.
- `acceptAlso` (CLAUDE.md data rules) marks deliberate synonyms.
- **There is no fuzzy (Dice 0.6) collision check.**

**Runtime counterpart:** `QuizMode.pickDistractors` never shows two options with the same text.

**GRE equivalent:**
- This matters more in GRE. Definition → Word mode is ambiguous wherever definitions collide; gre-data.md lists identical definitions for multi-sense headwords such as Guy and Stand.
- Port the exact check.
- Add a **fuzzy** check: any two definitions with Dice ≥ 0.6 against each other means a typed definition for one would be accepted for the other in Word → Definition.
- Add an `acceptAlso` field.

### 60. Unit-test suite — `PORT`

- `npm test` = `node --test "tests/**/*.test.mjs"`.
- Storage tests fake `globalThis.window` with an in-memory store.

| Test file | GRE |
|---|---|
| `pool` | port |
| `run-streaks` | port |
| `hard-scheduler` | port |
| `hard-progress` | port |
| `choose-words-subset` | port |
| `pack-rounds` | port |
| `review` | port |
| `backgrounds` | port |
| `word-punctuation` | port |
| `phrase-strict` | SKIP-GERMAN |
| `audio-text` | SKIP-AUDIO |

**Gap:** no test covers the `dv_counts` migration.

**GRE today:** no tests.

### 61. Trailing-punctuation tolerance — `PORT`

**What it does:** "dog." and "dog!" are graded as "dog". Only the end of the answer is stripped (`lib/matching.js:121-122`; `tests/word-punctuation.test.mjs`).

**Port:** compatible with GRE's 0.6 rule, since it only normalizes the input.

---

## I. Excluded features

### 62. German-only — `SKIP-GERMAN`

- der/die/das gender colours (`--der/--die/--das`)
- strict articles setting and article grading
- noun plural / `noPlural` display
- umlaut helper buttons (ä ö ü ß; `TM:1176-1195, 1997-2011`)
- umlaut transliteration in `normalize`, and the ß rule in `foldText`
- conjugation forms packs (`forms.json`, `gradeForm`, `validate-forms.js`, tense sub-groups, `MAX_CONJUGATION_PACKS`)
- phrases packs, `/phrasepacks`, `gradePhrase` strict verb-preposition tokens, gloss breakdowns, `idiomaticEn`, `PHRASE_GROUPS`, `validate-phrases.js`
- grammar lessons (`/grammar`, `lib/lessons.js`, `LessonBlocks`, `LessonDrills`, `validate-lessons.js`, `attachLessons`, the "Grammar" pill on pack rows)
- the Goethe / `de_50k` NEXT TO ADD source
- `hyphens:auto` on `[lang=de]`
- `enDePrompt` answer-revealing note masking
- the German heading "Alles gemeistert!" (use English in GRE)

### 63. Pronunciation audio — `SKIP-AUDIO`

- `lib/pronunciation.js` (`/audio/manifest.json`, `useCardPronunciation` autoplay, 2-element audio pool, retry on first gesture)
- `components/PronounceButton.jsx` and `components/SpeakButton.jsx` (Web Speech API; not imported anywhere)
- `components/AudioCredits.jsx`
- `scripts/audio/*` (Wikimedia Commons + Piper TTS pipeline)
- `public/audio/` (clips, `credits.json`)
- the `pronounceGerman` / `pronounceEnglish` channels in `dv_sound`
- the 700ms "wait for the feedback cue" coupling (`FEEDBACK_WAIT_MAX_MS`)
- `tests/audio-text.test.mjs`

**Keep:** the feedback-sound channel and master mute (item 48).

---

## Storage key map (for a GRE port)

**Rename the prefix.** Recommendation: `gv_` instead of `dv_`. That is a decision for the port; Wortschatz's prefix has no meaning to carry over.

| Wortschatz key | Shape | GRE |
|---|---|---|
| `dv_settings` | `{direction, strictArticles, promptMode, advanceDelay, difficulty, reviewCap, playBg, pagesBg}` | Drop `strictArticles`. `direction` and `promptMode` per items 44 and 39. |
| `dv_progress_<dir>` | `{scopes:{id:{mastered, streaks, completions{count, records, credited}, round, known}}}` | Port. If there is no direction toggle at first, still keep the `_<dir>` suffix for future-proofing. |
| `dv_hard_<dir>` | `{scopes:{id[#subset]:{run, count, runs}}}` | Port. |
| `dv_review_<dir>` | `{seeded, words:{k:{interval, due}}, day}` | Port. |
| `dv_counts` | `{version:1, normal:{id:n}, hard:{id:n}}` | Port as the only completion counter from day one. |
| `dv_pack` | `{id, keys, type}` | Port (keys = headwords). Replaces `marketplaceWordpack`. |
| `dv_last_pack` | `{id, title, type, keys}` | Port, and clear it in Reset all. |
| `dv_return` | `{path, scroll, to, anchor?, anchorTop?, restore?}` | Port. |
| `dv_practice_pos` | `{scopeId: index}` | Port. |
| `dv_sound` | `{feedbackSounds, pronounceGerman, pronounceEnglish, muted}` | Port with only `feedbackSounds` and `muted`. |
| — | — | GRE's `wp_upvote_ledger_v2` has no Wortschatz equivalent (Wortschatz has no likes). Keep or drop it explicitly. |

**Scope ids:**
- `default` (global feed)
- `pack:<id>`
- `pack:custom`
- `<scope>:sentence`
- `<scope>#subset` (Harder only)
- `phrases:default` is German-only legacy; skip it.

---

## Shared code worth copying

These modules could move into GRE nearly verbatim. Each entry lists its dependencies on German-specific data.

| Module | Imports | German dependency | Verdict |
|---|---|---|---|
| `lib/hard-scheduler.js` | `matching.js`: 2 constants | None. `seededRng` is reused by `pool.js`. | Verbatim. Move `HARD_RELEARN_CORRECT` and `HARD_COOLDOWN_CARDS` into GRE's constants. |
| `lib/pool.js` | `POOL_SIZE`, `seededRng` | None. | Verbatim. |
| `lib/review.js` | none | None. `wordReviewOpts` reads only `.rank`. | Verbatim. Supply a rank or alphabetical tiebreak. |
| `lib/use-return-scroll.js` | react, `progress.consumeReturn` | None. | Verbatim. |
| `lib/backgrounds/*` (engine, bus, state, ids, util and all 11 modules) | none outside the folder, except `sources.js` | `sources.js` fetches `/data/packs.json` and uses `de` as the word field; `rain` and `constellation` render that field. | Engine, bus, state, ids, util and modules are verbatim. Rewrite `sources.js` for GRE headwords. |
| `components/Background.jsx`, `components/BackgroundPicker.jsx` | progress (settings), backgrounds | None beyond `loadPageWords`. | Verbatim. Fix the sink bug (L20). |
| `components/MasteryFx.jsx` (confetti, flyToBar, popPip, toast) | none (DOM only) | The toast text slot is labelled "de → en", but it is just props. | Verbatim. |
| `components/ConfirmDialog.jsx` + `styles/dialog.css` | none | None. | Verbatim. |
| `components/AdvanceDelayControl.jsx` | progress (options) | None. | Verbatim. |
| `components/SessionSummary.jsx` | none | The `enFirst` flag is direction wording. | Near-verbatim. Remove the ★. |
| `components/ChooseWords.jsx` | matching (`POOL_SIZE`) | The search haystack includes `article`, and `foldText` maps ß→ss (harmless). | Near-verbatim. Search over headword + definition. |
| `components/UpNext.jsx`, `PackList.jsx`, `PackRow.jsx` + `styles/pack-list.css` | `lib/packs.js`, progress | `PackRow` shows the forms/word count, the "Grammar" lesson pill and the "Sentences" chip. `PackList` groups by tense. | Near-verbatim after removing those three. Fix `stat.finished` (L1). |
| `components/DailyReviewEntry.jsx` | progress | None. | Verbatim. |
| `components/SoundControl.jsx` + `lib/sound-settings.js` | react | `pronounceGerman` / `pronounceEnglish` channels and their switch rows. | Strip to feedback + mute. |
| `components/Navbar.jsx` + `styles/navbar.css` | progress (`requestPersistentStorage`) | None. Only the link list differs. | Verbatim. |
| `lib/progress.js` | `review.js`, `hard-scheduler.js`, `backgrounds/ids.js` | **Light:** `DIRECTIONS = ["de-en","en-de"]`, default direction, `strictArticles`, the `phrases:default` migration and `PHRASES_SCOPE`, forms/phrases pack types in `DATASETS`/`packProgressScope`, legacy flat-shape migrations, filename `wortschatz-progress`. | Near-verbatim. Rename the directions; drop the forms/phrases/legacy migrations. The rounds, completions, hard, review, counts, return, export/import and reset logic is generic. |
| `lib/packs.js` | progress | **Medium:** `WORD_PACK_CATEGORIES` / `PHRASE_PACK_CATEGORIES` names, `TENSE_GROUPS` / `tenseOf`, the ß rule in `foldText`. | Keep `groupByCategory`, `byPriority`, `computeStats`, `isBand`, `sortBands`, `packMatchesStatus`, `SORT_OPTIONS`, `isRetest` / `nextRoundLabel`. Replace the category lists and drop the tense helpers. |
| `lib/matching.js` | none | **Heavy:** umlaut transliteration, der/die/das, `gradeForm`, `gradePhrase` strict tokens, `enDePrompt`. | Port only `diceCoefficient`, the generic part of `normalize`, the 4-char exact floor, trailing punctuation and the constants block. GRE's own matcher (`string-similarity`, 0.6) can be replaced by the inline Dice, dropping a dependency. |
| `scripts/lib/scan-depth1-keys.js` | none | None. | Verbatim. |
| `scripts/build-packs.js` | `pack-categories.js`, datasets | Band and level-part generation and `checkAppendOnly` are generic (they use `rank` and `level`). Forms, phrases and lesson generators are German. | Extract the bands, parts, append-only check, category and priority validation and `serializePacks`. Needs a GRE `rank`. |
| `scripts/validate-packs.js` | datasets, build-packs | Gloss-collision logic is generic (`en`, `enAlt`, `acceptAlso` field names). Phrase-orphan checks are German. | Adapt the field names to `definition`. |
| `scripts/export-review.js`, `scripts/generate-icons.js`, `scripts/sort-vocab.js` | none | Column names and the "W" glyph. | Near-verbatim. |
| `styles/ui.css`, `styles/globals.css` tokens, `styles/mobile.css`, `styles/backgrounds.css`, `styles/settings.css` | — | `--der/--die/--das`; `[lang=de]` hyphens. | Verbatim minus those. |
| `styles/testmode.css` | — | `.umlaut-helpers`, article colours, phrase or gloss blocks. | Mostly verbatim. Prune the German blocks. |
| `public/_headers`, `public/manifest.webmanifest`, `app/layout.jsx` metadata pattern | — | Names only. | Verbatim with GRE values. |

**Port order** (it follows the dependencies):
1. Packs by key, not index.
2. `progress.js` + tests.
3. Pool, Harder scheduler and review.
4. Test mode UI and MasteryFx.
5. Pack list.
6. Settings and backup.
7. Backgrounds.
8. Mobile and metadata.

---

## Lessons learned (do not repeat in the GRE port)

Sources: the git log bodies, `.batches/*.txt` bug reports, `.batch-runs/*/report.md` root-cause notes, and code comments. Items L1–L5 are open issues in Wortschatz at HEAD; the rest were found and fixed.

**Open in Wortschatz now:**
- **L1. PackRow first-render crash risk (open).** `components/PackRow.jsx:138` reads `banked={!!stat.finished}` without a guard. Every other field there is guarded by `known = ready && !!stat`. It was introduced by the last commit (`78b3540`, unify-pack-completions). If a row ever renders with `stat` undefined (the stats arrive after the first render on `/wordpacks`), it throws. **(Unverified at runtime.)** Use `!!(stat && stat.finished)`.
- **L2. Pack context only survives reload in Test.** Practice, Learn and Flashcards still consume `dv_pack` once, so a reload drops back to the global feed (`QuizMode.jsx:211-213`, `FlashcardMode.jsx:127-129`). Use `?pack=` in every mode from the start.
- **L3. "Reset all" leaves `dv_last_pack`,** so the home Continue card survives a full reset showing 0 mastered.
- **L4. CLAUDE.md drift after automated batches.**
  - CLAUDE.md still describes per-direction completion counts, but `dv_counts` replaced them. The unify batch report says CLAUDE.md "wasn't updated".
  - It also says pack rows carry Reset, which was removed.
  - Rule for GRE: every storage-shape change updates the project notes in the same change.
- **L5. Mixed direction semantics on one row.** After the unify commit, medal counts and the category "packs completed" pill are summed across directions, while bars, best and the Completed filter are per direction. So a pack finished only EN→DE shows "1× Normal" while its DE→EN bar is empty and the Completed filter excludes it. Decide one rule per number before building the UI.

**Progress model:**
- **L6. Harder and Normal progress corrupted each other.** Harder originally recorded answers through Normal's streak and mastery path; "finishing a Harder run leaves Normal at 0% with words sitting at 2/4 streaks" (`.batches/separate-harder.txt`). Fixed by giving Harder its own key `dv_hard_<dir>`, which never reads or writes `dv_progress_*`, with tests asserting isolation (`tests/hard-progress.test.mjs`). The only shared side effect allowed is Daily review enrollment.
- **L7. Header count ignored the active engine.** In Harder the header kept reading Normal mastery ("0 mastered while 352 retired"). The header must read from whichever engine is running, and update on grading, not after the delay (play-test-fixes sweep, bug 2).
- **L8. Streaks leaked into new runs.** Saved streaks were restored into a freshly random pool, so words showed 1/4 or 2/4 before the run had asked them (progress-leak root cause). Streaks are per run: zero them on every session start (`clearScopeStreaks`).
- **L9. Reset destroyed a finished pack's progress.** It went back to 0 / N. Fixed with rounds (best = N once completed, `known`, `credited`).
  - **Known edge, still open:** a band that gains new words after being completed still shows N / N, because "best = N when completions > 0" is applied literally (pack-rows report).
  - GRE should define best as `min(N, previously-credited size)`, or re-open a grown pack.
- **L10. Completions must be idempotent.** `markScopeComplete` credits only when `credited` is false, so re-renders, reloads and reopening never double count. Backfilled completions use `at:null, backfilled:true` and never an invented timestamp.
- **L11. Migrations must not double count.** `dv_counts` sums old per-direction counts once, behind `version: 1`, and every increment calls `readCounts()` first. Import deletes `dv_counts` so it rebuilds. No test covers this migration yet, so add one in GRE.

**Choose Words and pack scope:**
- **L12. Choose Words drew from the full pool.** `TestMode` always passed the global `ALL_KEYS` to the picker; the pack's keys never reached it (choose-words-pack-scope root cause). Scope the picker to `pickerKeys`, fixed at load, and filter the initial selection to offered keys.
- **L13. Subset progress went to a shared `pack:custom` scope,** so it did not count on the parent pack and selections from different packs mixed.
  - Fix: a subset runs in the parent `pack:<id>` scope (`selectionTarget`). The pack is credited only when every pack word is mastered (`allMastered`).
  - Harder subsets use a separate `#subset` slot that resumes only on an exact key match (`hardStateMatchesKeys`), so subset and full-pack runs never resume into each other.

**Pack context and startup:**
- **L14. Pack context lost on reload or Back.** `dv_pack` was consumed on load. Fix: carry `?pack=<id>`, read `window.location.search` inside the hydrate effect (avoiding `useSearchParams`, which needs a Suspense boundary under static export), resolve unknown ids to the global feed, and strip the param for non-addressable custom selections.
- **L15. StrictMode double-mount turned a pack run into the global feed (dev).** The first mount effect consumed `dv_pack` and the second found nothing. A run-once ref guards the hydrate. Practice, Learn and Flashcards were noted as having the same problem and were not fixed in that sweep. Guard every consume-once read.
- **L16. Deterministic pool order.** The Normal pool always drew the first unmastered words in scope order, so a pack always introduced the same word first (commit `1f0ba2a`). Draw the initial pool and refills at random through an injectable RNG (`lib/pool.js`).

**Timing and input:**
- **L17. Animations delayed auto-advance.** The mastered sequence waited about 1.9s or the delay, whichever was longer.
  - Rule: the only wait between grading and the next prompt is one timeout of the selected delay.
  - Effects live in body-level fixed overlays or portals positioned at grading time, so they survive the card swap.
  - The summary toast replaces rather than stacks.
  - The word glow is clamped to the delay.
  - Cleanup runs on unmount, restart and mode or direction switches (delay-timing batch).
- **L18. The last "Mastered" feedback never showed.** The completion screen replaced it immediately. It now waits out the delay. The manual-advance Enter listener must also be removed once the completion screen is up, or it swallows the first Enter on its buttons (sweep bug 3).
- **L19. Held or double Enter.** An autorepeating Enter graded a blank answer in the next prompt, or skipped a manual wait. Use a synchronous `submitLockRef` plus `e.repeat` checks on both the input and the manual-advance listener. Practice and Learn's manual listener still lacks the `e.repeat` check.

**Backgrounds:**
- **L20. Background sink not restored (likely, unverified).** `state.js` keeps a single global `sink`. A contained settings preview replaces the page background's sink, and its cleanup sets it to null without restoring the previous one. After a client-side navigation from `/settings` into `/play` with the same background id, answer reactions may stop until a full reload. Use a sink stack or owner token.
- **L21. Background mounted on every page must never crash the app.** Guard every canvas and DOM call; WebGL falls back to fireflies; anything else falls back to plain; wrap the mount in an error boundary; render nothing during SSR.

**CSS and hydration:**
- **L22. `overflow-x: hidden` broke scroll restore and sticky.** On `html, body` it made the fixed-height body the scroll container (`window.scrollY` stayed 0), and on `.packs-page` it stopped the sticky toolbar from sticking. Use `overflow-x: clip` with `hidden` as the fallback (`globals.css:58-62`, `pack-list.css:24-26`).
- **L23. Default settings flashed before hydration.** The static HTML is built with defaults ("Normal", "DE → EN", "0 of 0 mastered"). Keep the header's dynamic sections `visibility:hidden` until settings load, and render medals as zeros until storage confirms them.
- **L24. Answer card ignored direction.** It always showed German large, even when English was the answer. The answer language is the primary line, and styling follows the slot, not the language class (answer-card-direction batch).

**Settings storage:**
- **L25. A stale settings copy overwrote other settings.** Play modes save their whole in-memory `dv_settings` on every direction or delay change. Fix: sound lives in its own key (`dv_sound`). Better for GRE: make `saveSettings` a read-merge-write of a patch.
- **L26. Unvalidated settings values strand progress or stall modes.** Coerce every enum on load (`promptMode` picks a scope suffix; a bad `advanceDelay` stalls every mode). Wortschatz still doesn't validate `direction`.

**Build and tooling:**
- **L27. Stale or contested `.next` from shared dev and build dirs.**
  - `next dev` and `next build` share the default `.next`; there is no `distDir` split.
  - Several batch runs failed with `Cannot find module for page: /_document`, `PageNotFoundError: /_document`, `.next missing during prerender (mkdir .next\export)` and "Could not find a production build in .next". Three `next dev` processes were running against the same `.next`, and agents deleted `.next` mid-session (separate-harder and play-test-fixes reports).
  - For GRE, give dev its own dir (for example `distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next"`, or a `NEXT_DIST_DIR` env var) and never run concurrent builds in one checkout.
- **L28. `.gitignore` shadowing a route.** A `review/` rule (for the CSV export) also ignored `app/play/review/` (commit `1aa9301`). The rule is now anchored as `/review/`. Anchor ignore patterns.

**Data and pipeline:**
- **L29. Positional pack indices.** Wortschatz's founding lesson from GRE: reference words by key, so sorting the dataset is safe.
- **L30. Renaming generated packs drops progress.** Band ids are frozen once published (`PUBLISHED_BAND_BOUNDS`, the irregular `1001-1077` exists because "bands used to end at the current max rank"). New bands take their planned range id. Nothing is folded into a neighbour. `checkAppendOnly` fails the build on any re-cut.
- **L31. `JSON.parse` hides duplicate keys.** Detect duplicates on the raw text (`scan-depth1-keys.js`).
- **L32. Hardcoded counts drift.** Derive counts from data (GRE's "800+" vs 679).
- **L33. Content collisions are grading bugs.** Commits `fa8d0f4` and `40fbdba` fixed glosses where one word's answer was accepted for another, for example Magen accepting "belly" and Zahl accepting "Nummer". They added `acceptAlso` links and bracketed disambiguators. Run collision checks on every content batch.
- **L34. Unused dependency and archived matcher.** Wortschatz deliberately has no `string-similarity` (archived) and no axios; GRE ships both. Inline Dice and drop both.

**UI rules:**
- **L35. Red confirm on non-destructive actions.** Restart and Reshuffle originally used the red style and an unfocused Cancel default. Danger tone is only for erasing data. Never use `window.confirm()`.
- **L36. Hover-only affordances and iOS quirks.**
  - Flip tiles need `:active` and `:focus` triggers.
  - A file input must be visually hidden, not `display:none`, or iOS will not open it from the label.
  - 3D flips need `-webkit-` prefixes.
  - Inputs need 16px font on phones.

---

## Decisions made in this investigation (unattended run)

- The Wortschatz repo is `Learning-German`, the only sibling whose `package.json` or `CLAUDE.md` says Wortschatz, so the home-directory search was skipped.
- "2-segment indicator" is interpreted as Harder's 2-pip relearn indicator (item 35). The Normal | Harder toggle and the paired rails are noted as alternatives.
- **Tagging calls:**
  - Daily review, direction toggle, sentence prompt mode and bands are `ADAPT` because they depend on GRE fields (rank, a second direction, example cloze) that don't exist yet.
  - Pack rows, rounds, Harder and animations are `PORT`, because their logic is data-agnostic.
- Wortschatz has no "Phrases mode" route any more; phrases packs are drilled by Test. All phrase features are listed under SKIP-GERMAN.
- Recommended storage prefix `gv_` (any non-`dv_` prefix works).
- Per-file details came from three parallel read-only sub-agents plus direct reads of CLAUDE.md, `design/frontend-inventory.md`, the batch prompts and reports, and `PackRow.jsx`. `design/frontend-inventory.md` predates the overhaul; its "Issues" lists were used only to confirm what changed, for example the Navbar active state and the neutral dialogs.
