// ==========================================
// FILE: public/admin/js/trucks-data.js
// 24/7 ALL-FLEET LOCATION FEEDER (NO 30-HOUR LIMIT - LIFETIME LAST POSITION)
// ==========================================

function watchTrucksData(db, onUpdate) {
  if (!db) return () => {};

  return db.collection('truck_locations').onSnapshot((snap) => {
    const trucks = [];
    const now = Date.now();

    snap.forEach((doc) => {
      const truckId = String(doc.id).trim().toUpperCase();

      // 🛡️ केवल वैध गाड़ी नंबर (इंसानों या एडमिन के नाम बाहर)
      if (!/^[A-Z]{2}[0-9]/i.test(truckId)) return;

      const data = doc.data() || {};
      if (!data.lat || !data.lng) return;

      const lat = Number(data.lat);
      const lng = Number(data.lng);
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

      // ⏱️ टाइमस्टैम्प व समय गणना
      let rawTs = data.timestamp || data.time || data.last_login_at || data.updated_at || data.ts;
      let ts = rawTs > 1e11 ? Number(rawTs) : (rawTs ? Number(rawTs) * 1000 : now);
      const diffMs = now - ts;
      const isLive = (diffMs < 600000 && data.status !== 'APP_CLOSED'); // 10 मिनट के अंदर लाइव

      // 📅 स्मार्ट तारीख व समय फॉर्मेट (आज का है तो समय, पुराना है तो तारीख + समय)
      let smartLastSeen = data.last_seen || '';
      const dateObj = new Date(ts);
      const isToday = (dateObj.toDateString() === new Date().toDateString());
      if (!isToday && !isNaN(dateObj.getTime())) {
        const dayMonth = dateObj.toLocaleDateString('hi-IN', { day: '2-digit', month: 'short' });
        smartLastSeen = `${dayMonth}, ${smartLastSeen}`;
      }

      const speed = Number(data.speed || 0);
      const speedText = speed > 2 ? `⚡ ${Math.round(speed)} km/h` : (isLive ? '🛑 रुकी हुई' : '🅿️ पार्क्ड');

      trucks.push({
        id: truckId,
        truckNo: truckId,
        name: truckId,
        lat: lat,
        lng: lng,
        speed: speed,
        speedText: speedText,
        isLive: isLive,
        status: isLive ? 'online' : 'offline',
        station: data.main_station || 'लाइव रूट',
        deviceInfo: data.device_info || 'Device',
        lastSeen: smartLastSeen,
        diffMs: diffMs
      });
    });

    if (typeof onUpdate === 'function') {
      onUpdate(trucks);
    }
  }, (err) => {
    console.warn("Trucks data watch error:", err);
  });
}

window.TrucksData = { watchTrucksData };