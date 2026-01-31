-- Materialized View: mv_pricing_run_facts
-- Base fact table for PRICING section analytics.
--
-- Grain: One row per run
-- Filter: None (all runs)
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: PRICING (overview, list, individual group)
--
-- Pre-computes the expensive 6-table join for pricing:
--   runs_entry -> agent_runs_junction -> agent_models_junction
--   -> model_pricing_junction -> pricing_resource -> artifact_units_relation
--
-- Dependencies: Only uses _entry, _junction, and _resource tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_pricing_run_facts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_pricing_run_facts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_pricing_run_facts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_pricing_run_facts CASCADE;

-- ============================================================================
-- Step 3: Create mv_pricing_run_facts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_pricing_run_facts AS
WITH
-- Get agent and model for each run
run_agent_model AS (
    SELECT
        arj.run_id,
        arj.agent_id,
        amj.model_id
    FROM agent_runs_junction arj
    LEFT JOIN agent_models_junction amj ON amj.agent_id = arj.agent_id AND amj.active = TRUE
    WHERE arj.active = TRUE
),
-- Get pricing per model
model_pricing AS (
    SELECT
        mpj.model_id,
        pr.pricing_type,
        pr.price,
        pr.unit_id,
        au.value AS unit_value
    FROM model_pricing_junction mpj
    JOIN pricing_resource pr ON pr.id = mpj.pricing_id AND pr.active = TRUE
    JOIN artifact_units_relation au ON au.id = pr.unit_id AND au.active = TRUE
    WHERE mpj.active = TRUE
),
-- Calculate costs per run per pricing type
run_costs AS (
    SELECT
        r.id AS run_id,
        r.group_id,
        ram.agent_id,
        ram.model_id,
        r.input_tokens,
        r.output_tokens,
        r.cached_input_tokens,
        r.created_at AS run_created_at,
        -- Input cost
        COALESCE(
            (r.input_tokens::numeric / NULLIF(mp_input.unit_value, 0)) * mp_input.price,
            0
        ) AS input_cost,
        -- Output cost
        COALESCE(
            (r.output_tokens::numeric / NULLIF(mp_output.unit_value, 0)) * mp_output.price,
            0
        ) AS output_cost,
        -- Cached cost
        COALESCE(
            (r.cached_input_tokens::numeric / NULLIF(mp_cached.unit_value, 0)) * mp_cached.price,
            0
        ) AS cached_cost
    FROM runs_entry r
    LEFT JOIN run_agent_model ram ON ram.run_id = r.id
    LEFT JOIN model_pricing mp_input ON mp_input.model_id = ram.model_id AND mp_input.pricing_type = 'input'
    LEFT JOIN model_pricing mp_output ON mp_output.model_id = ram.model_id AND mp_output.pricing_type = 'output'
    LEFT JOIN model_pricing mp_cached ON mp_cached.model_id = ram.model_id AND mp_cached.pricing_type = 'cached'
),
-- Get group info including session and profile
group_info AS (
    SELECT
        g.id AS group_id,
        g.session_id,
        g.name AS group_name,
        g.trace_id,
        s.profile_id
    FROM groups_entry g
    LEFT JOIN sessions_entry s ON s.id = g.session_id
    WHERE g.active = TRUE
),
-- Get profile connection for runs (direct profile_runs_junction)
run_profile AS (
    SELECT
        prj.run_id,
        prj.profile_id
    FROM profile_runs_junction prj
    WHERE prj.active = TRUE
)
SELECT
    -- Entry IDs
    rc.run_id,
    rc.group_id,

    -- Resource IDs
    rc.agent_id,
    rc.model_id,
    -- Profile: prefer direct run->profile, fallback to session->profile
    COALESCE(rp.profile_id, gi.profile_id) AS profile_id,
    gi.session_id,

    -- Token counts (from runs_entry)
    COALESCE(rc.input_tokens, 0) AS input_tokens,
    COALESCE(rc.output_tokens, 0) AS output_tokens,
    COALESCE(rc.cached_input_tokens, 0) AS cached_input_tokens,
    (COALESCE(rc.input_tokens, 0) + COALESCE(rc.output_tokens, 0) + COALESCE(rc.cached_input_tokens, 0))::int AS total_tokens,

    -- Computed costs
    ROUND(rc.input_cost::numeric, 8) AS input_cost,
    ROUND(rc.output_cost::numeric, 8) AS output_cost,
    ROUND(rc.cached_cost::numeric, 8) AS cached_cost,
    ROUND((rc.input_cost + rc.output_cost + rc.cached_cost)::numeric, 8) AS total_cost,

    -- Timestamps
    rc.run_created_at,

    -- Group metadata
    gi.group_name,
    gi.trace_id

FROM run_costs rc
LEFT JOIN group_info gi ON gi.group_id = rc.group_id
LEFT JOIN run_profile rp ON rp.run_id = rc.run_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_pricing_run_facts_pk
    ON mv_pricing_run_facts (run_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Entry ID indexes
CREATE INDEX mv_pricing_run_facts_group_id_idx
    ON mv_pricing_run_facts (group_id)
    WHERE group_id IS NOT NULL;

-- Resource ID indexes for filtering
CREATE INDEX mv_pricing_run_facts_agent_id_idx
    ON mv_pricing_run_facts (agent_id)
    WHERE agent_id IS NOT NULL;

CREATE INDEX mv_pricing_run_facts_model_id_idx
    ON mv_pricing_run_facts (model_id)
    WHERE model_id IS NOT NULL;

CREATE INDEX mv_pricing_run_facts_profile_id_idx
    ON mv_pricing_run_facts (profile_id)
    WHERE profile_id IS NOT NULL;

CREATE INDEX mv_pricing_run_facts_session_id_idx
    ON mv_pricing_run_facts (session_id)
    WHERE session_id IS NOT NULL;

-- Timestamp indexes for date range filtering
CREATE INDEX mv_pricing_run_facts_run_created_at_idx
    ON mv_pricing_run_facts (run_created_at);

CREATE INDEX mv_pricing_run_facts_run_created_at_desc_idx
    ON mv_pricing_run_facts (run_created_at DESC);

-- Date-based index for daily aggregations
CREATE INDEX mv_pricing_run_facts_run_date_idx
    ON mv_pricing_run_facts ((run_created_at::date));

-- Cost indexes for sorting/filtering
CREATE INDEX mv_pricing_run_facts_total_cost_idx
    ON mv_pricing_run_facts (total_cost DESC)
    WHERE total_cost > 0;

CREATE INDEX mv_pricing_run_facts_total_tokens_idx
    ON mv_pricing_run_facts (total_tokens DESC);

-- Composite indexes for common query patterns
CREATE INDEX mv_pricing_run_facts_group_created_at_idx
    ON mv_pricing_run_facts (group_id, run_created_at DESC)
    WHERE group_id IS NOT NULL;

CREATE INDEX mv_pricing_run_facts_model_created_at_idx
    ON mv_pricing_run_facts (model_id, run_created_at DESC)
    WHERE model_id IS NOT NULL;

CREATE INDEX mv_pricing_run_facts_profile_created_at_idx
    ON mv_pricing_run_facts (profile_id, run_created_at DESC)
    WHERE profile_id IS NOT NULL;

CREATE INDEX mv_pricing_run_facts_agent_model_idx
    ON mv_pricing_run_facts (agent_id, model_id)
    WHERE agent_id IS NOT NULL AND model_id IS NOT NULL;

-- Text search index for trace_id
CREATE INDEX mv_pricing_run_facts_trace_id_idx
    ON mv_pricing_run_facts (trace_id)
    WHERE trace_id IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_pricing_run_facts;
