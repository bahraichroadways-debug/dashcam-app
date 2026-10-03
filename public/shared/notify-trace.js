// notify-trace.js — alert lifecycle tracing ONLY. Wraps an alert write with stage tracking.

function traceAlertWrite(db, alertData) {
  return db.collection('alerts').add({
    ...alertData,
    trace: {
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      writtenAt: firebase.firestore.FieldValue.serverTimestamp(),
      deliveredAt: null // set by admin side once it renders this alert
    }
  }).catch((err) => {
    // write itself failed — log as a stuck-at-creation trace
    db.collection('system_logs').add({
      source: alertData.truckId ? 'driver' : 'admin',
      sourceId: alertData.truckId || null,
      type: 'NOTIFY_STUCK',
      stage: 'create',
      alertType: alertData.type,
      error: String(err),
      status: 'open',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
  });
}

function markAlertDelivered(db, alertId) {
  db.collection('alerts').doc(alertId).update({
    'trace.deliveredAt': firebase.firestore.FieldValue.serverTimestamp()
  }).catch(() => {});
}

window.NotifyTrace = { traceAlertWrite, markAlertDelivered };
