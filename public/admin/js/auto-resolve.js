// auto-resolve.js — self-healing detection ONLY. Marks stale open errors as auto-resolved.
// Runs on ADMIN side only (needs a read-scan across all open logs; driver doesn't need this).

function startAutoResolve(db, staleMinutes = 10) {
  const intervalId = setInterval(async () => {
    const cutoff = Date.now() - staleMinutes * 60 * 1000;
    const snap = await db.collection('system_logs').where('status', '==', 'open').get().catch(() => null);
    if (!snap) return;

    const batch = db.batch();
    let count = 0;
    snap.forEach(doc => {
      const data = doc.data();
      const lastSeen = data.lastSeenAt ? data.lastSeenAt.toMillis() : (data.createdAt ? data.createdAt.toMillis() : 0);
      if (lastSeen && lastSeen < cutoff) {
        batch.update(doc.ref, { status: 'auto-resolved', resolvedAt: firebase.firestore.FieldValue.serverTimestamp() });
        count++;
      }
    });
    if (count) await batch.commit().catch(() => {});
  }, 5 * 60 * 1000); // check every 5 min

  return { stop: () => clearInterval(intervalId) };
}

window.AutoResolve = { startAutoResolve };
