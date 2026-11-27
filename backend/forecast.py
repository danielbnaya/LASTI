"""Regresi kuadrat terkecil dengan satu kategori per hari dalam minggu."""
from datetime import date, timedelta
from statistics import fmean

DAY = date(2026, 11, 25)
FACILITIES = ("BDRS-001", "BDRS-002", "BDRS-003")
UDD = "UDD-001"
RESERVE = 5


def fit_weekdays(history):
    # Dengan indikator hari, solusi kuadrat terkecil untuk setiap kategori
    # adalah rata-rata respons semua observasi dalam kategori tersebut.
    groups = [[] for _ in range(7)]
    for weekday, quantity in history:
        groups[weekday].append(quantity)
    overall = fmean(quantity for _, quantity in history)
    return [fmean(group) if group else overall for group in groups]


def predict(rows, horizon):
    history = [(date.fromisoformat(row["day"]).weekday(), row["qty"]) for row in rows]
    train, test = history[:-14], history[-14:]
    fitted = fit_weekdays(train)
    mae = fmean(abs(quantity - fitted[day]) for day, quantity in test)
    average = fmean(quantity for _, quantity in train)
    baseline = fmean(abs(quantity - average) for _, quantity in test)

    fitted = fit_weekdays(history)
    daily = [fitted[(DAY + timedelta(days=i)).weekday()] for i in range(1, horizon + 1)]
    return dict(
        predictedDemand=int(round(sum(daily))),
        daily=daily,
        mae=round(mae, 3),
        baseline=round(baseline, 3),
        train=len(train),
        test=len(test),
    )
