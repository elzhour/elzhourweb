/* Client-side FCM v1 push sender (Spark/free plan friendly).
   The coach's browser signs a JWT with the embedded Firebase service
   account, swaps it for an OAuth access token, then POSTs the message
   to FCM HTTP v1 — no Cloud Function or backend required. */

import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import serviceAccount from "./firebase-service-account.json";

let cachedToken: { token: string; exp: number } | null = null;

/** base64url-encode bytes (no padding). Chunked to avoid stack overflow on big buffers. */
function bytesToB64Url(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let bin = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + CHUNK) as unknown as number[],
    );
  }
  return btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
const strToB64Url = (s: string) =>
  bytesToB64Url(new TextEncoder().encode(s));

/** Normalize a PEM that may contain literal "\n" sequences (e.g. when fetched
 *  from an env var) instead of real newlines. */
function normalizePem(raw: string): string {
  return raw.includes("\\n") && !raw.includes("\n")
    ? raw.replace(/\\n/g, "\n")
    : raw;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const normalized = normalizePem(pem);
  const cleaned = normalized
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
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
  // Including `kid` lets Google look up the right public key directly.
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: serviceAccount.private_key_id,
  };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const signingInput = `${strToB64Url(JSON.stringify(header))}.${strToB64Url(
    JSON.stringify(claim),
  )}`;

  let key: CryptoKey;
  try {
    key = await importPrivateKey(serviceAccount.private_key);
  } catch (e) {
    console.error("[push] importPrivateKey failed:", e);
    throw new Error("Bad service-account private key");
  }

  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${bytesToB64Url(new Uint8Array(sigBuf))}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  }).toString();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const txt = await res.text();
  if (!res.ok) {
    console.error("[push] OAuth token failed:", res.status, txt);
    console.error("[push] JWT (debug):", jwt.slice(0, 80) + "...");
    throw new Error(`OAuth ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = JSON.parse(txt) as { access_token: string; expires_in: number };
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
  } catch (e: any) {
    console.warn("FCM access token failed:", e);
    return { ok: false, reason: "auth: " + (e?.message || String(e)) };
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
