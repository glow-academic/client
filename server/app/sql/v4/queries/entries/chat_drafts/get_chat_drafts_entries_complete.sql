-- Get chat_drafts entries by IDs from chat_drafts_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_chat_drafts_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_chat_drafts_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_chat_drafts_entries_v4_item%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_chat_drafts_entries_v4_item AS (
    draft_id uuid,
    created_at timestamptz,
    updated_at timestamptz,
    version integer,
    generated boolean,
    mcp boolean,
    active boolean,
    group_id uuid,
    department_ids uuid[],
    persona_ids uuid[],
    document_ids uuid[],
    parameter_field_ids uuid[],
    parameter_ids uuid[],
    field_ids uuid[],
    question_ids uuid[],
    option_ids uuid[],
    video_ids uuid[],
    image_ids uuid[],
    problem_statement_ids uuid[],
    objective_ids uuid[]
);

CREATE OR REPLACE FUNCTION public.api_get_chat_drafts_entries_v4(
    ids uuid[]
)
RETURNS TABLE (
    items types.q_get_chat_drafts_entries_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH mv_data AS (
        SELECT mv.*
        FROM chat_drafts_mv mv
        WHERE mv.draft_id = ANY(ids)
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
                    persona_ids,
                    document_ids,
                    parameter_field_ids,
                    parameter_ids,
                    field_ids,
                    question_ids,
                    option_ids,
                    video_ids,
                    image_ids,
                    problem_statement_ids,
                    objective_ids
                )::types.q_get_chat_drafts_entries_v4_item
                ORDER BY updated_at DESC
            ),
            ARRAY[]::types.q_get_chat_drafts_entries_v4_item[]
        ) AS items
        FROM mv_data
    )
    SELECT items FROM items_agg;
$$;
