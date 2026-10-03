// auth.js — session/role logic ONLY. No UI, no Firestore calls, no WebRTC.
// TESTING MODE: manual entry. Swap resolveSession() body later for Gmail/Firebase Auth — nothing else changes.

const SESSION_KEY = 'fleet_session_v1';

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// TESTING: called from login screen with manual inputs.
// PRODUCTION (later): replace this function's body with Gmail/Firebase Auth lookup —
// role, truckId, driverId, adminId assignment stays identical downstream.
function resolveSession(role, idValue) {
  const session = {
    role,                          // 'admin' | 'driver'
    truckId: role === 'driver' ? idValue : null,
    adminId: role === 'admin' ? idValue : null,
    createdAt: Date.now()
  };
  saveSession(session);
  return session;
}

window.FleetAuth = { saveSession, getSession, clearSession, resolveSession };
