import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBtiCT9zHkx28jGmggXLUpe5kuGoG5rNpw",
  authDomain: "zohour-handball-2010-f59c4.firebaseapp.com",
  projectId: "zohour-handball-2010-f59c4",
  storageBucket: "zohour-handball-2010-f59c4.firebasestorage.app",
  messagingSenderId: "733306244703",
  appId: "1:733306244703:web:f1182437c062aa014695ea",
  measurementId: "G-7PX0VWHGMD",
};

export const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Web Push public key (VAPID)
export const VAPID_KEY =
  "BGyfR8zY2F1fsXTG7bMA9hPFlR7nW25HjaPwNPWIwyCpDgJBUwTt5eaw3CCsnu3v-iYEijw-0J_OKNYauVqgD-Y";

export let messaging: Messaging | null = null;
try {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    messaging = getMessaging(app);
  }
} catch (e) {
  console.warn("Messaging init failed", e);
}

export const FIREBASE_CONFIG_PUBLIC = firebaseConfig;

// Set persistence to local so users stay logged in
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Auth persistence error:", err);
});

export const COACH_PASSWORD = "80168016";
