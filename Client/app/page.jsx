/** @format */

"use client";

import React, { useEffect, useState, useRef } from "react";
import "../styles/globals.css";
import vocabData from "../src/data/gre_combined.json"; // combined { definition, example }

import stringSimilarity from "string-similarity";

export default function Index() {
	const allKeys = Object.keys(vocabData);

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

	const [inputValue, setInputValue] = useState("");
	const [alertMessage, setAlertMessage] = useState("");

	// — Initialize 5-word subset and first word —
	useEffect(() => {
		const keys = Object.keys(vocabData);
		const subset = Array.from({ length: 5 }, () => keys[Math.floor(Math.random() * keys.length)]);

		setActiveSubset(subset);
		setMasteryCounts({});

		const firstIdx = Math.floor(Math.random() * subset.length);
		const word = subset[firstIdx];

		setCurrentIndex(firstIdx);
		setCurrentWord(word);
		setCurrentDefinition(vocabData[word].definition);
		setCurrentExample(vocabData[word].example);

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

	function isMatch(input, target, threshold = 0.6) {
		const score = stringSimilarity.compareTwoStrings(
			input.trim().toLowerCase(),
			target.trim().toLowerCase()
		);
		return score >= threshold;
	}

	// — Pick a new word from current subset —
	const pickNewWord = () => {
		let idx = Math.floor(Math.random() * activeSubset.length);
		while (currentWord === activeSubset[idx]) {
			idx = Math.floor(Math.random() * activeSubset.length);
		}
		const word = activeSubset[idx];
		setCurrentIndex(idx);
		setCurrentWord(word);
		setCurrentDefinition(vocabData[word].definition);
		setCurrentExample(vocabData[word].example);
		//console.log("tester", masteryCounts);
		//get the current word
		//search mastery counts for the current words count
		//count = amount of green bars
		//for count, greater li with classname greeen
		//for 4 - count, create li with classname red
	};

	// — Handle submission —
	const handleSubmit = (e) => {
		e.preventDefault();

		const correctDef = vocabData[currentWord].definition;
		if (isMatch(inputValue, correctDef)) {
			setAlertMessage("✅ Correct! ✅");

			// play yes sound
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
					const keys = Object.keys(vocabData);
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

			// play no sound
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

	return (
		<div id="main-section">
			<h1>{currentWord || "Loading..."}</h1>

			{currentWord && (
				<h2>
					Word # {allKeys.indexOf(currentWord) + 1} / {allKeys.length}
				</h2>
			)}

			{/* Tracker Bars */}
			{trackerItems && <ul className="tracker-bars">{trackerItems}</ul>}

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

			<section id="example">
				{currentExample && alertMessage != "✅ Correct! ✅" && alertMessage != "" && (
					<>
						<p>"{currentExample}"</p>
					</>
				)}
			</section>
		</div>
	);
}
