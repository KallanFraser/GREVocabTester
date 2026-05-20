# GRE Vocab Tester — CLAUDE.md

> Adaptive GRE vocabulary study app at **grevocabtester.com**. Solo-built, free, ~8k MAU.

## Overview

Web app that drills GRE-frequency vocabulary in three study modes (free-type with typo tolerance, sequential multiple choice, randomized multiple choice). Words come from a curated, deduplicated JSON dataset assembled from past papers and prep sources. Community-curated "Word Packs" let users study focused subsets via shareable URLs. The whole app ships as a static export — no database, no auth.

## Tech Stack (verified from `package.json`)

- **Framework:** Next.js `^15.3.4` — App Router, `output: "export"` (static site)
- **React:** `^19.1.0` / react-dom `^19.1.0`
- **Language:** JSX components (no TS in components); two API routes are `.ts`/`.js`; `tsconfig.json` present with `strict: false`, `allowJs: true`
- **Validation:** `zod ^4.1.12` (feedback endpoint only)
- **HTTP:** `axios ^1.10.0` declared, **not used anywhere in source** (only `fetch` is) — likely dead dep
- **Answer matching:** `string-similarity ^4.0.4` (Dice coefficient, 0.6 threshold)
- **Styling:** Plain CSS files in [styles/](styles/) — no Tailwind, no CSS-in-JS, no CSS Modules
- **Font:** Inter named as first entry in [styles/globals.css:47](styles/globals.css#L47) `font-family` stack with system fallbacks. **Not** loaded via `next/font` or `@font-face` — relies on user having Inter installed locally
- **Node tooling:** TypeScript `5.9.3` (dev), `@types/node 24.8.1`, `@types/react 19.2.2`

## Project Structure

```
app/                         — App Router root
  layout.jsx                 — Global layout + metadata; mounts <Navbar/>
  page.jsx                   — Home/landing (coral theme), keyboard shortcuts 1/2/3
  wordpacks/page.jsx         — Word Packs marketplace (lists, upvotes, opens packs)
  play/
    test/page.jsx            — Wrapper that renders <TestMode/>
    practice/page.jsx        — Wrapper that renders <PracticeMode/>
    learn/page.jsx           — Wrapper that renders <LearnMode/>
  api/
    feedback/route.ts        — POST feedback (Zod validation, 20 KB cap)
    wordpacks/create/route.js — POST new pack (size, profanity, IP-hash rate limit)

components/
  Navbar.jsx                 — Fixed top nav; hidden on /play/* routes
  TestMode.jsx               — Core free-type mode (5-word rotating subset, mastery=4)
  PracticeMode.jsx           — Sequential multiple choice
  LearnMode.jsx              — Randomized multiple choice (uses crypto.getRandomValues)

styles/
  globals.css                — Tokens, base, font stack
  components.css             — TestMode + answer buttons + tracker bars
  home.css                   — Landing (coral theme)
  navbar.css                 — Top nav
  menu.css                   — "Choose Words" overlay
  wordpacks.css              — Word Packs grid + cards

src/data/
  gre_combined.json          — 679 vocab entries (verified count) — object keyed
                               by word with { definition, example, fullDefinition }

public/
  data/wordpacks.json        — 12 community packs (id, title, desc, indices,
                               likes, createdAt, authorIpHash)
  images/                    — 2 PNGs (see Assets)
  sounds/                    — yesmp3.mp3 / nomp3.mp3 (correct/incorrect SFX, 10% vol)

scripts/sort-gre-combined.js — A→Z sorter for the vocab JSON (`npm run sort:vocab`)

middleware.ts                — In-memory token-bucket rate limiter
                               (60 req/min default, 10 req/min on /api/*)
next.config.mjs              — output: "export", images.unoptimized: true,
                               dev-only security headers + CSP
out/                         — Build artifact (committed; emitted by `next build`)
globals.css                  — Stray file at repo root containing 3 Stripe URLs.
                               NOT a stylesheet; looks like a paste accident.
                               The real global stylesheet is styles/globals.css.
```

## Data Layer

- **Words live in [src/data/gre_combined.json](src/data/gre_combined.json):** an *object* (not array) where each key is the headword and each value is `{ definition, example, fullDefinition }`. Imported directly into components — bundled at build time, no network fetch. **679 entries today** (homepage copy says "800+"; that figure is aspirational, not the actual count).
- **Word Packs live in [public/data/wordpacks.json](public/data/wordpacks.json):** an *array* of packs. Each pack stores `indices` — integer positions into `Object.keys(gre_combined.json)`, **not the words themselves**. This means re-sorting, adding, or removing a vocab key silently re-maps every pack to different words. `npm run sort:vocab` is therefore a footgun.
- **No spaced-repetition algorithm in code.** What [`TestMode`](components/TestMode.jsx) actually implements is *short-rotation mastery*: a 5-word subset, each word needs 4 consecutive correct answers (counter resets to 0 on any wrong answer), then is swapped out for a fresh word from outside the current pool ([TestMode.jsx:76-93](components/TestMode.jsx#L76-L93), [TestMode.jsx:220-236](components/TestMode.jsx#L220-L236)). Practice and Learn modes do not track mastery at all. *(The "spaced repetition" framing used in marketing is not implemented — flag this if asked to extend it.)*
- **Persistence:** `localStorage` only. Keys:
  - `marketplaceWordpack` — selected pack's indices, consumed once by `TestMode` then deleted
  - `wp_upvote_ledger_v2` — one like per pack per client

## Key Features / Pages

| Route | Component | Behavior |
|---|---|---|
| `/` | [app/page.jsx](app/page.jsx) | Hero, mode tiles, feature grid, footer. Keys `1`/`2`/`3` jump to modes. |
| `/wordpacks` | [app/wordpacks/page.jsx](app/wordpacks/page.jsx) | Fetches `/data/wordpacks.json`, sorted by likes. Click → stashes `indices` in `localStorage["marketplaceWordpack"]` and navigates to `/play/test?id=<packId>`. |
| `/play/test` | [components/TestMode.jsx](components/TestMode.jsx) | Free-type. 5-word rotating subset, mastery=4, 60% string-similarity threshold ([line 58](components/TestMode.jsx#L58)). Hydrates from `?pack=1,5,9` (CSV indices), `?id=<packId>` (fetches wordpacks.json), or `localStorage["marketplaceWordpack"]`. "Choose Words" overlay lists every word with checkboxes. |
| `/play/practice` | [components/PracticeMode.jsx](components/PracticeMode.jsx) | Multiple choice (4 options), sequential A→Z through all words. Distractors = random other definitions. |
| `/play/learn` | [components/LearnMode.jsx](components/LearnMode.jsx) | Multiple choice (4 options), fully randomized order. Uses `window.crypto.getRandomValues` for shuffle. |
| `POST /api/feedback` | [route.ts](app/api/feedback/route.ts) | Zod-validates `{ message, email? }`, 20 KB cap, logs to stdout (no persistence). |
| `POST /api/wordpacks/create` | [route.js](app/api/wordpacks/create/route.js) | Writes a new pack into `public/data/wordpacks.json` on disk. Profanity filter, per-IP cap of 5 (in-memory + hashed-IP), title ≤ 48, desc ≤ 100, min 5 indices. **No UI in the repo calls this endpoint.** |

## Design System

- **Colors:** `--coral: #ea5746`, `--coral-light: #ff8a7a`, `--accent: #64b5ff`, deep dark bg (`#000` / `#050505`)
- **Font:** Inter, with system fallbacks (no actual font file loaded — see Tech Stack note)
- **Theme:** Dark with coral/red accent — professional, premium, dark-SaaS aesthetic
- **Responsive:** mobile-first, CSS grid breakpoints at 640 / 800 / 900 / 1000 / 1100 px

## UI Philosophy (CRITICAL — preserved from prior CLAUDE.md)

**This must look like a real, professional GRE prep company** (think Magoosh, Princeton Review).
- **No emoji icons** in UI chrome (mode tiles, nav, feature sections). Letter glyphs (T/F/R) with gradient backgrounds are used in `.tile-icon-styled`.
- **No slang copy** ("built to grind", "vibe", "No fluff", "Support the grind", etc.).
- Professional copywriting throughout.
- Persistent navigation bar on non-`/play` pages (Navbar hides itself on `/play/*` to remove distractions during study).
- Stats, social proof, and trust signals on homepage.
- Clean, premium feel — dark SaaS.

## Build & Deployment

```bash
npm run dev        # next dev on port 3010
npm run build      # next build → emits /out (static)
npm run start      # next start (only meaningful for non-export verification)
npm run sort:vocab # node scripts/sort-gre-combined.js (A→Z keys)
```

**Static-export caveats this codebase is subject to:**

- `output: "export"` + `images.unoptimized: true` in [next.config.mjs:46-49](next.config.mjs#L46-L49). The [`next/image`](https://nextjs.org/docs/app/api-reference/components/image) component would do **no** server-side optimization even if adopted; image sizing must be done at build/disk time.
- API routes (`/api/feedback`, `/api/wordpacks/create`) **cannot run** on a pure static-export host. `wordpacks/create` additionally writes to the project filesystem, which is non-functional on serverless or static hosting.
- `headers()` in `next.config.mjs` is **dev-only** (gated on `NODE_ENV !== "production"`). The comment claims prod headers come from `/public/_headers`, **but no `_headers` file exists** in `public/`. Net effect: no security headers in production unless the host injects them.
- `middleware.ts` does not execute on a static-export host. The token bucket is also in-memory (per-process), so it would not work across instances even on a dynamic host.
- OG metadata `url` is `https://grevocabtester.onrender.com` (a historical/redirect host). Live site is grevocabtester.com.

## Assets

### Images — [public/images/](public/images/)

| File | Format | Disk size | Pixel dims | Where referenced |
|---|---|---|---|---|
| `GREWebsiteLogo.png` | PNG | **1,215,671 B (~1.16 MiB)** | **1024 × 1024** | 5 `<link>` tags + 1 `<img>` — see image audit below |
| `GRETesterBanner.png` | PNG | 273,790 B (~267 KiB) | 1200 × 300 | Single `<img>` on `/` ([app/page.jsx:52](app/page.jsx#L52)) |

**No `next/image` is used anywhere in source.** Both images are plain `<img>` tags. (Only hit for `next/image` is the type reference in `next-env.d.ts`.)

### Audio — [public/sounds/](public/sounds/)

| File | Size | Used in |
|---|---|---|
| `yesmp3.mp3` | 11,559 B | TestMode correct-answer SFX (vol 0.1) |
| `nomp3.mp3` | 5,659 B | TestMode wrong-answer SFX (vol 0.1) |

### Image audit — `GREWebsiteLogo.png`

The rendered static HTML (`out/index.html`) emits **five** `<link>` references plus the in-page `<img>`, all pointing at the same 1.16 MiB file:

1. `<link rel="preload" as="image" href="/images/GREWebsiteLogo.png">` — auto-emitted by Next because the same URL is in `metadata.openGraph.images[0]` ([app/layout.jsx:28-37](app/layout.jsx#L28-L37))
2. `<link rel="icon">` — from `metadata.icons.icon` ([app/layout.jsx:46](app/layout.jsx#L46))
3. `<link rel="shortcut icon">` — from `metadata.icons.shortcut` ([app/layout.jsx:47](app/layout.jsx#L47))
4. `<link rel="icon">` — manual duplicate in `<head>` ([app/layout.jsx:56](app/layout.jsx#L56))
5. `<link rel="apple-touch-icon">` — from `metadata.icons.apple` ([app/layout.jsx:48](app/layout.jsx#L48))
6. `<img class="footer-logo">` in the home page footer, **CSS-sized to 40 px wide** ([styles/home.css:441-444](styles/home.css#L441-L444))

Additional discrepancy: `openGraph.images[0]` declares `width: 1200, height: 630` but the actual PNG is 1024 × 1024 (square). The declared dims are wrong; social cards will letterbox.

## Known Issues / Tech Debt

- **`GREWebsiteLogo.png` is 1.16 MiB used as a favicon AND a 40 px footer logo** — biggest perf problem on the home page. Fetched multiple times because it's referenced as preload + icon + shortcut icon + apple-touch-icon + duplicate icon + footer `<img>`. See image audit above.
- **`GRETesterBanner.png` is ~267 KiB at 1200 × 300** — banner renders at ~500 px wide on desktop and full-width on mobile; could be a fraction of the size as WebP.
- **Vocab count overstated.** Code says 679; homepage / prior CLAUDE.md say "800+". Pick one source of truth.
- **No spaced-repetition algorithm.** TestMode is short-rotation mastery (5-word subset, 4-streak → swap). Marketing language uses "spaced repetition" — code does not.
- **`axios` is a declared dependency but unused** — source only uses `fetch`.
- **`POST /api/wordpacks/create` writes to `public/data/wordpacks.json` at runtime** — incompatible with the static export deployment and with serverless filesystems. No UI currently invokes it.
- **No production security headers.** `next.config.mjs` gates `headers()` on dev only and points to `/public/_headers`, which does not exist.
- **Middleware rate limiter is in-memory only.** Buckets reset per process/instance — and middleware doesn't execute on a pure static-export host anyway.
- **Wordpack `indices` are array positions, not stable IDs.** Re-sorting `gre_combined.json` silently re-maps every pack. `npm run sort:vocab` is destructive in that sense.
- **Stray non-CSS `globals.css` at repo root** contains 3 Stripe URLs with a `/** @format */` header. Looks like a paste accident. The real global stylesheet is [styles/globals.css](styles/globals.css).
- **`metadataBase` is not set** in [app/layout.jsx](app/layout.jsx). OG/Twitter image URLs resolve relative to whatever Next infers as the base.
- **OG image dimensions are misdeclared** (1200×630 in metadata vs. 1024×1024 on disk).
- **`<head>` duplicates the favicon link** that `metadata.icons.icon` already emits ([app/layout.jsx:55-57](app/layout.jsx#L55-L57)).

## What NOT to do

- Don't add Tailwind (plain CSS is intentional).
- Don't break static export — no server-side features beyond the existing API routes (which already don't run on the live host).
- Don't change core game logic (mastery=4, 0.6 string-similarity threshold, 5-word subset).
- Don't add emoji to UI chrome.
- Don't use informal / slang copy.
- Don't run `npm run sort:vocab` without re-mapping every wordpack's `indices` — it will silently scramble packs.
