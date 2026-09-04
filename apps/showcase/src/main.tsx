import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@nexus-cyberdeck/tokens/tokens.css";
import "@nexus-cyberdeck/tokens/crt.css";
import "@nexus-cyberdeck/react/styles.css";
import App from "./App.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
