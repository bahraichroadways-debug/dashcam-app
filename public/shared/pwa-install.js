(function() {
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isInstalled || localStorage.getItem('dashcam_installed') === 'true') return;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  let promptEvent = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptEvent = e;
    renderBar();
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem('dashcam_installed', 'true');
    removeBar();
  });

  function renderBar() {
    if (document.getElementById('pwa-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'pwa-bar';
    bar.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9999;background:#0d1117;border:1px solid rgba(255,255,255,0.15);padding:10px 16px;border-radius:30px;display:flex;align-items:center;gap:12px;box-shadow:0 10px 30px rgba(0,0,0,0.8);';
    bar.innerHTML = `
      <img src="/icon/icon-192.png" style="width:30px;height:30px;border-radius:6px;">
      <span style="color:#fff;font-size:13px;font-weight:600;">Dashcam App Install करें</span>
      <button id="pwa-ok" style="background:#3b82f6;color:#fff;border:none;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;">Install</button>
      <button id="pwa-no" style="background:none;border:none;color:#888;font-size:16px;cursor:pointer;">✕</button>
    `;
    document.body.appendChild(bar);

    document.getElementById('pwa-ok').onclick = async () => {
      if (!promptEvent) return;
      promptEvent.prompt();
      const res = await promptEvent.userChoice;
      if (res.outcome === 'accepted') localStorage.setItem('dashcam_installed', 'true');
      removeBar();
      promptEvent = null;
    };
    document.getElementById('pwa-no').onclick = removeBar;
  }

  function removeBar() {
    const el = document.getElementById('pwa-bar');
    if (el) el.remove();
  }
})();