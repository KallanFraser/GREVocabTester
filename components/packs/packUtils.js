// components/packs/packUtils.js — /wordpacks display helpers: categories, the
// learning path order, drill-mode links, per-pack stats, filters and sorts.
// Ported from Wortschatz's lib/packs.js (groupByCategory, computeStats,
// packMatchesStatus, SORT_OPTIONS, isRetest, nextRoundLabel). Storage access
// goes through lib/progress.js and lib/packs.js; nothing here runs at import time.
import { packSummary, loadCompletions, markScopeComplete, scopeIdFor } from "../../lib/progress";

export const CATEGORY_PATH = "path";
export const CATEGORY_THEME = "theme";
export const CATEGORY_CLASSIC = "classic";
export const CATEGORY_CUSTOM = "custom";
export const CATEGORY_FAVORITES = "favorites";

export const CATEGORY_LABELS = {
	[CATEGORY_PATH]: "Learning path",
	[CATEGORY_THEME]: "Themes",
	[CATEGORY_CLASSIC]: "Classic",
	[CATEGORY_CUSTOM]: "Your packs",
	[CATEGORY_FAVORITES]: "Favorites",
};

// Section order. Categories the JSON carries beyond these render after
// Classic and before Your packs, in first-seen order.
const LEADING = [CATEGORY_PATH, CATEGORY_THEME, CATEGORY_CLASSIC];
const TRAILING = [CATEGORY_CUSTOM, CATEGORY_FAVORITES];

// The learning path is already in the Up next panel, so its section starts
// collapsed; everything else starts open.
export const COLLAPSED_AT_START = [CATEGORY_PATH];

export const TIER_LABELS = { 1: "Core", 2: "Common", 3: "Advanced" };
export function tierLabel(tier) {
	return TIER_LABELS[tier] || (Number.isFinite(tier) ? `Tier ${tier}` : "Other");
}

export function categoryLabel(category) {
	if (CATEGORY_LABELS[category]) return CATEGORY_LABELS[category];
	const s = String(category || "").replace(/[-_]+/g, " ").trim();
	return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Other packs";
}

export function sectionAnchor(category) {
	return `cat-${String(category).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

// The element id of a row; the section is part of it because a favorite also
// appears in its own category.
export function rowAnchor(section, packId) {
	return `pk-row-${section}-${String(packId).replace(/[^A-Za-z0-9_-]+/g, "-")}`;
}

function num(v, fallback) {
	return Number.isFinite(v) ? v : fallback;
}

function byTitle(a, b) {
	return String(a.title || "").localeCompare(String(b.title || ""));
}

// Default order inside a section: tier, then order, then title. Packs without
// a tier or order sort after those with one.
export function byDefaultOrder(a, b) {
	const MAX = Number.MAX_SAFE_INTEGER;
	return num(a.tier, MAX) - num(b.tier, MAX) || num(a.order, MAX) - num(b.order, MAX) || byTitle(a, b);
}

export function pathPacks(packs) {
	return packs.filter((p) => p.category === CATEGORY_PATH).sort(byDefaultOrder);
}

// The path split by tier, in tier order: [{ tier, label, packs }].
export function pathTiers(path) {
	const groups = new Map();
	for (const p of path) {
		const key = Number.isFinite(p.tier) ? p.tier : null;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(p);
	}
	return [...groups.entries()].map(([tier, list]) => ({ tier, label: tierLabel(tier), packs: list }));
}

// [{ category, label, anchor, packs }] with empty sections dropped. Favorites
// is built from `favoriteIds` across every pack given; `comparator` orders
// rows inside each section (Favorites keeps the order they were added in
// unless a sort is chosen).
export function groupSections(packs, favoriteIds, comparator) {
	const groups = new Map(LEADING.map((c) => [c, []]));
	for (const p of packs) {
		const c = p.category || CATEGORY_CLASSIC;
		if (c === CATEGORY_CUSTOM || c === CATEGORY_FAVORITES) continue;
		if (!groups.has(c)) groups.set(c, []);
		groups.get(c).push(p);
	}
	groups.set(CATEGORY_CUSTOM, packs.filter((p) => p.category === CATEGORY_CUSTOM));
	const byId = new Map(packs.map((p) => [p.id, p]));
	groups.set(CATEGORY_FAVORITES, (favoriteIds || []).map((id) => byId.get(id)).filter(Boolean));

	return [...groups.entries()]
		.filter(([, list]) => list.length > 0)
		.map(([category, list]) => {
			let sorted = list.slice();
			if (comparator) sorted.sort(comparator);
			else if (category !== CATEGORY_FAVORITES) sorted.sort(category === CATEGORY_CUSTOM ? byTitle : byDefaultOrder);
			return { category, label: categoryLabel(category), anchor: sectionAnchor(category), packs: sorted };
		});
}

// ---------------------------------------------------------------------------
// Drill modes
// ---------------------------------------------------------------------------

// The six ways to start a pack, in the order every row offers them. Test and
// Harder are the same route; the link's &mode=normal|harder sets Test mode's
// difficulty (components/test/engine.js resolveDifficulty saves it), so
// nothing is written to storage before following the link. Daily Review is
// cross-pack, so it is not offered per pack.
//
// DIFFICULTY_KEY is the pre-overhaul key, kept only so existing imports
// resolve; lib/settings.js migrates it into gv_settings.testDifficulty.
export const DIFFICULTY_KEY = "gv_test_difficulty";
export const DRILL_MODES = [
	{ id: "test", route: "/play/test", mode: "normal", label: "Test", title: "Type the definition. Four in a row masters a word." },
	{ id: "hard", route: "/play/test", mode: "harder", label: "Harder", title: "Words right on the first try are retired." },
	{ id: "practice", route: "/play/practice", label: "Practice", title: "Multiple choice, in order" },
	{ id: "learn", route: "/play/learn", label: "Random", title: "Multiple choice, shuffled" },
	{ id: "cards", route: "/play/cards", label: "Flashcards", title: "Flip through the pack" },
	{ id: "context", route: "/play/context", label: "In Context", title: "Each word in an example sentence" },
];

export function modeHref(mode, packId) {
	const q = `pack=${encodeURIComponent(packId)}`;
	return `${mode.route}?${q}${mode.mode ? `&mode=${encodeURIComponent(mode.mode)}` : ""}`;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

// packSummary for every pack, keyed by id, for one direction. Like
// Wortschatz's computeStats, a pack whose current round is fully mastered but
// never credited (a save from before completions were counted) is credited
// here once; markScopeComplete is idempotent and checks the keys itself.
export function computeStats(packs, direction) {
	const out = {};
	for (const p of packs) {
		const words = Array.isArray(p.words) ? p.words : [];
		const scope = scopeIdFor(p.id);
		try {
			let s = packSummary(direction, scope, words);
			if (s.roundDone && !loadCompletions(direction, scope).credited) {
				markScopeComplete(direction, scope, { keys: words });
				s = packSummary(direction, scope, words);
			}
			out[p.id] = s;
		} catch {
			// A corrupt scope reads as no progress rather than breaking the page.
		}
	}
	return out;
}

// True when the pack's round is finished, so its one affordance on this page
// is "Start round N" (clearScopeProgress moves to round + 1 and keeps N / N).
export function isRetest(stat) {
	return !!(stat && stat.roundDone);
}

export function nextRoundLabel(stat) {
	return `Start round ${(stat && Number.isInteger(stat.round) ? stat.round : 1) + 1}`;
}

function inProgress(stat) {
	if (!stat) return false;
	const normal = !stat.roundDone && (stat.roundMastered > 0 || !!stat.hasProgress);
	const hard = !!(stat.hard && stat.hard.resumeRetired !== null && stat.hard.resumeRetired !== undefined);
	return normal || hard;
}

// The toolbar filters overlap on purpose: a pack finished before and part-way
// through a later round is both Completed and In progress.
export const FILTERS = [
	{ id: "all", label: "All" },
	{ id: "in-progress", label: "In progress" },
	{ id: "not-started", label: "Not started" },
	{ id: "completed", label: "Completed" },
];

export function matchesFilter(stat, filter) {
	switch (filter) {
		case "completed":
			return !!(stat && stat.finished);
		case "in-progress":
			return inProgress(stat);
		case "not-started":
			return !(stat && stat.finished) && !inProgress(stat) && !(stat && stat.roundMastered > 0);
		default:
			return true;
	}
}

export const SORT_OPTIONS = [
	{ id: "default", label: "Default order" },
	{ id: "most-completed", label: "Most completed" },
	{ id: "least-completed", label: "Least completed" },
	{ id: "highest-accuracy", label: "Highest accuracy" },
	{ id: "lowest-accuracy", label: "Lowest accuracy" },
	{ id: "harder-best", label: "Best first-try %" },
];

function timesOf(stats, p) {
	const s = stats[p.id];
	return s && Number.isFinite(s.completions) ? s.completions : 0;
}

// -1 for "no data", so those packs sit at the weak end of a highest sort and
// are never mistaken for a real 0%.
function accuracyOf(stats, p) {
	const s = stats[p.id];
	return s && Number.isFinite(s.lastRunPct) ? s.lastRunPct : -1;
}

function hardBestOf(stats, p) {
	const s = stats[p.id];
	return s && s.hard && Number.isFinite(s.hard.bestPct) ? s.hard.bestPct : -1;
}

// A row comparator for a SORT_OPTIONS id, or null for the default order. Ties
// fall back to the default order.
export function sortComparator(sortId, stats) {
	switch (sortId) {
		case "most-completed":
			return (a, b) => timesOf(stats, b) - timesOf(stats, a) || byDefaultOrder(a, b);
		case "least-completed":
			return (a, b) => timesOf(stats, a) - timesOf(stats, b) || byDefaultOrder(a, b);
		case "highest-accuracy":
			return (a, b) => accuracyOf(stats, b) - accuracyOf(stats, a) || byDefaultOrder(a, b);
		case "lowest-accuracy":
			// Packs with no data still go last.
			return (a, b) => {
				const x = accuracyOf(stats, a);
				const y = accuracyOf(stats, b);
				if ((x < 0) !== (y < 0)) return x < 0 ? 1 : -1;
				return x - y || byDefaultOrder(a, b);
			};
		case "harder-best":
			return (a, b) => hardBestOf(stats, b) - hardBestOf(stats, a) || byDefaultOrder(a, b);
		default:
			return null;
	}
}

// Lowercase without diacritics, for the search box.
export function foldText(s) {
	return String(s || "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "");
}

export function searchText(pack) {
	return foldText(`${pack.title} ${pack.desc} ${(pack.words || []).join(" ")}`);
}

// ---------------------------------------------------------------------------
// Share links
// ---------------------------------------------------------------------------

export function shareUrl(words) {
	const list = (words || []).map((w) => encodeURIComponent(w)).join(",");
	const origin = typeof window !== "undefined" && window.location ? window.location.origin : "https://grevocabtester.com";
	return `${origin}/wordpacks?words=${list}`;
}

// Copy text to the clipboard. Resolves true on success.
export async function copyText(text) {
	try {
		if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		/* fall through to the textarea fallback */
	}
	try {
		const ta = document.createElement("textarea");
		ta.value = text;
		ta.setAttribute("readonly", "");
		ta.style.position = "fixed";
		ta.style.opacity = "0";
		document.body.appendChild(ta);
		ta.select();
		const ok = document.execCommand("copy");
		document.body.removeChild(ta);
		return ok;
	} catch {
		return false;
	}
}
