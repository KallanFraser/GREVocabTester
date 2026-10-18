# GRE Vocab Tester overhaul: planning handoff

Built 2026-10-18 from three inputs, all read in full:
- `design/overhaul/gre-current.md` (GRE inventory at `a38a129`; cited below as **GC**)
- `design/overhaul/gre-data.md` (data audit; **GD**)
- `design/overhaul/wortschatz-inventory.md` (Wortschatz at `78b3540`; **WI**, item numbers are WI's)

Input check: none of the three files contains "WRONG REPO" or "WORTSCHATZ NOT FOUND". GC confirms the repo is GRE (`package.json` name `grevocabtester`). WI identifies Wortschatz as `C:\Users\Kallan-Daily\Documents\GitHub\Learning-German`.

Paths are GRE-relative unless prefixed `WS:` (Wortschatz root). Nothing here was re-verified against code; facts are as the inputs report them, and "unverified" marks inputs' own caveats.

---

## 1. GRE today in brief

**Stack.** Next 15.5.14 (declared ^15.3.4), React 19.1, `output: "export"`, plain CSS, JSX components, no tests, no lint, no analytics, no third-party embeds. Deploys (inferred, not configured in repo) to Cloudflare Pages from git; `.gitignore:7` says Pages rebuilds `/out`. Live domain `https://grevocabtester.com`. No `wrangler.*`, `public/_headers`, `_redirects`, Node pin or CI exists. (GC §1)

**Routes.** `/` (landing), `/wordpacks`, `/play/test`, `/play/practice`, `/play/learn`, `/robots.txt`, `/sitemap.xml` (5 URLs). Each of the four non-home pages has a metadata-only `layout.jsx` with its own canonical. `POST /api/feedback` and `POST /api/wordpacks/create` compile but are **not exported** (`out/api/` absent), have no UI caller, and cannot run on the static host. `middleware.ts` does **not** exist, though CLAUDE.md describes it. (GC §1, §2)

**Modes.** (GC §4)
- **Normal Mode** `/play/test` (`components/TestMode.jsx`, 378 lines): type the definition; Dice (`string-similarity`) >= 0.6 against `definition` only; 5-word rotating subset drawn with replacement; mastery = 4 consecutive correct, miss resets to 0; mastered slot is swapped for a fresh word; no end state, loops forever. Wrong answer shows the definition plus `fullDefinition` and `example`; the user stays on the word until correct. Correct plays `yesmp3.mp3`, advances after 1.5 s. Enter submits.
- **Flash Cards** `/play/practice` (`PracticeMode.jsx`): sequential A to Z, always starts at word 0, 4-option multiple choice, advances after 1.2 s, no mastery, no sound, no number keys, ignores packs.
- **Random Flash** `/play/learn` (`LearnMode.jsx`): fully shuffled each question (`crypto.getRandomValues`), 4 options, advances after 2.0 s, repeats allowed, ignores packs.
- Core constants CLAUDE.md forbids changing: mastery = 4, threshold 0.6, subset = 5.

**Landing page** (`app/page.jsx`, client component, 13.9 KB, all sections inline): hero, three mode tiles with real screenshots, problem/solution, story ("160 score"), word list, trust band ("8,000+ monthly active users", unbacked by analytics), CTA, footer. Keys 1/2/3 jump to modes. Only JSON-LD on the site is here (`WebApplication`).

**Not implemented despite copy.** "Adaptive", "spaced mastery tracking", "trusted by thousands" (no spacing algorithm); "build and share your own" packs (no create UI); "typo-tolerant" (it is fuzzy definition matching, not spelling tolerance). (GC §2)

**Styling.** Plain CSS: `globals.css` (tokens), `components.css`, `home.css` (coral, scoped to `#home-landing`), `menu.css`, `navbar.css`, `wordpacks.css`. Palette is split: play pages use blue `--accent #64b5ff` on `#000`; home and wordpacks use coral `#ea5746` on `#050505`. Inter is named in the font stack but never loaded. No `--ok`/`--bad`, no reduced-motion reset. Duplicate and dead rules exist (GC §3).

**Persistence.** Two `localStorage` keys, neither holding learning progress. Mastery, subset, Choose Words selection and card position are React state only and are lost on reload. (GC §5; full text in section 2.)

**UI rules to keep (CLAUDE.md).** Professional copy, no slang, no emoji in chrome, no Tailwind, don't break static export. GC notes existing violations: the correct/incorrect check and cross emoji (`TestMode.jsx:213,243`) and the heart on the like button (`wordpacks/page.jsx:126`).

**State of the tree.** `main`, clean. Tooling gaps: `axios` unused; `sharp` does not load on the win32-arm64 dev machine so `npm run generate:images` fails here; `package.json` has boilerplate (`main: index.js`, empty description). Stray root `globals.css` holds three Stripe Payment Link URLs and is not CSS. (GC §1, §3)

**CLAUDE.md is stale.** GC §11 lists 15 contradictions. Material ones: describes a nonexistent `middleware.ts`; says `out/` is committed (gitignored, 0 tracked); says `metadataBase` unset and OG dims wrong (both fixed); says logo is 1.16 MiB favicon (fixed: `favicon.ico`, `apple-touch-icon.png`, `og-image.png` 1200x630, WebP banner); says packs have `createdAt`/`authorIpHash` (they do not; they have `words`). Treat CLAUDE.md as unreliable until rewritten.

---

## 2. Persistence keys and value shapes (verbatim)

### 2a. GRE keys today (GC §5, copied verbatim)

The only storage API used is `localStorage`. **No `sessionStorage`, `document.cookie` or `indexedDB` exists in the current source or in any commit** (grep over current source; `git grep` over `git rev-list --all`).

| Key | Value shape | Written | Read / removed | Lifetime |
|---|---|---|---|---|
| `wp_upvote_ledger_v2` | JSON object `{ "<packId>": true, … }`. Pack ids are strings such as `"gre-elite-30"`. Only `true` values are ever written. | `app/wordpacks/page.jsx:63-67` (`onUpvote`; `LEDGER_KEY` const at line 7) | `app/wordpacks/page.jsx:16-23` (parsed on mount; falls back to `{}` on error) | Permanent. It marks "liked" (aria-pressed and the title text) and blocks a second like. **The like count itself is not persisted**: `likes` increments only in React state (62), so after a reload the count goes back to the JSON value while the heart stays "pressed". A `// TODO: POST to API` comment sits at line 68. |
| `marketplaceWordpack` | A JSON array of integers, the pack's `indices`, e.g. `[12,57,301]` | `app/wordpacks/page.jsx:75` (`PACK_KEY` const at line 8) | `components/TestMode.jsx:100` (read) and `:126` (always removed in `finally`) | One-shot handoff from `/wordpacks` to `/play/test`. If the user never reaches `/play/test`, the key lingers and gets applied on the next unrelated visit to `/play/test`. |

**Historical key (removed):** `wp_likes:<packId>` held a stringified number counting local likes. It was added in commit `a8b1b55` ("Works", `Client/app/wordpacks/page.jsx:9-13`) and replaced by `wp_upvote_ledger_v2` in `ad192e9` ("Major Update"). Long-time users may still have `wp_likes:*` keys in their browsers. No code reads them now. No `wp_upvote_ledger` v1 key ever existed in git history (pickaxe search).

**What is NOT persisted** (everything a user might think of as "progress"): `masteryCounts`, `activeSubset` and `activeKeys` (Choose Words) in `TestMode.jsx:14-29`; `currentIndex` in `PracticeMode.jsx:11`; scores of any kind.

**Migration implications (GC §5, verbatim).**
- Preserve `wp_upvote_ledger_v2`. It is keyed by pack `id`, so keep the pack ids stable.
- Optionally fold `wp_likes:*` (value > 0 means liked) into it.
- Keep accepting a `marketplaceWordpack` index array on first load for one-shot handoffs already in flight, mapped through the *current* key order.
- Old `?pack=` CSV-index URLs and `?id=` URLs may be bookmarked or shared. `?pack=` indices are positional, so freeze a snapshot of the current 679-key order to resolve them after any vocabulary change.

**URL inputs to Normal Mode (GC §4):** `?pack=1,5,9` (CSV indices, filtered to `0 <= n < 679`) and `?id=<packId>` (fetches `/data/wordpacks.json`, `cache: "no-store"`, hydrates from `indices`). Order of precedence: `marketplaceWordpack` key, then `?pack=`, else `?id=`. `/wordpacks` sets both the key and `?id=`, so the pack is applied twice and the game resets twice.

### 2b. Wortschatz storage key map (WI, copied verbatim)

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

**Scope ids (WI):**
- `default` (global feed)
- `pack:<id>`
- `pack:custom`
- `<scope>:sentence`
- `<scope>#subset` (Harder only)
- `phrases:default` is German-only legacy; skip it.

**Per-key detail worth knowing (WI items 7, 19, 20, 32, 43, 48, 49):**
- Scope record: `{mastered, streaks, completions:{count, records[{at, accuracy, answered, backfilled}], credited}, round, known}`. `best = count > 0 ? total : roundMastered`.
- `dv_hard_<dir>` = `{scopes:{<scopeId>[#subset]:{run, count, runs:[{at, firstTryPct, totalWords}]}}}`; never touches `dv_progress_*`.
- `dv_review_<dir>` = `{seeded, words:{k:{interval,due}}, day:{date,reviewed}}`.
- `dv_counts` = `{version:1, normal:{scopeId:n}, hard:{scopeId:n}}`.
- `dv_last_pack` = `{id,title,type,keys}`; `dv_pack` = `{id, keys, type}`.
- `dv_sound` is a separate key because play modes write a stale copy of `dv_settings` (L25).
- Export file shape: `{version:1, exportedAt, dv_settings, dv_practice_pos, dv_progress_*, dv_review_*, dv_hard_*}`; not exported: `dv_counts`, `dv_sound`, `dv_pack`, `dv_return`, `dv_last_pack`.
- Reset all removes `dv_progress_*`, `dv_review_*`, `dv_hard_*`, `dv_practice_pos`, `dv_pack`, `dv_counts`; keeps `dv_settings`, `dv_sound`, `dv_last_pack` (bug L3), `dv_return`.

**Consequence for planning.** Because GRE persists no progress today, there is no learning data to migrate. The only data at risk is the like ledger, in-flight handoffs, and URLs (section 7).

---

## 3. Word packs backend and flows

**Storage (GC §6, GD §1b).** Static file `public/data/wordpacks.json`, an array of 12 packs, shipped as `out/data/wordpacks.json`. Fields on all 12: `id, title, desc, indices, likes, words`. No `createdAt` or `authorIpHash`. `words` is a human-readable mirror of `indices`, never read by code. Packs reference words by **array position** in `Object.keys(gre_combined.json)`.

Example:
```json
{
  "id": "argument-verbs",
  "title": "Argument & Rhetoric Verbs",
  "desc": "Verbs that appear in RC/SE arguments.",
  "indices": [21, 90, 121, 132, ...],
  "likes": 108,
  "words": ["Advocate", "Bolster", "Coalesce", ...]
}
```

**Inventory (id: words / likes).** argument-verbs 21/108, process-change 18/96, emotion-spectrum 10/88, people-traits-pos 12/77, people-traits-neg 22/101, style-register 16/85, verbal-attacks 15/84, learning-intellect 10/90, gre-elite-30 28/150, power-P 25/73, power-S 30/70, power-G 11/62. Sizes 10 to 30; together 178 of 679 words. Largest index 668. No duplicate indices; some words shared across packs by design.

**Consistency (verified by both inputs with node).** `words[i] === Object.keys(vocab)[indices[i]]` for every entry of every pack (0 mismatches). That makes `words` a safe key for migrating packs to headword keys. Title/size mismatches: "GRE Elite 30" has 28 words, "Power G - 20" has 11.

**Flows (GC §6).**
1. `/wordpacks` loads the JSON with `fetch(..., {cache:"no-store"})`, coerces fields, filters indices to non-negative integers, sorts by likes desc then title.
2. Click on card, "Use this pack", or Enter on a focused card: store `indices` in `localStorage.marketplaceWordpack` and navigate (full page load) to `/play/test?id=<id>`.
3. `TestMode` hydrates from the key (always removed in `finally`), else `?pack=` CSV, else `?id=` fetch. Fewer than 5 resolved words are topped up randomly. Out-of-range indices are silently skipped.
4. **Normal Mode only.** Flash Cards and Random Flash ignore packs.
5. Upvote: client-only; `likes` increments in React state and is lost on reload; ledger in `wp_upvote_ledger_v2` blocks a second like. Like counts in the JSON are hand-edited. There is no server.
6. Create: `POST /api/wordpacks/create` is not deployed and has no UI (validation: title <= 48, desc <= 100, >= 5 indices deduped to ints in 0..9999, 11-word profanity filter, 5-per-IP cap in memory and by salted hash, writes to disk and prepends to the JSON, does not write `words`). It also does not check that indices are real words (GD §4). Its salt defaults to `"dev_salt_change_me"`.

**What breaks positional indices (GD §5).**

| Change | Effect |
|---|---|
| Add a word at the end | Safe |
| Add a word anywhere else (including by re-sorting) | Every later index shifts; all packs silently point at neighbours, no error |
| Remove a word | Same shift; trailing indices go out of range and are dropped |
| Re-sort (`npm run sort:vocab`) | All 12 packs scramble. The file is already sorted so it is a no-op today, but not after any insertion |
| Rename a key (`Peurile`, `Cavo;`) at the same position | Safe for indices; `words` mirror goes stale (cosmetic) |

Also order-dependent: `?pack=` shared URLs, `marketplaceWordpack`, the Choose Words list, and the `Word #n / N` labels.

**Wortschatz target model (WI items 15 to 24).** Packs hold headword keys; `data/packs-manual.json` is hand-curated; `scripts/build-packs.js` (npm `prebuild`) appends deterministic `gen-` packs (frequency bands, review parts) and writes `public/data/packs.json`, which is never hand-edited; ids are append-only and enforced by `checkAppendOnly`; categories and integer priorities are validated; `MIN_PACK_KEYS = 5`. The WS pack list has Up next panel, learning path, search, status filters, sort, collapsible categories, Normal and Harder rails, medals, rounds.

---

## 4. Data facts and quality numbers

**Files (GD §1).** `src/data/gre_combined.json` (object keyed by headword; tab-indented, CRLF, 192,437 chars) and `public/data/wordpacks.json`. No CSV or other lists. No scripts for ingestion, dedupe or validation exist; `sort-gre-combined.js` is the only vocab script.

**Shape.** 679 entries (JSON.parse and 679 raw key lines agree, so no silent duplicate-key collapse). Each has exactly `definition`, `example`, `fullDefinition`, all non-empty strings (679/679). First key `Abate`, last `Zealot`, already A to Z. **No** id, rank, frequency, part of speech, tags, difficulty, source or synonym-group field.

**Who reads what.** `definition` everywhere; `example` and `fullDefinition` only in `TestMode` (falls back to `""`).

Real entry:
```json
"Mitigate": {
  "definition": "to lessen severity.",
  "example": "Planting trees can mitigate the urban heat-island effect in big cities.",
  "fullDefinition": "To mitigate is to make a situation, condition, or consequence less severe, harmful, or painful through remedial action."
}
```

**800 vs 679.** 679 is real. "800" is hard-coded in `app/layout.jsx:12,32,49` (description, OG, Twitter), `app/page.jsx:33` (JSON-LD), `:284` (copy) and `:319` (trust stat). Play pages derive 679 from the data. The word-count label in Practice/Learn is the alphabetical position, meaningless in random order.

**Quality numbers (GD §2).**

| Check | Result |
|---|---|
| Case/whitespace duplicate headwords | 0 |
| Missing definition / example / fullDefinition | 0 / 0 / 0 |
| Definition length (chars) | min 6, p10 17, p25 20, median 25, p75 31, p90 37, max 58, mean 26.1 |
| Length buckets 0-9 / 10-19 / 20-29 / 30-39 / 40-49 / 50+ | 6 / 149 / 302 / 177 / 40 / 5 |
| Single-word definitions | 19 |
| Definitions lacking a final period | 3 (`Commensurate`, `Obviate`, `Prolific`) |
| Definitions containing the headword | 0 true hits; 8 same-root hints, `Acquisitive` and `Penitential` the most give-away |
| Corrupted / misspelled keys | `Cavo;` (probably *cavil*), `Peurile` (puerile), `Ecomium` (probably *encomium*, not checked further) |
| Part of speech | absent (0/679); only hint is the "to ..." prefix on verbs |
| Verbatim identical definitions | 6 pairs (12 words) |
| Token-set Jaccard 1.0 | 10 pairs; >= 0.7: 12 pairs; >= 0.5 non-identical: 25 more; total >= 0.5: 35 |
| Pack coverage | 178 of 679 words in at least one pack |

**Identical-definition pairs:** Brook/Stand "to tolerate or endure."; Decorum/Propriety "proper behavior."; Deride/Guy "to mock or ridicule."; Exculpate/Exonerate "to clear from blame."; Fervent/Fervid "intensely passionate."; Indigence/Penury "extreme poverty." Further Jaccard 1.0: Appease/Placate, Dearth/Paucity, Neophyte/Tyro, Impermeable/Permeable (antonyms, false positive but confusing). Common-word or multi-sense headwords: `Guy`, `Stand`, `Brook`, `Novel`, `Appropriate`, `Thrift`.

**Distractors (GD §6).** Uniformly random, no POS, length or semantic matching, and no exclusion of identical definitions. Two literally identical options can appear with only one marked correct, so a correct user is marked wrong. Probability roughly 0.4% per question for the 12 involved words. Grammar and length give away answers (verb "to ..." definitions among nouns; the longest option is often right). Learn mode has no no-repeat history.

**Provenance and licence (GD §4).** No source is named; no data licence or attribution; no LICENSE or README. `package.json` says ISC for the package only. Copy claims "past papers and reputable prep sources, deduplicated and normalized", with no tooling behind it. The example and fullDefinition prose reads as LLM- or author-written (inference only; typos like `Cavo;` look like generation artifacts). The "past papers" claim cannot be verified from the repo.

---

## 5. Gap table

Tags: `PORT` applies as is; `ADAPT` needs a GRE equivalent; `SKIP-AUDIO`; `SKIP-GERMAN`. Item numbers are WI's. "GRE status" is from GC/GD.

| Feature | Wortschatz files | GRE status | Tag |
|---|---|---|---|
| Shared UI kit (buttons, pills, seg, bar, tags, select, kbd) (1) | `styles/ui.css`, `settings.css` (`.switch`), `dialog.css` | No shared kit; per-page styles | PORT |
| Design tokens, `#050505` bg, reduced-motion reset (2) | `styles/globals.css:3-47,78-83` | Partial tokens; no `--ok`/`--bad`, line, type scale or reduced-motion; palette split blue vs coral | PORT |
| Navbar active underline, burger <= 760px, `/play` hidden (3) | `components/Navbar.jsx`, `styles/navbar.css` | Hides on `/play*`; no active state, no burger, mixes `<a>` and `Link` | PORT |
| Root layout shell, `next/font`, thin play wrappers (4, 54) | `app/layout.jsx`, `app/play/*/page.jsx` | Inter not loaded; wrappers exist; two global CSS imports re-imported per page | PORT |
| Derived counts on home (5) | `app/page.jsx:24-29` | "800" hard-coded vs 679 real | PORT |
| Playable try-it card (6) | `app/page.jsx` `TryIt` | Absent | ADAPT |
| "Pick up where you left off" (7) | `ContinueCard`, `lib/progress.js` (`dv_last_pack`) | Absent; no progress to resume | PORT |
| CSS mock-up mode tiles, featured Test tile (8) | `app/page.jsx`, `styles/home.css:353-719` | Real screenshot PNGs (will go stale) | ADAPT |
| Home keyboard shortcuts with guards (9) | `app/page.jsx:42,198-208` | Keys 1/2/3, no modifier or form-field guard documented | PORT |
| Return path and scroll restore (10, 21) | `lib/progress.js:829-938`, `lib/use-return-scroll.js` | Back button does `location.href="/"` | PORT |
| Animated background engine and registry (11) | `lib/backgrounds/*`, `components/Background.jsx`, `styles/backgrounds.css` | Absent; page-level glows must be stripped | PORT |
| Background bus (12) | `lib/backgrounds/bus.js`, `state.js` | Absent; rename `de` field to `word` | PORT |
| Play and Pages background settings with previews (13) | `components/BackgroundPicker.jsx` | No settings page | PORT |
| Background word sources (14) | `lib/backgrounds/sources.js` | No `packs.json` of all words | ADAPT |
| Word Packs list, Up next, learning path, toolbar (15) | `app/wordpacks/page.jsx`, `components/UpNext.jsx`, `PackList.jsx`, `PackRow.jsx`, `lib/packs.js`, `styles/pack-list.css` | Card grid of 12 packs sorted by likes; no ordering/rank for bands | ADAPT |
| Categories (16) | `lib/packs.js:16-23`, `scripts/lib/pack-categories.js` | None | ADAPT |
| Equal-height rows (17) | `styles/pack-list.css:500-513,736-792` | Cards | PORT |
| Separate Normal and Harder bars (18) | `components/PackRow.jsx:133-182`, `lib/progress.js:632-664` | No progress to display | PORT |
| Medal completion counts (19) | `dv_counts`, `lib/progress.js:298-386` | Absent | PORT |
| Rounds, best persists, "Start round N" (20) | `lib/progress.js:399-427,557-572`, `lib/packs.js`, `tests/pack-rounds.test.mjs` | Absent; no end state at all | PORT |
| Pack context survives reload (`?pack=<id>`) (21) | `lib/progress.js:782-786`, `TestMode.jsx:452-546` | Positional `?pack=`/`?id=` and a one-shot key; lingering-key bug | PORT |
| Level Review category (22) | `scripts/build-packs.js:399-437` | Absent; GRE has no levels | ADAPT |
| Pack generator, priorities, append-only ids (23) | `scripts/build-packs.js`, `data/packs-manual.json` | Hand-edited JSON; `POST /api/wordpacks/create` dead | ADAPT |
| Packs reference words by key (24) | `scripts/sort-vocab.js` | By index; `sort:vocab` is a footgun | ADAPT (prerequisite) |
| Visible pool of 5 with pips, hydration-hidden header (25) | `TestMode.jsx:1711-1964`, `styles/testmode.css:349-482`, `lib/matching.js:6-17` | 5-word subset and 4 bars, no pool strip | PORT |
| Random pool draws, streaks zeroed per run (26) | `lib/pool.js`, `tests/pool.test.mjs`, `run-streaks.test.mjs` | Subset drawn with replacement (can hold duplicates; possible infinite loop, not reproduced) | PORT |
| Full answer card on a wrong answer (27) | `components/WordFeedback.jsx`, `styles/testmode.css:1424-1428` | Shows definition, fullDefinition, example (quotes stripped) | ADAPT |
| Choose Words modal: search, Cancel, pack scope (28) | `components/ChooseWords.jsx` | Overlay of all 679; every click resets the game; duplicate Select/Done buttons top and bottom; no search | PORT |
| Subset progress counts toward parent pack (29) | `lib/progress.js:703-709`, `tests/choose-words-subset.test.mjs` | Absent | PORT |
| Normal completion screen (30) | `TestMode.jsx:1801-1839` | None; loops forever | ADAPT |
| Harder scheduler (31) | `lib/hard-scheduler.js`, `tests/hard-scheduler.test.mjs` | Absent | PORT |
| Harder storage, resume, best first-try % (32) | `lib/progress.js:1069-1207`, `tests/hard-progress.test.mjs` | Absent | PORT |
| Harder end screen, "Drill missed words" (33) | `components/SessionSummary.jsx` | Absent; replace the star glyph (no emoji rule) | PORT |
| Harder fading caption (34) | `TestMode.jsx:115-118,619-631`, `testmode.css:509-528` | Absent | PORT |
| Harder 2-pip relearn indicator (35, interpretation) | `TestMode.jsx:1931-1954` | Absent | PORT |
| Pip pop with "+1" (36) | `components/MasteryFx.jsx:180-214` | Absent | PORT |
| Mastered burst, fly-to-bar, toast, green colour (37) | `components/MasteryFx.jsx`, `testmode.css:780-865,979-994` | Absent; check mark glyph needs owner OK | PORT |
| Animations never delay advance, input guards (38) | `TestMode.jsx:247-255,924-930,1976-1981` | Fixed 1.5 s timer; no double-submit guard documented | PORT |
| Sentence / in-context prompt mode (39) | `TestMode.jsx:146-196`, `lib/progress.js` (`:sentence` scope) | Absent | ADAPT |
| Practice/Learn: check/cross, text feedback, keys 1-4, neutral restart (40) | `components/QuizMode.jsx` | Colour-only, no keys, no pack awareness, no dedupe of identical options | PORT |
| Pack awareness in every mode (41) | `lib/progress.js` (`loadPack`, `clearPack`) | Test only | PORT |
| Flashcards with key hints (42) | `components/FlashcardMode.jsx`, `styles/flashcards.css` | "Flash Cards" is actually sequential multiple choice; no flip card | PORT |
| Daily review, spaced intervals (43) | `lib/review.js`, `components/ReviewMode.jsx`, `DailyReviewEntry.jsx`, `tests/review.test.mjs` | Absent; marketing claims spaced repetition that does not exist | ADAPT (rank tiebreak) |
| Direction toggle (44) | `lib/progress.js:1213`, header pill | Absent; one direction | ADAPT |
| Reset copy and per-scope reset (45) | `TestMode.jsx:2023-2098` | Absent | PORT |
| Settings page with "where" labels (46) | `app/settings/page.jsx`, `styles/settings.css` | No settings page | PORT |
| Auto-advance delay (47) | `components/AdvanceDelayControl.jsx` | Fixed (1.5 / 1.2 / 2.0 s by mode) | PORT |
| Feedback sound toggle (48) | `lib/sound-settings.js`, `components/SoundControl.jsx`, `styles/sound.css` | Always on, only in Test; same two MP3s | PORT |
| Progress export / import / Reset all / persist (49) | `lib/progress.js:1222-1394`, `app/settings/page.jsx:326-407` | Nothing to export | PORT |
| ConfirmDialog tones (50) | `components/ConfirmDialog.jsx`, `styles/dialog.css` | No dialogs; popup message only | PORT |
| Settings coercion (51) | `lib/progress.js` `loadSettings` | n/a | PORT |
| Mobile pass (52) | `styles/mobile.css` | Responsive breakpoints only; no safe-area or 16px input work documented | PORT |
| PWA manifest and icons (53) | `public/manifest.webmanifest`, `scripts/generate-icons.js` | No manifest; icons already fixed | PORT |
| Fonts and metadata (54) | `app/layout.jsx` | `metadataBase` set; Inter not loaded; "800" in meta | PORT |
| Security headers and deploy (55) | `public/_headers`, `wrangler.jsonc` | No `_headers`, no deploy config in repo | PORT (host unconfirmed) |
| `vocab-stats.js` (56) | `scripts/vocab-stats.js` | Absent | ADAPT |
| Validators, raw duplicate-key scanner (57) | `scripts/validate-vocab.js`, `validate-packs.js`, `scripts/lib/scan-depth1-keys.js` | None | ADAPT |
| Review export and sort scripts (58) | `scripts/export-review.js`, `sort-vocab.js` | `sort-gre-combined.js` only | PORT |
| Grading-collision checks (59) | `scripts/validate-packs.js:42-78,192-253` | None; 6 identical-definition pairs exist | ADAPT |
| Unit-test suite (60) | `tests/*.test.mjs`, `npm test` | No tests, no runner | PORT |
| Trailing-punctuation tolerance (61) | `lib/matching.js:121-122` | None (`trim().toLowerCase()` only) | PORT |
| German-only items (62) | umlaut helpers, articles, forms, phrases, grammar lessons, Goethe source | n/a | SKIP-GERMAN |
| Pronunciation audio (63) | `lib/pronunciation.js`, `PronounceButton.jsx`, `AudioCredits.jsx`, `scripts/audio/*` | n/a | SKIP-AUDIO |

**GRE-only items with no Wortschatz counterpart.** Like ledger and community voting (`wp_upvote_ledger_v2`, `likes`); landing story/trust sections; the dead create-pack API; JSON-LD.

---

## 6. Shared code to copy

From WI "Shared code worth copying". Port order follows dependencies.

| Module | German dependency | Verdict |
|---|---|---|
| `lib/hard-scheduler.js` | None; needs two constants from `matching.js` | Verbatim; move `HARD_RELEARN_CORRECT` (2) and `HARD_COOLDOWN_CARDS` (3) |
| `lib/pool.js` | None | Verbatim (`POOL_SIZE`, `seededRng`) |
| `lib/review.js` | None; `wordReviewOpts` reads `.rank` | Verbatim; supply rank or alphabetical tiebreak |
| `lib/use-return-scroll.js` | None | Verbatim |
| `lib/backgrounds/*` (engine, bus, state, ids, util, 11 modules) | `sources.js` fetches `/data/packs.json`, uses `de` field | Verbatim except `sources.js`, which must be rewritten for GRE headwords |
| `components/Background.jsx`, `BackgroundPicker.jsx` | None | Verbatim; fix sink bug L20 |
| `components/MasteryFx.jsx` | None (toast slot labelled "de -> en" but is props) | Verbatim |
| `components/ConfirmDialog.jsx` + `styles/dialog.css` | None | Verbatim |
| `components/AdvanceDelayControl.jsx` | None | Verbatim |
| `components/SessionSummary.jsx` | `enFirst` flag is direction wording | Near-verbatim; remove star |
| `components/ChooseWords.jsx` | Search haystack includes `article`; ss fold harmless | Near-verbatim; search headword + definition |
| `components/UpNext.jsx`, `PackList.jsx`, `PackRow.jsx` + `styles/pack-list.css` | Forms/word count, "Grammar" pill, "Sentences" chip, tense grouping | Near-verbatim after removing those; fix `stat.finished` crash (L1) |
| `components/DailyReviewEntry.jsx` | None | Verbatim |
| `components/SoundControl.jsx` + `lib/sound-settings.js` | `pronounceGerman`/`pronounceEnglish` | Strip to feedback + mute |
| `components/Navbar.jsx` + `styles/navbar.css` | None (link list differs) | Verbatim |
| `lib/progress.js` | `DIRECTIONS=["de-en","en-de"]`, `strictArticles`, `phrases:default` migration, forms/phrases pack types, legacy migrations, filename | Near-verbatim; rename directions; drop German and legacy parts. Rounds, completions, hard, review, counts, return, export/import, reset are generic |
| `lib/packs.js` | `WORD_PACK_CATEGORIES`, `TENSE_GROUPS`, ss rule in `foldText` | Keep `groupByCategory`, `byPriority`, `computeStats`, `isBand`, `sortBands`, `packMatchesStatus`, `SORT_OPTIONS`, `isRetest`/`nextRoundLabel`; replace categories; drop tense helpers |
| `lib/matching.js` | Heavy: umlauts, articles, `gradeForm`, `gradePhrase`, `enDePrompt` | Port only `diceCoefficient`, generic `normalize`, 4-char exact floor, trailing punctuation, constants. Inline Dice can replace `string-similarity` |
| `scripts/lib/scan-depth1-keys.js` | None | Verbatim |
| `scripts/build-packs.js` | Forms, phrases, lessons generators | Extract bands, parts, append-only check, validation, `serializePacks`; needs a GRE `rank` |
| `scripts/validate-packs.js` | Phrase-orphan checks | Adapt field names to `definition` |
| `scripts/export-review.js`, `generate-icons.js`, `sort-vocab.js` | Column names, "W" glyph | Near-verbatim |
| `styles/ui.css`, `globals.css` tokens, `mobile.css`, `backgrounds.css`, `settings.css` | `--der/--die/--das`, `[lang=de]` hyphens | Verbatim minus those |
| `styles/testmode.css` | Umlaut helpers, article colours, phrase/gloss blocks | Mostly verbatim; prune German blocks |
| `public/_headers`, `manifest.webmanifest`, layout metadata pattern | Names only | Verbatim with GRE values |

**Port order (WI):** 1 packs by key, not index; 2 `progress.js` + tests; 3 pool, Harder scheduler, review; 4 Test UI and MasteryFx; 5 pack list; 6 settings and backup; 7 backgrounds; 8 mobile and metadata.

**Lessons to carry (WI L1 to L36), the ones most likely to bite the plan.**
- L1 `PackRow` reads `stat.finished` unguarded; use `!!(stat && stat.finished)`.
- L2/L14/L15 use `?pack=<id>` in every mode; read `window.location.search` inside the hydrate effect (avoids `useSearchParams`/Suspense under export); guard consume-once reads with a ref (StrictMode).
- L3 clear `last_pack` in Reset all. L4 update project notes with every storage-shape change.
- L5 decide one rule per displayed number before UI (only matters if a direction toggle is added).
- L6 Harder must have its own key, never touching Normal progress. L8 zero streaks per run. L9/L10/L11 rounds, idempotent completions, `dv_counts` migration needs a test; a grown-after-completion pack still shows N/N (define best as `min(N, credited size)`).
- L12/L13 scope Choose Words to the pack; subsets run in the parent scope.
- L17/L18/L19 animations never delay advance; remove the manual-advance Enter listener on the completion screen; guard held Enter (`e.repeat`).
- L20 background sink not restored (unverified); use a sink stack. L21 background must never crash the app.
- L22 use `overflow-x: clip` (hidden breaks sticky and scroll restore). L23 hide dynamic header parts until hydrated.
- L25/L26 read-merge-write settings; coerce every enum.
- L27 give `next dev` its own `distDir`; never run concurrent builds in one checkout. L28 anchor `.gitignore` patterns.
- L29/L30 key-based packs; frozen band ids and append-only. L31 detect duplicate keys on raw text. L32 derive counts. L33 collisions are grading bugs. L34 drop `string-similarity` and `axios`.
- L35 red only for destructive actions; no `window.confirm`. L36 iOS: hidden file input not `display:none`, 16px inputs, `-webkit-` for 3D flips.

---

## 7. Risks for a live site with about 8,000 monthly users

### 7.1 Progress migration
- **There is no stored progress to lose** (GC §0.1, §5). The app has never persisted mastery, position or selections; no `sessionStorage`, cookie or `indexedDB`, in any commit.
- The new `gv_*` keys start empty for everyone. Users get no head start, so a "welcome back" or import affordance would find nothing. Expect no complaints about lost progress, but also no way to credit past study.
- **Keys that do exist:** `wp_upvote_ledger_v2` (keyed by pack id; keep ids stable or the heart state is orphaned), `marketplaceWordpack` (lingering key bug: a stale value is applied on the next unrelated `/play/test` visit), and old `wp_likes:*` keys on long-time browsers (unread by code; optionally fold into the ledger, value > 0 means liked).
- Likes: `likes` counts are hand-edited in JSON, and a user's heart persists while the count resets after reload. Adopting Wortschatz's model (which has no likes) means either dropping likes or preserving a display-only count. Decide explicitly (section 8).
- Handoff compatibility: accept a `marketplaceWordpack` index array on first load, mapped through a frozen snapshot of today's 679-key order, so in-flight clicks do not break.
- Once the overhaul writes progress, GRE will have the same migration risks WI documents later (L11 `dv_counts`, import/export). Version every key from day one and put the export/import in the first release that persists anything, since the `localStorage` of 8k users will then hold the only copy.
- `navigator.storage.persist()` (WI item 49) reduces eviction risk; add it with the first persisted release.

### 7.2 URLs and SEO metadata
- **Existing indexed and shared URLs:** `/`, `/wordpacks`, `/play/test`, `/play/practice`, `/play/learn`, all in `sitemap.xml`, each with its own title, description and canonical. Wortschatz adds `/play/cards`, `/play/review`, `/settings`; adding routes means updating `app/sitemap.js` (5 URLs today, `lastModified` = build time). Keep the four existing paths; if Flash Cards is renamed or repointed (the label "Flash Cards" currently means `/play/practice`, which is multiple choice; Wortschatz's `/play/cards` is a real flip card), keep `/play/practice` working and decide on a redirect for any moved route. A static export has no `_redirects` today, so redirects need a `public/_redirects` or client redirect page.
- **Shared pack URLs:** `/play/test?id=<packId>` and `/play/test?pack=1,5,9` may be bookmarked or shared. Pack ids must remain resolvable (frozen ids, append-only). `?pack=` CSV is positional: freeze today's 679-key order as a read-only legacy table to resolve it, and run the new `?pack=<id>` format alongside. Note the two formats collide on the parameter name `?pack=` (WS uses an id, GRE uses CSV integers); distinguish by regex.
- **Metadata:** `metadataBase` is set (CLAUDE.md is wrong). Description, OG and Twitter copy say "800" in `app/layout.jsx:12,32,49`, JSON-LD at `app/page.jsx:33`. Fixing it changes SERP snippets; fine, but do it intentionally and consistently. The JSON-LD is inline in a client component; check it survives a page rewrite.
- `out/404.html` inherits the home canonical `https://grevocabtester.com` (GC §2): a 404 page declaring the homepage canonical. Fix in the overhaul.
- Wortschatz metadata pattern uses a title template `"%s · Wortschatz"` and a placeholder `metadataBase`. Port with `https://grevocabtester.com`; the existing per-route layouts already provide titles and canonicals, so keep them rather than regenerating.
- Home becomes SSR-heavy with a bundled 190 KB JSON if counts are derived on a client component (WI item 5); prefer a server component or small build-time constant for the count.
- `robots.js` disallows `/api/`; harmless once the API routes are removed, but keep unless routes change.
- Social cards: `og-image.png` composites the current logo; regenerate if branding changes.

### 7.3 Community packs
- 12 packs, fixed in a static file. No creation UI, no working API, no server-side like counts. The copy ("build and share your own") promises a feature that does not exist; Wortschatz removed the equivalent. Decide whether to keep community framing.
- The indices-to-keys migration is safe today (`words` matches `indices` in all 12) and should be done with a validator asserting `words[n] === keys[indices[n]]` before and after.
- Pack titles disagree with sizes ("GRE Elite 30" has 28, "Power G - 20" has 11). Fix titles or fill packs, and keep ids unchanged either way.
- Pack content has not been audited for the identical-definition pairs: a Normal Mode pack containing both `Exculpate` and `Exonerate` would accept one definition for either (typed answers are graded at 0.6 against only that word's definition, so word A's text also passes for word B). Word -> Definition is graded against the word shown, so this only bites a definition -> word direction or multiple choice. Check each pack against the 35 pairs at Jaccard >= 0.5.
- Any new pack with fewer than 5 words is topped up randomly by current code; WS `MIN_PACK_KEYS = 5` is a build failure instead.
- `POST /api/wordpacks/create` and `POST /api/feedback`: remove or move to a real backend. Neither works in production; if the owner wants feedback, a form-to-email or external service is needed (and a CSP `connect-src` update).
- If community submissions are to be revived on a static host there is no storage. This is an architecture decision, not a port.

### 7.4 Stale landing-page screenshots
- `NormalModeScreenshot.png` (1772x1235, 164 KB), `FlashcardScreenshot.png` (1689x1003, 111 KB), `RandomFlashcardScreenshot.png` (1640x944, 112 KB) are captures of the current play UI used in the three home mode tiles (`app/page.jsx:110,139,166`). They are the three largest home-page images, are unoptimized PNGs, and will contradict the new UI the moment it ships.
- Also stale after a redesign: `og-image.png` (258 KB, composites the current logo), `logo-128.webp`, the two banner WebPs, the `apple-touch-icon.png`, `favicon.ico`.
- Unreferenced but shipped in `out/`: `GREWebsiteLogo.png` (1.16 MiB) and `GRETesterBanner.png` (274 KB). They are inputs to `generate-images.js`; move them out of `public/` to stop shipping 1.4 MB.
- Wortschatz replaces screenshots with CSS-only mock-up tiles (WI item 8), which avoids ever going stale and drops three PNGs; that needs GRE sample content.
- `sharp` does not load on the win32-arm64 dev machine, so `npm run generate:images` fails here. Plan to regenerate on another machine, or use Wortschatz's zero-dependency `generate-icons.js`, which only draws a letter glyph.
- Copy that depends on the old UI ("Normal Mode", "Flash Cards", "Random Flash", the "Word #n / 679" label, "typo-tolerant") should be revisited together with the images.

### 7.5 Deploy config
- **Host unconfirmed.** The repo says Cloudflare Pages only through a `.gitignore` comment and `next.config.mjs` comment; there is no `wrangler.*`, `_headers`, `_redirects`, `engines`, `.nvmrc` or CI. OG URL previously pointed to `onrender.com`. Confirm host, build command and Node version before relying on `public/_headers` (Cloudflare/Netlify style) or `wrangler.jsonc` (Workers assets, which is Wortschatz's model with `./out` and `not_found_handling:"404-page"`).
- **Pages vs Workers.** WS deploys as Workers static assets; GRE (inferred) is on Pages. Don't copy `wrangler.jsonc` blindly; moving host is a separate change with DNS implications.
- **Security headers:** `next.config.mjs` `headers()` is dev-only and the referenced `_headers` does not exist, so production has no CSP or security headers today. Adding WS's `_headers` CSP (`script-src 'self' 'unsafe-inline'`, `connect-src 'self'`, `frame-ancestors 'none'`) is a behavioural change: anything inline or external (analytics, Stripe, future feedback endpoint, `next/font` is self-hosted so fine) will be blocked. Test the CSP on a preview deployment before production.
- `out/` is gitignored and rebuilt on push. Lock the Node version (local is v24.16.0; no pin), and add an `engines` field.
- Remove `app/api/*` and the nonexistent-middleware references so the build route table has no dynamic routes; confirm `output: "export"` still succeeds and that `next build` warnings ("headers will not automatically work") go away when `headers()` is removed.
- Shared `.next` hazard (WI L27): split `distDir` for dev and build, since parallel batch runs broke each other in Wortschatz.
- Add `npm test` and a `validate` step (vocab, packs) and decide whether the host build runs them (WS runs `build-packs` as `prebuild`; a failing validator then blocks deploy, which is desirable but risky for a solo owner).
- Cache: `fetch("/data/wordpacks.json", {cache:"no-store"})` on every load; with a build-time `packs.json`, set sensible cache headers in `_headers`.
- Rollback: with a static host and no server state, rollback is a redeploy; but a version bump of `gv_*` storage cannot be rolled back on user devices, so keep keys additive and versioned.
- Tests do not exist, no lint, no CI: the first release of ported logic (about 10 test files in WS) has no safety net unless the tests are ported first.

---

## 8. Open questions for the owner

Each has a default recommendation so planning can proceed; none was decided in the inputs.

1. **Vocabulary count.** Keep 679 and derive every number from data, or grow to the advertised 800? Recommended: derive; correct all six "800" mentions. (GC §2, GD §3)
2. **Word-list quality pass before launch?** Fix `Cavo;`, `Peurile`, `Ecomium`; resolve 6 identical-definition pairs and 4 more Jaccard-1.0 pairs; decide whether the 3 definitions lacking periods matter. Which of Guy/Stand/Brook/Novel/Appropriate/Thrift should be reworded or marked with a sense? (GD §2)
3. **Data provenance and licence.** Where did the words, definitions and examples come from? The "past papers and reputable prep sources" claim is unverifiable in the repo and no licence exists. Should the public copy keep or drop that claim? Is the prose original or generated? (GD §4)
4. **Add fields?** `rank` (needed for bands, learning path, review tiebreak), `pos` (needed for distractor matching), `difficulty`, synonym groups / `acceptAlso`. Without `rank` the Up next path becomes a "suggested order". Who supplies the ranking and from what source? (WI items 15, 22, 23, 43, 56)
5. **Pack identity.** Approve migrating `indices` to headword keys using `words`, freezing the 12 pack ids, and a frozen legacy order table for old `?pack=` links? (GC §5, GD §5)
6. **Likes / community.** Drop likes and the "build and share your own" copy, keep a read-only like count, or build a backend? Without a backend, likes cannot aggregate. What happens to `wp_upvote_ledger_v2`? (WI storage map)
7. **Mode lineup and names.** Keep Normal / Flash Cards / Random Flash, or rename to Test / Practice / Learn / Flashcards like Wortschatz? Today's "Flash Cards" is multiple choice; add a true flip-card mode at `/play/cards`? Which old URLs must keep working, and do you need redirects? (section 7.2)
8. **Features to include or defer.** Harder mode, Daily review (this makes the existing "spaced repetition" copy true), sentence/in-context prompt, direction toggle (definition -> word, which exposes duplicate-definition collisions), animated backgrounds (a large module set with a known unverified bug, L20), PWA manifest, settings page, export/import. Which are in scope for the first release?
9. **Core constants.** CLAUDE.md forbids changing mastery = 4, threshold 0.6, subset 5. Confirm that random-without-replacement subset draws (WS pool) and Harder's different rules are acceptable additions, and whether the 0.6 Dice stays the only matcher (WS also uses trailing-punctuation tolerance and a 4-char exact floor).
10. **Palette.** Play pages blue accent on `#000`, marketing coral on `#050505`. Unify on Wortschatz's tokens (coral, `--ok` green, `#050505`)? Is the check-mark glyph in the mastery toast acceptable under "no emoji in chrome"? Replace the emoji currently in feedback and like button? (GC §2, WI item 37)
11. **Dialog default focus.** Wortschatz focuses Cancel on danger dialogs and Confirm on neutral ones. Apply Cancel-focus everywhere? (WI item 50)
12. **Trust claims.** The "8,000+ monthly active users" stat has no analytics behind it in the repo. Keep, source from host analytics, or remove? Is analytics wanted at all (none today; adds a CSP and privacy-policy question)? (GC §7)
13. **Deploy target and headers.** Confirm the host (Cloudflare Pages vs Workers vs Render), whether it honours `public/_headers`, and whether adding a CSP is acceptable. Pin Node version? (section 7.5)
14. **Feedback and donate.** `POST /api/feedback` is dead. Replace with a form service, a mailto, or remove? Three Stripe Payment Links sit in the stray root `globals.css` and a "Donate" history exists (commit `8ef32d0`): bring donations back, or delete the file?
15. **Cleanup in the same effort?** Remove unused `axios` and `string-similarity` (inline Dice), delete the stray root `globals.css`, `GREWebsiteLogo.png`/`GRETesterBanner.png` from `public/`, `middleware.ts` references, the dead `create` route, duplicate CSS; rewrite CLAUDE.md after the storage shape is set.
16. **Storage prefix.** Use `gv_` (WI recommendation) and keep `_<dir>` suffix even before a direction toggle exists?
17. **Tests as a prerequisite.** Port WS tests first (pool, streaks, hard scheduler/progress, rounds, choose-words, review) and add a `dv_counts` migration test, or accept shipping without them?
18. **Screenshots.** Replace the three landing PNGs with CSS mock-up tiles (no recurring staleness) or recapture after the redesign? (section 7.4)
19. **Normal Mode exit.** Today play loops forever with no completion; Wortschatz adds a completion screen and rounds. Is a finish state wanted for the full 679-word feed, or only for packs?
20. **Process.** WS `Learning-German` has batch-runner conventions and a lessons list; GC notes `.batches/` and `.batch-runs/` are ignored via `.git/info/exclude`. Should GRE keep using automated batches for the overhaul, and who updates CLAUDE.md after each? (WI L4)
