/* OneSignal Web Push integration.
   - SDK is loaded from CDN in index.html and initialized here.
   - Each player logs in with their Firebase uid as External User ID,
     so the coach can target a specific player by uid.
   - Sending push: coach's browser calls OneSignal REST API directly
     using the embedded App REST API key (same trade-off as before:
     fine for a small private team app, do not share publicly). */

export const ONESIGNAL_APP_ID = "f7e4b4ec-e84f-4120-9403-c2ef5861af0d";

/** URL of the serverless proxy that holds the REST API key and forwards
 *  the request to OneSignal. Configured via `netlify.toml` redirect to
 *  `/.netlify/functions/send-push`. */
const SEND_PUSH_ENDPOINT = "/api/send-push";

declare global {
  interface Window {
    OneSignal?: any;
    OneSignalDeferred?: any[];
  }
}

let initPromise: Promise<any> | null = null;

/** Initialize the OneSignal SDK (idempotent). Resolves with the OneSignal instance. */
export function ensureOneSignal(): Promise<any> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal: any) {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/" },
          allowLocalhostAsSecureOrigin: true,
        });
      } catch (e) {
        console.warn("[onesignal] init failed", e);
      }
      resolve(OneSignal);
    });
  });

  return initPromise;
}

/** Ask the player for permission and tag them with their Firebase uid. */
export async function registerPlayerForPush(uid: string): Promise<boolean> {
  try {
    const OneSignal = await ensureOneSignal();
    if (!OneSignal) return false;

    // Identify this device with the player's Firebase uid.
    try {
      await OneSignal.login(uid);
    } catch (e) {
      console.warn("[onesignal] login failed", e);
    }

    // Prompt for permission if not already decided.
    const perm: string | undefined =
      typeof Notification !== "undefined" ? Notification.permission : undefined;
    if (perm !== "granted" && perm !== "denied") {
      try {
        await OneSignal.Notifications.requestPermission();
      } catch (e) {
        console.warn("[onesignal] requestPermission failed", e);
      }
    }
    return Notification.permission === "granted";
  } catch (e) {
    console.warn("[onesignal] registerPlayerForPush failed", e);
    return false;
  }
}

/** Send a rating push to a single player by Firebase uid (External User ID). */
export async function sendRatingPushToPlayer(opts: {
  playerId: string;
  playerName: string;
  coachName: string;
}): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch(SEND_PUSH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: opts.playerId,
        playerName: opts.playerName,
        coachName: opts.coachName,
      }),
    });
    const txt = await res.text();
    console.info("[onesignal] proxy response:", res.status, txt);
    if (!res.ok) {
      return { ok: false, reason: `http-${res.status}: ${txt.slice(0, 200)}` };
    }
    let parsed: any = {};
    try {
      parsed = JSON.parse(txt);
    } catch {}
    if (parsed?.ok) return { ok: true };
    return { ok: false, reason: parsed?.reason || "unknown" };
  } catch (e: any) {
    console.error("[onesignal] proxy fetch threw:", e);
    return { ok: false, reason: `network: ${e?.message || String(e)}` };
  }
}
