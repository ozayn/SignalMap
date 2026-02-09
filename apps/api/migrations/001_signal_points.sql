-- Signal time series storage for cron-ready ingestion
-- Created automatically by init_tables() when DATABASE_URL is set.
-- Unique constraint: one row per (signal_key, date).

CREATE TABLE IF NOT EXISTS signal_points (
    signal_key TEXT NOT NULL,
    date TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    source TEXT NOT NULL,
    confidence DOUBLE PRECISION,
    metadata JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (signal_key, date)
);
