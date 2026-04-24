import React from "react";
import { createRoot } from "react-dom/client";
import "antd/dist/reset.css";
import App from "./App";

const rootEl = document.getElementById("root");
if (rootEl) createRoot(rootEl).render(<App />);
