-- Materialized View: mv_pricing_group_summary
-- Group-level aggregation for PRICING section - list page.
--
-- Grain: One row per group
-- Purpose: Fast pagination for pricing list page with pre-aggregated costs
--
-- IMPORTANT: This MV depends on mv_pricing_run_facts.
-- mv_pricing_run_facts must be created and refreshed BEFORE this one.
--
-- Section: PRICING
-- Source: Aggregate from mv_pricing_run_facts
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_pricing_group_summary materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_pricing_group_summary'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_pricing_group_summary materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_pricing_group_summary CASCADE;

-- ============================================================================
-- Step 3: Create mv_pricing_group_summary Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_pricing_group_summary AS
SELECT
    -- Primary key
    rpf.group_id,

    -- Context IDs (from first/most common values)
    MODE() WITHIN GROUP (ORDER BY rpf.session_id) AS session_id,
    MODE() WITHIN GROUP (ORDER BY rpf.profile_id) AS profile_id,
    -- Use mode() to get most common agent/model in the group
    MODE() WITHIN GROUP (ORDER BY rpf.agent_id) AS primary_agent_id,
    MODE() WITHIN GROUP (ORDER BY rpf.model_id) AS primary_model_id,

    -- Timestamps
    MIN(rpf.run_created_at) AS first_run_at,
    MAX(rpf.run_created_at) AS last_run_at,

    -- Aggregated counts
    COUNT(*)::int AS run_count,
    COUNT(DISTINCT rpf.agent_id)::int AS unique_agents,
    COUNT(DISTINCT rpf.model_id)::int AS unique_models,

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

    -- Group metadata (from first run)
    MAX(rpf.group_name) AS group_name,
    MAX(rpf.trace_id) AS trace_id,

    -- Arrays of distinct IDs for filtering
    ARRAY_AGG(DISTINCT rpf.agent_id) FILTER (WHERE rpf.agent_id IS NOT NULL) AS agent_ids,
    ARRAY_AGG(DISTINCT rpf.model_id) FILTER (WHERE rpf.model_id IS NOT NULL) AS model_ids

FROM mv_pricing_run_facts rpf
WHERE rpf.group_id IS NOT NULL
GROUP BY rpf.group_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_pricing_group_summary_pk
    ON mv_pricing_group_summary (group_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Context ID indexes for filtering
CREATE INDEX mv_pricing_group_summary_session_id_idx
    ON mv_pricing_group_summary (session_id)
    WHERE session_id IS NOT NULL;

CREATE INDEX mv_pricing_group_summary_profile_id_idx
    ON mv_pricing_group_summary (profile_id)
    WHERE profile_id IS NOT NULL;

CREATE INDEX mv_pricing_group_summary_primary_agent_id_idx
    ON mv_pricing_group_summary (primary_agent_id)
    WHERE primary_agent_id IS NOT NULL;

CREATE INDEX mv_pricing_group_summary_primary_model_id_idx
    ON mv_pricing_group_summary (primary_model_id)
    WHERE primary_model_id IS NOT NULL;

-- Timestamp indexes for date range filtering
CREATE INDEX mv_pricing_group_summary_first_run_at_idx
    ON mv_pricing_group_summary (first_run_at);

CREATE INDEX mv_pricing_group_summary_last_run_at_idx
    ON mv_pricing_group_summary (last_run_at);

CREATE INDEX mv_pricing_group_summary_last_run_at_desc_idx
    ON mv_pricing_group_summary (last_run_at DESC);

-- Cost indexes for sorting/filtering
CREATE INDEX mv_pricing_group_summary_total_cost_idx
    ON mv_pricing_group_summary (total_cost DESC)
    WHERE total_cost > 0;

CREATE INDEX mv_pricing_group_summary_total_tokens_idx
    ON mv_pricing_group_summary (total_tokens DESC);

CREATE INDEX mv_pricing_group_summary_run_count_idx
    ON mv_pricing_group_summary (run_count DESC);

-- Composite indexes for common query patterns
CREATE INDEX mv_pricing_group_summary_profile_last_run_idx
    ON mv_pricing_group_summary (profile_id, last_run_at DESC)
    WHERE profile_id IS NOT NULL;

CREATE INDEX mv_pricing_group_summary_session_last_run_idx
    ON mv_pricing_group_summary (session_id, last_run_at DESC)
    WHERE session_id IS NOT NULL;

CREATE INDEX mv_pricing_group_summary_model_cost_idx
    ON mv_pricing_group_summary (primary_model_id, total_cost DESC)
    WHERE primary_model_id IS NOT NULL;

-- Text search index for trace_id
CREATE INDEX mv_pricing_group_summary_trace_id_idx
    ON mv_pricing_group_summary (trace_id)
    WHERE trace_id IS NOT NULL;

-- GIN indexes for array filtering
CREATE INDEX mv_pricing_group_summary_agent_ids_gin
    ON mv_pricing_group_summary USING GIN (agent_ids);

CREATE INDEX mv_pricing_group_summary_model_ids_gin
    ON mv_pricing_group_summary USING GIN (model_ids);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_pricing_group_summary;
