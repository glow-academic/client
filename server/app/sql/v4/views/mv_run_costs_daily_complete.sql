-- Materialized View: mv_run_costs_daily
-- Pre-aggregates daily costs by model/profile for analytics.
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- IMPORTANT: This MV depends on mv_run_pricing_facts.
-- mv_run_pricing_facts must be created and refreshed BEFORE this one.
--
-- Key principle: Pre-aggregated for fast daily cost analysis queries.
-- ============================================================================
-- Step 1: Drop all indexes on mv_run_costs_daily materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_run_costs_daily'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_run_costs_daily materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_run_costs_daily CASCADE;

-- ============================================================================
-- Step 3: Create mv_run_costs_daily Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_run_costs_daily AS
SELECT
    -- Aggregation key
    (rpf.run_created_at AT TIME ZONE 'UTC')::date AS agg_date,
    rpf.model_id,
    rpf.profile_id,
    rpf.agent_id,

    -- Run counts
    COUNT(*)::int AS run_count,
    COUNT(DISTINCT rpf.group_id)::int AS group_count,

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

    -- Average costs per run
    AVG(rpf.total_cost)::numeric AS avg_cost_per_run,
    AVG(rpf.total_tokens)::numeric AS avg_tokens_per_run

FROM mv_run_pricing_facts rpf
GROUP BY
    (rpf.run_created_at AT TIME ZONE 'UTC')::date,
    rpf.model_id,
    rpf.profile_id,
    rpf.agent_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

-- Composite unique key for the aggregation dimensions
CREATE UNIQUE INDEX mv_run_costs_daily_pk
    ON mv_run_costs_daily (
        agg_date,
        COALESCE(model_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(agent_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Date range indexes (most common filter)
CREATE INDEX mv_run_costs_daily_date_idx
    ON mv_run_costs_daily (agg_date);

CREATE INDEX mv_run_costs_daily_date_desc_idx
    ON mv_run_costs_daily (agg_date DESC);

-- Dimension indexes for filtering
CREATE INDEX mv_run_costs_daily_model_id_idx
    ON mv_run_costs_daily (model_id)
    WHERE model_id IS NOT NULL;

CREATE INDEX mv_run_costs_daily_profile_id_idx
    ON mv_run_costs_daily (profile_id)
    WHERE profile_id IS NOT NULL;

CREATE INDEX mv_run_costs_daily_agent_id_idx
    ON mv_run_costs_daily (agent_id)
    WHERE agent_id IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX mv_run_costs_daily_model_date_idx
    ON mv_run_costs_daily (model_id, agg_date DESC)
    WHERE model_id IS NOT NULL;

CREATE INDEX mv_run_costs_daily_profile_date_idx
    ON mv_run_costs_daily (profile_id, agg_date DESC)
    WHERE profile_id IS NOT NULL;

CREATE INDEX mv_run_costs_daily_agent_date_idx
    ON mv_run_costs_daily (agent_id, agg_date DESC)
    WHERE agent_id IS NOT NULL;

-- Cost indexes for sorting/filtering
CREATE INDEX mv_run_costs_daily_total_cost_idx
    ON mv_run_costs_daily (total_cost DESC)
    WHERE total_cost > 0;

CREATE INDEX mv_run_costs_daily_total_tokens_idx
    ON mv_run_costs_daily (total_tokens DESC);

-- Multi-dimension composite indexes
CREATE INDEX mv_run_costs_daily_model_profile_date_idx
    ON mv_run_costs_daily (model_id, profile_id, agg_date DESC);

CREATE INDEX mv_run_costs_daily_date_cost_idx
    ON mv_run_costs_daily (agg_date DESC, total_cost DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_run_costs_daily;
