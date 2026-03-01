-- Get config entries by IDs from config_resource

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_config_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_config_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_config_entries_v4_item%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_config_entries_v4_item AS (
    config_id uuid,
    prompt_id uuid,
    instruction_ids uuid[],
    tool_ids uuid[],
    modality_ids uuid[],
    rubric_id uuid,
    model_id uuid,
    temperature_level_id uuid,
    reasoning_level_id uuid,
    voice_id uuid,
    quality_id uuid,
    key_id uuid,
    created_at timestamptz
);

CREATE OR REPLACE FUNCTION public.api_get_config_entries_v4(
    ids uuid[]
)
RETURNS TABLE (
    items types.q_get_config_entries_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH resource_data AS (
        SELECT r.*
        FROM config_resource r
        WHERE r.id = ANY(ids)
          AND r.active = true
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    id,
                    prompt_id,
                    instruction_ids,
                    tool_ids,
                    modality_ids,
                    rubric_id,
                    model_id,
                    temperature_level_id,
                    reasoning_level_id,
                    voice_id,
                    quality_id,
                    key_id,
                    created_at
                )::types.q_get_config_entries_v4_item
                ORDER BY created_at
            ),
            ARRAY[]::types.q_get_config_entries_v4_item[]
        ) AS items
        FROM resource_data
    )
    SELECT items FROM items_agg;
$$;
