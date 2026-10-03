// menu.js — sidebar menu render + tab switch ONLY. No data logic, no stats.

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', active: true },
  { id: 'trucks', label: 'Trucks', icon: '🚚', active: false },
  { id: 'map', label: 'Live Map', icon: '🗺️', active: false },
  { id: 'alerts', label: 'Alerts', icon: '🔔', active: false },
  { id: 'recordings', label: 'Recordings', icon: '🎥', active: false },
  { id: 'drivers', label: 'Drivers', icon: '👤', active: false },
  { id: 'health', label: 'Health', icon: '🩺', active: false },
  { id: 'settings', label: 'Settings', icon: '⚙️', active: false }
];

function renderMenu(containerEl, onSelect) {
  containerEl.innerHTML = '';
  MENU_ITEMS.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'menu-item press-scale' + (item.active ? ' active' : '');
    btn.dataset.tab = item.id;
    btn.innerHTML = `<span class="menu-icon">${item.icon}</span><span class="menu-label">${item.label}</span>`;
    btn.addEventListener('click', () => {
      containerEl.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(item.id, item.active);
    });
    containerEl.appendChild(btn);
  });
}

window.AdminMenu = { renderMenu, MENU_ITEMS };