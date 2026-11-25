import csv, os, sqlite3
from contextlib import contextmanager
from datetime import timedelta
from pathlib import Path
from forecast import DAY, FACILITIES

BASE = Path(__file__).resolve().parent
DATA = Path(os.environ.get("PRC_DATA", BASE / "data"))
SCHEMA = """
CREATE TABLE IF NOT EXISTS bags(id TEXT PRIMARY KEY, facility TEXT NOT NULL, expiry TEXT NOT NULL, status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS usage(facility TEXT, day TEXT, qty INTEGER NOT NULL, PRIMARY KEY(facility,day));
CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY, src TEXT, dst TEXT, bags TEXT, stage TEXT, orderId TEXT UNIQUE, horizon INTEGER);
CREATE TABLE IF NOT EXISTS decisions(plan TEXT, stage TEXT, actor TEXT, decision TEXT, note TEXT, at TEXT, PRIMARY KEY(plan,stage));
CREATE TABLE IF NOT EXISTS inspections(plan TEXT,bag TEXT,result TEXT,reason TEXT,actor TEXT,at TEXT,PRIMARY KEY(plan,bag));
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,plan TEXT,payload TEXT,tx TEXT);
CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY, facility TEXT, message TEXT, at TEXT);
CREATE TABLE IF NOT EXISTS settings(name TEXT PRIMARY KEY, value TEXT);
INSERT OR IGNORE INTO settings VALUES('jwt_secret',hex(randomblob(32)));
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,facility TEXT,expires REAL);
"""


@contextmanager
def db(write=False):
    DATA.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DATA / "prc.sqlite", timeout=20)
    c.row_factory = sqlite3.Row
    try:
        c.execute("BEGIN IMMEDIATE" if write else "BEGIN")
        yield c
        c.commit()
    except BaseException:
        c.rollback()
        raise
    finally:
        c.close()


def init():
    with db(True) as c:
        c.executescript(SCHEMA)
        c.execute("BEGIN IMMEDIATE")
        if c.execute("SELECT 1 FROM usage LIMIT 1").fetchone():
            return
        with open(BASE / "fixtures/usage.csv", newline="") as f:
            c.executemany(
                "INSERT INTO usage VALUES(:facility,:day,:qty)", csv.DictReader(f)
            )
        for fac, start, n, near in zip(
            FACILITIES, [1, 21, 61], [10, 35, 28], [0, 10, 5]
        ):
            for i in range(n):
                expiry = DAY + timedelta(days=14 if i < near else 35)
                c.execute(
                    "INSERT INTO bags VALUES(?,?,?,'AVAILABLE')",
                    (f"PRC-{start + i:04}", fac, str(expiry)),
                )
