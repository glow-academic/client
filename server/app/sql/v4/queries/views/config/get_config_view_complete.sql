-- ============================================================================
-- Query: get_config_view
-- Purpose: Fetch config-level inference config data from config_mv
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
    agents_id uuid,
    models_id uuid,
    providers_id uuid,
    tool_ids uuid[],
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
                mc.providers_id,
                mc.tool_ids,
                mc.config_created_at
            )::types.q_get_config_view_v4_item
            ORDER BY mc.config_created_at
        ),
        ARRAY[]::types.q_get_config_view_v4_item[]
    ) AS items
    FROM config_mv mc
    WHERE mc.config_id = config_id_filter;
$$;
