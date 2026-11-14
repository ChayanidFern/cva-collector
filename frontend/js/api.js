/* ═══════════════════════════════════════════════════
   CVA Data Collector — API Client
   ✏️ แก้ API_BASE_URL เมื่อ deploy
   ═══════════════════════════════════════════════════ */

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : 'https://YOUR-RAILWAY-URL.up.railway.app'; // ✏️ แก้ตรงนี้

async function apiSaveSession(payload) {
  const res = await fetch(`${API_BASE_URL}/api/save-session`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.detail || 'บันทึกไม่สำเร็จ');
  }
  return res.json();
}

async function apiDownloadExcel(filename) {
  const url = `${API_BASE_URL}/api/download/${filename}`;
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename, target: '_blank' });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

async function apiListSessions() {
  const res = await fetch(`${API_BASE_URL}/api/sessions`);
  if (!res.ok) throw new Error('โหลดรายการไม่สำเร็จ');
  return res.json();
}

async function apiDeleteSession(filename) {
  const res = await fetch(`${API_BASE_URL}/api/sessions/${filename}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('ลบไม่สำเร็จ');
  return res.json();
}

async function apiHealthCheck() {
  try { const r = await fetch(`${API_BASE_URL}/`, { signal: AbortSignal.timeout(5000) }); return r.ok; }
  catch { return false; }
}
