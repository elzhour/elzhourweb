/* OneSignal Web Push integration.
   - SDK is loaded from CDN in index.html and initialized here.
   - Each player logs in with their Firebase uid as External User ID,
     so the coach can target a specific player by uid.
   - Sending push: coach's browser calls OneSignal REST API directly
     using the embedded App REST API key (same trade-off as before:
     fine for a small private team app, do not share publicly). */

export const ONESIGNAL_APP_ID = "f7e4b4ec-e84f-4120-9403-c2ef5861af0d";
export const ONESIGNAL_REST_API_KEY =
  "os_v2_app_67slj3hij5asbfadylxvqynpbvafd7k3vchejxnbjbjnct6kj7rvfnpgemo5fqr24dnxgblmyq6m4wp5ymltataybsj576nwxr7ivfa";

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
  const title = "🛡️ مركز شباب الزهور - تقييم جديد";
  const body = `أهلاً ${opts.playerName}، كابتن ${opts.coachName} أضاف تقييمك الجديد. ادخل شوفه دلوقتي!`;

  try {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        target_channel: "push",
        include_aliases: { external_id: [opts.playerId] },
        headings: { en: title, ar: title },
        contents: { en: body, ar: body },
        web_push_topic: "zohour-rating",
        chrome_web_icon: "/logo.jpg",
        chrome_web_badge: "/logo.jpg",
        data: { tag: "zohour-rating" },
      }),
    });
    const txt = await res.text();
    if (!res.ok) {
      console.warn("[onesignal] send failed:", res.status, txt);
      return { ok: false, reason: `http-${res.status}` };
    }
    let parsed: any = {};
    try {
      parsed = JSON.parse(txt);
    } catch {}
    if (parsed?.errors) {
      console.warn("[onesignal] send errors:", parsed.errors);
      return { ok: false, reason: "no-recipients" };
    }
    return { ok: true };
  } catch (e: any) {
    console.warn("[onesignal] send error:", e);
    return { ok: false, reason: "network" };
  }
}
