/** @format */
"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import "../styles/globals.css";
import "../styles/menu.css";
import vocabData from "../src/data/gre_combined.json";
import stringSimilarity from "string-similarity";

export default function TestMode({ onBack }) {
	const allKeys = Object.keys(vocabData);

	// — Sets & Refs —
	const [activeKeys, setActiveKeys] = useState(() => new Set(allKeys));
	const yesSound = useRef(null);
	const noSound = useRef(null);

	// — State —
	const [activeSubset, setActiveSubset] = useState([]);
	const [masteryCounts, setMasteryCounts] = useState({});
	const [currentIndex, setCurrentIndex] = useState(0);
	const [currentWord, setCurrentWord] = useState("");
	const [currentDefinition, setCurrentDefinition] = useState("");
	const [currentExample, setCurrentExample] = useState("");
	const [currentFullDefinition, setCurrentFullDefinition] = useState("");
	const [inputValue, setInputValue] = useState("");
	const [alertMessage, setAlertMessage] = useState("");
	const [showOverlay, setShowOverlay] = useState(false);
	const [showPopup, setShowPopup] = useState(false);

	/*-------------------------------- Helpers --------------------------------*/
	const sanitize = (s) => (s ? s.replaceAll('"', "") : "");
	const pickRandomIndex = (len) => Math.floor(Math.random() * len);

	const subsetFromKeys = (keysSet) => {
		const keys = Array.from(keysSet);
		return Array.from({ length: 5 }, () => keys[pickRandomIndex(keys.length)]);
	};

	const setCurrentByWord = (word, idx = null) => {
		const data = vocabData[word] || {};
		setCurrentIndex(idx ?? activeSubset.indexOf(word));
		setCurrentWord(word);
		setCurrentDefinition(data.definition || "");
		setCurrentExample(sanitize(data.example));
		setCurrentFullDefinition(sanitize(data.fullDefinition));
	};

	const resetGameFromActive = () => {
		const subset = subsetFromKeys(activeKeys);
		setActiveSubset(subset);
		setMasteryCounts({});
		const firstIdx = pickRandomIndex(subset.length);
		setCurrentByWord(subset[firstIdx], firstIdx);
	};

	// Threshold = success on accuracy threshold 0.6 = 60% acceptance
	const isMatch = (input, target, threshold = 0.6) => {
		const score = stringSimilarity.compareTwoStrings(
			input.trim().toLowerCase(),
			target.trim().toLowerCase()
		);
		return score >= threshold;
	};

	const pickNewWord = () => {
		if (!activeSubset.length) return;
		let idx = pickRandomIndex(activeSubset.length);
		if (activeSubset.length > 1) {
			while (activeSubset[idx] === currentWord) idx = pickRandomIndex(activeSubset.length);
		}
		setCurrentByWord(activeSubset[idx], idx);
	};

	/* === NEW: replacement picker that avoids the just-completed word and prefers words not already in the subset === */
	const pickReplacementWord = () => {
		const keys = Array.from(activeKeys);
		if (!keys.length) return currentWord;

		const exclusions = new Set(activeSubset);
		exclusions.add(currentWord);

		const preferred = keys.filter((k) => !exclusions.has(k));
		const fallback = keys.filter((k) => k !== currentWord);
		const pool = preferred.length ? preferred : fallback.length ? fallback : keys;

		let choice = pool[pickRandomIndex(pool.length)];
		if (choice === currentWord && keys.length > 1) {
			const alt = keys.filter((k) => k !== currentWord);
			choice = alt[pickRandomIndex(alt.length)];
		}
		return choice;
	};
	/* === END NEW === */

	// Hydrate selected words from marketplace (if present)
	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			const raw = localStorage.getItem("marketplaceWordpack");
			if (!raw) return;

			const indices = JSON.parse(raw);
			const picked = [];
			for (const idx of indices) {
				const k = allKeys[idx];
				if (k && vocabData[k]) picked.push(k);
			}

			// ensure we have at least 5; if not, top up randomly (non-duplicates)
			if (picked.length > 0) {
				const need = Math.max(0, 5 - picked.length);
				if (need > 0) {
					const pool = allKeys.filter((w) => !picked.includes(w));
					for (let i = 0; i < need && pool.length; i++) {
						const r = Math.floor(Math.random() * pool.length);
						picked.push(pool.splice(r, 1)[0]);
					}
				}
				setActiveKeys(new Set(picked));
			}
		} catch {
			// ignore bad JSON
		} finally {
			// don’t re-apply next time
			localStorage.removeItem("marketplaceWordpack");
		}
	}, []);

	// URL-driven wordpack: /play/test?pack=1,5,9  OR  /play/test?id=high-yield-20
	useEffect(() => {
		if (typeof window === "undefined") return;
		const params = new URLSearchParams(window.location.search);
		const packCsv = params.get("pack");
		const packId = params.get("id");

		async function applyFromId(id) {
			try {
				const res = await fetch("/data/wordpacks.json", { cache: "no-store" });
				const list = await res.json();
				const found = Array.isArray(list) ? list.find((p) => p.id === id) : null;
				if (!found) return;
				hydrateFromIndices(found.indices);
			} catch {
				/* silent */
			}
		}

		function hydrateFromIndices(indices) {
			const picked = [];
			for (const idx of indices) {
				const k = allKeys[idx];
				if (k && vocabData[k]) picked.push(k);
			}
			if (picked.length === 0) return;

			// top up to 5 if needed
			const need = Math.max(0, 5 - picked.length);
			if (need > 0) {
				const pool = allKeys.filter((w) => !picked.includes(w));
				for (let i = 0; i < need && pool.length; i++) {
					const r = Math.floor(Math.random() * pool.length);
					picked.push(pool.splice(r, 1)[0]);
				}
			}
			setActiveKeys(new Set(picked));
		}

		if (packCsv) {
			const indices = packCsv
				.split(",")
				.map((s) => parseInt(s.trim(), 10))
				.filter((n) => Number.isFinite(n) && n >= 0 && n < allKeys.length);
			if (indices.length) hydrateFromIndices(indices);
		} else if (packId) {
			applyFromId(packId);
		}
	}, []);

	/*------------------------------ Effects ----------------------------------*/
	useEffect(() => {
		if (typeof window === "undefined") return;
		yesSound.current = new Audio("/sounds/yesmp3.mp3");
		noSound.current = new Audio("/sounds/nomp3.mp3");

		// 10% volume
		[yesSound.current, noSound.current].forEach((a) => {
			a.volume = 0.1;
			a.preload = "auto";
		});
	}, []);

	useEffect(() => {
		if (activeKeys && activeKeys.size >= 5) resetGameFromActive();
	}, [activeKeys]);

	// Derived tracker items
	const trackerItems = useMemo(() => {
		const greenCount = Math.min(masteryCounts[currentWord] || 0, 4);
		const redCount = 4 - greenCount;
		return [
			...Array.from({ length: greenCount }, (_, i) => <li key={`g${i}`} className="green"></li>),
			...Array.from({ length: redCount }, (_, i) => <li key={`r${i}`}></li>),
		];
	}, [masteryCounts, currentWord]);

	/*------------------------------- Handlers --------------------------------*/
	const handleSubmit = (e) => {
		e.preventDefault();
		const correctDef = vocabData[currentWord]?.definition || "";

		if (isMatch(inputValue, correctDef)) {
			setAlertMessage("✅ Correct! ✅");

			if (yesSound.current) {
				yesSound.current.currentTime = 0;
				yesSound.current.play().catch(console.error);
			}

			setMasteryCounts((prev) => {
				const updated = { ...prev, [currentWord]: (prev[currentWord] || 0) + 1 };

				if (updated[currentWord] >= 4 && activeSubset.length) {
					/* === CHANGED: use safe replacement + reset bars to 0 === */
					const newWord = pickReplacementWord();
					const nextSubset = [...activeSubset];
					nextSubset[currentIndex] = newWord;
					setActiveSubset(nextSubset);

					// reset the replacement's mastery so it doesn't show 4/4
					updated[newWord] = 0;
					/* === END CHANGE === */
				}

				return updated;
			});

			setTimeout(() => {
				setAlertMessage("");
				pickNewWord();
			}, 1500);
		} else {
			setAlertMessage(`❌ ${correctDef} ❌`);

			if (noSound.current) {
				noSound.current.currentTime = 0;
				noSound.current.play().catch(console.error);
			}

			setMasteryCounts((prev) => ({ ...prev, [currentWord]: 0 }));
		}

		setInputValue("");
	};

	const overlay = () => {
		const handleCheckboxChange = (word) => (event) => {
			setActiveKeys((prev) => {
				const updated = new Set(prev);
				event.target.checked ? updated.add(word) : updated.delete(word);
				return updated;
			});
		};

		const handleDoneClick = () => {
			if (activeKeys.size < 5) {
				setShowPopup(true);
				setTimeout(() => setShowPopup(false), 2000);
				return;
			}
			resetGameFromActive();
			setShowOverlay(false);
		};

		const checkAllBoxes = () => setActiveKeys(new Set(allKeys));
		const deselectAllBoxes = () => setActiveKeys(new Set());

		const buttonsSection = () => (
			<div className="buttons-section">
				<button onClick={checkAllBoxes}>Select All</button>
				<button onClick={handleDoneClick}>Done</button>
				<button onClick={deselectAllBoxes}>Deselect All</button>
			</div>
		);

		return (
			<div id="overlay-container">
				{buttonsSection()}
				<div id="overlay">
					<table>
						<tbody>
							{Object.keys(vocabData).map((word) => (
								<tr key={word}>
									<td className="word-data">{word}</td>
									<td>
										<input
											className="word-checkbox"
											type="checkbox"
											checked={activeKeys.has(word)}
											onChange={handleCheckboxChange(word)}
										/>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				{buttonsSection()}
			</div>
		);
	};

	/*--------------------------------- JSX -----------------------------------*/
	return (
		<div id="main-section">
			<button className="button-like back-button" onClick={onBack}>
				← Back to Menu
			</button>

			{showPopup && (
				<div className="popup-overlay">
					<div className="popup-message">Please Select At Least 5 Words</div>
				</div>
			)}

			<div id="current-word">
				<h1>{currentWord || "Loading..."}</h1>

				<h2>
					Word # {allKeys.indexOf(currentWord) + 1} / {allKeys.length}
				</h2>

				{/* Tracker Bars */}
				{trackerItems && <ul className="tracker-bars">{trackerItems}</ul>}
			</div>

			<div id="answer-section">
				<form id="form-section" onSubmit={handleSubmit}>
					<input
						type="text"
						id="vocabInput"
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						placeholder="Type your answer here"
						autoFocus
					/>
					<button type="submit">Submit</button>
				</form>

				{alertMessage && (
					<h2 style={{ whiteSpace: "pre-wrap" }} id="alert-message">
						{alertMessage}
					</h2>
				)}
			</div>

			<div id="feedback-section">
				<section id="full-definition">
					{currentFullDefinition && alertMessage !== "✅ Correct! ✅" && alertMessage !== "" && (
						<p>{currentFullDefinition}</p>
					)}
				</section>

				<section id="example">
					{currentExample && alertMessage !== "✅ Correct! ✅" && alertMessage !== "" && (
						<p>{currentExample}</p>
					)}
				</section>
			</div>

			<div id="choose-words">
				<button onClick={() => setShowOverlay(true)}>Choose Words</button>
			</div>

			{showOverlay && overlay()}
		</div>
	);
}
