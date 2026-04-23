import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

export const FIREBASE_CONFIG_PUBLIC = firebaseConfig;

setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Auth persistence error:", err);
});

export const COACH_PASSWORD = "80168016";
