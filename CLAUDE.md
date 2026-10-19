# GRE Vocab Tester: CLAUDE.md

Adaptive GRE vocabulary study app at grevocabtester.com. Free, solo-built, static site. This file describes the code as it stands on the `overhaul` branch. When code and this file disagree, the code wins; fix this file.

## Stack

- Next.js `^15.3.4` App Router with `output: "export"` (static site, no server). React `^19.1.0`.
- Components and pages are JSX. `lib/` is plain ES modules (`.js`). Build scripts in `scripts/` are CommonJS or ESM Node scripts. `tsconfig.json` exists (`allowJs`, not strict) but there is no TypeScript source to maintain.
- Runtime dependencies: `next`, `react`, `react-dom` only. Answer matching is in-house (`lib/matching.js`). There are no API routes, no middleware, no database, no auth.
- Styling: plain CSS files in `styles/`. No Tailwind, no CSS-in-JS, no CSS Modules.
- Dev dependencies include `sharp` and `png-to-ico` (image scripts), `typescript` and type packages.
- Dev server: `npm run dev` (port 3010). Do not start it or run `npm run build` casually; both write to `.next/`.

## Project layout

```
app/                  routes (see Routes), layout.jsx, not-found.jsx, robots.js, sitemap.js
components/           mode components, Navbar, Background, PlayHeader, ConfirmDialog
  test/               Test mode pieces + engine.js (pure helpers)
  choice/ChoiceQuiz   shared engine behind Practice and Learn
  home/               ModeTiles, TryIt, ContinueCard, HomeShortcuts, modes.js (the mode list),
                      plus the home motion pieces: HeroCanvas (word field drawn from the marquee),
                      HomeMotion (scroll/reveal effects for the landing root), CountUp (animated
                      number), ScrambleWord (cycling word display), ReviewChart (Daily review
                      ladder line, intervals passed in from lib/review.js)
  packs/              PackList, PackRow, UpNext, PackBuilder, SharedPackOffer, packUtils.js
lib/                  all logic that is not UI (storage, settings, progress, packs, matching,
                      pool, hard-scheduler, review, context, distractors, words, backgrounds/)
src/data/             gre_combined.json, legacy-index.json, packs-manual.json, home.json
public/               data/wordpacks.json (generated), _headers, manifest.webmanifest,
                      images/, sounds/ (yesmp3.mp3, nomp3.mp3), favicon.ico
scripts/              build-packs.js, validate-vocab.js, vocab-stats.js, sort-gre-combined.js,
                      generate-images.js, render-assets.mjs
styles/               globals, ui, components, testmode, choice, cards, context, review, home,
                      navbar, menu, wordpacks, settings, dialog, backgrounds
tests/                *.test.mjs, run with node:test
design/overhaul/      working notes from the overhaul (CONTEXT, gre-data, gre-current,
                      wortschatz-inventory). Background reading, not the source of truth.
```

`out/` is the export target and is git-ignored. The sister app Wortschatz (German) is the origin of most of the ported modules; comments in `lib/` cite its lessons as `Wortschatz L<n>`.

## Routes and modes

All study routes live under `/play/*`. Navbar hides itself there. Mode list and shortcut order come from `components/home/modes.js`; the home page keys 1 to 6 open them in that order.

| Route | Key | Component | Mechanics |
|---|---|---|---|
| `/` | | `app/page.jsx` | Hero, playable try-it card, "Continue" card (last pack), mode tiles. Counts shown come from `src/data/home.json`. |
| `/wordpacks` | | `app/wordpacks/page.jsx` | Learning path with an "Up next" panel, sticky toolbar, collapsible categories, favorites, and a pack builder for custom packs. |
| `/play/test` | 1 | `TestMode` | Typed recall, Normal or Harder. See below. |
| `/play/practice` | 2 | `ChoiceQuiz` (practice) | Four-option multiple choice, sequential through the scope in file order. Position saved per scope in `gv_practice_pos`. No mastery recorded. |
| `/play/learn` | 3 | `ChoiceQuiz` (learn) | Same questions, crypto-shuffled deck, no repeats until the deck runs out, then a fresh shuffle. Deck lives in component state only. Titled "Random Practice". |
| `/play/cards` | 4 | `Flashcards` | Flip cards, no typing, no grading, no progress writes. Reads durable mastery only for a Mastered/Unmastered filter. |
| `/play/review` | 5 | `ReviewMode` | Typed recall over words due today across all packs (see Daily review). |
| `/play/context` | 6 | `ContextMode` | Sentence completion: the headword is blanked out of its example sentence (`lib/context.js` `blankSentence`, whole-word, inflections allowed) and the learner picks from four options. Words whose sentence cannot be blanked are skipped. No mastery recorded. |
| `/settings` | | `app/settings/page.jsx` | Settings, backgrounds, progress export/import, Reset all. |

Other: `app/not-found.jsx` (noindex), `app/robots.js`, `app/sitemap.js`, `public/manifest.webmanifest`.

### Pack context in play pages

`lib/packs.js` `resolvePackContext(searchParams)` decides which words a mode runs over. In order: `?pack=<id>` (built-in or custom pack), `?pack=12,45,...` (old digits-only index list, resolved through `legacy-index.json`), `?words=a,b,c` (share link, headwords), `?id=<packId>` (old link format), then the legacy `marketplaceWordpack` handoff. Test, Practice, Learn, Cards and Context rewrite the address bar to the stable form (`?pack=<id>` or `?words=...`) so reload and shared links keep the same words. No match means the full word list (`ALL_SCOPE = "all"`). Hydration is guarded to run once (StrictMode double mount). Static export needs a Suspense boundary around `useSearchParams`; the route files provide it.

### Test mode

Grading directions (`lib/settings.js`): `w2d` shows the word and the learner types the definition; `d2w` shows the definition and the learner types the headword. Default is `w2d`.

Normal (`lib/pool.js`, `components/test/engine.js`):
- Visible pool of 5 unmastered words drawn at random without repeats (`crypto.getRandomValues`, injectable rng for tests). Constants: `POOL_SIZE = 5`, `WORD_STREAK_TO_MASTER = 4`. Do not change them.
- Four correct answers in a row masters a word. It leaves the pool and a random unmastered word outside the pool replaces it. A miss resets the streak, shows the full answer card, and asks the same word again.
- Streaks are zeroed at every session start (`clearScopeStreaks`); mastery and completions are kept.
- A scope with every word mastered shows the completion screen and counts one completion. A reset of a finished scope starts the next round; the pack row keeps showing its best mastery.
- Choose Words picks a subset of the pack and runs it inside the pack's own scope; the pack is credited only when all its words are mastered.

Harder (`lib/hard-scheduler.js`): the whole selection is in play at once. A word right on its first draw is retired. A miss needs `HARD_RELEARN_CORRECT = 2` more correct answers. An unretired word sits out `HARD_COOLDOWN_CARDS = 3` other cards. Runs are saved after every answer in `gv_hard_<dir>` and can be resumed. Harder never reads or writes `gv_progress_*`. Words it retires are enrolled in Daily review. A `?mode=normal|harder` query overrides the stored difficulty and is saved.

Grading (`lib/matching.js`, threshold `WORD_DICE_THRESHOLD = 0.6`):
- `w2d`: Dice coefficient over character bigrams, whitespace removed, lowercased, compared to the short `definition` (not `fullDefinition`). This is the original grading and must not loosen.
- `d2w`: trailing punctuation dropped, case and spacing folded; headwords of 4 characters or fewer need an exact match, longer ones need Dice >= 0.6. A typed answer that is exactly another headword is accepted only if that word's definition is a near-duplicate of the target's (`gradeHeadwordWithNearDuplicates`, negation guard in `lib/distractors.js`).

### Multiple choice (Practice, Learn)

Four options, keys 1 to 4. Distractors come from the scope first (`lib/distractors.js` `pickDistractors`), topped up from the full list, and never include a near-duplicate definition, a shared root, or a listed confusable pair. A wrong answer's automatic advance waits at least 3 seconds (`WRONG_MIN_SECONDS`) regardless of the delay setting.

### Daily review

`lib/review.js`, stored in `gv_review_<dir>`. A word enrolls the first time it is mastered anywhere (Normal or Harder, any pack or selection). Ladder in days: `[1, 3, 7, 14, 30, 60, 120]`. A first-try correct answer in a session moves one step up (top step repeats); a miss returns to 1 day and the word must be answered correctly before the session ends, after `REVIEW_RETRY_GAP = 3` other cards. Only a word's first answer in a session moves the schedule. Cap is 50 words per day per direction by default (`DEFAULT_REVIEW_CAP`). Days are local calendar days (`YYYY-MM-DD`). Existing mastery is seeded once across 14 days. Review never touches pack mastery.

## Data schema

`src/data/gre_combined.json` is an object keyed by headword (capitalized, e.g. `"Abate"`), tab-indented, in A to Z order. Every entry has exactly:

```json
"Abate": {
  "definition": "to lessen",
  "alts": ["to diminish", "to subside", "to decrease"],
  "example": "Once the antibiotics kicked in, her fever began to abate ...",
  "fullDefinition": "Abate means to diminish in intensity, degree, or amount ...",
  "pos": "verb",
  "tier": 1
}
```

- `definition`: short lowercase gloss of 1 to 3 words, no trailing period, never using the headword or its root; the multiple-choice option text and the `w2d` typed answer.
- `alts`: 1 to 3 alternative answers of 1 to 4 words each (same root rule), also accepted in `w2d`.
- `example`: one sentence containing the headword or an inflection (used by In Context, so it must stay blankable).
- `fullDefinition`: longer explanation shown on the answer card.
- `pos`: `noun | verb | adjective | adverb`.
- `tier`: `1` core (high frequency), `2` common, `3` advanced.

`lib/words.js` exposes frozen entries `{ word, definition, fullDefinition, example, pos, tier }` in file order. Entry count at the last check was 1,476 (tier 1: 481, tier 2: 788, tier 3: 207). Never hardcode a count in copy; take it from `src/data/home.json` or from the data.

`npm run vocab:validate` enforces: no missing or empty fields, valid `pos` and `tier`, the `definition` and `alts` rules above, no case-insensitive or raw duplicate keys, meaning groups (`src/data/meaning-groups.json`) whose words all exist, share one `pos`, and belong to no other group, no identical definitions outside a common meaning group, every legacy-index entry exists, every pack word exists. It warns on near-duplicate definitions outside a common group and on examples missing the headword.

### Frozen legacy index

`src/data/legacy-index.json` is the pre-overhaul key order (679 headwords). **It is frozen. Never regenerate, re-sort, edit or append to it**, and never derive it from the current `gre_combined.json`. It exists only so old `?pack=12,45,...` links, the `marketplaceWordpack` handoff and the `indices` field on the 12 classic packs keep resolving to the same words they always did (`resolveLegacyIndices` in `lib/words.js`). `validate-vocab` fails if an entry in it is missing from the data, so removing a word from `gre_combined.json` that is in the legacy index is a build failure by design.

## Packs pipeline

Source of truth: `src/data/packs-manual.json` (hand-written themed packs and the 12 classic packs). Generator: `scripts/build-packs.js`. Outputs, both generated, **never hand-edit**:
- `public/data/wordpacks.json` (served at `/data/wordpacks.json`)
- `src/data/home.json`: `words`; `packs` (total and counts by category); `tiers` (`[{ tier, label, words, packs }]` for Core, Common, Advanced); `sample` (five entries for the home try-it card, each carrying its `alts` so the card grades like Test mode); `marquee` (up to 32 `{ headword, definition }` pairs from tiers 1 and 2 in a fixed hash order, used by the home marquee and hero canvas).

`scripts/build-packs.js` runs `main()` only when executed directly (`require.main === module`); it exports `buildHome` and `HOME_PATH` so tests can import it without regenerating files.

`npm run build` runs `prebuild` first: `npm run packs:build && npm run vocab:validate`. Either failing stops the build. Run `npm run packs:build` yourself after changing `packs-manual.json` or the vocabulary.

Pack shape: `{ id, title, desc, category, tier?, order?, likes?, indices?, words }`. `words` are headwords. Categories: `path`, `theme`, `classic`.
- `path`: generated learning path, about 25 words per pack, grouped by tier (Core, Common, Advanced), ids like `path-core-01`. Titles read "Core 1 of 19" (tier label, position, number of packs in that tier), so they change when a tier gains or loses a pack; ids do not. On `/wordpacks` the Learning path section is split under tier headings ("Core Set", "Common Set", "Advanced Set", from `tierHeading` in `components/packs/packUtils.js`, grouped by `pathTiers`). Membership is stable: a word already in a path pack stays there, new words fill the tier's last pack then open new ones, removed words just leave. Ids never change, because progress is keyed by pack id.
- `theme`: curated, 15 to 30 words each, from `packs-manual.json`.
- `classic`: the 12 pre-overhaul packs. They keep their ids and likes and gain `indices` computed against the frozen legacy index.
- Limits: at least 5 words per pack, title at most 48 characters, description at most 100. The build fails on unknown or repeated pack words, duplicate ids, a bad category, and a classic word missing from the legacy order.
- Keep `lib/packs.js` constants (`PACK_CATEGORIES`, `MIN_PACK_WORDS`, `MAX_TITLE_LENGTH`, `MAX_DESC_LENGTH`) in step with the script.

Current output: 99 packs (59 path, 28 theme, 12 classic), per `home.json`. Custom packs are created in the browser (`PackBuilder`), stored in `gv_custom_packs`, and are not part of the build.

`npm run sort:vocab` is safe for packs now because they use headwords, but it rewrites the vocab file; run `packs:build` and `vocab:validate` after it. It must never touch `legacy-index.json`.

## Storage

All persistence is `localStorage` through `lib/storage.js`, the only file that touches it. It is SSR-safe, wraps every access in try/catch (blocked or full storage reads as empty and writes as no-ops), and stores JSON. Every key this app writes starts with `gv_`. Read storage in effects after mount, never during render, so the static HTML and first client render match. `<dir>` is `w2d` or `d2w`; progress is kept per direction.

| Key | Shape |
|---|---|
| `gv_settings` | `{ direction, testDifficulty, advanceDelay, feedbackSounds, playBackground, pagesBackground }`. See Settings. |
| `gv_progress_<dir>` | `{ scopes: { <scopeId>: { mastered: [headword], streaks: { headword: 1..3 }, completions: { count, records: [{ at, accuracy, answered, size, backfilled }], credited }, round: 1.., known: [headword] } } }`. `mastered` is the current round; `known` is mastery from earlier rounds; `best` shown on pack rows persists across rounds. Records are capped at 50, the count is not. |
| `gv_hard_<dir>` | `{ scopes: { <scopeId> or <scopeId>#subset: { run, count, runs } } }`. `run` is the scheduler's saved state (resumable) or null; `runs` are finished-run records (capped at 50); `count` is completed runs. A subset run resumes only for the exact same word set. |
| `gv_review_<dir>` | `{ seeded: bool, words: { headword: { interval, due: "YYYY-MM-DD" } }, day: { date, reviewed } }` |
| `gv_last_pack` | `{ id, title, words: [headword] }`. Drives the home Continue card. Ad-hoc selections are never stored. |
| `gv_custom_packs` | `[{ id: "custom-...", title, desc, words, category: "custom", createdAt, updatedAt }]` |
| `gv_favorites` | `{ version: 1, ids: [packId] }`. Replaces the old like counts. |
| `gv_practice_pos` | `{ <scopeId>: index }`. Practice mode's saved position, a non-negative integer per scope. |

A scope id is a built-in pack id, a `custom-` id, or `all`. Pack ids are stable; progress never refers to a pack by position.

Test difficulty is not a key of its own any more: it is `gv_settings.testDifficulty` (`"normal"` or `"harder"`, anything else reads as `"normal"`).

### Legacy keys (migrated or cleared)

| Legacy key | Handling |
|---|---|
| `gv_test_difficulty` | Moved once into `gv_settings.testDifficulty` by `loadSettings` (an existing value in `gv_settings` wins), then removed. |
| `wp_upvote_ledger_v2` (`{ packId: true }`) and `wp_likes:<packId>` (count) | Copied into `gv_favorites` on the first `loadFavorites()` when `gv_favorites` does not exist. Left in place; the existence of `gv_favorites` marks the migration done. |
| `marketplaceWordpack` (array of integer indices) | One-time handoff from the old Word Packs page. `resolvePackContext` always reads and deletes it, resolves it through the frozen legacy index, and accepts it only on the first resolve of a page load. |

Reset all (`resetAll` in `lib/progress.js`) clears every `gv_` key and the legacy keys `wp_upvote_ledger_v2` and `marketplaceWordpack`, so nothing can be migrated back in.

Backup file (`exportProgress` / `prepareImport` / `applyImport`): `{ app: "grevocabtester", version: 1, exportedAt, data: { <gv_ key>: value } }`. Import validates and normalizes before writing, writes only keys in the file, and ignores foreign or unknown content.

## Settings

`lib/settings.js`, edited on `/settings` and from mode headers. Every value is coerced on read, so a corrupt store can never select an option that does not exist. `saveSettings(patch)` is read-merge-write of a patch and dispatches `gv-settings-change` on `window`, which the background layer and open modes listen for.

| Field | Values | Default |
|---|---|---|
| `direction` | `w2d`, `d2w` | `w2d` |
| `testDifficulty` | `normal`, `harder` | `normal` |
| `advanceDelay` | `0.5`, `1.5`, `3`, `5` seconds, or `"manual"` | `1.5` |
| `feedbackSounds` | boolean (`public/sounds/yesmp3.mp3`, `nomp3.mp3`) | `true` |
| `playBackground` | background id, used on `/play/*` | `warp` |
| `pagesBackground` | background id, used everywhere else | `fireflies-red` |

Background ids: `warp`, `constellation`, `liquid` (WebGL), `fireflies`, `fireflies-red`, `halftone`, `grid`, `rain`, `aurora`, `ember`, `plain`.

## Background layer and bus API

`components/Background.jsx` is mounted once in `app/layout.jsx`. It renders nothing on the server or first render, honors reduced motion (one static frame), pauses on a hidden tab, and falls back on failure (`liquid` to `fireflies`, anything else to `plain`) behind an error boundary. It is a fixed layer at `z-index: -1`; pages must not paint their own full-page background. Modules live in `lib/backgrounds/`, the engine in `engine.js`.

Components talk to it only through `lib/backgrounds/bus.js`. Every call is a safe no-op when nothing is mounted or on the server.

- `bgEvent("ok" | "bad" | "master")`: answer reaction. Anything else is ignored.
- `setBgHeat(value)`: 0 to 1, clamped; the current word's streak. Non-numbers become 0.
- `setBgOrigin(x, y)`: viewport pixels effects radiate from. Non-numbers reset to the default (centre, 45% down).
- `getBgWords()`: read-only copy of the current word list.
- `setBgWords(list)`: strings or `{ word, mastered, current }` objects, deduplicated, at most 200. `mastered` lights a word green, `current` marks the word being asked.

## Scripts and testing

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on port 3010. |
| `npm run build` | `prebuild` (packs:build, vocab:validate) then `next build` into `out/`. |
| `npm run packs:build` | Regenerate `public/data/wordpacks.json` and `src/data/home.json`. |
| `npm run vocab:validate` | Dataset and pack integrity checks (exit 1 on errors). |
| `npm run vocab:stats` | Counts by tier, pos, tier by pos, first letter. |
| `npm run sort:vocab` | A to Z sort of `gre_combined.json`. Re-run packs:build and vocab:validate after. |
| `npm run generate:images` | Resize source PNGs in `public/images` into icons and banners (uses `sharp`). |
| `npm run assets:render` | Render OG image and PWA icons with headless Edge via Playwright (`npx`). |
| `npm test` | `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test "tests/**/*.test.mjs"` |

**Node 22.15 or later is required.** `scripts/validate-vocab.js` uses `module.registerHooks` (added in Node 22.15) to load `lib/` modules, and `npm test` relies on `node --test` accepting a glob pattern. The `package.json` has no `engines` field, so this is not enforced by npm. The quoted glob is deliberate: the shell must not expand it.

Tests (`tests/*.test.mjs`, `node:test`, no browser) cover matching, distractors, pool, hard scheduler, review ladder, progress and storage (including migration, export/import, reset), packs and pack context, word lookup, In Context blanking, and Test mode helpers. They use an in-memory storage stub. Logic that matters belongs in `lib/` so it can be tested there; add a test with any change to grading, scheduling, storage shapes or migration.

## Deploy

- Static export: `next build` writes the whole site to `out/` (git-ignored). `images.unoptimized: true`. API routes, middleware, `headers()` and rewrites cannot run in a static export and must not be added.
- `public/_headers` carries the security headers (nosniff, referrer policy, `X-Frame-Options: DENY`, permissions policy, and a CSP allowing only same-origin resources plus inline script and style). It is honored by hosts that read the Netlify/Cloudflare `_headers` format. Any new external origin (fonts, analytics, images) must be added to the CSP or it will be blocked.
- Host: the `.gitignore` comment says Cloudflare Pages rebuilds `out/` on every push, but there is no wrangler config or CI file in the repo, so Cloudflare Pages is **unconfirmed**. Do not write host-specific claims into code or copy.
- SEO: `metadataBase` is `https://grevocabtester.com`; per-route canonicals are set in route layouts; `robots.js` and `sitemap.js` are static. The sitemap lists the play routes.

## Design and copy rules

The product must read as a professional GRE prep service.
- Dark theme, `--bg: #050505`, coral `#ea5746` accent, blue `#64b5ff` focus/accent. Tokens are in `styles/globals.css`; shared buttons, pills, segmented controls and bars are in `styles/ui.css`.
- No emoji anywhere in the UI or copy. No em dashes in copy or comments; use a comma, colon, period or parentheses.
- Professional tone. No slang ("grind", "vibe", "no fluff"). Plain, direct sentences.
- Every claim in copy must be true of the app: derive counts from data, and do not say "spaced repetition" about Test mode (only Daily review schedules by interval). Do not claim accounts, sync across devices, or server-side saving: progress is local to the browser.
- Destructive actions use the red dialog tone and a focused Cancel button; neutral actions (restart, start next round) do not. Never use `window.confirm()`.
- Do not add Tailwind. Do not change mastery 4, the pool of 5, or the 0.6 Dice threshold.

## Lessons learned

Carried over from `design/overhaul/wortschatz-inventory.md` and still applicable here.
- Reference words by headword, never by array position, and give every pack a stable id. Progress is keyed by pack id, so renaming or re-cutting a published pack drops learners' progress.
- Give Harder its own storage. Letting it write Normal's streaks and mastery corrupted both.
- Streaks are per run. Restoring saved streaks into a fresh random pool shows words at 2/4 before they are asked.
- Count a completion once. Credit only when not already credited, so reloads and re-renders cannot double count; mark migrated records as backfilled rather than inventing timestamps.
- Decide one rule per displayed number (per direction or combined) before building UI. Mixing the two made rows contradict each other.
- Draw pools and refills at random through an injectable rng, never in render. A deterministic pool always taught the same first word.
- Animations are overlays and never delay the advance. The last "Mastered" feedback must still show before the completion screen.
- Guard held and double Enter (`e.repeat` plus a synchronous lock), or an autorepeating key grades a blank answer in the next prompt.
- Guard every consume-once read with a run-once ref. StrictMode's second mount otherwise finds nothing and drops the pack.
- Coerce every setting enum on read, and save settings as a read-merge-write patch so a stale component copy cannot overwrite a setting it never changed.
- Hide header parts that depend on storage until after hydration; the static HTML is built with defaults and would flash them.
- Use `overflow-x: clip` (with `hidden` only as fallback) on `html`/`body`; `hidden` turns the body into the scroll container and breaks scroll restore and sticky toolbars.
- A background mounted on every page must never crash the app: guard canvas and DOM calls, fall back to a simpler background, render nothing on the server. The bus holds one global sink, so a contained settings preview can unseat the page background's sink; verify answer reactions still fire after navigating from `/settings` into a mode.
- Detect duplicate keys on the raw JSON text; `JSON.parse` silently keeps the last one.
- Content collisions are grading bugs: two entries with identical or near-identical definitions make one word's answer accept for another. Run `vocab:validate` on every content change.
- Anchor `.gitignore` patterns (`/review/`, not `review/`) so they cannot shadow a route directory.
