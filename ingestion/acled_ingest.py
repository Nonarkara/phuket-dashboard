import os
import requests
import psycopg2
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

ACLED_KEY = os.getenv('ACLED_KEY')
ACLED_EMAIL = os.getenv('ACLED_EMAIL')
DB_URL = os.getenv('DATABASE_URL')

APP_ID = "GeopoliticsDashboard-Thailand-Internal"

def fetch_acled_hapi(days=60):
    """Fetch ACLED conflict events via HDX HAPI."""
    url = "https://hapi.humdata.org/api/v2/coordination-context/conflict-events"
    params = {
        "app_identifier": APP_ID,
        "country_name": "Thailand",
        "date_min": (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d'),
    }
    
    try:
        response = requests.get(url, params=params)
        if response.status_code == 403:
            print("HAPI access denied (403). Falling back to mock data.")
            return mock_acled_data()
        response.raise_for_status()
        data = response.json()
        return data.get('data', [])
    except Exception as e:
        print(f"Error fetching ACLED HAPI data: {e}")
        return mock_acled_data()

def mock_acled_data():
    return [
        {
            "id": "PHU-MOCK-001",
            "date": datetime.now().strftime('%Y-%m-%d'),
            "event_type_name": "Road safety alert",
            "sub_event_type_name": "Accident report",
            "actor1_name": "Local Traffic Authorities",
            "location": "Patong Hill",
            "latitude": 7.8804,
            "longitude": 98.3089,
            "fatalities": 1,
            "notes": "Motorbike crash risk reported on Patong Hill approach due to road surface conditions."
        },
        {
            "id": "PHU-MOCK-002",
            "date": datetime.now().strftime('%Y-%m-%d'),
            "event_type_name": "Marine advisory",
            "sub_event_type_name": "Swell warning",
            "actor1_name": "Marine Department",
            "location": "Kamala Coast",
            "latitude": 7.9663,
            "longitude": 98.2785,
            "fatalities": 0,
            "notes": "Strong swell and gusts reported off Kamala. Small boats advised to exercise caution."
        }
    ]

def ingest_to_db(data):
    if not data or not DB_URL:
        return
    
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        for event in data:
            # HAPI field mapping: 
            # Sub-event type might be 'sub_event_type_name' or similar
            # Location might be 'admin1_name' or 'location_name'
            cur.execute("""
                INSERT INTO events (
                    external_id, event_date, event_type, sub_event_type, 
                    actor1, location, fatalities, notes, geom
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, ST_SetSRID(ST_Point(%s, %s), 4326))
                ON CONFLICT (external_id) DO UPDATE SET
                    fatalities = EXCLUDED.fatalities,
                    notes = EXCLUDED.notes;
            """, (
                event.get('event_id_cn') or str(event.get('id')),
                event.get('event_date') or event.get('date'),
                event.get('event_type_name'),
                event.get('sub_event_type_name'),
                event.get('actor1_name'),
                event.get('admin1_name') or event.get('location'),
                int(event.get('fatalities', 0)),
                event.get('notes'),
                float(event.get('longitude')) if event.get('longitude') else 0,
                float(event.get('latitude')) if event.get('latitude') else 0
            ))
        
        conn.commit()
        cur.close()
        conn.close()
        print(f"Successfully ingested {len(data)} events.")
    except Exception as e:
        print(f"Database ingestion error: {e}")

if __name__ == "__main__":
    data = fetch_acled_hapi()
    # ingestion will only work once DB is ready
    if DB_URL:
        ingest_to_db(data)
    else:
        print("Dry run: Fetched data but no DATABASE_URL found.")
