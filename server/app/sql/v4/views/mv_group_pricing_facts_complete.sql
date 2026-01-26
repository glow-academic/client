-- Materialized View: mv_group_pricing_facts
-- Pre-aggregates pricing per group for list views.
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- IMPORTANT: This MV depends on mv_run_pricing_facts.
-- mv_run_pricing_facts must be created and refreshed BEFORE this one.
--
-- Key principle: Pre-aggregated for fast group-level pricing queries.
-- ============================================================================
-- Step 1: Drop all indexes on mv_group_pricing_facts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_group_pricing_facts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_group_pricing_facts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_group_pricing_facts CASCADE;

-- ============================================================================
-- Step 3: Create mv_group_pricing_facts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_group_pricing_facts AS
SELECT
    -- Primary key
    rpf.group_id,

    -- Context IDs (from first/most common values)
    rpf.session_id,
    rpf.profile_id,
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
    MAX(rpf.trace_id) AS trace_id

FROM mv_run_pricing_facts rpf
WHERE rpf.group_id IS NOT NULL
GROUP BY
    rpf.group_id,
    rpf.session_id,
    rpf.profile_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_group_pricing_facts_pk
    ON mv_group_pricing_facts (group_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Context ID indexes for filtering
CREATE INDEX mv_group_pricing_facts_session_id_idx
    ON mv_group_pricing_facts (session_id)
    WHERE session_id IS NOT NULL;

CREATE INDEX mv_group_pricing_facts_profile_id_idx
    ON mv_group_pricing_facts (profile_id)
    WHERE profile_id IS NOT NULL;

CREATE INDEX mv_group_pricing_facts_primary_agent_id_idx
    ON mv_group_pricing_facts (primary_agent_id)
    WHERE primary_agent_id IS NOT NULL;

CREATE INDEX mv_group_pricing_facts_primary_model_id_idx
    ON mv_group_pricing_facts (primary_model_id)
    WHERE primary_model_id IS NOT NULL;

-- Timestamp indexes for date range filtering
CREATE INDEX mv_group_pricing_facts_first_run_at_idx
    ON mv_group_pricing_facts (first_run_at);

CREATE INDEX mv_group_pricing_facts_last_run_at_idx
    ON mv_group_pricing_facts (last_run_at);

CREATE INDEX mv_group_pricing_facts_last_run_at_desc_idx
    ON mv_group_pricing_facts (last_run_at DESC);

-- Cost indexes for sorting/filtering
CREATE INDEX mv_group_pricing_facts_total_cost_idx
    ON mv_group_pricing_facts (total_cost DESC)
    WHERE total_cost > 0;

CREATE INDEX mv_group_pricing_facts_total_tokens_idx
    ON mv_group_pricing_facts (total_tokens DESC);

CREATE INDEX mv_group_pricing_facts_run_count_idx
    ON mv_group_pricing_facts (run_count DESC);

-- Composite indexes for common query patterns
CREATE INDEX mv_group_pricing_facts_profile_last_run_idx
    ON mv_group_pricing_facts (profile_id, last_run_at DESC)
    WHERE profile_id IS NOT NULL;

CREATE INDEX mv_group_pricing_facts_session_last_run_idx
    ON mv_group_pricing_facts (session_id, last_run_at DESC)
    WHERE session_id IS NOT NULL;

CREATE INDEX mv_group_pricing_facts_model_cost_idx
    ON mv_group_pricing_facts (primary_model_id, total_cost DESC)
    WHERE primary_model_id IS NOT NULL;

-- Text search index for trace_id
CREATE INDEX mv_group_pricing_facts_trace_id_idx
    ON mv_group_pricing_facts (trace_id)
    WHERE trace_id IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_group_pricing_facts;
