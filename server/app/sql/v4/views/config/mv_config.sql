-- Materialized View: mv_config
-- Runtime inference configuration data.
--
-- Grain: One row per config_entry.id
-- Filter: active = TRUE only
--
-- Purpose: Provides inference configuration (agent, model, provider, etc.) for parallel fetching
-- Dependencies: Uses config_entry and config_*_connection tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_config materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_config'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_config materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_config CASCADE;

-- ============================================================================
-- Step 3: Create mv_config Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_config AS
WITH
-- Get agents_id per config (singular - first active)
agents_agg AS (
    SELECT DISTINCT ON (cac.config_id)
        cac.config_id,
        cac.agents_id
    FROM config_agents_connection cac
    WHERE cac.active = TRUE
    ORDER BY cac.config_id, cac.created_at
),
-- Get models_id per config (singular)
models_agg AS (
    SELECT DISTINCT ON (cmc.config_id)
        cmc.config_id,
        cmc.models_id
    FROM config_models_connection cmc
    WHERE cmc.active = TRUE
    ORDER BY cmc.config_id, cmc.created_at
),
-- Get model_values_id per config (singular)
model_values_agg AS (
    SELECT DISTINCT ON (cmvc.config_id)
        cmvc.config_id,
        cmvc.values_id AS model_values_id
    FROM config_model_values_connection cmvc
    WHERE cmvc.active = TRUE
    ORDER BY cmvc.config_id, cmvc.created_at
),
-- Get providers_id per config (singular)
providers_agg AS (
    SELECT DISTINCT ON (cpc.config_id)
        cpc.config_id,
        cpc.providers_id
    FROM config_providers_connection cpc
    WHERE cpc.active = TRUE
    ORDER BY cpc.config_id, cpc.created_at
),
-- Get provider_values_id per config (singular)
provider_values_agg AS (
    SELECT DISTINCT ON (cpvc.config_id)
        cpvc.config_id,
        cpvc.values_id AS provider_values_id
    FROM config_provider_values_connection cpvc
    WHERE cpvc.active = TRUE
    ORDER BY cpvc.config_id, cpvc.created_at
),
-- Get endpoints_id per config (singular)
endpoints_agg AS (
    SELECT DISTINCT ON (cec.config_id)
        cec.config_id,
        cec.endpoints_id
    FROM config_endpoints_connection cec
    WHERE cec.active = TRUE
    ORDER BY cec.config_id, cec.created_at
),
-- Get keys_id per config (singular)
keys_agg AS (
    SELECT DISTINCT ON (ckc.config_id)
        ckc.config_id,
        ckc.keys_id
    FROM config_keys_connection ckc
    WHERE ckc.active = TRUE
    ORDER BY ckc.config_id, ckc.created_at
),
-- Get prompts_id per config (singular)
prompts_agg AS (
    SELECT DISTINCT ON (cpc.config_id)
        cpc.config_id,
        cpc.prompts_id
    FROM config_prompts_connection cpc
    WHERE cpc.active = TRUE
    ORDER BY cpc.config_id, cpc.created_at
),
-- Aggregate instructions_ids per config (plural array)
instructions_agg AS (
    SELECT
        cic.config_id,
        ARRAY_AGG(cic.instructions_id ORDER BY cic.created_at)
            FILTER (WHERE cic.instructions_id IS NOT NULL) AS instructions_ids
    FROM config_instructions_connection cic
    WHERE cic.active = TRUE
    GROUP BY cic.config_id
),
-- Get temperature_levels_id per config (singular)
temperature_levels_agg AS (
    SELECT DISTINCT ON (ctlc.config_id)
        ctlc.config_id,
        ctlc.temperature_levels_id
    FROM config_temperature_levels_connection ctlc
    WHERE ctlc.active = TRUE
    ORDER BY ctlc.config_id, ctlc.created_at
),
-- Get reasoning_levels_id per config (singular)
reasoning_levels_agg AS (
    SELECT DISTINCT ON (crlc.config_id)
        crlc.config_id,
        crlc.reasoning_levels_id
    FROM config_reasoning_levels_connection crlc
    WHERE crlc.active = TRUE
    ORDER BY crlc.config_id, crlc.created_at
),
-- Get qualities_id per config (singular)
qualities_agg AS (
    SELECT DISTINCT ON (cqc.config_id)
        cqc.config_id,
        cqc.qualities_id
    FROM config_qualities_connection cqc
    WHERE cqc.active = TRUE
    ORDER BY cqc.config_id, cqc.created_at
),
-- Get voices_id per config (singular)
voices_agg AS (
    SELECT DISTINCT ON (cvc.config_id)
        cvc.config_id,
        cvc.voices_id
    FROM config_voices_connection cvc
    WHERE cvc.active = TRUE
    ORDER BY cvc.config_id, cvc.created_at
),
-- Aggregate tools_ids per config (plural array)
tools_agg AS (
    SELECT
        ctc.config_id,
        ARRAY_AGG(ctc.tools_id ORDER BY ctc.created_at)
            FILTER (WHERE ctc.tools_id IS NOT NULL) AS tools_ids
    FROM config_tools_connection ctc
    WHERE ctc.active = TRUE
    GROUP BY ctc.config_id
)
SELECT
    ce.id AS config_id,

    -- Inference config resource IDs
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

    ce.created_at AS config_created_at

FROM config_entry ce
LEFT JOIN agents_agg aa ON aa.config_id = ce.id
LEFT JOIN models_agg ma ON ma.config_id = ce.id
LEFT JOIN model_values_agg mva ON mva.config_id = ce.id
LEFT JOIN providers_agg pa ON pa.config_id = ce.id
LEFT JOIN provider_values_agg pva ON pva.config_id = ce.id
LEFT JOIN endpoints_agg ea ON ea.config_id = ce.id
LEFT JOIN keys_agg ka ON ka.config_id = ce.id
LEFT JOIN prompts_agg pra ON pra.config_id = ce.id
LEFT JOIN instructions_agg ia ON ia.config_id = ce.id
LEFT JOIN temperature_levels_agg tla ON tla.config_id = ce.id
LEFT JOIN reasoning_levels_agg rla ON rla.config_id = ce.id
LEFT JOIN qualities_agg qa ON qa.config_id = ce.id
LEFT JOIN voices_agg va ON va.config_id = ce.id
LEFT JOIN tools_agg ta ON ta.config_id = ce.id
WHERE ce.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_config_pk
    ON mv_config (config_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX mv_config_agents_id_idx
    ON mv_config (agents_id);

CREATE INDEX mv_config_models_id_idx
    ON mv_config (models_id);

CREATE INDEX mv_config_providers_id_idx
    ON mv_config (providers_id);

CREATE INDEX mv_config_created_at_idx
    ON mv_config (config_created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_config;
