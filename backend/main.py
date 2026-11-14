# ═══════════════════════════════════════════════════════
#  CVA Data Collector — Backend API
# ═══════════════════════════════════════════════════════

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os, threading, urllib.request, time

from excel_writer import save_session, list_sessions

app = FastAPI(title="CVA Data Collector API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

# Keep-alive (ป้องกัน sleep)
def _keep_alive():
    time.sleep(60)
    while True:
        try: urllib.request.urlopen("http://localhost:8080/", timeout=5)
        except: pass
        time.sleep(270)
threading.Thread(target=_keep_alive, daemon=True).start()


class StepLog(BaseModel):
    stepId:     str
    label:      str
    type:       str
    cva:        Optional[str] = ""
    onsetMs:    int
    offsetMs:   int
    durationMs: int
    status:     str

class SessionPayload(BaseModel):
    sessId:    str
    pid:       str
    name:      str
    rater:     str
    note:      Optional[str] = ""
    startTime: Optional[str] = ""
    endTime:   Optional[str] = ""
    steps:     List[StepLog]


@app.get("/")
def root():
    return {"status": "ok", "service": "CVA Data Collector API", "version": "1.0.0"}


@app.post("/api/save-session")
def save_session_endpoint(data: SessionPayload):
    try:
        filename = save_session(data.dict(), DATA_DIR)
        return {"status": "success", "filename": filename,
                "download": f"/api/download/{filename}",
                "message": f"บันทึก {len(data.steps)} steps เรียบร้อย"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/download/{filename}")
def download(filename: str):
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="ไม่พบไฟล์")
    return FileResponse(path=path, filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@app.get("/api/sessions")
def get_sessions():
    return {"status": "success", **list_sessions(DATA_DIR)}


@app.delete("/api/sessions/{filename}")
def delete_session(filename: str):
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="ไม่พบไฟล์")
    os.remove(path)
    return {"status": "success", "message": f"ลบ {filename} แล้ว"}
