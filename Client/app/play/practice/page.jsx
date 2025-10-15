/** @format */
"use client";

import React from "react";
import "../../../styles/globals.css";
import PracticeMode from "../../../components/PracticeMode";

export default function PracticeRoute() {
	return <PracticeMode onBack={() => (window.location.href = "/")} />;
}
