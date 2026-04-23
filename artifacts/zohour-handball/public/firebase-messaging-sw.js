/* Firebase Cloud Messaging Service Worker
   Handles background push notifications when the app tab/browser is closed. */

importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBtiCT9zHkx28jGmggXLUpe5kuGoG5rNpw",
  authDomain: "zohour-handball-2010-f59c4.firebaseapp.com",
  projectId: "zohour-handball-2010-f59c4",
  storageBucket: "zohour-handball-2010-f59c4.firebasestorage.app",
  messagingSenderId: "733306244703",
  appId: "1:733306244703:web:f1182437c062aa014695ea",
});

const messaging = firebase.messaging();

// Background message handler — fires when the page is closed or in background.
messaging.onBackgroundMessage((payload) => {
  const notif = payload.notification || {};
  const data = payload.data || {};
  const title = notif.title || data.title || "إشعار جديد";
  const body = notif.body || data.body || "";
  self.registration.showNotification(title, {
    body,
    icon: "/logo.jpg",
    badge: "/logo.jpg",
    tag: data.tag || "zohour-rating",
    lang: "ar",
    dir: "rtl",
    vibrate: [120, 60, 120],
    requireInteraction: true,
  });
});

// Click → focus existing tab or open the player dashboard in a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = "/player";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            try { client.navigate(url); } catch {}
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
