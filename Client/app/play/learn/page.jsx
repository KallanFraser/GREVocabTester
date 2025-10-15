/** @format */
"use client";

import React from "react";
import "../../../styles/globals.css";
import LearnMode from "../../../components/LearnMode";

export default function LearnRoute() {
	return <LearnMode onBack={() => (window.location.href = "/")} />;
}
