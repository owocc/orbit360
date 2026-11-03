import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/base.css";
import "./styles/header.css";
import "./styles/panel.css";
import "./styles/overlays.css";

createRoot(document.getElementById("root")).render(<App />);
