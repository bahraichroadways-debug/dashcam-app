// push-notify.js — FCM token request + save ONLY.
// ACTIVATION NEEDED: paste your VAPID key below (Firebase Console → Project Settings → Cloud Messaging → Web Push certificates)
// Until then this silently no-ops (safe to ship as-is).

const VAPID_KEY = 'PASTE_YOUR_VAPID_KEY_HERE';

async function initPushNotify(db, collectionName, docId) {
  if (VAPID_KEY === 'PASTE_YOUR_VAPID_KEY_HERE') return null; // not activated yet — safe no-op
  if (!('serviceWorker' in navigator) || !firebase.messaging) return null;

  try {
    const messaging = firebase.messaging();
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await messaging.getToken({ vapidKey: VAPID_KEY });
    if (token) {
      await db.collection(collectionName).doc(docId).set({ fcmToken: token }, { merge: true });
    }
    return token;
  } catch (err) {
    console.warn('Push notify setup skipped:', err.message);
    return null;
  }
}

window.PushNotify = { initPushNotify };
