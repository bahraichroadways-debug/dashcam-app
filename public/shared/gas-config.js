// ============================================================================
// THE ULTIMATE FULL PROOF GAS CONFIG (Bahraich Roadways)
// ============================================================================

var GAS_API_URL = "https://script.google.com/macros/s/AKfycbx9oxhAhB83TJFKySjDo2m3XhF1pESZZkeOIzr9Duf3EH6aMib0Yx4PJ54RZfFKwwKWDg/exec";
var GAS_API_KEY = "br2026-ce673d3f59d86267c586e0cd0bb68caf";

window.GAS_API_URL = GAS_API_URL;
window.GAS_API_KEY = GAS_API_KEY;

window.GAS_CONFIG = {
  API_URL: GAS_API_URL,
  API_KEY: GAS_API_KEY
};

window.FleetConfig = {
  gasApiUrl: GAS_API_URL,
  gasApiKey: GAS_API_KEY
};

localStorage.setItem('gasApiUrl', GAS_API_URL);
localStorage.setItem('gasApiKey', GAS_API_KEY);

console.log("✅ Ultimate Bahraich GAS link loaded and active!");