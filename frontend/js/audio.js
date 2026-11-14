/* ═══════════════════════════════════════════════════
   CVA Data Collector — Audio + Notification
   ═══════════════════════════════════════════════════ */

let _actx = null;

function ensureAudio() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  if (_actx.state === 'suspended') _actx.resume();
}

function tone(freq, durMs, vol = 0.3, delayS = 0) {
  ensureAudio();
  const t = _actx.currentTime + delayS;
  const o = _actx.createOscillator();
  const g = _actx.createGain();
  o.connect(g); g.connect(_actx.destination);
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.setValueAtTime(vol, t + durMs / 1000 - 0.03);
  g.gain.linearRampToValueAtTime(0, t + durMs / 1000);
  o.start(t); o.stop(t + durMs / 1000 + 0.05);
}

// เสียงเมื่อเปลี่ยนขั้นตอน
function beepStep() { tone(880, 90, 0.25); tone(1320, 80, 0.2, 0.11); }

// เสียง countdown tick
function beepTick() { tone(660, 70, 0.18); }

// เสียงครบเวลา — 3 โน้ต + push notification
function beepDone(stepLabel) {
  tone(1047, 120, 0.35);
  tone(784,  120, 0.3,  0.14);
  tone(523,  220, 0.38, 0.28);
  pushNotify(stepLabel);
}

// เสียงเตือนล่วงหน้า 10 วินาที
function beepWarn() { tone(880, 80, 0.2); }

// Web Push Notification — แจ้งเตือนแม้ออกจากแท็บ
let _notifGranted = false;

async function requestNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') { _notifGranted = true; return; }
  if (Notification.permission !== 'denied') {
    const r = await Notification.requestPermission();
    _notifGranted = r === 'granted';
  }
}

function pushNotify(stepLabel) {
  if (!_notifGranted || document.visibilityState === 'visible') return;
  try {
    new Notification('CVA Collector — ครบเวลา!', {
      body: `"${stepLabel}" เสร็จแล้ว กรุณาเปลี่ยนท่า`,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="28" font-size="28">🦴</text></svg>',
      tag:  'cva-step-done',
      requireInteraction: false,
    });
  } catch {}
}
