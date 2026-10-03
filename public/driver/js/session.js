// ==========================================
// FILE: public/driver/js/session.js
// GHOST VEHICLE AUTO-WIPE, SINGLE DEVICE LOCK & PWA DETECTOR
// ==========================================

(function() {
  window.DriverSession = {
    _myClaimTime: 0,
    _unsub: null,

    // 1. पूरे ऐप और gps.js के साथ 100% सिंक डिवाइस ID
    getDeviceId() {
      let id = localStorage.getItem('device_id');
      if (!id) {
        id = 'DEV-' + Math.random().toString(36).substring(2, 7).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
        localStorage.setItem('device_id', id);
      }
      window.DEVICE_ID = id;
      return id;
    },

    // 2. डिवाइस, ब्राउज़र और PWA vs Web की सटीक पहचान
    getDeviceInfo() {
      const ua = navigator.userAgent || '';
      let os = 'Unknown Device';
      if (/windows/i.test(ua)) os = 'Windows PC';
      else if (/android/i.test(ua)) {
        const m = ua.match(/Android\s+([0-9\.]+);?\s*([^;)]+)?/);
        os = (m && m[2] && !m[2].includes('Build')) ? ('Android (' + m[2].trim() + ')') : 'Android Phone';
      } else if (/iphone/i.test(ua)) os = 'iPhone';
      else if (/ipad/i.test(ua)) os = 'iPad';
      else if (/macintosh|mac os x/i.test(ua)) os = 'Mac PC';
      else if (/linux/i.test(ua)) os = 'Linux PC';

      let browser = 'Browser';
      if (/edg/i.test(ua)) browser = 'Edge';
      else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
      else if (/safari/i.test(ua)) browser = 'Safari';
      else if (/firefox/i.test(ua)) browser = 'Firefox';

      const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone === true || 
                    document.referrer.includes('android-app://');
      const appMode = isPWA ? '📲 PWA App' : '🌐 Web';

      return `${os} · ${browser} (${appMode})`;
    },

    // 3. गाड़ी पर इस डिवाइस का अधिकार दर्ज करना
    claimVehicle(truckNo) {
      if (!truckNo || window.isViewerMode) return;
      const cleanTruck = truckNo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!cleanTruck) return;

      const db = (window.firebase && window.firebase.firestore) ? firebase.firestore() : null;
      if (!db) return;

      const devId = this.getDeviceId();
      const devInfo = this.getDeviceInfo();
      const now = Date.now();
      this._myClaimTime = now;

      db.collection('truck_locations').doc(cleanTruck).set({
        device_id: devId,
        device_info: devInfo,
        status: 'ACTIVE',
        last_login_at: now
      }, { merge: true }).catch(function(err) {
        console.warn("Claim truck error:", err);
      });
    },

    // 4. 🔥 गाड़ी नंबर बदलते ही पुरानी गाड़ी का डेटाबेस से सफ़ाया (Clean Handover)
    async changeVehicle(newTruckNo) {
      if (!newTruckNo || window.isViewerMode) return;
      const cleanNew = newTruckNo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const oldTruck = this.getVehicleNum();

      const db = (window.firebase && window.firebase.firestore) ? firebase.firestore() : null;
      
      // 🎯 अगर पुराना नंबर अलग है, तो उसे Firestore से तुरंत डिलीट करें (नो घोस्ट गाड़ी)
      if (db && oldTruck && oldTruck !== cleanNew) {
        try {
          await db.collection('truck_locations').doc(oldTruck).delete();
          await db.collection('calls').doc(oldTruck).delete();
          console.log(`🗑️ पुरानी गाड़ी [${oldTruck}] डेटाबेस से डिलीट कर दी गई!`);
        } catch(e) {}
      }

      localStorage.setItem('driver_vehicle_num', cleanNew);
      localStorage.setItem('driver_id', cleanNew);
      this.claimVehicle(cleanNew);

      alert(`✅ गाड़ी नंबर [${cleanNew}] सुरक्षित हो गया! लोकेशन सिंक शुरू।`);
      window.location.reload();
    },

    // 5. 🔥 लॉगआउट पर डेटाबेस से पूरा सफ़ाया (Auto-Wipe on Logout)
    async logoutAndWipe() {
      const truck = this.getVehicleNum();
      const db = (window.firebase && window.firebase.firestore) ? firebase.firestore() : null;

      if (db && truck && !window.isViewerMode) {
        try {
          await db.collection('truck_locations').doc(truck).delete();
          await db.collection('calls').doc(truck).delete();
          console.log(`🗑️ लॉगआउट: गाड़ी [${truck}] डेटाबेस से साफ़!`);
        } catch(e) {}
      }

      // GPS रोकें
      if (navigator.geolocation && window._geoWatchId) {
        try { navigator.geolocation.clearWatch(window._geoWatchId); } catch(e) {}
      }
      if (window.FleetGPS && typeof window.FleetGPS.stopTracking === 'function') {
        try { window.FleetGPS.stopTracking(); } catch(e) {}
      }

      localStorage.removeItem('driver_vehicle_num');
      localStorage.removeItem('driver_id');
      localStorage.removeItem('fleet_auth');
      sessionStorage.clear();

      window.location.href = '../index.html';
    },

    // 6. सिंगल डिवाइस लिसनर (दूसरे फोन पर लॉगिन होते ही यहाँ से किकआउट)
    watchSession() {
      if (window.isViewerMode) return;
      const truckNo = this.getVehicleNum();
      if (!truckNo) return;

      const cleanTruck = truckNo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const db = (window.firebase && window.firebase.firestore) ? firebase.firestore() : null;
      if (!db) return;

      const self = this;
      const myDevId = this.getDeviceId();

      this.claimVehicle(cleanTruck);

      if (this._unsub) {
        try { this._unsub(); } catch(e) {}
      }

      this._unsub = db.collection('truck_locations').doc(cleanTruck).onSnapshot(function(doc) {
        if (!doc.exists) return;
        const data = doc.data();
        if (!data || !data.device_id) return;

        if (data.device_id === myDevId) return;

        const loginTime = data.last_login_at || 0;
        if (self._myClaimTime && loginTime <= self._myClaimTime) {
          return;
        }

        console.warn("⚠️ Device takeover detected! Logging out this device...");

        localStorage.removeItem('driver_vehicle_num');
        localStorage.removeItem('driver_id');
        localStorage.removeItem('fleet_auth');

        const newDevice = data.device_info || 'दूसरे डिवाइस';
        alert('⚠️ गाड़ी नंबर [' + cleanTruck + '] को ' + newDevice + ' पर चालू कर लिया गया है!\n\nयहाँ से गाड़ी लॉगआउट कर दी गई है।');
        window.location.reload();
      }, function(err) {
        console.warn("Session watch error:", err);
      });
    },

    getDriverSession() {
      if (window.FleetAuth && typeof window.FleetAuth.getSession === 'function') {
        const s = window.FleetAuth.getSession();
        if (s && s.id) return s;
      }
      try {
        const raw = localStorage.getItem('fleet_auth');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.id) return parsed;
        }
      } catch(e) {}

      const savedTruck = localStorage.getItem('driver_vehicle_num') || localStorage.getItem('driver_id') || '';
      return {
        role: 'driver',
        id: savedTruck,
        vehicleNum: savedTruck
      };
    },

    getVehicleNum() {
      return localStorage.getItem('driver_vehicle_num') || this.getDriverSession().vehicleNum || '';
    }
  };

  // 🌐 URL ऑटो-सिंक (अगर लिंक में ?truck=... है तो तुरंत सेव करें)
  (function syncUrlTruck() {
    const p = new URLSearchParams(window.location.search);
    const uTruck = p.get('truck');
    const isViewer = p.get('role') === 'viewer' || window.isViewerMode === true;
    if (!isViewer && uTruck) {
      const clean = uTruck.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (clean && !localStorage.getItem('driver_vehicle_num')) {
        localStorage.setItem('driver_vehicle_num', clean);
        localStorage.setItem('driver_id', clean);
      }
    }
  })();

  function initSessionWatcher() {
    if (window.firebase && window.firebase.firestore) {
      window.DriverSession.watchSession();
    } else {
      setTimeout(initSessionWatcher, 300);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSessionWatcher);
  } else {
    initSessionWatcher();
  }
})();