#!/usr/bin/env python3
"""
TimesFM accident-risk forecast precompute for the Phuket dashboard.

Builds an hourly accident-risk series for Phuket from two real signals:
  1. The THAIRSC time-of-day fatality distribution (diurnal rhythm).
  2. Open-Meteo hourly precipitation (Phuket runs ~8 wet months a year; rain on
     the steep Patong Hill descent is the core crash driver).

It feeds the recent history to Google Research's TimesFM (a 200M-parameter
time-series foundation model) to project the diurnal rhythm forward, then
modulates the forecast by the real Open-Meteo rain FORECAST for the next 48h.
The result is written as a compact static JSON the dashboard reads. No live model
call happens in production — this runs offline (on the M5).

If TimesFM is unavailable, it falls back to a seasonal-naive projection of the
same diurnal rhythm (clearly labelled in the output `model` field).

Run (real model, needs Python 3.10+):
  uv run --python 3.11 --with "timesfm[torch]" --with requests --with numpy \
      python scripts/timesfm-forecast.py
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import numpy as np
import requests

OUT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "public", "data", "phuket-accident-forecast.json"
)

LAT, LON = 7.88, 98.39
PAST_DAYS = 21
HORIZON_HOURS = 48

# THAIRSC time-of-day fatality distribution (% of incidents), per phuket-road-safety.ts.
# Each 4-hour window -> per-hour share.
WINDOWS = [
    (range(2, 6), 7.08),
    (range(6, 10), 18.54),
    (range(10, 14), 18.35),
    (range(14, 18), 23.58),   # PEAK
    (range(18, 22), 21.15),
    ([22, 23, 0, 1], 11.30),
]


def diurnal_per_hour(hour: int) -> float:
    for hours, pct in WINDOWS:
        if hour in hours:
            return pct / 4.0
    return 4.0


def rain_factor(precip_mm: float) -> float:
    # Wet roads on slopes sharply raise motorcycle crash risk.
    return 1.0 + 0.18 * min(max(precip_mm, 0.0), 12.0)


def _parse(h):
    times = [datetime.fromisoformat(t).replace(tzinfo=timezone.utc) for t in h["time"]]
    precip = [float(x or 0.0) for x in h["precipitation"]]
    return times, precip


def fetch_forecast_api():
    """Preferred: real past rain + real 48h rain forecast in one call."""
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={LAT}&longitude={LON}&hourly=precipitation"
        f"&past_days={PAST_DAYS}&forecast_days=2&timezone=UTC"
    )
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return _parse(r.json()["hourly"]), "forecast"


def fetch_archive_api():
    """Fallback (forecast API rate-limited): ERA5 reanalysis of recent past rain."""
    end = (datetime.now(timezone.utc) - timedelta(days=5)).date()
    start = end - timedelta(days=PAST_DAYS)
    url = (
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={LAT}&longitude={LON}"
        f"&start_date={start.isoformat()}&end_date={end.isoformat()}"
        "&hourly=precipitation&timezone=UTC"
    )
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return _parse(r.json()["hourly"]), "archive"


def run_timesfm(history: np.ndarray) -> np.ndarray | None:
    try:
        import timesfm  # noqa
    except Exception as e:  # pragma: no cover
        print(f"TimesFM unavailable ({e}); using seasonal-naive fallback", file=sys.stderr)
        return None
    try:
        # TimesFM 2.0 (500m) torch API — architecture must match the checkpoint:
        # num_layers=50, use_positional_embedding=False.
        tfm = timesfm.TimesFm(
            hparams=timesfm.TimesFmHparams(
                backend="cpu",
                per_core_batch_size=1,
                horizon_len=HORIZON_HOURS,
                num_layers=50,
                use_positional_embedding=False,
                context_len=512,
            ),
            checkpoint=timesfm.TimesFmCheckpoint(
                huggingface_repo_id="google/timesfm-2.0-500m-pytorch"
            ),
        )
        point, _ = tfm.forecast([history.tolist()], freq=[0])
        return np.asarray(point[0][:HORIZON_HOURS], dtype=float)
    except Exception as e:  # pragma: no cover
        print(f"TimesFM forecast failed ({e}); using seasonal-naive fallback", file=sys.stderr)
        return None


def main() -> int:
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    try:
        (times, precip), data_mode = fetch_forecast_api()
        rain_source = "Open-Meteo forecast (real 48h rain)"
    except Exception as e:
        print(f"forecast API unavailable ({e}); using archive reanalysis", file=sys.stderr)
        (times, precip), data_mode = fetch_archive_api()
        rain_source = "Open-Meteo archive ERA5 + hourly climatology"

    # Historical risk proxy series (real diurnal rhythm x real past rain).
    history = np.array(
        [diurnal_per_hour(t.hour) * rain_factor(p) for t, p in zip(times, precip)],
        dtype=float,
    )

    # Future timestamps: next HORIZON_HOURS from now.
    fut_times = [now + timedelta(hours=k + 1) for k in range(HORIZON_HOURS)]

    # Future rain: real forecast if available, else hourly-of-day climatology.
    if data_mode == "forecast":
        precip_by_ts = {t: p for t, p in zip(times, precip)}
        fut_rain = np.array([precip_by_ts.get(t, 0.0) for t in fut_times], dtype=float)
    else:
        clim = {}
        for t, p in zip(times, precip):
            clim.setdefault(t.hour, []).append(p)
        hourly_mean = {h: (sum(v) / len(v) if v else 0.0) for h, v in clim.items()}
        fut_rain = np.array([hourly_mean.get(t.hour, 0.0) for t in fut_times], dtype=float)

    tfm_forecast = run_timesfm(history)
    model = "TimesFM 2.0 (google/timesfm-2.0-500m-pytorch)"
    if tfm_forecast is None or len(tfm_forecast) < HORIZON_HOURS:
        model = "seasonal-naive (TimesFM fallback)"
        base = np.array([diurnal_per_hour(t.hour) for t in fut_times], dtype=float)
    else:
        base = tfm_forecast[:HORIZON_HOURS]

    # Modulate the projected rhythm by the future rain signal.
    risk_raw = np.array(
        [base[k] * rain_factor(float(fut_rain[k])) for k in range(HORIZON_HOURS)], dtype=float
    )

    # Normalize to a 0-100 index against the historical range.
    lo, hi = float(history.min()), float(history.max() * 1.4)
    span = max(hi - lo, 1e-6)
    risk_idx = np.clip((risk_raw - lo) / span * 100.0, 0, 100)

    def band(v: float) -> str:
        return "high" if v >= 66 else "elevated" if v >= 40 else "low"

    points = []
    for k in range(HORIZON_HOURS):
        points.append({
            "ts": fut_times[k].isoformat(),
            "hour": fut_times[k].hour,
            "risk": round(float(risk_idx[k]), 1),
            "rainMm": round(float(fut_rain[k]), 2),
            "band": band(float(risk_idx[k])),
        })

    peak = max(points, key=lambda p: p["risk"])
    out = {
        "generatedAt": now.isoformat(),
        "horizonHours": HORIZON_HOURS,
        "model": model,
        "source": f"THAIRSC time-of-day distribution x {rain_source}",
        "peakWindow": {"ts": peak["ts"], "hour": peak["hour"], "risk": peak["risk"], "rainMm": peak["rainMm"]},
        "points": points,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as fh:
        json.dump(out, fh)
    print(f"Wrote {len(points)}h forecast ({model}); peak risk {peak['risk']} at {peak['hour']:02d}:00 -> {os.path.relpath(OUT_PATH)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
