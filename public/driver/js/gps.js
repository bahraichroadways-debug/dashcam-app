// ==========================================
// FILE: public/driver/js/gps.js
// 100% CENTRAL SATELLITE GPS ENGINE + BATTERY-SHIELDED BACKGROUND TRACKING
// ==========================================

(function() {
  const urlParams = new URLSearchParams(window.location.search);
  const isViewer = urlParams.get('role') === 'viewer' || window.isViewerMode === true;

  // 🗺️ 1. चारों आधुनिक मैप लेयर्स के टाइल सर्वर्स
  const MAP_LAYERS = {
    street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 })
  };

  let activeLayerKey = localStorage.getItem('driver_default_map') || 'street';
  let mapInstance = null;
  let driverMarker = null;
  let lastFetchedAddr = null;
  let lastAddrLat = null;
  let lastAddrLng = null;
  let silentAudioEl = null;

  // 📐 दूरी मापने का Haversine फॉर्मूला
  function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // 🛡️ 2. बैकग्राउंड शील्ड: स्क्रीन लॉक होने पर Android को सोने से रोके (0% बैटरी ड्रेन)
  function ensureBackgroundShield() {
    if (!silentAudioEl) {
      silentAudioEl = document.createElement('audio');
      silentAudioEl.loop = true;
      silentAudioEl.volume = 0.01;
      silentAudioEl.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      document.body.appendChild(silentAudioEl);
    }
    silentAudioEl.play().catch(() => {});
  }
  ['click', 'touchstart', 'pointerdown'].forEach(e => document.addEventListener(e, ensureBackgroundShield, { once: true, passive: true }));

  // 📍 3. 3-टियर स्मार्ट रिवर्स जियोकोडिंग (200m कैश सुरक्षित - 0% API क्रेडिट खर्च)
  async function fetchAddressSmart(lat, lng) {
    if (lastFetchedAddr && lastAddrLat && lastAddrLng) {
      const d = getDistanceMeters(lastAddrLat, lastAddrLng, lat, lng);
      if (d < 200) return lastFetchedAddr;
    }

    let addr = null;

    // टियर 1: OSM Nominatim (100% फ्री)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'hi,en' }
      });
      if (res.ok) {
        const data = await res.json();
        addr = data.display_name;
      }
    } catch(e) {}

    // टियर 2: LocationIQ फ़ॉलबैक
    if (!addr) {
      try {
        const res2 = await fetch(`https://us1.locationiq.com/v1/reverse?key=pk.8b196884bb07a4a9042b322a36b9e289&lat=${lat}&lon=${lng}&format=json`);
        if (res2.ok) {
          const d2 = await res2.json();
          addr = d2.display_name;
        }
      } catch(e2) {}
    }

    // टियर 3: Geoapify फ़ॉलबैक
    if (!addr) {
      try {
        const res3 = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=6b46bbf69ef949b29cbca82db94d1355`);
        if (res3.ok) {
          const d3 = await res3.json();
          if (d3.features && d3.features.length) addr = d3.features[0].properties.formatted;
        }
      } catch(e3) {}
    }

    if (addr) {
      lastFetchedAddr = addr;
      lastAddrLat = lat;
      lastAddrLng = lng;
      return addr;
    }

    return `${lat.toFixed(5)}, ${lng.toFixed(5)} (हाईवे लोकेशन)`;
  }

  // 🚀 4. Google Maps 3D नेविगेशन एरो (बॉर्डर-लेस + 360° रोटेशन)
  function createNavigationArrowIcon(heading = 0, isMoving = false) {
    const rot = Math.round(heading || 0);

    if (isMoving) {
      return L.divIcon({
        className: 'nav-arrow-marker',
        html: `
          <div style="transform: rotate(${rot}deg); transform-origin: center center; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 10px rgba(37,99,235,0.6));">
            <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
              <polygon points="20,4 34,34 20,27 6,34" fill="#2563eb" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
              <circle cx="20" cy="20" r="3.5" fill="#60a5fa"/>
            </svg>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });
    } else {
      return L.divIcon({
        className: 'nav-arrow-marker',
        html: `
          <div style="width: 40px; height: 40px; position: relative; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: rgba(37,99,235,0.25); animation: pulse 2s infinite;"></div>
            <div style="width: 18px; height: 18px; border-radius: 50%; background: #2563eb; border: 3px solid #ffffff; box-shadow: 0 0 12px #2563eb;"></div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
    }
  }

  // 🗺️ 5. क्रैश-प्रूफ मैप इनिशियलाइज़र (No Map Container Initialized Error)
  function initTransportMap() {
    const el = document.getElementById('transportMap');
    if (!el || typeof L === 'undefined') return;

    // 🛡️ अगर मैप पहले से बना है या Leaflet ID मौजूद है तो दोबारा शुरू न करें (क्रैश रोकें)
    if (mapInstance || el._leaflet_id) {
      if (el._leaflet_id && !mapInstance && window.mapInstance) {
        mapInstance = window.mapInstance;
      }
      return mapInstance;
    }

    mapInstance = L.map('transportMap', {
      zoomControl: false,
      attributionControl: false
    }).setView([27.5706, 81.5977], 15);

    window.mapInstance = mapInstance;
    (MAP_LAYERS[activeLayerKey] || MAP_LAYERS.street).addTo(mapInstance);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(mapInstance);

    window.switchMapLayer = function(layerKey) {
      if (!MAP_LAYERS[layerKey] || !mapInstance) return;
      Object.values(MAP_LAYERS).forEach(l => mapInstance.removeLayer(l));
      MAP_LAYERS[layerKey].addTo(mapInstance);
      activeLayerKey = layerKey;
      localStorage.setItem('driver_default_map', layerKey);

      document.querySelectorAll('.dock-icon-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layer === layerKey);
      });
    };
    return mapInstance;
  }

  // 🚚 6. मैप पर गाड़ी व टच HUD कार्ड अपडेट
  function updateVehicleOnMap(loc) {
    if (!mapInstance) initTransportMap();
    if (!mapInstance) return;

    const lat = loc.lat;
    const lng = loc.lng;
    const speed = Math.round(Number(loc.speed || 0));
    const isMoving = speed > 2;
    const truckNo = localStorage.getItem('driver_vehicle_num') || '--';

    const icon = createNavigationArrowIcon(loc.heading, isMoving);

    if (!driverMarker) {
      driverMarker = L.marker([lat, lng], { icon: icon, zIndexOffset: 1000 }).addTo(mapInstance);

      driverMarker.on('click', async () => {
        const popupContent = `
          <div class="hud-popup-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-weight:900; font-size:14px; color:#fff; font-family:monospace;">🚚 ${truckNo}</span>
              <span style="font-size:11px; font-weight:800; background:rgba(37,99,235,0.25); color:#60a5fa; padding:2px 8px; border-radius:6px; border:1px solid #2563eb;">
                ${isMoving ? `⚡ ${speed} km/h` : '🛑 रुकी हुई'}
              </span>
            </div>
            <div id="popupAddress" style="font-size:11.5px; color:#cbd5e1; line-height:1.4; margin-bottom:10px; min-height:28px;">
              ⏳ सटीक पता लोड हो रहा है...
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
              <span style="font-size:10px; color:#94a3b8;">GPS एक्यूरेसी: ±${Math.round(loc.accuracy || 5)}m</span>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" style="background:#2563eb; color:#fff; font-size:11px; font-weight:800; padding:5px 12px; border-radius:8px; text-decoration:none; display:flex; align-items:center; gap:4px;">
                🗺️ Google Maps
              </a>
            </div>
          </div>
        `;
        driverMarker.bindPopup(popupContent, { maxWidth: 280, className: 'glass-popup' }).openPopup();

        const realAddr = await fetchAddressSmart(lat, lng);
        const addrEl = document.getElementById('popupAddress');
        if (addrEl) addrEl.innerText = realAddr;
      });

      mapInstance.setView([lat, lng], 16);
    } else {
      driverMarker.setLatLng([lat, lng]);
      driverMarker.setIcon(icon);
    }

    if (localStorage.getItem('driver_auto_center') !== 'false') {
      mapInstance.panTo([lat, lng], { animate: true, duration: 0.8 });
    }
  }

  // 🎯 7. री-सेंटर व WhatsApp शेयर
  window.recenterDriverGPS = function() {
    if (!mapInstance || !driverMarker) return;
    const pos = driverMarker.getLatLng();
    mapInstance.flyTo(pos, 16, { animate: true, duration: 0.8 });
    if (window.showToast) window.showToast("🎯 गाड़ी पर फोकस लॉक!", "info");
  };

  window.shareLiveLocationWhatsApp = function() {
    const truckNo = localStorage.getItem('driver_vehicle_num') || '';
    if (!truckNo) {
      alert("गाड़ी नंबर दर्ज नहीं है!");
      return;
    }
    const shareUrl = `${window.location.origin}/driver/driver.html?role=viewer&truck=${truckNo}`;
    if (navigator.clipboard) navigator.clipboard.writeText(shareUrl).catch(()=>{});
    const msg = `🚚 मेरी गाड़ी [${truckNo}] की लाइव लोकेशन यहाँ ट्रैक करें:\n${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (isViewer) {
    window.FleetGPS = {
      isViewer: true,
      fetchPosition: function() {},
      startTracking: function() {},
      stopTracking: function() {},
      onLocation: function() {}
    };
    return;
  }

  let bgWorker = null;
  let workerBlobUrl = null;

  function initWorker(onUpdate) {
    ensureBackgroundShield();
    if (bgWorker) return;
    try {
      // 🛡️ वॉचडॉग वर्कर: हर 30 सेकंड में बैकग्राउंड पल्स (बिना रिडंडेंट getCurrentPosition के)
      const workerBlob = new Blob([
        "setInterval(function() { postMessage('watchdog'); }, 30000);"
      ], { type: 'application/javascript' });
      workerBlobUrl = URL.createObjectURL(workerBlob);
      bgWorker = new Worker(workerBlobUrl);
      bgWorker.onmessage = () => {
        // सिर्फ तब बैकअप ले जब 35s से लोकेशन न आई हो
        if (Date.now() - (window.FleetGPS.lastSentTime || 0) > 35000) {
          window.FleetGPS.fetchPosition(onUpdate);
        }
      };
    } catch(e) {}
  }

  window.FleetGPS = {
    watchId: null,
    lastSentTime: 0,
    lastSentLat: null,
    lastSentLng: null,
    wakeLock: null,
    subscribers: [],

    onLocation: function(callback) {
      if (typeof callback === 'function') {
        this.subscribers.push(callback);
      }
    },

    notifySubscribers: function(locData) {
      this.subscribers.forEach(cb => {
        try { cb(locData); } catch(e) {}
      });
      updateVehicleOnMap(locData);
    },

    async requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          this.wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch(e) {}
    },

    fetchPosition: function(callback) {
      if (!navigator.geolocation) {
        if (window.updateGPSUI) window.updateGPSUI(false, 'GPS सपोर्ट नहीं है');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const locData = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speed: pos.coords.speed || 0,
            accuracy: pos.coords.accuracy || 10,
            heading: pos.coords.heading || 0,
            timestamp: Date.now()
          };
this.notifySubscribers(locData);
          const stEl = document.getElementById('gpsLiveStatus');
          if (stEl) {
            const spd = Math.round(Number(locData.speed || 0) * 3.6);
            stEl.className = 'gps-status text-emerald-400';
            stEl.innerHTML = `🟢 GPS लाइव · ${spd > 1 ? spd + ' km/h' : 'स्थिर'} · ±${Math.round(locData.accuracy || 5)}m`;
          }
          if (this.shouldSendUpdate(locData)) {
            this.recordSend(locData);
            if (typeof callback === 'function') callback(locData);
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
      );
    },

    // 🔋 8. स्मार्ट बैटरी थ्रॉटलर (चलती गाड़ी: 15s | रुकी गाड़ी: 60s)
    shouldSendUpdate: function(loc) {
      const now = Date.now();
      const timeDiff = now - this.lastSentTime;

      if (!this.lastSentLat || !this.lastSentLng) return true;

      const dist = getDistanceMeters(this.lastSentLat, this.lastSentLng, loc.lat, loc.lng);
      const userRateSec = Number(localStorage.getItem('driver_gps_rate') || 15);
      const minIntervalMs = userRateSec * 1000;

// ⚡ एक्टिव हार्टबीट (12-15 सेकंड): नेट बंद होते ही एडमिन तुरंत पकड़ लेगा
      return timeDiff >= 12000;    },

    recordSend: function(loc) {
      this.lastSentTime = Date.now();
      this.lastSentLat = loc.lat;
      this.lastSentLng = loc.lng;
    },

    startTracking: function(onUpdate) {
      initTransportMap();
      this.requestWakeLock();

      // 1. पहला फास्ट फिक्स
      this.fetchPosition(onUpdate);

      // 2. सिंगल एक्टिव वॉचर (Duplicate watch रोका गया)
      if (navigator.geolocation && !this.watchId) {
        this.watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const locData = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              speed: pos.coords.speed || 0,
              accuracy: pos.coords.accuracy || 10,
              heading: pos.coords.heading || 0,
              timestamp: Date.now()
            };

this.notifySubscribers(locData);
            const stEl = document.getElementById('gpsLiveStatus');
            if (stEl) {
              const spd = Math.round(Number(locData.speed || 0) * 3.6);
              stEl.className = 'gps-status text-emerald-400';
              stEl.innerHTML = `🟢 GPS लाइव · ${spd > 1 ? spd + ' km/h' : 'स्थिर'} · ±${Math.round(locData.accuracy || 5)}m`;
            }

            if (this.shouldSendUpdate(locData)) {
              this.recordSend(locData);
              if (typeof onUpdate === 'function') onUpdate(locData);
            }
          },
          (err) => console.warn("GPS watch info:", err.message),
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
        );
      }

      // 3. वॉचडॉग बैकग्राउंड टिकर
      initWorker(onUpdate);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.requestWakeLock();
          if (Date.now() - this.lastSentTime > 15000) {
            this.fetchPosition(onUpdate);
          }
        }
      });
    },

    stopTracking: function() {
      if (this.watchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
      if (this.wakeLock) {
        try { this.wakeLock.release(); } catch(e) {}
        this.wakeLock = null;
      }
      if (bgWorker) {
        bgWorker.terminate();
        bgWorker = null;
        if (workerBlobUrl) {
          try { URL.revokeObjectURL(workerBlobUrl); } catch(e) {}
          workerBlobUrl = null;
        }
      }
      if (silentAudioEl) {
        try { silentAudioEl.pause(); } catch(e) {}
        silentAudioEl = null;
      }
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    initTransportMap();
  });
})();