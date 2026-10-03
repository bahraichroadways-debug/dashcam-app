// public/admin/js/admin-session.js — 100% Crash-Proof Session Resolver
(function() {
  function getAdminSession() {
    let auth = null;
    try {
      const raw = localStorage.getItem('fleet_auth');
      if (raw) auth = JSON.parse(raw);
    } catch(e) {}

    // अगर Auth फ़ाइल से मिले तो वो ले, नहीं तो लोकल स्टोरेज से ID ले
    const sessionObj = (window.FleetAuth && typeof window.FleetAuth.getSession === 'function') 
      ? window.FleetAuth.getSession() 
      : null;

    const adminId = (sessionObj && (sessionObj.adminId || sessionObj.id)) 
      || (auth && auth.id) 
      || localStorage.getItem('driver_id') 
      || 'ADMIN1';

    return {
      role: 'admin',
      adminId: adminId,
      id: adminId
    };
  }

  window.AdminSession = { getAdminSession };
})();