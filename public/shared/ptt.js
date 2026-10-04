// ==========================================
// FILE: public/shared/ptt.js
// 100% PRIVACY-SAFE ON-DEMAND PTT WALKIE-TALKIE ENGINE
// ==========================================

(function() {
  let audioChunks = [];
  let micStream = null;
  let mediaRecorder = null;
  let activeRoom = 'fleet_broadcast';
  let callUnsub = null;
  let audioCtx = null;
  let isReceiving = false;

  const isPageAdmin = window.location.pathname.includes('admin') || document.title.includes('Admin');

  function diagLog(step, message) {
    console.log(`[PTT ${isPageAdmin ? 'ADMIN' : 'DRIVER'}] ${step}: ${message}`);
  }

  // 🔔 वॉक-टॉकी बीप साउंड (शुरू और खत्म होने पर)
  function playWalkieBeep() {
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch(e) {}
  }

  // 🔊 प्राप्त ऑडियो सीधे स्पीकर पर बजाना (इसके लिए माइक की 0% ज़रूरत है)
  async function playVoiceDirect(base64Data) {
    if (isReceiving || !base64Data) return;
    isReceiving = true;

    try {
      playWalkieBeep();
      const audio = new Audio(base64Data);
      audio.volume = 1.0;
      await audio.play();
      audio.onended = () => { isReceiving = false; };
    } catch(err) {
      isReceiving = false;
    }
  }

  // 🎙️ ऑन-डिमांड माइक: केवल बटन दबाने पर 1 बार चालू होगा
  async function acquireMic() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        return await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }
      return null;
    } catch (e) {
      diagLog('MIC', 'माइक की अनुमति नहीं मिली: ' + e.message);
      return null;
    }
  }

  // 🛑 माइक को हार्डवेयर से पूरी तरह बंद करना (फोन कॉल व व्हाट्सएप आज़ाद)
  function releaseMic() {
    if (micStream) {
      micStream.getTracks().forEach(track => {
        try { track.stop(); } catch(e) {}
      });
      micStream = null;
    }
  }

  // 📡 वॉक-टॉकी रूम शुरू करना
  function initPTT({ isInitiator, roomId }) {
    if (roomId) activeRoom = roomId;
    diagLog('आरंभ', `वॉक-टॉकी एक्टिव: कमरा = [${activeRoom}]`);

    const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
    if (!db) return;

    if (callUnsub) { callUnsub(); callUnsub = null; }

    // आने वाली आवाज़ सुनने वाला लिसनर (0% माइक उपयोग)
    callUnsub = db.collection('calls').doc(activeRoom).onSnapshot((doc) => {
      if (!doc.exists) return;
      const data = doc.data();

      // अगर संदेश दूसरे व्यक्ति (Sender) ने भेजा है और ताज़ा है (10s से कम पुराना)
      const isFresh = (Date.now() - (data.ts || 0)) < 10000;
      const myRole = isPageAdmin ? 'ADMIN' : 'DRIVER';

      if (data && data.audioBase64 && data.sender !== myRole && isFresh) {
        playVoiceDirect(data.audioBase64);
      }
    });
  }

  // 🎙️ बोलने के लिए बटन दबाना (Start Talking)
  async function startTalking() {
    audioChunks = [];
    micStream = await acquireMic();
    if (!micStream) return;

    try {
      playWalkieBeep();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      const options = { audioBitsPerSecond: 16000 };
      if (mimeType) options.mimeType = mimeType;

      mediaRecorder = new MediaRecorder(micStream, options);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.start();
    } catch(err) {
      releaseMic();
    }
  }

  // 🛑 बोलना बंद करना (Stop Talking — उंगली हटाते ही माइक 100% फ्री)
  function stopTalking() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        
        if (audioBlob.size > 200) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = reader.result;
            const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;
            if (db && activeRoom) {
              await db.collection('calls').doc(activeRoom).set({
                audioBase64: base64Audio,
                sender: isPageAdmin ? 'ADMIN' : 'DRIVER',
                ts: Date.now()
              }, { merge: true }).catch(() => {});
            }
          };
          reader.readAsDataURL(audioBlob);
        }

        // 🎯 तुरंत माइक का हार्डवेयर बंद करें
        releaseMic();
      };

      mediaRecorder.stop();
    } else {
      releaseMic();
    }
  }

  // 🔀 रूम बदलना (ऑल फ्लीट ➔ सिंगल ट्रक)
  function switchRoom(newRoomId) {
    if (!newRoomId || newRoomId === activeRoom) return;
    activeRoom = newRoomId;
    initPTT({ isInitiator: isPageAdmin, roomId: activeRoom });
  }

  // 🛡️ स्क्रीन बंद / बैकग्राउंड में जाते ही माइक तुरंत बंद
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      releaseMic();
    }
  });

  window.PTTEngine = {
    initPTT,
    startTalking,
    stopTalking,
    switchRoom,
    releaseMic
  };
})();