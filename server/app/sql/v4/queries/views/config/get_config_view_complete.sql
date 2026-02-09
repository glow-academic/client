-- ============================================================================
-- Query: get_config_view
-- Purpose: Fetch config-level inference config data from mv_config
-- Section: VIEWS/CONFIG
-- ============================================================================

-- ============================================================================
-- Step 1: Drop existing function
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_config_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_config_view_v4(%s)', r.sig);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop existing composite types
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_config_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_config_view_v4_item AS (
    config_id uuid,

    -- Inference config resource IDs
    agents_id uuid,
    models_id uuid,
    model_values_id uuid,
    providers_id uuid,
    provider_values_id uuid,
    endpoints_id uuid,
    keys_id uuid,
    prompts_id uuid,
    instructions_ids uuid[],
    temperature_levels_id uuid,
    reasoning_levels_id uuid,
    qualities_id uuid,
    voices_id uuid,
    tools_ids uuid[],

    created_at timestamptz
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_config_view_v4(
    config_id_filter uuid
)
RETURNS TABLE (
    items types.q_get_config_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        ARRAY_AGG(
            (
                mc.config_id,
                mc.agents_id,
                mc.models_id,
                mc.model_values_id,
                mc.providers_id,
                mc.provider_values_id,
                mc.endpoints_id,
                mc.keys_id,
                mc.prompts_id,
                mc.instructions_ids,
                mc.temperature_levels_id,
                mc.reasoning_levels_id,
                mc.qualities_id,
                mc.voices_id,
                mc.tools_ids,
                mc.config_created_at
            )::types.q_get_config_view_v4_item
            ORDER BY mc.config_created_at
        ),
        ARRAY[]::types.q_get_config_view_v4_item[]
    ) AS items
    FROM mv_config mc
    WHERE mc.config_id = config_id_filter;
$$;
