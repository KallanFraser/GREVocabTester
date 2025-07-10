/** @format */

"use client";

import React, { useEffect, useState, useRef } from "react";
import "../styles/globals.css";
import vocabData from "../src/data/gre_combined.json";

export default function Index() {
	const allKeys = Object.keys(vocabData);

	// state for the current 4-word pool and which index is the correct one
	const [activeSubset, setActiveSubset] = useState([]);
	const [correctIndex, setCorrectIndex] = useState(0);

	// status of each button: "default" | "correct" | "incorrect"
	const [buttonStatus, setButtonStatus] = useState(Array(4).fill("default"));

	// util: returns an integer in [0…max)
	function cryptoInt(max) {
		const array = new Uint32Array(1);
		window.crypto.getRandomValues(array);
		// modulo bias is negligible here unless max is huge
		return array[0] % max;
	}

	// pick a fresh subset of 4 distinct words, choose one as the quiz word
	function pickNewWordAndSubset() {
		const keys = [...allKeys];

		// Fisher-Yates using cryptoInt
		for (let i = keys.length - 1; i > 0; i--) {
			const j = cryptoInt(i + 1);
			[keys[i], keys[j]] = [keys[j], keys[i]];
		}

		const subset = keys.slice(0, 4);
		const correctIdx = cryptoInt(4);

		setActiveSubset(subset);
		setCorrectIndex(correctIdx);
		setButtonStatus(Array(4).fill("default"));
	}

	// on mount, initialize
	useEffect(() => {
		pickNewWordAndSubset();
	}, []);

	// handle user clicking an answer
	const handleAnswer = (idx) => {
		// ignore clicks while waiting to advance
		if (buttonStatus.some((s) => s !== "default")) return;

		const isCorrect = idx === correctIndex;
		const newStatus = ["default", "default", "default", "default"];
		if (isCorrect) {
			newStatus[idx] = "correct";
		} else {
			newStatus[idx] = "incorrect";
			newStatus[correctIndex] = "correct";
		}
		setButtonStatus(newStatus);

		// after 2s, move on
		setTimeout(() => {
			pickNewWordAndSubset();
		}, 2000);
	};

	// current quiz word
	const quizWord = activeSubset.length > 0 ? activeSubset[correctIndex] : "Loading...";

	return (
		<div id="main-section" style={{ textAlign: "center", padding: "2rem" }}>
			<div id="current-word" style={{ marginBottom: "1rem" }}>
				<h1>{quizWord}</h1>
				<h2>
					Word #{allKeys.indexOf(quizWord) + 1} / {allKeys.length}
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
