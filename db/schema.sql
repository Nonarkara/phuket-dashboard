-- Extension for spatial data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Events Table (ACLED/RSS)
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    external_id TEXT UNIQUE,
    event_date DATE NOT NULL,
    event_type TEXT,
    sub_event_type TEXT,
    actor1 TEXT,
    actor2 TEXT,
    location TEXT,
    fatalities INTEGER DEFAULT 0,
    notes TEXT,
    severity_score FLOAT DEFAULT 0,
    geom GEOMETRY(Point, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS events_geom_idx ON events USING GIST(geom);
CREATE INDEX IF NOT EXISTS events_date_idx ON events(event_date);

-- Market Data (HDX/Exchange Rates)
CREATE TABLE IF NOT EXISTS market_data (
    id SERIAL PRIMARY KEY,
    category TEXT,
    indicator TEXT,
    value FLOAT NOT NULL,
    unit TEXT,
    province TEXT,
    source TEXT,
    ref_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS market_date_idx ON market_data(ref_date);
CREATE INDEX IF NOT EXISTS market_cat_idx ON market_data(category);

-- Fire Events (NASA FIRMS)
CREATE TABLE IF NOT EXISTS fire_events (
    id SERIAL PRIMARY KEY,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    brightness FLOAT,
    confidence TEXT,
    acq_date DATE NOT NULL,
    geom GEOMETRY(Point, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (latitude, longitude, brightness, confidence, acq_date)
);

CREATE INDEX IF NOT EXISTS fire_events_date_idx ON fire_events(acq_date);
CREATE INDEX IF NOT EXISTS fire_events_geom_idx ON fire_events USING GIST(geom);

-- Rainfall Data (HDX HAPI)
CREATE TABLE IF NOT EXISTS rainfall_data (
    id SERIAL PRIMARY KEY,
    location TEXT NOT NULL,
    value FLOAT NOT NULL,
    unit TEXT,
    ref_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (location, ref_date, unit)
);

CREATE INDEX IF NOT EXISTS rainfall_date_idx ON rainfall_data(ref_date);

-- Population Movements / Refugees (HDX HAPI)
CREATE TABLE IF NOT EXISTS population_movements (
    id SERIAL PRIMARY KEY,
    origin_country TEXT NOT NULL,
    asylum_country TEXT NOT NULL,
    population_type TEXT NOT NULL,
    count INTEGER NOT NULL,
    ref_year INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (origin_country, asylum_country, population_type, ref_year)
);

CREATE INDEX IF NOT EXISTS population_movements_year_idx ON population_movements(ref_year);

-- Environmental Proxies (VIIRS/Sentinel)
CREATE TABLE IF NOT EXISTS env_proxies (
    id SERIAL PRIMARY KEY,
    proxy_type TEXT,
    value FLOAT,
    location TEXT,
    geom GEOMETRY(Geometry, 4326),
    ref_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Air quality snapshots for longitudinal AQI / PM2.5 tracking
CREATE TABLE IF NOT EXISTS air_quality_snapshots (
    id SERIAL PRIMARY KEY,
    location TEXT NOT NULL,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    aqi INTEGER NOT NULL,
    pm25 FLOAT NOT NULL,
    category TEXT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    source TEXT NOT NULL DEFAULT 'Open-Meteo Air Quality',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source, location, observed_at)
);

CREATE INDEX IF NOT EXISTS air_quality_location_idx ON air_quality_snapshots(location);
CREATE INDEX IF NOT EXISTS air_quality_observed_idx ON air_quality_snapshots(observed_at DESC);

-- Country-level macro snapshots for annual GDP comparisons
CREATE TABLE IF NOT EXISTS macro_country_snapshots (
    id SERIAL PRIMARY KEY,
    country_code TEXT NOT NULL,
    country TEXT NOT NULL,
    gdp_usd DOUBLE PRECISION NOT NULL,
    gdp_per_capita_usd DOUBLE PRECISION NOT NULL,
    gdp_year INTEGER NOT NULL,
    gdp_per_capita_year INTEGER NOT NULL,
    source TEXT NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (country_code, gdp_year, gdp_per_capita_year, source)
);

CREATE INDEX IF NOT EXISTS macro_country_code_idx ON macro_country_snapshots(country_code);
CREATE INDEX IF NOT EXISTS macro_country_captured_idx ON macro_country_snapshots(captured_at DESC);

-- Country-level indicator history for ASEAN sidebar profiles
CREATE TABLE IF NOT EXISTS country_economic_indicators (
    id SERIAL PRIMARY KEY,
    country_code TEXT NOT NULL,
    country TEXT NOT NULL,
    indicator_code TEXT NOT NULL,
    indicator_label TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit TEXT,
    ref_year INTEGER NOT NULL,
    source TEXT NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (country_code, indicator_code, ref_year, source)
);

CREATE INDEX IF NOT EXISTS country_economic_code_idx ON country_economic_indicators(country_code);
CREATE INDEX IF NOT EXISTS country_economic_indicator_idx ON country_economic_indicators(indicator_code);
CREATE INDEX IF NOT EXISTS country_economic_captured_idx ON country_economic_indicators(captured_at DESC);

-- Normalized intelligence items cache
CREATE TABLE IF NOT EXISTS intelligence_items_cache (
    id SERIAL PRIMARY KEY,
    item_id TEXT UNIQUE NOT NULL,
    package_id TEXT NOT NULL,
    source_label TEXT NOT NULL,
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    url TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    severity TEXT NOT NULL,
    score FLOAT NOT NULL,
    kind TEXT NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS intelligence_items_package_idx ON intelligence_items_cache(package_id);
CREATE INDEX IF NOT EXISTS intelligence_items_published_idx ON intelligence_items_cache(published_at DESC);

-- Cached package snapshots
CREATE TABLE IF NOT EXISTS intelligence_package_snapshots (
    id SERIAL PRIMARY KEY,
    package_id TEXT UNIQUE NOT NULL,
    snapshot JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'live',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS intelligence_package_updated_idx ON intelligence_package_snapshots(updated_at DESC);

-- Source health and refresh state
CREATE TABLE IF NOT EXISTS intelligence_source_health (
    id SERIAL PRIMARY KEY,
    source_id TEXT UNIQUE NOT NULL,
    source_label TEXT NOT NULL,
    url TEXT NOT NULL,
    status TEXT NOT NULL,
    checked_at TIMESTAMPTZ NOT NULL,
    response_time_ms INTEGER,
    message TEXT
);

CREATE INDEX IF NOT EXISTS intelligence_source_checked_idx ON intelligence_source_health(checked_at DESC);
