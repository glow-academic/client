-- Materialized View: mv_simulation_groups
-- Group-level data for simulation attempt detail views (inference config).
--
-- Grain: One row per group
-- Filter: active = TRUE only
--
-- Purpose: Provides inference configuration (agent, model, provider, etc.) for parallel fetching
-- Section: SIMULATION (unified view - both home and practice)
--
-- Dependencies: Uses groups_entry and groups_*_connection tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_simulation_groups materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_simulation_groups'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_simulation_groups materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_groups CASCADE;

-- ============================================================================
-- Step 3: Create mv_simulation_groups Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_simulation_groups AS
WITH
-- Get groups_id (resource) for each group_id (entry)
groups_resource_agg AS (
    SELECT
        ggc.group_id,
        ggc.groups_id
    FROM groups_groups_connection ggc
    WHERE ggc.active = TRUE
),
-- Get agents_id per group (singular - first active)
agents_agg AS (
    SELECT DISTINCT ON (gac.group_id)
        gac.group_id,
        gac.agents_id
    FROM groups_agents_connection gac
    WHERE gac.active = TRUE
    ORDER BY gac.group_id, gac.created_at
),
-- Get models_id per group (singular)
models_agg AS (
    SELECT DISTINCT ON (gmc.group_id)
        gmc.group_id,
        gmc.models_id
    FROM groups_models_connection gmc
    WHERE gmc.active = TRUE
    ORDER BY gmc.group_id, gmc.created_at
),
-- Get model_values_id per group (singular)
model_values_agg AS (
    SELECT DISTINCT ON (gmvc.group_id)
        gmvc.group_id,
        gmvc.values_id AS model_values_id
    FROM groups_model_values_connection gmvc
    WHERE gmvc.active = TRUE
    ORDER BY gmvc.group_id, gmvc.created_at
),
-- Get providers_id per group (singular)
providers_agg AS (
    SELECT DISTINCT ON (gpc.group_id)
        gpc.group_id,
        gpc.providers_id
    FROM groups_providers_connection gpc
    WHERE gpc.active = TRUE
    ORDER BY gpc.group_id, gpc.created_at
),
-- Get provider_values_id per group (singular)
provider_values_agg AS (
    SELECT DISTINCT ON (gpvc.group_id)
        gpvc.group_id,
        gpvc.values_id AS provider_values_id
    FROM groups_provider_values_connection gpvc
    WHERE gpvc.active = TRUE
    ORDER BY gpvc.group_id, gpvc.created_at
),
-- Get endpoints_id per group (singular)
endpoints_agg AS (
    SELECT DISTINCT ON (gec.group_id)
        gec.group_id,
        gec.endpoints_id
    FROM groups_endpoints_connection gec
    WHERE gec.active = TRUE
    ORDER BY gec.group_id, gec.created_at
),
-- Get keys_id per group (singular)
keys_agg AS (
    SELECT DISTINCT ON (gkc.group_id)
        gkc.group_id,
        gkc.keys_id
    FROM groups_keys_connection gkc
    WHERE gkc.active = TRUE
    ORDER BY gkc.group_id, gkc.created_at
),
-- Get prompts_id per group (singular)
prompts_agg AS (
    SELECT DISTINCT ON (gpc.group_id)
        gpc.group_id,
        gpc.prompts_id
    FROM groups_prompts_connection gpc
    WHERE gpc.active = TRUE
    ORDER BY gpc.group_id, gpc.created_at
),
-- Aggregate instructions_ids per group (plural array)
instructions_agg AS (
    SELECT
        gic.group_id,
        ARRAY_AGG(gic.instructions_id ORDER BY gic.created_at)
            FILTER (WHERE gic.instructions_id IS NOT NULL) AS instructions_ids
    FROM groups_instructions_connection gic
    WHERE gic.active = TRUE
    GROUP BY gic.group_id
),
-- Get temperature_levels_id per group (singular)
temperature_levels_agg AS (
    SELECT DISTINCT ON (gtlc.group_id)
        gtlc.group_id,
        gtlc.temperature_levels_id
    FROM groups_temperature_levels_connection gtlc
    WHERE gtlc.active = TRUE
    ORDER BY gtlc.group_id, gtlc.created_at
),
-- Get reasoning_levels_id per group (singular)
reasoning_levels_agg AS (
    SELECT DISTINCT ON (grlc.group_id)
        grlc.group_id,
        grlc.reasoning_levels_id
    FROM groups_reasoning_levels_connection grlc
    WHERE grlc.active = TRUE
    ORDER BY grlc.group_id, grlc.created_at
),
-- Get qualities_id per group (singular)
qualities_agg AS (
    SELECT DISTINCT ON (gqc.group_id)
        gqc.group_id,
        gqc.qualities_id
    FROM groups_qualities_connection gqc
    WHERE gqc.active = TRUE
    ORDER BY gqc.group_id, gqc.created_at
),
-- Get voices_id per group (singular)
voices_agg AS (
    SELECT DISTINCT ON (gvc.group_id)
        gvc.group_id,
        gvc.voices_id
    FROM groups_voices_connection gvc
    WHERE gvc.active = TRUE
    ORDER BY gvc.group_id, gvc.created_at
),
-- Aggregate tools_ids per group (plural array)
tools_agg AS (
    SELECT
        gtc.group_id,
        ARRAY_AGG(gtc.tools_id ORDER BY gtc.created_at)
            FILTER (WHERE gtc.tools_id IS NOT NULL) AS tools_ids
    FROM groups_tools_connection gtc
    WHERE gtc.active = TRUE
    GROUP BY gtc.group_id
)
SELECT
    -- Primary key (entry ID for joins)
    ge.id AS group_id,

    -- Resource ID (for client hydration - one hop away)
    gra.groups_id,

    -- Inference config resource IDs (one hop to hydrate)
    aa.agents_id,
    ma.models_id,
    mva.model_values_id,
    pa.providers_id,
    pva.provider_values_id,
    ea.endpoints_id,
    ka.keys_id,
    pra.prompts_id,
    COALESCE(ia.instructions_ids, ARRAY[]::uuid[]) AS instructions_ids,
    tla.temperature_levels_id,
    rla.reasoning_levels_id,
    qa.qualities_id,
    va.voices_id,
    COALESCE(ta.tools_ids, ARRAY[]::uuid[]) AS tools_ids,

    -- Direct fields from groups_entry
    ge.custom_model,
    ge.name AS group_name,
    ge.trace_id,
    ge.created_at AS group_created_at

FROM groups_entry ge
LEFT JOIN groups_resource_agg gra ON gra.group_id = ge.id
LEFT JOIN agents_agg aa ON aa.group_id = ge.id
LEFT JOIN models_agg ma ON ma.group_id = ge.id
LEFT JOIN model_values_agg mva ON mva.group_id = ge.id
LEFT JOIN providers_agg pa ON pa.group_id = ge.id
LEFT JOIN provider_values_agg pva ON pva.group_id = ge.id
LEFT JOIN endpoints_agg ea ON ea.group_id = ge.id
LEFT JOIN keys_agg ka ON ka.group_id = ge.id
LEFT JOIN prompts_agg pra ON pra.group_id = ge.id
LEFT JOIN instructions_agg ia ON ia.group_id = ge.id
LEFT JOIN temperature_levels_agg tla ON tla.group_id = ge.id
LEFT JOIN reasoning_levels_agg rla ON rla.group_id = ge.id
LEFT JOIN qualities_agg qa ON qa.group_id = ge.id
LEFT JOIN voices_agg va ON va.group_id = ge.id
LEFT JOIN tools_agg ta ON ta.group_id = ge.id
WHERE ge.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_simulation_groups_pk
    ON mv_simulation_groups (group_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Groups resource ID for client lookups
CREATE INDEX mv_simulation_groups_groups_id_idx
    ON mv_simulation_groups (groups_id);

-- Agent ID for filtering by agent
CREATE INDEX mv_simulation_groups_agents_id_idx
    ON mv_simulation_groups (agents_id);

-- Model ID for filtering by model
CREATE INDEX mv_simulation_groups_models_id_idx
    ON mv_simulation_groups (models_id);

-- Provider ID for filtering
CREATE INDEX mv_simulation_groups_providers_id_idx
    ON mv_simulation_groups (providers_id);

-- Created at for ordering
CREATE INDEX mv_simulation_groups_created_at_idx
    ON mv_simulation_groups (group_created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_simulation_groups;
