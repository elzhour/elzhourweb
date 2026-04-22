import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import { db, messaging, VAPID_KEY } from "./firebase";
import { sendPushToUser } from "./client-push";

/* ── FCM Token Registration ────────────────────────────────── */

let swReg: ServiceWorkerRegistration | null = null;

export async function ensureMessagingSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  if (swReg) return swReg;
  try {
    swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    await swReg.update();
    return swReg;
  } catch (e) {
    console.warn("FCM SW registration failed", e);
    return null;
  }
}

export const ensureServiceWorker = ensureMessagingSW;

async function saveFcmToken(uid: string, role: "player" | "coach", token: string) {
  try {
    await setDoc(
      doc(db, "fcmTokens", `${uid}_${token.slice(-12)}`),
      { uid, role, token, userAgent: navigator.userAgent, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (e) {
    console.warn("Save FCM token failed", e);
  }
}

export async function registerFcmForUser(uid: string, role: "player" | "coach"): Promise<string | null> {
  if (!messaging) return null;
  if (!("Notification" in window)) return null;

  const reg = await ensureMessagingSW();
  if (!reg) return null;

  if (Notification.permission !== "granted") {
    const result = await Notification.requestPermission();
    if (result !== "granted") return null;
  }

  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (token) {
      await saveFcmToken(uid, role, token);
      return token;
    }
  } catch (e) {
    console.warn("Get FCM token failed", e);
  }
  return null;
}

/* ── Foreground Message Listener ───────────────────────────── */

let foregroundListenerSet = false;
export function setupForegroundListener() {
  if (foregroundListenerSet || !messaging) return;
  foregroundListenerSet = true;
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title || (payload.data as any)?.title;
    const body = payload.notification?.body || (payload.data as any)?.body;
    if (title) {
      toast(title, { description: body });
      playPing();
    }
  });
}

function playPing() {
  if (document.hidden) return;
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch {}
}

/* ── Send notification directly from client (FCM HTTP v1 API) ─
   No Cloud Function / paid plan required. The coach's browser signs
   a JWT with the embedded service account, exchanges it for an OAuth
   token, and POSTs the message to FCM. */

export async function sendRatingNotification(payload: {
  title: string;
  body: string;
  recipientUid: string;
  url?: string;
}) {
  try {
    await sendPushToUser(
      payload.recipientUid,
      payload.title,
      payload.body,
      payload.url || "/player",
    );
  } catch (e) {
    console.warn("Failed to send notification:", e);
  }
}

/* ── Legacy broadcastPush compat shim ──────────────────────── */
export async function broadcastPush(payload: {
  title: string;
  body: string;
  recipients?: { uid: string; role: "player" | "coach" }[];
  excludeUid?: string;
  scope?: "team" | "user";
  url?: string;
}) {
  if (!payload.recipients) return;
  for (const r of payload.recipients) {
    if (payload.excludeUid && r.uid === payload.excludeUid) continue;
    await sendRatingNotification({
      title: payload.title,
      body: payload.body,
      recipientUid: r.uid,
      url: payload.url,
    });
  }
}

/* ── useNotifications hook ──────────────────────────────────── */
export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  useEffect(() => {
    if ("Notification" in window) setPermission(Notification.permission);
    ensureMessagingSW();
    setupForegroundListener();
  }, []);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") await ensureMessagingSW();
    return result === "granted";
  }, []);

  const notify = useCallback(
    (title: string, options?: { body?: string }) => {
      toast(title, { description: options?.body });
      playPing();
    },
    [],
  );

  return { permission, requestPermission, notify };
}
