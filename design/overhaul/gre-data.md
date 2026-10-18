# GRE vocab data audit

Read-only investigation. Stats come from a throwaway Node script run from the OS temp directory (`%TEMP%\grean`); nothing in the repo was changed except this file. Analysis date: 2026-10-18.

## 1. Data files

Only two vocab-bearing files are in the source tree. `out/data/wordpacks.json` is a build copy, byte-for-byte equivalent in content (verified with a JSON compare). No CSV, TXT or other word lists exist in the repo (Glob of json/js/mjs/md/csv/txt outside `node_modules`).

### 1a. `src/data/gre_combined.json`

- Shape: one JSON **object** keyed by headword, tab-indented, CRLF line endings, 192,437 chars.
- Count: **679 entries**. The raw file also has exactly 679 top-level key lines, so `JSON.parse` is not silently collapsing duplicate keys.
- Every entry has exactly the same three fields, all non-empty strings (679/679):

| Field | Type | Role |
|---|---|---|
| `definition` | string | Short gloss, 6-58 chars. Used as the multiple-choice option text and as the free-type answer. |
| `example` | string | One sentence using the word. Shown in Test mode after an answer. |
| `fullDefinition` | string | Longer explanatory sentence. Shown in Test mode after an answer. |

Real entry (`Mitigate`):

```json
"Mitigate": {
  "definition": "to lessen severity.",
  "example": "Planting trees can mitigate the urban heat-island effect in big cities.",
  "fullDefinition": "To mitigate is to make a situation, condition, or consequence less severe, harmful, or painful through remedial action."
}
```

First key `Abate`, last key `Zealot`. The file is already A-Z by `localeCompare`.

**Required in practice:**
- `definition` is required everywhere: Test, Practice and Learn all read it.
- `example` and `fullDefinition` are read only by `TestMode` (`components/TestMode.jsx:41-46`), which falls back to `""` if missing.
- The headword (the key) is required.
- There is no id, part-of-speech, frequency, source, tags or difficulty field.

### 1b. `public/data/wordpacks.json`

- Shape: array of **12 packs**, fetched at runtime by `/wordpacks` and by `/play/test?id=`.
- Fields in all 12 packs: `id`, `title`, `desc`, `indices`, `likes`, `words`.
- `CLAUDE.md` describes `createdAt` and `authorIpHash`; **no pack in the file has them**. The doc is wrong or out of date on this point.
- Real example:

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

- Required in practice: `id` (URL lookup), `indices` (the only field the game reads), and `title`, `desc`, `likes` for the marketplace card. `words` is **redundant and unread** by the game; it is a human-readable mirror of `indices`.
- All 12 packs are internally consistent: no out-of-range indices, no duplicate indices within a pack, and `words[n]` equals `Object.keys(gre_combined)[indices[n]]` for every entry (0 mismatches).
- Pack sizes range from 10 to 30. Together they cover 178 distinct words out of 679.

## 2. Quality stats (679 entries)

### Duplicate words (case and whitespace insensitive)
**0.** Also no leading/trailing or doubled whitespace in keys and no lowercase-initial keys.

Related key problems, which the duplicate check does not catch:
- `"Cavo;"` is a corrupted key containing a semicolon, and its text is built around the same typo ("To cavo; is to object unnecessarily..."). It is the only non-alphabetic key. It probably means *cavil*.
- `"Peurile"` is a misspelling of *puerile*. The entry body says "Puerile", so the typo is in the key only. The key is what is shown as the quiz word.
- Both keys fail the example-contains-headword check (see below).
- `Guy`, `Stand`, `Brook`, `Novel`, `Appropriate`, `Thrift` are common-word or multi-sense headwords. They produce the identical definitions listed below.

### Missing definition, example or fullDefinition
**0 / 0 / 0.** No entry is missing any field.

### Definition length distribution (characters)

| min | p10 | p25 | median | p75 | p90 | max | mean |
|---|---|---|---|---|---|---|---|
| 6 | 17 | 20 | 25 | 31 | 37 | 58 | 26.1 |

Histogram by 10-char bucket:

| Bucket | Entries |
|---|---|
| 0-9 | 6 |
| 10-19 | 149 |
| 20-29 | 302 |
| 30-39 | 177 |
| 40-49 | 40 |
| 50+ | 5 |

19 definitions are a single word. No definition is long enough to cause layout problems. All are lowercase-initial. 3 do not end with a period: `Commensurate` ("in proportion to"), `Obviate` ("to prevent or eliminate"), `Prolific` ("highly productive").

10 shortest (chars):

| Word | Length | Definition |
|---|---|---|
| Verbose | 6 | wordy. |
| Craven | 9 | cowardly. |
| Gregarious | 9 | sociable. |
| Innocuous | 9 | harmless. |
| Understate | 9 | downplay. |
| Veracious | 9 | truthful. |
| Apprise | 10 | to inform. |
| Abreast | 11 | up to date. |
| Flabby | 11 | soft; weak. |
| Irresolute | 11 | indecisive. |

10 longest:

| Word | Length | Definition |
|---|---|---|
| Paradox | 58 | a seemingly self-contradictory statement that may be true. |
| Thrift | 53 | wise and economical management of money or resources. |
| Appropriate | 53 | to take or use for oneself, often without permission. |
| Restive | 52 | unable to remain still; impatient under restriction. |
| Indecorous | 52 | not in keeping with accepted standards of propriety. |
| Hegemony | 49 | leadership or dominance, especially by one group. |
| Exegesis | 49 | critical explanation or interpretation of a text. |
| Unseemly | 48 | inappropriate or improper for the circumstances. |
| Apotheosis | 48 | the perfect example; elevation to divine status. |
| Novel | 47 | new and not resembling anything formerly known. |

### Definitions containing the headword
- Exact whole-word headword in the definition: **0**.
- Stem match (heuristic, trailing suffix stripped): **1**, `Restive` ("unable to remain still; **impatient under restriction**" matches the stem "rest"). This is a false positive; the definition is fine.
- Looser check (shared first 5 letters between headword and a definition word) gives 8 candidates, all benign or mild same-root hints: `Acquisitive` ("eager to **acquire**"), `Approbation` ("formal **approval** or praise"), `Dissolution` ("...or **dissolving**..."), `Implicit` ("**implied**..."), `Penitential` ("...remorse or **penitence**"), `Problematic` ("posing a **problem**"), `Spendthrift` ("one who **spends** wastefully"), `Variegated` ("**varied** in appearance..."). `Acquisitive` and `Penitential` are the most give-away.
- So there are no true circular definitions. Fewer than 10 hits exist for this category.

### Part of speech
**Not present.** There is no `pos`/`partOfSpeech` field (0/679). `fullDefinition` is a prose sentence that does not begin with a POS label either (0/679 match a leading n./v./adj./adv./noun/verb/...). The only POS hint is the stylistic "to ..." prefix on verb definitions in `definition`. Homographs (`Novel`, `Appropriate`, `Stand`, `Guy`, `Brook`) have one sense each, with no marker of which.

### Near-duplicate definitions (ambiguous multiple choice)

Method: normalised exact match, plus token-set Jaccard >= 0.5 after stopword removal.
- **6 pairs (12 words) share a verbatim identical definition** (case/punctuation-insensitive):
  - `Brook` / `Stand`: "to tolerate or endure."
  - `Decorum` / `Propriety`: "proper behavior."
  - `Deride` / `Guy`: "to mock or ridicule."
  - `Exculpate` / `Exonerate`: "to clear from blame."
  - `Fervent` / `Fervid`: "intensely passionate."
  - `Indigence` / `Penury`: "extreme poverty."
- Pairs with Jaccard 1.0 after tokenisation: 10 (the 6 above, plus `Appease`/`Placate`, `Dearth`/`Paucity`, `Neophyte`/`Tyro`, and `Impermeable`/`Permeable`).
  - `Impermeable` ("not allowing passage") vs `Permeable` ("allowing passage") has an identical content-word set once "not" is stripped as a stopword. They are really antonyms, so it is a false positive for ambiguity but still a confusing pair.
- Pairs at Jaccard >= 0.7: 12. Pairs at >= 0.5 (not identical): 25 more. Total >= 0.5: 35.

10 worst:

| # | Pair | Definitions | Jaccard |
|---|---|---|---|
| 1 | Brook / Stand | "to tolerate or endure." / same | 1.00 |
| 2 | Decorum / Propriety | "proper behavior." / same | 1.00 |
| 3 | Deride / Guy | "to mock or ridicule." / same | 1.00 |
| 4 | Exculpate / Exonerate | "to clear from blame." / same | 1.00 |
| 5 | Fervent / Fervid | "intensely passionate." / same | 1.00 |
| 6 | Indigence / Penury | "extreme poverty." / same | 1.00 |
| 7 | Appease / Placate | "to calm or pacify." / "to calm; pacify." | 1.00 |
| 8 | Dearth / Paucity | "a scarcity or lack." / "scarcity; lack." | 1.00 |
| 9 | Neophyte / Tyro | "a beginner; novice." / "a beginner or novice." | 1.00 |
| 10 | Impermeable / Permeable | "not allowing passage." / "allowing passage." | 1.00 (antonyms) |

Next tier (0.67-0.75): `Ecomium`/`Panegyric` (note the first key looks like a typo for *encomium*, see below), `Imperturbable`/`Placid`, `Anachronism`/`Anachronistic`, `Banal`/`Hackneyed`, `Enigmatic`/`Recondite`, `Exculpate`/`Vindicate`, `Exonerate`/`Vindicate`, `Incipient`/`Nascent`.

Two consequences:
- In a 4-option question where both members of an identical pair appear, **two options are literally the same text but only one is marked correct**. The user can be marked wrong for a correct answer. See section 6; nothing prevents this.
- Synonym-heavy GRE vocabulary makes this expected; the dataset has no "synonym group" field to exclude them.

Other typo candidates spotted during the scan: key `Ecomium` (probably *encomium*); not checked further. `exampleLacksHeadStem` flags only `Cavo;` and `Peurile`.

## 3. 800 vs 679

**679 is the real count.** It is `Object.keys(gre_combined.json).length`, confirmed by `JSON.parse` and by 679 raw key lines.

Where "800" appears (all hard-coded marketing text, not computed from data):
- `app/layout.jsx:12, 32, 49` (meta, OpenGraph and Twitter descriptions): "Drill 800 high-frequency GRE words"
- `app/page.jsx:33` (description string in the page), `app/page.jsx:284` ("**800 high-frequency GRE words**, drawn from past papers and reputable prep sources, then deduplicated and normalized into a single clean list"), `app/page.jsx:319` (`<span className="trust-num">800</span>`)

Why the play pages show 679: `PracticeMode.jsx:9` and `LearnMode.jsx:9` do `const allKeys = Object.keys(vocabData)` and render `Word #{n} / {allKeys.length}` (`PracticeMode.jsx:70`, `LearnMode.jsx:69`). `TestMode.jsx:11` uses the same `allKeys`. The counter is derived from the JSON, so it shows 679. The homepage number is a constant someone typed. Whichever the owner chooses to keep, the homepage should read from the data, or the data should grow to 800. Do not edit either without the other. (Also, the copy "No padding with words..." at `page.jsx:285` sits next to the inflated number.)

## 4. Scripts, provenance, licensing

Scripts in `scripts/`:
- `sort-gre-combined.js`: A-Z sorts the keys of `gre_combined.json` in place (`npm run sort:vocab`). Nothing else. **Destructive for packs**, see section 5. (The file is already sorted, so running it today would be a no-op, but it would reorder after any insertion.)
- `generate-images.js`: image generation, unrelated to vocab. (Mentioned in the grep; not read further.)
- `app/api/wordpacks/create/route.js`: writes a new pack to `public/data/wordpacks.json`. It enforces profanity, size and IP limits, but no check that indices are valid words. It has no UI caller (per `CLAUDE.md`) and does not work on static hosting.

**No scraping, ingestion, deduplication or validation script exists.** There is no test, no lint step for data, and no `validate` npm script in what I inspected. The "deduplicated and normalized" claim has no tool behind it in the repo.

What the repo says about provenance (quoted; nothing else was found):
- `app/page.jsx:284-285`: "800 high-frequency GRE words, drawn from past papers and reputable prep sources, then deduplicated and normalized into a single clean list."
- `CLAUDE.md:7`: "Words come from a curated, deduplicated JSON dataset assembled from past papers and prep sources."
- `app/page.jsx:247`: "the verbal section leans on a few hundred high-frequency words that show up again and again".
- The filename `gre_combined.json` implies merging of several sources.

**No source is named anywhere, and no data license or attribution exists.** `package.json:15` has `"license": "ISC"` (the package, not the data) and the repo has no LICENSE or README file. The `example` and `fullDefinition` text reads as LLM- or author-written prose (the same template, "X means to...", and invented example sentences, and typos such as `Cavo;` look like generation artifacts), but that is an inference, not something the repo states. The "past papers" claim cannot be verified from the repo. The licensing of the source material is unknown; this is a risk to flag before any public overhaul copy repeats those claims.

There are also working dirs (git tracking status not checked) `.batches/` and `.batch-runs/` (batch-runner context such as `gre-data.json`, `wortschatz-inventory.json`). I did not read them; they are not part of the app data.

## 5. How packs reference words, and what breaks

Packs reference words **by position** (`indices`: integer offsets into `Object.keys(gre_combined.json)`). Resolution happens at runtime in `TestMode.jsx`:
- `allKeys[idx]` in three places: the `marketplaceWordpack` localStorage path (lines 103-108), the `?id=` path (`hydrateFromIndices`, lines 149-156) and the `?pack=1,5,9` path (lines 169-174). The `?pack=` path also bounds-checks `n < allKeys.length`.
- Out-of-range or missing keys are silently skipped (`if (k && vocabData[k])`).
- Fewer than 5 resolved words are topped up with random other words.
- The `words` field in the JSON is **never read** at runtime, so it cannot rescue a stale index.

What breaks:

| Change | Effect |
|---|---|
| **Add** a word at the end | Safe. Existing indices keep their meaning. |
| **Add** a word anywhere else (including by re-sorting) | Every index at or after the insertion point shifts by one. Every pack silently points at neighbouring words. No error. |
| **Remove** a word | Same shift for everything after it; packs containing the removed index point at the next word. Trailing indices go out of range and are silently dropped. |
| **Reorder / re-sort** (`npm run sort:vocab`, or the file's current order changing) | All 12 packs scramble. |
| **Rename** a key (e.g. fix `Peurile` -> `Puerile`, `Cavo;` -> `Cavil`) | Safe for indices as long as position is unchanged. **But** the `words` mirror in `wordpacks.json` goes stale (cosmetic only), and the keys are also the display headword. Check that sort order is not re-applied. |
| Changing key **case/spelling** where a pack stored `words` | `words` mismatches `indices`; nothing validates this. |

Other places that depend on the same positions:
- `?pack=<csv>` URLs that users have already shared are the same positional indices, so any reorder breaks old links. Same for `localStorage` `marketplaceWordpack`.
- Test mode's choose-words overlay (`TestMode.jsx:292`) lists `Object.keys(vocabData)`.
- `Word #n / N` counters in Practice and Learn use `allKeys.indexOf`, so also order-dependent.

Recommended in the overhaul (not done here): give each word a stable `id`/slug, make packs store words or ids, and add a validation script that asserts `words[n] === keys[indices[n]]` today.

Pack coverage: 178 of 679 words appear in at least one pack. Note too that the 12 packs include words that some other packs share (for example indices 121 and 406 appear in more than one pack); that is intended.

## 6. Distractor selection for multiple choice

All options show **definitions** as buttons for a headword prompt (`vocabData[word].definition`, `PracticeMode.jsx:82`, `LearnMode.jsx:81`). Distractors are **uniformly random**, with no relation to the answer (no part-of-speech match, no length match, no semantic distance, no exclusion of synonyms or identical definitions).

- **Practice** (`PracticeMode.jsx:16-35`): the quiz word is `allKeys[currentIndex]`, sequential A-Z and wrapping after the last. `pickDistractors` filters out only the quiz word itself by key, Fisher-Yates shuffles with `Math.random`, and takes 3. The 4 options are then shuffled with `Math.random`.
- **Learn** (`LearnMode.jsx:21-33`): shuffles **all** keys with a `crypto.getRandomValues` Fisher-Yates (`cryptoInt` uses `array[0] % max`, a negligible modulo bias), takes the first 4 as options, and picks a random one of the 4 as the quiz word. The next question is independently random, so a word can repeat; there is no no-repeat tracking.
- **Test mode** is not multiple choice; it compares typed input with `definition` using `string-similarity` at 0.6 (see `CLAUDE.md`).

Gaps this leaves:
1. Identical-definition pairs (section 2) can co-occur as two visually identical options. Probability per question is small (about 3 distractors from 678, so roughly 3/678 for any given pair, about 0.4% per question for words in an identical pair; 12 words are involved), but it happens and the user is punished.
2. Verb ("to ...") definitions mixed with noun and adjective definitions give away the answer by grammar, and with no POS field the app cannot match them.
3. Definition length varies 6-58 chars, so the longest option is often correct on easy items.
4. The Learn-mode "Word #n / 679" label uses the position of the quiz word in the A-Z list, which is meaningless for random order.

## Sources of numbers

All counts above are from `src/data/gre_combined.json` and `public/data/wordpacks.json` as at the working tree on 2026-10-18 (git status clean at start). Heuristics (stem/prefix, Jaccard >= 0.5) are approximate; the "worst 10" lists were chosen by score, then by alphabetical order.
