"""Jalankan di DB sementara dengan kontrak baru. Lihat README."""

import os, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app import app
from database import DATA, db
import ledger
from forecast import FACILITIES, UDD


def check(label, condition):
    assert condition, label
    print("PASS", label, flush=True)


def test_workflow():
    require_fresh = DATA / "prc.sqlite"
    if require_fresh.exists():
        raise RuntimeError("Pengujian memerlukan folder data uji baru.")
    with TestClient(app) as client:
        auth = {}

        def req(method, path, user=None, data=None, status=200):
            response = (
                client.request(
                    method, "/api/v1" + path, headers=auth.get(user, {}), json=data
                )
                if data is not None
                else client.request(
                    method, "/api/v1" + path, headers=auth.get(user, {})
                )
            )
            assert response.status_code == status, (
                path,
                response.status_code,
                response.text,
            )
            return response.json()

        dest, src, third = FACILITIES
        for f in (*FACILITIES, UDD):
            t = req(
                "POST",
                "/login",
                data=dict(
                    facilityId=f, password=os.environ.get("PRC_PASSWORD", "demo-prc")
                ),
            )["token"]
            auth[f] = {"Authorization": "Bearer " + t}
        req("GET", "/dashboard", status=401)
        req("GET", "/facilities/" + src + "/prc-stock", dest, status=403)
        check("Akses tanpa sesi 401, akses stok lintas BDRS 403", True)
        values = req("GET", "/dashboard", UDD)["metrics"]
        check(
            "Model menghasilkan prediksi 25/20/18 dan MAE pada 14 hari uji",
            [v["predictedDemand"] for v in values] == [25, 20, 18]
            and all(v["test"] == 14 for v in values),
        )
        options = req("GET", "/prc-redistribution/recommendations", UDD)
        rec = next(x for x in options if x["sourceFacilityId"] == src)
        create = "/prc-redistribution/recommendations"
        check(
            "Pratinjau memuat ID dan tanggal kedaluwarsa",
            [bag["bloodBagId"] for bag in rec["bags"]] == rec["bloodBagIds"]
            and all(bag["expiresAt"] == "2026-12-09" for bag in rec["bags"]),
        )
        stale = {
            **rec,
            "bags": [{**rec["bags"][0], "expiresAt": "2026-12-08"}, *rec["bags"][1:]],
        }
        req("POST", create, UDD, stale, 409)
        check(
            "Pratinjau lama tidak menghasilkan usulan",
            not req("GET", "/dashboard", UDD)["plans"],
        )
        p = req("POST", create, UDD, rec)
        key = p["id"]
        bags = p["bags"]
        check(
            "FEFO merekomendasikan sepuluh kantong unik",
            bags == [f"PRC-{i:04}" for i in range(21, 31)],
        )

        def decision(who, step, dec="APPROVED", expected=200, reason=""):
            return req(
                "POST",
                "/prc-redistribution/approvals",
                who,
                dict(
                    recommendationId=key, approvalStage=step, decision=dec, note=reason
                ),
                expected,
            )

        decision(UDD, "UDD_FINAL_APPROVAL", expected=409)
        decision(dest, "SOURCE_CONFIRMATION", expected=403)
        decision(src, "SOURCE_CONFIRMATION")
        req("POST", f"/prc-redistribution/plans/{key}/cancel", UDD, status=409)
        check("UDD tidak dapat membatalkan setelah konfirmasi pertama", True)
        decision(dest, "DESTINATION_CONFIRMATION")
        p = decision(UDD, "UDD_FINAL_APPROVAL")
        order = p["orderId"]
        decision(UDD, "UDD_FINAL_APPROVAL")
        check(
            "Persetujuan berurutan dan percobaan ulang menghasilkan satu bukti",
            len(p["decisions"]) == 3
            and len(p["events"]) == 1
            and bool(p["events"][0]["tx"]),
        )
        req(
            "POST",
            "/facilities/" + src + "/prc-usage",
            src,
            dict(bloodBagIds=[bags[0]]),
            409,
        )
        check("Reservasi melarang pemakaian ganda", True)

        def move(who, stage, items, status=200):
            return req(
                "POST",
                "/prc-redistribution/handovers",
                who,
                dict(orderId=order, handoverStage=stage, bloodBagIds=items),
                status,
            )

        move(UDD, "SOURCE_TO_UDD", bags)
        move(UDD, "SOURCE_TO_UDD", bags)
        items = [dict(bloodBagId=b, result="READY_TO_FORWARD") for b in bags]
        items[-1].update(result="ON_HOLD")
        req(
            "POST",
            "/prc-redistribution/inspections",
            UDD,
            dict(orderId=order, items=items),
            422,
        )
        items[-1]["reason"] = "Ketidaksesuaian dokumen simulasi"
        req(
            "POST",
            "/prc-redistribution/inspections",
            UDD,
            dict(orderId=order, items=items),
        )
        move(dest, "UDD_TO_DESTINATION", bags, 422)
        check("Kantong ditahan wajib beralasan dan ditolak saat dikirim", True)
        p = move(dest, "UDD_TO_DESTINATION", bags[:-1])
        summary = req("GET", "/dashboard", UDD)
        check(
            "Akhir transaksi: asal 25, tujuan 19, satu kantong ditahan di UDD",
            [v["currentStock"] for v in summary["metrics"]] == [19, 25, 28]
            and any(
                b["id"] == bags[-1] and b["status"] == "ON_HOLD"
                for b in req("GET", "/facilities/" + UDD + "/prc-stock", UDD)
            ),
        )
        check(
            "Tiga transaksi berbeda pada kontrak",
            len({e["tx"] for e in p["events"] if e["tx"]}) == 3,
        )
        for e in p["events"]:
            proof = req("GET", "/ledger/verify/" + e["id"], UDD)
            check(
                f"Bukti {e['id']} cocok dengan receipt dan state kontrak",
                proof["verified"],
            )
        with db() as c:
            e = dict(c.execute("SELECT * FROM events LIMIT 1").fetchone())
        e["payload"] += " "
        check("Perubahan payload terdeteksi", not ledger.verify(DATA, e))
        # Buat dan tolak rencana terpisah.
        key = req(
            "POST",
            create,
            UDD,
            dict(sourceFacilityId=third, destinationFacilityId=dest, period="30d"),
        )["id"]
        cancel = f"/prc-redistribution/plans/{key}/cancel"
        before_cancel = req("GET", "/facilities/" + third + "/prc-stock", UDD)
        req("POST", cancel, third, status=403)
        canceled = req("POST", cancel, UDD)
        req("POST", cancel, UDD)
        decision(third, "SOURCE_CONFIRMATION", expected=409)
        check(
            "Pembatalan UDD tercatat tanpa mengubah kantong dan dapat diulang",
            canceled["stage"] == "CANCELLED"
            and canceled["orderId"] is None
            and not canceled["decisions"]
            and not canceled["events"]
            and before_cancel == req("GET", "/facilities/" + third + "/prc-stock", UDD),
        )
        key = req(
            "POST",
            create,
            UDD,
            dict(sourceFacilityId=third, destinationFacilityId=dest, period="30d"),
        )["id"]
        p = decision(
            third, "SOURCE_CONFIRMATION", "REJECTED", reason="Simulasi penolakan"
        )
        check(
            "Penolakan menutup rencana tanpa reservasi dan tanpa pesanan",
            p["stage"] == "REJECTED" and p["orderId"] is None,
        )
        print("Bukti transaksi pengujian", flush=True)
        for e in summary["plans"][0]["events"]:
            print(e["id"], e["tx"])


if __name__ == "__main__":
    test_workflow()
