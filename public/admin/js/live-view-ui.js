// ==========================================
// FILE: public/admin/js/live-view-ui.js
// 100% BULLETPROOF LIVE COCKPIT WITH 4-TIER DVR SWITCHER
// ==========================================

function liveViewUI(panelEl, videoEl, titleEl) {
  let pipMap = null;
  let pipMarker = null;
  let locationUnsub = null;
  let videoFrameUnsub = null;
  let currentTruckId = null;
  let demandHeartbeat = null;
  let activeQuality = '320p';

  function initPipMap(lat, lng) {
    const el = document.getElementById('pipMapLeaflet');
    if (!el || typeof L === 'undefined') return;

    if (!pipMap) {
      pipMap = L.map('pipMapLeaflet', { zoomControl: false, attributionControl: false }).setView([lat, lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(pipMap);
      
      const pinIcon = L.divIcon({
        className: 'pip-pin',
        html: `<div style="background:#2563eb; color:#fff; border:2px solid #fff; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:10px; box-shadow:0 0 10px rgba(0,0,0,0.8);">🚚</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      pipMarker = L.marker([lat, lng], { icon: pinIcon }).addTo(pipMap);
    } else {
      pipMap.setView([lat, lng], 13);
      if (pipMarker) pipMarker.setLatLng([lat, lng]);
      setTimeout(() => pipMap.invalidateSize(), 150);
    }
  }

  function takeSnapshot() {
    const liveImg = document.getElementById('dashcamLiveImg');
    if (liveImg && liveImg.src) {
      const a = document.createElement('a');
      a.href = liveImg.src;
      a.download = `${currentTruckId || 'Truck'}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.jpg`;
      a.click();
      return;
    }
    if (!videoEl || !videoEl.videoWidth) {
      alert("⚠️ लाइव वीडियो उपलब्ध नहीं है!");
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/jpeg', 0.92);
      a.download = `${currentTruckId || 'Truck'}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.jpg`;
      a.click();
    } catch(e) {
      alert("स्नैपशॉट एरर: " + e.message);
    }
  }

  function sendDemandSignal(truckName, isWatching, quality) {
    const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
    if (!db || !truckName) return;

    db.collection('calls').doc(`truck_${truckName}`).set({
      watch_demand: isWatching,
      video_quality: quality || activeQuality,
      demand_ts: Date.now()
    }, { merge: true }).catch(() => {});
  }

  const mapBtn = document.getElementById('togglePipMapBtn');
  const snapBtn = document.getElementById('snapshotBtn');
  const audioBtn = document.getElementById('toggleAudioBtn');
  const fsBtn = document.getElementById('fullscreenBtn');
  const pipWrap = document.getElementById('pipMapContainer');
  const speedBadge = document.getElementById('liveSpeedBadge');
  const audioHolder = document.getElementById('audioModePlaceholder');

  // 🎯 4-लेवल DVR क्वालिटी स्विचर
  let qualitySelect = document.getElementById('dvrQualitySelect');
  if (!qualitySelect && speedBadge && speedBadge.parentElement) {
    qualitySelect = document.createElement('select');
    qualitySelect.id = 'dvrQualitySelect';
    qualitySelect.style.cssText = `
      font-size: 10.5px; font-weight: 800; background: #0f172a;
      border: 1px solid #3b82f6; color: #38bdf8; padding: 2px 6px;
      border-radius: 6px; cursor: pointer; outline: none; margin-left: 6px;
    `;
    qualitySelect.innerHTML = `
      <option value="240p">⚡ 240p Eco</option>
      <option value="320p" selected>⚡ 320p Low</option>
      <option value="480p">⚡ 480p Std</option>
      <option value="720p">⚡ 720p HD</option>
    `;
    qualitySelect.onchange = (e) => {
      activeQuality = e.target.value;
      if (currentTruckId) sendDemandSignal(currentTruckId, true, activeQuality);
    };
    speedBadge.parentElement.appendChild(qualitySelect);
  }

  if (mapBtn) {
    mapBtn.onclick = () => {
      if (!pipWrap) return;
      pipWrap.classList.toggle('hidden');
      mapBtn.classList.toggle('active');
      if (!pipWrap.classList.contains('hidden') && pipMap) {
        setTimeout(() => pipMap.invalidateSize(), 150);
      }
    };
  }

  if (snapBtn) snapBtn.onclick = takeSnapshot;

  if (audioBtn) {
    audioBtn.onclick = () => {
      videoEl.muted = !videoEl.muted;
      audioBtn.classList.toggle('active', !videoEl.muted);
    };
  }

  if (fsBtn) {
    fsBtn.onclick = () => {
      if (!document.fullscreenElement) {
        panelEl.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };
  }

  function open(truckName) {
    currentTruckId = truckName;
    titleEl.textContent = truckName;
    panelEl.classList.add('open');

    // 1. ऑन-डिमांड वेकअप पिंग भेजना
    sendDemandSignal(truckName, true, activeQuality);
    demandHeartbeat = setInterval(() => sendDemandSignal(truckName, true, activeQuality), 20000);

    if (window.connectTruckPTT) {
      window.connectTruckPTT(truckName);
    }

    const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
    if (!db) return;

    // 2. लोकेशन व स्पीड लिसनर
    locationUnsub = db.collection('truck_locations').doc(truckName).onSnapshot((doc) => {
      if (!doc.exists) {
        if (speedBadge) speedBadge.innerText = '🛑 ऑफलाइन';
        return;
      }
      const d = doc.data();
      if (speedBadge) {
        const sp = Number(d.speed || 0);
        speedBadge.innerText = sp > 2 ? `⚡ ${Math.round(sp)} km/h` : '🛑 रुकी हुई';
      }
      if (d.lat && d.lng) {
        initPipMap(Number(d.lat), Number(d.lng));
      }
    });

    // 3. 🚀 नेचुरल 1:1 आस्पेक्ट-रेश्यो इमेज डिस्प्ले (0% खिंचाव)
    let liveImg = document.getElementById('dashcamLiveImg');
    if (!liveImg && videoEl && videoEl.parentElement) {
      liveImg = document.createElement('img');
      liveImg.id = 'dashcamLiveImg';
      liveImg.style.cssText = `
        position: absolute; inset: 0; width: 100%; height: 100%; 
        object-fit: contain; background: #000; z-index: 10; border-radius: 14px;
      `;
      videoEl.parentElement.appendChild(liveImg);
    }

    // 4. ड्राइवर से आने वाले फ़्रेम को सीधे दिखाना
    videoFrameUnsub = db.collection('calls').doc(`truck_${truckName}`).onSnapshot((doc) => {
      if (!doc.exists) return;
      const data = doc.data();
      if (data && data.live_frame) {
        if (liveImg) {
          liveImg.src = data.live_frame;
          liveImg.style.display = 'block';
        }
        if (audioHolder) audioHolder.classList.add('hidden');
      }
    });
  }

  function close() {
    panelEl.classList.remove('open');
    if (demandHeartbeat) { clearInterval(demandHeartbeat); demandHeartbeat = null; }

    if (currentTruckId) sendDemandSignal(currentTruckId, false, activeQuality);

    currentTruckId = null;
    if (locationUnsub) { locationUnsub(); locationUnsub = null; }
    if (videoFrameUnsub) { videoFrameUnsub(); videoFrameUnsub = null; }

    const liveImg = document.getElementById('dashcamLiveImg');
    if (liveImg) liveImg.style.display = 'none';

    if (pipWrap) pipWrap.classList.add('hidden');
    if (mapBtn) mapBtn.classList.remove('active');
    if (audioHolder) audioHolder.classList.add('hidden');

    if (window.PTTEngine && typeof window.PTTEngine.switchRoom === 'function') {
      window.PTTEngine.switchRoom('fleet_broadcast');
    }
  }

  function setStream(stream) {
    videoEl.srcObject = stream;
    videoEl.muted = false;
  }

  return { open, close, setStream, takeSnapshot };
}

window.LiveViewUI = { liveViewUI };