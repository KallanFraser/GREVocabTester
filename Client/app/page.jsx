/** @format */

"use client"; //renders on client not server

/*------------------------------------------------------------------------------
                                    Imports
-------------------------------------------------------------------------------*/
import React, { useEffect, useState, useRef } from "react";
import "../styles/globals.css";
import vocabData from "../src/data/gre_combined.json";
import stringSimilarity from "string-similarity";

import fs from "fs";
import path from "path";

/*------------------------------------------------------------------------------
                                    Main
-------------------------------------------------------------------------------*/
export default function Index() {
	const allKeys = Object.keys(vocabData); //array of all the keys
	const [activeKeys, setActiveKeys] = useState(() => new Set(Object.keys(vocabData)));

	// — Sound Effects —
	const yesSound = useRef(null);
	const noSound = useRef(null);

	// — State —
	const [activeSubset, setActiveSubset] = useState([]);
	const [masteryCounts, setMasteryCounts] = useState({});
	const [trackerItems, setTrackerItems] = useState([]);

	const [currentIndex, setCurrentIndex] = useState(0);
	const [currentWord, setCurrentWord] = useState("");
	const [currentDefinition, setCurrentDefinition] = useState("");
	const [currentExample, setCurrentExample] = useState("");
	const [currentFullDefinition, setCurrentFullDefinition] = useState("");

	const [inputValue, setInputValue] = useState("");
	const [alertMessage, setAlertMessage] = useState("");

	const [showOverlay, setShowOverlay] = useState(false);
	const [showPopup, setShowPopup] = useState(false);

	useEffect(() => {
		const keys = Object.keys(vocabData);
		setActiveKeys(new Set(keys));

		// Initialize audio on client only
		if (typeof window !== "undefined") {
			const yes = new Audio("/sounds/yesmp3.mp3");
			yes.preload = "auto";
			yesSound.current = yes;

			const no = new Audio("/sounds/nomp3.mp3");
			no.preload = "auto";
			noSound.current = no;
		}
	}, []);

	useEffect(() => {
		if (!activeKeys || activeKeys.size < 5) return;

		const keys = Array.from(activeKeys);
		const subset = Array.from({ length: 5 }, () => keys[Math.floor(Math.random() * keys.length)]);

		setActiveSubset(subset);
		setMasteryCounts({});

		const firstIdx = Math.floor(Math.random() * subset.length);
		const word = subset[firstIdx];

		setCurrentIndex(firstIdx);
		setCurrentWord(word);
		setCurrentDefinition(vocabData[word].definition);
		setCurrentExample(vocabData[word].example.replaceAll('"', ""));
		setCurrentFullDefinition(vocabData[word].fullDefinition.replaceAll('"', ""));
	}, [activeKeys]);

	// — Helper Function —
	// Threshold = success on accuracy threshold 0.6 = 60% acceptance
	function isMatch(input, target, threshold = 0.6) {
		const score = stringSimilarity.compareTwoStrings(
			input.trim().toLowerCase(),
			target.trim().toLowerCase()
		);
		return score >= threshold;
	}

	// — Helper Function —
	// Picks a new word from the current subset
	const pickNewWord = () => {
		let idx = Math.floor(Math.random() * activeSubset.length);
		while (currentWord === activeSubset[idx]) {
			idx = Math.floor(Math.random() * activeSubset.length);
		}
		const word = activeSubset[idx];
		setCurrentIndex(idx);
		setCurrentWord(word);
		setCurrentDefinition(vocabData[word].definition);
		setCurrentExample(vocabData[word].example.replaceAll('"', ""));
		setCurrentFullDefinition(vocabData[word].fullDefinition.replaceAll('"', ""));
	};

	// — Helper Function —
	// Handles user submission
	const handleSubmit = (e) => {
		e.preventDefault();

		const correctDef = vocabData[currentWord].definition;
		if (isMatch(inputValue, correctDef)) {
			setAlertMessage("✅ Correct! ✅");

			// — Sound Effect —
			const yes = yesSound.current;
			if (yes) {
				yes.currentTime = 0;
				yes.play().catch(console.error);
			}

			setMasteryCounts((prev) => {
				const updated = { ...prev };
				updated[currentWord] = (updated[currentWord] || 0) + 1;

				// After 4 correct in a row, replace word in subset
				if (updated[currentWord] >= 4) {
					const keys = Array.from(activeKeys);
					const newWord = keys[Math.floor(Math.random() * keys.length)];

					const newSubset = [...activeSubset];
					newSubset[currentIndex] = newWord;
					setActiveSubset(newSubset);
					updated[newWord] = 0;
				}

				return updated;
			});

			setTimeout(() => {
				setAlertMessage("");
				pickNewWord();
			}, 1500);
		} else {
			setAlertMessage(`❌ ${vocabData[currentWord].definition} ❌`);

			// — Sound Effect —
			const no = noSound.current;
			if (no) {
				no.currentTime = 0;
				no.play().catch(console.error);
			}

			setMasteryCounts((prev) => ({ ...prev, [currentWord]: 0 }));
		}

		setInputValue("");
	};

	// — Update tracker items whenever masteryCounts or currentWord changes —
	useEffect(() => {
		const currentCount = masteryCounts[currentWord] || 0;
		const greenCount = Math.min(currentCount, 4);
		const redCount = 4 - greenCount;
		const items = [
			...Array.from({ length: greenCount }, (_, i) => <li key={`g${i}`} className="green"></li>),
			...Array.from({ length: redCount }, (_, i) => <li key={`r${i}`}></li>),
		];
		setTrackerItems(items);
	}, [masteryCounts, currentWord]);

	const overlay = () => {
		const handleCheckboxChange = (word) => (event) => {
			console.log("Before:", activeKeys);

			setActiveKeys((prev) => {
				const updated = new Set(prev);
				if (event.target.checked) {
					updated.add(word);
				} else {
					updated.delete(word);
				}
				return updated;
			});
		};

		const buttonsSection = () => {
			return (
				<div className="buttons-section">
					<button onClick={checkAllBoxes}>Select All</button>
					<button onClick={handleDoneClick}>Done</button>
					<button onClick={deselectAllBoxes}>Deselect All</button>
				</div>
			);
		};

		const handleDoneClick = () => {
			if (activeKeys.size < 5) {
				setShowPopup(true);
				setTimeout(() => {
					setShowPopup(false);
				}, 2000); // 2 seconds
			} else {
				const keys = Array.from(activeKeys);
				const subset = Array.from({ length: 5 }, () => keys[Math.floor(Math.random() * keys.length)]);

				setActiveSubset(subset);
				setMasteryCounts({});

				const firstIdx = Math.floor(Math.random() * subset.length);
				const word = subset[firstIdx];

				setCurrentIndex(firstIdx);
				setCurrentWord(word);
				setCurrentDefinition(vocabData[word].definition);
				setCurrentExample(vocabData[word].example.replaceAll('"', ""));
				setCurrentFullDefinition(vocabData[word].fullDefinition.replaceAll('"', ""));

				setShowOverlay(false);
			}
		};

		const checkAllBoxes = () => {
			const allKeys = Object.keys(vocabData);
			setActiveKeys(new Set(allKeys));
		};

		const deselectAllBoxes = () => {
			setActiveKeys(new Set());
		};

		return (
			<div id="overlay-container">
				{buttonsSection()}
				<div id="overlay">
					<table>
						<tbody>
							{Object.entries(vocabData).map(
								([word, { definition, example, fullDefinition }]) => (
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
								)
							)}
						</tbody>
					</table>
				</div>
				{buttonsSection()}
			</div>
		);
	};

	return (
		<div id="main-section">
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
					{currentFullDefinition && alertMessage != "✅ Correct! ✅" && alertMessage != "" && (
						<>
							<p>{currentFullDefinition}</p>
						</>
					)}
				</section>

				<section id="example">
					{currentExample && alertMessage != "✅ Correct! ✅" && alertMessage != "" && (
						<>
							<p>{currentExample}</p>
						</>
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
