/* Web Push notifications via Firebase Cloud Messaging.
   - Service worker (`firebase-messaging-sw.js`) handles background messages.
   - This module registers the SW, requests permission, gets the FCM token
     using the VAPID key, and stores it on `players/{uid}.fcmToken`.
   - Actual push delivery is performed by a Firebase Cloud Function
     (`functions/index.js`) that listens to new docs in `ratings/`. */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import { db, messaging, VAPID_KEY } from "./firebase";

let swReg: ServiceWorkerRegistration | null = null;
let foregroundListenerSet = false;

/** Register the FCM service worker (idempotent). */
export async function ensureMessagingSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (swReg) return swReg;
  try {
    swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    await swReg.update();
    return swReg;
  } catch (e) {
    console.warn("FCM SW registration failed", e);
    return null;
  }
}

/** Request permission, fetch FCM token, save to players/{uid}.fcmToken. */
export async function registerPlayerForPush(uid: string): Promise<string | null> {
  if (!messaging || typeof Notification === "undefined") return null;

  const reg = await ensureMessagingSW();
  if (!reg) return null;

  if (Notification.permission === "denied") return null;
  if (Notification.permission !== "granted") {
    const result = await Notification.requestPermission();
    if (result !== "granted") return null;
  }

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    if (!token) return null;

    await updateDoc(doc(db, "players", uid), {
      fcmToken: token,
      fcmTokenUpdatedAt: serverTimestamp(),
    });
    return token;
  } catch (e) {
    console.warn("Failed to get / save FCM token:", e);
    return null;
  }
}

/** Show foreground messages as a toast (since SW only fires when in background). */
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

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    ensureMessagingSW();
    setupForegroundListener();
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") await ensureMessagingSW();
    return result === "granted";
  }, []);

  const notify = useCallback((title: string, options?: { body?: string }) => {
    toast(title, { description: options?.body });
    playPing();
  }, []);

  return { permission, requestPermission, notify };
}
