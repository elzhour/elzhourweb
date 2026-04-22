import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ensureMessagingSW } from "./lib/notifications";

// Register the FCM service worker as early as possible so background
// notifications keep arriving even when the app tab is closed.
ensureMessagingSW();

createRoot(document.getElementById("root")!).render(<App />);
