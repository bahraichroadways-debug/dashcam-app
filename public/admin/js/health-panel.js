// health-panel.js — system_logs fetch + render ONLY.

const LOG_META = {
  ERROR: { icon: '❌', color: 'var(--danger)' },
  STRUCTURE_VIOLATION: { icon: '🧩', color: 'var(--warn)' },
  NOTIFY_STUCK: { icon: '📪', color: 'var(--warn)' }
};

function watchHealthLogs(db, onUpdate) {
  return db.collection('system_logs')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot((snap) => onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

function renderHealthLogs(containerEl, logs) {
  if (!logs.length) {
    containerEl.innerHTML = `<div class="tab-placeholder glass">Sab theek hai — koi issue nahi</div>`;
    return;
  }
  containerEl.innerHTML = logs.map(l => {
    const meta = LOG_META[l.type] || { icon: '⚠️', color: 'var(--text-dim)' };
    const statusLabel = l.status === 'open' ? 'OPEN' : l.status === 'auto-resolved' ? 'AUTO-RESOLVED' : (l.status || '').toUpperCase();
    const detail = l.type === 'STRUCTURE_VIOLATION'
      ? [...(l.missingIds || []), ...(l.missingModules || [])].join(', ')
      : (l.message || l.error || l.alertType || '');
    const time = l.createdAt ? new Date(l.createdAt.toMillis()).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '--';
    return `
      <div class="health-row glass">
        <span class="health-icon" style="color:${meta.color}">${meta.icon}</span>
        <div class="health-body">
          <div class="health-title">${l.type} — <span style="color:${l.status === 'open' ? 'var(--danger)' : 'var(--success)'}">${statusLabel}</span></div>
          <div class="health-detail">${l.source || ''} ${l.sourceId ? '(' + l.sourceId + ')' : ''} · ${detail}</div>
          <div class="health-time">${time}</div>
        </div>
      </div>`;
  }).join('');
}

window.HealthPanel = { watchHealthLogs, renderHealthLogs };
