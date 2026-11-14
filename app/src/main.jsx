import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { useStore } from "./store.js";
import "./styles.css";
import "./deep.css";

if (import.meta.env.DEV) window.__store = useStore; // handy when debugging in the console

createRoot(document.getElementById("root")).render(<App />);
