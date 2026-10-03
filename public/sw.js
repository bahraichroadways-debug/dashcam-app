// ==========================================
// FILE: public/sw.js — Ultra-Clean PWA Service Worker (Zero Network Blocking)
// ==========================================

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// 🎯 नो-इंटरसेप्ट: ब्राउज़र का कोई भी नेटवर्क ट्रैफ़िक (Google Apps Script, Firestore, Map) ब्लॉक नहीं होगा