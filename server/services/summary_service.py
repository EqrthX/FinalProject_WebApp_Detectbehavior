"""อ่าน buffer คำนวณผลสรุป และบันทึก Supabase ด้วยสูตรและลำดับเดิม."""

import json
import os
from collections import defaultdict
from datetime import datetime
from typing import Optional

from config.bn_supabase import supabase_client
from utils.json_buffer import get_all_pending_files


def _read_log_file(path: str) -> Optional[dict]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Error reading {path}: {e}")
        return None


def _build_insert_payload(records: list, data: dict) -> list[dict]:
    camera_id = data["camera_id"]
    teacher_id = data["teacher_id"]
    subject_id = (data.get("subject_id") or "").strip()
    group = data["group"]
    session_id = data.get("session_id")

    insert_payload = []
    for record in records:
        insert_payload.append({
            "camera_id": camera_id,
            "teacher_id": teacher_id,
            "subject_id": subject_id,
            "group": group,
            "session_id": session_id,
            "Attention": record["Attention"],
            "Non_Attention": record["Non_Attention"],
            "class_json": record["class_json"],
            "class_duration": record["class_duration"],
            "created_at": record["created_at"],
        })
    return insert_payload


def _calculate_summary(records: list, count: int):
    total_att = 0.0
    total_non = 0.0
    class_totals = defaultdict(float)
    class_duration_totals = defaultdict(float)

    # หาวันที่ของไฟล์นี้ (เอาจาก record แรก)
    first_dt = records[0]["created_at"]
    if isinstance(first_dt, str):
        try:
            dt_obj = datetime.fromisoformat(first_dt.replace("Z", "+00:00"))
            summary_date = dt_obj.date().isoformat()
        except Exception:
            summary_date = datetime.now().date().isoformat()
    else:
        summary_date = datetime.now().date().isoformat()

    for r in records:
        total_att += float(r.get("Attention") or 0.0)
        total_non += float(r.get("Non_Attention") or 0.0)
        
        # รวม class count (%)
        cj = r.get("class_json") or {}
        if isinstance(cj, str):
            try: cj = json.loads(cj)
            except Exception: cj = {}
        for k, v in cj.items():
            class_totals[k] += float(v or 0.0)

        # รวม duration (sec)
        cd = r.get("class_duration") or {}
        if isinstance(cd, str):
            try: cd = json.loads(cd)
            except Exception: cd = {}
        for k, v in cd.items():
            class_duration_totals[k] += float(v or 0.0)

    # ค่าเฉลี่ยของ Session นี้
    avg_att = total_att / count if count > 0 else 0.0
    avg_non = total_non / count if count > 0 else 0.0
    
    class_summary = {}
    if count > 0:
        for k, v in class_totals.items():
            class_summary[k] = round(v / count, 3)

    return summary_date, avg_att, avg_non, class_summary, class_duration_totals


def _build_daily_row(data: dict, summary_date: str, avg_att: float, avg_non: float, class_summary: dict, class_duration_totals: dict) -> dict:
    return {
        "teacher_id": data["teacher_id"],
        "subject_id": (data.get("subject_id") or "").strip(),
        "camera_id": data["camera_id"],
        "summary_date": summary_date,
        "avg_attention": round(avg_att, 3),
        "avg_non_attention": round(avg_non, 3),
        "class_json_summary": class_summary,
        "class_duration_summary": {k: round(v, 1) for k, v in class_duration_totals.items()},
        "group": data["group"],
        "session_id": data.get("session_id")
    }


async def summary_to_supabase():
    files = get_all_pending_files()
    print(f"📂 Found {len(files)} files pending upload")
    
    if not files:
        return {"message": "ไม่มีข้อมูลค้างอยู่", "inserted": 0}

    total_inserted = 0
    total_summary_inserted = 0

    # ✅ วนลูปทำทีละไฟล์ (ทีละ Session) ไม่เอามารวมกันแล้ว
    for path in files:
        data = _read_log_file(path)
        if not data:
            continue

        records = data.get("records", [])
        if not records:
            # ไฟล์เปล่า ลบทิ้งเลย
            try: os.remove(path)
            except Exception: pass
            continue

        # 1. เตรียมข้อมูล Logs
        insert_payload = _build_insert_payload(records, data)

        # 2. Insert Logs (บันทึกข้อมูลดิบรายนาที)
        if insert_payload:
            try:
                supabase_client.table("camera_logs").insert(insert_payload).execute()
                total_inserted += len(insert_payload)
            except Exception as e:
                print(f"❌ Error inserting logs for {path}: {e}")
                continue # ถ้า log เข้าไม่ได้ อย่าเพิ่งทำ summary และอย่าเพิ่งลบไฟล์

        # 3. คำนวณ Summary **เฉพาะของไฟล์นี้ (Session นี้)**
        summary_date, avg_att, avg_non, class_summary, class_duration_totals = _calculate_summary(records, len(records))

        daily_row = _build_daily_row(data, summary_date, avg_att, avg_non, class_summary, class_duration_totals)

        # 4. Insert Summary (1 ไฟล์ = 1 แถวสรุป)
        try:
            supabase_client.table("camera_daily_summary").insert(daily_row).execute()
            total_summary_inserted += 1
            
            # ✅ ทำเสร็จแล้วลบไฟล์ทิ้ง
            try: os.remove(path)
            except Exception: pass
            print(f"✅ Processed and deleted: {path}")

        except Exception as e:
            print(f"❌ Error inserting summary for {path}: {e}")

    return {
        "message": f"บันทึกข้อมูลเสร็จสิ้น แยก {total_summary_inserted} sessions",
        "inserted": total_inserted,
    }
