import os
import psycopg2
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv('DATABASE_URL')

def seed_events(cur):
    print("Seeding events...")
    events = [
        ("PHU-SEED-001", datetime.now() - timedelta(hours=2), "Road safety alert", "Accident report", "Patong Hill", 7.8804, 98.3089, 1, "Motorbike crash risk reported on Patong Hill approach."),
        ("PHU-SEED-002", datetime.now() - timedelta(hours=5), "Marine advisory", "Swell warning", "Kamala Coast", 7.9663, 98.2785, 0, "Strong swell and gusts reported off Kamala."),
        ("PHU-SEED-003", datetime.now() - timedelta(days=1), "Flooded roadway", "Water on road", "Khao Lak", 8.6367, 98.2487, 0, "Standing water slowed movement near Khao Lak."),
        ("PHU-SEED-004", datetime.now() - timedelta(days=1, hours=4), "Tourism surge", "Arrival surge", "Phuket Airport", 8.1132, 98.3057, 0, "Arrival demand strengthened ahead of the weekend."),
    ]
    
    for ext_id, date, e_type, sub_type, loc, lat, lng, fatal, notes in events:
        cur.execute("""
            INSERT INTO events (external_id, event_date, event_type, sub_event_type, location, fatalities, notes, geom)
            VALUES (%s, %s, %s, %s, %s, %s, %s, ST_SetSRID(ST_Point(%s, %s), 4326))
            ON CONFLICT (external_id) DO NOTHING;
        """, (ext_id, date, e_type, sub_type, loc, fatal, notes, lng, lat))

def seed_market_data(cur):
    print("Seeding market data...")
    today = datetime.now().date()
    yesterday = today - timedelta(days=1)
    
    markets = [
        ("Tourism", "Hotel Occupancy", 78.4, "%", "Phuket", "Local Research", today),
        ("Tourism", "Hotel Occupancy", 75.2, "%", "Phuket", "Local Research", yesterday),
        ("Mobility", "Airport Arrivals", 53.1, "k", "Phuket", "AOT", today),
        ("Mobility", "Airport Arrivals", 48.4, "k", "Phuket", "AOT", yesterday),
        ("Energy", "Diesel", 32.6, "THB", "Thailand", "EPPO", today),
        ("Energy", "Diesel", 32.2, "THB", "Thailand", "EPPO", yesterday),
        ("FX", "USD/THB", 35.7, "THB", "Thailand", "BOT", today),
        ("FX", "USD/THB", 36.3, "THB", "Thailand", "BOT", yesterday),
    ]
    
    for cat, ind, val, unit, prov, src, date in markets:
        cur.execute("""
            INSERT INTO market_data (category, indicator, value, unit, province, source, ref_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING;
        """, (cat, ind, val, unit, prov, src, date))

def seed_rainfall(cur):
    print("Seeding rainfall data...")
    today = datetime.now().date()
    rainfall = [
        ("Phuket Town", 31.4, "mm", today),
        ("Patong", 42.8, "mm", today),
        ("Khao Lak", 55.2, "mm", today),
        ("Krabi", 24.6, "mm", today),
    ]
    
    for loc, val, unit, date in rainfall:
        cur.execute("""
            INSERT INTO rainfall_data (location, value, unit, ref_date)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (location, ref_date, unit) DO UPDATE SET value = EXCLUDED.value;
        """, (loc, val, unit, date))

def main():
    if not DB_URL:
        print("DATABASE_URL not found in .env")
        return

    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        seed_events(cur)
        seed_market_data(cur)
        seed_rainfall(cur)
        
        conn.commit()
        cur.close()
        conn.close()
        print("Phuket Dashboard seeding completed.")
    except Exception as e:
        print(f"Seeding error: {e}")

if __name__ == "__main__":
    main()
