// ==========================================
// FILE: public/driver/js/bg-keeper.js
// 24/7 BACKGROUND GPS KEEPER ENGINE (AUDIO-HARDWARE PULSE)
// ==========================================

(function() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('role') === 'viewer' || window.isViewerMode === true) {
    return;
  }

  let audioEl = null;
  let isKeeperActive = false;
  let lastGpsPulse = 0;

  // शुद्ध मूक 1-सेकंड की ऑडियो डेटा URI
  const SILENT_WAV_BASE64 = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

  function setupMediaSession() {
    if ('mediaSession' in navigator) {
      const truck = localStorage.getItem('driver_vehicle_num') || 'ट्रक';
      navigator.mediaSession.metadata = new MediaMetadata({
        title: '🚛 Bahraich Roadways Live GPS',
        artist: `गाड़ी: ${truck} · 24/7 लाइव ट्रैकिंग ऑन`,
        album: 'Bahraich Roadways Transport',
        artwork: [{ src: 'https://cdn-icons-png.flaticon.com/512/2554/2554978.png', sizes: '512x512', type: 'image/png' }]
      });

      navigator.mediaSession.setActionHandler('play', () => startKeeper());
      navigator.mediaSession.setActionHandler('pause', () => startKeeper());
    }
  }

  function startKeeper() {
    if (isKeeperActive) return;

    try {
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.src = SILENT_WAV_BASE64;
        audioEl.loop = true;
        audioEl.volume = 0.01;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.setAttribute('webkit-playsinline', 'true');
        audioEl.style.position = 'absolute';
        audioEl.style.width = '1px';
        audioEl.style.height = '1px';
        audioEl.style.opacity = '0.01';
        audioEl.style.pointerEvents = 'none';
        document.body.appendChild(audioEl); // DOM में जोड़ना अनिवार्य है

        audioEl.addEventListener('timeupdate', () => {
          const now = Date.now();
          if (now - lastGpsPulse >= 15000) {
            lastGpsPulse = now;
            if (window.FleetGPS && typeof window.FleetGPS.fetchPosition === 'function') {
              window.FleetGPS.fetchPosition(() => {});
            }
          }
        });
      }

      const p = audioEl.play();
      if (p !== undefined) {
        p.then(() => {
          isKeeperActive = true;
          setupMediaSession();
          console.log("🟢 24/7 Background GPS Audio Shield Active!");
        }).catch(() => {});
      }
    } catch(e) {}
  }

  const triggerEvents = ['click', 'touchstart', 'touchend', 'pointerdown'];
  function onFirstUserGesture() {
    startKeeper();
    triggerEvents.forEach(evt => document.removeEventListener(evt, onFirstUserGesture));
  }
  triggerEvents.forEach(evt => document.addEventListener(evt, onFirstUserGesture, { passive: true, once: true }));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      startKeeper();
    }
  });

  window.BGKeeper = {
    start: startKeeper,
    isActive: () => isKeeperActive
  };
})();