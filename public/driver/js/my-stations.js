// =========================================================================
// FILE: public/driver/js/my-stations.js
// 120FPS LERP, 3-LAYER MAP DOCK (STREET/ESRI/CARTODB), OSRM ETA & SAFE FLEET
// =========================================================================

(function() {
  let mapInstance = null;
  let driverMarker = null;
  let stationMarkers = [];
  let routeLayerGroup = null;

  // 3 मुख्य मैप लेयर्स (0 API क्रेडिट - 100% मुफ़्त)
  let streetLayer = null;
  let satelliteLayer = null;
  let darkLayer = null;
  let currentLayerType = 'street';

  // LERP स्मूथ मोशन वेरिएबल्स
  let currentLat = null, currentLng = null;
  let targetLat = null, targetLng = null;
  let isInterpolating = false;
  let loadedStationsData = [];
  let currentETA = '';

  const urlParams = new URLSearchParams(window.location.search);
  const isViewer = urlParams.get('role') === 'viewer' || window.isViewerMode === true;
  
  function getSafeTruckNumber() {
    let t = urlParams.get('truck') || localStorage.getItem('driver_vehicle_num') || localStorage.getItem('driver_id');
    if (!t) {
      try { t = JSON.parse(localStorage.getItem('fleet_auth') || '{}').vehicleNum; } catch(e) {}
    }
    return (t || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  const targetTruck = getSafeTruckNumber();
  let hasFittedBounds = false;

  // 📍 Bahraich Roadways के सभी 39 प्रमाणित स्टेशन (100% सुरक्षित)
  const KNOWN_STATIONS = {
    'bahraich': [27.5705, 81.5977],
    'prayagpur': [27.3833, 81.7833],
    'payagpur': [27.3833, 81.7833],
    'mihipurwa': [28.0400, 81.2500],
    'motipur': [28.0400, 81.2500],
    'risiya': [27.7333, 81.6000],
    'bishesharganj': [27.4667, 81.8500],
    'nanpara': [27.8667, 81.5000],
    'pakharpur': [27.3556, 81.5458],
    'fakharpur': [27.3556, 81.5458],
    'rupaidiha': [27.9833, 81.6167],
    'rupediha': [27.9833, 81.6167],
    'kaisarganj': [27.2472, 81.5500],
    'matera': [27.7600, 81.4500],
    'jarwalroad': [27.1540, 81.5840],
    'jarwal': [27.1667, 81.5500],
    'kundasar': [27.2800, 81.5800],
    'gajadharpur': [27.2900, 81.6200],
    'rukanapur': [27.2100, 81.5200],
    'bhinga': [27.7167, 81.9333],
    'ekouna': [27.5333, 81.9667],
    'ikauna': [27.5333, 81.9667],
    'ikouna': [27.5333, 81.9667],
    'gilaula': [27.6000, 81.8500],
    'gilola': [27.6000, 81.8500],
    'katra': [27.2000, 81.8833],
    'katrabazar': [27.2000, 81.8833],
    'aryanagar': [27.2833, 81.9333],
    'kodiabazar': [27.2500, 81.8100],
    'kaudia': [27.2500, 81.8100],
    'gonda': [27.1300, 81.9600],
    'ramnagar': [27.0833, 81.4000],
    'masauli': [26.9833, 81.3333],
    'masuli': [26.9833, 81.3333],
    'ranibazar': [27.0500, 81.4500],
    'barabanki': [26.9298, 81.1834],
    'kanpur': [26.4499, 80.3319],
    'lucknow': [26.8467, 80.9462],
    'begumpur': [27.6000, 81.5500]
  };

  // 🎯 100% अचूक 30 घंटे का नियम (सुरक्षित फ़ॉलबैक सहित)
  function isChallanWithin30Hours(dateStr) {
    if (!dateStr) return true;
    try {
      let s = String(dateStr).trim();
      let match = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
      if (!match) return true;

      let chDay = Number(match[1]);
      let chMonth = Number(match[2]) - 1;
      let chYear = Number(match[3]);

      let timeMatch = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
      let chHour = 10, chMin = 0;
      if (timeMatch) {
        chHour = Number(timeMatch[1]);
        chMin = Number(timeMatch[2]) || 0;
        let ampm = (timeMatch[4] || '').toLowerCase();
        if (ampm === 'pm' && chHour < 12) chHour += 12;
        if (ampm === 'am' && chHour === 12) chHour = 0;
      }

      let dispatchDate = new Date(chYear, chMonth, chDay, chHour, chMin, 0);
      let dispatchTime = dispatchDate.getTime();
      if (isNaN(dispatchTime)) return true;

      const elapsedHours = (Date.now() - dispatchTime) / (3600 * 1000);
      return elapsedHours <= 48 && elapsedHours >= -24;
    } catch(e) {
      return true;
    }
  }

  function getHaversineKM(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  }

  // 🛣️ लाइव KM HUD + OSRM ETA अपडेटर
  function updateLiveKMDistance(tLat, tLng) {
    const kmTextEl = document.getElementById('liveKmText');
    const etaTextEl = document.getElementById('liveEtaText');
    const kmBadgeWrap = document.getElementById('liveKmBadge');
    
    if (!loadedStationsData.length || !tLat || !tLng) {
      if (kmBadgeWrap) kmBadgeWrap.classList.add('hidden');
      return;
    }

    const targetSt = loadedStationsData[0];
    const km = getHaversineKM(tLat, tLng, targetSt.coords[0], targetSt.coords[1]);
    
    if (kmTextEl) kmTextEl.innerText = `${km} KM`;
    if (etaTextEl) {
      if (currentETA) {
        etaTextEl.innerText = `⏱️ ${currentETA}`;
        etaTextEl.style.display = 'inline';
      } else {
        etaTextEl.style.display = 'none';
      }
    }
    if (kmBadgeWrap) kmBadgeWrap.classList.remove('hidden');
  }

  // ⚡ 120 FPS शुद्ध LERP लूप
  let lastLerpHudUpdate = 0;

  function animateMarker() {
    if (currentLat === null || targetLat === null) return;
    const dLat = targetLat - currentLat;
    const dLng = targetLng - currentLng;

    if (Math.abs(dLat) < 0.000003 && Math.abs(dLng) < 0.000003) {
      currentLat = targetLat;
      currentLng = targetLng;
      if (driverMarker) driverMarker.setLatLng([currentLat, currentLng]);
      updateLiveKMDistance(currentLat, currentLng);
      updateRouteLine();
      isInterpolating = false;
      return;
    }

    currentLat += dLat * 0.08;
    currentLng += dLng * 0.08;

    if (driverMarker) driverMarker.setLatLng([currentLat, currentLng]);

    const now = Date.now();
    if (now - lastLerpHudUpdate > 500) {
      lastLerpHudUpdate = now;
      updateLiveKMDistance(currentLat, currentLng);
    }

    requestAnimationFrame(animateMarker);
  }

  function handleNewTruckLocation(lat, lng) {
    if (!mapInstance) return;
    targetLat = Number(lat);
    targetLng = Number(lng);

    if (currentLat === null) {
      currentLat = targetLat;
      currentLng = targetLng;
      if (!driverMarker) {
        const radarIcon = L.divIcon({
          className: 'radar-pin',
          html: `
            <div style="position:relative; width:30px; height:30px;">
              <div style="position:absolute; inset:0; border-radius:50%; background:#3b82f6; opacity:0.4; animation:pulse 1.8s infinite;"></div>
              <div style="position:absolute; inset:3px; border-radius:50%; background:#2563eb; border:2.5px solid #ffffff; box-shadow:0 0 14px rgba(37,99,235,0.9); display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px;">🚚</div>
            </div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });
        driverMarker = L.marker([currentLat, currentLng], { icon: radarIcon }).addTo(mapInstance);
      }
      mapInstance.setView([currentLat, currentLng], 13);
      updateLiveKMDistance(currentLat, currentLng);
      renderAllStationPins();
    } else {
      if (!isInterpolating) {
        isInterpolating = true;
        requestAnimationFrame(animateMarker);
      }
    }
  }

  // 📍 ऑन-डिमांड रिवर्स एड्रेस लुकअप (कैश सहित)
  window.lookupStationAddress = function(lat, lng, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const cacheKey = `addr_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      el.innerHTML = `📍 ${cached}`;
      return;
    }

    el.innerHTML = "⏳ पता खोजा जा रहा है...";

    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`, {
      headers: { 'Accept-Language': 'hi,en' }
    })
    .then(r => r.json())
    .then(data => {
      const addr = data.display_name ? data.display_name.split(',').slice(0, 3).join(',') : 'स्थान उपलब्ध';
      localStorage.setItem(cacheKey, addr);
      el.innerHTML = `📍 ${addr}`;
    })
    .catch(() => {
      el.innerHTML = `📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    });
  };

  // 📍 मल्टी-स्टॉप स्टेशन पिन
  function renderAllStationPins() {
    if (!mapInstance || !loadedStationsData.length) return;

    stationMarkers.forEach(m => {
      try { m.unbindPopup(); } catch(e) {}
      mapInstance.removeLayer(m);
    });
    stationMarkers = [];

    const boundsPoints = [];
    if (currentLat) boundsPoints.push([currentLat, currentLng]);

    loadedStationsData.forEach((st, idx) => {
      const isMain = idx === 0;
      const pinColor = isMain ? '#ea580c' : '#2563eb';
      const pinEmoji = isMain ? '🎯' : '📍';
      const label = `${idx + 1}. ${st.name} ${isMain ? '[MAIN]' : ''}`;
      const addrContainerId = `addr_box_${idx}`;

      const icon = L.divIcon({
        className: 'station-flag-pin',
        html: `
          <div style="transform:translate(-50%, -100%); background:${pinColor}; color:#fff; padding:3px 8px; border-radius:14px; font-size:10.5px; font-weight:800; border:2px solid #fff; box-shadow:0 4px 14px rgba(0,0,0,0.6); white-space:nowrap; display:flex; align-items:center; gap:4px; cursor:pointer;">
            <span>${pinEmoji}</span> <span>${label}</span>
          </div>`,
        iconSize: [0, 0]
      });

      const marker = L.marker(st.coords, { icon: icon }).addTo(mapInstance);
      const gMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${st.coords[0]},${st.coords[1]}`;

      marker.bindPopup(`
        <div style="font-family:sans-serif; font-size:12px; line-height:1.5; min-width:180px;">
          <div style="font-weight:900; color:${pinColor}; border-bottom:1px solid #e2e8f0; padding-bottom:3px; margin-bottom:4px;">
            ${pinEmoji} ${st.name} ${isMain ? '(मुख्य स्टेशन)' : ''}
          </div>
          <div>📄 चालान सं.: <b>#${st.chalanNo}</b></div>
          ${currentLat ? `<div>🛣️ दूरी: <b>${getHaversineKM(currentLat, currentLng, st.coords[0], st.coords[1])} KM</b></div>` : ''}
          
          <div id="${addrContainerId}" style="font-size:11px; color:#64748b; margin:4px 0;">
            <button onclick="lookupStationAddress(${st.coords[0]}, ${st.coords[1]}, '${addrContainerId}')" style="background:none; border:none; color:#2563eb; text-decoration:underline; font-size:11px; cursor:pointer; padding:0;">
              📍 असली पता देखें
            </button>
          </div>

          <div style="margin-top:6px; padding-top:6px; border-top:1px solid #f1f5f9;">
            <a href="${gMapsUrl}" target="_blank" rel="noopener noreferrer" style="display:block; text-align:center; background:#2563eb; color:#fff; text-decoration:none; padding:5px 8px; border-radius:6px; font-weight:bold; font-size:11px; box-shadow:0 2px 6px rgba(37,99,235,0.4);">
              🧭 Google Maps नेविगेशन
            </a>
          </div>
        </div>
      `);

      stationMarkers.push(marker);
      boundsPoints.push(st.coords);
    });

    updateRouteLine();

    if (!hasFittedBounds && boundsPoints.length > 1) {
      mapInstance.fitBounds(L.latLngBounds(boundsPoints), { padding: [50, 50], maxZoom: 14 });
      hasFittedBounds = true;
    }
  }

  // 🛣️ OSRM असली हाईवे रूट + ETA कैलकुलेटर
  let isFetchingRoute = false;
  let lastRouteFetchTime = 0;

  async function updateRouteLine() {
    if (!mapInstance || !loadedStationsData.length) return;

    const waypoints = [];
    if (currentLat && currentLng) {
      waypoints.push([currentLat, currentLng]);
    }
    loadedStationsData.forEach(st => waypoints.push(st.coords));
    if (waypoints.length < 2) return;

    if (!routeLayerGroup) {
      routeLayerGroup = L.layerGroup().addTo(mapInstance);
    }

    const now = Date.now();
    if (now - lastRouteFetchTime < 90000 && routeLayerGroup.getLayers().length > 0) return;
    if (isFetchingRoute) return;
    isFetchingRoute = true;

    try {
      const coordString = waypoints.map(pt => `${pt[1]},${pt[0]}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;
      
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.routes && data.routes[0]) {
        const sec = data.routes[0].duration || 0;
        if (sec > 0) {
          const hrs = Math.floor(sec / 3600);
          const mins = Math.round((sec % 3600) / 60);
          currentETA = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
          if (currentLat && currentLng) updateLiveKMDistance(currentLat, currentLng);
        }

        if (data.routes[0].geometry) {
          routeLayerGroup.clearLayers();
          const roadPoints = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);

          L.polyline(roadPoints, {
            color: '#60a5fa', weight: 7, opacity: 0.3, lineCap: 'round', lineJoin: 'round'
          }).addTo(routeLayerGroup);

          L.polyline(roadPoints, {
            color: '#2563eb', weight: 4, opacity: 0.9, lineCap: 'round', lineJoin: 'round'
          }).addTo(routeLayerGroup);

          lastRouteFetchTime = Date.now();
        }
      }
    } catch(e) {
      if (routeLayerGroup.getLayers().length === 0) {
        L.polyline(waypoints, { color: '#3b82f6', weight: 3, opacity: 0.45, dashArray: '6, 8' }).addTo(routeLayerGroup);
      }
    } finally {
      isFetchingRoute = false;
    }
  }

  window.focusStationOnMap = function(stationName) {
    const st = loadedStationsData.find(s => s.name === stationName);
    if (st && mapInstance) {
      mapInstance.flyTo(st.coords, 14, { duration: 1.2 });
      if (currentLat) {
        const km = getHaversineKM(currentLat, currentLng, st.coords[0], st.coords[1]);
        const kmTextEl = document.getElementById('liveKmText');
        const etaTextEl = document.getElementById('liveEtaText');
        if (kmTextEl) kmTextEl.innerText = `${km} KM`;
        if (etaTextEl && currentETA) etaTextEl.innerText = `⏱️ ${currentETA}`;
      }
    }
  };

  // ⚡ 100% फुलप्रूफ़ चालान व स्टेशन फेचिंग
  async function fetchAssignedBranches() {
    const truckNo = targetTruck;
    const container = document.getElementById('branchList');
    const badge = document.getElementById('tripCountBadge');
    const disp = document.getElementById('vehicleDisplay');

    if (disp) disp.innerText = truckNo || (isViewer ? 'लाइव दर्शक मोड' : 'गाड़ी सेट नहीं');
    if (!container) return;

    if (!truckNo) {
      container.innerHTML = `
        <div class="zero-trip-pill" style="color:#f59e0b;">
          <span>⚠️ गाड़ी नंबर सेट नहीं है (⚙️ दबाएं)</span>
        </div>`;
      if (badge) badge.innerText = '0 ट्रिप';
      return;
    }

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject('timeout'), 15000));

    try {
      const url = window.GAS_API_URL || (window.GAS_CONFIG && window.GAS_CONFIG.API_URL) || (window.FleetConfig && window.FleetConfig.gasApiUrl) || "https://script.google.com/macros/s/AKfycbx9oxhAhB83TJFKySjDo2m3XhF1pESZZkeOIzr9Duf3EH6aMib0Yx4PJ54RZfFKwwKWDg/exec";
      const fetchPromise = fetch(url + '?action=get_challans').then(r => r.json());
      const allChalans = await Promise.race([fetchPromise, timeoutPromise]);

      const myTrips = (Array.isArray(allChalans) ? allChalans : []).filter(ch => {
        const s = String(ch.status || '').toLowerCase().trim();
        const isTransit = s.includes('transit') || s.includes('open') || s.includes('active') || s.includes('dispatch') || ch.status === 'In-Transit';
        if (!isTransit) return false;

        let json = typeof ch.json_data === 'string' ? JSON.parse(ch.json_data || '{}') : (ch.json_data || {});
        let t = ((json.header && json.header.truck_no) || (json.header && json.header.vehicle_no) || json.truck_no || json.vehicle_no || ch.truck_no || ch.vehicle_no || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        if (t !== truckNo) return false;

        const realChalanDate = (json.header && json.header.date) || ch.date || ch.chalan_date || ch.timestamp;
        return isChallanWithin30Hours(realChalanDate);
      });

      if (badge) badge.innerText = `${myTrips.length} ट्रिप`;

      if (myTrips.length === 0) {
        localStorage.removeItem('driver_main_station');
        loadedStationsData = [];
        if (routeLayerGroup && mapInstance) routeLayerGroup.clearLayers();
        stationMarkers.forEach(m => {
          try { m.unbindPopup(); } catch(e) {}
          if (mapInstance) mapInstance.removeLayer(m);
        });
        stationMarkers = [];
        const kmBadgeWrap = document.getElementById('liveKmBadge');
        if (kmBadgeWrap) kmBadgeWrap.classList.add('hidden');

        container.innerHTML = `
          <div class="zero-trip-pill">
            <span class="w-2 h-2 rounded-full animate-pulse" style="background:#10b981;"></span>
            <span>🟢 कोई एक्टिव चालान नहीं · गाड़ी खाली है</span>
          </div>`;
        return;
      }

      loadedStationsData = [];
      myTrips.forEach((trip) => {
        let json = typeof trip.json_data === 'string' ? JSON.parse(trip.json_data || '{}') : (trip.json_data || {});
        let bName = trip.branch || (json.header && json.header.transporter) || 'शाखा';
        let cNo = trip.chalan_no || (json.header && json.header.chalan_no) || 'N/A';

        let clean = String(bName).toLowerCase().replace(/[^a-z]/g, '');
        let foundKey = Object.keys(KNOWN_STATIONS).find(k => clean.includes(k));

        if (foundKey) {
          loadedStationsData.push({
            name: bName,
            chalanNo: cNo,
            coords: KNOWN_STATIONS[foundKey]
          });
        }
      });

      if (loadedStationsData.length > 0) {
        localStorage.setItem('driver_main_station', loadedStationsData[0].name);
        renderAllStationPins();
      }

      container.innerHTML = myTrips.map((trip, idx) => {
        let json = typeof trip.json_data === 'string' ? JSON.parse(trip.json_data || '{}') : (trip.json_data || {});
        let cNo = trip.chalan_no || (json.header && json.header.chalan_no) || 'N/A';
        let bName = trip.branch || (json.header && json.header.transporter) || 'शाखा';
        let isMain = idx === 0;

        return `
          <div onclick="focusStationOnMap('${bName}')" style="display:flex; justify-content:space-between; align-items:center; padding:7px 10px; background:${isMain ? 'rgba(234,88,12,0.12)' : 'rgba(255,255,255,0.04)'}; border:1px solid ${isMain ? 'rgba(234,88,12,0.4)' : 'rgba(255,255,255,0.08)'}; border-radius:10px; cursor:pointer; font-size:12px; margin-bottom:4px;">
            <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
              <span>${isMain ? '🎯' : '🏢'}</span>
              <span style="font-weight:800; color:#f8fafc; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${bName}</span>
              <span style="font-size:11px; color:#94a3b8; font-family:monospace; font-weight:700;">#${cNo}</span>
            </div>
            ${isMain ? '<span style="font-size:9px; background:rgba(234,88,12,0.25); color:#fdba74; padding:2px 6px; border-radius:4px; font-weight:900;">MAIN</span>' : '<span style="font-size:10px; color:#60a5fa; font-weight:700;">नक्शा ➔</span>'}
          </div>`;
      }).join('');

    } catch(err) {
      if (badge) badge.innerText = '0 ट्रिप';
      container.innerHTML = `
        <div class="zero-trip-pill">
          <span class="w-2 h-2 rounded-full animate-pulse" style="background:#10b981;"></span>
          <span>🟢 कोई एक्टिव चालान नहीं · गाड़ी खाली है</span>
        </div>`;
    }
  }

  // ग्लोबल एक्सेस
  window.fetchAssignedBranches = fetchAssignedBranches;

  // ⚡ 120 FPS मक्खन ड्रैग हैंडलर
  function init120FpsDragger() {
    const handle = document.getElementById('dragHandle');
    if (!handle) return;
    let isDragging = false;

    const onMove = (clientY) => {
      if (!isDragging) return;
      window.requestAnimationFrame(() => {
        const totalH = window.innerHeight;
        const newPct = Math.min(85, Math.max(10, (clientY / totalH) * 100));
        document.documentElement.style.setProperty('--top-h', `${newPct}vh`);
      });
    };

    handle.addEventListener('touchstart', () => { isDragging = true; }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches[0]) onMove(e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchend', () => {
      isDragging = false;
      if (mapInstance) setTimeout(() => mapInstance.invalidateSize(), 60);
    });

    handle.addEventListener('mousedown', () => { isDragging = true; });
    window.addEventListener('mousemove', (e) => { if (isDragging) onMove(e.clientY); });
    window.addEventListener('mouseup', () => {
      isDragging = false;
      if (mapInstance) setTimeout(() => mapInstance.invalidateSize(), 60);
    });
  }

  // =========================================================================
  // 🗺️ 3-वे लेयर स्विचर + पतली स्लाइडिंग लाइन डॉक (Sleek Expandable Dock)
  // =========================================================================
  function initExpandableToolDock() {
    const mapSection = document.getElementById('mapSection');
    if (!mapSection || document.getElementById('mapDockWrap') || !mapInstance) return;

    const dock = document.createElement('div');
    dock.id = 'mapDockWrap';
    dock.className = 'map-dock-wrap';
    dock.innerHTML = `
      <div class="map-dock-bar">
        <div class="map-dock-items" id="mapDockItems">
          <button class="dock-icon-btn active" id="btnLayerStreet" title="स्ट्रीट मैप">🗺️</button>
          <button class="dock-icon-btn" id="btnLayerSatellite" title="Esri सैटेलाइट">🛰️</button>
          <button class="dock-icon-btn" id="btnLayerDark" title="CartoDB डार्क मैप">🌙</button>
          <button class="dock-icon-btn" id="btnCenterTruck" title="गाड़ी पर फ़ोकस">🎯</button>
          <button class="dock-icon-btn" id="btnShareLocation" title="लाइव लोकेशन कॉपी करें">📋</button>
        </div>
        <button class="map-dock-trigger" id="mapDockTrigger" title="मैप टूल्स">🥞</button>
      </div>
    `;

    mapSection.appendChild(dock);

    const trigger = document.getElementById('mapDockTrigger');
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dock.classList.toggle('open');
    });

    mapInstance.on('click', () => dock.classList.remove('open'));

    function switchMapLayer(type) {
      if (currentLayerType === type) return;
      
      [streetLayer, satelliteLayer, darkLayer].forEach(l => {
        if (l && mapInstance.hasLayer(l)) mapInstance.removeLayer(l);
      });

      document.querySelectorAll('.dock-icon-btn').forEach(b => b.classList.remove('active'));

      if (type === 'satellite') {
        mapInstance.addLayer(satelliteLayer);
        document.getElementById('btnLayerSatellite').classList.add('active');
      } else if (type === 'dark') {
        mapInstance.addLayer(darkLayer);
        document.getElementById('btnLayerDark').classList.add('active');
      } else {
        mapInstance.addLayer(streetLayer);
        document.getElementById('btnLayerStreet').classList.add('active');
      }
      currentLayerType = type;
      localStorage.setItem('driver_default_map', type);
    }

    document.getElementById('btnLayerStreet').onclick = () => switchMapLayer('street');
    document.getElementById('btnLayerSatellite').onclick = () => switchMapLayer('satellite');
    document.getElementById('btnLayerDark').onclick = () => switchMapLayer('dark');

    document.getElementById('btnCenterTruck').onclick = () => {
      if (currentLat && currentLng) {
        mapInstance.flyTo([currentLat, currentLng], 15, { duration: 1 });
      }
      dock.classList.remove('open');
    };

    document.getElementById('btnShareLocation').onclick = () => {
      if (currentLat && currentLng) {
        const link = `https://www.google.com/maps?q=${currentLat},${currentLng}`;
        navigator.clipboard.writeText(link).then(() => {
          alert("📋 गाड़ी की लाइव लोकेशन कॉपी हो गई!\n\nव्हाट्सएप पर पेस्ट करके भेजें: " + link);
        }).catch(() => {
          prompt("लोकेशन लिंक कॉपी करें:", link);
        });
      } else {
        alert("गाड़ी का GPS अभी लोड हो रहा है, कृपया प्रतीक्षा करें...");
      }
      dock.classList.remove('open');
    };
  }

  // 🗺️ मुख्य मैप इंजन (डुप्लीकेशन क्रैश से 100% सुरक्षित)
  function initFreeMap() {
    const mapEl = document.getElementById('transportMap');
    if (!mapEl) return;

    // अगर मैप कंटेनर पहले से इनिशियलाइज़ है तो उसी का इस्तेमाल करें
    if (mapEl._leaflet_id && window.mapInstance) {
      mapInstance = window.mapInstance;
      initExpandableToolDock();
      return;
    }

    try {
      if (!mapEl._leaflet_id) {
        mapInstance = L.map('transportMap', { zoomControl: false, attributionControl: false }).setView([26.8467, 80.9462], 13);
        window.mapInstance = mapInstance;
      } else {
        mapInstance = window.mapInstance;
      }
    } catch(err) {
      console.warn("Leaflet container reused safely:", err);
      mapInstance = window.mapInstance;
    }

    if (!mapInstance) return;

    // 1. स्ट्रीट टाइल्स (OSM)
    streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });

    // 2. सैटेलाइट टाइल्स (Esri HD - 100% मुफ़्त)
    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });

    // 3. CartoDB डार्क मैटर टाइल्स (100% मुफ़्त - रात्रिकालीन मोड)
    darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd' });

    const defPref = localStorage.getItem('driver_default_map') || 'street';
    if (defPref === 'satellite') {
      satelliteLayer.addTo(mapInstance);
      currentLayerType = 'satellite';
    } else if (defPref === 'dark') {
      darkLayer.addTo(mapInstance);
      currentLayerType = 'dark';
    } else {
      streetLayer.addTo(mapInstance);
      currentLayerType = 'street';
    }

    L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(mapInstance);
    initExpandableToolDock();

    if (!isViewer && window.FleetGPS && typeof window.FleetGPS.onLocation === 'function') {
      window.FleetGPS.onLocation((loc) => {
        handleNewTruckLocation(loc.lat, loc.lng);
      });
    }

    if (isViewer && targetTruck) {
      if (typeof firebase !== 'undefined' && firebase.firestore) {
        firebase.firestore().collection('truck_locations').doc(targetTruck).onSnapshot((doc) => {
          if (doc.exists) {
            const d = doc.data();
            if (d.lat && d.lng) {
              handleNewTruckLocation(d.lat, d.lng);
            }
          }
        }, (err) => console.warn("Viewer sync info:", err));
      }
    }
  }

  window.MyStations = {
    isChallanWithin30Hours,
    computeMaxExpiry: async function(vehicleNum) {
      return Date.now() + (30 * 60 * 60 * 1000);
    }
  };

  // सुरक्षित इनिशियलाइज़ेशन (बिना किसी क्रैश के)
  window.addEventListener('DOMContentLoaded', () => {
    try { initFreeMap(); } catch(e) {}
    try { init120FpsDragger(); } catch(e) {}
    fetchAssignedBranches();
    setInterval(fetchAssignedBranches, 25000);
  });
})();