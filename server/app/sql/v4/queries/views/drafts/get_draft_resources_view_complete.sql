-- ==========================================================================
-- Query: get_draft_resources_view
-- Purpose: Fetch draft-level denormalized data from mv_draft_resources
-- Section: VIEWS/DRAFTS
-- ==========================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_draft_resources_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_draft_resources_view_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_draft_resources_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_draft_resources_view_v4_item AS (
    draft_id uuid,
    created_at timestamptz,
    updated_at timestamptz,
    version integer,
    generated boolean,
    mcp boolean,
    active boolean,
    group_id uuid,
    resource_types resource_type[],
    resource_ids uuid[],
    name_ids uuid[],
    description_ids uuid[],
    flag_ids uuid[],
    color_ids uuid[],
    icon_ids uuid[],
    auth_ids uuid[],
    tool_ids uuid[],
    instruction_ids uuid[],
    document_ids uuid[],
    department_ids uuid[],
    parameter_ids uuid[],
    parameter_field_ids uuid[],
    field_ids uuid[],
    example_ids uuid[],
    question_ids uuid[],
    template_ids uuid[],
    text_ids uuid[],
    run_rubric_ids uuid[],
    group_rubric_ids uuid[],
    binding_ids uuid[],
    conditional_parameter_ids uuid[],
    persona_ids uuid[],
    scenario_ids uuid[],
    simulation_ids uuid[]
);

CREATE OR REPLACE FUNCTION api_get_draft_resources_view_v4(
    draft_ids uuid[]
)
RETURNS TABLE (
    items types.q_get_draft_resources_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH mv_data AS (
        SELECT mv.*
        FROM mv_draft_resources mv
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
                    resource_types,
                    resource_ids,
                    name_ids,
                    description_ids,
                    flag_ids,
                    color_ids,
                    icon_ids,
                    auth_ids,
                    tool_ids,
                    instruction_ids,
                    document_ids,
                    department_ids,
                    parameter_ids,
                    parameter_field_ids,
                    field_ids,
                    example_ids,
                    question_ids,
                    template_ids,
                    text_ids,
                    run_rubric_ids,
                    group_rubric_ids,
                    binding_ids,
                    conditional_parameter_ids,
                    persona_ids,
                    scenario_ids,
                    simulation_ids
                )::types.q_get_draft_resources_view_v4_item
                ORDER BY updated_at DESC
            ),
            ARRAY[]::types.q_get_draft_resources_view_v4_item[]
        ) AS items
        FROM mv_data
    )
    SELECT items FROM items_agg;
$$;
