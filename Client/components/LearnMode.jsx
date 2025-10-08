/** @format */
"use client";

import React, { useEffect, useState } from "react";
import "../styles/globals.css";
import vocabData from "../src/data/gre_combined.json";

export default function LearnMode({ onBack }) {
	const allKeys = Object.keys(vocabData);

	const [activeSubset, setActiveSubset] = useState([]);
	const [correctIndex, setCorrectIndex] = useState(0);
	const [buttonStatus, setButtonStatus] = useState(Array(4).fill("default"));

	function cryptoInt(max) {
		const array = new Uint32Array(1);
		window.crypto.getRandomValues(array);
		return array[0] % max;
	}

	function pickNewWordAndSubset() {
		const keys = [...allKeys];
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

	useEffect(() => {
		pickNewWordAndSubset();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleAnswer = (idx) => {
		if (buttonStatus.some((s) => s !== "default")) return;

		const isCorrect = idx === correctIndex;
		const next = ["default", "default", "default", "default"];
		if (isCorrect) {
			next[idx] = "correct";
		} else {
			next[idx] = "incorrect";
			next[correctIndex] = "correct";
		}
		setButtonStatus(next);

		setTimeout(() => {
			pickNewWordAndSubset();
		}, 2000);
	};

	const quizWord = activeSubset.length > 0 ? activeSubset[correctIndex] : "Loading...";

	return (
		<div id="main-section" style={{ textAlign: "center", padding: "2rem" }}>
			<button className="button-like back-button" onClick={onBack}>
				← Back to Menu
			</button>

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
