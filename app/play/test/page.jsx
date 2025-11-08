/** @format */
"use client";

import React from "react";
import "../../..//styles/globals.css";
import TestMode from "../../../components/TestMode";

export default function TestRoute() {
	return <TestMode onBack={() => (window.location.href = "/")} />;
}
