// ==========================================
// FILE: public/admin/js/live-map.js
// 24/7 ALL-FLEET MAP ENGINE (LIVE PULSE + PARKED 🅿️ PINS + AUTO-FIT)
// ==========================================

function createLiveMap(containerEl) {
  if (!containerEl || typeof L === 'undefined') return { update: () => {}, destroy: () => {} };

  const map = L.map(containerEl, { zoomControl: true }).setView([27.2, 81.5], 8);

  // Esri HD सैटेलाइट व स्ट्रीट मैप
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  let markers = {};
  let hasFittedInitially = false;

  function update(trucks) {
    if (!Array.isArray(trucks)) return;

    const currentIds = new Set();
    const boundsPoints = [];

    trucks.forEach((truck) => {
      currentIds.add(truck.id);
      const pos = [truck.lat, truck.lng];
      boundsPoints.push(pos);

      // 🎨 पिन का रूप: लाइव के लिए ग्लोइंग नीला/हरा, पार्क्ड के लिए ग्रे स्टील
      let iconHtml = '';
      if (truck.isLive) {
        iconHtml = `
          <div style="position:relative; width:30px; height:30px;">
            <div style="position:absolute; inset:0; border-radius:50%; background:#22c55e; opacity:0.4; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:absolute; inset:3px; border-radius:50%; background:#16a34a; border:2px solid #fff; box-shadow:0 0 12px rgba(34,197,94,0.9); display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:900;">🚚</div>
          </div>`;
      } else {
        iconHtml = `
          <div style="position:relative; width:26px; height:26px;">
            <div style="position:absolute; inset:0; border-radius:50%; background:#475569; border:2px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:bold;">🅿️</div>
          </div>`;
      }

      const pinIcon = L.divIcon({
        className: 'fleet-marker-pin',
        html: iconHtml,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const popupHtml = `
        <div style="font-family:sans-serif; font-size:12px; line-height:1.5; min-width:180px;">
          <div style="font-weight:900; font-size:13px; color:${truck.isLive ? '#16a34a' : '#475569'}; border-bottom:1px solid #e2e8f0; padding-bottom:3px; margin-bottom:5px;">
            ${truck.isLive ? '🟢 लाइव चल रही है' : '🅿️ पार्क्ड / अंतिम स्थिति'}
          </div>
          <div>🚚 गाड़ी: <b>${truck.id}</b></div>
          <div>⚡ गति: <b>${truck.speedText}</b></div>
          <div>🎯 स्टेशन: <b>${truck.station}</b></div>
          <div>📱 डिवाइस: <span style="font-size:10.5px; color:#2563eb;">${truck.deviceInfo}</span></div>
          <div style="margin-top:4px; font-size:10.5px; color:#64748b;">🕒 अंतिम समय: <b>${truck.lastSeen}</b></div>
        </div>
      `;

      if (markers[truck.id]) {
        markers[truck.id].setLatLng(pos);
        markers[truck.id].setIcon(pinIcon);
        markers[truck.id].getPopup().setContent(popupHtml);
      } else {
        const marker = L.marker(pos, { icon: pinIcon }).addTo(map);
        marker.bindPopup(popupHtml);
        markers[truck.id] = marker;
      }
    });

    // जो गाड़ियाँ हट गई हैं उनके मार्कर हटाएं
    Object.keys(markers).forEach((id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(markers[id]);
        delete markers[id];
      }
    });

    // ⚡ पहली बार लोड होने पर पूरे फ्लीट को स्क्रीन में फ़िट करें
    if (!hasFittedInitially && boundsPoints.length > 0) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [40, 40], maxZoom: 14 });
      hasFittedInitially = true;
    }
  }

  function destroy() {
    Object.values(markers).forEach(m => map.removeLayer(m));
    markers = {};
    map.remove();
  }

  return { update, destroy };
}

window.LiveMap = { createLiveMap };