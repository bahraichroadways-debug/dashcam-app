// ==========================================
// FILE: public/admin/admin-main.js
// 24/7 CENTRAL FLEET MONITORING & COCKPIT CONTROLLER
// ==========================================

(async function () {
  const session = window.AdminSession.getAdminSession();
  if (!session) return;

  const db = firebase.firestore();
  window.ErrorLogger.initErrorLogger(db, 'admin', session.adminId);
  
  // 🛡️ स्ट्रक्चर चेक (केवल वही मॉड्यूल्स जो वास्तव में मौजूद हैं)
  window.StructureCheck.checkStructure(db, 'admin', session.adminId,
    ['sidebar', 'statsRow', 'tabContent', 'truckList', 'livePanel', 'liveTitle', 'closeLiveBtn', 'liveVideo', 'adminPttBtn'],
    ['AdminSession', 'AdminMenu', 'StatsPanel', 'TruckList', 'LiveViewUI', 'TrucksData', 'LiveMap', 'AlertsPanel']
  );
  
  window.AutoResolve.startAutoResolve(db);
  window.PushNotify.initPushNotify(db, 'admins', session.adminId);

  const view = window.LiveViewUI.liveViewUI(
    document.getElementById('livePanel'),
    document.getElementById('liveVideo'),
    document.getElementById('liveTitle')
  );

  const statsRow = document.getElementById('statsRow');
  const tabContent = document.getElementById('tabContent');
  const truckListMarkup = tabContent.innerHTML;

  statsRow.style.display = 'grid';
  window.TruckList.renderTruckList(document.getElementById('truckList'), startWatch, db);
  window.StatsPanel.renderStats(statsRow, window.TruckList.getTrucks(), 0);

  let liveMap = null;
  let unsubTrucksData = null;
  let unsubAlerts = null;
  let alertCount = 0;

  function teardownMap() {
    if (unsubTrucksData) { unsubTrucksData(); unsubTrucksData = null; }
    if (liveMap) { liveMap.destroy(); liveMap = null; }
  }

  window.AlertsPanel.watchAlerts(db, (alerts) => {
    alertCount = alerts.length;
    window.StatsPanel.renderStats(statsRow, window.TruckList.getTrucks(), alertCount);
  });

  let unsubHealth = null;
  let unsubDrivers = null;
  let unsubSettings = null;

  const menuContainer = document.getElementById('sidebarMenu') || document.getElementById('sidebar');

  window.AdminMenu.renderMenu(menuContainer, (tabId) => {
    teardownMap();
    if (unsubAlerts) { unsubAlerts(); unsubAlerts = null; }
    if (unsubHealth) { unsubHealth(); unsubHealth = null; }
    if (unsubDrivers) { unsubDrivers(); unsubDrivers = null; }
    if (unsubSettings) { unsubSettings(); unsubSettings = null; }

    if (tabId === 'dashboard') {
      statsRow.style.display = 'grid';
      tabContent.innerHTML = truckListMarkup;
      window.TruckList.renderTruckList(document.getElementById('truckList'), startWatch, db);
    } else {
      statsRow.style.display = 'none';
      if (tabId === 'trucks') {
        tabContent.innerHTML = truckListMarkup;
        window.TruckList.renderTruckList(document.getElementById('truckList'), startWatch, db);
      } else if (tabId === 'map') {
        tabContent.innerHTML = `<div id="mapContainer" class="enter-up"></div>`;
        liveMap = window.LiveMap.createLiveMap(document.getElementById('mapContainer'));
        unsubTrucksData = window.TrucksData.watchTrucksData(db, (trucks) => liveMap.update(trucks));
      } else if (tabId === 'alerts') {
        tabContent.innerHTML = `<div id="alertsList" class="enter-up"></div>`;
        unsubAlerts = window.AlertsPanel.watchAlerts(db, (alerts) => window.AlertsPanel.renderAlerts(db, document.getElementById('alertsList'), alerts));
      } else if (tabId === 'recordings') {
        tabContent.innerHTML = `<div id="recordingsTab" class="enter-up"></div>`;
        const recEl = document.getElementById('recordingsTab');
        window.RecordingsPanel.renderRecordingsTab(recEl, window.TruckList.getTrucks().map(t => t.id), async (truckId) => {
          const listEl = document.getElementById('recList');
          if (!truckId) { listEl.innerHTML = ''; return; }
          listEl.innerHTML = `<div class="tab-placeholder glass">Loading…</div>`;
          const recordings = await window.RecordingsPanel.listRecordings(truckId);
          window.RecordingsPanel.renderRecordingsList(listEl, recordings);
        });
      } else if (tabId === 'health') {
        tabContent.innerHTML = `<div id="healthList" class="enter-up"></div>`;
        unsubHealth = window.HealthPanel.watchHealthLogs(db, (logs) => window.HealthPanel.renderHealthLogs(document.getElementById('healthList'), logs));
      } else if (tabId === 'drivers') {
        tabContent.innerHTML = `<div id="driversTab" class="enter-up"></div>`;
        const driversEl = document.getElementById('driversTab');
        unsubDrivers = window.DriversTab.watchDrivers(db, (drivers) => {
          window.DriversTab.renderDriversTab(driversEl, drivers, (newDriver) => {
            db.collection('drivers').add(newDriver).then(() => window.showToast('Driver add ho gaya', 'success')).catch(() => window.showToast('Error add karte waqt', 'error'));
          });
        });
      } else if (tabId === 'settings') {
        tabContent.innerHTML = `<div id="settingsTab" class="enter-up"></div>`;
        const settingsEl = document.getElementById('settingsTab');
        unsubSettings = window.SettingsTab.watchSettings(db, (settings) => {
          window.SettingsTab.renderSettingsTab(settingsEl, settings, (newSettings) => {
            db.collection('settings').doc('fleet').set(newSettings, { merge: true })
              .then(() => window.showToast('Settings save ho gaye', 'success'))
              .catch(() => window.showToast('Error save karte waqt', 'error'));
          });
        });
      } else {
        tabContent.innerHTML = `<div class="tab-placeholder glass enter-up">${tabId.charAt(0).toUpperCase() + tabId.slice(1)} — coming in a later phase</div>`;
      }
    }
  });

  // -------------------------------------------------------------
  // 🎥 कॉकपिट लाइव वॉच (सिर्फ पैनल खोलना और बंद करना)
  // -------------------------------------------------------------
  async function startWatch(truckId, truckName) {
    view.open(truckName);
  }

  async function stopWatch() {
    view.close();
  }

  document.getElementById('closeLiveBtn').addEventListener('click', stopWatch);
})();