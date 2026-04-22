/* CallMeBot WhatsApp integration ───────────────────────────────
   Each recipient must first authorize CallMeBot by sending the
   message "I allow callmebot to send me messages" via WhatsApp to
   +34 644 51 95 23. CallMeBot replies with a personal API key for
   that phone number, which we store on the player's profile. */

const ARABIC_DAYS = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

export function formatArabicSessionDate(isoDate: string): {
  dayName: string;
  date: string;
} {
  const d = new Date(isoDate + "T00:00:00");
  const dayName = ARABIC_DAYS[d.getDay()] || "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return { dayName, date: `${dd}/${mm}/${yyyy}` };
}

/** Normalize Egyptian phone numbers to international form for CallMeBot. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("20")) return digits;
  if (digits.startsWith("0")) return "20" + digits.slice(1);
  return digits;
}

export interface SendWhatsAppOptions {
  phone: string;
  apiKey: string;
  message: string;
}

/** Send a WhatsApp message via CallMeBot.
    The endpoint is GET-based and supports CORS from browsers. */
export async function sendWhatsApp({
  phone,
  apiKey,
  message,
}: SendWhatsAppOptions): Promise<{ ok: boolean; status: number; text: string }> {
  const normalized = normalizePhone(phone);
  const url =
    `https://api.callmebot.com/whatsapp.php` +
    `?phone=${encodeURIComponent(normalized)}` +
    `&text=${encodeURIComponent(message)}` +
    `&apikey=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (e: any) {
    return { ok: false, status: 0, text: e?.message || "network error" };
  }
}

export function buildRatingMessage(opts: {
  playerName: string;
  coachName: string;
  dayName: string;
  date: string;
  link?: string;
}): string {
  const link = opts.link || "https://elzhour2010.netlify.app/";
  return (
    `اهلا يا ${opts.playerName} تم تقييمك من ${opts.coachName}\n` +
    ` ليوم ${opts.dayName} الموافق ${opts.date}\n` +
    ` ادخل على الرابط الخاص بالتقييم من هنا\n` +
    `${link}`
  );
}
