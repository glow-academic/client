-- ==========================================================================
-- Query: get_draft_benchmark_view
-- Purpose: Fetch draft-level denormalized data from mv_draft_suite
-- Section: VIEWS/DRAFTS
-- ==========================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_draft_benchmark_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_draft_benchmark_view_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_draft_benchmark_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_draft_benchmark_view_v4_item AS (
    draft_id uuid,
    created_at timestamptz,
    updated_at timestamptz,
    version integer,
    generated boolean,
    mcp boolean,
    active boolean,
    group_id uuid,
    department_ids uuid[],
    model_ids uuid[],
    prompt_ids uuid[],
    instruction_ids uuid[],
    voice_ids uuid[],
    temperature_level_ids uuid[],
    reasoning_level_ids uuid[],
    tool_ids uuid[],
    key_ids uuid[],
    flag_ids uuid[],
    name_ids uuid[],
    description_ids uuid[]
);

CREATE OR REPLACE FUNCTION api_get_draft_benchmark_view_v4(
    draft_ids uuid[]
)
RETURNS TABLE (
    items types.q_get_draft_benchmark_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH mv_data AS (
        SELECT mv.*
        FROM mv_draft_suite mv
        WHERE
            draft_ids IS NULL
            OR cardinality(draft_ids) = 0
            OR mv.draft_id = ANY(draft_ids)
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
                    model_ids,
                    prompt_ids,
                    instruction_ids,
                    voice_ids,
                    temperature_level_ids,
                    reasoning_level_ids,
                    tool_ids,
                    key_ids,
                    flag_ids,
                    name_ids,
                    description_ids
                )::types.q_get_draft_benchmark_view_v4_item
                ORDER BY updated_at DESC
            ),
            ARRAY[]::types.q_get_draft_benchmark_view_v4_item[]
        ) AS items
        FROM mv_data
    )
    SELECT items FROM items_agg;
$$;
