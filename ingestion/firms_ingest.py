import os
import requests
import psycopg2
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv('DATABASE_URL')
# NASA FIRMS API requires a map_key
FIRMS_KEY = os.getenv('FIRMS_KEY', 'your_firms_key_here')

def fetch_firms_data(area="Thailand"):
    """Fetch fire data from NASA FIRMS (VIIRS/MODIS)."""
    # Using the CSV API for simplicity, or JSON if preferred
    # Area bounding box for Thailand roughly: 97, 5, 106, 21
    url = f"https://firms.modaps.eosdis.nasa.gov/api/country/csv/{FIRMS_KEY}/VIIRS_SNPP/THA/1"
    
    if FIRMS_KEY == 'your_firms_key_here':
        print("Warning: No FIRMS_KEY. Using mock data.")
        return mock_firms_data()

    try:
        response = requests.get(url)
        response.raise_for_status()
        import csv
        from io import StringIO
        f = StringIO(response.text)
        reader = csv.DictReader(f)
        return list(reader)
    except Exception as e:
        print(f"Error fetching FIRMS data: {e}")
        return mock_firms_data()

def mock_firms_data():
    return [
        {
            "latitude": "7.8804",
            "longitude": "98.3923",
            "bright_ti4": "310.5",
            "acq_date": datetime.now().strftime('%Y-%m-%d'),
            "acq_time": "0400",
            "confidence": "nominal"
        },
        {
            "latitude": "8.1132",
            "longitude": "98.3057",
            "bright_ti4": "308.2",
            "acq_date": datetime.now().strftime('%Y-%m-%d'),
            "acq_time": "1230",
            "confidence": "low"
        }
    ]

def ingest_firms_data(data):
    if not data or not DB_URL:
        return
    
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Tables are now managed in schema.sql
        
        for item in data:
            lat = float(item.get('latitude'))
            lng = float(item.get('longitude'))
            cur.execute("""
                INSERT INTO fire_events (
                    latitude, longitude, brightness, confidence, acq_date, geom
                ) VALUES (%s, %s, %s, %s, %s, ST_SetSRID(ST_Point(%s, %s), 4326))
                ON CONFLICT (latitude, longitude, brightness, confidence, acq_date) DO NOTHING
            """, (
                lat, lng,
                float(item.get('bright_ti4', 0)),
                item.get('confidence'),
                item.get('acq_date'),
                lng, lat
            ))
        
        conn.commit()
        cur.close()
        conn.close()
        print(f"Successfully ingested {len(data)} fire events.")
    except Exception as e:
        print(f"FIRMS ingestion error: {e}")

if __name__ == "__main__":
    data = fetch_firms_data()
    ingest_firms_data(data)
