// =========================================================================
// FILE: public/driver/js/driver-cam.js
// 100% BULLETPROOF TURBO DVR ENGINE (ULTRA LOW DATA + NATURAL 1:1 PROPORTIONS)
// =========================================================================

async function initDriverCam(videoEl, truckId) {
  let facingMode = localStorage.getItem('driver_cam_facing') || 'environment';
  let torchOn = false;
  let nightMode = false;
  let stream = null;
  let broadcastTimer = null;
  let demandUnsub = null;

// 📐 4-लेवल डायनामिक DVR प्रोफाइल्स (हर रिज़ॉल्यूशन पर अलग स्पीड व क्वालिटी)
  const PROFILES = {
    '240p': { maxDim: 260, quality: 0.18, delayMs: 40 },  // 🚀 सुपर फ़ास्ट मोशन (8-10 FPS — मात्र 4 KB)
    '320p': { maxDim: 380, quality: 0.28, delayMs: 80 },  // ⚡ फ़ास्ट हाईवे (6-7 FPS)
    '480p': { maxDim: 520, quality: 0.42, delayMs: 150 }, // 🚗 बैलेंस्ड स्टैंडर्ड (4-5 FPS)
    '720p': { maxDim: 780, quality: 0.60, delayMs: 250 }  // 🏢 HD क्लैरिटी (3 FPS)
  };

  let activeQuality = '320p';
  let isLoopActive = false;

  async function getStream(mode) {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode } },
          audio: false // 🎯 PTT माइक 100% सुरक्षित
        });
      }
    } catch(e1) {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch(e2) {
        return null;
      }
    }
  }

  async function startCamera() {
    if (stream && stream.active) {
      if (videoEl) videoEl.play().catch(() => {});
      return stream;
    }

    stream = await getStream(facingMode);
    if (videoEl && stream && stream.getVideoTracks().length > 0) {
      videoEl.srcObject = stream;
      videoEl.muted = true;
      videoEl.play().catch(() => {});
    }
    return stream;
  }

  function stopCamera() {
    stopLiveBroadcast();
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (videoEl) videoEl.srcObject = null;
  }

  // 📡 सीक्वेंशियल टर्बो लूप (नेटवर्क जाम 0% — रिज़ॉल्यूशन कम होते ही वीडियो 3x फ़ास्ट)
  function startLiveBroadcast(qualityKey) {
    stopLiveBroadcast();
    isLoopActive = true;
    const prof = PROFILES[qualityKey] || PROFILES['320p'];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });

    async function pushLoop() {
      if (!isLoopActive || !videoEl || !videoEl.videoWidth || !truckId || !stream) {
        if (isLoopActive) broadcastTimer = setTimeout(pushLoop, 150);
        return;
      }

      try {
        const vw = videoEl.videoWidth;
        const vh = videoEl.videoHeight;
        const scale = Math.min(prof.maxDim / Math.max(vw, vh), 1.0);
        const targetW = Math.round(vw * scale);
        const targetH = Math.round(vh * scale);

        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        ctx.drawImage(videoEl, 0, 0, targetW, targetH);
        const frameData = canvas.toDataURL('image/jpeg', prof.quality);

const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
        if (db) {
          await db.collection('calls').doc(`truck_${truckId}`).set({
            live_frame: frameData,
            frame_ts: Date.now()
          }, { merge: true });
        }
      } catch(e) {}

      if (isLoopActive) {
        broadcastTimer = setTimeout(pushLoop, prof.delayMs);
      }
    }

    pushLoop();
  }

  function stopLiveBroadcast() {
    isLoopActive = false;
    if (broadcastTimer) {
      clearTimeout(broadcastTimer);
      broadcastTimer = null;
    }
  }


  // 👂 एडमिन ऑन-डिमांड लिसनर
  function startDemandListener() {
    if (demandUnsub || !truckId) return;
    const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
    if (!db) return;

    demandUnsub = db.collection('calls').doc(`truck_${truckId}`).onSnapshot(async (doc) => {
      if (!doc.exists) {
        stopLiveBroadcast();
        return;
      }
      const data = doc.data();
      const isDemandFresh = (Date.now() - (data.demand_ts || 0)) < 45000;
      const isAdminWatching = data.watch_demand === true && isDemandFresh;

      if (isAdminWatching) {
        const reqQuality = data.video_quality || '320p';
        
        if (!stream || !stream.active) {
          await startCamera();
        }

        if (!broadcastTimer || reqQuality !== activeQuality) {
          activeQuality = reqQuality;
          startLiveBroadcast(activeQuality);
        }
      } else {
        stopLiveBroadcast();
      }
    });
  }

  // 👆 ड्राइवर के पहले टच पर कैमरा वार्म-अप
  const warmEvents = ['click', 'touchstart', 'touchend', 'pointerdown'];
  function onFirstTouchWarm() {
    startCamera();
    warmEvents.forEach(evt => document.removeEventListener(evt, onFirstTouchWarm));
  }
  warmEvents.forEach(evt => document.addEventListener(evt, onFirstTouchWarm, { passive: true, once: true }));

  async function switchCamera() {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    stopCamera();
    await startCamera();
    if (broadcastTimer) startLiveBroadcast(activeQuality);
    return stream;
  }

  async function toggleTorch() {
    if (!stream) return false;
    const track = stream.getVideoTracks()[0];
    const caps = (track && track.getCapabilities) ? track.getCapabilities() : {};
    if (!caps.torch) return false;
    torchOn = !torchOn;
    await track.applyConstraints({ advanced: [{ torch: torchOn }] });
    return torchOn;
  }

  function toggleNightMode() {
    nightMode = !nightMode;
    if (videoEl) {
      videoEl.style.filter = nightMode ? 'brightness(1.5) contrast(1.2)' : 'none';
    }
    return nightMode;
  }

  startDemandListener();

  return {
    startCamera,
    stopCamera,
    getStream: () => stream,
    getMicTrack: () => null,
    switchCamera, toggleTorch, toggleNightMode
  };
}

window.DriverCam = { initDriverCam };