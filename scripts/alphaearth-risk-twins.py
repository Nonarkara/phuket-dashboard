#!/usr/bin/env python3
"""
AlphaEarth "Risk Twins" precompute — embedding-similarity discovery.

The deeper AlphaEarth superpower: the 64-band Satellite Embedding is L2-normalized,
so a dot product between two pixels' vectors IS their cosine similarity. For each
KNOWN high-severity accident blackspot we sample its embedding signature, then find
every place on Phuket whose fabric is most similar — the "risk twins": corridors
that look like a known death-corridor but aren't flagged yet. Find them before they
become blackspots.

Runs OFFLINE (Earth Engine, authenticated locally). No live call in production —
the dashboard reads the static public/data/phuket-risk-twins.geojson.

Attribution (CC-BY 4.0): AlphaEarth Foundations Satellite Embedding —
Google / Google DeepMind.

Run:  python3 scripts/alphaearth-risk-twins.py
"""
import json
import os
import sys

import ee

OUT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "public", "data", "phuket-risk-twins.geojson"
)

PHUKET_BBOX = [98.255, 7.735, 98.435, 8.205]
THRESHOLD = 0.90       # cosine-similarity floor — tightened for fewer, sharper twins
VECTOR_SCALE = 200     # m — coarse vectorize merges adjacent pixels
EXCLUDE_BUFFER_M = 800  # don't let a blackspot match its own neighborhood
TWIN_COLOR = "#ef4444"  # all sources are high-severity → tactical red

# High-severity blackspots (severity:"high" in phuket-blackspots.ts): id, lng, lat.
HIGH_SEVERITY = [
    ("patong-hill-summit", 98.3253, 7.9087),
    ("patong-hill-west", 98.318, 7.905),
    ("samkong-intersection", 98.378, 7.9),
    ("chalong-circle", 98.339, 7.847),
    ("heroines-monument", 98.364, 7.993),
]


def load_embedding(region):
    col = ee.ImageCollection("GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL").filterBounds(region)
    for year in (2025, 2024, 2023):
        candidate = col.filterDate(f"{year}-01-01", f"{year + 1}-01-01").first()
        if candidate.getInfo() is not None:
            print(f"Using AlphaEarth embedding year {year}")
            return ee.Image(candidate).clip(region)
    return None


def twin_features(img, band_names, region, bid, lng, lat):
    """Return GeoJSON features: dissolved zones whose embedding ~ this blackspot's
    signature. Adjacent qualifying polygons are merged into clean connected shapes,
    so the count is distinct twin AREAS, not pixel fragments."""
    pt = ee.Geometry.Point([lng, lat])
    # Reference signature: the 64-d embedding at the blackspot, as a band-aligned image.
    ref_dict = img.reduceRegion(reducer=ee.Reducer.first(), geometry=pt, scale=10, bestEffort=True)
    ref_image = ref_dict.toImage(band_names)
    # Unit-norm vectors -> dot product == cosine similarity.
    dot = img.multiply(ref_image).reduce(ee.Reducer.sum()).rename("similarity")

    # Threshold and exclude the source's own neighborhood.
    keep = dot.gte(THRESHOLD)
    inside = ee.Image.constant(1).clip(pt.buffer(EXCLUDE_BUFFER_M)).mask()
    masked = keep.updateMask(keep).updateMask(inside.Not())

    vectors = masked.selfMask().reduceToVectors(
        geometry=region, scale=VECTOR_SCALE, geometryType="polygon",
        maxPixels=1e9, bestEffort=True,
    )
    # Dissolve touching polygons into clean connected shapes.
    dissolved = vectors.geometry().dissolve(maxError=30)
    gj = dissolved.getInfo()
    if not gj:
        return []
    if gj["type"] == "Polygon":
        polys = [gj["coordinates"]]
    elif gj["type"] == "MultiPolygon":
        polys = gj["coordinates"]
    else:
        polys = []

    out = []
    for poly in polys:
        out.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": poly},
            "properties": {"blackspotId": bid, "color": TWIN_COLOR},
        })
    return out


def main() -> int:
    ee.Initialize()
    region = ee.Geometry.Rectangle(PHUKET_BBOX)
    img = load_embedding(region)
    if img is None:
        print("ERROR: no AlphaEarth embedding image found for Phuket", file=sys.stderr)
        return 1
    band_names = img.bandNames()

    all_feats = []
    for bid, lng, lat in HIGH_SEVERITY:
        feats = twin_features(img, band_names, region, bid, lng, lat)
        print(f"  {bid}: {len(feats)} twin zones")
        all_feats.extend(feats)

    out = {
        "type": "FeatureCollection",
        "attribution": "AlphaEarth Foundations Satellite Embedding — Google / Google DeepMind (CC-BY 4.0)",
        "features": all_feats,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as fh:
        json.dump(out, fh)
    print(f"Wrote {len(all_feats)} risk-twin zones across {len(HIGH_SEVERITY)} blackspots -> {os.path.relpath(OUT_PATH)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
