/* Client-side FCM v1 push sender (Spark/free plan friendly).
   The coach's browser signs a JWT with the embedded Firebase service
   account, swaps it for an OAuth access token, then POSTs the message
   to FCM HTTP v1 — no Cloud Function or backend required. */

import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import serviceAccount from "./firebase-service-account.json";

let cachedToken: { token: string; exp: number } | null = null;

const b64url = (data: ArrayBuffer | Uint8Array | string) => {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp - 60_000) {
    return cachedToken.token;
  }
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(
    JSON.stringify(claim),
  )}`;
  const key = await importPrivateKey(serviceAccount.private_key);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error("OAuth token failed: " + (await res.text()));
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    exp: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

/** Send the rating push to a player. Reads `players/{playerId}.fcmToken`. */
export async function sendRatingPushToPlayer(opts: {
  playerId: string;
  playerName: string;
  coachName: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const playerSnap = await getDoc(doc(db, "players", opts.playerId));
  if (!playerSnap.exists()) return { ok: false, reason: "player-missing" };
  const fcmToken = playerSnap.data()?.fcmToken;
  if (!fcmToken) return { ok: false, reason: "no-token" };

  const title = "🛡️ مركز شباب الزهور - تقييم جديد";
  const body = `أهلاً ${opts.playerName}، كابتن ${opts.coachName} أضاف تقييمك الجديد. ادخل شوفه دلوقتي!`;

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (e) {
    console.warn("FCM access token failed:", e);
    return { ok: false, reason: "auth" };
  }

  const projectId = serviceAccount.project_id;
  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          data: { title, body, tag: "zohour-rating" },
          webpush: {
            notification: {
              icon: "/logo.jpg",
              badge: "/logo.jpg",
              tag: "zohour-rating",
              dir: "rtl",
              lang: "ar",
              requireInteraction: true,
            },
          },
        },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      if (
        res.status === 404 ||
        /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/i.test(errText)
      ) {
        try {
          await updateDoc(doc(db, "players", opts.playerId), { fcmToken: null });
        } catch {}
      }
      console.warn("FCM send failed:", res.status, errText);
      return { ok: false, reason: "fcm-error" };
    }
    return { ok: true };
  } catch (e) {
    console.warn("FCM send error:", e);
    return { ok: false, reason: "network" };
  }
}
