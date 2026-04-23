/* Netlify Function: proxy push sends to OneSignal.
   The REST API key lives only here (server-side env var) so the browser
   never sees it and there are no CORS issues. */

const ONESIGNAL_APP_ID =
  process.env.ONESIGNAL_APP_ID || "f7e4b4ec-e84f-4120-9403-c2ef5861af0d";
// Default REST API key embedded here (server-side only; never reaches the
// browser). Override with the ONESIGNAL_REST_API_KEY env var on Netlify if
// the key is rotated.
const ONESIGNAL_REST_API_KEY =
  process.env.ONESIGNAL_REST_API_KEY ||
  "os_v2_app_67slj3hij5asbfadylxvqynpbv2siy3mfy4emsmvrt45etlpfdtcl2va4ln7wzwbkz3en7uqn2a5odoz23ouxicswbuinkxi5ml52ly";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, reason: "method-not-allowed" }),
    };
  }
  if (!ONESIGNAL_REST_API_KEY) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: false,
        reason: "missing ONESIGNAL_REST_API_KEY env var",
      }),
    };
  }

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, reason: "invalid-json" }),
    };
  }

  const { playerId, playerName, coachName } = input;
  if (!playerId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, reason: "missing playerId" }),
    };
  }

  const title = "🛡️ مركز شباب الزهور - تقييم جديد";
  const body = `أهلاً ${playerName || ""}، كابتن ${
    coachName || ""
  } أضاف تقييمك الجديد. ادخل شوفه دلوقتي!`;

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    target_channel: "push",
    include_aliases: { external_id: [playerId] },
    headings: { en: title, ar: title },
    contents: { en: body, ar: body },
    web_push_topic: "zohour-rating",
    chrome_web_icon: "/logo.jpg",
    chrome_web_badge: "/logo.jpg",
    data: { tag: "zohour-rating" },
  };

  const key = ONESIGNAL_REST_API_KEY.trim();
  console.log(
    `[send-push] using key prefix=${key.slice(0, 12)}… len=${key.length}, app_id=${ONESIGNAL_APP_ID}`,
  );

  try {
    // For new-format keys (os_v2_app_*) the modern V2 endpoint uses
    // "Authorization: Key <key>". Try V2 first; if it returns 401/403,
    // fall back to V1 with "Basic <key>" for older-format keys.
    let res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${key}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.status === 401 || res.status === 403) {
      console.log("[send-push] V2+Key rejected, retrying V1+Basic");
      res = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${key}`,
        },
        body: JSON.stringify(payload),
      });
    }
    const txt = await res.text();
    console.log(`[send-push] OneSignal response: ${res.status} ${txt.slice(0, 300)}`);
    let parsed = {};
    try {
      parsed = JSON.parse(txt);
    } catch {}

    if (!res.ok) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          ok: false,
          reason: `http-${res.status}: ${txt.slice(0, 300)}`,
        }),
      };
    }
    if (parsed && parsed.errors) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          ok: false,
          reason: Array.isArray(parsed.errors)
            ? parsed.errors.join(", ")
            : JSON.stringify(parsed.errors),
        }),
      };
    }
    if (parsed && parsed.recipients === 0) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ ok: false, reason: "no-recipients" }),
      };
    }
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: true, id: parsed && parsed.id }),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: false,
        reason: `network: ${e && e.message ? e.message : String(e)}`,
      }),
    };
  }
};
