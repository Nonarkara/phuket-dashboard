#!/usr/bin/env python3
"""
TimesFM accident-risk forecast precompute for the Phuket dashboard.

Builds an hourly accident-risk series for Phuket from two real signals:
  1. The THAIRSC time-of-day fatality distribution (diurnal rhythm).
  2. Open-Meteo hourly precipitation (Phuket runs ~8 wet months a year; rain on
     the steep Patong Hill descent is the core crash driver).

It feeds the recent history to Google Research's TimesFM 2.0 (500M) to project the
diurnal rhythm forward, then modulates by the real Open-Meteo rain forecast.

This version brings two TimesFM superpowers in deeper:
  * PER-CORRIDOR curves — "Patong" / "Old Town" / "Airport north" (matching
    PHUKET_DISTRICTS). The diurnal rhythm is island-wide; corridors differ by how
    much rain amplifies risk, scaled by the corridor's REAL mean slope (SRTM).
    Steep Patong amplifies rain far more than the flat Old Town junctions — so the
    slope (AlphaEarth/SRTM) flows into the forecast.
  * UNCERTAINTY BANDS — riskLow / riskHigh. Uses TimesFM's quantile spread when
    available, else a rain-widened modeled envelope (labelled honestly).

Output is a backward-compatible static JSON (island-wide top-level UNCHANGED, plus
optional bands and a new `corridors` map). No live model call in production.

Run (needs Python 3.10+):
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
BASE_K = 0.18  # island-wide rain sensitivity (unchanged from v1)

# Mean SRTM slope (degrees) of each corridor's blackspots — from phuket-blackspots.ts
# (Patong: 28.9/17.2/5.2/6.6; Old Town: 21.4/1.9/1.9/3.3; Airport north: 4.7/3.3/3.7).
# Drives per-corridor rain sensitivity: steeper corridor -> rain amplifies risk more.
CORRIDOR_SLOPE = {"Patong": 14.5, "Old Town": 7.1, "Airport north": 3.9}
REF_SLOPE = 8.0  # ~island mean; anchors the slope->rain-sensitivity coupling.


def corridor_k(slope_deg: float) -> float:
    return round(BASE_K * min(max(slope_deg / REF_SLOPE, 0.4), 2.2), 4)


# THAIRSC time-of-day fatality distribution (% of incidents), per phuket-road-safety.ts.
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


def rain_factor(precip_mm: float, k: float = BASE_K) -> float:
    return 1.0 + k * min(max(precip_mm, 0.0), 12.0)


def _parse(h):
    times = [datetime.fromisoformat(t).replace(tzinfo=timezone.utc) for t in h["time"]]
    precip = [float(x or 0.0) for x in h["precipitation"]]
    return times, precip


def fetch_forecast_api():
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={LAT}&longitude={LON}&hourly=precipitation"
        f"&past_days={PAST_DAYS}&forecast_days=2&timezone=UTC"
    )
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return _parse(r.json()["hourly"]), "forecast"


def fetch_archive_api():
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


def run_timesfm(history: np.ndarray):
    """Return (point, qspread) where qspread is a per-hour relative uncertainty
    from TimesFM quantiles (or None to signal the modeled-band fallback)."""
    try:
        import timesfm  # noqa
    except Exception as e:
        print(f"TimesFM unavailable ({e}); seasonal-naive fallback", file=sys.stderr)
        return None, None
    try:
        tfm = timesfm.TimesFm(
            hparams=timesfm.TimesFmHparams(
                backend="cpu", per_core_batch_size=1, horizon_len=HORIZON_HOURS,
                num_layers=50, use_positional_embedding=False, context_len=512,
            ),
            checkpoint=timesfm.TimesFmCheckpoint(
                huggingface_repo_id="google/timesfm-2.0-500m-pytorch"
            ),
        )
        out = tfm.forecast([history.tolist()], freq=[0])
        point = np.asarray(out[0][0][:HORIZON_HOURS], dtype=float)
        qspread = None
        try:
            q = np.asarray(out[1])  # [batch, horizon, nq]
            if q.ndim == 3 and q.shape[-1] >= 9:
                qq = q[0, :HORIZON_HOURS, :]
                lo, hi = qq.min(axis=1), qq.max(axis=1)
                mid = np.clip(np.abs(point), 1e-6, None)
                qspread = np.clip((hi - lo) / (2.0 * mid), 0.06, 0.5)
        except Exception:
            qspread = None
        return point, qspread
    except Exception as e:
        print(f"TimesFM forecast failed ({e}); seasonal-naive fallback", file=sys.stderr)
        return None, None


def band(v: float) -> str:
    return "high" if v >= 66 else "elevated" if v >= 40 else "low"


def build_curve(base, fut_times, fut_rain, k, lo, hi, qspread):
    """Modulate base rhythm by rain (sensitivity k), normalize to 0-100, attach band."""
    span = max(hi - lo, 1e-6)
    pts = []
    for j in range(HORIZON_HOURS):
        risk = float(np.clip((base[j] * rain_factor(float(fut_rain[j]), k) - lo) / span * 100.0, 0, 100))
        # uncertainty: TimesFM quantile spread if available, else rain-widened envelope
        rel = float(qspread[j]) if qspread is not None else (0.12 + 0.02 * min(float(fut_rain[j]), 6.0))
        pts.append({
            "ts": fut_times[j].isoformat(),
            "hour": fut_times[j].hour,
            "risk": round(risk, 1),
            "riskLow": round(max(0.0, risk * (1 - rel)), 1),
            "riskHigh": round(min(100.0, risk * (1 + rel)), 1),
            "rainMm": round(float(fut_rain[j]), 2),
            "band": band(risk),
        })
    peak = max(pts, key=lambda p: p["risk"])
    return pts, peak


def main() -> int:
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    try:
        (times, precip), data_mode = fetch_forecast_api()
        rain_source = "Open-Meteo forecast (real 48h rain)"
    except Exception as e:
        print(f"forecast API unavailable ({e}); archive reanalysis", file=sys.stderr)
        (times, precip), data_mode = fetch_archive_api()
        rain_source = "Open-Meteo archive ERA5 + hourly climatology"

    history = np.array(
        [diurnal_per_hour(t.hour) * rain_factor(p) for t, p in zip(times, precip)], dtype=float
    )
    fut_times = [now + timedelta(hours=k + 1) for k in range(HORIZON_HOURS)]

    if data_mode == "forecast":
        precip_by_ts = {t: p for t, p in zip(times, precip)}
        fut_rain = np.array([precip_by_ts.get(t, 0.0) for t in fut_times], dtype=float)
    else:
        clim = {}
        for t, p in zip(times, precip):
            clim.setdefault(t.hour, []).append(p)
        hourly_mean = {h: (sum(v) / len(v) if v else 0.0) for h, v in clim.items()}
        fut_rain = np.array([hourly_mean.get(t.hour, 0.0) for t in fut_times], dtype=float)

    tfm_point, qspread = run_timesfm(history)
    band_kind = "TimesFM quantile band" if qspread is not None else "modeled band"
    if tfm_point is None or len(tfm_point) < HORIZON_HOURS:
        model = f"seasonal-naive (TimesFM fallback) · {band_kind}"
        base = np.array([diurnal_per_hour(t.hour) for t in fut_times], dtype=float)
    else:
        model = f"TimesFM 2.0 (google/timesfm-2.0-500m-pytorch) · {band_kind}"
        base = tfm_point[:HORIZON_HOURS]

    # Shared normalization range (island history) — keeps corridors comparable.
    lo, hi = float(history.min()), float(history.max() * 1.4)

    # Island-wide curve (k = BASE_K, unchanged) — the back-compatible top level.
    points, peak = build_curve(base, fut_times, fut_rain, BASE_K, lo, hi, qspread)

    # Per-corridor curves — same rhythm, slope-scaled rain sensitivity.
    corridors = {}
    for name, slope in CORRIDOR_SLOPE.items():
        k = corridor_k(slope)
        c_pts, c_peak = build_curve(base, fut_times, fut_rain, k, lo, hi, qspread)
        corridors[name] = {
            "slopeDeg": slope,
            "rainSensitivity": k,
            "peak": c_peak,
            "points": c_pts,
        }

    out = {
        "generatedAt": now.isoformat(),
        "horizonHours": HORIZON_HOURS,
        "model": model,
        "source": f"THAIRSC time-of-day distribution x {rain_source} x SRTM corridor slope",
        "peakWindow": peak,
        "points": points,
        "corridors": corridors,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as fh:
        json.dump(out, fh)
    cs = " · ".join(f"{n} peak {c['peak']['risk']}@{c['peak']['hour']:02d}h (k={c['rainSensitivity']})" for n, c in corridors.items())
    print(f"Wrote {len(points)}h forecast ({model}); island peak {peak['risk']}@{peak['hour']:02d}h")
    print(f"  corridors: {cs}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
