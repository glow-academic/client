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
    -- Per-resource group IDs
    names_group_id uuid,
    descriptions_group_id uuid,
    flags_group_id uuid,
    colors_group_id uuid,
    icons_group_id uuid,
    auths_group_id uuid,
    tools_group_id uuid,
    instructions_group_id uuid,
    documents_group_id uuid,
    departments_group_id uuid,
    parameters_group_id uuid,
    parameter_fields_group_id uuid,
    fields_group_id uuid,
    examples_group_id uuid,
    questions_group_id uuid,
    templates_group_id uuid,
    texts_group_id uuid,
    run_rubrics_group_id uuid,
    group_rubrics_group_id uuid,
    bindings_group_id uuid,
    conditional_parameters_group_id uuid,
    personas_group_id uuid,
    scenarios_group_id uuid,
    simulations_group_id uuid,
    -- Resource arrays
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
                    names_group_id,
                    descriptions_group_id,
                    flags_group_id,
                    colors_group_id,
                    icons_group_id,
                    auths_group_id,
                    tools_group_id,
                    instructions_group_id,
                    documents_group_id,
                    departments_group_id,
                    parameters_group_id,
                    parameter_fields_group_id,
                    fields_group_id,
                    examples_group_id,
                    questions_group_id,
                    templates_group_id,
                    texts_group_id,
                    run_rubrics_group_id,
                    group_rubrics_group_id,
                    bindings_group_id,
                    conditional_parameters_group_id,
                    personas_group_id,
                    scenarios_group_id,
                    simulations_group_id,
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
