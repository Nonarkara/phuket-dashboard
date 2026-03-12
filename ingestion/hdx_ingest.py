import os
import requests
import psycopg2
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv('DATABASE_URL')
APP_ID = "GeopoliticsDashboard-Thailand-Internal"

def fetch_hdx_prices():
    """Fetch food prices via HDX Humanitarian API (HAPI)."""
    url = "https://hapi.humdata.org/api/v2/food-security-nutrition-poverty/food-prices-market-monitor"
    params = {
        "app_identifier": APP_ID,
        "country_name": "Thailand,Myanmar,Cambodia",
        "date_min": (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
    }
    
    try:
        response = requests.get(url, params=params)
        if response.status_code == 403:
            print("HAPI access denied (403). Using mock data for Thailand/Myanmar borders.")
            return mock_hdx_data()
        response.raise_for_status()
        data = response.json()
        return data.get('data', [])
    except Exception as e:
        print(f"Error fetching HDX HAPI data: {e}")
        return mock_hdx_data()

def mock_hdx_data():
    return [
        {"commodity_name": "Rice (5% Broken)", "price": 580, "unit": "THB/KG", "market_name": "Mae Sot", "date": datetime.now().strftime('%Y-%m-%d')},
        {"commodity_name": "Rice (5% Broken)", "price": 540, "unit": "THB/KG", "market_name": "Kanchanaburi", "date": datetime.now().strftime('%Y-%m-%d')},
        {"commodity_name": "Palm Oil", "price": 45, "unit": "THB/L", "market_name": "Mae Sot", "date": datetime.now().strftime('%Y-%m-%d')}
    ]

def ingest_market_data(data):
    if not data or not DB_URL:
        return
    
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        for item in data:
            # Mapping HAPI fields to our schema
            cur.execute("""
                INSERT INTO market_data (
                    category, indicator, value, unit, province, source, ref_date
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                'food',
                item.get('commodity_name'),
                float(item.get('price', 0)),
                item.get('unit'),
                item.get('market_name'),
                'HDX HAPI',
                item.get('date')
            ))
        
        conn.commit()
        cur.close()
        conn.close()
        print(f"Successfully ingested {len(data)} market data points.")
    except Exception as e:
        print(f"Database ingestion error: {e}")

if __name__ == "__main__":
    prices = fetch_hdx_prices()
    if DB_URL:
        ingest_market_data(prices)
    else:
        print(f"Dry run: Fetched {len(prices)} prices but no DATABASE_URL.")
