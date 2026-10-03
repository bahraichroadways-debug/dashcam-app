// error-logger.js — global error capture ONLY. Shared by driver + admin.

function makeLogKey(...parts) {
  return parts.join('_').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 140);
}

function initErrorLogger(db, source, sourceId) {
  async function logError(message, file, stack) {
    const msg = String(message).slice(0, 500);
    const key = makeLogKey(source, sourceId, file || 'unknown', msg.slice(0, 60));
    const ref = db.collection('system_logs').doc(key);
    const patch = {
      source, sourceId, type: 'ERROR',
      message: msg,
      file: file || 'unknown',
      stack: stack ? String(stack).slice(0, 1000) : null,
      status: 'open', // BUG FIX: force reopen if it was auto-resolved and just recurred
      lastSeenAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    // BUG FIX: update existing doc (same error) instead of always creating a new one
    ref.update(patch).catch(() => {
      ref.set({ ...patch, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
    });
  }

  window.addEventListener('error', (e) => {
    logError(e.message, e.filename, e.error ? e.error.stack : null);
  });
  window.addEventListener('unhandledrejection', (e) => {
    logError(e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled rejection', 'promise', e.reason ? e.reason.stack : null);
  });

  return { logError };
}

window.ErrorLogger = { initErrorLogger };

