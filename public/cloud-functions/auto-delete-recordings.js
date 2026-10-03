// auto-delete-recordings.js — scheduled Cloud Function. Deletes recordings older than RETENTION_DAYS.
// Deploy: firebase deploy --only functions:autoDeleteRecordings
// Free tier: 2M invocations/month — this runs once daily, well within limits.

const functions = require('firebase-functions');
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();

const RETENTION_DAYS = 3; // change as needed — matches blueprint's "temporary storage, auto-delete"

exports.autoDeleteRecordings = functions.pubsub.schedule('every 24 hours').onRun(async () => {
  const bucket = admin.storage().bucket();
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const [files] = await bucket.getFiles({ prefix: 'recordings/' });
  const deletions = files
    .filter(f => {
      const match = f.name.match(/(\d+)\.webm$/);
      return match && parseInt(match[1], 10) < cutoff;
    })
    .map(f => f.delete().catch(() => {}));

  await Promise.all(deletions);
  console.log(`Deleted ${deletions.length} recordings older than ${RETENTION_DAYS} days`);
  return null;
});
