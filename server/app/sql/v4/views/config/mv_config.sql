-- Materialized View: mv_config
-- Runtime inference configuration data.
--
-- Grain: One row per config_entry.id
-- Filter: active = TRUE only
--
-- Purpose: Provides inference configuration (agent, model, provider) for parallel fetching
-- Dependencies: Uses config_entry and config_*_connection tables (agents, models, providers)
-- ============================================================================
-- Step 1: Drop all indexes on mv_config materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_config'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_config materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_config CASCADE;

-- ============================================================================
-- Step 3: Create mv_config Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_config AS
WITH
-- Get agents_id per config (singular - first active)
agents_agg AS (
    SELECT DISTINCT ON (cac.config_id)
        cac.config_id,
        cac.agents_id
    FROM config_agents_connection cac
    WHERE cac.active = TRUE
    ORDER BY cac.config_id, cac.created_at
),
-- Get models_id per config (singular)
models_agg AS (
    SELECT DISTINCT ON (cmc.config_id)
        cmc.config_id,
        cmc.models_id
    FROM config_models_connection cmc
    WHERE cmc.active = TRUE
    ORDER BY cmc.config_id, cmc.created_at
),
-- Get providers_id per config (singular)
providers_agg AS (
    SELECT DISTINCT ON (cpc.config_id)
        cpc.config_id,
        cpc.providers_id
    FROM config_providers_connection cpc
    WHERE cpc.active = TRUE
    ORDER BY cpc.config_id, cpc.created_at
)
SELECT
    ce.id AS config_id,

    -- Inference config resource IDs
    aa.agents_id,
    ma.models_id,
    pa.providers_id,

    ce.created_at AS config_created_at

FROM config_entry ce
LEFT JOIN agents_agg aa ON aa.config_id = ce.id
LEFT JOIN models_agg ma ON ma.config_id = ce.id
LEFT JOIN providers_agg pa ON pa.config_id = ce.id
WHERE ce.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_config_pk
    ON mv_config (config_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX mv_config_agents_id_idx
    ON mv_config (agents_id);

CREATE INDEX mv_config_models_id_idx
    ON mv_config (models_id);

CREATE INDEX mv_config_providers_id_idx
    ON mv_config (providers_id);

CREATE INDEX mv_config_created_at_idx
    ON mv_config (config_created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_config;
