// ==========================================
// FILE: public/driver/js/gps-signaling.js
// 100% BULLETPROOF GPS TO FIRESTORE WRITER
// ==========================================

(function() {
  const urlParams = new URLSearchParams(window.location.search);
  const isViewer = urlParams.get('role') === 'viewer' || window.isViewerMode === true;
  if (isViewer) return;

  function getCleanVehicleNumber() {
    let num = localStorage.getItem('driver_vehicle_num') || localStorage.getItem('driver_id');
    if (!num) {
      try {
        const fa = JSON.parse(localStorage.getItem('fleet_auth') || '{}');
        num = fa.vehicleNum || fa.id;
      } catch(e) {}
    }
    return (num || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function sendLocationToFirebase(loc) {
    const truckNo = getCleanVehicleNumber();
    if (!truckNo || !loc || !loc.lat || !loc.lng) return;

    try {
      const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
      if (!db) return;

      const now = Date.now();
      const istTime = new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit', minute: '2-digit', hour12: true
      });

      const mainStation = localStorage.getItem('driver_main_station') || 'लाइव रूट';
// 🎯 असली Native APK पहचान (Chrome Web का गलत नाम हमेशा के लिए खत्म)
      const isNative = !!(window.Capacitor && (window.Capacitor.isNativePlatform ? window.Capacitor.isNativePlatform() : true));
      const devInfo = isNative ? 'Android App (Native APK)' : 'Android Phone · Web';

      const payload = {
        lat: Number(loc.lat),
        lng: Number(loc.lng),
        speed: Number(loc.speed || 0),
        accuracy: Number(loc.accuracy || 10),
        heading: Number(loc.heading || 0),
        timestamp: now, // ⚡ सटीक ताज़ा टाइमस्टैम्प
        time: now,
        main_station: mainStation,
        last_seen: istTime,
        device_info: devInfo,
        status: 'ACTIVE'
      };

      // ⚡ सीधे Firestore में लाइव लोकेशन राइट करना
      db.collection('truck_locations').doc(truckNo).set(payload, { merge: true })
        .then(() => {
          console.log(`📡 [GPS SYNC] लोकेशन सफलतापूर्वक भेजी गई: ${truckNo} (${istTime})`);
          const stEl = document.getElementById('gpsLiveStatus');
          if (stEl) {
            const spd = Math.round(Number(loc.speed || 0) * 3.6);
            stEl.className = 'gps-status text-emerald-400';
            stEl.innerHTML = `🟢 GPS लाइव · ${spd > 1 ? spd + ' km/h' : 'स्थिर'} · ±${Math.round(loc.accuracy || 5)}m`;
          }
        })
        .catch(err => console.warn("GPS sync error:", err));
    } catch(e) {
      console.warn("GPS error:", e);
    }
  }

  // 🎯 बिना किसी रुकावट के सीधे GPS लिसनर से जुड़ना
  function initSignaling() {
    if (window.FleetGPS && typeof window.FleetGPS.onLocation === 'function') {
      window.FleetGPS.onLocation(sendLocationToFirebase);
    } else {
      setTimeout(initSignaling, 300);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSignaling);
  } else {
    initSignaling();
  }
})();