# 🦴 CVA Data Collector

ระบบเก็บข้อมูลท่านั่งสำหรับ Text Neck Syndrome Dataset  
วัด Craniovertebral Angle (CVA) ตาม protocol มาตรฐาน

---

## โครงสร้างไฟล์

```
cva-collector/
├── frontend/                  ← หน้าเว็บ (deploy บน Vercel/Netlify)
│   ├── index.html             ← หน้ากรอกข้อมูล + เริ่ม session
│   ├── session.html           ← หน้า Stepper ระหว่าง session
│   ├── sessions.html          ← ดู/ดาวน์โหลด sessions ทั้งหมด
│   ├── css/style.css          ← ✏️ แก้สีและ layout ที่นี่
│   ├── js/
│   │   ├── api.js             ← ✏️ แก้ API_BASE_URL เมื่อ deploy
│   │   ├── audio.js           ← เสียง + Web Notification
│   │   ├── export.js          ← บันทึก server + export CSV
│   │   └── session.js         ← logic หลัก step/timer
│   └── data/
│       └── protocol.js        ← ✏️ แก้ขั้นตอนและเวลาที่นี่
│
└── backend/                   ← Python FastAPI (deploy บน Railway)
    ├── main.py                ← API endpoints
    ├── excel_writer.py        ← ✏️ แก้สไตล์ Excel ที่นี่
    ├── requirements.txt
    ├── Procfile
    └── nixpacks.toml
```

---

## Protocol (แก้ได้ที่ `frontend/data/protocol.js`)

| ขั้นตอน | เวลา |
|---|---|
| Label ปกติ CVA ≥50° | 1 นาที |
| พัก | 1 นาที |
| Label CVA 40–49.9° | 1 นาที |
| พัก | 1 นาที |
| Label CVA 30–39.9° | 1 นาที |
| พัก | 1 นาที |
| Label CVA ≤30° | 1 นาที |
| พัก | 1 นาที |
| เขียน/วาดรูป | 3 นาที |
| พัก | 1 นาที |
| ใช้โน้ตบุ๊ค | 3 นาที |
| พัก | 1 นาที |
| กิจกรรมอิสระ | 10 นาที |
| รวม | ~26 นาที (+เวลาเตรียม ~35 นาที) |

---

## Deploy

### Backend (Railway)
1. Push repo ขึ้น GitHub
2. Railway → New Project → repo → Root Directory: `backend`
3. Copy URL ที่ได้ เช่น `https://xxx.up.railway.app`

### Frontend (Vercel/Netlify)
1. แก้ `frontend/js/api.js` บรรทัด 5 ใส่ URL ของ Railway
2. Deploy โฟลเดอร์ `frontend/` → Root Directory: `frontend`

### รัน Local
```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend && python -m http.server 3000
# เปิด http://localhost:3000
```

---

## Excel Output (`all_sessions.xlsx`)

| Sheet | เนื้อหา |
|---|---|
| ข้อมูลทั้งหมด | ทุก step จากทุก session |
| ค้างท่า (hold) | เฉพาะ step ประเภท Hold |
| พัก (rest) | เฉพาะ step ประเภท Rest |
| กิจกรรม (activity) | เฉพาะ step ประเภท Activity |

---

## ฟีเจอร์

- **เสียงแจ้งเตือน** เมื่อครบเวลาแต่ละขั้น + เตือนล่วงหน้า 10 วินาที
- **Web Notification** แจ้งเตือนได้แม้ไปเปิดแท็บอื่น
- **บันทึกอัตโนมัติ** เมื่อจบ session หรือหยุดกลางคัน
- **Export CSV** สำรองกรณี backend offline
- **Stepper UI** เห็นชัดว่าอยู่ขั้นไหน เหลืออีกกี่ขั้น
