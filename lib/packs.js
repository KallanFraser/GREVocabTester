// lib/packs.js: word packs: the built-in list, custom packs, favorites, and
// working out which pack a play page was opened for.
//
// Built-in packs come from /data/wordpacks.json, normalized to
//   { id, title, desc, category, tier?, order?, words }
// where `words` are headwords (keys of gre_combined.json), never positions.
// Custom packs live in gv_custom_packs with ids prefixed "custom-".
// Favorites live in gv_favorites. Nothing here runs at import time.

import * as storage from "./storage.js";

export const PACKS_URL = "/data/wordpacks.json";
export const CUSTOM_PACKS_KEY = "gv_custom_packs";
export const FAVORITES_KEY = "gv_favorites";
export const CUSTOM_PREFIX = "custom-";
export const PACK_CATEGORIES = ["path", "theme", "classic"];
export const DEFAULT_CATEGORY = "classic";
export const MIN_PACK_WORDS = 5; // the Normal pool needs at least this many
export const MAX_TITLE_LENGTH = 48;
export const MAX_DESC_LENGTH = 100;

// Pre-overhaul keys, read once by the migrations below.
export const LEGACY_LEDGER_KEY = "wp_upvote_ledger_v2";
export const LEGACY_LIKE_PREFIX = "wp_likes:";
export const LEGACY_HANDOFF_KEY = "marketplaceWordpack";

function isPlainObject(v) {
	return !!v && typeof v === "object" && !Array.isArray(v);
}

function cleanText(v, max) {
	const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
	return max ? s.slice(0, max) : s;
}

// Distinct non-empty headword strings, in first-seen order.
export function cleanWords(list) {
	const out = [];
	const seen = new Set();
	for (const w of Array.isArray(list) ? list : []) {
		const s = typeof w === "string" ? w.trim() : "";
		if (s && !seen.has(s)) {
			seen.add(s);
			out.push(s);
		}
	}
	return out;
}

function finiteOrUndefined(v) {
	const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
	return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

// One built-in pack, repaired, or null when it has no id or no words.
export function normalizePack(raw) {
	if (!isPlainObject(raw)) return null;
	const id = cleanText(raw.id);
	const words = cleanWords(raw.words);
	if (!id || !words.length) return null;
	const pack = {
		id,
		title: cleanText(raw.title) || id,
		desc: cleanText(raw.desc),
		category: PACK_CATEGORIES.includes(raw.category) ? raw.category : DEFAULT_CATEGORY,
		words,
	};
	const tier = finiteOrUndefined(raw.tier);
	const order = finiteOrUndefined(raw.order);
	if (tier !== undefined) pack.tier = tier;
	if (order !== undefined) pack.order = order;
	return pack;
}

// ---------------------------------------------------------------------------
// Built-in packs
// ---------------------------------------------------------------------------

let packsPromise = null;
let consumedHandoff; // undefined: not read yet this page load

// Fetch /data/wordpacks.json once per page load and cache it. A failed fetch
// is not cached, so the next call retries. Resolves to an array (empty when
// the file is missing or malformed); duplicate ids keep the first.
// `opts.fetch` overrides the global fetch (tests).
export function loadPacks(opts = {}) {
	if (packsPromise) return packsPromise;
	const doFetch = opts.fetch || (typeof fetch === "function" ? (url) => fetch(url) : null);
	if (!doFetch) return Promise.resolve([]);
	const p = Promise.resolve()
		.then(() => doFetch(PACKS_URL))
		.then((res) => {
			if (!res || !res.ok) throw new Error(`Could not load ${PACKS_URL}`);
			return res.json();
		})
		.then((list) => {
			const seen = new Set();
			const out = [];
			for (const raw of Array.isArray(list) ? list : []) {
				const pack = normalizePack(raw);
				if (pack && !seen.has(pack.id)) {
					seen.add(pack.id);
					out.push(pack);
				}
			}
			return out;
		})
		.catch(() => {
			if (packsPromise === p) packsPromise = null;
			return [];
		});
	packsPromise = p;
	return p;
}

// Test hook: forget the cached pack list and the consumed handoff.
export function resetPacksCache() {
	packsPromise = null;
	consumedHandoff = undefined;
	handoffGeneration += 1;
}

export function isCustomPackId(id) {
	return typeof id === "string" && id.startsWith(CUSTOM_PREFIX) && id.length > CUSTOM_PREFIX.length;
}

// A built-in or custom pack by id, or null.
export async function findPack(id, opts) {
	if (typeof id !== "string" || !id) return null;
	if (isCustomPackId(id)) return getCustomPack(id);
	const packs = await loadPacks(opts);
	return packs.find((p) => p.id === id) || null;
}

// ---------------------------------------------------------------------------
// Custom packs: gv_custom_packs
// ---------------------------------------------------------------------------
//
// [{ id: "custom-…", title, desc, words, category: "custom", createdAt, updatedAt }]

function normalizeCustomPack(raw) {
	if (!isPlainObject(raw) || !isCustomPackId(raw.id)) return null;
	const words = cleanWords(raw.words);
	if (!words.length) return null;
	return {
		id: raw.id,
		title: cleanText(raw.title, MAX_TITLE_LENGTH) || "Custom pack",
		desc: cleanText(raw.desc, MAX_DESC_LENGTH),
		category: "custom",
		words,
		createdAt: typeof raw.createdAt === "string" ? raw.createdAt : null,
		updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
	};
}

// A stored or imported gv_custom_packs value, repaired: anything that is not
// an array is no packs; bad entries and repeated ids are dropped.
export function normalizeCustomPackList(raw) {
	const seen = new Set();
	const out = [];
	for (const item of Array.isArray(raw) ? raw : []) {
		const p = normalizeCustomPack(item);
		if (p && !seen.has(p.id)) {
			seen.add(p.id);
			out.push(p);
		}
	}
	return out;
}

export function loadCustomPacks() {
	return normalizeCustomPackList(storage.get(CUSTOM_PACKS_KEY, []));
}

function writeCustomPacks(list) {
	if (!storage.set(CUSTOM_PACKS_KEY, list)) throw new Error("Storage is full or blocked. The pack was not saved.");
}

export function getCustomPack(id) {
	return loadCustomPacks().find((p) => p.id === id) || null;
}

function randomSuffix() {
	const c = globalThis.crypto;
	if (c && typeof c.randomUUID === "function") return c.randomUUID().replace(/-/g, "").slice(0, 12);
	return Math.random().toString(36).slice(2, 14);
}

function validatedFields({ title, desc, words }) {
	const t = cleanText(title, MAX_TITLE_LENGTH);
	if (!t) throw new Error("Give the pack a title.");
	const w = cleanWords(words);
	if (w.length < MIN_PACK_WORDS) throw new Error(`Pick at least ${MIN_PACK_WORDS} words.`);
	return { title: t, desc: cleanText(desc, MAX_DESC_LENGTH), words: w };
}

// Create a custom pack. Throws an Error with a user-facing message when the
// title is empty or fewer than MIN_PACK_WORDS words are given. Callers should
// pass only real headwords. Returns the stored pack.
export function createCustomPack(fields = {}) {
	const f = validatedFields(fields);
	const list = loadCustomPacks();
	let id;
	do id = CUSTOM_PREFIX + randomSuffix();
	while (list.some((p) => p.id === id));
	const now = new Date().toISOString();
	const pack = { id, ...f, category: "custom", createdAt: now, updatedAt: now };
	writeCustomPacks([...list, pack]);
	return pack;
}

// Update title, desc and/or words of a custom pack. Returns the updated pack,
// or null when no pack has that id.
export function updateCustomPack(id, patch = {}) {
	const list = loadCustomPacks();
	const i = list.findIndex((p) => p.id === id);
	if (i < 0) return null;
	const cur = list[i];
	const f = validatedFields({
		title: patch.title !== undefined ? patch.title : cur.title,
		desc: patch.desc !== undefined ? patch.desc : cur.desc,
		words: patch.words !== undefined ? patch.words : cur.words,
	});
	const next = { ...cur, ...f, updatedAt: new Date().toISOString() };
	list[i] = next;
	writeCustomPacks(list);
	return next;
}

// Delete a custom pack and everything stored under its id: its Normal
// progress and Harder runs in both directions (the "#subset" Harder slot
// included), its Practice position, its favorite, and the home Continue card
// if it points here. Returns true when a pack was removed.
export function deleteCustomPack(id) {
	const list = loadCustomPacks();
	const next = list.filter((p) => p.id !== id);
	if (next.length === list.length) return false;
	writeCustomPacks(next);
	removePackData(id);
	return true;
}

// Prefixes and keys owned by lib/progress.js (not imported from there, since
// it imports this file).
const SCOPED_FILE_PREFIXES = ["gv_progress_", "gv_hard_"];
const SUBSET_SUFFIX = "#subset";
const PRACTICE_POS_KEY = "gv_practice_pos";
const LAST_PACK_KEY = "gv_last_pack";

function removePackData(id) {
	for (const prefix of SCOPED_FILE_PREFIXES) {
		for (const key of storage.keys(prefix)) {
			const file = storage.get(key, null);
			if (!isPlainObject(file) || !isPlainObject(file.scopes)) continue;
			const own = (k) => Object.prototype.hasOwnProperty.call(file.scopes, k);
			if (!own(id) && !own(id + SUBSET_SUFFIX)) continue;
			delete file.scopes[id];
			delete file.scopes[id + SUBSET_SUFFIX];
			storage.set(key, file);
		}
	}
	const pos = storage.get(PRACTICE_POS_KEY, null);
	if (isPlainObject(pos) && Object.prototype.hasOwnProperty.call(pos, id)) {
		delete pos[id];
		storage.set(PRACTICE_POS_KEY, pos);
	}
	const last = storage.get(LAST_PACK_KEY, null);
	if (isPlainObject(last) && last.id === id) storage.remove(LAST_PACK_KEY);
	// A missing gv_favorites is left alone so the legacy migration still runs
	// on its first read (the old likes never name a custom pack).
	if (storage.getRaw(FAVORITES_KEY) !== null && loadFavorites().includes(id)) setFavorite(id, false);
}

// ---------------------------------------------------------------------------
// Favorites: gv_favorites = { version: 1, ids: [packId, …] }
// ---------------------------------------------------------------------------
//
// The first read with no gv_favorites copies the old site's likes into it:
// wp_upvote_ledger_v2 ({ "<packId>": true }) and the older wp_likes:<packId>
// keys (a count; > 0 means liked). The legacy keys are left in place; the
// presence of gv_favorites is what marks the migration done.

const FAVORITES_VERSION = 1;

function migrateLegacyFavorites() {
	const ids = [];
	const ledger = storage.get(LEGACY_LEDGER_KEY, null);
	if (isPlainObject(ledger)) {
		for (const [id, v] of Object.entries(ledger)) if (id && v === true) ids.push(id);
	}
	for (const key of storage.keys(LEGACY_LIKE_PREFIX)) {
		const id = key.slice(LEGACY_LIKE_PREFIX.length);
		const n = Number(storage.getRaw(key));
		if (id && Number.isFinite(n) && n > 0) ids.push(id);
	}
	return [...new Set(ids)];
}

// A stored or imported gv_favorites value, repaired: anything malformed is no
// favorites.
export function normalizeFavoritesValue(raw) {
	const ids = isPlainObject(raw) && Array.isArray(raw.ids) ? cleanWords(raw.ids) : [];
	return { version: FAVORITES_VERSION, ids };
}

// The favorite pack ids, in the order they were added. A gv_favorites that
// exists but is malformed reads as none (the migration has already run).
export function loadFavorites() {
	if (storage.getRaw(FAVORITES_KEY) !== null) return normalizeFavoritesValue(storage.get(FAVORITES_KEY, null)).ids;
	const ids = migrateLegacyFavorites();
	storage.set(FAVORITES_KEY, { version: FAVORITES_VERSION, ids });
	return ids;
}

export function isFavorite(id) {
	return loadFavorites().includes(id);
}

// Add or remove one favorite. Returns the new id list.
export function setFavorite(id, on) {
	if (typeof id !== "string" || !id) return loadFavorites();
	const cur = loadFavorites().filter((x) => x !== id);
	const ids = on ? [...cur, id] : cur;
	storage.set(FAVORITES_KEY, { version: FAVORITES_VERSION, ids });
	return ids;
}

export function toggleFavorite(id) {
	return setFavorite(id, !isFavorite(id));
}

// ---------------------------------------------------------------------------
// Pack context for a play page
// ---------------------------------------------------------------------------

const LEGACY_INDEX_LIST = /^\s*\d+(\s*,\s*\d+)*\s*,?\s*$/;

function paramReader(searchParams) {
	if (!searchParams) return () => null;
	if (typeof searchParams.get === "function") return (k) => searchParams.get(k);
	if (typeof searchParams === "string") {
		const p = new URLSearchParams(searchParams);
		return (k) => p.get(k);
	}
	if (isPlainObject(searchParams)) {
		return (k) => {
			const v = searchParams[k];
			return Array.isArray(v) ? (v.length ? String(v[0]) : null) : v == null ? null : String(v);
		};
	}
	return () => null;
}

function parseIndices(csv) {
	return csv
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean)
		.map((s) => Number(s))
		.filter((n) => Number.isInteger(n) && n >= 0);
}

// Read and delete the old one-time handoff (an index array written by the
// pre-overhaul /wordpacks page). A resolve started in the same tick (React
// StrictMode's double mount, Wortschatz L15) gets the same value instead of
// nothing; after that tick the cached copy is cleared, so a play page opened
// later in the same page load (client navigation) never picks it up again.
function takeLegacyHandoff() {
	if (consumedHandoff !== undefined) return consumedHandoff;
	const raw = storage.get(LEGACY_HANDOFF_KEY, null);
	storage.remove(LEGACY_HANDOFF_KEY);
	consumedHandoff = Array.isArray(raw) ? raw.filter((n) => Number.isInteger(n) && n >= 0) : null;
	return consumedHandoff;
}

let handoffGeneration = 0; // bumped by resetPacksCache, so a stale timer is a no-op
function spendHandoffSoon() {
	const gen = handoffGeneration;
	const spend = () => {
		if (gen === handoffGeneration) consumedHandoff = null;
	};
	if (typeof setTimeout === "function") setTimeout(spend, 0);
	else spend();
}

async function defaultResolveLegacyIndices(indices) {
	const mod = await import("./words.js");
	return mod.resolveLegacyIndices(indices);
}

function context(id, title, words, source) {
	const w = cleanWords(words);
	return w.length ? { id, title, words: w, source } : null;
}

// Which pack a play page was opened for, from its URL (pass
// window.location.search, a URLSearchParams, or Next's searchParams object).
// Resolves to { id, title, words, source }, null for the full word list, or
// { missingId } when the URL names a pack that no longer exists (show
// MISSING_PACK_NOTICE and use the full word list).
// `id` is null for ad-hoc selections that have no pack (share links, legacy
// index lists); `source` is one of 'pack', 'custom', 'words', 'legacy' or
// 'handoff', so the caller can tidy the URL.
//
// In order:
//   ?pack=<id>          a built-in or custom pack
//   ?pack=12,45,…       the old index-list share format (digits only), via
//                       lib/words.js resolveLegacyIndices
//   ?words=a,b,c        the share-link format (headwords)
//   ?id=<packId>        the old /wordpacks link format
//   marketplaceWordpack the old one-time localStorage handoff
// The legacy handoff key is always read and deleted, even when the URL wins,
// so it can never linger into a later visit.
//
// Headwords from ?words= are passed through as typed (trimmed, deduplicated);
// filter them against the vocabulary before use. `opts` may supply `fetch`
// (for loadPacks) and `resolveLegacyIndices(indices) -> headwords`.
export async function resolvePackContext(searchParams, opts = {}) {
	const get = paramReader(searchParams);
	const handoff = takeLegacyHandoff();
	if (handoff !== null) spendHandoffSoon();
	const resolveLegacy = typeof opts.resolveLegacyIndices === "function" ? opts.resolveLegacyIndices : defaultResolveLegacyIndices;
	const legacyWords = async (indices) => {
		if (!indices.length) return [];
		try {
			return (await resolveLegacy(indices)) || [];
		} catch {
			return [];
		}
	};

	// An id that names no pack: a deleted custom pack, or a built-in id the
	// (successfully loaded) pack list does not have. A failed pack list load is
	// not evidence that the pack is gone.
	let missingId = null;
	const lookUp = async (id) => {
		const found = await findPack(id, opts);
		if (found) return context(found.id, found.title, found.words, isCustomPackId(found.id) ? "custom" : "pack");
		if (!missingId && (isCustomPackId(id) || (await loadPacks(opts)).length > 0)) missingId = id;
		return null;
	};

	const pack = (get("pack") || "").trim();
	if (pack) {
		if (LEGACY_INDEX_LIST.test(pack)) {
			const words = await legacyWords(parseIndices(pack));
			const ctx = context(null, "Shared selection", words, "legacy");
			if (ctx) return ctx;
		} else {
			const ctx = await lookUp(pack);
			if (ctx) return ctx;
		}
	}

	const wordsParam = get("words");
	if (wordsParam) {
		const ctx = context(null, "Shared selection", wordsParam.split(","), "words");
		if (ctx) return ctx;
	}

	const legacyId = (get("id") || "").trim();
	if (legacyId) {
		const ctx = await lookUp(legacyId);
		if (ctx) return ctx;
	}

	if (handoff && handoff.length) {
		const ctx = context(null, "Selected pack", await legacyWords(handoff), "handoff");
		if (ctx) return ctx;
	}
	return missingId ? { missingId } : null;
}

// The copy play pages show for resolvePackContext's { missingId } result.
export const MISSING_PACK_NOTICE = "That pack no longer exists, showing all words.";

export function isMissingPack(ctx) {
	return !!ctx && typeof ctx.missingId === "string" && !Array.isArray(ctx.words);
}
