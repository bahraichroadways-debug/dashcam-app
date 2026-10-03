// =========================================================================
// drivers-tab.js — Live Fleet Driver Directory & Roster
// =========================================================================

function watchDrivers(db, onUpdate) {
  // लाइव गाड़ियों के डेटा से डायरेक्टरी सिंक
  return db.collection('truck_locations').onSnapshot((snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onUpdate(list);
  });
}

function renderDriversTab(containerEl, drivers, onAdd) {
  const total = drivers.length;
  const onlineCount = drivers.filter(d => (Date.now() - (d.timestamp || 0)) < 120000).length;

  containerEl.innerHTML = `
    <div class="glass" style="padding:14px 18px; margin-bottom:14px; border-radius:14px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-weight:900; font-size:15px; color:#fff;">🚛 FLEET DRIVERS ROSTER</div>
        <div style="font-size:11px; color:#94a3b8; margin-top:2px;">कुल गाड़ियाँ: <b>${total}</b> | ऑनलाइन: <b style="color:#22c55e;">${onlineCount}</b></div>
      </div>
      <div style="font-size:11px; font-weight:800; color:#3b82f6; background:rgba(59,130,246,0.15); padding:4px 10px; border-radius:999px;">
        BAHRAICH FLEET
      </div>
    </div>

    <div id="driversList" class="drivers-list" style="display:flex; flex-direction:column; gap:8px;">
      ${drivers.length ? drivers.map(d => {
        const isOnline = (Date.now() - (d.timestamp || 0)) < 120000;
        const speed = Math.round(Number(d.speed || 0) * 3.6);
        const name = d.driver_name || d.alias || 'ड्राइवर (ऑन ड्यूटी)';
        return `
          <div class="glass" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-radius:12px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:10px; height:10px; border-radius:50%; background:${isOnline ? '#22c55e' : '#64748b'}; box-shadow:${isOnline ? '0 0 10px #22c55e' : 'none'};"></div>
              <div>
                <div style="font-weight:800; font-size:14px; color:#fff; font-family:monospace;">${d.id}</div>
                <div style="font-size:11px; color:#94a3b8; margin-top:2px;">👤 ${name} ${speed > 1 ? `· <b style="color:#38bdf8;">⚡ ${speed} km/h</b>` : ''}</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:11px; font-weight:700; color:${isOnline ? '#22c55e' : '#94a3b8'}; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:6px;">
                ${isOnline ? '🟢 सक्रिय' : '⚪ ऑफलाइन'}
              </span>
              <button onclick="if(window.openLiveTruck) window.openLiveTruck('${d.id}')" style="background:#2563eb; border:none; color:#fff; font-size:11px; font-weight:800; padding:6px 12px; border-radius:8px; cursor:pointer;">
                🎥 लाइव देखें
              </button>
            </div>
          </div>`;
      }).join('') : '<div class="tab-placeholder glass">कोई सक्रिय ड्राइवर नहीं मिला</div>'}
    </div>
  `;
}

window.DriversTab = { watchDrivers, renderDriversTab };