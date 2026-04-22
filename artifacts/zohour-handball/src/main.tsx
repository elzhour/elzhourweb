import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { unregisterLegacyServiceWorkers } from "./lib/notifications";

unregisterLegacyServiceWorkers();

createRoot(document.getElementById("root")!).render(<App />);
