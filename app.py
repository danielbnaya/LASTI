import jwt
import hmac, json, os, re, secrets, time
from contextlib import asynccontextmanager
from typing import Literal, Annotated
from datetime import date
from fastapi import FastAPI, APIRouter, Depends, Header
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import ledger
from database import BASE, DATA, db, init
from service import (
    DAY,
    FACILITIES,
    UDD,
    approve,
    create_plan,
    examine,
    getplan,
    handover,
    history,
    ids,
    metrics,
    note,
    require,
    rows,
    selected,
)


@asynccontextmanager
async def lifespan(app):
    init()
    yield


app = FastAPI(title="PRC Connect · API jejaring simulasi", lifespan=lifespan)
api = APIRouter(prefix="/api/v1")


class Login(BaseModel):
    facilityId: str
    password: str


class Bag(BaseModel):
    bloodBagId: str = Field(pattern=r"^PRC-[0-9]{4,10}$")
    expiresAt: date
    status: Literal["AVAILABLE", "PATIENT_RESERVED"] = "AVAILABLE"


class Stock(BaseModel):
    bags: list[Bag] = Field(min_length=1, max_length=100)


class Usage(BaseModel):
    bloodBagIds: list[str] = Field(min_length=1, max_length=100)


class Forecast(BaseModel):
    facilityId: str
    period: str = "30d"


class Proposal(BaseModel):
    sourceFacilityId: str
    destinationFacilityId: str
    period: str = "30d"


class Approval(BaseModel):
    recommendationId: str
    approvalStage: Literal[
        "SOURCE_CONFIRMATION", "DESTINATION_CONFIRMATION", "UDD_FINAL_APPROVAL"
    ]
    decision: Literal["APPROVED", "REJECTED"]
    note: str = Field(default="", max_length=400)


class Transfer(BaseModel):
    orderId: str
    handoverStage: Literal["SOURCE_TO_UDD", "UDD_TO_DESTINATION"]
    bloodBagIds: list[str] = Field(min_length=1, max_length=100)


class Item(BaseModel):
    bloodBagId: str
    result: Literal["READY_TO_FORWARD", "ON_HOLD"]
    reason: str = Field(default="", max_length=400)


class Inspection(BaseModel):
    orderId: str
    items: list[Item] = Field(min_length=1, max_length=100)


class Notice(BaseModel):
    facilityId: str
    message: str = Field(min_length=1, max_length=400)


def horizon(s):
    require(
        re.fullmatch(r"(?:[7-9]|[12][0-9]|30)d", s), "Periode harus 7d sampai 30d", 422
    )
    return int(s[:-1])


def actor(authorization: Annotated[str, Header()] = ""):
    require(authorization.startswith("Bearer "), "Silakan masuk kembali", 401)
    token = authorization.removeprefix("Bearer ")
    with db() as c:
        secret = c.execute(
            "SELECT value FROM settings WHERE name='jwt_secret'"
        ).fetchone()[0]
        try:
            jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"require": ["exp", "sub", "jti"]},
            )
        except jwt.InvalidTokenError:
            require(False, "Sesi tidak valid atau telah berakhir", 401)
        row = c.execute(
            "SELECT facility FROM sessions WHERE token=? AND expires>?",
            (ledger.digest(token), time.time()),
        ).fetchone()
    require(row, "Silakan masuk kembali", 401)
    return row[0]


User = Annotated[str, Depends(actor)]


def access(user, facility):
    require(facility in (*FACILITIES, UDD), "Fasilitas tidak ditemukan", 404)
    require(user in (UDD, facility), "Fasilitas berbeda", 403)


def flush():
    with db(True) as c:
        for event in rows(c, "SELECT * FROM events WHERE tx IS NULL ORDER BY rowid"):
            try:
                tx = ledger.commit(DATA, event)
            except (OSError, ValueError, KeyError, IndexError):
                break
            c.execute("UPDATE events SET tx=? WHERE id=?", (tx, event["id"]))


def detail(c, p):
    key = p["id"]
    return {
        **p,
        "bags": ids(p),
        "decisions": rows(
            c, "SELECT * FROM decisions WHERE plan=? ORDER BY rowid", (key,)
        ),
        "inspections": rows(
            c, "SELECT * FROM inspections WHERE plan=? ORDER BY bag", (key,)
        ),
        "events": [
            {**e, "payload": json.loads(e["payload"])}
            for e in rows(
                c,
                "SELECT id,payload,tx FROM events WHERE plan=? ORDER BY rowid",
                (key,),
            )
        ],
    }


@api.post("/login")
def login(body: Login):
    require(
        body.facilityId in (*FACILITIES, UDD)
        and hmac.compare_digest(
            body.password.encode(), os.environ.get("PRC_PASSWORD", "demo-prc").encode()
        ),
        "Akun atau sandi salah",
        401,
    )
    with db(True) as c:
        secret = c.execute(
            "SELECT value FROM settings WHERE name='jwt_secret'"
        ).fetchone()[0]
        token = jwt.encode(
            {
                "sub": body.facilityId,
                "exp": int(time.time()) + 28800,
                "jti": secrets.token_hex(16),
            },
            secret,
            algorithm="HS256",
        )
        c.execute("DELETE FROM sessions WHERE expires<=?", (time.time(),))
        c.execute(
            "INSERT INTO sessions VALUES(?,?,?)",
            (ledger.digest(token), body.facilityId, time.time() + 28800),
        )
    return {"token": token, "user": body.facilityId}


@api.post("/logout")
def logout(user: User, authorization: Annotated[str, Header()]):
    with db(True) as c:
        c.execute(
            "DELETE FROM sessions WHERE token=?",
            (ledger.digest(authorization.removeprefix("Bearer ")),),
        )
    return {"ok": True}


@api.get("/dashboard")
def dashboard(user: User, period: str = "30d"):
    with db() as c:
        facilities = FACILITIES if user == UDD else (user,)
        plans = rows(
            c,
            "SELECT * FROM plans WHERE ?=? OR src=? OR dst=? ORDER BY rowid DESC",
            (user, UDD, user, user),
        )
        return {
            "user": user,
            "day": str(DAY),
            "facilities": facilities,
            "metrics": [metrics(c, f, horizon(period)) for f in facilities],
            "plans": [detail(c, p) for p in plans],
            "notes": rows(
                c,
                "SELECT * FROM notes WHERE facility=? ORDER BY id DESC LIMIT 12",
                (user,),
            ),
        }


@api.get("/facilities/{facility}/prc-stock")
def stock(facility: str, user: User):
    access(user, facility)
    with db() as c:
        return rows(
            c, "SELECT * FROM bags WHERE facility=? ORDER BY expiry,id", (facility,)
        )


@api.put("/facilities/{facility}/prc-stock")
def put_stock(facility: str, body: Stock, user: User):
    access(user, facility)
    with db(True) as c:
        for b in body.bags:
            require(
                b.expiresAt > DAY,
                "Tanggal kedaluwarsa harus sesudah tanggal simulasi",
                422,
            )
            old = c.execute("SELECT * FROM bags WHERE id=?", (b.bloodBagId,)).fetchone()
            require(
                not old
                or (
                    old["facility"] == facility
                    and old["status"] in ("AVAILABLE", "PATIENT_RESERVED")
                ),
                "Kantong sudah digunakan atau dialokasikan",
            )
            c.execute(
                "INSERT INTO bags VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET expiry=excluded.expiry,status=excluded.status",
                (b.bloodBagId, facility, str(b.expiresAt), b.status),
            )
        note(c, facility, f"{len(body.bags)} data kantong disimpan")
    return {"updated": len(body.bags)}


@api.post("/facilities/{facility}/prc-usage")
def record_usage(facility: str, body: Usage, user: User):
    access(user, facility)
    with db(True) as c:
        for key in body.bloodBagIds:
            result = c.execute(
                "UPDATE bags SET status='USED' WHERE id=? AND facility=? AND status IN ('AVAILABLE','PATIENT_RESERVED')",
                (key, facility),
            )
            require(result.rowcount == 1, "ID tidak tersedia untuk pemakaian")
        c.execute(
            "INSERT INTO usage VALUES(?,?,?) ON CONFLICT(facility,day) DO UPDATE SET qty=qty+excluded.qty",
            (facility, str(DAY), len(body.bloodBagIds)),
        )
        note(c, facility, "Pemakaian tercatat dan stok diperbarui.")
    return {"quantity": len(body.bloodBagIds)}


@api.get("/facilities/{facility}/prc-usage-history")
def usage(facility: str, user: User, period: str = "30d"):
    access(user, facility)
    with db() as c:
        return history(c, facility)[-horizon(period) :]


@api.post("/prc-predictions")
def prediction(body: Forecast, user: User):
    access(user, body.facilityId)
    require(body.facilityId in FACILITIES, "Model tersedia untuk BDRS", 422)
    with db(True) as c:
        output = metrics(c, body.facilityId, horizon(body.period))
        note(
            c,
            user,
            f"Prediksi {body.facilityId} · {output['predictedDemand']} kantong / {body.period}",
        )
        return output


@api.get("/prc-surplus-candidates")
def surplus(user: User, period: str = "30d"):
    return [m for m in dashboard(user, period)["metrics"] if m["potentialSurplus"]]


@api.get("/prc-redistribution/recommendations")
def recommendations(user: User, period: str = "30d"):
    require(user == UDD, "Khusus UDD", 403)
    with db() as c:
        pairs = []
        for a in FACILITIES:
            for b in FACILITIES:
                if a != b:
                    bags = selected(c, a, b, horizon(period))
                    if bags:
                        pairs.append(
                            dict(
                                sourceFacilityId=a,
                                destinationFacilityId=b,
                                bloodBagIds=bags,
                                period=period,
                            )
                        )
        return pairs


@api.post("/prc-redistribution/recommendations")
def proposal(body: Proposal, user: User):
    require(user == UDD, "Khusus UDD", 403)
    with db(True) as c:
        key = create_plan(
            c, body.sourceFacilityId, body.destinationFacilityId, horizon(body.period)
        )
        return detail(c, getplan(c, key))


@api.post("/prc-redistribution/approvals")
def approval(body: Approval, user: User):
    with db(True) as c:
        approve(
            c,
            getplan(c, body.recommendationId),
            user,
            body.approvalStage,
            body.decision,
            body.note,
        )
    flush()
    with db() as c:
        return detail(c, getplan(c, body.recommendationId))


@api.post("/prc-redistribution/handovers")
def transfer(body: Transfer, user: User):
    with db(True) as c:
        handover(
            c, getplan(c, body.orderId), user, body.handoverStage, body.bloodBagIds
        )
    flush()
    with db() as c:
        return detail(c, getplan(c, body.orderId))


@api.post("/prc-redistribution/inspections")
def inspection(body: Inspection, user: User):
    with db(True) as c:
        examine(c, getplan(c, body.orderId), body.items, user)
        return detail(c, getplan(c, body.orderId))


@api.post("/ledger/retry")
def retry(user: User):
    require(user == UDD, "Khusus UDD", 403)
    flush()
    with db() as c:
        return {
            "pending": c.execute(
                "SELECT count(*) FROM events WHERE tx IS NULL"
            ).fetchone()[0]
        }


@api.get("/ledger/verify/{order}/{stage}")
def verify(order: str, stage: str, user: User):
    with db() as c:
        p = getplan(c, order)
        require(user in [UDD, p["src"], p["dst"]], "Akses ditolak", 403)
        e = c.execute(
            "SELECT * FROM events WHERE id=?", (order + "/" + stage,)
        ).fetchone()
        require(e and e["tx"], "Bukti masih menunggu pencatatan")
        try:
            valid = ledger.verify(DATA, e)
        except (OSError, ValueError, KeyError):
            require(False, "Node blockchain belum tersedia", 503)
        return {
            "verified": valid,
            "transactionHash": e["tx"],
            "payload": json.loads(e["payload"]),
        }


@api.post("/prc-stock-notices")
@api.post("/prc-prediction-results")
@api.post("/prc-redistribution/notices")
def callback(body: Notice, x_service_key: Annotated[str, Header()] = ""):
    expected = os.environ.get("PRC_CALLBACK_KEY", "")
    require(
        expected and hmac.compare_digest(expected.encode(), x_service_key.encode()),
        "Callback khusus provider",
        403,
    )
    require(body.facilityId in (*FACILITIES, UDD), "Fasilitas salah", 422)
    with db(True) as c:
        note(c, body.facilityId, body.message)
    return {"received": True}


app.include_router(api)
app.mount("/", StaticFiles(directory=BASE / "web", html=True), name="web")
