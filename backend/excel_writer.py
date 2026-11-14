# ═══════════════════════════════════════════════════════
#  CVA Data Collector — Excel Writer
#  all_sessions.xlsx มี sheet แยกตาม step type + สรุปรวม
# ═══════════════════════════════════════════════════════

import os, re
from datetime import datetime, timezone, timedelta
from typing import Dict
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

BKK = timezone(timedelta(hours=7))
MASTER = "all_sessions.xlsx"

COLORS = {
    "header_bg": "1C2333", "header_fg": "E6EDF3",
    "hold":      "EAF3DE", "rest":      "F1EFE8",
    "activity":  "E6F1FB", "even":      "FFFFFF",
}

HEADERS = [
    ("ลำดับ\n(หมายเลขแถว)",             7),
    ("รหัสประวัติ\n(Session ID)",        18),
    ("ชื่อ-นามสกุล\n(ผู้ร่วมวิจัย)",   20),
    ("ผู้วิจัย\n(Rater)",               14),
    ("ขั้นตอน\n(Step ID)",              14),
    ("ชื่อขั้นตอน\n(Label)",            26),
    ("ประเภท\n(hold=ค้างท่า rest=พัก activity=กิจกรรม)", 18),
    ("ช่วง CVA\n(องศา)",                10),
    ("เวลาเริ่ม\n(มิลลิวินาที นับจากต้น)", 16),
    ("เวลาสิ้นสุด\n(มิลลิวินาที นับจากต้น)", 18),
    ("ระยะเวลา\n(มิลลิวินาที)",         14),
    ("ระยะเวลา\n(วินาที)",              12),
    ("ระยะเวลา\n(นาที)",               12),
    ("สถานะ\n(COMPLETE/PARTIAL/SKIPPED)", 16),
    ("หมายเหตุ",                        20),
    ("เวลาเริ่มบันทึก\n(dd/mm/yyyy hh:mm:ss)", 22),
    ("เวลาจบบันทึก\n(dd/mm/yyyy hh:mm:ss)",   22),
    ("บันทึกลง Server\n(dd/mm/yyyy hh:mm:ss)", 22),
]

def _border():
    s = Side(style="thin", color="D0D7DE")
    return Border(left=s, right=s, top=s, bottom=s)

def _hdr_font():  return Font(name="Sarabun", bold=True, color=COLORS["header_fg"], size=10)
def _body_font(): return Font(name="Sarabun", size=10)
def _hdr_fill():  return PatternFill("solid", fgColor=COLORS["header_bg"])
def _center():    return Alignment(horizontal="center", vertical="center", wrap_text=True)
def _left():      return Alignment(horizontal="left",   vertical="center", wrap_text=True)

def _write_header(ws):
    for col, (h, w) in enumerate(HEADERS, 1):
        c = ws.cell(row=1, column=col, value=h)
        c.font = _hdr_font(); c.fill = _hdr_fill()
        c.alignment = _center(); c.border = _border()
        ws.column_dimensions[get_column_letter(col)].width = w
    ws.row_dimensions[1].height = 42
    ws.freeze_panes = "A2"

def _write_row(ws, row_num, values, bg_color):
    fill = PatternFill("solid", fgColor=bg_color)
    for col, val in enumerate(values, 1):
        c = ws.cell(row=row_num, column=col, value=val)
        c.fill = fill; c.font = _body_font(); c.border = _border()
        c.alignment = _left() if col in (7, 15) else _center()
    ws.row_dimensions[row_num].height = 17


def save_session(sess: Dict, data_dir: str) -> str:
    steps     = sess.get("steps", [])
    sess_id   = sess.get("sessId", f"sess_{int(datetime.now().timestamp())}")
    pid       = sess.get("pid", "")
    name      = sess.get("name", "")
    rater     = sess.get("rater", "")
    note      = sess.get("note", "")
    start_t   = sess.get("startTime", "")
    end_t     = sess.get("endTime", "")
    now_bkk   = datetime.now(BKK).strftime("%d/%m/%Y %H:%M:%S")

    master_path = os.path.join(data_dir, MASTER)

    if os.path.exists(master_path):
        wb = openpyxl.load_workbook(master_path)
    else:
        wb = openpyxl.Workbook()
        wb.remove(wb.active)

    # Sheet รวมทุก step
    main_sheet = "ข้อมูลทั้งหมด"
    if main_sheet in wb.sheetnames:
        ws = wb[main_sheet]
        next_row  = ws.max_row + 1
        global_idx = ws.max_row
    else:
        ws = wb.create_sheet(main_sheet, 0)
        _write_header(ws)
        next_row = 2; global_idx = 1

    # Sheet แยกตาม step type
    type_sheets = {}
    for step in steps:
        stype = step.get("type", "other")
        sheet_name = {"hold": "ค้างท่า (hold)", "rest": "พัก (rest)", "activity": "กิจกรรม (activity)"}.get(stype, stype)
        if sheet_name not in type_sheets:
            if sheet_name in wb.sheetnames:
                ws2 = wb[sheet_name]
                type_sheets[sheet_name] = {"ws": ws2, "next": ws2.max_row + 1, "idx": ws2.max_row}
            else:
                ws2 = wb.create_sheet(sheet_name)
                _write_header(ws2)
                type_sheets[sheet_name] = {"ws": ws2, "next": 2, "idx": 1}

    for step in steps:
        stype    = step.get("type", "other")
        bg_color = COLORS.get(stype, COLORS["even"])
        label    = step.get("label", "")
        dur_ms = step.get("durationMs", 0)
        values = [
            global_idx, sess_id, name, rater,
            step.get("stepId", ""), label, stype,
            step.get("cva", ""),
            step.get("onsetMs", 0), step.get("offsetMs", 0),
            dur_ms,
            round(dur_ms / 1000, 2),
            round(dur_ms / 60000, 3),
            step.get("status", ""),
            note, start_t, end_t, now_bkk,
        ]
        _write_row(ws, next_row, values, bg_color)
        next_row += 1; global_idx += 1

        # เขียนใน type sheet ด้วย
        sheet_name = {"hold": "ค้างท่า (hold)", "rest": "พัก (rest)", "activity": "กิจกรรม (activity)"}.get(stype, stype)
        if sheet_name in type_sheets:
            ts = type_sheets[sheet_name]
            _write_row(ts["ws"], ts["next"], values, bg_color)
            ts["next"] += 1; ts["idx"] += 1

    # Sheet สรุปรายคน
    summary_sheet = "สรุปรายคน"
    if summary_sheet in wb.sheetnames:
        ws_sum = wb[summary_sheet]
        sum_row = ws_sum.max_row + 1
    else:
        ws_sum = wb.create_sheet(summary_sheet)
        sum_headers = [
            ("ลำดับ", 6), ("รหัสประวัติ", 16), ("ชื่อ-นามสกุล", 20),
            ("ผู้วิจัย", 14), ("จำนวนขั้นตอน", 14),
            ("รวมเวลา (นาที)", 16), ("สถานะ", 14),
            ("หมายเหตุ", 20), ("เวลาเริ่ม", 22), ("เวลาจบ", 22),
        ]
        for col, (h, w) in enumerate(sum_headers, 1):
            c = ws_sum.cell(row=1, column=col, value=h)
            c.font = _hdr_font(); c.fill = _hdr_fill()
            c.alignment = _center(); c.border = _border()
            ws_sum.column_dimensions[get_column_letter(col)].width = w
        ws_sum.row_dimensions[1].height = 20
        ws_sum.freeze_panes = "A2"
        sum_row = 2

    total_ms  = sum(s.get("durationMs", 0) for s in steps)
    statuses  = [s.get("status", "") for s in steps]
    overall   = "COMPLETE" if all(s == "COMPLETE" for s in statuses) else "PARTIAL"
    sum_vals  = [
        sum_row - 1, sess_id, name, rater,
        len(steps), round(total_ms / 60000, 2),
        overall, note, start_t, end_t,
    ]
    fill = PatternFill("solid", fgColor="EAF3DE" if overall == "COMPLETE" else "FAEEDA")
    for col, val in enumerate(sum_vals, 1):
        c = ws_sum.cell(row=sum_row, column=col, value=val)
        c.fill = fill; c.font = _body_font()
        c.border = _border(); c.alignment = _center()
    ws_sum.row_dimensions[sum_row].height = 17

    wb.save(master_path)
    return MASTER


def list_sessions(data_dir: str) -> dict:
    files = []
    # โหลด summary sheet เพื่อดึง meta ของแต่ละ session
    master_path = os.path.join(data_dir, MASTER)
    summary_data = {}
    if os.path.exists(master_path):
        try:
            wb = openpyxl.load_workbook(master_path, read_only=True, data_only=True)
            if "สรุปรายคน" in wb.sheetnames:
                ws = wb["สรุปรายคน"]
                for row in ws.iter_rows(min_row=2, values_only=True):
                    if row and row[1]:  # sessId ที่ col 2
                        summary_data[str(row[1])] = {
                            "pid":   str(row[1]) if row[1] else "—",
                            "name":  str(row[2]) if row[2] else "—",
                            "rater": str(row[3]) if row[3] else "—",
                        }
            wb.close()
        except: pass

    for f in sorted(os.listdir(data_dir), reverse=True):
        if f.endswith(".xlsx"):
            p  = os.path.join(data_dir, f)
            st = os.stat(p)
            files.append({
                "filename": f,
                "size_kb":  round(st.st_size / 1024, 1),
                "created":  datetime.fromtimestamp(st.st_mtime, BKK).strftime("%d/%m/%Y %H:%M"),
                "download": f"/api/download/{f}",
                "meta":     summary_data,  # ส่งทั้ง dict ไปให้ frontend เลือกใช้
            })
    return {"count": len(files), "sessions": files, "summary": summary_data}
