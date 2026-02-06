-- ============================================================================
-- Query: get_simulation_groups_view
-- Purpose: Fetch group-level inference config data from mv_simulation_groups
-- Section: VIEWS/SIMULATION/GROUPS
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
        WHERE proname = 'api_get_simulation_groups_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_groups_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_simulation_groups_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Main group item type (resource IDs - one hop to hydrate)
CREATE TYPE types.q_get_simulation_groups_view_v4_item AS (
    -- Primary key (entry ID)
    group_id uuid,

    -- Resource ID (for client hydration)
    groups_id uuid,

    -- Inference config resource IDs (one hop to hydrate)
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

    -- Direct fields
    custom_model boolean,
    group_name text,
    trace_id text,
    created_at timestamptz
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_simulation_groups_view_v4(
    chat_id_filter uuid
)
RETURNS TABLE (
    items types.q_get_simulation_groups_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    -- Fetch groups for the given chat via simulation_chats_bindings_entry
    SELECT COALESCE(
        ARRAY_AGG(
            (
                mg.group_id,
                mg.groups_id,
                mg.agents_id,
                mg.models_id,
                mg.model_values_id,
                mg.providers_id,
                mg.provider_values_id,
                mg.endpoints_id,
                mg.keys_id,
                mg.prompts_id,
                mg.instructions_ids,
                mg.temperature_levels_id,
                mg.reasoning_levels_id,
                mg.qualities_id,
                mg.voices_id,
                mg.tools_ids,
                mg.custom_model,
                mg.group_name,
                mg.trace_id,
                mg.group_created_at
            )::types.q_get_simulation_groups_view_v4_item
            ORDER BY mg.group_created_at
        ),
        ARRAY[]::types.q_get_simulation_groups_view_v4_item[]
    ) AS items
    FROM mv_simulation_groups mg
    JOIN simulation_chats_bindings_entry scbe ON scbe.group_id = mg.group_id
    WHERE scbe.chat_id = chat_id_filter
      AND scbe.active = TRUE;
$$;
