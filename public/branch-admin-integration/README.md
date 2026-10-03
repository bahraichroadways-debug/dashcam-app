# Branch/Admin Live Location — Integration Note

Aapka apna AI already `branch-live-location.js` + Admin `index.html` (चालान मैनेजर 📍 button + लाइव लोकेशन मैप tab) bana chuka hai — poora system already chal raha hai.

## Maine sirf 2 cheezein connect ki hain

1. **Data mismatch fix**: Mera DashboardCam driver-app ab `truck_locations/{GAADI_NUMBER}` collection me likhta hai (flat `lat`/`lng`), bilkul wahi jagah jahan se aapka `getTruckLiveLocation()` padhta hai. Pehle ye jagah alag thi, isliye location kabhi milti nahi thi.

2. **36-hour expiry (raat 10 PM anchor)**: Is folder ki `branch-live-location.js` file me sirf 1 check add kiya hai — agar `expiresAtMillis` nikal chuka hai to `null` return karega (matlab location "available nahi" dikhegi). Ye time mera driver-app khud calculate karke bhejta hai jab driver apna gaadi number **GAS se validate karke** save karta hai.

## Karna sirf itna hai

Apni site ki `branch-live-location.js` ko is folder wali se **replace** kar do — baaki kuch nahi karna, aapki `index.html` bilkul untouched rahegi.

## Vehicle Number Validation (naya)

Driver ab jab apni Settings me Gaadi Number save karta hai, mera app aapke GAS `get_challans` API se check karta hai ki wo number kisi chalan ke `truck_no` se match karta hai ya nahi:
- Match nahi mila → save hi nahi hoga, driver ko error dikhega
- Match mila → save hoga + tracking turant "activate" ho jayegi, 36 ghante (raat-10-anchor) ke liye visible rahegi
