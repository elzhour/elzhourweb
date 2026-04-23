/* Client-side email sender via EmailJS (free tier, 200 emails/month).
   The 3 keys below are PUBLIC by EmailJS design — safe to ship in the bundle.
   Get them after signing up at https://www.emailjs.com:
     1. Email Services → Add Gmail → copy Service ID
     2. Email Templates → Create template → copy Template ID
     3. Account → API Keys → copy Public Key
   The template MUST contain these variables: {{player_name}}, {{coach_name}},
   {{app_url}} and use {{to_email}} as the "To Email" field. */

import emailjs from "@emailjs/browser";

const EMAILJS_SERVICE_ID = "PASTE_SERVICE_ID_HERE";
const EMAILJS_TEMPLATE_ID = "PASTE_TEMPLATE_ID_HERE";
const EMAILJS_PUBLIC_KEY = "PASTE_PUBLIC_KEY_HERE";

const APP_URL = "https://elzhour1.netlify.app/";

let initialized = false;
function ensureInit() {
  if (initialized) return;
  if (
    EMAILJS_PUBLIC_KEY === "PASTE_PUBLIC_KEY_HERE" ||
    !EMAILJS_PUBLIC_KEY
  ) return;
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  initialized = true;
}

export function isEmailConfigured() {
  return (
    EMAILJS_SERVICE_ID !== "PASTE_SERVICE_ID_HERE" &&
    EMAILJS_TEMPLATE_ID !== "PASTE_TEMPLATE_ID_HERE" &&
    EMAILJS_PUBLIC_KEY !== "PASTE_PUBLIC_KEY_HERE"
  );
}

export async function sendRatingEmail(opts: {
  toEmail: string;
  playerName: string;
  coachName: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!opts.toEmail) return { ok: false, reason: "no-email" };
  if (!isEmailConfigured()) {
    console.warn("[email] EmailJS not configured yet — skipping send");
    return { ok: false, reason: "not-configured" };
  }
  ensureInit();
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: opts.toEmail,
      player_name: opts.playerName,
      coach_name: opts.coachName,
      app_url: APP_URL,
      subject: `تم تقييمك من ${opts.coachName}`,
      message: `يا ${opts.playerName} تم تقييمك من ${opts.coachName}، شوف تقييمك من هنا: ${APP_URL}`,
    });
    return { ok: true };
  } catch (e: any) {
    console.error("[email] send failed:", e);
    return { ok: false, reason: e?.text || e?.message || "send-failed" };
  }
}
