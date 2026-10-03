// alerts-panel.js — alerts fetch (Firestore) + render ONLY.

const ALERT_LABELS = {
  SOS: { icon: '🆘', label: 'SOS Emergency', color: 'var(--danger)' },
  LOW_BATTERY: { icon: '🔋', label: 'Low Battery', color: 'var(--warn)' },
  OFFLINE: { icon: '📡', label: 'Truck Offline', color: 'var(--text-dim)' },
  WEAK_SIGNAL: { icon: '📶', label: 'Weak Signal', color: 'var(--warn)' },
  THEFT_SUSPECTED: { icon: '🚨', label: 'THEFT SUSPECTED — Fake shutdown triggered', color: 'var(--danger)' }
};

function watchAlerts(db, onUpdate) {
  return db.collection('alerts')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot((snap) => {
      const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      onUpdate(alerts);
    });
}

function renderAlerts(db, containerEl, alerts) {
  if (!alerts.length) {
    containerEl.innerHTML = `<div class="tab-placeholder glass">Koi alert nahi</div>`;
    return;
  }
  alerts.forEach(a => {
    if (a.trace && !a.trace.deliveredAt) window.NotifyTrace.markAlertDelivered(db, a.id);
  });
  containerEl.innerHTML = alerts.map(a => {
    const meta = ALERT_LABELS[a.type] || { icon: '⚠️', label: a.type, color: 'var(--text-dim)' };
    const time = a.createdAt ? new Date(a.createdAt.toMillis()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--';
    return `
      <div class="alert-row glass">
        <span class="alert-icon" style="color:${meta.color}">${meta.icon}</span>
        <div class="alert-body">
          <div class="alert-label">${meta.label} — ${a.truckId}</div>
          <div class="alert-time">${time}</div>
        </div>
      </div>`;
  }).join('');
}

window.AlertsPanel = { watchAlerts, renderAlerts };
