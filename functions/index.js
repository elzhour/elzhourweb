const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

exports.sendRatingNotification = onDocumentCreated(
  "notificationQueue/{docId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const data = snap.data();
    const { title, body, recipientUid, url } = data;

    if (!title || !body || !recipientUid) {
      await snap.ref.delete();
      return null;
    }

    const db = getFirestore();
    const tokensSnap = await db
      .collection("fcmTokens")
      .where("uid", "==", recipientUid)
      .get();

    const tokens = [];
    const tokenDocIds = [];
    tokensSnap.forEach((doc) => {
      const d = doc.data();
      if (d.token) {
        tokens.push(d.token);
        tokenDocIds.push(doc.id);
      }
    });

    if (tokens.length === 0) {
      await snap.ref.delete();
      return null;
    }

    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { title, body, url: url || "/" },
      webpush: {
        notification: {
          icon: "/logo.jpg",
          badge: "/logo.jpg",
          tag: "zohour-rating",
          dir: "rtl",
          lang: "ar",
          vibrate: [120, 60, 120],
        },
        fcmOptions: { link: url || "/" },
      },
    });

    // Remove invalid tokens
    const invalidIds = [];
    response.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || "";
        if (
          code.includes("registration-token-not-registered") ||
          code.includes("invalid-argument") ||
          code.includes("invalid-registration-token")
        ) {
          invalidIds.push(tokenDocIds[i]);
        }
      }
    });

    if (invalidIds.length > 0) {
      const batch = db.batch();
      invalidIds.forEach((id) =>
        batch.delete(db.collection("fcmTokens").doc(id))
      );
      await batch.commit();
    }

    // Clean up queue document
    await snap.ref.delete();
    return null;
  }
);
