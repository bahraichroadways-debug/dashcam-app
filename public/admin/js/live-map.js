// ==========================================
// FILE: public/admin/js/live-map.js
// 24/7 ALL-FLEET MAP ENGINE (ON-DEMAND TRACKING SIGNAL + LIVE PINS)
// ==========================================

function createLiveMap(containerEl) {
  if (!containerEl || typeof L === 'undefined') return { update: () => {}, destroy: () => {} };

  const map = L.map(containerEl, { zoomControl: true }).setView([27.2, 81.5], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  let markers = {};
  let hasFittedInitially = false;
  let demandTimer = null;
  let activeTruckIds = [];

  // 📡 एडमिन मैप पर मौजूद सभी गाड़ियों को ऑन-डिमांड वेकअप पिंग भेजता है
  function sendMapTrackingDemand(isActive) {
    const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
    if (!db || activeTruckIds.length === 0) return;

    activeTruckIds.forEach(id => {
      db.collection('truck_locations').doc(id).set({
        track_demand: isActive,
        demand_ts: Date.now()
      }, { merge: true }).catch(() => {});
    });
  }

  // मैप खुला रहने तक हर 20 सेकंड में पल्स
  demandTimer = setInterval(() => sendMapTrackingDemand(true), 20000);

  function update(trucks) {
    if (!Array.isArray(trucks)) return;

    const currentIds = new Set();
    const boundsPoints = [];
    activeTruckIds = trucks.map(t => t.id);

    trucks.forEach((truck) => {
      currentIds.add(truck.id);
      const pos = [truck.lat, truck.lng];
      boundsPoints.push(pos);

      let iconHtml = '';
      if (truck.isLive) {
        iconHtml = `
          <div style="position:relative; width:30px; height:30px;">
            <div style="position:absolute; inset:0; border-radius:50%; background:#22c55e; opacity:0.4; animation:pulse 1.8s infinite;"></div>
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

    Object.keys(markers).forEach((id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(markers[id]);
        delete markers[id];
      }
    });

    if (!hasFittedInitially && boundsPoints.length > 0) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [40, 40], maxZoom: 14 });
      hasFittedInitially = true;
    }
  }

  function destroy() {
    if (demandTimer) { clearInterval(demandTimer); demandTimer = null; }
    // 🛑 एडमिन के मैप से हटते ही ड्राइवर के फोन को वापस सुला देना (0% बैटरी खर्च)
    sendMapTrackingDemand(false);

    Object.values(markers).forEach(m => map.removeLayer(m));
    markers = {};
    map.remove();
  }

  return { update, destroy };
}

window.LiveMap = { createLiveMap };