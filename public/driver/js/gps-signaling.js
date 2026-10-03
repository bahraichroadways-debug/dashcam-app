// ==========================================
// FILE: public/driver/js/gps-signaling.js
// 100% SECURE FIREBASE GPS WRITER + DEVICE SYNC + 30H EXPIRY
// ==========================================

(function() {
  const urlParams = new URLSearchParams(window.location.search);
  const isViewer = urlParams.get('role') === 'viewer' || window.isViewerMode === true;
  if (isViewer) return;

  function getSyncDeviceId() {
    if (window.DriverSession && typeof window.DriverSession.getDeviceId === 'function') {
      return window.DriverSession.getDeviceId();
    }
    let id = localStorage.getItem('device_id');
    if (!id) {
      id = 'DEV-' + Math.random().toString(36).substring(2, 7).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
      localStorage.setItem('device_id', id);
    }
    return id;
  }

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
    if (!truckNo) {
      if (window.updateGPSUI) window.updateGPSUI(false, '⚠️ गाड़ी नंबर सेट नहीं है (⚙️ दबाएं)');
      return;
    }
    if (!loc || !loc.lat || !loc.lng) return;

    try {
      if (typeof firebase === 'undefined' || !firebase.firestore) return;
      const db = firebase.firestore();

      const istTime = new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit', minute: '2-digit', hour12: true
      });

      const mainStation = localStorage.getItem('driver_main_station') || 'लाइव रूट';
      const expiresAt = Date.now() + (30 * 60 * 60 * 1000);
      const devId = getSyncDeviceId();
      const devInfo = window.DriverSession ? window.DriverSession.getDeviceInfo() : 'Mobile';

      const payload = {
        lat: Number(loc.lat),
        lng: Number(loc.lng),
        speed: Number(loc.speed || 0),
        accuracy: Number(loc.accuracy || 10),
        heading: Number(loc.heading || 0),
        timestamp: Number(loc.timestamp || Date.now()),
        expiresAtMillis: expiresAt,
        main_station: mainStation,
        last_seen: istTime,
        device_id: devId,
        device_info: devInfo,
        status: 'ACTIVE'
      };

      db.collection('truck_locations').doc(truckNo).set(payload, { merge: true })
        .then(() => {
          if (window.updateGPSUI) window.updateGPSUI(true, `🟢 लाइव लोकेशन जा रही है (${istTime})`);
        })
        .catch((err) => console.warn("GPS sync warn:", err));
    } catch(e) {
      console.warn("GPS signaling error:", e);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    if (window.FleetGPS && typeof window.FleetGPS.startTracking === 'function') {
      window.FleetGPS.startTracking(sendLocationToFirebase);
    }
  });
})();