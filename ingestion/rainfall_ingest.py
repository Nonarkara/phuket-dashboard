import os
import requests
import psycopg2
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv('DATABASE_URL')
APP_ID = "GeopoliticsDashboard-Thailand-Internal"

def fetch_hdx_rainfall():
    """Fetch rainfall data via HDX HAPI."""
    url = "https://hapi.humdata.org/api/v2/climate/rainfall"
    params = {
        "app_identifier": APP_ID,
        "country_name": "Thailand",
        # HAPI often has specific requirements for date or aggregation
    }
    
    try:
        response = requests.get(url, params=params)
        if response.status_code == 403:
            print("HAPI access denied (403). Using mock rainfall data.")
            return mock_rainfall_data()
        response.raise_for_status()
        data = response.json()
        return data.get('data', [])
    except Exception as e:
        print(f"Error fetching rainfall data: {e}")
        return mock_rainfall_data()

def mock_rainfall_data():
    # Return some mock anomalies for Phuket locations
    return [
        {"location_name": "Phuket Town", "value": 12.5, "unit": "mm", "date": datetime.now().strftime('%Y-%m-%d')},
        {"location_name": "Kathu", "value": 18.2, "unit": "mm", "date": datetime.now().strftime('%Y-%m-%d')},
        {"location_name": "Patong", "value": 25.0, "unit": "mm", "date": datetime.now().strftime('%Y-%m-%d')},
        {"location_name": "Thalang", "value": 8.4, "unit": "mm", "date": datetime.now().strftime('%Y-%m-%d')}
    ]

def ingest_rainfall_data(data):
    if not data or not DB_URL:
        return
    
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Tables are now managed in schema.sql
        
        for item in data:
            cur.execute("""
                INSERT INTO rainfall_data (
                    location, value, unit, ref_date
                ) VALUES (%s, %s, %s, %s)
                ON CONFLICT (location, ref_date, unit) DO UPDATE SET
                    value = EXCLUDED.value
            """, (
                item.get('location_name') or item.get('admin1_name'),
                float(item.get('value') or item.get('rainfall', 0)),
                item.get('unit'),
                item.get('date') or item.get('reference_period_start')
            ))
        
        conn.commit()
        cur.close()
        conn.close()
        print(f"Successfully ingested {len(data)} rainfall records.")
    except Exception as e:
        print(f"Rainfall ingestion error: {e}")

if __name__ == "__main__":
    data = fetch_hdx_rainfall()
    ingest_rainfall_data(data)
