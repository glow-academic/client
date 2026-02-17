-- Materialized View: mv_runs
-- Lean run-level data for group pages.
--
-- Grain: One row per run (with group_id)
-- Filter: group_id IS NOT NULL only
--
-- Purpose: Provides run-level tokens + pricing columns for parallel fetching
-- Section: RUN (lean MV - costs computed in Python from pricing columns)
--
-- Dependencies: Uses _entry, _connection, and pricing tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_runs materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_runs'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_runs materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_runs CASCADE;

-- ============================================================================
-- Step 3: Create mv_runs Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_runs AS
WITH
-- Per run, collect distinct agent/model/provider IDs from config connections
configs_agg AS (
    SELECT
        ce.run_id,
        COALESCE(
            ARRAY_AGG(DISTINCT cac.agents_id) FILTER (WHERE cac.agents_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) AS agent_ids,
        COALESCE(
            ARRAY_AGG(DISTINCT cmc.models_id) FILTER (WHERE cmc.models_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) AS model_ids,
        COALESCE(
            ARRAY_AGG(DISTINCT cpc.providers_id) FILTER (WHERE cpc.providers_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) AS provider_ids
    FROM config_entry ce
    LEFT JOIN config_agents_connection cac ON cac.config_id = ce.id AND cac.active = TRUE
    LEFT JOIN config_models_connection cmc ON cmc.config_id = ce.id AND cmc.active = TRUE
    LEFT JOIN config_providers_connection cpc ON cpc.config_id = ce.id AND cpc.active = TRUE
    WHERE ce.run_id IS NOT NULL
    GROUP BY ce.run_id
),
-- Per pricing type, get (count, unit_id, pricing_id) as separate CTEs
pricing_input AS (
    SELECT rpe.run_id, rpe.count::int AS pricing_count, rpe.unit_id, rppc.pricing_id
    FROM run_pricing_entry rpe
    JOIN run_pricing_pricing_connection rppc ON rppc.run_pricing_id = rpe.id AND rppc.active = TRUE
    WHERE rpe.active = TRUE AND rpe.pricing_type = 'input'
),
pricing_output AS (
    SELECT rpe.run_id, rpe.count::int AS pricing_count, rpe.unit_id, rppc.pricing_id
    FROM run_pricing_entry rpe
    JOIN run_pricing_pricing_connection rppc ON rppc.run_pricing_id = rpe.id AND rppc.active = TRUE
    WHERE rpe.active = TRUE AND rpe.pricing_type = 'output'
),
pricing_cached AS (
    SELECT rpe.run_id, rpe.count::int AS pricing_count, rpe.unit_id, rppc.pricing_id
    FROM run_pricing_entry rpe
    JOIN run_pricing_pricing_connection rppc ON rppc.run_pricing_id = rpe.id AND rppc.active = TRUE
    WHERE rpe.active = TRUE AND rpe.pricing_type = 'cached'
),
debug_agg AS (
    SELECT di.run_id,
        COALESCE(array_agg(di.content ORDER BY di.created_at), ARRAY[]::text[]) AS debug_info
    FROM debug_info_entry di
    WHERE di.active = true AND di.run_id IS NOT NULL
    GROUP BY di.run_id
)
SELECT
    -- Primary key
    r.id AS run_id,

    -- Group ID
    r.group_id,

    -- Token counts (from latest tokens_entry)
    COALESCE(te.input_tokens, 0) AS input_tokens,
    COALESCE(te.output_tokens, 0) AS output_tokens,
    COALESCE(te.cached_input_tokens, 0) AS cached_input_tokens,

    -- Timestamps
    r.created_at AS run_created_at,

    -- Resource ID arrays (for filtering)
    COALESCE(ca.agent_ids, ARRAY[]::uuid[]) AS agent_ids,
    COALESCE(ca.model_ids, ARRAY[]::uuid[]) AS model_ids,
    COALESCE(ca.provider_ids, ARRAY[]::uuid[]) AS provider_ids,

    -- Pricing flat columns (cost computed at runtime in Python)
    pi.pricing_count AS input_pricing_count,
    pi.unit_id AS input_pricing_unit_id,
    pi.pricing_id AS input_pricing_pricing_id,
    po.pricing_count AS output_pricing_count,
    po.unit_id AS output_pricing_unit_id,
    po.pricing_id AS output_pricing_pricing_id,
    pc.pricing_count AS cached_pricing_count,
    pc.unit_id AS cached_pricing_unit_id,
    pc.pricing_id AS cached_pricing_pricing_id,

    -- Debug info
    COALESCE(da.debug_info, ARRAY[]::text[]) AS debug_info

FROM runs_entry r
-- Latest token counts (append-only)
LEFT JOIN LATERAL (
    SELECT input_tokens, output_tokens, cached_input_tokens FROM tokens_entry
    WHERE run_id = r.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) te ON true
LEFT JOIN configs_agg ca ON ca.run_id = r.id
LEFT JOIN pricing_input pi ON pi.run_id = r.id
LEFT JOIN pricing_output po ON po.run_id = r.id
LEFT JOIN pricing_cached pc ON pc.run_id = r.id
LEFT JOIN debug_agg da ON da.run_id = r.id
WHERE r.group_id IS NOT NULL
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_runs_pk
    ON mv_runs (run_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Group ID for filtering
CREATE INDEX mv_runs_group_id_idx
    ON mv_runs (group_id);

-- Timestamp for sorting
CREATE INDEX mv_runs_created_at_idx
    ON mv_runs (run_created_at DESC);

-- Composite: group + created_at (common query pattern)
CREATE INDEX mv_runs_group_created_at_idx
    ON mv_runs (group_id, run_created_at DESC);

-- GIN indexes for array filtering
CREATE INDEX mv_runs_agent_ids_gin
    ON mv_runs USING GIN (agent_ids);

CREATE INDEX mv_runs_model_ids_gin
    ON mv_runs USING GIN (model_ids);

CREATE INDEX mv_runs_provider_ids_gin
    ON mv_runs USING GIN (provider_ids);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_runs;
