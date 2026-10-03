// structure-check.js — expected DOM elements + window modules verification ONLY. No error capture, no UI.

function checkStructure(db, source, sourceId, expectedIds, expectedModules) {
  const missingIds = expectedIds.filter(id => !document.getElementById(id));
  const missingModules = expectedModules.filter(mod => !window[mod]);

  if (missingIds.length || missingModules.length) {
    const key = `structure_${source}_${sourceId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 140);
    const ref = db.collection('system_logs').doc(key);
    const patch = {
      source, sourceId, type: 'STRUCTURE_VIOLATION',
      missingIds, missingModules,
      status: 'open',
      lastSeenAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    ref.update(patch).catch(() => {
      ref.set({ ...patch, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
    });
  }
}

window.StructureCheck = { checkStructure };
