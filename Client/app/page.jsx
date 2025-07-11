/** @format */

"use client";

import React, { useEffect, useState, useRef } from "react";
import "../styles/globals.css";
import vocabData from "../src/data/gre_combined.json";

export default function Index() {
	const allKeys = Object.keys(vocabData);

	// state for which word we’re on
	const [currentIndex, setCurrentIndex] = useState(0);
	// the 4-word pool for this question
	const [activeSubset, setActiveSubset] = useState([]);
	// which button in the subset is correct
	const [correctIndex, setCorrectIndex] = useState(0);
	// button status: "default" | "correct" | "incorrect"
	const [buttonStatus, setButtonStatus] = useState(Array(4).fill("default"));

	// pick 3 random distractors (not including the quiz word)
	function pickDistractors(excludeKey) {
		const others = allKeys.filter((k) => k !== excludeKey);
		// simple Fisher–Yates shuffle
		for (let i = others.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[others[i], others[j]] = [others[j], others[i]];
		}
		return others.slice(0, 3);
	}

	// build the subset for the current quiz word
	function buildSubset() {
		const quizWord = allKeys[currentIndex];
		const variants = [quizWord, ...pickDistractors(quizWord)];
		// shuffle
		for (let i = variants.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[variants[i], variants[j]] = [variants[j], variants[i]];
		}
		setActiveSubset(variants);
		setCorrectIndex(variants.findIndex((w) => w === quizWord));
		setButtonStatus(Array(4).fill("default"));
	}

	// initialize on mount
	useEffect(() => {
		buildSubset();
	}, []);

	const handleAnswer = (idx) => {
		if (buttonStatus.some((s) => s !== "default")) return;

		const isCorrect = idx === correctIndex;
		const newStatus = ["default", "default", "default", "default"];
		newStatus[idx] = isCorrect ? "correct" : "incorrect";
		if (!isCorrect) newStatus[correctIndex] = "correct";

		setButtonStatus(newStatus);

		setTimeout(() => {
			// advance index (looping back)
			setCurrentIndex((ci) => {
				const next = ci + 1 < allKeys.length ? ci + 1 : 0;
				return next;
			});
			// rebuild for the new index
			buildSubset();
		}, 2000);
	};

	const quizWord = activeSubset.length ? activeSubset[correctIndex] : "Loading...";

	return (
		<div id="main-section" style={{ textAlign: "center", padding: "2rem" }}>
			<div id="current-word" style={{ marginBottom: "1rem" }}>
				<h1>{quizWord}</h1>
				<h2>
					Word #{currentIndex + 1} / {allKeys.length}
				</h2>
			</div>

			<div className="answer-section">
				{activeSubset.map((word, i) => (
					<button
						key={i}
						onClick={() => handleAnswer(i)}
						disabled={buttonStatus.some((s) => s !== "default")}
						className={["answer-button", buttonStatus[i]].filter(Boolean).join(" ")}
					>
						{vocabData[word].definition}
					</button>
				))}
			</div>
		</div>
	);
}
