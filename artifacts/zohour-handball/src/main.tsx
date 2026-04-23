import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ensureOneSignal } from "./lib/onesignal";

// Initialize OneSignal as early as possible so background notifications
// keep arriving even when the app tab is closed.
ensureOneSignal();

createRoot(document.getElementById("root")!).render(<App />);
