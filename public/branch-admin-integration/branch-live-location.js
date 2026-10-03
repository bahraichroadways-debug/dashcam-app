// branch-live-location.js — Ultra-fast lightweight GPS fetcher for Branch & Admin
window.getTruckLiveLocation = async function(truckNo) {
    if (!truckNo) return null;
    const cleanTruck = String(truckNo).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    try {
        if (typeof firebase === 'undefined' || !firebase.firestore) return null;
        const db = firebase.firestore();
        const doc = await db.collection('truck_locations').doc(cleanTruck).get();
        if (doc.exists) {
            const data = doc.data();
            // 36-hour window check (anchored to 10 PM) — driver app sets expiresAtMillis on each location write
            if (data.expiresAtMillis && Date.now() > data.expiresAtMillis) return null;
            return data;
        }
    } catch (e) {
        console.error("GPS fetch error:", e);
    }
    return null;
};
