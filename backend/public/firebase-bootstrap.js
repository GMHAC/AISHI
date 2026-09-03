// Optional Firebase bootstrap for rfims-s.web.app.
// The main app remains usable offline/API mode. This file is included for the Firebase deployment layer.
(function(){
  function boot(){
    if(!window.RIZVI_FIREBASE_CONFIG || !window.firebase) return;
    try{
      if(!firebase.apps.length) firebase.initializeApp(window.RIZVI_FIREBASE_CONFIG);
      window.RIZVI_FIREBASE_APP = firebase.app();
      window.RIZVI_FIRESTORE = firebase.firestore();
      window.RIZVI_AUTH = firebase.auth();
      window.RIZVI_FIREBASE_READY = true;
    }catch(e){ console.warn('Firebase bootstrap unavailable:',e); }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
