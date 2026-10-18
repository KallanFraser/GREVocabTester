# GRE Vocab Tester — current-state inventory (pre-overhaul)

Generated 2026-10-18 by a read-only investigation of `C:\Users\Kallan-Daily\Documents\GitHub\GREVocabTester` at commit `a38a129` (branch `main`). Every claim cites a file. "Verified" means checked by running code or the build; everything else comes from reading source.

**Repo identity: confirmed GRE Vocab Tester, not Wortschatz.** `package.json` `"name": "grevocabtester"`; `CLAUDE.md` title "GRE Vocab Tester"; `app/layout.jsx:9-10` `metadataBase: https://grevocabtester.com`, title "GRE Vocab Tester — …".

---

## 0. Headline findings for the redesign

1. **No study progress is persisted anywhere.** Mastery counts, the 5-word subset, Choose Words selections and the Flash Cards position all live only in React state and are lost on reload (`components/TestMode.jsx:14-29`, `components/PracticeMode.jsx:11-14`, `components/LearnMode.jsx:11-13`). Only two `localStorage` keys exist, and neither holds learning progress (§5). The migration surface is very small.
2. **Word packs reference words by array index** into `Object.keys(gre_combined.json)` (`components/TestMode.jsx:105-107,151-153`). Each pack in `public/data/wordpacks.json` also has a `words` array that no code reads. I checked that `words` matches `indices` for all 12 packs today (0 mismatches, run with node). That makes `words` the safe migration key.
3. **The vocabulary has 679 entries** (verified with node), but the copy says "800" in 6 places (§2).
4. **The API routes are not deployed.** `next build` lists `/api/*` as ƒ (dynamic), but `out/api/` is not emitted (verified). No UI calls either endpoint.
5. **CLAUDE.md is stale in many places**, including a missing `middleware.ts`, "out/ is committed", and the logo/OG issues, all of which have already been fixed (§11).

---

## 1. Stack and config

### Versions
| Package | Declared (`package.json`) | Installed (`node_modules/*/package.json`) | Imported in source? |
|---|---|---|---|
| next | ^15.3.4 | 15.5.14 | Yes: `next/link` (`app/page.jsx:5`, `components/Navbar.jsx:4`), `next/navigation` (`components/Navbar.jsx:5`), `next/server` (`app/api/wordpacks/create/route.js:3`) |
| react / react-dom | ^19.1.0 | 19.1.0 / 19.1.0 | Yes (`components/*.jsx`, `app/play/*/page.jsx`) |
| string-similarity | ^4.0.4 | 4.0.4 | Yes, only in `components/TestMode.jsx:8` |
| zod | ^4.1.12 | 4.1.12 | Yes, only in `app/api/feedback/route.ts:4` (a route that is not deployed) |
| axios | ^1.10.0 | 1.14.0 | **No.** No import or require anywhere in `app/`, `components/` or `scripts/`. Dead dependency. |
| typescript (dev) | 5.9.3 | 5.9.3 | Tooling only |
| @types/node, @types/react (dev) | 24.8.1, 19.2.2 | same | Tooling only |
| sharp (dev) | ^0.34.0 | 0.34.4 | `scripts/generate-images.js:14`. **It does not load on this machine** (win32-arm64 runtime missing; verified), so `npm run generate:images` currently fails here. |
| png-to-ico (dev) | ^2.1.8 | 2.1.8 | `scripts/generate-images.js:15` |

`package.json` also has leftover boilerplate: `"main": "index.js"` (the file does not exist), `"license": "ISC"`, and an empty `description`.

### Scripts (`package.json`)
- `dev`: `next dev -p 3010`
- `build`: `next build`, which emits `out/`
- `start`: `next start`. Not meaningful under `output: "export"`.
- `sort:vocab`: `node scripts/sort-gre-combined.js`. Rewrites `src/data/gre_combined.json` with keys sorted A→Z. The file is already sorted (verified), so running it today changes nothing. Any future insertion would re-index the packs.
- `generate:images`: `node scripts/generate-images.js`. Builds favicon.ico (16/32/48), apple-touch-icon (180), logo-128.webp, og-image.png (1200×630 on #050505) and the two banner WebPs from `GREWebsiteLogo.png` and `GRETesterBanner.png` (`scripts/generate-images.js:51-129`).

### Next config (`next.config.mjs`)
- `output: "export"` (line 46), `images: { unoptimized: true }` (49), `reactStrictMode: true` (51), `poweredByHeader: false` (52).
- `headers()` (58-64) returns security headers plus a CSP only when `NODE_ENV !== "production"`. The comment (54-57) says production headers are not configured and suggests `public/_headers` for Cloudflare Pages. **No `public/_headers` exists.** The build prints the warning "Specified "headers" will not automatically work with output: export" (verified).
- `tsconfig.json`: `strict: false`, `allowJs: true`, `moduleResolution: "node"`, `jsx: "preserve"`. Its `include` covers only `**/*.ts`/`*.tsx`, so JSX files are not type-checked.

### Middleware and host config
- **`middleware.ts` does not exist** (repo file listing). CLAUDE.md describes one.
- None of these exist: `wrangler.*`, `vercel.json`, `netlify.toml`, `public/_headers`, `public/_redirects`, `functions/`, `render.yaml`, `Dockerfile` or `.github/`.
- No Node version pin: there is no `engines` field in `package.json` and no `.nvmrc` or `.node-version`. The local Node is v24.16.0.

### Deployment (as far as the repo shows)
- **Cloudflare Pages, which builds from git.** Evidence: `.gitignore:7` says "Build output (Cloudflare Pages rebuilds /out on every push)" and `next.config.mjs:56-57` mentions "Cloudflare Pages". `out/` is gitignored, and 0 files are tracked (`git ls-files out`).
- The live domain is `https://grevocabtester.com` (`app/layout.jsx:9,27,33`; `app/sitemap.js:7`; `app/robots.js:16-17`).

### How the API routes coexist with static export
- They don't really coexist. `app/api/feedback/route.ts` and `app/api/wordpacks/create/route.js` export only `POST`/`OPTIONS` handlers. Next 15.5 compiles them (the route table shows `ƒ /api/feedback` and `ƒ /api/wordpacks/create`), then **leaves them out of the export**: there is no `out/api/` (verified).
- They only run under `next dev` / `next start`. On Cloudflare Pages a POST to `/api/*` would get the static host's 404 or 405.
- `wordpacks/create` also writes to `public/data/wordpacks.json` on the filesystem (`route.js:8,133`), which can't work on Pages.

---

## 2. Routes

Build route table (verified, `npm run build` exit 0):

```
○ /                 3.93 kB  110 kB
○ /_not-found        994 B   103 kB
ƒ /api/feedback      142 B   102 kB
ƒ /api/wordpacks/create 142 B 102 kB
○ /play/learn        860 B   162 kB
○ /play/practice     932 B   162 kB
○ /play/test        2.79 kB  164 kB
○ /robots.txt        142 B   102 kB
○ /sitemap.xml       142 B   102 kB
○ /wordpacks        1.53 kB  104 kB
Shared JS 102 kB
```
Exported files: `out/index.html`, `404.html`, `wordpacks.html`, `play/{test,practice,learn}.html`, `robots.txt`, `sitemap.xml`, plus copies of `public/`.

| Route | Source | What it renders | Metadata |
|---|---|---|---|
| `/` | `app/page.jsx` (client component) | A landing page with these sections: Hero (eyebrow, h1 "Master every word.", banner), How it works (3 mode tiles with screenshots), Problem/Solution compare, Story ("Why I built this", 160 score), Word List, Trust band (stats), Final CTA, Footer. A global keydown handler sends keys `1`/`2`/`3` to `/play/test`, `/practice` and `/learn` (`app/page.jsx:11-19`). The tiles also set `accessKey` 1/2/3 (107,136,163). | Inherited from `app/layout.jsx:8-56`. Title: "GRE Vocab Tester — Free GRE Vocabulary Practice With Active Recall". Description says "Drill 800 high-frequency GRE words…". Canonical `https://grevocabtester.com`. OG/Twitter image `/images/og-image.png` 1200×630 (correct now). Icons `/favicon.ico` and `/apple-touch-icon.png`. Keywords and author "Kallan Fraser". **JSON-LD** `WebApplication` is inline in the page body (`app/page.jsx:24-50`): free Offer, creator Person, "800" in the description. This is the only JSON-LD on the site. |
| `/wordpacks` | `app/wordpacks/page.jsx` (client) + `app/wordpacks/layout.jsx` (metadata) | Header and a grid of pack cards (title, ❤️ like button, desc, "N words" chip, optional "Added" date chip, "Use this pack" button), plus loading spinner, error and empty states. | Title "Word Packs — Curated GRE Vocabulary Sets \| GRE Vocab Tester", canonical `/wordpacks`, OG and Twitter set (`app/wordpacks/layout.jsx:5-23`). The description says "build and share your own", but there is no create UI. |
| `/play/test` | `app/play/test/page.jsx` renders `<TestMode onBack={→"/"}/>` | Normal Mode (§4) | `app/play/test/layout.jsx:3-21`: "Normal Mode — Type-to-Recall GRE Vocabulary Practice \| GRE Vocab Tester", canonical `/play/test`. |
| `/play/practice` | `app/play/practice/page.jsx` renders `<PracticeMode/>` | Flash Cards (§4) | `app/play/practice/layout.jsx:3-21`: "Flash Cards — Sequential GRE Vocabulary Review \| …", canonical `/play/practice`. |
| `/play/learn` | `app/play/learn/page.jsx` renders `<LearnMode/>` | Random Flash (§4) | `app/play/learn/layout.jsx:3-21`: "Random Flash — Randomized GRE Vocabulary Drill \| …", canonical `/play/learn`. |
| `/robots.txt` | `app/robots.js` (`dynamic = "force-static"`) | Allows `*` and disallows `/api/`. Sets sitemap and host. | n/a |
| `/sitemap.xml` | `app/sitemap.js` | 5 URLs (/, /wordpacks, /play/test, /play/practice, /play/learn). `lastModified = new Date()`, so the build time. | n/a |
| `/_not-found` | Next default | The default Next 404. | `out/404.html` **inherits the home canonical `https://grevocabtester.com`** (verified by grep). |
| `POST /api/feedback` | `app/api/feedback/route.ts` | See §7. Not deployed. | n/a |
| `POST /api/wordpacks/create` | `app/api/wordpacks/create/route.js` | See §6. Not deployed. | n/a |

### Layout and nav
- `app/layout.jsx:58-66` puts `<Navbar/>` above the children. It imports `styles/globals.css` and `styles/components.css` globally.
- `components/Navbar.jsx:12` returns `null` on `/play*`. Links: logo "GRE | Vocab Tester", "Word Packs" (`Link`), "Flash Cards" (`<a>` to `/play/practice`), CTA "Start Studying →" (`<a>` to `/play/test`).
- Every play page has a "← Back to Menu" button that does `window.location.href = "/"` (`app/play/*/page.jsx`).

### Copy inconsistencies
- **800 vs 679.** "800" appears at `app/layout.jsx:12,32,49` (description, OG, Twitter), `app/page.jsx:33` (JSON-LD), `app/page.jsx:284` ("800 high-frequency GRE words") and `app/page.jsx:319` (trust stat "800"). The real count is 679 (node, `Object.keys(src/data/gre_combined.json).length`). All three play pages render "Word # N / 679" (`TestMode.jsx:330`, `PracticeMode.jsx:70`, `LearnMode.jsx:69`). The number in the label is the word's alphabetical position in the full list, not progress.
- **"Adaptive", "spaced mastery tracking", "trusted by thousands"** (`app/page.jsx:63-64`). Nothing is adaptive or spaced in code (§4).
- **"Build yourself" / "build and share your own"** (`app/page.jsx:289-290`, `app/wordpacks/layout.jsx:8,19`). No pack-creation UI exists.
- **"Typo-tolerant" / "Typo-forgiving input"** (`app/page.jsx:63,124`). The user types a *definition*, which is fuzzy-matched against one canonical short definition (§4). It is not spelling tolerance on a word.
- **Pack titles vs sizes** (`public/data/wordpacks.json`): "GRE Elite 30" has 28 indices; "Power G — 20" has 11. "Power P — 25" (25) and "Power S — 30" (30) match.
- **Emoji in UI**, despite the CLAUDE.md rule: "✅ Correct! ✅" and "❌ … ❌" (`TestMode.jsx:213,243`) and "❤️" on the like button (`app/wordpacks/page.jsx:126`).
- The banner alt text is "GRE SCORE banner" (`app/page.jsx:81`).
- The "8,000+ monthly active users" stat (`app/page.jsx:307`) is not backed by any analytics in the repo (§7).

---

## 3. Components and styles

### Components
| File | Size | What it does | Used by |
|---|---|---|---|
| `components/TestMode.jsx` | 11.4 KB, 378 lines | Normal Mode: free-typed definitions, a 5-word rotating subset, a 4-bar tracker, the Choose Words overlay and pack hydration. | `app/play/test/page.jsx` |
| `components/PracticeMode.jsx` | 2.7 KB, 88 lines | Flash Cards: sequential 4-option multiple choice. | `app/play/practice/page.jsx` |
| `components/LearnMode.jsx` | 2.4 KB, 87 lines | Random Flash: random 4-option multiple choice using `crypto.getRandomValues`. | `app/play/learn/page.jsx` |
| `components/Navbar.jsx` | 1.0 KB | Fixed top nav, hidden on `/play*`. | `app/layout.jsx:6,62` (all pages) |
| `app/page.jsx` | 13.9 KB | The landing page, with all sections inline (no subcomponents). | `/` |
| `app/wordpacks/page.jsx` | 4.6 KB | The pack marketplace. | `/wordpacks` |
| `app/play/*/layout.jsx`, `app/wordpacks/layout.jsx` | ~1 KB each | Metadata-only pass-through layouts. | their segments |

No dead components were found: every component is imported.

### CSS files (all plain CSS, all imported globally once loaded)
| File | Lines / size | Purpose | Imported by |
|---|---|---|---|
| `styles/globals.css` | 80 / 1.6 KB | Tokens, reset, body font stack, `#main-section` layout, utilities `.hidden`/`.no-scroll`/`.center`. | `app/layout.jsx:4`; re-imported redundantly by `app/play/*/page.jsx:5` and `components/{Test,Practice,Learn}Mode.jsx:5` |
| `styles/components.css` | 286 / 6.8 KB | Play-mode UI: `#main-section`, `#current-word`, `.tracker-bars`, `#form-section`, `#alert-message`, `#feedback-section`, `.answer-button(.correct/.incorrect)`, `.answer-section`, `.button-like`. Also **re-declares** `.popup-overlay`, `.popup-message`, `#main-section` and `#choose-words` (duplicates of rules in menu.css and globals.css). | `app/layout.jsx:5` (global) |
| `styles/home.css` | 789 / 23.2 KB | Landing page, scoped under `#home-landing.coral-v1` with its own tokens. Includes a `float-banner` keyframe. Breakpoints at 480/800/801/900/901 px. | `app/page.jsx:6` |
| `styles/menu.css` | 140 / 3.0 KB | The Choose Words overlay (`#choose-words`, `#overlay-container`, `#overlay table`, `.word-data`, `.word-checkbox`, `.buttons-section`, `.popup-*`). | `components/TestMode.jsx:6`, and **also `app/page.jsx:7`, where none of its selectors are used** (a dead import on home). |
| `styles/navbar.css` | 97 / 1.8 KB | `.site-nav`, `.nav-*`. | `components/Navbar.jsx:6` |
| `styles/wordpacks.css` | 341 / 8.9 KB | `#wordpacks` grid, cards, chips, like button, spinner. Has scoped `--wp-*` tokens that fall back to `--glass-border`/`--coral`. Those variables are defined only under `#home-landing` in home.css, so the hard-coded fallbacks always apply on `/wordpacks`. | `app/wordpacks/page.jsx:5` |
| `globals.css` (repo root) | 160 B | **Not CSS.** It holds three `https://buy.stripe.com/...` URLs and is never imported. | none |

### Design tokens in `styles/globals.css:3-29`
`--bg #000`, `--surface rgba(59,59,59,0)` (fully transparent), `--surface-strong #fff`, `--text #e8eef5`, `--muted #a8b3c1`, `--accent #64b5ff`, `--success #7eba7a`, `--danger #e57373`, `--blur 16px`, `--ring 2px solid rgba(100,181,255,.9)`, `--ring-muted 2px solid rgba(0,0,0,.35)`, `--shadow-1 0 4px 20px rgba(0,0,0,.35)`, `--shadow-2 0 10px 30px rgba(0,0,0,.45)`, `--r-sm 8px`, `--r-md 14px`, `--r-lg 18px`, `--pad-sm .6rem`, `--pad 1rem`, `--pad-lg 1.4rem`, `--fs-xs .9rem`, `--fs-sm 1rem`, `--fs 1.1rem`, `--fs-lg 1.35rem`, `--fs-xl clamp(2.2rem,5vw,3rem)`, `--fs-xxl clamp(3rem,9vw,6rem)`.

Home-scoped tokens (`styles/home.css:26-34`): `--coral #ea5746`, `--coral-light #ff8a7a`, `--coral-deep #c83b2c`, `--bg-deep #050505`, `--glass-border rgba(255,255,255,.08)`, `--glass-border-hover rgba(255,255,255,.18)`, `--text #f0f0f2` (overrides the global), `--text-soft #c4c4c8`, `--text-muted #8a8a8e`.

Wordpacks-scoped tokens (`styles/wordpacks.css:9-19`): `--wp-radius 16px`, `--wp-radius-pill 999px`, `--wp-border`, `--wp-border-strong`, `--wp-surface`/`--wp-surface-hover` (gradients), `--wp-text`/`-soft`/`-muted`, `--wp-coral`, `--wp-coral-light`.

The font is `Inter, ui-sans-serif, system-ui, …` (`styles/globals.css:48`). No webfont is loaded: there is no `next/font` and no `@font-face` (grep found none).

The palette is split. The play pages use the blue `--accent` (#64b5ff) on #000, while the home and wordpacks pages use coral on #050505.

### Dead or duplicate CSS (cheap checks)
- `.no-scroll` (`styles/globals.css`) is never referenced in source.
- `styles/menu.css` is imported on home (`app/page.jsx:7`) but unused there.
- `.popup-overlay`, `.popup-message`, `#main-section` and `#choose-words` are defined in both `components.css` and `menu.css`/`globals.css`.
- The comment "Donate section spacing overrides are in home.css" (`styles/globals.css:80`) is stale: home.css has no donate selectors (grep).
- `--surface` is fully transparent.
- My selector scan was a substring match, so finer-grained dead rules could exist inside home.css.

---

## 4. Game modes

Shared data: `src/data/gre_combined.json` is an object keyed by headword (Title-case, e.g. "Abate"). Each value is `{ definition, example, fullDefinition }` (the only 3 fields; verified). Keys are A→Z. Components import it directly (bundled; no fetch).

### Normal Mode, `/play/test` (`components/TestMode.jsx`)
- **Pool.** `activeKeys` (a Set) starts as all 679 words (line 14). Its subset is **5 words drawn randomly *with replacement*** from `activeKeys` (`subsetFromKeys`, 35-38), so the subset can contain duplicates. The game resets every time `activeKeys` changes and has at least 5 entries (193-195).
- **First word.** A random slot of the subset (53-54).
- **Next word.** `pickNewWord` (66-73) picks a random slot in `activeSubset` whose word differs from the current one. It runs 1500 ms after a correct answer (238-241). That `setTimeout` closure captures the pre-update `activeSubset`, so right after a mastery swap the old word can be picked again (inferred from code, not reproduced). If every slot held the same word, the `while` loop at line 70 would never exit (possible with duplicates; not reproduced).
- **Mastery.** `masteryCounts[word]` increments on each correct answer. **A wrong answer resets it to 0** (250). When the count reaches **4** (223), the word's slot is replaced by `pickReplacementWord()` (76-93), which prefers words in `activeKeys` that are not already in the subset and not the current word. The replacement's count is set to 0 (231). Nothing records that a word was mastered, and there is no end state.
- **Grading.** `string-similarity.compareTwoStrings` (Sørensen–Dice on bigrams). The input is normalized with `.trim().toLowerCase()` and compared against `vocabData[word].definition` (also trimmed and lowercased). It passes if **score ≥ 0.6** (58-64). There is no punctuation stripping and no matching against alternative definitions or `fullDefinition`.
- **Right answer.** `alertMessage = "✅ Correct! ✅"`, `yesmp3.mp3` plays, and the input clears. After 1.5 s the alert clears and the next word loads.
- **Wrong answer.** `alertMessage = "❌ <correct definition> ❌"`, `nomp3.mp3` plays, the count resets to 0 and the input clears. `fullDefinition` and `example` are shown (`#feedback-section`, 357-369; the quote characters are stripped by `sanitize`, 32). **The word does not advance**: the user stays on it until they answer correctly.
- **Sounds.** `new Audio("/sounds/yesmp3.mp3")` and `nomp3.mp3`, volume 0.1, preload auto (181-191). Both reset `currentTime = 0` before playing.
- **Tracker.** 4 `<li>`, with green = `min(count,4)` (198-205).
- **Keyboard.** The input has `autoFocus` (345). Enter submits the form (338). There are no other shortcuts.
- **Choose Words overlay** (256-311, `styles/menu.css`). The "Choose Words" button (371-373) opens a table of all 679 words with checkboxes. "Select All", "Done" and "Deselect All" appear both above and below the table. Each toggle mutates `activeKeys`, which fires the reset effect immediately whenever at least 5 words are selected, so the game behind the overlay resets on every click. "Done" with fewer than 5 selected shows the popup "Please Select At Least 5 Words" for 2 s (265-270, 320-324). Otherwise it resets and closes. **Selections are not persisted.**
- **Completion.** None. Play loops forever.
- **Word-pack input**, applied in this order:
  1. `localStorage["marketplaceWordpack"]` (96-128): parse the JSON int array, map indices to keys, top up randomly to 5 if there are 1-4 valid words, set `activeKeys`. The key is always removed in `finally`.
  2. URL `?pack=1,5,9` (CSV indices, filtered to `0 ≤ n < 679`), or else `?id=<packId>`, which fetches `/data/wordpacks.json` with `cache: "no-store"`, finds the pack by `id` and hydrates from `indices` (130-178).

  The `/wordpacks` page sets **both** the key and `?id=` (`app/wordpacks/page.jsx:75-79`), so the pack is applied twice and the game resets twice.

### Flash Cards, `/play/practice` (`components/PracticeMode.jsx`)
- **Order.** Sequential through `Object.keys` (A→Z), always **starting at index 0** on load (11) and wrapping to 0 after the last word (53). Position is not saved.
- **Question.** Four definitions: the target plus 3 distractors, chosen by Fisher–Yates shuffle (`Math.random`) of every other word and then the whole set shuffled (16-35).
- **Grading.** Click identity only. The clicked button gets class `correct` or `incorrect`, and the correct button is also highlighted when the answer is wrong (42-50). All buttons are disabled until the next question, which loads after **1200 ms** (52-56).
- There is no mastery, no score, no sounds, no keyboard shortcuts (buttons are reachable with Tab and Enter only), no word-pack support and no completion state.

### Random Flash, `/play/learn` (`components/LearnMode.jsx`)
- **Each question:** a full Fisher–Yates shuffle of all 679 keys using `crypto.getRandomValues` modulo (15-27). The first 4 become the options, and a random one of those is the target (28). Words repeat freely; there is no history.
- **Feedback:** the same `correct`/`incorrect` classes, next question after **2000 ms** (53-55).
- There is no mastery, score, sounds, keyboard shortcuts, packs or completion.

---

## 5. Persistence (complete list)

The only storage API used is `localStorage`. **No `sessionStorage`, `document.cookie` or `indexedDB` exists in the current source or in any commit** (grep over current source; `git grep` over `git rev-list --all`).

| Key | Value shape | Written | Read / removed | Lifetime |
|---|---|---|---|---|
| `wp_upvote_ledger_v2` | JSON object `{ "<packId>": true, … }`. Pack ids are strings such as `"gre-elite-30"`. Only `true` values are ever written. | `app/wordpacks/page.jsx:63-67` (`onUpvote`; `LEDGER_KEY` const at line 7) | `app/wordpacks/page.jsx:16-23` (parsed on mount; falls back to `{}` on error) | Permanent. It marks "liked" (aria-pressed and the title text) and blocks a second like. **The like count itself is not persisted**: `likes` increments only in React state (62), so after a reload the count goes back to the JSON value while the heart stays "pressed". A `// TODO: POST to API` comment sits at line 68. |
| `marketplaceWordpack` | A JSON array of integers, the pack's `indices`, e.g. `[12,57,301]` | `app/wordpacks/page.jsx:75` (`PACK_KEY` const at line 8) | `components/TestMode.jsx:100` (read) and `:126` (always removed in `finally`) | One-shot handoff from `/wordpacks` to `/play/test`. If the user never reaches `/play/test`, the key lingers and gets applied on the next unrelated visit to `/play/test`. |

**Historical key (removed):** `wp_likes:<packId>` held a stringified number counting local likes. It was added in commit `a8b1b55` ("Works", `Client/app/wordpacks/page.jsx:9-13`) and replaced by `wp_upvote_ledger_v2` in `ad192e9` ("Major Update"). Long-time users may still have `wp_likes:*` keys in their browsers. No code reads them now. No `wp_upvote_ledger` v1 key ever existed in git history (pickaxe search).

**What is NOT persisted** (everything a user might think of as "progress"): `masteryCounts`, `activeSubset` and `activeKeys` (Choose Words) in `TestMode.jsx:14-29`; `currentIndex` in `PracticeMode.jsx:11`; scores of any kind.

**Migration implications.**
- Preserve `wp_upvote_ledger_v2`. It is keyed by pack `id`, so keep the pack ids stable.
- Optionally fold `wp_likes:*` (value > 0 means liked) into it.
- Keep accepting a `marketplaceWordpack` index array on first load for one-shot handoffs already in flight, mapped through the *current* key order.
- Old `?pack=` CSV-index URLs and `?id=` URLs may be bookmarked or shared. `?pack=` indices are positional, so freeze a snapshot of the current 679-key order to resolve them after any vocabulary change.

---

## 6. Word packs

- **Storage.** A static file, `public/data/wordpacks.json`, shipped in the export as `out/data/wordpacks.json`. It is an array of 12 packs. **Actual fields: `id, title, desc, indices, likes, words`.** None of the 12 has `createdAt` or `authorIpHash` (inspected with PowerShell and node). CLAUDE.md lists `createdAt`/`authorIpHash` and omits `words`.
- **Packs** (id: words, likes): argument-verbs 21/108, process-change 18/96, emotion-spectrum 10/88, people-traits-pos 12/77, people-traits-neg 22/101, style-register 16/85, verbal-attacks 15/84, learning-intellect 10/90, gre-elite-30 28/150, power-P 25/73, power-S 30/70, power-G 11/62. The largest index is 668, inside 0-678. There are no duplicate indices. **`words[i] === Object.keys(vocab)[indices[i]]` holds for every pack** (verified with node).
- **Load.** The client does `fetch("/data/wordpacks.json", { cache: "no-store" })` (`app/wordpacks/page.jsx:31`), coerces the fields, filters `indices` to non-negative integers, and sorts by likes descending, then title (36-47). There is no API and no external store.
- **Open.** A click on the card, on "Use this pack", or Enter on a focused card stores `indices` in `localStorage.marketplaceWordpack` and does a full navigation to `/play/test?id=<id>` (72-80). This is Normal Mode only; Flash Cards and Random Flash ignore packs.
- **Upvote.** Client-only (§5). There is no server call, so like counts in the JSON are hand-edited.
- **Create.** `POST /api/wordpacks/create` (`app/api/wordpacks/create/route.js`) is **not deployed and has no UI**. For the record, it validates:
  - title: a non-empty string of at most 48 characters
  - desc: at most 100 characters
  - indices: an array of at least 5 entries, deduped to integers in `0 ≤ n < 10000`, still at least 5 after cleaning

  It also runs a profanity check (11-word list, leetspeak normalization, substring match; lines 13-41). Rate limiting is an in-memory `Map` capped at 5 per raw IP, plus 5 per SHA-256(ip + `IP_SALT` or `"dev_salt_change_me"`) counted against the stored `authorIpHash` (85-104). The client IP comes from `x-forwarded-for`, then `x-real-ip`, then `0.0.0.0` (43-50). The route generates a slug id with `-N` dedupe and prepends `{id,title,desc,indices,likes:0,createdAt,authorIpHash}` to the JSON file on disk (106-133). It does not write `words`.
- **How a pack references words:** by **array index** into `Object.keys(gre_combined.json)`. The redundant `words` array is unused by code.

---

## 7. Feedback, analytics, donate, third parties

- **Feedback.** `POST /api/feedback` (`app/api/feedback/route.ts`):
  - requires a JSON content-type, else 415 (28-31)
  - rejects a `content-length` above 20 KB with 413 (34-37)
  - Zod schema `{ message: 1-2000 chars, email?: email }` (8-11); invalid input gets a 400 with `fieldErrors`
  - on success it only `console.log`s the length and a has-email flag (64-67) and returns 201; an `OPTIONS` handler returns 204

  It is not deployed and nothing calls it: grep for `/api/feedback` in `app/` and `components/` finds no `fetch`.
- **Analytics.** None. There is no gtag, Plausible, Cloudflare Web Analytics snippet or other `<script>` besides the JSON-LD (grep). Cloudflare-side analytics, if any, would not show in the repo.
- **Donate.** No donate UI exists in current source. The leftovers are the three Stripe Payment Links in the stray root `globals.css:3-5`, the stale comment at `styles/globals.css:80`, and the historical commit `8ef32d0` "Added Donations".
- **Other third parties.** None. No external fonts, CDNs, embeds or iframes. Everything is served from the same origin.

---

## 8. Assets (`public/`)

Dimensions come from parsing the PNG IHDR and WebP headers (sharp would not load).

| File | Format | Dimensions | Bytes | Referenced at |
|---|---|---|---|---|
| `public/favicon.ico` | ICO | 16, 32, 48 | 15,086 | `app/layout.jsx:53` |
| `public/apple-touch-icon.png` | PNG | 180×180 | 34,472 | `app/layout.jsx:54` |
| `public/images/og-image.png` | PNG | 1200×630 | 258,016 | `app/layout.jsx:37,50` (OG/Twitter) |
| `public/images/logo-128.webp` | WebP | 128×128 | 6,354 | `app/page.jsx:355` (footer, 40 px) |
| `public/images/GRETesterBanner.webp` | WebP | 1200×300 | 16,604 | `app/page.jsx:78-79` (hero) |
| `public/images/GRETesterBanner-mobile.webp` | WebP | 600×150 | 7,498 | `app/page.jsx:79` (srcset) |
| `public/images/GRETesterBanner.png` | PNG | 1200×300 | 273,790 | Only as input to `scripts/generate-images.js:19`. Not referenced by any page, but shipped in `out/`. |
| `public/images/GREWebsiteLogo.png` | PNG | 1024×1024 | 1,215,671 | Only as input to `scripts/generate-images.js:18`. Not referenced by any page, but shipped in `out/`. |
| `public/images/NormalModeScreenshot.png` | PNG | 1772×1235 | 163,889 | `app/page.jsx:110` |
| `public/images/FlashcardScreenshot.png` | PNG | 1689×1003 | 110,944 | `app/page.jsx:139` |
| `public/images/RandomFlashcardScreenshot.png` | PNG | 1640×944 | 112,434 | `app/page.jsx:166` |
| `public/sounds/yesmp3.mp3` | MP3 | n/a | 11,559 | `components/TestMode.jsx:183` |
| `public/sounds/nomp3.mp3` | MP3 | n/a | 5,659 | `components/TestMode.jsx:184` |
| `public/data/wordpacks.json` | JSON | n/a | 6,727 | §6 |

**Will go stale after a redesign:** the three `*Screenshot.png` files are captures of the current play UI used in the home mode tiles. Also affected: `og-image.png`, which composites the current logo, and the banner and logo derivatives if the brand changes. The screenshot PNGs are lazy-loaded but unoptimized; WebP versions would be much smaller.

---

## 9. Tests and tooling

- **Tests: none.** There is no test runner in `package.json`, no `*.test.*`/`*.spec.*` outside `node_modules`, and no jest, vitest or playwright config.
- **Lint: none configured.** No `.eslintrc*`/`eslint.config.*` and no eslint dependency. `next build` still prints "Linting and checking validity of types" and passes. The `// eslint-disable-next-line` comments in `PracticeMode.jsx:39` and `LearnMode.jsx:37` are vestigial.
- **Prettier:** no config file, but every file carries a `/** @format */` pragma.
- **Build: `npm run build` succeeded (exit 0)** with Next 15.5.14 on Node v24.16.0, win32-arm64. It compiled in 10.9 s and generated 12 static pages. Warnings: the four "headers will not automatically work with output: export" messages. The route list is in §2. `out/` and `.next/` were regenerated, and both are gitignored.

---

## 10. Git

- Branch `main`. The working tree was **clean** at the start (`git status --short` empty). The build touched only the gitignored `out/` and `.next/`.
- `.batches/` **is ignored** through `.git/info/exclude:7`, not through `.gitignore`. `.batch-runs/` is ignored through `.git/info/exclude:8`. Neither has tracked files.
- Last 15 commit subjects (newest first; the newest is `a38a129` from 2026-05-20, the oldest shown is 2025-10-15):
  1. a38a129 Cleanup
  2. 7d67a09 Updated Home Page
  3. 2d20c75 Updated
  4. d59d530 Version2
  5. 24d5ea7 Output Build FIle
  6. a200164 fixed conflict w choose words button
  7. 8fa94cd Security Addition
  8. ec726a4 Bug fix and styles
  9. de8b41d Phone Styles
  10. aa09d29 MetaData
  11. 595888c Merge branch 'Tinkering'
  12. ad192e9 Major Update
  13. a8b1b55 Works
  14. 8ef32d0 Added Donations
  15. 730d92b Done
- Older history kept the app under `Client/` (e.g. `Client/app/wordpacks/page.jsx` in `a8b1b55`).

---

## 11. CLAUDE.md: summary and contradictions

**Summary.** `CLAUDE.md` describes:
- the app: a static-export Next 15 / React 19 app with three modes, community word packs, plain CSS and a dark coral theme
- the data layer: a 679-word object, packs indexed by array position
- persistence: two localStorage keys
- static-export caveats, an asset audit focused on the 1.16 MiB logo, a tech-debt list
- strict UI rules: professional copy, no emoji or slang, no Tailwind, don't change mastery=4, the 0.6 threshold or the 5-word subset, don't run `sort:vocab` without remapping packs

**Contradicted by current code:**
1. **`middleware.ts` is described** (structure, caveats, tech debt) **but does not exist.**
2. **"out/ — Build artifact (committed)":** `out/` is gitignored (`.gitignore:7-8`), with 0 tracked files.
3. **"OG metadata url is grevocabtester.onrender.com":** it is now `https://grevocabtester.com` (`app/layout.jsx:33`).
4. **"metadataBase is not set":** it is set (`app/layout.jsx:9`).
5. **"OG image dims misdeclared / 1024×1024 logo as OG":** OG now uses `og-image.png`, which really is 1200×630 (`app/layout.jsx:37-39`).
6. **The logo audit** ("five `<link>`s + footer `<img>` all point at the 1.16 MiB PNG", the preload, the duplicate `<head>` favicon at `layout.jsx:55-57`): all fixed. Icons are `favicon.ico` and `apple-touch-icon.png`, the footer uses `logo-128.webp`, and there is no manual `<head>`. `out/index.html` has only one icon link and one apple-touch link, and its only image preload is the banner srcset (verified).
7. **"Banner GRETesterBanner.png … `app/page.jsx:52`":** the hero uses WebP with a srcset (`app/page.jsx:78-79`). The PNG is unreferenced.
8. **"Letter glyphs (T/F/R) in `.tile-icon-styled`":** no such class exists. The tiles use screenshots (`app/page.jsx:108-118`).
9. **"No `next/image` … both images are plain `<img>`":** still true, but there are now five `<img>` tags on `/` (`app/page.jsx:77,109,138,165,354`), referencing 6 image files (via the srcset).
10. **The wordpacks.json schema** "(id, title, desc, indices, likes, createdAt, authorIpHash)": the real fields are `id, title, desc, indices, likes, words`.
11. **Project structure omits:** `app/robots.js`, `app/sitemap.js`, the 4 metadata `layout.jsx` files, `scripts/generate-images.js` with its `generate:images` script, the dev deps `sharp`/`png-to-ico`, `public/favicon.ico`, `public/apple-touch-icon.png` and 6 more images.
12. **"Marketing uses spaced repetition":** the copy now says "spaced mastery tracking" and "adaptive" (`app/page.jsx:63-64`). The point stands that neither exists in code.
13. **"`styles/globals.css:47` font-family":** it is on line 48. Trivial.
14. **"Fetched multiple times … biggest perf problem on the home page":** obsolete. The largest home-page assets are now the three screenshot PNGs (110-164 KB each).
15. **The rule "No emoji in UI chrome"** is violated in the feedback and like UI (`TestMode.jsx:213,243`, `wordpacks/page.jsx:126`). These may count as content rather than chrome, but they are visible UI.

**Still accurate:** the 679 count and the "800" overstatement; mastery=4, the 0.6 threshold and the 5-word subset; the index-based pack fragility; the unused `axios`; production headers missing (no `_headers`); the stray root `globals.css`; the API routes not running on the static host; `wordpacks/create` writing to disk with no UI.
