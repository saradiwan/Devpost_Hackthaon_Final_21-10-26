
"""DesalGuard API: synthetic ML demo + real public USGS water observations."""

from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import json

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.ensemble import IsolationForest

app = FastAPI(
    title="DesalGuard ML API",
    version="1.2.0",
    description="Synthetic desalination anomaly demo with public USGS water data",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Synthetic training data: this model is not trained on river measurements.
rng = np.random.default_rng(41)
normal = np.column_stack([
    rng.normal(5.15, 0.22, 1600),
    rng.normal(128, 7, 1600),
    rng.normal(420, 28, 1600),
])

model = IsolationForest(
    n_estimators=120,
    contamination=0.035,
    random_state=41,
)
model.fit(normal)


class Telemetry(BaseModel):
    pressure: float = Field(ge=0, le=30)
    flow: float = Field(ge=0, le=1000)
    salinity: float = Field(ge=0, le=10000)
    timestamp: str | None = None


@app.get("/")
def root():
    return {
        "service": "DesalGuard",
        "status": "ok",
        "endpoints": ["/health", "/predict", "/live-water"],
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": "IsolationForest",
        "model_data": "synthetic baseline",
        "live_data": "USGS latest continuous streamflow",
    }


@app.post("/predict")
def predict(d: Telemetry):
    features = np.array([[d.pressure, d.flow, d.salinity]])
    raw = float(model.decision_function(features)[0])
    score = float(np.clip(0.5 - raw, 0, 1))
    anomaly = bool(model.predict(features)[0] == -1)

    return {
        "anomaly": anomaly,
        "score": round(score, 4),
        "prediction": "ANOMALY" if anomaly else "NORMAL",
        "model": "IsolationForest",
        "timestamp": d.timestamp,
        "note": "Synthetic desalination-like telemetry only. An anomaly is not proof of an attack.",
    }


@app.get("/live-water")
def live_water():
    """Fetch the latest available USGS streamflow observation.

    This is real river data from the United States, not desalination
    plant telemetry. Actual reporting delays depend on the station.
    """
    url = (
        "https://api.waterdata.usgs.gov/ogcapi/v1/"
        "collections/latest-continuous/items"
        "?monitoring_location_id=USGS-01646500"
        "&parameter_code=00060&limit=10&f=json"
    )

    request = Request(
        url,
        headers={
            "Accept": "application/geo+json, application/json",
            "User-Agent": "DesalGuard-Hackathon-Demo/1.2",
        },
    )

    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"USGS data is temporarily unavailable ({type(exc).__name__}).",
        ) from exc

    features = payload.get("features", [])
    usable = []

    for feature in features:
        props = feature.get("properties") or {}
        try:
            value = float(props.get("value"))
        except (TypeError, ValueError):
            continue

        if np.isfinite(value):
            usable.append((props, value))

    if not usable:
        raise HTTPException(
            status_code=503,
            detail="No numeric streamflow observation was returned by USGS.",
        )

    props, value = max(
        usable,
        key=lambda item: str(item[0].get("time") or ""),
    )

    return {
        "status": "ok",
        "source": "USGS Water Data API",
        "source_url": "https://api.waterdata.usgs.gov/",
        "location_id": props.get(
            "monitoring_location_id", "USGS-01646500"
        ),
        "location_name": "Potomac River at Little Falls, United States",
        "parameter": "Streamflow / discharge",
        "parameter_code": props.get("parameter_code", "00060"),
        "value": value,
        "unit": props.get("unit_of_measure", "ft³/s"),
        "observed_at": props.get("time"),
        "last_modified": props.get("last_modified"),
        "approval_status": props.get("approval_status"),
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "note": (
            "Real public river observation; not plant telemetry. "
            "Not used by the synthetic Isolation Forest model."
        ),
    }
