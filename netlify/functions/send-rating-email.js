exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "elzhour";
  const appUrl = process.env.APP_URL || "https://elzhour1.netlify.app/";

  if (!apiKey || !senderEmail) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Email service not configured" }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { toEmail, playerName, coachName } = payload;
  if (!toEmail || !playerName || !coachName) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing toEmail, playerName, or coachName" }),
    };
  }

  const subject = `تم تقييمك من ${coachName}`;
  const htmlContent = `
    <div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; color: #0f172a;">
      <div style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <h2 style="margin: 0 0 16px; color: #0ea5e9;">يا ${playerName} 👋</h2>
        <p style="font-size: 16px; line-height: 1.7; margin: 0 0 20px;">
          تم تقييمك من <strong>${coachName}</strong>
        </p>
        <p style="font-size: 16px; line-height: 1.7; margin: 0 0 28px;">
          خش شوف تقييمك من هنا:
        </p>
        <a href="${appUrl}" style="display: inline-block; background: #0ea5e9; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
          افتح تقييمك
        </a>
        <p style="margin: 28px 0 0; font-size: 13px; color: #64748b;">
          مركز شباب الزهور — كرة يد 2010
        </p>
      </div>
    </div>
  `;

  const textContent = `يا ${playerName} تم تقييمك من ${coachName}، خش شوف تقييمك من هنا: ${appUrl}`;

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: toEmail, name: playerName }],
        subject,
        htmlContent,
        textContent,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Brevo error:", res.status, errText);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: "Failed to send email", detail: errText }),
      };
    }

    const data = await res.json();
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, messageId: data.messageId }) };
  } catch (err) {
    console.error("Send error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal error", detail: String(err) }),
    };
  }
};
