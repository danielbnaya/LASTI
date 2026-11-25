from datetime import date, timedelta
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error

DAY = date(2026, 11, 25)
FACILITIES = ("BDRS-001", "BDRS-002", "BDRS-003")
UDD = "UDD-001"
RESERVE = 5


def features(days):
    return np.array([[int(day.weekday() == w) for w in range(1, 7)] for day in days])


def predict(rows, horizon):
    days = [date.fromisoformat(r["day"]) for r in rows]
    y = np.array([r["qty"] for r in rows])
    X = features(days)
    split = len(y) - 14
    model = LinearRegression().fit(X[:split], y[:split])
    error = mean_absolute_error(y[split:], np.maximum(0, model.predict(X[split:])))
    baseline = mean_absolute_error(y[split:], np.full(14, y[:split].mean()))
    model.fit(X, y)
    future = [DAY + timedelta(days=i) for i in range(1, horizon + 1)]
    values = np.maximum(0, model.predict(features(future)))
    return dict(
        predictedDemand=int(round(sum(values))),
        daily=values.tolist(),
        mae=round(float(error), 3),
        baseline=round(float(baseline), 3),
        train=split,
        test=14,
    )
