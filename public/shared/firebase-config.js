// PERFECT GLOBAL FIREBASE CONFIG 
var firebaseConfig = {
    apiKey: "AIzaSyCyB4_a1AujnIBQwLDlv0J6Meam2Rw5Kv4",
    authDomain: "bahraichroadwaystransport.firebaseapp.com",
    projectId: "bahraichroadwaystransport",
    storageBucket: "bahraichroadwaystransport.firebasestorage.app",
    messagingSenderId: "396727842056",
    appId: "1:396727842056:web:e68fc212f86702118de8bd"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Global Vars Setup - Scope issue free
var db = (typeof firebase.firestore === 'function') ? firebase.firestore() : null;
var auth = (typeof firebase.auth === 'function') ? firebase.auth() : null;
var storage = (typeof firebase.storage === 'function') ? firebase.storage() : null;

// Fixing scope for all inner scripts natively 
window.db = db;
window.auth = auth;
window.storage = storage;

console.log("Ultimate Global Backend Ready!");