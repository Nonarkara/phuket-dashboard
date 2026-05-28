#!/usr/bin/env python3
"""
AlphaEarth urban-fabric precompute for the Phuket dashboard.

Loads Google DeepMind's AlphaEarth Foundations "Satellite Embedding" dataset
(GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL — 64-band, 10 m, annual) for Phuket,
runs unsupervised k-means over the embedding vectors to segment the island into
urban-fabric / land-cover classes, vectorizes the result, and writes a compact
GeoJSON the dashboard ships as a static map layer.

This runs OFFLINE (on the M5). No live Earth Engine call happens in production —
the dashboard only reads the resulting public/data/phuket-urban-fabric.geojson.

Attribution (required, CC-BY 4.0):
  "The AlphaEarth Foundations Satellite Embedding dataset is produced by
   Google and Google DeepMind."

Run:  python3 scripts/alphaearth-urban-fabric.py
"""
import json
import os
import sys

import ee

OUT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "public", "data", "phuket-urban-fabric.geojson"
)

# Phuket island bounding box [west, south, east, north]
PHUKET_BBOX = [98.255, 7.735, 98.435, 8.205]

N_CLASSES = 6
VECTOR_SCALE = 150   # m — coarse enough to keep the GeoJSON small and the map fast
SAMPLE_SCALE = 30
SAMPLE_POINTS = 2000

# Stable color ramp for the unsupervised classes (one accent family per class).
# Order is assigned post-hoc by inspecting cluster centroids if needed; for the
# unsupervised pass we ship a fixed legible palette.
CLASS_COLORS = [
    "#1e7896",  # 0 teal
    "#d47a1e",  # 1 amber (dense urban tends here)
    "#3f7d3f",  # 2 green (vegetation)
    "#2b5e8c",  # 3 blue (water / wet)
    "#8a8f98",  # 4 gray (bare / cleared)
    "#b54a4a",  # 5 red (high-density built)
]


def main() -> int:
    ee.Initialize()
    region = ee.Geometry.Rectangle(PHUKET_BBOX)

    col = ee.ImageCollection("GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL").filterBounds(region)
    # Prefer the most recent available annual embedding.
    img = None
    for year in (2025, 2024, 2023):
        candidate = col.filterDate(f"{year}-01-01", f"{year + 1}-01-01").first()
        if candidate.getInfo() is not None:
            img = ee.Image(candidate).clip(region)
            print(f"Using AlphaEarth embedding year {year}")
            break
    if img is None:
        print("ERROR: no AlphaEarth embedding image found for Phuket", file=sys.stderr)
        return 1

    bands = img.bandNames()

    # Train unsupervised k-means on a sample of embedding vectors.
    training = img.sample(
        region=region, scale=SAMPLE_SCALE, numPixels=SAMPLE_POINTS, geometries=False
    )
    clusterer = ee.Clusterer.wekaKMeans(N_CLASSES).train(training, inputProperties=bands)
    classified = img.cluster(clusterer).rename("class")

    # Vectorize at a coarse scale to keep the output compact.
    vectors = classified.reduceToVectors(
        geometry=region,
        scale=VECTOR_SCALE,
        geometryType="polygon",
        labelProperty="class",
        maxPixels=1e9,
        bestEffort=True,
    )

    fc = vectors.getInfo()
    feats = fc.get("features", [])
    for f in feats:
        cls = int(f["properties"].get("class", 0))
        f["properties"]["color"] = CLASS_COLORS[cls % len(CLASS_COLORS)]
        f["properties"]["attribution"] = (
            "AlphaEarth Foundations Satellite Embedding — Google / Google DeepMind"
        )

    out = {
        "type": "FeatureCollection",
        "attribution": "AlphaEarth Foundations Satellite Embedding — Google / Google DeepMind (CC-BY 4.0)",
        "features": feats,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as fh:
        json.dump(out, fh)
    print(f"Wrote {len(feats)} urban-fabric polygons -> {os.path.relpath(OUT_PATH)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
