# GRE Vocab Tester — CLAUDE.md

## Project Overview
Full-stack GRE vocabulary study app at **grevocabtester.com**. 8,000+ monthly users.
Next.js 15 (App Router, static export) + React 19 + Node.js.

## Stack
- **Framework**: Next.js 15 with App Router — `output: "export"` (static site)
- **UI**: React 19, plain CSS modules (no Tailwind), Inter font
- **Data**: `src/data/gre_combined.json` — 800+ words with definition/example/fullDefinition
- **Wordpacks**: `public/data/wordpacks.json` — community-created word sets
- **Answer matching**: `string-similarity` (60% threshold — typo-forgiving)
- **API routes**: `/api/feedback` (POST) and `/api/wordpacks/create` (POST)
- **Rate limiting**: Custom token bucket middleware (`middleware.ts`)

## File Structure
```
app/
  layout.jsx          — global layout, metadata, imports globals.css + components.css
  page.jsx            — home/landing page
  wordpacks/page.jsx  — wordpacks marketplace
  play/test/page.jsx  — Normal Mode wrapper
  play/practice/page.jsx — Flash Cards wrapper
  play/learn/page.jsx — Random Flash wrapper
  api/feedback/       — feedback endpoint
  api/wordpacks/create/ — wordpack creation endpoint

components/
  TestMode.jsx        — core study mode (typo-forgiving input)
  LearnMode.jsx       — multiple choice, randomized
  PracticeMode.jsx    — multiple choice, ordered

styles/
  globals.css         — design tokens + base styles + donate section
  home.css            — landing page (coral theme)
  components.css      — TestMode + answer buttons + tracker bars
  menu.css            — Choose Words overlay
  wordpacks.css       — wordpacks grid + cards
```

## Design System
- **Colors**: `--coral: #ea5746`, `--accent: #64b5ff`, dark bg (`#000`/`#050505`)
- **Font**: Inter (system fallback stack)
- **Theme**: Dark with coral/red accent — professional, premium, dark SaaS
- **Responsive**: mobile-first, CSS grid breakpoints at 640/800/900/1000/1100px

## UI Philosophy (CRITICAL)
**This must look like a real, professional GRE prep company** (think Magoosh, Princeton Review vibes).
- NO emoji icons in UI chrome (mode tiles, nav, feature sections)
- NO slang copy ("built to grind", "vibe", "No fluff", "Support the grind")
- Professional copywriting throughout
- Must have a persistent navigation bar on non-play pages
- Stats, social proof, and trust signals on homepage
- Clean, premium feel — dark SaaS aesthetic

## Key Behaviors
- TestMode: 5-word rotating subset, mastery after 4× correct, string similarity matching
- URL params: `/play/test?id=<packId>` or `/play/test?pack=1,5,9`
- localStorage: `marketplaceWordpack` (indices), `wp_upvote_ledger_v2` (likes)
- Keyboard shortcuts on home: `1`→Test, `2`→Practice, `3`→Learn
- Audio feedback: `yesmp3.mp3` / `nomp3.mp3` at 10% volume

## Development
```bash
npm run dev     # dev server
npm run build   # static export to /out
npm run sort:vocab  # alphabetically sort gre_combined.json
```

## What NOT to do
- Don't add Tailwind (plain CSS is intentional)
- Don't break static export — no server-side features beyond existing API routes
- Don't change core game logic (mastery tracking, string similarity threshold)
- Don't add emoji to UI chrome
- Don't use informal/slang copy
