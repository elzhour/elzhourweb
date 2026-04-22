/* Firebase Cloud Function — sends FCM push when a new rating is created.
   Trigger: ratings/{ratingId} onCreate
   Reads players/{playerId}.fcmToken and sends a Web Push.

   ⚠️ Requires the Firebase Blaze (pay-as-you-go) plan to deploy.
   Deploy with:
     cd functions && npm install && cd ..
     firebase deploy --only functions
*/

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const SITE_URL = "https://elzhour2010.netlify.app";
const LOGO_URL = `${SITE_URL}/logo.jpg`;

exports.sendRatingNotification = onDocumentCreated(
  "ratings/{ratingId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const rating = snap.data() || {};
    const playerId = rating.playerId;
    const playerName = rating.playerName || "اللاعب";
    const coachName = rating.coachName || "المدرب";
    if (!playerId) return null;

    const db = getFirestore();
    const playerSnap = await db.collection("players").doc(playerId).get();
    if (!playerSnap.exists) return null;

    const fcmToken = playerSnap.data()?.fcmToken;
    if (!fcmToken) return null;

    const title = "🛡️ مركز شباب الزهور - تقييم جديد";
    const body = `أهلاً ${playerName}، قام الكابتن ${coachName} بإضافة تقييمك. اضغط للمعاينة.`;
    const url = `${SITE_URL}/player`;

    try {
      await getMessaging().send({
        token: fcmToken,
        notification: { title, body },
        data: {
          title,
          body,
          url,
          icon: LOGO_URL,
          tag: "zohour-rating",
          ratingId: event.params.ratingId,
          playerId,
        },
        webpush: {
          notification: {
            icon: LOGO_URL,
            badge: LOGO_URL,
            tag: "zohour-rating",
            dir: "rtl",
            lang: "ar",
            requireInteraction: true,
          },
          fcmOptions: { link: url },
        },
      });
    } catch (err) {
      const code = err?.errorInfo?.code || err?.code || "";
      console.warn("FCM send failed:", code, err?.message);
      // Clean up dead token
      if (
        /registration-token-not-registered|invalid-argument|invalid-registration-token/i.test(
          code,
        )
      ) {
        try {
          await db.collection("players").doc(playerId).update({ fcmToken: null });
        } catch {}
      }
    }

    return null;
  },
);
