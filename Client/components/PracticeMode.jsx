/** @format */
"use client";

import React, { useEffect, useState } from "react";
import "../styles/globals.css";
import vocabData from "../src/data/gre_combined.json";

export default function PracticeMode({ onBack }) {
	const allKeys = Object.keys(vocabData);

	const [currentIndex, setCurrentIndex] = useState(0);
	const [activeSubset, setActiveSubset] = useState([]);
	const [correctIndex, setCorrectIndex] = useState(0);
	const [buttonStatus, setButtonStatus] = useState(Array(4).fill("default"));

	function pickDistractors(excludeKey) {
		const others = allKeys.filter((k) => k !== excludeKey);
		for (let i = others.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[others[i], others[j]] = [others[j], others[i]];
		}
		return others.slice(0, 3);
	}

	function buildSubset(nextIndex = currentIndex) {
		const quizWord = allKeys[nextIndex];
		const variants = [quizWord, ...pickDistractors(quizWord)];
		for (let i = variants.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[variants[i], variants[j]] = [variants[j], variants[i]];
		}
		setActiveSubset(variants);
		setCorrectIndex(variants.findIndex((w) => w === quizWord));
		setButtonStatus(Array(4).fill("default"));
	}

	useEffect(() => {
		buildSubset();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleAnswer = (idx) => {
		if (buttonStatus.some((s) => s !== "default")) return;

		const isCorrect = idx === correctIndex;
		const newStatus = ["default", "default", "default", "default"];
		newStatus[idx] = isCorrect ? "correct" : "incorrect";
		if (!isCorrect) newStatus[correctIndex] = "correct";

		setButtonStatus(newStatus);

		setTimeout(() => {
			const next = currentIndex + 1 < allKeys.length ? currentIndex + 1 : 0;
			setCurrentIndex(next);
			buildSubset(next);
		}, 1200);
	};

	const quizWord = activeSubset.length ? activeSubset[correctIndex] : "Loading...";

	return (
		<div id="main-section" style={{ textAlign: "center", padding: "2rem" }}>
			<button className="button-like back-button" onClick={onBack}>
				← Back to Menu
			</button>

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
