-- Get config resources by IDs
-- Simple data fetching - no business logic
-- Parameters: ids (uuid[])
-- Returns: items (array of config resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_configs_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_configs_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop search function if exists (avoids type dependency conflicts)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_configs_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_configs_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_configs_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for config item
CREATE TYPE types.q_get_configs_v4_item AS (
    id uuid,
    prompt_id uuid,
    instruction_ids uuid[],
    tool_ids uuid[],
    modality_ids uuid[],
    model_id uuid,
    temperature_level_id uuid,
    reasoning_level_id uuid,
    voice_id uuid,
    quality_id uuid,
    key_id uuid,
    rubric_id uuid,
    active boolean,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_configs_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_configs_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (c.id, c.prompt_id, COALESCE(c.instruction_ids, ARRAY[]::uuid[]), COALESCE(c.tool_ids, ARRAY[]::uuid[]), COALESCE(c.modality_ids, ARRAY[]::uuid[]), c.model_id, c.temperature_level_id, c.reasoning_level_id, c.voice_id, c.quality_id, c.key_id, c.rubric_id, COALESCE(c.active, true), COALESCE(c.generated, false))::types.q_get_configs_v4_item
        ORDER BY array_position(ids, c.id)
    ),
    ARRAY[]::types.q_get_configs_v4_item[]
) as items
FROM config_resource c
WHERE c.id = ANY(ids);
$$;
