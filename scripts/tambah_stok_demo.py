"""Tambahkan stok simulasi untuk menguji rekomendasi redistribusi."""

from datetime import timedelta

from backend.database import DATA, EXTRA_STOCK_MARKER, db, init
from backend.forecast import DAY, FACILITIES

# Stok tujuan ditambah sebagian kecil sebagai AVAILABLE agar masih ada
# kebutuhan redistribusi. Sisanya menggambarkan stok yang terikat reservasi.
PROFILES = {
    "BDRS-001": {
        "AVAILABLE": [24, 27, 32, 36],
        "PATIENT_RESERVED": [12, 16, 24, 32, 36, 40] * 4 + [14, 28],
    },
    "BDRS-002": {
        "AVAILABLE": [3, 4, 5, 5, 7, 7, 9, 9, 11, 11, 13, 14, 18, 20, 24, 27, 30, 34],
        "PATIENT_RESERVED": [8, 12, 28, 36] * 3,
    },
    "BDRS-003": {
        "AVAILABLE": [2, 4, 5, 6, 6, 8, 8, 10, 10, 12, 12, 13, 14, 19, 22, 25, 29, 34],
        "PATIENT_RESERVED": [9, 14, 26, 32] * 3,
    },
}


def add_demo_stock():
    init()
    with db(write=True) as connection:
        existing = connection.execute(
            "SELECT 1 FROM settings WHERE name=?", (EXTRA_STOCK_MARKER,)
        )
        if existing.fetchone():
            return {}

        added = {}
        for facility, start_id in zip(FACILITIES, (11001, 12001, 13001)):
            count_by_status = {}
            bag_number = start_id
            for status, offsets in PROFILES[facility].items():
                total = 0
                for offset in offsets:
                    expiry = (DAY + timedelta(days=offset)).isoformat()
                    while True:
                        bag_id = f"PRC-{bag_number}"
                        bag_number += 1
                        cursor = connection.execute(
                            """INSERT INTO bags(id,facility,expiry,status)
                               VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING""",
                            (bag_id, facility, expiry, status),
                        )
                        if cursor.rowcount:
                            break
                    total += 1
                count_by_status[status] = total
            added[facility] = count_by_status

        connection.execute(
            "INSERT INTO settings(name,value) VALUES(?,?)", (EXTRA_STOCK_MARKER, "imported")
        )
    return added


if __name__ == "__main__":
    summary = add_demo_stock()
    print(f"Database: {DATA / 'prc.sqlite'}")
    if not summary:
        print("Stok demo tambahan sudah pernah dimuat ke database ini.")
    for facility, counts in summary.items():
        print(
            f"{facility}: +{sum(counts.values())} kantong "
            f"({counts['AVAILABLE']} tersedia, "
            f"{counts['PATIENT_RESERVED']} reservasi pasien)."
        )
