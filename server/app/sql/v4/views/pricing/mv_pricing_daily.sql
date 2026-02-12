-- Materialized View: mv_pricing_daily
-- Daily aggregation for PRICING section - overview charts.
--
-- Grain: One row per (date, model_id, agent_id)
-- Purpose: Daily trend charts on pricing overview page
--
-- IMPORTANT: This MV depends on mv_pricing_run_facts.
-- mv_pricing_run_facts must be created and refreshed BEFORE this one.
--
-- Section: PRICING
-- Source: Aggregate from mv_pricing_run_facts grouped by date + model + agent
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_pricing_daily materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_pricing_daily'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_pricing_daily materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_pricing_daily CASCADE;

-- ============================================================================
-- Step 3: Create mv_pricing_daily Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_pricing_daily AS
SELECT
    -- Keys
    (rpf.run_created_at::date) AS date_key,
    rpf.model_id,
    rpf.agent_id,

    -- Name resource IDs (pre-resolved, 1:1 with model_id/agent_id within each group)
    MODE() WITHIN GROUP (ORDER BY rpf.model_name_id) AS model_name_id,
    MODE() WITHIN GROUP (ORDER BY rpf.agent_name_id) AS agent_name_id,

    -- Aggregated counts
    COUNT(*)::int AS run_count,
    COUNT(DISTINCT rpf.group_id)::int AS group_count,
    COUNT(DISTINCT rpf.profiles_id)::int AS unique_profiles,
    COUNT(DISTINCT rpf.session_id)::int AS unique_sessions,

    -- Token aggregates
    SUM(rpf.input_tokens)::bigint AS total_input_tokens,
    SUM(rpf.output_tokens)::bigint AS total_output_tokens,
    SUM(rpf.cached_input_tokens)::bigint AS total_cached_tokens,
    SUM(rpf.total_tokens)::bigint AS total_tokens,

    -- Cost aggregates
    SUM(rpf.input_cost)::numeric AS total_input_cost,
    SUM(rpf.output_cost)::numeric AS total_output_cost,
    SUM(rpf.cached_cost)::numeric AS total_cached_cost,
    SUM(rpf.total_cost)::numeric AS total_cost,

    -- Averages per run
    TRUNC(AVG(rpf.total_tokens), 2) AS avg_tokens_per_run,
    TRUNC(AVG(rpf.total_cost), 8) AS avg_cost_per_run

FROM mv_pricing_run_facts rpf
GROUP BY (rpf.run_created_at::date), rpf.model_id, rpf.agent_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_pricing_daily_pk
    ON mv_pricing_daily (
        date_key,
        COALESCE(model_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(agent_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary time-based lookup
CREATE INDEX mv_pricing_daily_date_key_idx
    ON mv_pricing_daily (date_key);

-- Date range queries (most common)
CREATE INDEX mv_pricing_daily_date_range_idx
    ON mv_pricing_daily (date_key DESC);

-- Model filtering
CREATE INDEX mv_pricing_daily_model_id_idx
    ON mv_pricing_daily (model_id)
    WHERE model_id IS NOT NULL;

-- Agent filtering
CREATE INDEX mv_pricing_daily_agent_id_idx
    ON mv_pricing_daily (agent_id)
    WHERE agent_id IS NOT NULL;

-- Composite: model + date for model time series
CREATE INDEX mv_pricing_daily_model_date_idx
    ON mv_pricing_daily (model_id, date_key DESC)
    WHERE model_id IS NOT NULL;

-- Composite: agent + date for agent time series
CREATE INDEX mv_pricing_daily_agent_date_idx
    ON mv_pricing_daily (agent_id, date_key DESC)
    WHERE agent_id IS NOT NULL;

-- Cost-based sorting
CREATE INDEX mv_pricing_daily_total_cost_idx
    ON mv_pricing_daily (total_cost DESC)
    WHERE total_cost > 0;

-- Token-based sorting
CREATE INDEX mv_pricing_daily_total_tokens_idx
    ON mv_pricing_daily (total_tokens DESC);

-- Run count sorting
CREATE INDEX mv_pricing_daily_run_count_idx
    ON mv_pricing_daily (run_count DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_pricing_daily;
