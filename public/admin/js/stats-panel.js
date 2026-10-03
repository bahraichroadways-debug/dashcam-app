// stats-panel.js — Total/Online/Offline/Alerts stat cards render ONLY. Takes data, doesn't fetch it.

function renderStats(containerEl, trucks, alertCount) {
  const total = trucks.length;
  const online = trucks.filter(t => t.status === 'online').length;
  const offline = total - online;

  containerEl.innerHTML = `
    <div class="stat-card glass"><div class="stat-num">${total}</div><div class="stat-label">Total Trucks</div></div>
    <div class="stat-card glass"><div class="stat-num" style="color:var(--success)">${online}</div><div class="stat-label">Online</div></div>
    <div class="stat-card glass"><div class="stat-num" style="color:var(--text-dim)">${offline}</div><div class="stat-label">Offline</div></div>
    <div class="stat-card glass"><div class="stat-num" style="color:var(--danger)">${alertCount}</div><div class="stat-label">Alerts</div></div>
  `;
}

window.StatsPanel = { renderStats };
