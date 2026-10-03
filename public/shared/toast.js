// ==========================================
// FILE: public/shared/toast.js
// APPLE-GRADE DYNAMIC ISLAND SINGLETON TOAST
// ==========================================

let activeToastTimeout = null;

function showToast(message, type = 'info', duration = 2400) {
  let toastEl = document.getElementById('fleetDynamicToast');

  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'fleetDynamicToast';
    toastEl.style.cssText = `
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%) translateY(-20px);
      z-index: 999999; padding: 7px 16px; border-radius: 999px;
      font-size: 12px; font-weight: 800; letter-spacing: 0.3px;
      color: #ffffff; background: rgba(11, 15, 23, 0.94);
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.16);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
      display: flex; align-items: center; gap: 8px;
      opacity: 0; pointer-events: none;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      max-width: 90vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    `;
    document.body.appendChild(toastEl);
  }

  // रंग व आइकन थीम
  const themes = {
    info:    { border: 'rgba(56, 189, 248, 0.5)', icon: 'ℹ️' },
    success: { border: 'rgba(34, 197, 94, 0.5)',  icon: '✅' },
    error:   { border: 'rgba(239, 68, 68, 0.5)',  icon: '⚠️' },
    warn:    { border: 'rgba(245, 158, 11, 0.5)', icon: '🔔' }
  };
  const currentTheme = themes[type] || themes.info;

  // सिंगल अपडेट (कोई पहाड़ नहीं बनेगा)
  toastEl.style.borderColor = currentTheme.border;
  toastEl.innerHTML = `<span>${currentTheme.icon}</span> <span>${message}</span>`;
  toastEl.style.opacity = '1';
  toastEl.style.transform = 'translateX(-50%) translateY(0px)';

  if (activeToastTimeout) clearTimeout(activeToastTimeout);

  activeToastTimeout = setTimeout(() => {
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateX(-50%) translateY(-14px)';
  }, duration);
}

window.showToast = showToast;