-- Materialized View: mv_call_metrics_daily
-- Pre-aggregates daily call metrics by agent/model/provider for analytics.
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- IMPORTANT: This MV depends on mv_call_facts.
-- mv_call_facts must be created and refreshed BEFORE this one.
--
-- Key principle: Pre-aggregated for fast daily call analysis queries.
-- ============================================================================
-- Step 1: Drop all indexes on mv_call_metrics_daily materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_call_metrics_daily'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_call_metrics_daily materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_call_metrics_daily CASCADE;

-- ============================================================================
-- Step 3: Create mv_call_metrics_daily Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_call_metrics_daily AS
SELECT
    -- Aggregation key
    (cf.call_created_at AT TIME ZONE 'UTC')::date AS agg_date,
    cf.agent_id,
    cf.model_id,
    cf.provider_id,

    -- Count metrics
    COUNT(DISTINCT cf.call_id)::int AS total_calls,
    COUNT(DISTINCT cf.call_id) FILTER (WHERE cf.completed = TRUE)::int AS completed_calls,
    COUNT(DISTINCT cf.call_id) FILTER (WHERE cf.completed = FALSE)::int AS pending_calls,
    COUNT(DISTINCT cf.call_id) FILTER (WHERE cf.is_generated = TRUE)::int AS generated_calls,
    COUNT(DISTINCT cf.call_id) FILTER (WHERE cf.is_mcp = TRUE)::int AS mcp_calls,

    -- Tool usage counts
    COUNT(DISTINCT cf.tool_id) FILTER (WHERE cf.tool_id IS NOT NULL)::int AS unique_tools_used,
    COUNT(*) FILTER (WHERE cf.tool_id IS NOT NULL)::int AS total_tool_calls,

    -- Time metrics (for completed calls only)
    AVG(cf.completion_time_ms) FILTER (WHERE cf.completion_time_ms IS NOT NULL)::numeric AS avg_completion_time_ms,
    MIN(cf.completion_time_ms) FILTER (WHERE cf.completion_time_ms IS NOT NULL)::numeric AS min_completion_time_ms,
    MAX(cf.completion_time_ms) FILTER (WHERE cf.completion_time_ms IS NOT NULL)::numeric AS max_completion_time_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cf.completion_time_ms)
        FILTER (WHERE cf.completion_time_ms IS NOT NULL)::numeric AS median_completion_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY cf.completion_time_ms)
        FILTER (WHERE cf.completion_time_ms IS NOT NULL)::numeric AS p95_completion_time_ms,

    -- Completion rate
    CASE
        WHEN COUNT(DISTINCT cf.call_id) > 0
        THEN ROUND(
            (COUNT(DISTINCT cf.call_id) FILTER (WHERE cf.completed = TRUE)::numeric /
             COUNT(DISTINCT cf.call_id)::numeric) * 100, 2
        )
        ELSE 0
    END AS completion_rate,

    -- Arguments size metrics
    AVG(cf.arguments_length)::numeric AS avg_arguments_length,
    MAX(cf.arguments_length)::int AS max_arguments_length

FROM mv_call_facts cf
GROUP BY
    (cf.call_created_at AT TIME ZONE 'UTC')::date,
    cf.agent_id,
    cf.model_id,
    cf.provider_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

-- Composite unique key for the aggregation dimensions
CREATE UNIQUE INDEX mv_call_metrics_daily_pk
    ON mv_call_metrics_daily (
        agg_date,
        COALESCE(agent_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(model_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(provider_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Date range indexes (most common filter)
CREATE INDEX mv_call_metrics_daily_date_idx
    ON mv_call_metrics_daily (agg_date);

CREATE INDEX mv_call_metrics_daily_date_desc_idx
    ON mv_call_metrics_daily (agg_date DESC);

-- Dimension indexes for filtering
CREATE INDEX mv_call_metrics_daily_agent_id_idx
    ON mv_call_metrics_daily (agent_id)
    WHERE agent_id IS NOT NULL;

CREATE INDEX mv_call_metrics_daily_model_id_idx
    ON mv_call_metrics_daily (model_id)
    WHERE model_id IS NOT NULL;

CREATE INDEX mv_call_metrics_daily_provider_id_idx
    ON mv_call_metrics_daily (provider_id)
    WHERE provider_id IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX mv_call_metrics_daily_agent_date_idx
    ON mv_call_metrics_daily (agent_id, agg_date DESC)
    WHERE agent_id IS NOT NULL;

CREATE INDEX mv_call_metrics_daily_model_date_idx
    ON mv_call_metrics_daily (model_id, agg_date DESC)
    WHERE model_id IS NOT NULL;

CREATE INDEX mv_call_metrics_daily_provider_date_idx
    ON mv_call_metrics_daily (provider_id, agg_date DESC)
    WHERE provider_id IS NOT NULL;

-- Count indexes for sorting
CREATE INDEX mv_call_metrics_daily_total_calls_idx
    ON mv_call_metrics_daily (total_calls DESC);

CREATE INDEX mv_call_metrics_daily_completed_calls_idx
    ON mv_call_metrics_daily (completed_calls DESC);

-- Performance indexes
CREATE INDEX mv_call_metrics_daily_avg_completion_time_idx
    ON mv_call_metrics_daily (avg_completion_time_ms ASC NULLS LAST)
    WHERE avg_completion_time_ms IS NOT NULL;

CREATE INDEX mv_call_metrics_daily_completion_rate_idx
    ON mv_call_metrics_daily (completion_rate DESC);

-- Multi-dimension composite indexes
CREATE INDEX mv_call_metrics_daily_agent_model_date_idx
    ON mv_call_metrics_daily (agent_id, model_id, agg_date DESC);

CREATE INDEX mv_call_metrics_daily_date_calls_idx
    ON mv_call_metrics_daily (agg_date DESC, total_calls DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_call_metrics_daily;
