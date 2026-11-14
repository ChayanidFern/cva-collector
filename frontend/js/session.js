/* ═══════════════════════════════════════════════════
   CVA Data Collector — Session Logic
   ═══════════════════════════════════════════════════ */
'use strict';

const $  = id => document.getElementById(id);
const qs = s  => document.querySelector(s);

const RING_R = 60;
const RING_C = 2 * Math.PI * RING_R; // ≈ 377

const S = {
  phase:     'idle',
  info:      {},
  stepIdx:   0,
  t0:        null,
  pausedMs:  0,
  pauseT:    null,
  stepT:     null,
  stepDur:   0,
  pending:   null,
  transIv:   null,
  log:       [],
  rafId:     null,
  timer:     null,
  _startTime: '',
};

function nowMs() {
  if (!S.t0) return 0;
  let t = performance.now() - S.t0 - S.pausedMs;
  if (S.phase === 'paused') t -= performance.now() - S.pauseT;
  return Math.max(0, t);
}
function fmtMs(ms) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}
function fmtSec(s) { return s >= 10 ? s.toFixed(0) + 's' : s.toFixed(1) + 's'; }
function nowTH() {
  return new Date().toLocaleString('th-TH', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Bangkok'
  });
}

// ── Draw step dots ────────────────────────────────
function renderDots() {
  const wrap = $('step-dots');
  if (!wrap) return;
  wrap.innerHTML = PROTOCOL.map((_, i) => {
    const cls = i < S.stepIdx ? 'done' : i === S.stepIdx ? 'active' : '';
    return `<div class="step-pip ${cls}" title="${PROTOCOL[i].label}"></div>`;
  }).join('');
}

// ── Start session ─────────────────────────────────
function startSession(info) {
  S.info      = info;
  S.phase     = 'running';
  S.t0        = performance.now();
  S.pausedMs  = 0;
  S.stepIdx   = 0;
  S.log       = [];
  S._startTime = nowTH();

  renderDots();
  if ($('h-sess')) $('h-sess').textContent = info.sessId;
  if ($('btn-pause'))  $('btn-pause').disabled = false;
  if ($('btn-skip'))   $('btn-skip').disabled  = false;
  if ($('btn-stop'))   $('btn-stop').disabled  = false;

  doStep();
  rafLoop();
}

// ── Step ─────────────────────────────────────────
function doStep() {
  if (S.stepIdx >= PROTOCOL.length) { endSession(); return; }
  const step = PROTOCOL[S.stepIdx];

  S.stepT   = performance.now();
  S.stepDur = step.durationMs;
  S.pending = {
    stepId:  step.id,
    label:   step.label,
    type:    step.type,
    cva:     step.cva || '',
    onsetMs: Math.round(nowMs()),
  };

  // UI
  const badge = $('phase-badge');
  if (badge) {
    badge.textContent  = step.label;
    badge.style.color  = step.color;
    badge.style.borderColor = step.color;
  }
  if ($('phase-type'))  $('phase-type').textContent  = step.type === 'hold' ? 'ค้างท่า' : step.type === 'rest' ? 'พัก' : 'กิจกรรม';
  if ($('phase-title')) $('phase-title').textContent = step.instruction;
  if ($('phase-detail'))$('phase-detail').textContent= step.detail;
  if ($('ring-arc'))    $('ring-arc').style.stroke   = step.color;
  if ($('timer-num'))   $('timer-num').style.color   = step.color;

  // Next preview
  const nxt = PROTOCOL[S.stepIdx + 1];
  if ($('next-preview')) {
    if (nxt) $('next-preview').innerHTML = `ถัดไป <strong>${nxt.label}</strong> (${fmtMs(nxt.durationMs)})`;
    else     $('next-preview').innerHTML = 'ขั้นตอนสุดท้าย — ข้อมูลจะถูกบันทึกอัตโนมัติ';
  }

  renderDots();
  beepStep();

  // Warn 10s before end
  clearTimeout(S.timer);
  const warn = step.durationMs - 10000;
  if (warn > 500) setTimeout(() => { if (S.phase === 'running') beepWarn(); }, warn);

  S.timer = setTimeout(() => { beepDone(step.label); nextStep(); }, step.durationMs);
}

function finalizeStep(status = 'COMPLETE') {
  if (!S.pending) return;
  const offMs = Math.round(nowMs());
  S.log.push({
    ...S.pending,
    offsetMs:   offMs,
    durationMs: offMs - S.pending.onsetMs,
    status,
  });
  S.pending = null;
}

function nextStep() {
  finalizeStep('COMPLETE');
  S.stepIdx++;
  if (S.stepIdx >= PROTOCOL.length) { endSession(); return; }
  showTransition(() => doStep());
}

// ── Transition countdown ──────────────────────────
function showTransition(cb) {
  const nxt = PROTOCOL[S.stepIdx];
  const overlay = $('prep-overlay');
  if (!overlay) { cb(); return; }

  if ($('prep-next'))  $('prep-next').textContent  = nxt.label;
  let n = 3;
  if ($('prep-count')) $('prep-count').textContent = n;
  overlay.classList.add('show');
  beepTick();

  clearInterval(S.transIv);
  S.transIv = setInterval(() => {
    n--;
    if ($('prep-count')) $('prep-count').textContent = n;
    if (n <= 0) {
      clearInterval(S.transIv); S.transIv = null;
      overlay.classList.remove('show');
      cb();
    } else beepTick();
  }, 1000);
}

// ── RAF loop ──────────────────────────────────────
function rafLoop() {
  cancelAnimationFrame(S.rafId);
  function frame() {
    if (S.phase !== 'running') return;
    if ($('sess-clock')) $('sess-clock').textContent = fmtMs(nowMs());
    const elapsed = performance.now() - S.stepT;
    const frac    = Math.min(1, elapsed / S.stepDur);
    if ($('ring-arc')) $('ring-arc').style.strokeDashoffset = RING_C * frac;
    const remSec  = Math.max(0, (S.stepDur - elapsed) / 1000);
    if ($('timer-num')) $('timer-num').textContent = fmtSec(remSec);
    S.rafId = requestAnimationFrame(frame);
  }
  S.rafId = requestAnimationFrame(frame);
}

// ── Controls ──────────────────────────────────────
function handlePause() {
  if (S.phase === 'running') {
    S.phase = 'paused'; S.pauseT = performance.now();
    clearTimeout(S.timer); cancelAnimationFrame(S.rafId);
    if ($('btn-pause')) { $('btn-pause').textContent = '▶ ดำเนินต่อ'; $('btn-pause').className = 'btn-ctrl play'; }
  } else if (S.phase === 'paused') {
    const d = performance.now() - S.pauseT;
    S.pausedMs += d; S.stepT += d; S.phase = 'running';
    if ($('btn-pause')) { $('btn-pause').textContent = '⏸ หยุดชั่วคราว'; $('btn-pause').className = 'btn-ctrl pause'; }
    const rem = Math.max(0, S.stepDur - (performance.now() - S.stepT));
    S.timer = setTimeout(() => { beepDone(PROTOCOL[S.stepIdx].label); nextStep(); }, rem);
    rafLoop();
  }
}

function handleSkip() {
  if (S.phase !== 'running' && S.phase !== 'paused') return;
  clearTimeout(S.timer); cancelAnimationFrame(S.rafId);
  if (S.phase === 'paused') {
    const d = performance.now() - S.pauseT;
    S.pausedMs += d; S.stepT += d; S.phase = 'running';
    if ($('btn-pause')) { $('btn-pause').textContent = '⏸ หยุดชั่วคราว'; $('btn-pause').className = 'btn-ctrl pause'; }
  }
  finalizeStep('SKIPPED');
  S.stepIdx++;
  if (S.stepIdx >= PROTOCOL.length) { endSession(); return; }
  showTransition(() => doStep());
  rafLoop();
}

function handleStop() {
  if (!confirm('⏹ ยืนยันหยุดบันทึก?\n\nข้อมูลที่ได้จะถูกบันทึกลง Server อัตโนมัติ\nแล้วกลับหน้าหลักทันที')) return;
  clearTimeout(S.timer); cancelAnimationFrame(S.rafId);
  clearInterval(S.transIv); $('prep-overlay')?.classList.remove('show');
  if (S.phase === 'paused') S.pausedMs += performance.now() - S.pauseT;
  finalizeStep('PARTIAL');

  const logCopy   = [...S.log];
  const infoCopy  = { ...S.info };
  const startTime = S._startTime;

  // กลับหน้าหลักทันที
  window.location.href = 'index.html';

  // บันทึก background
  doSaveToServer(logCopy, { ...infoCopy, startTime }).then(r => {
    if (!r.ok) console.warn('บันทึกไม่สำเร็จ:', r.msg);
  });
}

// ── End session ───────────────────────────────────
async function endSession() {
  S.phase = 'done'; cancelAnimationFrame(S.rafId);

  const endTime = nowTH();
  const result  = await doSaveToServer(S.log, { ...S.info, startTime: S._startTime });

  const done = $('done-overlay');
  if (done) {
    done.style.display = 'flex';
    if ($('done-title')) $('done-title').textContent = result.ok ? 'Session สมบูรณ์!' : 'Session เสร็จสิ้น';
    if ($('done-txt')) $('done-txt').textContent =
      `บันทึก ${S.log.length} ขั้นตอน\n` +
      `Session: ${S.info.sessId}\n` +
      `Participant: ${S.info.pid} — ${S.info.name}\n` +
      `เริ่ม: ${S._startTime}\nจบ: ${endTime}\n\n` +
      (result.ok ? '✅ บันทึกลง Server เรียบร้อย' : '⚠️ บันทึก Server ไม่สำเร็จ กด CSV แทน');
    if ($('btn-dl-excel')) $('btn-dl-excel').disabled = !result.ok;
    if ($('btn-dl-excel') && result.ok) {
      $('btn-dl-excel').onclick = () => apiDownloadExcel(result.filename);
    }
  }
}
