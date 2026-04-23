/* Sends rating notification email via our Netlify Function (which calls Brevo).
   The Brevo API key lives ONLY in Netlify env vars, never in the browser.
   Required Netlify env vars:
     - BREVO_API_KEY
     - BREVO_SENDER_EMAIL
     - BREVO_SENDER_NAME (optional)
     - APP_URL (optional, defaults to https://elzhour1.netlify.app/)
*/

const ENDPOINT = "/.netlify/functions/send-rating-email";

export function isEmailConfigured() {
  // Always true now — configuration lives on the server.
  return true;
}

export async function sendRatingEmail(opts: {
  toEmail: string;
  playerName: string;
  coachName: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!opts.toEmail) return { ok: false, reason: "no-email" };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toEmail: opts.toEmail,
        playerName: opts.playerName,
        coachName: opts.coachName,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("[email] send failed:", res.status, data);
      return { ok: false, reason: data?.error || `http-${res.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    console.error("[email] send error:", e);
    return { ok: false, reason: e?.message || "send-failed" };
  }
}
