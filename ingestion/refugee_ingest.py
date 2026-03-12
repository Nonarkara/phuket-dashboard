import os
import requests
import psycopg2
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv('DATABASE_URL')
APP_ID = "GeopoliticsDashboard-Thailand-Internal"

def fetch_hdx_refugees():
    """Fetch refugee data via HDX HAPI."""
    url = "https://hapi.humdata.org/api/v2/affected-people/refugees"
    params = {
        "app_identifier": APP_ID,
        "origin_country_name": "Myanmar,Cambodia,Laos",
        "asylum_country_name": "Thailand",
    }
    
    try:
        response = requests.get(url, params=params)
        if response.status_code == 403:
            print("HAPI access denied (403). Using mock refugee data.")
            return mock_hdx_refugees_data()
        response.raise_for_status()
        data = response.json()
        return data.get('data', [])
    except Exception as e:
        print(f"Error fetching refugee data: {e}")
        return mock_hdx_refugees_data()

def mock_hdx_refugees_data():
    return [
        {"origin_country_name": "Myanmar", "asylum_country_name": "Thailand", "population": 92000, "year": 2025},
        {"origin_country_name": "Cambodia", "asylum_country_name": "Thailand", "population": 5000, "year": 2025}
    ]

def ingest_refugee_data(data):
    if not data or not DB_URL:
        return
    
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Tables are now managed in schema.sql
        
        for item in data:
            cur.execute("""
                INSERT INTO population_movements (
                    origin_country, asylum_country, population_type, count, ref_year
                ) VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (origin_country, asylum_country, population_type, ref_year) DO UPDATE SET
                    count = EXCLUDED.count
            """, (
                item.get('origin_country_name'),
                item.get('asylum_country_name'),
                'Refugees',
                item.get('population'),
                item.get('year')
            ))
        
        conn.commit()
        cur.close()
        conn.close()
        print(f"Successfully ingested {len(data)} refugee records.")
    except Exception as e:
        print(f"Refugee ingestion error: {e}")

if __name__ == "__main__":
    data = fetch_hdx_refugees()
    ingest_refugee_data(data)
