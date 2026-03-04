-- Get invocation_drafts entries by IDs from invocation_drafts_entry

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_invocation_drafts_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_invocation_drafts_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_invocation_drafts_entries_v4_item%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_invocation_drafts_entries_v4_item AS (
    draft_id uuid,
    created_at timestamptz,
    updated_at timestamptz,
    version integer,
    generated boolean,
    mcp boolean,
    active boolean,
    group_id uuid,
    department_ids uuid[],
    description_ids uuid[],
    flag_ids uuid[],
    key_ids uuid[],
    model_flag_ids uuid[],
    model_rubric_ids uuid[],
    model_position_ids uuid[],
    name_ids uuid[],
    reasoning_level_ids uuid[],
    temperature_level_ids uuid[],
    voice_ids uuid[]
);

CREATE OR REPLACE FUNCTION public.api_get_invocation_drafts_entries_v4(
    ids uuid[]
)
RETURNS TABLE (
    items types.q_get_invocation_drafts_entries_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH mv_data AS (
        SELECT mv.*
        FROM invocation_drafts_entry mv
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
                    department_ids,
                    description_ids,
                    flag_ids,
                    key_ids,
                    model_flag_ids,
                    model_rubric_ids,
                    model_position_ids,
                    name_ids,
                    reasoning_level_ids,
                    temperature_level_ids,
                    voice_ids
                )::types.q_get_invocation_drafts_entries_v4_item
                ORDER BY updated_at DESC
            ),
            ARRAY[]::types.q_get_invocation_drafts_entries_v4_item[]
        ) AS items
        FROM mv_data
    )
    SELECT items FROM items_agg;
$$;
