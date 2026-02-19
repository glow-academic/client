-- Get config entries by IDs from config_mv

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
    agents_id uuid,
    models_id uuid,
    providers_id uuid,
    tool_ids uuid[],
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
    WITH mv_data AS (
        SELECT mv.*
        FROM config_mv mv
        WHERE mv.config_id = ANY(ids)
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    config_id,
                    agents_id,
                    models_id,
                    providers_id,
                    tool_ids,
                    config_created_at
                )::types.q_get_config_entries_v4_item
                ORDER BY config_created_at
            ),
            ARRAY[]::types.q_get_config_entries_v4_item[]
        ) AS items
        FROM mv_data
    )
    SELECT items FROM items_agg;
$$;
