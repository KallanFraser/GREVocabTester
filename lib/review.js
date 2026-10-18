// lib/review.js: the daily spaced-review schedule. Ported from Wortschatz.
// Pure: no React, no localStorage, no dataset imports. lib/progress.js owns
// the storage key (gv_review_<direction>) and calls into this file.
//
// Keys are GRE headwords ("Abate"), one schedule per direction.
//
// A word enters review the first time it is mastered anywhere (any pack, the
// global feed or a Choose Words selection; Normal or Harder) and then comes
// back on the REVIEW_INTERVALS ladder:
//   - correct on the first try of a session -> one step up the ladder
//     (the top step repeats);
//   - any miss -> back to the first step (1 day), and the word must still be
//     answered correctly before the session ends. Only the first answer of a
//     session moves the schedule.
//
// Review state is separate from pack mastery. Nothing here reads or changes a
// scope's mastered list, streaks or completions.
//
// Dates are LOCAL calendar days as "YYYY-MM-DD" strings, so "due today" flips
// at the learner's midnight, not UTC's. Zero-padded ISO days also compare
// correctly as plain strings.

export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60, 120]; // days
export const REVIEW_SEED_SPREAD_DAYS = 14; // existing mastered words spread over this many days
export const DEFAULT_REVIEW_CAP = 50; // most words reviewed per day, per direction
export const REVIEW_CAP_OPTIONS = [10, 20, 30, 50, 100, 200];
// After a miss the word sits out this many other cards before it comes back,
// so the retry tests recall rather than the feedback card still on screen.
export const REVIEW_RETRY_GAP = 3;

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isPlainObject(v) {
	return !!v && typeof v === "object" && !Array.isArray(v);
}

function pad(n) {
	return String(n).padStart(2, "0");
}

// The learner's local calendar day for `date`.
export function localDay(date = new Date()) {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// A local-midnight Date for a "YYYY-MM-DD" string, or null when it is not a
// real calendar day ("2026-02-31" round-trips to March and is rejected).
export function parseDay(day) {
	if (typeof day !== "string") return null;
	const m = DAY_RE.exec(day);
	if (!m) return null;
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	return localDay(d) === day ? d : null;
}

// Calendar arithmetic through the Date constructor, which keeps local midnight
// across DST changes (a fixed 86,400,000 ms step would not).
export function addDays(day, n) {
	const d = parseDay(day);
	if (!d) return day;
	return localDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

export function isValidInterval(n) {
	return REVIEW_INTERVALS.includes(n);
}

// One step up the ladder; the top step repeats.
export function nextInterval(interval) {
	const i = REVIEW_INTERVALS.indexOf(interval);
	if (i < 0) return REVIEW_INTERVALS[0];
	return REVIEW_INTERVALS[Math.min(i + 1, REVIEW_INTERVALS.length - 1)];
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------
//
//   {
//     seeded: true,                                   // existing mastery already enrolled
//     words:  { "Abate": { interval: 3, due: "2026-10-12" } },
//     day:    { date: "2026-10-09", reviewed: 12 }    // first answers today, for the cap
//   }

export function emptyReviewState() {
	return { seeded: false, words: {}, day: { date: "", reviewed: 0 } };
}

// Anything stored is repaired rather than trusted: a non-object reads as empty
// (and unseeded, so existing mastery is re-enrolled); an entry with a bad
// interval drops to the first step; an entry with a bad date is due `today`
// rather than lost; a non-object entry is dropped.
export function normalizeReviewState(raw, today = localDay()) {
	if (!isPlainObject(raw)) return emptyReviewState();
	const words = {};
	if (isPlainObject(raw.words)) {
		for (const [key, val] of Object.entries(raw.words)) {
			// "__proto__" and friends are never words, and assigning one would
			// swap the object's prototype.
			if (!key || UNSAFE_KEYS.has(key) || !isPlainObject(val)) continue;
			const interval = Number(val.interval);
			words[key] = {
				interval: isValidInterval(interval) ? interval : REVIEW_INTERVALS[0],
				due: parseDay(val.due) ? val.due : today,
			};
		}
	}
	const d = isPlainObject(raw.day) ? raw.day : {};
	const reviewed = Number(d.reviewed);
	return {
		seeded: raw.seeded === true,
		words,
		day: {
			date: parseDay(d.date) ? d.date : "",
			reviewed: Number.isInteger(reviewed) && reviewed > 0 ? reviewed : 0,
		},
	};
}

// Put a newly mastered word on the ladder: first step, due tomorrow. A word
// already under review keeps its schedule: re-mastering it in another pack is
// not a reason to pull it forward.
export function enrollWord(state, key, today = localDay()) {
	if (!key || state.words[key]) return state;
	const interval = REVIEW_INTERVALS[0];
	return { ...state, words: { ...state.words, [key]: { interval, due: addDays(today, interval) } } };
}

// Enroll everything that was already mastered before review existed, spread
// evenly over the next REVIEW_SEED_SPREAD_DAYS days (today included) so the
// first day is not a pile of every mastered word at once. `keys` should be in
// a stable order (alphabetical for GRE); keys already under review are left
// alone. Marks the state seeded either way, so this runs once.
export function seedReviewState(state, keys, today = localDay()) {
	const fresh = [...new Set(keys || [])].filter((k) => k && !state.words[k]);
	const words = { ...state.words };
	const n = fresh.length;
	fresh.forEach((k, i) => {
		const offset = Math.floor((i * REVIEW_SEED_SPREAD_DAYS) / n);
		words[k] = { interval: REVIEW_INTERVALS[0], due: addDays(today, offset) };
	});
	return { ...state, seeded: true, words };
}

// The schedule entry after a session's FIRST answer to a word.
export function applyReviewResult(entry, correctFirstTry, today = localDay()) {
	const current = entry && isValidInterval(entry.interval) ? entry.interval : REVIEW_INTERVALS[0];
	const interval = correctFirstTry ? nextInterval(current) : REVIEW_INTERVALS[0];
	return { interval, due: addDays(today, interval) };
}

export function isDue(entry, today = localDay()) {
	return !!entry && typeof entry.due === "string" && entry.due <= today;
}

// Due keys, most overdue first; ties by `rank` (lower first) when given and
// numeric, else alphabetically by headword. `isKnown(key)` filters out words
// that no longer exist in the dataset.
export function dueKeys(state, today = localDay(), { isKnown, rank } = {}) {
	const out = [];
	for (const [key, entry] of Object.entries(state.words)) {
		if (isKnown && !isKnown(key)) continue;
		if (isDue(entry, today)) out.push(key);
	}
	const r = typeof rank === "function" ? rank : null;
	const rankOf = (k) => {
		const v = r ? r(k) : undefined;
		return Number.isFinite(v) ? v : Infinity;
	};
	return out.sort((a, b) => {
		const da = state.words[a].due;
		const db = state.words[b].due;
		if (da !== db) return da < db ? -1 : 1;
		const ra = rankOf(a);
		const rb = rankOf(b);
		if (ra !== rb) return ra < rb ? -1 : 1;
		return compareHeadwords(a, b);
	});
}

// Alphabetical, case-insensitive first so "abate" and "Abate" sort together,
// then by code unit so the order is total and stable.
export function compareHeadwords(a, b) {
	const la = a.toLowerCase();
	const lb = b.toLowerCase();
	if (la !== lb) return la < lb ? -1 : 1;
	return a < b ? -1 : a > b ? 1 : 0;
}

// First answers already given today. A stored count from another day is zero.
export function reviewedToday(state, today = localDay()) {
	return state.day && state.day.date === today ? state.day.reviewed : 0;
}

export function countReviewed(state, today = localDay()) {
	return { ...state, day: { date: today, reviewed: reviewedToday(state, today) + 1 } };
}

function normalizeCap(cap) {
	const n = Number(cap);
	return Number.isInteger(n) && n > 0 ? n : DEFAULT_REVIEW_CAP;
}

// What today's session would contain: the due keys, cut to whatever is left of
// the daily cap. `due` is the uncapped count, for "120 due, 50 today" copy.
export function reviewQueue(state, today = localDay(), cap = DEFAULT_REVIEW_CAP, opts) {
	const due = dueKeys(state, today, opts);
	const left = Math.max(0, normalizeCap(cap) - reviewedToday(state, today));
	return { keys: due.slice(0, left), due: due.length, remaining: left };
}

// The { isKnown, rank } options for a gre_combined.json-shaped object (keyed
// by headword). Own-property check, so a stored key like "constructor" is
// never mistaken for a word. GRE entries carry no rank today, so ties fall
// back to alphabetical order; a numeric `rank` field is used if one is added.
export function wordReviewOpts(words) {
	const has = (k) => !!words && Object.prototype.hasOwnProperty.call(words, k);
	return {
		isKnown: has,
		rank: (k) => (has(k) && words[k] && Number.isFinite(words[k].rank) ? words[k].rank : undefined),
	};
}

// ---------------------------------------------------------------------------
// One session
// ---------------------------------------------------------------------------

// A session over a fixed key list. Each key must be answered correctly once
// before the session is done; a miss puts it back REVIEW_RETRY_GAP cards later
// (or at the end, if fewer are left). `record` returns whether this was the
// key's first answer, which is the only one the caller should persist.
export function createReviewSession(keys) {
	const queue = [...new Set(keys || [])];
	const total = queue.length;
	const first = new Map(); // key -> correct on first try
	const misses = new Map(); // key -> miss count
	let done = 0;

	return {
		next() {
			return queue.length ? queue[0] : null;
		},
		record(key, correct) {
			if (queue[0] !== key) throw new Error(`record(${key}) is not the current card`);
			const isFirst = !first.has(key);
			if (isFirst) first.set(key, !!correct);
			queue.shift();
			if (correct) {
				done += 1;
			} else {
				misses.set(key, (misses.get(key) || 0) + 1);
				queue.splice(Math.min(REVIEW_RETRY_GAP, queue.length), 0, key);
			}
			return { firstAnswer: isFirst };
		},
		isDone() {
			return queue.length === 0;
		},
		stats() {
			const missed = [...misses.entries()].map(([key, n]) => ({ key, misses: n }));
			let correctFirstTry = 0;
			for (const v of first.values()) if (v) correctFirstTry += 1;
			return { total, reviewed: first.size, done, correctFirstTry, missed };
		},
	};
}
