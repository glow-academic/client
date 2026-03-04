-- Get provider_drafts entries by IDs from provider_drafts_entry

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_provider_drafts_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_provider_drafts_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_provider_drafts_entries_v4_item%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_provider_drafts_entries_v4_item AS (
    draft_id uuid,
    created_at timestamptz,
    updated_at timestamptz,
    version integer,
    generated boolean,
    mcp boolean,
    active boolean,
    group_id uuid,
    name_ids uuid[],
    description_ids uuid[],
    flag_ids uuid[],
    value_ids uuid[],
    endpoint_ids uuid[],
    key_ids uuid[],
    department_ids uuid[]
);

CREATE OR REPLACE FUNCTION public.api_get_provider_drafts_entries_v4(
    ids uuid[]
)
RETURNS TABLE (
    items types.q_get_provider_drafts_entries_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH mv_data AS (
        SELECT mv.*
        FROM provider_drafts_entry mv
        WHERE mv.draft_id = ANY(ids)
          AND mv.active = true
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    draft_id,
                    created_at,
                    updated_at,
                    version,
                    generated,
                    mcp,
                    active,
                    group_id,
                    name_ids,
                    description_ids,
                    flag_ids,
                    value_ids,
                    endpoint_ids,
                    key_ids,
                    department_ids
                )::types.q_get_provider_drafts_entries_v4_item
                ORDER BY updated_at DESC
            ),
            ARRAY[]::types.q_get_provider_drafts_entries_v4_item[]
        ) AS items
        FROM mv_data
    )
    SELECT items FROM items_agg;
$$;
