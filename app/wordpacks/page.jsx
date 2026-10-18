/** @format */
"use client";

// Word Packs, ported from Wortschatz's /wordpacks: the learning path with an
// "Up next" panel on top (components/packs/UpNext.jsx), then a sticky toolbar
// and the compact, collapsible list of every pack by category
// (components/packs/PackList.jsx). Built-in packs come from loadPacks() in
// lib/packs.js and are read by their `words`, never by position; custom packs
// and favorites also live in lib/packs.js. Every storage read happens after
// mount, so the static HTML is the loading state. Metadata lives in layout.jsx.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "../../styles/wordpacks.css";
import ConfirmDialog from "../../components/ConfirmDialog";
import UpNext from "../../components/packs/UpNext";
import PackList from "../../components/packs/PackList";
import SharedPackOffer, { clearWordsParam } from "../../components/packs/SharedPackOffer";
import {
	CATEGORY_CLASSIC,
	CATEGORY_CUSTOM,
	CATEGORY_FAVORITES,
	COLLAPSED_AT_START,
	FILTERS,
	SORT_OPTIONS,
	computeStats,
	copyText,
	foldText,
	groupSections,
	isRetest,
	matchesFilter,
	nextRoundLabel,
	pathPacks,
	searchText,
	shareUrl,
	sortComparator,
} from "../../components/packs/packUtils";
import { loadCustomPacks, loadFavorites, loadPacks, setFavorite } from "../../lib/packs";
import { clearLastPack, clearScopeProgress, loadLastPack, saveLastPack, scopeIdFor } from "../../lib/progress";
import { DIRECTION_LABEL, SETTINGS_EVENT, loadSettings } from "../../lib/settings";

// The builder carries the whole vocabulary, so it loads only when opened.
const PackBuilder = dynamic(() => import("../../components/packs/PackBuilder"), { ssr: false, loading: () => null });

const RESERVED = new Set([CATEGORY_CUSTOM, CATEGORY_FAVORITES]);

// loadPacks() resolves to [] on a failed fetch and folds categories it does
// not know into 'classic'. Its fetch is wrapped here to notice a failure (for
// the error state) and to keep whatever category each pack declares, so any
// category the JSON adds renders as its own section.
function fetchPacks() {
	let failed = false;
	const categories = {};
	const doFetch = (url) =>
		fetch(url).then(
			async (res) => {
				if (!res || !res.ok) {
					failed = true;
					return res;
				}
				try {
					const list = await res.clone().json();
					for (const raw of Array.isArray(list) ? list : []) {
						const id = raw && typeof raw.id === "string" ? raw.id.trim() : "";
						const c = raw && typeof raw.category === "string" ? raw.category.trim() : "";
						if (id && c && !RESERVED.has(c) && !(id in categories)) categories[id] = c;
					}
				} catch {
					failed = true;
				}
				return res;
			},
			(e) => {
				failed = true;
				throw e;
			},
		);
	return loadPacks({ fetch: doFetch }).then((packs) => ({
		failed: failed && packs.length === 0,
		packs: packs.map((p) => ({ ...p, category: categories[p.id] || p.category || CATEGORY_CLASSIC })),
	}));
}

export default function WordPacksPage() {
	const [builtIn, setBuiltIn] = useState(null); // null while loading
	const [error, setError] = useState(false);
	const [attempt, setAttempt] = useState(0);
	const [custom, setCustom] = useState([]);
	const [favoriteIds, setFavoriteIds] = useState([]);
	const [direction, setDirection] = useState(null); // null until mounted
	const [stats, setStats] = useState(null); // null until packs and direction are in
	const [tick, setTick] = useState(0); // bumped when storage may have changed
	const [selectedPath, setSelectedPath] = useState(null);
	const [closedCats, setClosedCats] = useState(() => new Set(COLLAPSED_AT_START));
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState("all");
	const [sort, setSort] = useState("default");
	const [builder, setBuilder] = useState(null); // { pack } to edit, { initial } to create
	const [pendingRetest, setPendingRetest] = useState(null);
	const [notice, setNotice] = useState("");
	const [sharedSaved, setSharedSaved] = useState(false); // the ?words= offer was acted on
	const toolbarRef = useRef(null);

	// Everything from storage, read after mount and again whenever another tab
	// or a Back navigation (bfcache) may have changed it.
	const readStorage = useCallback(() => {
		setDirection(loadSettings().direction);
		setCustom(loadCustomPacks());
		setFavoriteIds(loadFavorites());
		setTick((n) => n + 1);
	}, []);

	useEffect(() => {
		readStorage();
		const onShow = (e) => e.persisted && readStorage();
		window.addEventListener("storage", readStorage);
		window.addEventListener("pageshow", onShow);
		window.addEventListener(SETTINGS_EVENT, readStorage);
		return () => {
			window.removeEventListener("storage", readStorage);
			window.removeEventListener("pageshow", onShow);
			window.removeEventListener(SETTINGS_EVENT, readStorage);
		};
	}, [readStorage]);

	useEffect(() => {
		let alive = true;
		setBuiltIn(null);
		setError(false);
		fetchPacks().then(({ failed, packs }) => {
			if (!alive) return;
			setError(failed);
			setBuiltIn(packs);
		});
		return () => {
			alive = false;
		};
	}, [attempt]);

	const allPacks = useMemo(() => (builtIn ? [...builtIn, ...custom] : []), [builtIn, custom]);

	useEffect(() => {
		if (!builtIn || !direction) return;
		setStats(computeStats(allPacks, direction));
	}, [allPacks, builtIn, direction, tick]);

	const statsReady = stats !== null;
	const statMap = stats || {};
	const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);
	const path = useMemo(() => pathPacks(allPacks), [allPacks]);

	const q = foldText(query.trim());
	const filtering = q !== "" || filter !== "all";
	const sections = useMemo(() => {
		const list = filtering
			? allPacks.filter((p) => (!q || searchText(p).includes(q)) && matchesFilter(statMap[p.id], filter))
			: allPacks;
		return groupSections(list, favoriteIds, sortComparator(sort, statMap));
	}, [allPacks, filtering, q, filter, sort, statMap, favoriteIds]);
	const matchCount = new Set(sections.flatMap((s) => s.packs.map((p) => p.id))).size;
	const categoryCount = useMemo(() => groupSections(allPacks, [], null).length, [allPacks]);

	// The toolbar sticks under the navbar and its height changes as the chips
	// wrap. Publish it so rows and sections clear it in scroll-margin-top.
	useEffect(() => {
		const el = toolbarRef.current;
		if (!el || !el.parentElement) return undefined;
		const host = el.parentElement;
		const publish = () => host.style.setProperty("--pl-toolbar-h", `${Math.ceil(el.getBoundingClientRect().height)}px`);
		publish();
		if (typeof ResizeObserver === "undefined") return undefined;
		const ro = new ResizeObserver(publish);
		ro.observe(el);
		return () => ro.disconnect();
	}, [builtIn, error]);

	// Links into the modes carry ?pack=<id> (and ?mode= for Test, which Test
	// mode applies and saves itself); this records the pack for the home page's
	// Continue card before the browser follows the link.
	function openPack(pack) {
		saveLastPack({ id: pack.id, title: pack.title, words: pack.words });
	}

	function toggleFavorite(pack) {
		setFavoriteIds(setFavorite(pack.id, !favorites.has(pack.id)));
	}

	async function sharePack(pack) {
		const ok = await copyText(shareUrl(pack.words));
		setNotice(ok ? `Share link for ${pack.title} copied.` : "Copying is blocked in this browser. Open Edit to copy the link by hand.");
	}

	function toggleCategory(category) {
		setClosedCats((prev) => {
			const next = new Set(prev);
			if (next.has(category)) next.delete(category);
			else next.add(category);
			return next;
		});
	}

	function clearSearch() {
		setQuery("");
		setFilter("all");
	}

	function confirmRetest() {
		if (pendingRetest && direction) clearScopeProgress(direction, scopeIdFor(pendingRetest.id));
		setPendingRetest(null);
		setTick((n) => n + 1);
	}

	function onSaved(pack, edited) {
		setBuilder(null);
		setCustom(loadCustomPacks());
		setClosedCats((prev) => {
			const next = new Set(prev);
			next.delete(CATEGORY_CUSTOM);
			return next;
		});
		if (!edited && builder && builder.initial && builder.initial.words) {
			setSharedSaved(true);
			clearWordsParam();
		}
		setNotice(edited ? `Saved changes to ${pack.title}.` : `${pack.title} was added to Your packs.`);
	}

	function onDeleted(id) {
		setBuilder(null);
		setFavoriteIds(setFavorite(id, false));
		const last = loadLastPack();
		if (last && last.id === id) clearLastPack();
		setCustom(loadCustomPacks());
		setNotice("The pack was deleted.");
	}

	const loading = builtIn === null;
	const retestStat = pendingRetest ? statMap[pendingRetest.id] : null;
	const retestTotal = retestStat && Number.isFinite(retestStat.total) ? retestStat.total : 0;
	const retestTimes = retestStat && Number.isFinite(retestStat.completions) ? retestStat.completions : 0;
	const directionLabel = direction ? DIRECTION_LABEL[direction] || "" : "";
	const builtInCount = builtIn ? builtIn.length : 0;

	return (
		<main id="wordpacks" className="packs-page">
			<header className="pk-header">
				<h1>Word Packs</h1>
				<p className="sub">
					Focused sets of GRE vocabulary you can finish. Follow the learning path from Core to Advanced, study by
					theme, or build a pack of your own. Each pack keeps its own progress in every study mode.
				</p>
				<div className="pk-header-meta">
					{builtIn && allPacks.length > 0 && (
						<p className="pk-meta">
							{allPacks.length} {allPacks.length === 1 ? "pack" : "packs"} in {categoryCount}{" "}
							{categoryCount === 1 ? "category" : "categories"}
						</p>
					)}
					{directionLabel && <p className="pk-meta">Progress shown for {directionLabel}</p>}
					<button type="button" className="btn-p pk-build" onClick={() => setBuilder({ initial: null })}>
						Build a pack
					</button>
				</div>
			</header>

			<div className="pl-page">
				<Suspense fallback={null}>
					<SharedPackOffer hidden={!!builder || sharedSaved} onSave={(words) => setBuilder({ initial: { title: "Shared pack", words } })} />
				</Suspense>

				<p className="pk-notice" aria-live="polite">
					{notice}
				</p>

				{loading ? (
					<section className="pk-status" aria-busy="true">
						<div className="pk-spinner" aria-hidden="true" />
						<p>Loading word packs…</p>
					</section>
				) : error ? (
					<section className="pk-status" role="alert">
						<p>The word packs could not be loaded. Check your connection and try again.</p>
						<button type="button" className="btn-s" onClick={() => setAttempt((n) => n + 1)}>
							Try again
						</button>
					</section>
				) : (
					<>
						<UpNext
							path={path}
							stats={statMap}
							statsReady={statsReady}
							selectedId={selectedPath}
							onSelect={setSelectedPath}
							directionLabel={directionLabel}
							favorites={favorites}
							onToggleFavorite={toggleFavorite}
							onOpen={openPack}
							onRetest={setPendingRetest}
						/>

						<div className="pl-toolbar" role="search" ref={toolbarRef}>
							<input
								type="search"
								className="pl-search"
								placeholder="Search packs or words"
								aria-label="Search packs by title, description or word"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
							/>
							<div className="pl-filters" role="group" aria-label="Filter packs">
								{FILTERS.map((f) => (
									<button
										key={f.id}
										type="button"
										className="pl-filter"
										aria-pressed={filter === f.id}
										onClick={() => setFilter(f.id)}
									>
										{f.label}
									</button>
								))}
							</div>
							<select className="pl-sort" aria-label="Sort packs" value={sort} onChange={(e) => setSort(e.target.value)}>
								{SORT_OPTIONS.map((s) => (
									<option key={s.id} value={s.id}>
										Sort: {s.label}
									</option>
								))}
							</select>
							{filtering && (
								<p className="pl-results" aria-live="polite">
									{matchCount} {matchCount === 1 ? "pack matches" : "packs match"}
								</p>
							)}
						</div>

						{sections.length === 0 ? (
							<section className="pk-status pl-empty">
								<p>{filtering ? "No packs match this search and filter." : "No word packs are available yet."}</p>
								{filtering && (
									<button type="button" className="btn-s" onClick={clearSearch}>
										Clear search and filters
									</button>
								)}
							</section>
						) : (
							<PackList
								sections={sections}
								stats={statMap}
								statsReady={statsReady}
								favorites={favorites}
								isOpen={(c) => !closedCats.has(c)}
								forceOpen={filtering}
								onToggle={toggleCategory}
								rowProps={{
									onToggleFavorite: toggleFavorite,
									onOpen: openPack,
									onRetest: setPendingRetest,
									onEdit: (pack) => setBuilder({ pack }),
									onShare: sharePack,
								}}
							/>
						)}

						{!filtering && custom.length === 0 && (
							<section className="pk-yours">
								<div>
									<h2 className="pk-yours-title">Your packs</h2>
									<p className="pk-yours-text">
										Pick any words from the full list, name the set and study it in every mode. Share it with a
										link; whoever opens it can save a copy.
									</p>
								</div>
								<button type="button" className="btn-s" onClick={() => setBuilder({ initial: null })}>
									Build a pack
								</button>
							</section>
						)}
						{builtInCount === 0 && sections.length > 0 && !filtering && (
							<p className="pk-meta pk-center">No built-in packs are available right now.</p>
						)}
					</>
				)}
			</div>

			{builder && (
				<PackBuilder
					pack={builder.pack || null}
					initial={builder.initial || null}
					onSaved={onSaved}
					onDeleted={onDeleted}
					onClose={() => setBuilder(null)}
				/>
			)}

			{/* Re-test: the pack's round is finished, so a new round starts. Nothing
			    finished is lost (it stays N / N with its completions), so the
			    dialog is neutral. Plain resets live inside Test mode. */}
			{pendingRetest && (
				<ConfirmDialog
					tone="neutral"
					title={`${nextRoundLabel(retestStat)} of ${pendingRetest.title} (Normal)?`}
					body={`You study every word in this pack again${directionLabel ? ` for ${directionLabel}` : ""}. The pack stays at ${retestTotal} / ${retestTotal} mastered and keeps its completion count (${retestTimes} so far); finishing the new round counts as another completion. Harder runs and other packs are not affected.`}
					confirmLabel={isRetest(retestStat) ? nextRoundLabel(retestStat) : "Start new round"}
					onConfirm={confirmRetest}
					onCancel={() => setPendingRetest(null)}
				/>
			)}
		</main>
	);
}
