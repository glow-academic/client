-- Materialized View: runs_mv
-- Lean run-level data for group pages.
--
-- Grain: One row per run (with group_id)
-- Filter: group_id IS NOT NULL only
--
-- Purpose: Provides run-level tokens + pricing columns for parallel fetching
-- Section: RUN (lean MV - costs computed in Python from pricing columns)
--
-- Dependencies: Uses _entry, _connection, and pricing tables

CREATE MATERIALIZED VIEW runs_mv AS
WITH
-- Per run, collect distinct agent/model/provider IDs from runs_agents_connection + agents_resource
agents_agg AS (
    SELECT
        rac.run_id,
        COALESCE(
            ARRAY_AGG(DISTINCT rac.agents_id) FILTER (WHERE rac.agents_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) AS agent_ids,
        COALESCE(
            ARRAY_AGG(DISTINCT ar.model_id) FILTER (WHERE ar.model_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) AS model_ids,
        COALESCE(
            ARRAY_AGG(DISTINCT mr.provider_id) FILTER (WHERE mr.provider_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) AS provider_ids
    FROM runs_agents_connection rac
    JOIN agents_resource ar ON ar.id = rac.agents_id AND ar.active = TRUE
    LEFT JOIN models_resource mr ON mr.id = ar.model_id
    WHERE rac.active = TRUE
    GROUP BY rac.run_id
),
-- Per pricing type, get (count, pricing_id) as separate CTEs
pricing_input AS (
    SELECT rpe.run_id, rpe.count::int AS pricing_count, rppc.pricing_id
    FROM run_pricing_entry rpe
    JOIN run_pricing_pricing_connection rppc ON rppc.run_pricing_id = rpe.id AND rppc.active = TRUE
    WHERE rpe.active = TRUE AND rpe.pricing_type = 'input'
),
pricing_output AS (
    SELECT rpe.run_id, rpe.count::int AS pricing_count, rppc.pricing_id
    FROM run_pricing_entry rpe
    JOIN run_pricing_pricing_connection rppc ON rppc.run_pricing_id = rpe.id AND rppc.active = TRUE
    WHERE rpe.active = TRUE AND rpe.pricing_type = 'output'
),
pricing_cached AS (
    SELECT rpe.run_id, rpe.count::int AS pricing_count, rppc.pricing_id
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
    pi.pricing_id AS input_pricing_pricing_id,
    po.pricing_count AS output_pricing_count,
    po.pricing_id AS output_pricing_pricing_id,
    pc.pricing_count AS cached_pricing_count,
    pc.pricing_id AS cached_pricing_pricing_id,

    -- Debug info
    COALESCE(da.debug_info, ARRAY[]::text[]) AS debug_info

FROM runs_entry r
-- Latest token counts (append-only)
LEFT JOIN LATERAL (
    SELECT input_tokens, output_tokens, cached_input_tokens FROM tokens_entry
    WHERE run_id = r.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) te ON true
LEFT JOIN agents_agg ca ON ca.run_id = r.id
LEFT JOIN pricing_input pi ON pi.run_id = r.id
LEFT JOIN pricing_output po ON po.run_id = r.id
LEFT JOIN pricing_cached pc ON pc.run_id = r.id
LEFT JOIN debug_agg da ON da.run_id = r.id
WHERE r.group_id IS NOT NULL
WITH NO DATA;
