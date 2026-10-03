// recordings-panel.js — recordings list + playback ONLY.

async function listRecordings(truckId) {
  const storage = firebase.storage();
  const listRef = storage.ref(`recordings/${truckId}`);
  const result = await listRef.listAll().catch(() => ({ items: [] }));
  const withUrls = await Promise.all(result.items.map(async (item) => {
    const url = await item.getDownloadURL().catch(() => null);
    const ts = parseInt(item.name.replace('.webm', ''), 10);
    return { name: item.name, url, time: ts ? new Date(ts).toLocaleString('en-IN') : item.name };
  }));
  return withUrls.filter(r => r.url).sort((a, b) => b.name.localeCompare(a.name));
}

function renderRecordingsTab(containerEl, truckOptions, onTruckChange) {
  containerEl.innerHTML = `
    <div class="rec-select-row">
      <select id="recTruckSelect" class="rec-select">
        <option value="">Select truck…</option>
        ${truckOptions.map(id => `<option value="${id}">${id}</option>`).join('')}
      </select>
    </div>
    <div id="recList" class="rec-list"></div>
  `;
  containerEl.querySelector('#recTruckSelect').addEventListener('change', (e) => onTruckChange(e.target.value));
}

function renderRecordingsList(listEl, recordings) {
  if (!recordings.length) {
    listEl.innerHTML = `<div class="tab-placeholder glass">Koi recording nahi mili</div>`;
    return;
  }
  listEl.innerHTML = recordings.map(r => `
    <div class="rec-row glass">
      <video src="${r.url}" controls preload="none"></video>
      <div class="rec-time">${r.time}</div>
    </div>`).join('');
}

window.RecordingsPanel = { listRecordings, renderRecordingsTab, renderRecordingsList };
