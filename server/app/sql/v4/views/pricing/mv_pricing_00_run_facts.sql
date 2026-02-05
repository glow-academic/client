-- Materialized View: mv_pricing_run_facts
-- Minimal pricing facts for compile/runtime compatibility.
--
-- Grain: One row per run
-- Cost source: run_pricing_entry aggregated by pricing_type
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
WITH run_pricing_rollup AS (
    SELECT
        rpe.run_id,
        COALESCE(SUM(
            (rpe.count::numeric / aur.value::numeric) * pr.price
        ) FILTER (WHERE rpe.pricing_type = 'input'), 0)::numeric AS input_cost,
        COALESCE(SUM(
            (rpe.count::numeric / aur.value::numeric) * pr.price
        ) FILTER (WHERE rpe.pricing_type = 'output'), 0)::numeric AS output_cost,
        COALESCE(SUM(
            (rpe.count::numeric / aur.value::numeric) * pr.price
        ) FILTER (WHERE rpe.pricing_type = 'cached'), 0)::numeric AS cached_cost
    FROM run_pricing_entry rpe
    JOIN agent_runs_junction arj2 ON arj2.run_id = rpe.run_id AND arj2.active = TRUE
    JOIN agent_models_junction amj2 ON amj2.agent_id = arj2.agent_id AND amj2.active = TRUE
    JOIN model_pricing_junction mpj ON mpj.model_id = amj2.model_id AND mpj.active = TRUE
    JOIN pricing_resource pr ON pr.id = mpj.pricing_id
        AND pr.pricing_type = rpe.pricing_type
        AND pr.unit_id = rpe.unit_id
        AND pr.active = TRUE
    JOIN artifact_units_relation aur ON aur.id = rpe.unit_id AND aur.active = TRUE
    WHERE rpe.active = TRUE
    GROUP BY rpe.run_id
)
SELECT
    r.id AS run_id,
    r.group_id,
    arj.agent_id,
    amj.model_id,
    prj.profile_id,
    gi.session_id,
    COALESCE(r.input_tokens, 0) AS input_tokens,
    COALESCE(r.output_tokens, 0) AS output_tokens,
    COALESCE(r.cached_input_tokens, 0) AS cached_input_tokens,
    (COALESCE(r.input_tokens, 0) + COALESCE(r.output_tokens, 0) + COALESCE(r.cached_input_tokens, 0))::int AS total_tokens,
    ROUND(COALESCE(rpr.input_cost, 0), 8) AS input_cost,
    ROUND(COALESCE(rpr.output_cost, 0), 8) AS output_cost,
    ROUND(COALESCE(rpr.cached_cost, 0), 8) AS cached_cost,
    ROUND((COALESCE(rpr.input_cost, 0) + COALESCE(rpr.output_cost, 0) + COALESCE(rpr.cached_cost, 0)), 8) AS total_cost,
    r.created_at AS run_created_at,
    gi.name AS group_name,
    gi.trace_id
FROM runs_entry r
LEFT JOIN run_pricing_rollup rpr ON rpr.run_id = r.id
LEFT JOIN agent_runs_junction arj ON arj.run_id = r.id AND arj.active = TRUE
LEFT JOIN agent_models_junction amj ON amj.agent_id = arj.agent_id AND amj.active = TRUE
LEFT JOIN groups_entry gi ON gi.id = r.group_id AND gi.active = TRUE
LEFT JOIN profile_runs_junction prj ON prj.run_id = r.id AND prj.active = TRUE
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
