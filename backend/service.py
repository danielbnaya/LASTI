import json
from datetime import datetime, timezone, date
from math import floor
from fastapi import HTTPException
from .forecast import DAY, FACILITIES, RESERVE, UDD, predict
from .ledger import canonical


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def require(condition, message, code=409):
    if not condition:
        raise HTTPException(code, message)


def rows(c, sql, args=()):
    return [dict(r) for r in c.execute(sql, args)]


def history(c, f):
    return rows(c, "SELECT day,qty FROM usage WHERE facility=? ORDER BY day", (f,))


def note(c, facility, message):
    c.execute(
        "INSERT INTO notes(facility,message,at) VALUES(?,?,?)",
        (facility, message, now()),
    )


def ids(p):
    return json.loads(p["bags"])


def getplan(c, key):
    p = c.execute("SELECT * FROM plans WHERE id=? OR orderId=?", (key, key)).fetchone()
    require(p, "Rencana tidak ditemukan", 404)
    return dict(p)


def inbound(c, facility):
    result = []
    for p in rows(
        c,
        "SELECT * FROM plans WHERE dst=? AND stage IN ('TO_UDD','INSPECTION','TO_DEST')",
        (facility,),
    ):
        held = {
            r["bag"]
            for r in rows(
                c,
                "SELECT bag FROM inspections WHERE plan=? AND result='ON_HOLD'",
                (p["id"],),
            )
        }
        result.extend(set(ids(p)) - held)
    return result


def metrics(c, f, horizon):
    bags = rows(
        c,
        "SELECT * FROM bags WHERE facility=? AND status='AVAILABLE' AND expiry>? ORDER BY expiry,id",
        (f, str(DAY)),
    )
    pred = predict(history(c, f), horizon)
    candidates = [
        b for b in bags if 5 <= (date.fromisoformat(b["expiry"]) - DAY).days <= 14
    ]
    incoming = inbound(c, f)
    surplus = min(
        len(candidates), max(0, len(bags) - pred["predictedDemand"] - RESERVE)
    )
    return dict(
        facilityId=f,
        currentStock=len(bags),
        near=len(candidates),
        incoming=len(incoming),
        potentialSurplus=surplus,
        potentialShortage=max(
            0, pred["predictedDemand"] + RESERVE - len(bags) - len(incoming)
        ),
        candidates=candidates,
        **pred,
    )


def selected(c, origin, dest, horizon):
    src = metrics(c, origin, horizon)
    dst = metrics(c, dest, horizon)
    limit = min(src["potentialSurplus"], dst["potentialShortage"])
    pending = inbound(c, dest)
    competing = rows(
        c,
        "SELECT id,expiry FROM bags WHERE (facility=? AND status='AVAILABLE') OR id IN (SELECT value FROM json_each(?))",
        (dest, json.dumps(pending)),
    )
    picked = []
    for bag in src["candidates"]:
        if len(picked) >= limit:
            break
        days = (date.fromisoformat(bag["expiry"]) - DAY).days
        # Asumsi demo: satu hari untuk dua perpindahan, konsumsi tujuan setelah tiba.
        capacity = floor(sum(dst["daily"][1:days]) + 1e-9)
        earlier = sum(b["expiry"] <= bag["expiry"] for b in competing)
        if len(picked) + earlier < capacity:
            picked.append(bag["id"])
    return picked


def bag_preview(c, blood_bag_ids):
    return rows(
        c,
        """SELECT bags.id AS bloodBagId, bags.expiry AS expiresAt
           FROM json_each(?) AS chosen JOIN bags ON bags.id = chosen.value
           ORDER BY chosen.key""",
        (json.dumps(blood_bag_ids),),
    )


def active_routes(c):
    return {
        (plan["src"], plan["dst"]): plan["id"]
        for plan in c.execute(
            """SELECT src, dst, id FROM plans
               WHERE stage NOT IN ('DONE', 'REJECTED', 'CANCELLED', 'ALL_HELD')
               ORDER BY rowid"""
        )
    }


def last_plan_number(c):
    # Format REC-xxxx telah digunakan sebelum nomor terakhir disimpan di settings.
    return c.execute(
        """SELECT MAX(
               COALESCE((SELECT CAST(value AS INTEGER) FROM settings WHERE name='last_plan_number'), 0),
               COALESCE((SELECT MAX(CAST(SUBSTR(id, 5) AS INTEGER)) FROM plans), 0)
           )"""
    ).fetchone()[0]


def save_plan_number(c, number):
    c.execute(
        """INSERT INTO settings(name, value) VALUES ('last_plan_number', ?)
           ON CONFLICT(name) DO UPDATE SET value=excluded.value""",
        (str(number),),
    )


def create_plan(c, src, dst, h, reviewed_bags=None):
    require(
        src in FACILITIES and dst in FACILITIES and src != dst,
        "Pasangan fasilitas tidak valid",
        422,
    )
    active = active_routes(c).get((src, dst))
    require(
        active is None,
        f"Rencana {active} masih aktif untuk pasangan ini. Buka Daftar rencana.",
    )
    bags = selected(c, src, dst, h)
    if reviewed_bags is not None:
        require(
            reviewed_bags == bag_preview(c, bags),
            "Daftar kantong berubah. Klik Cari rekomendasi lagi untuk meninjau daftar terbaru.",
        )
    require(bags, "Tidak ada kantong yang memenuhi seluruh kriteria.")
    number = last_plan_number(c) + 1
    save_plan_number(c, number)
    key = f"REC-{number:04}"
    c.execute(
        "INSERT INTO plans VALUES(?,?,?,?,'SOURCE',NULL,?)",
        (key, src, dst, json.dumps(bags), h),
    )
    note(c, src, f"{key} menunggu keputusan pelepasan.")
    return key


def cancel_plan(c, plan):
    if plan["stage"] == "CANCELLED":
        return

    has_decision = c.execute(
        "SELECT 1 FROM decisions WHERE plan=? LIMIT 1", (plan["id"],)
    ).fetchone()
    require(
        plan["stage"] == "SOURCE" and not plan["orderId"] and not has_decision,
        "Usulan hanya dapat dibatalkan sebelum ada keputusan dari pihak mana pun.",
    )
    c.execute("UPDATE plans SET stage='CANCELLED' WHERE id=?", (plan["id"],))
    for facility in (UDD, plan["src"], plan["dst"]):
        note(c, facility, f"{plan['id']} dibatalkan oleh UDD.")


def restore_redistributed_bags(c):
    # Satu kantong bisa berpindah lebih dari sekali. Urutan persetujuan
    # akhir, termasuk peristiwa yang masih menunggu blockchain, menentukan asal awalnya.
    origins = {}
    for row in c.execute(
        """SELECT p.src, bag.value AS bag_id
           FROM events AS e
           JOIN plans AS p ON p.id=e.plan AND e.id=p.orderId || '/APPROVAL'
           JOIN json_each(p.bags) AS bag
           ORDER BY e.rowid"""
    ):
        origins.setdefault(row["bag_id"], row["src"])
    restored = 0
    for bag, facility in origins.items():
        restored += c.execute(
            """UPDATE bags SET facility=?, status='AVAILABLE'
               WHERE id=? AND status NOT IN ('USED', 'PATIENT_RESERVED')
                 AND (facility<>? OR status<>'AVAILABLE')""",
            (facility, bag, facility),
        ).rowcount
    return restored


def reset_redistribution(c, *, restore_stock=True):
    removed = c.execute("SELECT COUNT(*) FROM plans").fetchone()[0]
    if not removed:
        return {"removedPlans": 0, "restoredBags": 0}

    restored = restore_redistributed_bags(c) if restore_stock else 0
    save_plan_number(c, last_plan_number(c))
    c.execute(
        """DELETE FROM notes WHERE SUBSTR(message, 1, INSTR(message, ' ') - 1) IN (
               SELECT id FROM plans UNION SELECT orderId FROM plans
           )"""
    )
    c.execute("DELETE FROM events")
    c.execute("DELETE FROM decisions")
    c.execute("DELETE FROM inspections")
    c.execute("DELETE FROM receipt_reports")
    c.execute("DELETE FROM plans")
    return {"removedPlans": removed, "restoredBags": restored}


def enqueue(c, p, stage, actor, bags):
    key = p["orderId"] + "/" + stage
    src, dst = (
        (p["src"], p["dst"])
        if stage == "APPROVAL"
        else ((p["src"], UDD) if stage == "SOURCE_TO_UDD" else (UDD, p["dst"]))
    )
    payload = dict(
        orderId=p["orderId"],
        event=stage,
        by=actor,
        source=src,
        destination=dst,
        at=now(),
        quantity=len(bags),
        bloodBagIds=sorted(bags),
    )
    c.execute(
        "INSERT INTO events VALUES(?,?,?,NULL)", (key, p["id"], canonical(payload))
    )


def approve(c, p, actor, stage, decision, reason):
    stages = {
        "SOURCE_CONFIRMATION": ("SOURCE", p["src"], "DEST", p["dst"]),
        "DESTINATION_CONFIRMATION": ("DEST", p["dst"], "FINAL", UDD),
        "UDD_FINAL_APPROVAL": ("FINAL", UDD, "TO_UDD", UDD),
    }
    expected, owner, nxt, recipient = stages[stage]
    require(actor == owner, "Akun tidak berwenang pada tahap ini", 403)
    previous = c.execute(
        "SELECT decision FROM decisions WHERE plan=? AND stage=?", (p["id"], stage)
    ).fetchone()
    if previous:
        require(previous[0] == decision, "Keputusan sudah tersimpan")
        return
    require(
        p["stage"] == expected,
        "Tahap sebelumnya belum selesai atau pesanan sudah ditutup",
    )
    if decision == "REJECTED":
        require(reason.strip(), "Isi alasan penolakan", 422)
        nxt = "REJECTED"
    elif expected == "FINAL":
        current = set(selected(c, p["src"], p["dst"], p["horizon"]))
        require(
            set(ids(p)).issubset(current),
            "Stok, kebutuhan atau daftar kandidat berubah. Tolak rencana lama dan buat rekomendasi baru.",
        )
        for bag in ids(p):
            row = c.execute(
                "UPDATE bags SET status='RESERVED' WHERE id=? AND facility=? AND status='AVAILABLE'",
                (bag, p["src"]),
            )
            require(row.rowcount == 1, "Kantong tidak tersedia")
        p["orderId"] = p["id"].replace("REC", "ORD")
        c.execute("UPDATE plans SET orderId=? WHERE id=?", (p["orderId"], p["id"]))
        enqueue(c, p, "APPROVAL", actor, ids(p))
    c.execute(
        "INSERT INTO decisions VALUES(?,?,?,?,?,?)",
        (p["id"], stage, actor, decision, reason, now()),
    )
    c.execute("UPDATE plans SET stage=? WHERE id=?", (nxt, p["id"]))
    for f in set([recipient, p["src"], p["dst"], UDD]):
        note(c, f, f"{p['id']} · {stage} · {decision}")


def ready_to_forward(c, plan_id):
    return [
        row["bag"]
        for row in c.execute(
            "SELECT bag FROM inspections WHERE plan=? AND result='READY_TO_FORWARD'",
            (plan_id,),
        )
    ]


def report_receipt_discrepancy(c, plan, actor, received_ids, affected_ids, reason):
    require(actor == plan["dst"], "Laporan hanya dapat dibuat oleh BDRS tujuan", 403)
    require(plan["stage"] == "TO_DEST", "Pesanan belum atau sudah diterima", 409)
    expected = set(ready_to_forward(c, plan["id"]))
    received = set(received_ids)
    affected = set(affected_ids)
    require(
        len(received) == len(received_ids), "ID kantong diterima tidak boleh berulang", 422
    )
    require(
        affected <= (expected | received),
        "ID bermasalah harus tercantum pada daftar UDD atau daftar yang diterima.",
        422,
    )
    # Selisih ID masuk otomatis. ID tambahan menandai masalah pada kantong
    # yang memang diharapkan dan tercatat tiba.
    affected |= expected ^ received
    require(affected, "Masukkan ID kantong bermasalah.", 422)
    reason = reason.strip()
    require(reason, "Isi alasan ketidaksesuaian.", 422)
    received_json = canonical(sorted(received))
    affected_json = canonical(sorted(affected))
    last = c.execute(
        """SELECT received, affected, reason FROM receipt_reports
           WHERE plan=? ORDER BY id DESC LIMIT 1""",
        (plan["id"],),
    ).fetchone()
    if last and tuple(last) == (received_json, affected_json, reason):
        return
    c.execute(
        """INSERT INTO receipt_reports(plan,received,affected,reason,actor,at)
           VALUES(?,?,?,?,?,?)""",
        (plan["id"], received_json, affected_json, reason, actor, now()),
    )
    for facility in (UDD, actor):
        note(c, facility, f"{plan['orderId']} · {actor} melaporkan ketidaksesuaian penerimaan.")


def handover(c, p, actor, stage, received):
    first = stage == "SOURCE_TO_UDD"
    require(actor == (UDD if first else p["dst"]), "Akun bukan penerima tahap ini", 403)
    expected = ids(p) if first else ready_to_forward(c, p["id"])
    require(
        bool(expected) and sorted(received) == sorted(expected),
        "Daftar ID harus sama dengan kantong yang boleh diserahterimakan",
        422,
    )
    prior = c.execute(
        "SELECT 1 FROM events WHERE id=?", (str(p["orderId"]) + "/" + stage,)
    ).fetchone()
    if prior:
        return
    require(
        p["stage"] == ("TO_UDD" if first else "TO_DEST"),
        "Tahap serah terima belum sesuai",
    )
    for bag in received:
        q = c.execute(
            "UPDATE bags SET facility=?,status=? WHERE id=? AND facility=? AND status=?",
            (
                actor,
                "PENDING_INSPECTION" if first else "AVAILABLE",
                bag,
                p["src"] if first else UDD,
                "RESERVED" if first else "READY_TO_FORWARD",
            ),
        )
        require(q.rowcount == 1, "Status atau lokasi kantong tidak sesuai")
    c.execute(
        "UPDATE plans SET stage=? WHERE id=?",
        ("INSPECTION" if first else "DONE", p["id"]),
    )
    enqueue(c, p, stage, actor, received)
    for f in {UDD, p["src"], p["dst"]}:
        note(c, f, f"{p['orderId']} · {len(received)} kantong diterima {actor}")


def examine(c, p, items, actor):
    require(actor == UDD, "Pemeriksaan hanya oleh UDD", 403)
    require(p["stage"] == "INSPECTION", "Pesanan belum berada pada tahap pemeriksaan")
    require(
        sorted(i.bloodBagId for i in items) == sorted(ids(p)),
        "Periksa setiap ID tepat satu kali",
        422,
    )
    for i in items:
        require(
            i.result != "ON_HOLD" or i.reason.strip(),
            "Alasan penahanan wajib diisi",
            422,
        )
        c.execute("UPDATE bags SET status=? WHERE id=?", (i.result, i.bloodBagId))
        c.execute(
            "INSERT INTO inspections VALUES(?,?,?,?,?,?)",
            (p["id"], i.bloodBagId, i.result, i.reason, actor, now()),
        )
    nxt = (
        "TO_DEST" if any(i.result == "READY_TO_FORWARD" for i in items) else "ALL_HELD"
    )
    c.execute("UPDATE plans SET stage=? WHERE id=?", (nxt, p["id"]))
    note(c, p["dst"], f"{p['orderId']} · hasil pemeriksaan UDD tersedia")
