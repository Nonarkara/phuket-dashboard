import os
import requests
import json

def fetch_and_filter_world_borders():
    url = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
    isos = ["THA", "MMR", "KHM"]
    
    print("Fetching world borders...")
    try:
        response = requests.get(url)
        response.raise_for_status()
        world_geojson = response.json()
        
        filtered_features = [
            f for f in world_geojson['features'] 
            if f['properties'].get('ISO_A3') in isos or f['properties'].get('ADM0_A3') in isos
        ]
        
        merged_geojson = {
            "type": "FeatureCollection",
            "features": filtered_features
        }
        
        output_dir = "public/data"
        os.makedirs(output_dir, exist_ok=True)
        with open(os.path.join(output_dir, "region_borders.geojson"), "w") as f:
            json.dump(merged_geojson, f)
        print(f"Successfully created public/data/region_borders.geojson with {len(filtered_features)} features.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fetch_and_filter_world_borders()
