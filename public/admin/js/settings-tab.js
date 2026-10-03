// =========================================================================
// settings-tab.js — 5-Category Apple/Tesla Grade Fleet Master Settings
// =========================================================================

const DEFAULT_SETTINGS = {
  mainStation: 'Bahraich Head Office',
  gpsRefreshSeconds: 15,
  offlineMinutes: 2,
  speedLimitKmh: 65,
  pttChannel: 'fleet_broadcast',
  retentionDays: 7
};

function watchSettings(db, onUpdate) {
  return db.collection('settings').doc('fleet').onSnapshot((snap) => {
    onUpdate({ ...DEFAULT_SETTINGS, ...(snap.data() || {}) });
  });
}

function renderSettingsTab(containerEl, settings, onSave) {
  containerEl.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:14px; max-width:650px;">
      
      <!-- 1. 🏢 मुख्य स्टेशन व फ्लीट -->
      <div class="glass" style="padding:16px; border-radius:14px;">
        <div style="font-weight:800; font-size:13px; color:#38bdf8; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
          <span>🏢</span> <span>FLEET & HEAD STATION</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label style="font-size:11.5px; color:#94a3b8; font-weight:700;">हेड ऑफिस / डिपो नाम</label>
          <input id="setStation" class="set-input" type="text" value="${settings.mainStation || 'Bahraich Head Office'}" style="background:#05070a; border:1px solid rgba(255,255,255,0.15); color:#fff; padding:8px 12px; border-radius:8px; font-size:13px;">
        </div>
      </div>

      <!-- 2. 🛰️ GPS व ट्रैकिंग दर -->
      <div class="glass" style="padding:16px; border-radius:14px;">
        <div style="font-weight:800; font-size:13px; color:#22c55e; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
          <span>🛰️</span> <span>GPS & TRACKING INTERVALS</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:11px; color:#94a3b8; font-weight:700;">GPS पिंग गति</label>
            <select id="setGpsRate" style="width:100%; margin-top:4px; background:#05070a; color:#fff; border:1px solid rgba(255,255,255,0.15); padding:8px; border-radius:8px; font-size:12px;">
              <option value="15" ${settings.gpsRefreshSeconds == 15 ? 'selected' : ''}>⚡ सुपर फास्ट (15s)</option>
              <option value="30" ${settings.gpsRefreshSeconds == 30 ? 'selected' : ''}>🔋 सामान्य (30s)</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px; color:#94a3b8; font-weight:700;">ऑफलाइन घोषणा समय</label>
            <select id="setOfflineMin" style="width:100%; margin-top:4px; background:#05070a; color:#fff; border:1px solid rgba(255,255,255,0.15); padding:8px; border-radius:8px; font-size:12px;">
              <option value="2" ${settings.offlineMinutes == 2 ? 'selected' : ''}>2 मिनट बाद</option>
              <option value="5" ${settings.offlineMinutes == 5 ? 'selected' : ''}>5 मिनट बाद</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 3. 🚨 स्पीड व अलर्ट्स -->
      <div class="glass" style="padding:16px; border-radius:14px;">
        <div style="font-weight:800; font-size:13px; color:#ef4444; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
          <span>🚨</span> <span>OVERSPEED & ALERTS</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:13px; font-weight:700; color:#fff;">अधिकतम गति सीमा (Over-speed)</div>
            <div style="font-size:11px; color:#94a3b8;">इससे तेज़ चलने पर रेड अलर्ट आएगा</div>
          </div>
          <input id="setSpeedLimit" type="number" value="${settings.speedLimitKmh || 65}" style="width:70px; background:#05070a; border:1px solid rgba(255,255,255,0.15); color:#fff; padding:6px 10px; border-radius:8px; text-align:center; font-weight:bold;">
        </div>
      </div>

      <!-- 4. 🎙️ PTT वॉक-टॉकी चैनल -->
      <div class="glass" style="padding:16px; border-radius:14px;">
        <div style="font-weight:800; font-size:13px; color:#f59e0b; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
          <span>🎙️</span> <span>PTT VOICE BROADCAST</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:13px; font-weight:700; color:#fff;">मास्टर ब्रॉडकास्ट चैनल</div>
            <div style="font-size:11px; color:#94a3b8;">सभी गाड़ियों के वॉक-टॉकी का मुख्य रूम</div>
          </div>
          <span style="font-family:monospace; font-size:12px; font-weight:bold; color:#38bdf8; background:rgba(56,189,248,0.1); padding:4px 8px; border-radius:6px;">fleet_broadcast</span>
        </div>
      </div>

      <!-- 5. 🧹 सिस्टम कैश साफ़ करें -->
      <div class="glass" style="padding:16px; border-radius:14px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:13px; font-weight:700; color:#fff;">लोकल कैश व रूट रीसेट</div>
          <div style="font-size:11px; color:#94a3b8;">अस्थायी डेटा और मैप कैश साफ़ करें</div>
        </div>
        <button onclick="localStorage.clear(); alert('✅ एडमिन कैश साफ़ हो गया!'); window.location.reload();" style="background:rgba(239,68,68,0.15); border:1px solid #ef4444; color:#ef4444; padding:7px 12px; border-radius:8px; font-weight:bold; font-size:11px; cursor:pointer;">
          🧹 कैश साफ़ करें
        </button>
      </div>

      <button id="saveSettingsBtn" style="background:#2563eb; color:#fff; border:none; padding:12px; border-radius:12px; font-weight:900; font-size:14px; cursor:pointer; box-shadow:0 4px 14px rgba(37,99,235,0.4);">
        💾 सेटिंग्स सुरक्षित करें (Save Settings)
      </button>
    </div>
  `;

  containerEl.querySelector('#saveSettingsBtn').addEventListener('click', () => {
    onSave({
      mainStation: containerEl.querySelector('#setStation').value.trim() || DEFAULT_SETTINGS.mainStation,
      gpsRefreshSeconds: Number(containerEl.querySelector('#setGpsRate').value) || 15,
      offlineMinutes: Number(containerEl.querySelector('#setOfflineMin').value) || 2,
      speedLimitKmh: Number(containerEl.querySelector('#setSpeedLimit').value) || 65
    });
    if (window.showToast) window.showToast("✅ सेटिंग्स सफलतापूर्वक सुरक्षित!", "success");
  });
}

window.SettingsTab = { watchSettings, renderSettingsTab, DEFAULT_SETTINGS };