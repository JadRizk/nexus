import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@nexus/tokens/tokens.css";
import "@nexus/tokens/crt.css";
import "@nexus/react/styles.css";
import App from "./App.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
