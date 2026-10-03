// ==========================================
// FILE: public/admin/js/truck-list.js
// ALL-FLEET VEHICLE LIST (30s FAST OFFLINE WATCHDOG & INSTANT SYNC)
// ==========================================

let cachedTrucks = [];
let localTickerTimer = null;

function renderTruckList(containerEl, onWatch, db) {
  if (!containerEl) return;
  containerEl.innerHTML = '<div class="tab-placeholder glass" style="padding:16px;">लोड हो रहा है...</div>';

  if (!db) return;

  function refreshListUI() {
    if (!containerEl || cachedTrucks.length === 0) return;
    const now = Date.now();

    // ⚡ 30-सेकंड फास्ट ऑफलाइन डिटेक्टर (नेट बंद होते ही 30s में ऑफ़लाइन)
    cachedTrucks.forEach((t) => {
      const diffMs = now - t.lastTs;
      t.isLive = (diffMs < 32000 && t.rawStatus !== 'APP_CLOSED');
      t.speedText = t.speed > 2 ? `⚡ ${Math.round(t.speed)} km/h` : (t.isLive ? '🛑 रुकी हुई' : '🅿️ ऑफलाइन');
    });

    cachedTrucks.sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return a.lastTs - b.lastTs;
    });

    containerEl.innerHTML = '';
    cachedTrucks.forEach((truckObj) => {
      const row = document.createElement('div');
      row.className = 'truck-row glass press-scale';
      row.innerHTML = `
        <div class="truck-info" style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
          <span class="dot ${truckObj.isLive ? 'online' : 'offline'}"></span>
          <div style="min-width:0;">
            <div style="font-weight:700; font-size:14px; color:#fff; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              🚚 <span>${truckObj.id}</span>
              <span style="font-size:10px; background:rgba(255,255,255,0.08); padding:1px 6px; border-radius:4px; color:var(--text-dim);">${truckObj.speedText}</span>
              <span style="font-size:9.5px; font-weight:700; background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.35); color:#60a5fa; padding:1px 6px; border-radius:6px;">
                ${truckObj.deviceInfo}
              </span>
            </div>
            <div style="font-size:11px; color:var(--text-dim); margin-top:3px; word-break:break-word;">
              🎯 ${truckObj.station} ${truckObj.lastSeen ? '· ' + truckObj.lastSeen : ''}
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
          <button class="watch-btn press-scale" style="${!truckObj.isLive ? 'background:rgba(59,130,246,0.2); border:1px solid #3b82f6; color:#93c5fd;' : ''}">
            ${truckObj.isLive ? 'Watch Live' : '🎙️ Call PTT'}
          </button>
          
          <button class="trash-delete-btn press-scale" title="डेटाबेस से गाड़ी हटाएं" style="width:30px; height:30px; border-radius:50%; background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); color:#ef4444; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
            🗑️
          </button>
        </div>
      `;

      const btn = row.querySelector('.watch-btn');
      if (btn) btn.addEventListener('click', () => onWatch(truckObj.id, truckObj.id));

      const delBtn = row.querySelector('.trash-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`⚠️ क्या आप गाड़ी [${truckObj.id}] को डेटाबेस से पूरी तरह हटाना चाहते हैं?`)) {
            Promise.all([
              db.collection('truck_locations').doc(truckObj.id).delete(),
              db.collection('calls').doc(truckObj.id).delete().catch(()=>{})
            ]).then(() => {
              if (window.showToast) window.showToast(`गाड़ी [${truckObj.id}] डिलीट कर दी गई`, 'info');
            }).catch(err => alert("Error: " + err.message));
          }
        });
      }

      containerEl.appendChild(row);
    });

    const statsRow = document.getElementById('statsRow');
    if (statsRow && window.StatsPanel) {
      const alertCount = (document.getElementById('alertsList') && document.getElementById('alertsList').children.length) || 0;
      window.StatsPanel.renderStats(statsRow, cachedTrucks, alertCount);
    }
  }

  // 1. फायरस्टोर रियलटाइम स्नैपशॉट
  db.collection('truck_locations').onSnapshot((snap) => {
    const now = Date.now();
    const rawList = [];

    snap.forEach((doc) => {
      const truckId = String(doc.id).trim().toUpperCase();
      if (!/^[A-Z]{2}[0-9]/i.test(truckId)) return;

      const data = doc.data() || {};
      let rawTs = data.timestamp || data.time || data.last_login_at || data.updated_at || data.ts;
      let ts = rawTs > 1e11 ? Number(rawTs) : (rawTs ? Number(rawTs) * 1000 : now);
      const diffMs = now - ts;
      const isLive = (diffMs < 32000 && data.status !== 'APP_CLOSED');

      let smartLastSeen = data.last_seen || '';
      const dateObj = new Date(ts);
      const isToday = (dateObj.toDateString() === new Date().toDateString());
      if (!isToday && !isNaN(dateObj.getTime())) {
        const dayMonth = dateObj.toLocaleDateString('hi-IN', { day: '2-digit', month: 'short' });
        smartLastSeen = `${dayMonth}, ${smartLastSeen}`;
      }

      const speed = Number(data.speed || 0);

      rawList.push({
        id: truckId,
        name: truckId,
        truckNo: truckId,
        lastTs: ts,
        speed: speed,
        rawStatus: data.status,
        isLive: isLive,
        station: data.main_station || 'लाइव रूट',
        deviceInfo: data.device_info || 'Device',
        lastSeen: smartLastSeen
      });
    });

    cachedTrucks = rawList;
    refreshListUI();

    if (cachedTrucks.length === 0) {
      containerEl.innerHTML = `
        <div class="tab-placeholder glass" style="padding:24px; text-align:center;">
          <div style="font-size:24px; margin-bottom:6px;">🚚</div>
          <div style="font-weight:600; color:var(--text);">कोई गाड़ी दर्ज नहीं है</div>
        </div>`;
    }
  }, (err) => {
    console.warn("Truck list error:", err);
  });

  // 2. ⚡ 4-सेकंड का एक्टिव लोकल टिकर (नेट कटते ही 30s में ऑटो-ऑफलाइन)
  if (localTickerTimer) clearInterval(localTickerTimer);
  localTickerTimer = setInterval(refreshListUI, 4000);
}

window.TruckList = {
  renderTruckList,
  getTrucks: () => cachedTrucks
};