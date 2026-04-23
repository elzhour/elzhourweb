/* Netlify Function: proxy push sends to OneSignal.
   The REST API key lives only here (server-side env var) so the browser
   never sees it and there are no CORS issues. */

const ONESIGNAL_APP_ID =
  process.env.ONESIGNAL_APP_ID || "f7e4b4ec-e84f-4120-9403-c2ef5861af0d";
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || "";

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

  try {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY.trim()}`,
      },
      body: JSON.stringify(payload),
    });
    const txt = await res.text();
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
