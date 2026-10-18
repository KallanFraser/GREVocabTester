/** @format */
"use client";

// Opening /wordpacks?words=a,b,c (a "Copy share link" URL) offers to save the
// shared words as one of Your packs, or to study them straight away. Reads the
// URL with useSearchParams, so the page renders this inside a Suspense
// boundary (required by the static export). The vocabulary is imported on
// demand to check the words, so the page bundle stays small.
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MIN_PACK_WORDS } from "../../lib/packs";

// Drop ?words= from the address bar without a navigation.
export function clearWordsParam() {
	try {
		const url = new URL(window.location.href);
		if (!url.searchParams.has("words")) return;
		url.searchParams.delete("words");
		window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
	} catch {
		/* the param stays; harmless */
	}
}

export default function SharedPackOffer({ hidden, onSave }) {
	const params = useSearchParams();
	const raw = params ? params.get("words") : null;
	const [shared, setShared] = useState(null); // { words, unknown } once checked
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		if (!raw) {
			setShared(null);
			return undefined;
		}
		let alive = true;
		import("../../lib/words")
			.then(({ getWord }) => {
				if (!alive) return;
				const words = [];
				const seen = new Set();
				let unknown = 0;
				for (const part of raw.split(",")) {
					const s = part.trim();
					if (!s) continue;
					const e = getWord(s);
					if (!e) unknown += 1;
					else if (!seen.has(e.word)) {
						seen.add(e.word);
						words.push(e.word);
					}
				}
				setShared({ words, unknown });
			})
			.catch(() => alive && setShared({ words: [], unknown: 0 }));
		return () => {
			alive = false;
		};
	}, [raw]);

	if (!raw || !shared || dismissed || hidden) return null;

	function dismiss() {
		setDismissed(true);
		clearWordsParam();
	}

	const n = shared.words.length;
	const preview = shared.words.slice(0, 8).join(", ");
	const studyHref = `/play/test?words=${shared.words.map((w) => encodeURIComponent(w)).join(",")}`;

	return (
		<section className="pk-shared" aria-label="Shared pack">
			<div className="pk-shared-text">
				<p className="pk-shared-kicker">Shared pack</p>
				{n > 0 ? (
					<>
						<h2 className="pk-shared-title">
							Someone shared {n} {n === 1 ? "word" : "words"} with you
						</h2>
						<p className="pk-shared-words" title={shared.words.join(", ")}>
							{preview}
							{n > 8 ? `, and ${n - 8} more` : ""}
						</p>
						{shared.unknown > 0 && (
							<p className="pk-shared-note">
								{shared.unknown} {shared.unknown === 1 ? "word in the link is" : "words in the link are"} not in the word list and
								{shared.unknown === 1 ? " was" : " were"} left out.
							</p>
						)}
						{n < MIN_PACK_WORDS && (
							<p className="pk-shared-note">
								A pack needs at least {MIN_PACK_WORDS} words; you can add more before saving.
							</p>
						)}
					</>
				) : (
					<h2 className="pk-shared-title">This share link does not contain any words from the word list.</h2>
				)}
			</div>
			<div className="pk-shared-actions">
				{n > 0 && (
					<>
						<button type="button" className="btn-p" onClick={() => onSave(shared.words)}>
							Save to Your packs
						</button>
						<a className="btn-s" href={studyHref}>
							Study now
						</a>
					</>
				)}
				<button type="button" className="btn-q" onClick={dismiss}>
					Dismiss
				</button>
			</div>
		</section>
	);
}
