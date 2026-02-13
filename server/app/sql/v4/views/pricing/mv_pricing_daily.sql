-- Materialized View: mv_pricing_daily
-- Daily aggregation for PRICING section - overview charts.
--
-- Grain: One row per (date, model_id, agent_id)
-- Purpose: Daily trend charts on pricing overview page
--
-- Section: PRICING (self-contained, no MV dependencies)
-- Source: Aggregates from entry tables directly grouped by date + model + agent
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
    JOIN run_pricing_pricing_connection rppc ON rppc.run_pricing_id = rpe.id AND rppc.active = TRUE
    JOIN pricing_resource pr ON pr.id = rppc.pricing_id AND pr.active = TRUE
    JOIN artifact_units_relation aur ON aur.id = rpe.unit_id AND aur.active = TRUE
    WHERE rpe.active = TRUE
    GROUP BY rpe.run_id
),
run_facts AS (
    SELECT
        r.id AS run_id,
        r.group_id,
        cac.agents_id AS agent_id,
        amj.model_id,
        prj.profiles_id,
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
        mnj.name_id AS model_name_id,
        anj.name_id AS agent_name_id
    FROM runs_entry r
    LEFT JOIN run_pricing_rollup rpr ON rpr.run_id = r.id
    LEFT JOIN config_entry ce ON ce.run_id = r.id
    LEFT JOIN config_agents_connection cac ON cac.config_id = ce.id AND cac.active = TRUE
    LEFT JOIN agent_models_junction amj ON amj.agent_id = cac.agents_id AND amj.active = TRUE
    LEFT JOIN groups_entry gi ON gi.id = r.group_id AND gi.active = TRUE
    LEFT JOIN profiles_runs_connection prj ON prj.run_id = r.id AND prj.active = TRUE
    LEFT JOIN LATERAL (
        SELECT mnj.name_id FROM model_names_junction mnj
        WHERE mnj.model_id = amj.model_id
        ORDER BY mnj.created_at DESC LIMIT 1
    ) mnj ON TRUE
    LEFT JOIN LATERAL (
        SELECT anj.name_id FROM agent_names_junction anj
        WHERE anj.agent_id = cac.agents_id
        ORDER BY anj.created_at DESC LIMIT 1
    ) anj ON TRUE
)
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

FROM run_facts rpf
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
