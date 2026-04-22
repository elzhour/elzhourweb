/* In-app toast + ping only. WhatsApp delivery is handled by
   `whatsapp.ts` (CallMeBot). All Firebase Cloud Messaging code
   has been removed — the app no longer registers a service
   worker for push or stores FCM tokens. */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

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
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return false;
    const result = await Notification.requestPermission();
    setPermission(result);
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

/* Unregister any leftover service worker from the previous push
   implementation so old browsers don't keep the FCM SW active. */
export async function unregisterLegacyServiceWorkers() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const url = r.active?.scriptURL || "";
      if (url.includes("firebase-messaging-sw")) {
        await r.unregister();
      }
    }
  } catch {}
}
