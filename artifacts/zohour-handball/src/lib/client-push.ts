import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
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
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
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
  if (!res.ok) {
    throw new Error("OAuth token request failed: " + (await res.text()));
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    exp: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export async function sendPushToUser(
  recipientUid: string,
  title: string,
  body: string,
  url: string = "/",
): Promise<void> {
  const tokensSnap = await getDocs(
    query(collection(db, "fcmTokens"), where("uid", "==", recipientUid)),
  );
  if (tokensSnap.empty) return;

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (e) {
    console.warn("Could not obtain FCM access token:", e);
    return;
  }
  const projectId = serviceAccount.project_id;
  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  await Promise.all(
    tokensSnap.docs.map(async (d) => {
      const fcmToken = (d.data() as { token?: string }).token;
      if (!fcmToken) return;
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
              data: { title, body, url, tag: "zohour-rating" },
              webpush: {
                notification: {
                  icon: "/logo.jpg",
                  badge: "/logo.jpg",
                  tag: "zohour-rating",
                  dir: "rtl",
                  lang: "ar",
                },
                fcm_options: { link: url },
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
              await deleteDoc(doc(db, "fcmTokens", d.id));
            } catch {}
          }
          console.warn("FCM send failed:", errText);
        }
      } catch (e) {
        console.warn("FCM send error:", e);
      }
    }),
  );
}
