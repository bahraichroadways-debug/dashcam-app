// chalan-window.js — chalan access-window rule ONLY (when does a branch's power start/end for a given chalan).
// Rule: chalan created BEFORE 10 PM → power starts at 10 PM that day.
//       chalan created AFTER 10 PM → power starts immediately (at chalan creation time).
//       Either way, power lasts 36 hours from its start.

function parseChalanTimestamp(ts) {
  try {
    const [datePart, timePart] = String(ts).split(',').map(s => s.trim());
    const [d, m, y] = datePart.split('/').map(Number);

    const match = timePart.match(/(\d{1,2}):(\d{2}):(\d{2})\s*(am|pm)/i);
    if (!match) return null;
    let hh = Number(match[1]);
    const mm = Number(match[2]);
    const ss = Number(match[3]);
    const ampm = match[4].toLowerCase();
    if (ampm === 'pm' && hh !== 12) hh += 12;
    if (ampm === 'am' && hh === 12) hh = 0;

    return new Date(y, m - 1, d, hh, mm, ss);
  } catch { return null; }
}

function chalanAccessWindow(chalanTimestampStr) {
  const chalanDate = parseChalanTimestamp(chalanTimestampStr);
  if (!chalanDate) return null;

  const hour = chalanDate.getHours();
  const start = hour >= 22
    ? chalanDate // created after 10 PM — power starts immediately
    : new Date(chalanDate.getFullYear(), chalanDate.getMonth(), chalanDate.getDate(), 22, 0, 0, 0); // power starts at 10 PM that day

  const expiry = new Date(start.getTime() + 36 * 60 * 60 * 1000);
  return { start, expiry };
}

window.ChalanWindow = { parseChalanTimestamp, chalanAccessWindow };
