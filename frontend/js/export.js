/* ═══════════════════════════════════════════════════
   CVA Data Collector — Export
   ═══════════════════════════════════════════════════ */

function buildPayload(log, info) {
  return {
    sessId:    info.sessId,
    pid:       info.pid,
    name:      info.name,
    rater:     info.rater,
    note:      info.note || '',
    startTime: info.startTime,
    endTime:   new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false }),
    steps:     log.map(e => ({
      stepId:     e.stepId,
      label:      e.label,
      type:       e.type,
      cva:        e.cva || '',
      onsetMs:    e.onsetMs,
      offsetMs:   e.offsetMs,
      durationMs: e.durationMs,
      status:     e.status,
    })),
  };
}

async function doSaveToServer(log, info) {
  if (!log.length) return { ok: false, msg: 'ไม่มีข้อมูล' };
  try {
    const payload = buildPayload(log, info);
    const result  = await apiSaveSession(payload);
    return { ok: true, filename: result.filename, msg: result.message };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

function doExportCSV(log, info) {
  if (!log.length) { alert('ยังไม่มีข้อมูล'); return; }
  const ts = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false });
  const headers = ['ลำดับ','Step ID','Label','ประเภท','CVA','เวลาเริ่ม(ms)','เวลาสิ้นสุด(ms)','ระยะเวลา(ms)','ระยะเวลา(s)','สถานะ','Participant ID','ชื่อ','ผู้วิจัย','Session','Timestamp'];
  const rows = log.map((e, i) => [
    i + 1, e.stepId, `"${e.label}"`, e.type, e.cva || '',
    e.onsetMs, e.offsetMs, e.durationMs, (e.durationMs / 1000).toFixed(2), e.status,
    info.pid, `"${info.name}"`, `"${info.rater}"`, info.sessId, `"${ts}"`
  ].join(','));
  const blob = new Blob(['\ufeff' + [headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `cva_${info.sessId}.csv` });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
