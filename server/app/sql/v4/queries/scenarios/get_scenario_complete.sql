-- Unified get scenario function - handles both new (scenario_id = NULL) and detail (scenario_id provided)
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- Parameters: scenario_id (uuid, nullable for new mode), profile_id (uuid),
--            document_ids (uuid[], nullable), problem_statement_ids (uuid[], nullable),
--            template_document_ids (uuid[], nullable)
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_scenario_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITH CASCADE (needed for nested composite types)
-- Drop all types matching prefix pattern to handle type additions/removals
-- CASCADE is needed because outer types contain arrays of inner types
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_scenario_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
-- Note: Composite types include `generated` boolean but NOT `group_id` (group_id is top-level field)
-- Following ARTIFACT.md pattern

CREATE TYPE types.q_get_scenario_v4_field_param_filter AS (
    parameter_id uuid,
    show_selected boolean
);

-- Resource composite types (with generated boolean, NOT group_id)
CREATE TYPE types.q_get_scenario_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_scenario_v4_description_resource AS (
    id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_scenario_v4_problem_statement_resource AS (
    id uuid,
    name text,
    problem_statement text,
    generated boolean
);

CREATE TYPE types.q_get_scenario_v4_objective_resource AS (
    id uuid,
    objective text,
    generated boolean
);

CREATE TYPE types.q_get_scenario_v4_department AS (
    department_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_scenario_v4_field AS (
    field_id uuid,
    name text,
    description text,
    parameter_id uuid,
    parameter_name text,
    conditional_parameter_ids uuid[],
    generated boolean
);

CREATE TYPE types.q_get_scenario_v4_image_resource AS (
    id uuid,
    name text,
    file_path text,
    mime_type text,
    upload_id uuid,
    generated boolean
);

CREATE TYPE types.q_get_scenario_v4_video_resource AS (
    id uuid,
    name text,
    length_seconds integer,
    completed boolean,
    file_path text,
    mime_type text,
    upload_id uuid,
    generated boolean
);

CREATE TYPE types.q_get_scenario_v4_question_resource AS (
    id uuid,
    question_text text,
    allow_multiple boolean,
    generated boolean
);

CREATE TYPE types.q_get_scenario_v4_template_resource AS (
    id uuid,
    name text,
    description text,
    html text,
    generated boolean
);

CREATE TYPE types.q_get_scenario_v4_persona AS (
    persona_id uuid,
    name text,
    description text,
    color text,
    icon text,
    image_model boolean,
    parameter_ids uuid[],
    field_ids uuid[],
    example text
);

CREATE TYPE types.q_get_scenario_v4_document AS (
    document_id uuid,
    name text,
    description text,
    file_path text,
    mime_type text,
    parameter_ids uuid[],
    field_ids uuid[],
    parent_document_id uuid
);

CREATE TYPE types.q_get_scenario_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean
);

-- Flag resource composite type (with generated boolean, NOT group_id)
CREATE TYPE types.q_get_scenario_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon_id uuid,
    icon_name text,
    generated boolean
);


-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_scenario_v4(
    profile_id uuid,
    scenario_id uuid DEFAULT NULL,
    document_ids uuid[] DEFAULT NULL,
    problem_statement_ids uuid[] DEFAULT NULL,
    template_document_ids uuid[] DEFAULT NULL,
    -- Filter parameters
    filter_department_ids uuid[] DEFAULT NULL,
    filter_persona_ids uuid[] DEFAULT NULL,
    filter_document_ids uuid[] DEFAULT NULL,
    filter_parameter_ids uuid[] DEFAULT NULL,
    filter_field_ids uuid[] DEFAULT NULL,
    -- Search parameters
    persona_search text DEFAULT NULL,
    document_search text DEFAULT NULL,
    parameter_search text DEFAULT NULL,
    description_search text DEFAULT NULL,
    problem_statement_search text DEFAULT NULL,
    template_search text DEFAULT NULL,
    image_search text DEFAULT NULL,
    video_search text DEFAULT NULL,
    -- Show selected filters
    persona_show_selected boolean DEFAULT NULL,
    document_show_selected boolean DEFAULT NULL,
    parameter_show_selected boolean DEFAULT NULL,
    field_show_selected_by_param types.q_get_scenario_v4_field_param_filter[] DEFAULT ARRAY[]::types.q_get_scenario_v4_field_param_filter[],
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    scenario_exists boolean,
    can_edit boolean,
    disabled_reason text,
    group_id uuid,
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_scenario_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_scenario_v4_name_resource[],
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_scenario_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_scenario_v4_description_resource[],
    -- Single-select resources: problem_statement
    problem_statement_id uuid,
    problem_statement_resource types.q_get_scenario_v4_problem_statement_resource,
    show_problem_statement boolean,
    problem_statement_agent_id uuid,
    problem_statement_required boolean,
    problem_statement_suggestions uuid[],
    problem_statements types.q_get_scenario_v4_problem_statement_resource[],
    -- Single-select resources: flags (one per flag type)
    active_flag_id uuid,
    active_flag_resource types.q_get_scenario_v4_flag_resource,
    show_active_flag boolean,
    active_flag_agent_id uuid,
    active_flag_required boolean,
    objectives_enabled_flag_id uuid,
    objectives_enabled_flag_resource types.q_get_scenario_v4_flag_resource,
    show_objectives_enabled_flag boolean,
    objectives_enabled_flag_agent_id uuid,
    objectives_enabled_flag_required boolean,
    images_enabled_flag_id uuid,
    images_enabled_flag_resource types.q_get_scenario_v4_flag_resource,
    show_images_enabled_flag boolean,
    images_enabled_flag_agent_id uuid,
    images_enabled_flag_required boolean,
    video_enabled_flag_id uuid,
    video_enabled_flag_resource types.q_get_scenario_v4_flag_resource,
    show_video_enabled_flag boolean,
    video_enabled_flag_agent_id uuid,
    video_enabled_flag_required boolean,
    questions_enabled_flag_id uuid,
    questions_enabled_flag_resource types.q_get_scenario_v4_flag_resource,
    show_questions_enabled_flag boolean,
    questions_enabled_flag_agent_id uuid,
    questions_enabled_flag_required boolean,
    problem_statement_enabled_flag_id uuid,
    problem_statement_enabled_flag_resource types.q_get_scenario_v4_flag_resource,
    show_problem_statement_enabled_flag boolean,
    problem_statement_enabled_flag_agent_id uuid,
    problem_statement_enabled_flag_required boolean,
    use_templates_flag_id uuid,
    use_templates_flag_resource types.q_get_scenario_v4_flag_resource,
    show_use_templates_flag boolean,
    use_templates_flag_agent_id uuid,
    use_templates_flag_required boolean,
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_scenario_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_scenario_v4_department[],
    -- Multi-select resources: fields
    field_ids uuid[],
    field_resources types.q_get_scenario_v4_field[],
    show_fields boolean,
    fields_agent_id uuid,
    fields_required boolean,
    field_suggestions uuid[],
    fields types.q_get_scenario_v4_field[],
    -- Multi-select resources: objectives
    objective_ids uuid[],
    objective_resources types.q_get_scenario_v4_objective_resource[],
    show_objectives boolean,
    objectives_agent_id uuid,
    objectives_required boolean,
    objective_suggestions uuid[],
    objectives types.q_get_scenario_v4_objective_resource[],
    -- Multi-select resources: images
    image_ids uuid[],
    image_resources types.q_get_scenario_v4_image_resource[],
    show_images boolean,
    images_agent_id uuid,
    images_required boolean,
    image_suggestions uuid[],
    images types.q_get_scenario_v4_image_resource[],
    -- Multi-select resources: videos
    video_ids uuid[],
    video_resources types.q_get_scenario_v4_video_resource[],
    show_videos boolean,
    videos_agent_id uuid,
    videos_required boolean,
    video_suggestions uuid[],
    videos types.q_get_scenario_v4_video_resource[],
    -- Multi-select resources: questions
    question_ids uuid[],
    question_resources types.q_get_scenario_v4_question_resource[],
    show_questions boolean,
    questions_agent_id uuid,
    questions_required boolean,
    question_suggestions uuid[],
    questions types.q_get_scenario_v4_question_resource[],
    -- Multi-select resources: templates
    template_ids uuid[],
    template_resources types.q_get_scenario_v4_template_resource[],
    show_templates boolean,
    templates_agent_id uuid,
    templates_required boolean,
    template_suggestions uuid[],
    templates types.q_get_scenario_v4_template_resource[],
    -- Multi-select resources: personas
    persona_ids uuid[],
    persona_resources types.q_get_scenario_v4_persona[],
    show_personas boolean,
    personas_agent_id uuid,
    personas_required boolean,
    persona_suggestions uuid[],
    personas types.q_get_scenario_v4_persona[],
    -- Multi-select resources: documents
    document_ids uuid[],
    document_resources types.q_get_scenario_v4_document[],
    show_documents boolean,
    documents_agent_id uuid,
    documents_required boolean,
    document_suggestions uuid[],
    documents types.q_get_scenario_v4_document[],
    -- Multi-select resources: parameters
    parameter_ids uuid[],
    parameter_resources types.q_get_scenario_v4_parameter[],
    show_parameters boolean,
    parameters_agent_id uuid,
    parameters_required boolean,
    parameter_suggestions uuid[],
    parameters types.q_get_scenario_v4_parameter[],
    -- Multi-resource combination agent IDs
    basic_agent_id uuid,
    content_agent_id uuid,
    general_agent_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        scenario_id AS scenario_id,
        profile_id AS profile_id,
        COALESCE(mcp, false) AS mcp,
        COALESCE(document_ids, ARRAY[]::uuid[]) AS document_ids,
        COALESCE(problem_statement_ids, ARRAY[]::uuid[]) AS problem_statement_ids,
        COALESCE(template_document_ids, ARRAY[]::uuid[]) AS template_document_ids,
        -- Filter parameters
        COALESCE(filter_department_ids, ARRAY[]::uuid[]) AS filter_department_ids,
        COALESCE(filter_persona_ids, ARRAY[]::uuid[]) AS filter_persona_ids,
        COALESCE(filter_document_ids, ARRAY[]::uuid[]) AS filter_document_ids,
        COALESCE(filter_parameter_ids, ARRAY[]::uuid[]) AS filter_parameter_ids,
        COALESCE(filter_field_ids, ARRAY[]::uuid[]) AS filter_field_ids,
        -- Search parameters
        COALESCE(NULLIF(persona_search, ''), NULL) AS persona_search,
        COALESCE(NULLIF(document_search, ''), NULL) AS document_search,
        COALESCE(NULLIF(parameter_search, ''), NULL) AS parameter_search,
        COALESCE(NULLIF(description_search, ''), NULL) AS description_search,
        COALESCE(NULLIF(problem_statement_search, ''), NULL) AS problem_statement_search,
        COALESCE(NULLIF(template_search, ''), NULL) AS template_search,
        COALESCE(NULLIF(image_search, ''), NULL) AS image_search,
        COALESCE(NULLIF(video_search, ''), NULL) AS video_search,
        -- Show selected filters
        COALESCE(persona_show_selected, false) AS persona_show_selected,
        COALESCE(document_show_selected, false) AS document_show_selected,
        COALESCE(parameter_show_selected, false) AS parameter_show_selected,
        COALESCE(field_show_selected_by_param, ARRAY[]::types.q_get_scenario_v4_field_param_filter[]) AS field_show_selected_by_param,
        draft_id AS draft_id
),
draft_payload_data AS (
    SELECT
        NULL::jsonb as payload,
        d.version as draft_version
    FROM params x
    JOIN drafts_entry d ON d.id = x.draft_id
    JOIN profile_drafts_junction pdj ON pdj.draft_id = d.id AND pdj.profile_id = x.profile_id
    WHERE x.draft_id IS NOT NULL

    LIMIT 1
),
-- Conditional: Only check scenario existence if scenario_id provided
scenario_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT scenario_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM scenario_artifact WHERE id = (SELECT scenario_id FROM params LIMIT 1))::boolean
        END as scenario_exists
),
-- Get group_id from draft (should always exist after migration, but handle NULL case)
draft_group_data AS (
    SELECT 
        COALESCE(
            d.group_id,
            (SELECT id FROM groups_entry ORDER BY created_at DESC LIMIT 1)
        ) as group_id
    FROM params x
    LEFT JOIN drafts_entry d ON d.id = x.draft_id
    -- Always return at least one row (use COALESCE to handle NULL draft_id case)
    WHERE TRUE
    LIMIT 1
),
resolve_profile_id AS (
    -- Resolve profile ID FROM parameter_artifact
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params)::text IS NULL OR (SELECT profile_id FROM params)::text = '' THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)::uuid
        END as resolved_profile_id
),
-- profile_id is always a UUID (required in request body)
user_profile AS (
    SELECT role, COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
user_departments AS (
    SELECT ARRAY_AGG(DISTINCT pd.department_id)::uuid[] as dept_ids
    FROM resolve_profile_id rpi
    JOIN profile_departments_junction pd ON pd.profile_id = rpi.resolved_profile_id
    JOIN departments_resource d ON d.id = pd.department_id
    WHERE pd.active = true AND EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
),
user_departments_rows AS (
    SELECT DISTINCT pd.department_id as id
    FROM resolve_profile_id rpi
    JOIN profile_departments_junction pd ON pd.profile_id = rpi.resolved_profile_id
    JOIN departments_resource d ON d.id = pd.department_id
    WHERE pd.active = true AND EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
),
scenario_departments_data AS (
    SELECT
        sd.scenario_id,
        COALESCE(ARRAY_AGG(sd.department_id ORDER BY sd.created_at), ARRAY[]::uuid[]) as department_ids
    FROM params x
    LEFT JOIN scenario_departments_junction sd ON sd.scenario_id = x.scenario_id AND sd.active = true
    WHERE x.scenario_id IS NOT NULL
    GROUP BY sd.scenario_id
),
scenario_active_problem_statement AS (
    SELECT 
        sps.scenario_id,
        ps.id::text as problem_statement_id,
        ps.name,
        ps.problem_statement,
        ps.created_at as problem_statement_created_at,
        ps.created_at as problem_statement_updated_at
    FROM scenario_problem_statements_junction sps
    JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
    WHERE sps.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sps.active = true
    LIMIT 1
),
scenario_all_problem_statements AS (
    SELECT 
        sps.scenario_id,
        ps.id::text as problem_statement_id,
        ps.id as problem_statement_id_uuid,
        ps.name,
        ps.problem_statement,
        ps.created_at as problem_statement_created_at,
        ps.created_at as problem_statement_updated_at
    FROM scenario_problem_statements_junction sps
    JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
    WHERE sps.scenario_id = (SELECT scenario_id FROM params)
),
problem_statements_array AS (
    -- Problem statements FROM scenario_artifact (sorted first)
    SELECT 
        sps.problem_statement_id_uuid as problem_statement_id,
        sps.name,
        sps.problem_statement,
        sps.problem_statement_created_at as created_at,
        sps.problem_statement_updated_at as updated_at,
        0 as sort_order
    FROM scenario_all_problem_statements sps
    UNION ALL
    -- ALL other problem statements matching departments
    SELECT 
        ps.id as problem_statement_id,
        ps.name,
        ps.problem_statement,
        ps.created_at,
        ps.created_at,
        1 as sort_order
    FROM problem_statements_resource ps
    WHERE NOT EXISTS (
        SELECT 1
        FROM scenario_all_problem_statements saps
        WHERE saps.problem_statement_id_uuid = ps.id
    )
),
-- Conditional: Only check department access if scenario_id provided
scenario_department_access_check AS (
    SELECT 
        s.id as scenario_id,
        CASE 
            WHEN (SELECT scenario_id FROM params) IS NULL THEN NULL::boolean
            WHEN up.role = 'superadmin'::profile_type THEN true
            WHEN EXISTS (
                SELECT 1 FROM scenario_departments_junction sd 
                WHERE sd.scenario_id = s.id 
                AND sd.active = true 
                AND sd.department_id IN (SELECT department_id FROM resolve_profile_id rpi JOIN profile_departments_junction pd ON pd.profile_id = rpi.resolved_profile_id WHERE pd.active = true)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM scenario_departments_junction sd2 
                WHERE sd2.scenario_id = s.id 
                AND sd2.active = true
            ) THEN true  -- Cross-department resource
            ELSE false
        END as has_access
    FROM params x
    LEFT JOIN scenario_artifact s ON s.id = x.scenario_id
    CROSS JOIN user_profile up
    WHERE x.scenario_id IS NOT NULL
),
-- Conditional: Get scenario core data only if scenario_id provided
-- Always returns at least one row (for CROSS JOIN safety)
scenario_core AS (
    SELECT 
        s.id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1) as name,
        (SELECT d.description FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1) as description,
        COALESCE(saps.problem_statement, '') as problem_statement,
        COALESCE(saps.problem_statement_id, NULL) as problem_statement_id,
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN EXISTS (
                SELECT 1
                FROM flags_draft df
                JOIN flags_resource f ON df.flags_id = f.id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND f.name = 'active'
                  AND df.active = true
            )
            ELSE EXISTS (
                SELECT 1
                FROM scenario_flags_junction sf
                JOIN flags_resource f ON sf.flag_id = f.id
                WHERE sf.scenario_id = s.id
                  AND f.name = 'scenario_active'
                  AND sf.value = TRUE
                  AND sf.active = true
            )
        END as active,
        st.parent_id as parent_scenario_id,
        COALESCE(sdd.department_ids, ARRAY[]::uuid[]) as department_ids,
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN EXISTS (
                SELECT 1
                FROM flags_draft df
                JOIN flags_resource f ON df.flags_id = f.id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND f.name = 'objectives_enabled'
                  AND df.active = true
            )
            ELSE EXISTS (
                SELECT 1
                FROM scenario_flags_junction sf
                JOIN flags_resource f ON sf.flag_id = f.id
                WHERE sf.scenario_id = s.id
                  AND f.name = 'objectives_enabled'
                  AND sf.value = TRUE
                  AND sf.active = true
            )
        END as objectives_enabled,
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN EXISTS (
                SELECT 1
                FROM flags_draft df
                JOIN flags_resource f ON df.flags_id = f.id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND f.name = 'images_enabled'
                  AND df.active = true
            )
            ELSE EXISTS (
                SELECT 1
                FROM scenario_flags_junction sf
                JOIN flags_resource f ON sf.flag_id = f.id
                WHERE sf.scenario_id = s.id
                  AND f.name = 'images_enabled'
                  AND sf.value = TRUE
                  AND sf.active = true
            )
        END as images_enabled,
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN EXISTS (
                SELECT 1
                FROM flags_draft df
                JOIN flags_resource f ON df.flags_id = f.id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND f.name = 'video_enabled'
                  AND df.active = true
            )
            ELSE EXISTS (
                SELECT 1
                FROM scenario_flags_junction sf
                JOIN flags_resource f ON sf.flag_id = f.id
                WHERE sf.scenario_id = s.id
                  AND f.name = 'video_enabled'
                  AND sf.value = TRUE
                  AND sf.active = true
            )
        END as video_enabled,
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN EXISTS (
                SELECT 1
                FROM flags_draft df
                JOIN flags_resource f ON df.flags_id = f.id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND f.name = 'questions_enabled'
                  AND df.active = true
            )
            ELSE EXISTS (
                SELECT 1
                FROM scenario_flags_junction sf
                JOIN flags_resource f ON sf.flag_id = f.id
                WHERE sf.scenario_id = s.id
                  AND f.name = 'questions_enabled'
                  AND sf.value = TRUE
                  AND sf.active = true
            )
        END as questions_enabled,
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN EXISTS (
                SELECT 1
                FROM flags_draft df
                JOIN flags_resource f ON df.flags_id = f.id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND f.name = 'problem_statement_enabled'
                  AND df.active = true
            )
            ELSE EXISTS (
                SELECT 1
                FROM scenario_flags_junction sf
                JOIN flags_resource f ON sf.flag_id = f.id
                WHERE sf.scenario_id = s.id
                  AND f.name = 'problem_statement_enabled'
                  AND sf.value = TRUE
                  AND sf.active = true
            )
        END as problem_statement_enabled,
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN EXISTS (
                SELECT 1
                FROM flags_draft df
                JOIN flags_resource f ON df.flags_id = f.id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND f.name = 'use_templates'
                  AND df.active = true
            )
            ELSE EXISTS (
                SELECT 1
                FROM scenario_flags_junction sf
                JOIN flags_resource f ON sf.flag_id = f.id
                WHERE sf.scenario_id = s.id
                  AND f.name = 'use_templates'
                  AND sf.value = TRUE
                  AND sf.active = true
            )
        END as use_templates
    FROM params x
    LEFT JOIN scenario_artifact s ON s.id = x.scenario_id
    LEFT JOIN scenario_tree_junction st ON st.child_id = s.id AND st.parent_id != st.parent_id
    LEFT JOIN scenario_active_problem_statement saps ON saps.scenario_id = s.id
    LEFT JOIN scenario_departments_data sdd ON sdd.scenario_id = s.id
    LEFT JOIN scenario_department_access_check sdac ON sdac.scenario_id = s.id
    WHERE x.scenario_id IS NULL OR (x.scenario_id IS NOT NULL AND (sdac.has_access = true OR sdac.has_access IS NULL))
    LIMIT 1
),
-- Resource data CTEs - query from scenario_* tables or draft_* tables if draft_id provided
-- Name resource data
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dn.names_id FROM names_draft dn WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT sn.name_id FROM scenario_names_junction sn WHERE sn.scenario_id = (SELECT scenario_id FROM params) LIMIT 1)
        ) as name_id,
        (
            SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_scenario_v4_name_resource 
            FROM (
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 1 as priority
                FROM names_draft dn 
                JOIN names_resource n ON dn.names_id = n.id 
                WHERE dn.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 2 as priority
                FROM scenario_names_junction sn 
                JOIN names_resource n ON sn.name_id = n.id 
                WHERE sn.scenario_id = (SELECT scenario_id FROM params)
            ) n
            ORDER BY priority
            LIMIT 1
        ) as name_resource
    FROM params
),
-- Description resource data
description_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dd.descriptions_id FROM descriptions_draft dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT sd.description_id FROM scenario_descriptions_junction sd WHERE sd.scenario_id = (SELECT scenario_id FROM params) LIMIT 1)
        ) as description_id,
        (
            SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_scenario_v4_description_resource 
            FROM (
                SELECT d.id, d.description, COALESCE(d.generated, false) as generated, 1 as priority
                FROM descriptions_draft dd 
                JOIN descriptions_resource d ON dd.descriptions_id = d.id 
                WHERE dd.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT d.id, d.description, COALESCE(d.generated, false) as generated, 2 as priority
                FROM scenario_descriptions_junction sd 
                JOIN descriptions_resource d ON sd.description_id = d.id 
                WHERE sd.scenario_id = (SELECT scenario_id FROM params)
            ) d
            ORDER BY priority
            LIMIT 1
        ) as description_resource
    FROM params
),
-- Problem statement resource data
problem_statement_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT sps.problem_statement_id FROM scenario_problem_statements_junction sps WHERE sps.scenario_id = (SELECT scenario_id FROM params) AND sps.active = true LIMIT 1),
            NULL::uuid
        ) as problem_statement_id,
        (
            SELECT ROW(ps.id, ps.name, ps.problem_statement, COALESCE(ps.generated, false))::types.q_get_scenario_v4_problem_statement_resource 
            FROM scenario_problem_statements_junction sps
            JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
            WHERE sps.scenario_id = (SELECT scenario_id FROM params) AND sps.active = true
            LIMIT 1
        ) as problem_statement_resource
    FROM params
),
-- Flag resource data CTEs (one per flag type, following Persona.tsx pattern)
active_flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id
             FROM flags_draft df
             JOIN flags_resource f ON df.flags_id = f.id
             WHERE df.draft_id = (SELECT draft_id FROM params)
               AND f.name = 'active'
               AND df.active = true
             LIMIT 1),
            (SELECT sf.flag_id
             FROM scenario_flags_junction sf
             JOIN flags_resource f ON sf.flag_id = f.id
             WHERE sf.scenario_id = (SELECT scenario_id FROM params)
               AND f.name = 'scenario_active'
               AND sf.active = true
               AND sf.value = true
             LIMIT 1)
        ) as active_flag_id,
        (
            SELECT ROW(fd.id, fd.name, COALESCE(fd.description, ''), fd.icon_id, fd.icon_name, COALESCE(fd.generated, false))::types.q_get_scenario_v4_flag_resource
            FROM (
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, df.generated, 1 as priority
                FROM flags_draft df
                JOIN flags_resource f ON df.flags_id = f.id
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND f.name = 'active'
                  AND df.active = true
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, sf.generated, 2 as priority
                FROM scenario_flags_junction sf
                JOIN flags_resource f ON sf.flag_id = f.id
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE sf.scenario_id = (SELECT scenario_id FROM params)
                  AND f.name = 'scenario_active'
                  AND sf.active = true
                  AND sf.value = true
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, f.generated, 3 as priority
                FROM flags_resource f
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE f.name = 'scenario_active'
            ) fd
            ORDER BY priority
            LIMIT 1
        ) as active_flag_resource
    FROM params
),
objectives_enabled_flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id
             FROM flags_draft df
             JOIN flags_resource f ON df.flags_id = f.id
             WHERE df.draft_id = (SELECT draft_id FROM params)
               AND f.name = 'objectives_enabled'
               AND df.active = true
             LIMIT 1),
            (SELECT sf.flag_id
             FROM scenario_flags_junction sf
             JOIN flags_resource f ON sf.flag_id = f.id
             WHERE sf.scenario_id = (SELECT scenario_id FROM params)
               AND f.name = 'objectives_enabled'
               AND sf.active = true
               AND sf.value = true
             LIMIT 1)
        ) as objectives_enabled_flag_id,
        (
            SELECT ROW(fd.id, fd.name, COALESCE(fd.description, ''), fd.icon_id, fd.icon_name, COALESCE(fd.generated, false))::types.q_get_scenario_v4_flag_resource
            FROM (
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, df.generated, 1 as priority
                FROM flags_draft df
                JOIN flags_resource f ON df.flags_id = f.id
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND f.name = 'objectives_enabled'
                  AND df.active = true
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, sf.generated, 2 as priority
                FROM scenario_flags_junction sf
                JOIN flags_resource f ON sf.flag_id = f.id
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE sf.scenario_id = (SELECT scenario_id FROM params)
                  AND f.name = 'objectives_enabled'
                  AND sf.active = true
                  AND sf.value = true
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, f.generated, 3 as priority
                FROM flags_resource f
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE f.name = 'objectives_enabled'
            ) fd
            ORDER BY priority
            LIMIT 1
        ) as objectives_enabled_flag_resource
    FROM params
),
images_enabled_flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id
             FROM flags_draft df
             JOIN flags_resource f ON df.flags_id = f.id
             WHERE df.draft_id = (SELECT draft_id FROM params)
               AND f.name = 'images_enabled'
               AND df.active = true
             LIMIT 1),
            (SELECT sf.flag_id
             FROM scenario_flags_junction sf
             JOIN flags_resource f ON sf.flag_id = f.id
             WHERE sf.scenario_id = (SELECT scenario_id FROM params)
               AND f.name = 'images_enabled'
               AND sf.active = true
               AND sf.value = true
             LIMIT 1)
        ) as images_enabled_flag_id,
        (
            SELECT ROW(fd.id, fd.name, COALESCE(fd.description, ''), fd.icon_id, fd.icon_name, COALESCE(fd.generated, false))::types.q_get_scenario_v4_flag_resource
            FROM (
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, df.generated, 1 as priority
                FROM flags_draft df
                JOIN flags_resource f ON df.flags_id = f.id
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND f.name = 'images_enabled'
                  AND df.active = true
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, sf.generated, 2 as priority
                FROM scenario_flags_junction sf
                JOIN flags_resource f ON sf.flag_id = f.id
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE sf.scenario_id = (SELECT scenario_id FROM params)
                  AND f.name = 'images_enabled'
                  AND sf.active = true
                  AND sf.value = true
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, f.generated, 3 as priority
                FROM flags_resource f
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE f.name = 'images_enabled'
            ) fd
            ORDER BY priority
            LIMIT 1
        ) as images_enabled_flag_resource
    FROM params
),
video_enabled_flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id
             FROM flags_draft df
             JOIN flags_resource f ON df.flags_id = f.id
             WHERE df.draft_id = (SELECT draft_id FROM params)
               AND f.name = 'video_enabled'
               AND df.active = true
             LIMIT 1),
            (SELECT sf.flag_id
             FROM scenario_flags_junction sf
             JOIN flags_resource f ON sf.flag_id = f.id
             WHERE sf.scenario_id = (SELECT scenario_id FROM params)
               AND f.name = 'video_enabled'
               AND sf.active = true
               AND sf.value = true
             LIMIT 1)
        ) as video_enabled_flag_id,
        (
            SELECT ROW(fd.id, fd.name, COALESCE(fd.description, ''), fd.icon_id, fd.icon_name, COALESCE(fd.generated, false))::types.q_get_scenario_v4_flag_resource
            FROM (
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, df.generated, 1 as priority
                FROM flags_draft df
                JOIN flags_resource f ON df.flags_id = f.id
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND f.name = 'video_enabled'
                  AND df.active = true
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, sf.generated, 2 as priority
                FROM scenario_flags_junction sf
                JOIN flags_resource f ON sf.flag_id = f.id
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE sf.scenario_id = (SELECT scenario_id FROM params)
                  AND f.name = 'video_enabled'
                  AND sf.active = true
                  AND sf.value = true
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, f.generated, 3 as priority
                FROM flags_resource f
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE f.name = 'video_enabled'
            ) fd
            ORDER BY priority
            LIMIT 1
        ) as video_enabled_flag_resource
    FROM params
),
questions_enabled_flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id
             FROM flags_draft df
             JOIN flags_resource f ON df.flags_id = f.id
             WHERE df.draft_id = (SELECT draft_id FROM params)
               AND f.name = 'questions_enabled'
               AND df.active = true
             LIMIT 1),
            (SELECT sf.flag_id
             FROM scenario_flags_junction sf
             JOIN flags_resource f ON sf.flag_id = f.id
             WHERE sf.scenario_id = (SELECT scenario_id FROM params)
               AND f.name = 'questions_enabled'
               AND sf.active = true
               AND sf.value = true
             LIMIT 1)
        ) as questions_enabled_flag_id,
        (
            SELECT ROW(fd.id, fd.name, COALESCE(fd.description, ''), fd.icon_id, fd.icon_name, COALESCE(fd.generated, false))::types.q_get_scenario_v4_flag_resource
            FROM (
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, df.generated, 1 as priority
                FROM flags_draft df
                JOIN flags_resource f ON df.flags_id = f.id
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND f.name = 'questions_enabled'
                  AND df.active = true
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, sf.generated, 2 as priority
                FROM scenario_flags_junction sf
                JOIN flags_resource f ON sf.flag_id = f.id
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE sf.scenario_id = (SELECT scenario_id FROM params)
                  AND f.name = 'questions_enabled'
                  AND sf.active = true
                  AND sf.value = true
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, f.generated, 3 as priority
                FROM flags_resource f
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE f.name = 'questions_enabled'
            ) fd
            ORDER BY priority
            LIMIT 1
        ) as questions_enabled_flag_resource
    FROM params
),
problem_statement_enabled_flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id
             FROM flags_draft df
             JOIN flags_resource f ON df.flags_id = f.id
             WHERE df.draft_id = (SELECT draft_id FROM params)
               AND f.name = 'problem_statement_enabled'
               AND df.active = true
             LIMIT 1),
            (SELECT sf.flag_id
             FROM scenario_flags_junction sf
             JOIN flags_resource f ON sf.flag_id = f.id
             WHERE sf.scenario_id = (SELECT scenario_id FROM params)
               AND f.name = 'problem_statement_enabled'
               AND sf.active = true
               AND sf.value = true
             LIMIT 1)
        ) as problem_statement_enabled_flag_id,
        (
            SELECT ROW(fd.id, fd.name, COALESCE(fd.description, ''), fd.icon_id, fd.icon_name, COALESCE(fd.generated, false))::types.q_get_scenario_v4_flag_resource
            FROM (
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, df.generated, 1 as priority
                FROM flags_draft df
                JOIN flags_resource f ON df.flags_id = f.id
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND f.name = 'problem_statement_enabled'
                  AND df.active = true
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, sf.generated, 2 as priority
                FROM scenario_flags_junction sf
                JOIN flags_resource f ON sf.flag_id = f.id
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE sf.scenario_id = (SELECT scenario_id FROM params)
                  AND f.name = 'problem_statement_enabled'
                  AND sf.active = true
                  AND sf.value = true
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, f.generated, 3 as priority
                FROM flags_resource f
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE f.name = 'problem_statement_enabled'
            ) fd
            ORDER BY priority
            LIMIT 1
        ) as problem_statement_enabled_flag_resource
    FROM params
),
use_templates_flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id
             FROM flags_draft df
             JOIN flags_resource f ON df.flags_id = f.id
             WHERE df.draft_id = (SELECT draft_id FROM params)
               AND f.name = 'use_templates'
               AND df.active = true
             LIMIT 1),
            (SELECT sf.flag_id
             FROM scenario_flags_junction sf
             JOIN flags_resource f ON sf.flag_id = f.id
             WHERE sf.scenario_id = (SELECT scenario_id FROM params)
               AND f.name = 'use_templates'
               AND sf.active = true
               AND sf.value = true
             LIMIT 1)
        ) as use_templates_flag_id,
        (
            SELECT ROW(fd.id, fd.name, COALESCE(fd.description, ''), fd.icon_id, fd.icon_name, COALESCE(fd.generated, false))::types.q_get_scenario_v4_flag_resource
            FROM (
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, df.generated, 1 as priority
                FROM flags_draft df
                JOIN flags_resource f ON df.flags_id = f.id
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND f.name = 'use_templates'
                  AND df.active = true
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, sf.generated, 2 as priority
                FROM scenario_flags_junction sf
                JOIN flags_resource f ON sf.flag_id = f.id
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE sf.scenario_id = (SELECT scenario_id FROM params)
                  AND f.name = 'use_templates'
                  AND sf.active = true
                  AND sf.value = true
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, i.name as icon_name, f.generated, 3 as priority
                FROM flags_resource f
                LEFT JOIN icons_resource i ON i.id = f.icon_id
                WHERE f.name = 'use_templates'
            ) fd
            ORDER BY priority
            LIMIT 1
        ) as use_templates_flag_resource
    FROM params
),
-- Suggestions CTEs (UUID arrays, two-part filtering: linked to scenarios OR same group with generated=true)
-- Name suggestions
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(sn.name_id ORDER BY sn.created_at DESC)
             FROM (
                 SELECT DISTINCT sn.name_id, MAX(sn.created_at) as created_at
                 FROM scenario_names_junction sn
                 JOIN names_resource n ON n.id = sn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE sn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to scenarios (scenario_names_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true
                       sn.generated = false
                       OR
                       (
                           sn.generated = true
                           AND n.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls_entry c
                               JOIN runs_entry r ON r.id = c.run_id
                               WHERE c.id = n.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY sn.name_id
                 ORDER BY MAX(sn.created_at) DESC
                 LIMIT 20
             ) sn),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    LIMIT 1
),
-- Description suggestions
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(sd.description_id ORDER BY sd.created_at DESC)
             FROM (
                 SELECT DISTINCT sd.description_id, MAX(sd.created_at) as created_at
                 FROM scenario_descriptions_junction sd
                 JOIN descriptions_resource d ON d.id = sd.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE sd.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       (SELECT description_search FROM params LIMIT 1) IS NULL
                       OR LOWER(d.description) LIKE '%' || LOWER((SELECT description_search FROM params LIMIT 1)) || '%'
                   )
                   AND (
                       -- Option 1: Linked to scenarios
                       -- Option 2: OR linked to same group with generated=true
                       sd.generated = false
                       OR
                       (
                           sd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls_entry c
                               JOIN runs_entry r ON r.id = c.run_id
                               WHERE c.id = d.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY sd.description_id
                 ORDER BY MAX(sd.created_at) DESC
                 LIMIT 20
             ) sd),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    LIMIT 1
),
-- Problem statement suggestions
problem_statement_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(sps.problem_statement_id ORDER BY sps.created_at DESC)
             FROM (
                 SELECT DISTINCT sps.problem_statement_id, MAX(sps.created_at) as created_at
                 FROM scenario_problem_statements_junction sps
                 JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
                 CROSS JOIN draft_group_data dgd
                 WHERE sps.problem_statement_id IS NOT NULL
                   AND ps.problem_statement IS NOT NULL
                   AND ps.problem_statement != ''
                   AND (
                       (SELECT problem_statement_search FROM params LIMIT 1) IS NULL
                       OR LOWER(ps.problem_statement) LIKE '%' || LOWER((SELECT problem_statement_search FROM params LIMIT 1)) || '%'
                       OR LOWER(COALESCE(ps.name, '')) LIKE '%' || LOWER((SELECT problem_statement_search FROM params LIMIT 1)) || '%'
                   )
                   AND (
                       -- Option 1: Linked to scenarios
                       -- Option 2: OR linked to same group with generated=true
                       sps.generated = false
                       OR
                       (
                           sps.generated = true
                           AND ps.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls_entry c
                               JOIN runs_entry r ON r.id = c.run_id
                               WHERE c.id = ps.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY sps.problem_statement_id
                 ORDER BY MAX(sps.created_at) DESC
                 LIMIT 20
             ) sps),
            ARRAY[]::uuid[]
        ) as problem_statement_suggestions
    FROM params
    LIMIT 1
),
-- Suggested resource objects CTEs - fetch full resource objects for suggestions
names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_scenario_v4_name_resource
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_scenario_v4_name_resource[]
        ) as names
    FROM params
    LIMIT 1
),
descriptions_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (d.id, d.description, COALESCE(d.generated, false))::types.q_get_scenario_v4_description_resource
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions_resource d ON d.id = suggestion_id
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_scenario_v4_description_resource[]
        ) as descriptions
    FROM params
    LIMIT 1
),
problem_statements_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (ps.id, ps.name, ps.problem_statement, COALESCE(ps.generated, false))::types.q_get_scenario_v4_problem_statement_resource
                    ORDER BY array_position(psd.problem_statement_suggestions, ps.id)
                )
                FROM problem_statement_suggestions_data psd
                CROSS JOIN LATERAL unnest(psd.problem_statement_suggestions) AS suggestion_id
                JOIN problem_statements_resource ps ON ps.id = suggestion_id
                WHERE ps.problem_statement IS NOT NULL AND ps.problem_statement != ''
            ),
            ARRAY[]::types.q_get_scenario_v4_problem_statement_resource[]
        ) as problem_statements
    FROM params
    LIMIT 1
),
scenario_simulation_attributes AS (
    SELECT DISTINCT ON (ss.scenario_id)
        ss.scenario_id,
        COALESCE((SELECT ssf.value FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
            AND sfr.scenario_id = ss.scenario_id 
            AND f.name = 'hints_enabled'), false) as hints_enabled
    FROM params x
    LEFT JOIN simulation_scenarios_junction ss ON ss.scenario_id = x.scenario_id
    WHERE x.scenario_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
          AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' 
          AND ssf.value = true)
    ORDER BY ss.scenario_id, (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1)
    LIMIT 1
),
scenario_personas_agg AS (
    SELECT 
        CASE 
            WHEN (SELECT scenario_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(ARRAY_AGG(sp.persona_id ORDER BY sp.persona_id), ARRAY[]::uuid[])
        END as persona_ids
    FROM params x
    LEFT JOIN scenario_personas_junction sp ON sp.scenario_id = x.scenario_id AND sp.active = true
    WHERE x.scenario_id IS NOT NULL
),
scenario_documents_agg AS (
    SELECT 
        CASE 
            WHEN (SELECT scenario_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(ARRAY_AGG(sd.document_id ORDER BY sd.document_id), ARRAY[]::uuid[])
        END as document_ids
    FROM params x
    LEFT JOIN scenario_documents_junction sd ON sd.scenario_id = x.scenario_id AND sd.active = true
    WHERE x.scenario_id IS NOT NULL
),
scenario_videos_array AS (
    SELECT 
        v.id,
        v.name,
        v.length_seconds,
        v.completed,
        v.active,
        u.file_path,
        u.mime_type,
        u.id as upload_id,
        CASE WHEN sv.scenario_id IS NOT NULL THEN 0 ELSE 1 END as sort_order,
        v.created_at
    FROM videos_resource v
    LEFT JOIN uploads_entry u ON u.id = v.upload_id
    LEFT JOIN scenario_videos_junction sv ON sv.video_id = v.id AND sv.scenario_id = (SELECT scenario_id FROM params) AND sv.active = true
    WHERE v.active = true
),
scenario_questions_array AS (
    SELECT 
        q.id,
        q.question_text,
        q.allow_multiple,
        COALESCE(sq.active, q.active) as active,
        CASE WHEN sq.scenario_id IS NOT NULL THEN 0 ELSE 1 END as sort_order,
        q.created_at
    FROM questions_resource q
    LEFT JOIN scenario_questions_junction sq ON sq.question_id = q.id AND sq.scenario_id = (SELECT scenario_id FROM params) AND sq.active = true
    WHERE q.active = true
),
question_options_array AS (
    SELECT 
        q.id as question_id,
        opt.id,
        opt.option_text,
        opt.is_correct
    FROM scenario_questions_array q
    JOIN scenario_options_junction so ON so.scenario_id = (SELECT scenario_id FROM params) AND so.active = true
    JOIN options_resource opt ON opt.id = so.option_id AND opt.active = true
),
question_times_array AS (
    SELECT 
        q.id as question_id,
        q.time
    FROM scenario_questions_junction sq
    JOIN questions_resource q ON q.id = sq.question_id
    WHERE sq.scenario_id = (SELECT scenario_id FROM params) 
    AND sq.active = true
    AND q.active = true
),
scenario_images_array AS (
    SELECT 
        COALESCE(i.upload_id, i.id) as upload_id,
        i.name,
        u.file_path,
        u.mime_type,
        i.active,
        i.created_at,
        i.created_at as updated_at,
        CASE WHEN si.scenario_id IS NOT NULL THEN 0 ELSE 1 END as sort_order
    FROM images_resource i
    LEFT JOIN uploads_entry u ON u.id = i.upload_id
    LEFT JOIN scenario_images_junction si ON si.image_id = i.id AND si.scenario_id = (SELECT scenario_id FROM params) AND si.active = true
    WHERE i.active = true
),
scenario_objectives_array AS (
    SELECT 
        o.id as objective_id,
        o.objective as name,
        o.objective as description,
        CASE WHEN so.scenario_id IS NOT NULL THEN 0 ELSE 1 END as sort_order,
        COALESCE(so.idx, 999999) as idx,
        o.created_at
    FROM objectives_resource o
    LEFT JOIN scenario_objectives_junction so ON so.objective_id = o.id AND so.scenario_id = (SELECT scenario_id FROM params)),
objective_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(so.objective_id ORDER BY so.idx, so.objective_id)
             FROM scenario_objectives_junction so
             WHERE so.scenario_id = (SELECT scenario_id FROM params LIMIT 1)),
            ARRAY[]::uuid[]
        ) as objective_suggestions
),
scenario_simulations_agg AS (
    SELECT 
        COALESCE(ARRAY_AGG(DISTINCT ss.simulation_id), ARRAY[]::uuid[]) as simulation_ids,
        COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = x.scenario_id AND f.name = 'scenario_active' AND sf.value = TRUE) THEN ss.simulation_id END) as active_usage_count
    FROM params x
    LEFT JOIN simulation_scenarios_junction ss ON ss.scenario_id = x.scenario_id AND x.scenario_id IS NOT NULL
    LEFT JOIN simulation_scenario_flags_junction ssf ON ssf.simulation_id = ss.simulation_id
    LEFT JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id AND sfr.scenario_id = x.scenario_id
    LEFT JOIN flags_resource f ON sfr.flag_id = f.id AND f.name = 'scenario_active' AND ssf.value = true
    GROUP BY x.scenario_id
),
all_parameters_data AS (
    SELECT 
        p.id as param_id,
        COALESCE((
            SELECT ARRAY_AGG(sf2.field_id ORDER BY sf2.field_id)
            FROM scenario_fields_junction sf2
            JOIN fields_resource f2 ON f2.id = sf2.field_id AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f2.id AND f.name = 'field_active' AND ff.value = TRUE)
            WHERE sf2.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f2.id LIMIT 1) = p.id::uuid AND sf2.active = true
        ), ARRAY[]::uuid[]) as selected_items,
        COALESCE((
            SELECT ARRAY_AGG(id ORDER BY id)
            FROM (
                SELECT f3.id
                FROM field_artifact f3
                LEFT JOIN field_departments_junction fd3 ON fd3.field_id = f3.id AND fd3.active = true
                CROSS JOIN user_departments ud3
                WHERE EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f3.id AND f.name = 'field_active' AND ff.value = TRUE) AND (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f3.id LIMIT 1) IS NOT NULL
                  AND (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f3.id LIMIT 1) = p.id::uuid
                GROUP BY f3.id
                HAVING 
                    COUNT(fd3.field_id) FILTER (WHERE fd3.department_id = ANY(ud3.dept_ids)) > 0
                    OR NOT EXISTS (SELECT 1 FROM field_departments_junction fd4 WHERE fd4.field_id = f3.id AND fd4.active = true)
                UNION
                SELECT sf2.field_id as id
                FROM scenario_fields_junction sf2
                JOIN fields_resource f2 ON f2.id = sf2.field_id AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f2.id AND f.name = 'field_active' AND ff.value = TRUE)
                WHERE sf2.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f2.id LIMIT 1) = p.id::uuid AND sf2.active = true
            ) combined_items
        ), ARRAY[]::uuid[]) as valid_items
    FROM parameter_artifact p
    JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) = p.id AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'field_active' AND ff.value = true)
    LEFT JOIN field_departments_junction fd ON fd.field_id = f.id AND fd.active = true
    CROSS JOIN user_departments ud
    WHERE EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'persona_active' AND pf.value = true)
    GROUP BY p.id
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(ud.dept_ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments_junction fd2 
                      JOIN fields_resource f2 ON f2.id = fd2.field_id 
                      WHERE (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f2.id LIMIT 1) = p.id AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f2.id AND f.name = 'field_active' AND ff.value = TRUE) AND fd2.active = true)
),
valid_personas_filtered AS (
    SELECT DISTINCT
        p.id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '') as description,
        (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as color,
        (SELECT i.name FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as icon,
        false as image_model  -- No longer checking via persona agents
    FROM persona_artifact p
    LEFT JOIN persona_departments_junction pd ON pd.persona_id = p.id AND pd.active = true
    CROSS JOIN user_departments ud
    WHERE EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'persona_active' AND pf.value = true)
    GROUP BY p.id, (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1), (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1)
    HAVING 
        (
            COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY(ud.dept_ids)) > 0
            OR NOT EXISTS (SELECT 1 FROM persona_departments_junction pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
        )
        AND (
            CASE 
                WHEN (SELECT video_enabled FROM scenario_core LIMIT 1) = true THEN
                    -- Include video_parameter OR general parameters
                    EXISTS (
                        SELECT 1 
                        FROM persona_fields_junction pf
                        JOIN fields_resource f_pfield ON f_pfield.id = pf.field_id
                        JOIN parameter_artifact param ON param.id = (SELECT pf2.parameter_id FROM parameter_fields_junction pf2 WHERE pf2.field_id = f_pfield.id LIMIT 1)
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f_pfield.id AND f.name = 'field_active' AND ff.value = TRUE)
                        AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf JOIN flags_resource f ON paramf.flag_id = f.id WHERE paramf.parameter_id = param.id AND f.name = 'parameter_active' AND paramf.value = true)
                        AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = param.id AND fl2.name = 'video_parameter' AND paramf2.value = TRUE)
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM persona_fields_junction pf
                        JOIN field_parameters_junction fcp ON fcp.field_id = pf.field_id AND fcp.type = 'conditional'::parameter_type
                        JOIN parameter_artifact cp ON cp.id = fcp.parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND fcp.active = true
                        AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = cp.id AND fl2.name = 'video_parameter'  AND paramf2.value = TRUE)
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM persona_fields_junction pf
                        JOIN fields_resource f_pfield ON f_pfield.id = pf.field_id
                        JOIN parameter_artifact param ON param.id = (SELECT pf2.parameter_id FROM parameter_fields_junction pf2 WHERE pf2.field_id = f_pfield.id LIMIT 1)
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f_pfield.id AND f.name = 'field_active' AND ff.value = TRUE)
                        AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf JOIN flags_resource f ON paramf.flag_id = f.id WHERE paramf.parameter_id = param.id AND f.name = 'parameter_active' AND paramf.value = true)
                        AND NOT EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = param.id AND fl2.name = 'video_parameter'  AND paramf2.value = TRUE)
                        AND NOT EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = param.id AND fl2.name = 'scenario_parameter'  AND paramf2.value = TRUE)
                    )
                ELSE
                    -- Include scenario_parameter OR general parameters
                    EXISTS (
                        SELECT 1 
                        FROM persona_fields_junction pf
                        JOIN fields_resource f_pfield ON f_pfield.id = pf.field_id
                        JOIN parameter_artifact param ON param.id = (SELECT pf2.parameter_id FROM parameter_fields_junction pf2 WHERE pf2.field_id = f_pfield.id LIMIT 1)
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f_pfield.id AND f.name = 'field_active' AND ff.value = TRUE)
                        AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf JOIN flags_resource f ON paramf.flag_id = f.id WHERE paramf.parameter_id = param.id AND f.name = 'parameter_active' AND paramf.value = true)
                        AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = param.id AND fl2.name = 'scenario_parameter' AND paramf2.value = TRUE)
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM persona_fields_junction pf
                        JOIN field_parameters_junction fcp ON fcp.field_id = pf.field_id AND fcp.type = 'conditional'::parameter_type
                        JOIN parameter_artifact cp ON cp.id = fcp.parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND fcp.active = true
                        AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = cp.id AND fl2.name = 'scenario_parameter'  AND paramf2.value = TRUE)
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM persona_fields_junction pf
                        JOIN fields_resource f_pfield ON f_pfield.id = pf.field_id
                        JOIN parameter_artifact param ON param.id = (SELECT pf2.parameter_id FROM parameter_fields_junction pf2 WHERE pf2.field_id = f_pfield.id LIMIT 1)
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f_pfield.id AND f.name = 'field_active' AND ff.value = TRUE)
                        AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf JOIN flags_resource f ON paramf.flag_id = f.id WHERE paramf.parameter_id = param.id AND f.name = 'parameter_active' AND paramf.value = true)
                        AND NOT EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = param.id AND fl2.name = 'video_parameter'  AND paramf2.value = TRUE)
                        AND NOT EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = param.id AND fl2.name = 'scenario_parameter'  AND paramf2.value = TRUE)
                    )
            END
        )
        -- Filter by selected departments
        AND (
            (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM persona_departments_junction pd_filter
                WHERE pd_filter.persona_id = p.id
                AND pd_filter.active = true
                AND pd_filter.department_id = ANY((SELECT filter_department_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Filter by selected parameters (persona must have fields from selected parameters)
        AND (
            (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM persona_fields_junction pf_filter
                JOIN fields_resource f_pfield_filter ON f_pfield_filter.id = pf_filter.field_id
                WHERE pf_filter.persona_id = p.id
                AND pf_filter.active = true
                AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f_pfield_filter.id AND f.name = 'field_active' AND ff.value = TRUE)
                AND (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f_pfield_filter.id LIMIT 1) = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Filter by selected fields (persona must have selected fields)
        AND (
            (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM persona_fields_junction pf_field_filter
                WHERE pf_field_filter.persona_id = p.id
                AND pf_field_filter.active = true
                AND pf_field_filter.field_id = ANY((SELECT filter_field_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Search filter
        AND (
            (SELECT persona_search FROM params LIMIT 1) IS NULL
            OR LOWER((SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1)) LIKE '%' || LOWER((SELECT persona_search FROM params LIMIT 1)) || '%'
            OR LOWER(COALESCE((SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '')) LIKE '%' || LOWER((SELECT persona_search FROM params LIMIT 1)) || '%'
        )
        -- Show selected filter
        AND (
            (SELECT persona_show_selected FROM params LIMIT 1) = false
            OR (SELECT array_length(filter_persona_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_persona_ids, 1) FROM params LIMIT 1) = 0
            OR p.id = ANY((SELECT filter_persona_ids FROM params LIMIT 1)::uuid[])
        )
),
persona_data_base AS (
    SELECT 
        p.id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1),
        (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as color,
        (SELECT i.name FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as icon,
        p.image_model
    FROM valid_personas_filtered p
    UNION
    SELECT DISTINCT
        p2.id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p2.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p2.id LIMIT 1), '') as description,
        (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p2.id LIMIT 1) as color,
        (SELECT i.name FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p2.id LIMIT 1) as icon,
        false as image_model  -- No longer checking via persona agents
    FROM scenario_personas_agg spa
    CROSS JOIN LATERAL unnest(spa.persona_ids) as persona_id
    JOIN persona_artifact p2 ON p2.id = persona_id::uuid
    WHERE EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.persona_id = p2.id AND fl.name = 'persona_active' AND pf.value = TRUE)
),
persona_data AS (
    SELECT DISTINCT
        pdb.id,
        pdb.name,
        pdb.description,
        pdb.color,
        pdb.icon,
        pdb.image_model
    FROM persona_data_base pdb
    WHERE
        -- Filter by selected departments (already filtered in valid_personas_filtered, but apply again for UNION results)
        (
            (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM persona_departments_junction pd_filter
                WHERE pd_filter.persona_id = pdb.id
                AND pd_filter.active = true
                AND pd_filter.department_id = ANY((SELECT filter_department_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Filter by selected parameters
        AND (
            (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM persona_fields_junction pf_filter
                JOIN fields_resource f_pfield_filter ON f_pfield_filter.id = pf_filter.field_id
                WHERE pf_filter.persona_id = pdb.id
                AND pf_filter.active = true
                AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f_pfield_filter.id AND f.name = 'field_active' AND ff.value = TRUE)
                AND (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f_pfield_filter.id LIMIT 1) = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Filter by selected fields
        AND (
            (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM persona_fields_junction pf_field_filter
                WHERE pf_field_filter.persona_id = pdb.id
                AND pf_field_filter.active = true
                AND pf_field_filter.field_id = ANY((SELECT filter_field_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Search filter
        AND (
            (SELECT persona_search FROM params LIMIT 1) IS NULL
            OR LOWER(pdb.name) LIKE '%' || LOWER((SELECT persona_search FROM params LIMIT 1)) || '%'
            OR LOWER(COALESCE(pdb.description, '')) LIKE '%' || LOWER((SELECT persona_search FROM params LIMIT 1)) || '%'
        )
        -- Show selected filter
        AND (
            (SELECT persona_show_selected FROM params LIMIT 1) = false
            OR (SELECT array_length(filter_persona_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_persona_ids, 1) FROM params LIMIT 1) = 0
            OR pdb.id = ANY((SELECT filter_persona_ids FROM params LIMIT 1)::uuid[])
        )
),
persona_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pdb.id ORDER BY pdb.name)
             FROM persona_data pdb),
            ARRAY[]::uuid[]
        ) as persona_suggestions
    FROM params
    LIMIT 1
),
-- Persona parameter relationships: via fields (persona_fields_junction → (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = fields.id LIMIT 1)) and persona_parameter flag
persona_parameter_relationships AS (
    SELECT DISTINCT
        p.id as persona_id,
        param.id as parameter_id
    FROM persona_data p
    CROSS JOIN parameters_resource param
    WHERE EXISTS (SELECT 1 FROM parameter_flags_junction paramf JOIN flags_resource f ON paramf.flag_id = f.id WHERE paramf.parameter_id = param.id AND f.name = 'parameter_active' AND paramf.value = true)
    AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource f ON paramf2.flag_id = f.id WHERE paramf2.parameter_id = param.id  AND paramf2.value = TRUE)
    AND (
        EXISTS (
            SELECT 1 FROM persona_fields_junction pf
            JOIN fields_resource f_pfield ON f_pfield.id = pf.field_id
            WHERE pf.persona_id = p.id
            AND (SELECT pf2.parameter_id FROM parameter_fields_junction pf2 WHERE pf2.field_id = f_pfield.id LIMIT 1) = param.id
            AND pf.active = true
            AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f_pfield.id AND f.name = 'field_active' AND ff.value = TRUE)
        )
    )
),
persona_fields_agg AS (
    SELECT 
        pf.persona_id,
        ARRAY_AGG(pf.field_id ORDER BY pf.field_id) as field_ids
    FROM persona_fields_junction pf
    WHERE pf.persona_id IN (SELECT id FROM persona_data) AND pf.active = true
    GROUP BY pf.persona_id
),
persona_parameter_ids_agg AS (
    SELECT 
        ppr.persona_id,
        ARRAY_AGG(ppr.parameter_id ORDER BY ppr.parameter_id) as parameter_ids
    FROM persona_parameter_relationships ppr
    GROUP BY ppr.persona_id
),
persona_examples_data AS (
    SELECT DISTINCT ON (pe.persona_id)
        pe.persona_id,
        e.example
    FROM persona_examples_junction pe
    JOIN examples_resource e ON e.id = pe.example_id
    WHERE pe.persona_id IN (SELECT id FROM persona_data)
    ORDER BY pe.persona_id, pe.idx
),
valid_personas_array AS (
    SELECT 
        p.id as persona_id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1),
        (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as color,
        (SELECT i.name FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as icon,
        COALESCE(p.image_model, false) as image_model,
        COALESCE(ppia.parameter_ids, ARRAY[]::uuid[]) as parameter_ids,
        COALESCE(pfa.field_ids, ARRAY[]::uuid[]) as field_ids,
        ped.example
    FROM persona_data p
    LEFT JOIN persona_parameter_ids_agg ppia ON ppia.persona_id = p.id
    LEFT JOIN persona_fields_agg pfa ON pfa.persona_id = p.id
    LEFT JOIN persona_examples_data ped ON ped.persona_id = p.id
),
valid_documents_filtered AS (
    SELECT DISTINCT
        d.id,
        (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1) as name,
        ''::text as description,
        u.file_path,
        u.mime_type
    FROM document_artifact d
    LEFT JOIN document_uploads_resource dur ON dur.document_id = d.id AND dur.active = true
    LEFT JOIN uploads_resource ur ON ur.id = dur.uploads_id
    LEFT JOIN uploads_entry u ON u.id = ur.upload_id
    LEFT JOIN document_departments_junction dd ON dd.document_id = d.id AND dd.active = true
    CROSS JOIN user_departments ud
    WHERE EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d.id AND f.name = 'document_active' AND df.value = true)
    GROUP BY d.id, (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1), u.file_path, u.mime_type
    HAVING 
        (
            COUNT(dd.document_id) FILTER (WHERE dd.department_id = ANY(ud.dept_ids)) > 0
            OR NOT EXISTS (SELECT 1 FROM document_departments_junction dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
        )
        AND (
            CASE 
                WHEN (SELECT video_enabled FROM scenario_core LIMIT 1) = true THEN
                    EXISTS (
                        SELECT 1 
                        FROM document_fields_junction df
                        JOIN fields_resource f_pfield ON f_pfield.id = df.field_id
                        JOIN parameter_artifact param ON param.id = (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f_pfield.id LIMIT 1)
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f_pfield.id AND f.name = 'field_active' AND ff.value = TRUE)
                        AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf JOIN flags_resource f ON paramf.flag_id = f.id WHERE paramf.parameter_id = param.id AND f.name = 'parameter_active' AND paramf.value = true)
                        AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = param.id AND fl2.name = 'video_parameter' AND paramf2.value = TRUE)
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM document_fields_junction df
                        JOIN field_parameters_junction fcp ON fcp.field_id = df.field_id AND fcp.type = 'conditional'::parameter_type
                        JOIN parameter_artifact cp ON cp.id = fcp.parameter_id
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND fcp.active = true
                        AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = cp.id AND fl2.name = 'video_parameter'  AND paramf2.value = TRUE)
                    )
                ELSE
                    EXISTS (
                        SELECT 1 
                        FROM document_fields_junction df
                        JOIN fields_resource f_pfield ON f_pfield.id = df.field_id
                        JOIN parameter_artifact param ON param.id = (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f_pfield.id LIMIT 1)
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f_pfield.id AND f.name = 'field_active' AND ff.value = TRUE)
                        AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf JOIN flags_resource f ON paramf.flag_id = f.id WHERE paramf.parameter_id = param.id AND f.name = 'parameter_active' AND paramf.value = true)
                        AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = param.id AND fl2.name = 'scenario_parameter' AND paramf2.value = TRUE)
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM document_fields_junction df
                        JOIN field_parameters_junction fcp ON fcp.field_id = df.field_id AND fcp.type = 'conditional'::parameter_type
                        JOIN parameter_artifact cp ON cp.id = fcp.parameter_id
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND fcp.active = true
                        AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = cp.id AND fl2.name = 'scenario_parameter'  AND paramf2.value = TRUE)
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM document_fields_junction df
                        JOIN fields_resource f_pfield ON f_pfield.id = df.field_id
                        JOIN parameter_artifact param ON param.id = (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f_pfield.id LIMIT 1)
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f_pfield.id AND f.name = 'field_active' AND ff.value = TRUE)
                        AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf JOIN flags_resource f ON paramf.flag_id = f.id WHERE paramf.parameter_id = param.id AND f.name = 'parameter_active' AND paramf.value = true)
                        AND NOT EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = param.id AND fl2.name = 'video_parameter'  AND paramf2.value = TRUE)
                        AND NOT EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = param.id AND fl2.name = 'scenario_parameter'  AND paramf2.value = TRUE)
                    )
            END
        )
        -- Filter by selected departments
        AND (
            (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM document_departments_junction dd_filter
                WHERE dd_filter.document_id = d.id
                AND dd_filter.active = true
                AND dd_filter.department_id = ANY((SELECT filter_department_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Filter by selected parameters (document must have fields from selected parameters)
        AND (
            (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM document_fields_junction df_filter
                JOIN fields_resource f_pfield_filter ON f_pfield_filter.id = df_filter.field_id
                WHERE df_filter.document_id = d.id
                AND df_filter.active = true
                AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f_pfield_filter.id AND f.name = 'field_active' AND ff.value = TRUE)
                AND (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f_pfield_filter.id LIMIT 1) = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Filter by selected fields (document must have selected fields)
        AND (
            (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM document_fields_junction df_field_filter
                WHERE df_field_filter.document_id = d.id
                AND df_field_filter.active = true
                AND df_field_filter.field_id = ANY((SELECT filter_field_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Search filter
        AND (
            (SELECT document_search FROM params LIMIT 1) IS NULL
            OR LOWER((SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1)) LIKE '%' || LOWER((SELECT document_search FROM params LIMIT 1)) || '%'
            OR LOWER(COALESCE((SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1), '')) LIKE '%' || LOWER((SELECT document_search FROM params LIMIT 1)) || '%'
        )
        -- Show selected filter
        AND (
            (SELECT document_show_selected FROM params LIMIT 1) = false
            OR (SELECT array_length(filter_document_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_document_ids, 1) FROM params LIMIT 1) = 0
            OR d.id = ANY((SELECT filter_document_ids FROM params LIMIT 1)::uuid[])
        )
),
document_data_base AS (
    SELECT 
        d.id,
        (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1),
        (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1),
        d.file_path,
        d.mime_type
    FROM valid_documents_filtered d
    UNION
    SELECT DISTINCT
        d2.id,
        (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d2.id LIMIT 1),
        ''::text as description,
        u2.file_path,
        u2.mime_type
    FROM scenario_documents_agg sda
    CROSS JOIN LATERAL unnest(sda.document_ids) as doc_id
    JOIN document_artifact d2 ON d2.id = doc_id::uuid
    LEFT JOIN document_uploads_resource dur2 ON dur2.document_id = d2.id AND dur2.active = true
    LEFT JOIN uploads_resource ur2 ON ur2.id = dur2.uploads_id
    LEFT JOIN uploads_entry u2 ON u2.id = ur2.upload_id
    WHERE EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d2.id AND f.name = 'document_active' AND df.value = TRUE)
    UNION
    SELECT DISTINCT
        d3.id,
        (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d3.id LIMIT 1),
        ''::text as description,
        u3.file_path,
        u3.mime_type
    FROM document_artifact d3
    LEFT JOIN document_uploads_resource dur3 ON dur3.document_id = d3.id AND dur3.active = true
    LEFT JOIN uploads_resource ur3 ON ur3.id = dur3.uploads_id
    LEFT JOIN uploads_entry u3 ON u3.id = ur3.upload_id
    WHERE EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d3.id AND f.name = 'document_active' AND df.value = TRUE)
    AND (SELECT document_ids FROM params LIMIT 1) IS NOT NULL
    AND array_length((SELECT document_ids FROM params LIMIT 1), 1) > 0
    AND d3.id = ANY((SELECT document_ids FROM params LIMIT 1)::uuid[])
    AND (
        CASE 
            WHEN (SELECT video_enabled FROM scenario_core LIMIT 1) = true THEN
                EXISTS (
                    SELECT 1 
                    FROM document_fields_junction df
                    JOIN fields_resource f_pfield ON f_pfield.id = df.field_id
                    JOIN parameter_artifact param ON param.id = (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f_pfield.id LIMIT 1)
                    WHERE df.document_id = d3.id
                    AND df.active = true
                    AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f_pfield.id AND f.name = 'field_active' AND ff.value = TRUE)
                    AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf JOIN flags_resource f ON paramf.flag_id = f.id WHERE paramf.parameter_id = param.id AND f.name = 'parameter_active' AND paramf.value = true)
                    AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = param.id AND fl2.name = 'video_parameter'  AND paramf2.value = TRUE)
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields_junction df
                    JOIN field_parameters_junction fcp ON fcp.field_id = df.field_id AND fcp.type = 'conditional'::parameter_type
                    JOIN parameter_artifact cp ON cp.id = fcp.parameter_id
                    WHERE df.document_id = d3.id
                    AND df.active = true
                    AND fcp.active = true
                    AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = cp.id AND fl2.name = 'video_parameter'  AND paramf2.value = TRUE)
                )
            ELSE
                EXISTS (
                    SELECT 1 
                    FROM document_fields_junction df
                    JOIN fields_resource f_pfield ON f_pfield.id = df.field_id
                    JOIN parameter_artifact param ON param.id = (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f_pfield.id LIMIT 1)
                    WHERE df.document_id = d3.id
                    AND df.active = true
                    AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f_pfield.id AND f.name = 'field_active' AND ff.value = TRUE)
                    AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf JOIN flags_resource f ON paramf.flag_id = f.id WHERE paramf.parameter_id = param.id AND f.name = 'parameter_active' AND paramf.value = true)
                        AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = param.id AND fl2.name = 'scenario_parameter' AND paramf2.value = TRUE)
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields_junction df
                    JOIN field_parameters_junction fcp ON fcp.field_id = df.field_id AND fcp.type = 'conditional'::parameter_type
                    JOIN parameter_artifact cp ON cp.id = fcp.parameter_id
                    WHERE df.document_id = d3.id
                    AND df.active = true
                    AND fcp.active = true
                    AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource fl2 ON paramf2.flag_id = fl2.id WHERE paramf2.parameter_id = cp.id AND fl2.name = 'scenario_parameter'  AND paramf2.value = TRUE)
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields_junction df
                    JOIN fields_resource f_pfield ON f_pfield.id = df.field_id
                    JOIN parameter_artifact param ON param.id = (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f_pfield.id LIMIT 1)
                    WHERE df.document_id = d3.id
                    AND df.active = true
                    AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f_pfield.id AND f.name = 'field_active' AND ff.value = TRUE)
                    AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf JOIN flags_resource f ON paramf.flag_id = f.id WHERE paramf.parameter_id = param.id AND f.name = 'parameter_active' AND paramf.value = true)
                    AND NOT EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource f ON paramf2.flag_id = f.id WHERE paramf2.parameter_id = param.id  AND paramf2.value = TRUE)
                    AND NOT EXISTS (SELECT 1 FROM parameter_flags_junction paramf3 JOIN flags_resource f ON paramf3.flag_id = f.id WHERE paramf3.parameter_id = param.id  AND paramf3.value = TRUE)
                )
        END
    )
),
document_data AS (
    SELECT DISTINCT
        ddb.id,
        ddb.name,
        ddb.description,
        ddb.file_path,
        ddb.mime_type
    FROM document_data_base ddb
    WHERE
        -- Filter by selected departments
        (
            (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM document_departments_junction dd_filter
                WHERE dd_filter.document_id = ddb.id
                AND dd_filter.active = true
                AND dd_filter.department_id = ANY((SELECT filter_department_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Filter by selected parameters
        AND (
            (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM document_fields_junction df_filter
                JOIN fields_resource f_pfield_filter ON f_pfield_filter.id = df_filter.field_id
                WHERE df_filter.document_id = ddb.id
                AND df_filter.active = true
                AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f_pfield_filter.id AND f.name = 'field_active' AND ff.value = TRUE)
                AND (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f_pfield_filter.id LIMIT 1) = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Filter by selected fields
        AND (
            (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM document_fields_junction df_field_filter
                WHERE df_field_filter.document_id = ddb.id
                AND df_field_filter.active = true
                AND df_field_filter.field_id = ANY((SELECT filter_field_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Search filter
        AND (
            (SELECT document_search FROM params LIMIT 1) IS NULL
            OR LOWER(ddb.name) LIKE '%' || LOWER((SELECT document_search FROM params LIMIT 1)) || '%'
            OR LOWER(COALESCE(ddb.description, '')) LIKE '%' || LOWER((SELECT document_search FROM params LIMIT 1)) || '%'
        )
        -- Show selected filter
        AND (
            (SELECT document_show_selected FROM params LIMIT 1) = false
            OR (SELECT array_length(filter_document_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_document_ids, 1) FROM params LIMIT 1) = 0
            OR ddb.id = ANY((SELECT filter_document_ids FROM params LIMIT 1)::uuid[])
        )
),
document_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(ddb.id ORDER BY ddb.name)
             FROM document_data ddb),
            ARRAY[]::uuid[]
        ) as document_suggestions
    FROM params
    LIMIT 1
),
document_parameter_relationships AS (
    SELECT DISTINCT
        d.id as document_id,
        param.id as parameter_id
    FROM document_data d
    CROSS JOIN parameters_resource param
    WHERE EXISTS (SELECT 1 FROM parameter_flags_junction paramf JOIN flags_resource f ON paramf.flag_id = f.id WHERE paramf.parameter_id = param.id AND f.name = 'parameter_active' AND paramf.value = true)
    AND EXISTS (SELECT 1 FROM parameter_flags_junction paramf2 JOIN flags_resource f ON paramf2.flag_id = f.id WHERE paramf2.parameter_id = param.id  AND paramf2.value = TRUE)
    AND (
        EXISTS (
            SELECT 1 FROM document_fields_junction df
            JOIN fields_resource f_pfield ON f_pfield.id = df.field_id
            WHERE df.document_id = d.id
            AND (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f_pfield.id LIMIT 1) = param.id
            AND df.active = true
            AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f_pfield.id AND f.name = 'field_active' AND ff.value = TRUE)
        )
    )
),
document_fields_agg AS (
    SELECT 
        df.document_id,
        ARRAY_AGG(df.field_id ORDER BY df.field_id) as field_ids
    FROM document_fields_junction df
    WHERE df.document_id IN (SELECT id FROM document_data) AND df.active = true
    GROUP BY df.document_id
),
document_parameter_ids_agg AS (
    SELECT 
        dpr.document_id,
        ARRAY_AGG(dpr.parameter_id ORDER BY dpr.parameter_id) as parameter_ids
    FROM document_parameter_relationships dpr
    GROUP BY dpr.document_id
),
document_parent_ids AS (
    -- document_tree removed - document hierarchy no longer supported
    SELECT NULL::uuid as document_id, NULL::uuid as parent_id WHERE false
),
valid_documents_array AS (
    SELECT 
        d.id as document_id,
        (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1),
        (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1),
        d.file_path,
        d.mime_type,
        COALESCE(dpia.parameter_ids, ARRAY[]::uuid[]) as parameter_ids,
        COALESCE(dfa.field_ids, ARRAY[]::uuid[]) as field_ids,
        dpi.parent_id as parent_document_id
    FROM document_data d
    LEFT JOIN document_parameter_ids_agg dpia ON dpia.document_id = d.id
    LEFT JOIN document_fields_agg dfa ON dfa.document_id = d.id
    LEFT JOIN document_parent_ids dpi ON dpi.document_id = d.id
),
scenario_documents_array AS (
    SELECT 
        d.id as document_id,
        (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1),
        ''::text as description,
        u.file_path,
        u.mime_type,
        ARRAY[]::uuid[] as parameter_ids,
        ARRAY[]::uuid[] as field_ids,
        NULL::uuid as parent_document_id
    FROM scenario_documents_junction sd
    JOIN documents_resource d ON d.id = sd.document_id
    LEFT JOIN document_uploads_resource dur ON dur.document_id = d.id AND dur.active = true
    LEFT JOIN uploads_resource ur ON ur.id = dur.uploads_id
    LEFT JOIN uploads_entry u ON u.id = ur.upload_id
    WHERE sd.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sd.active = true AND EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d.id AND f.name = 'document_active' AND df.value = true)
),
all_documents_array AS (
    SELECT * FROM valid_documents_array
    UNION
    SELECT * FROM scenario_documents_array
),
document_details_array AS (
    SELECT 
        dd.id as document_id,
        (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = dd.id LIMIT 1),
        d.updated_at,
        CASE WHEN dd.file_path IS NOT NULL THEN SUBSTRING(dd.file_path FROM '\\.([^\\.]+)$') ELSE NULL END as extension,
        COALESCE((
            SELECT ARRAY_AGG(sd2.scenario_id ORDER BY sd2.scenario_id)
            FROM scenario_documents_junction sd2
            WHERE sd2.document_id = dd.id AND sd2.active = true
        ), ARRAY[]::uuid[]) as scenario_ids,
        true as can_edit,
        true as can_delete,
        EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = dd.id AND f.name = 'document_active' AND df.value = TRUE) as active,
        COALESCE((
            SELECT ARRAY_AGG(dd2.department_id ORDER BY dd2.department_id)
            FROM document_departments_junction dd2
            WHERE dd2.document_id = dd.id AND dd2.active = true
        ), NULL::uuid[]) as department_ids,
        dd.file_path,
        dd.mime_type,
        (SELECT ur.upload_id FROM document_uploads_resource dur JOIN uploads_resource ur ON ur.id = dur.uploads_id WHERE dur.document_id = dd.id AND dur.active = true ORDER BY dur.created_at DESC LIMIT 1) as upload_id,
        COALESCE((
            SELECT ARRAY_AGG(df.field_id ORDER BY df.field_id)
            FROM document_fields_junction df
            WHERE df.document_id = dd.id AND df.active = true
        ), ARRAY[]::uuid[]) as field_ids,
        CASE 
            WHEN EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = dd.id AND f.name = 'template' AND df.value = TRUE) THEN true
            ELSE false
        END as is_template,
        NULL::uuid as parent_document_id
    FROM document_data dd
    JOIN document_artifact d ON d.id = dd.id
),
simulation_data AS (
    SELECT 
        s.id as simulation_id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), '') as description,
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)
             FROM simulation_scenario_time_limits_junction sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
             WHERE sstl.simulation_id = s.id AND sstl.active = true AND stlr.active = true AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)),
            0
        ) as time_limit,
        COALESCE((
            SELECT ARRAY_AGG(sd.department_id ORDER BY sd.created_at)
            FROM simulation_departments_junction sd
            WHERE sd.simulation_id = s.id AND sd.active = true
        ), NULL::uuid[]) as department_ids
    FROM simulation_artifact s
    WHERE s.id = ANY(
        COALESCE((SELECT ARRAY_AGG(sim_id::uuid) FROM (SELECT unnest(simulation_ids) as sim_id FROM scenario_simulations_agg) t), ARRAY[]::uuid[])
    )
),
linked_scenario_parameters AS (
    SELECT DISTINCT
        p.id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM parameter_flags_junction paramf JOIN flags_resource f ON paramf.flag_id = f.id WHERE paramf.parameter_id = p.id  AND paramf.value = TRUE) as document_parameter,
        EXISTS (SELECT 1 FROM parameter_flags_junction paramf JOIN flags_resource f ON paramf.flag_id = f.id WHERE paramf.parameter_id = p.id  AND paramf.value = TRUE) as persona_parameter,
        EXISTS (SELECT 1 FROM parameter_flags_junction paramf JOIN flags_resource f ON paramf.flag_id = f.id WHERE paramf.parameter_id = p.id  AND paramf.value = TRUE) as scenario_parameter,
        EXISTS (SELECT 1 FROM parameter_flags_junction paramf JOIN flags_resource f ON paramf.flag_id = f.id WHERE paramf.parameter_id = p.id  AND paramf.value = TRUE) as video_parameter
    FROM scenario_parameters_junction sp
    JOIN parameters_resource p ON p.id = sp.parameter_id
    WHERE sp.scenario_id = (SELECT scenario_id FROM params)
    AND sp.active = true
    AND EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = p.id AND f.name = 'persona_active' AND pf.value = true)
),
parameter_data_for_mapping AS (
    SELECT DISTINCT 
        p.id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id  AND pf.value = TRUE) as document_parameter,
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id  AND pf.value = TRUE) as persona_parameter,
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id  AND pf.value = TRUE) as scenario_parameter,
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id  AND pf.value = TRUE) as video_parameter
    FROM parameter_artifact p
    JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) = p.id AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'field_active' AND ff.value = true)
    LEFT JOIN field_departments_junction fd ON fd.field_id = f.id AND fd.active = true
    CROSS JOIN user_departments ud
    WHERE EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'persona_active' AND pf.value = true)
    AND EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id  AND pf.value = TRUE)
    GROUP BY p.id, name, description, EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id  AND pf.value = TRUE), EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id  AND pf.value = TRUE), EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id  AND pf.value = TRUE), EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id  AND pf.value = TRUE)
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(ud.dept_ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments_junction fd2 
                      JOIN fields_resource f2 ON f2.id = fd2.field_id 
                      WHERE (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f2.id LIMIT 1) = p.id AND EXISTS (SELECT 1 FROM field_flags_junction ff2 JOIN flags_resource fl2 ON ff2.flag_id = fl2.id WHERE ff2.field_id = f2.id AND fl2.name = 'field_active' AND ff2.value = TRUE) AND fd2.active = true)
        -- Filter by selected departments
        AND (
            (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM field_artifact f_dept_filter
                JOIN field_departments_junction fd_dept_filter ON fd_dept_filter.field_id = f_dept_filter.id
                WHERE (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f_dept_filter.id LIMIT 1) = p.id
                AND EXISTS (SELECT 1 FROM field_flags_junction ff_dept_filter JOIN flags_resource fl_dept_filter ON ff_dept_filter.flag_id = fl_dept_filter.id WHERE ff_dept_filter.field_id = f_dept_filter.id AND fl_dept_filter.name = 'active' AND ff_dept_filter.value = TRUE)
                AND fd_dept_filter.active = true
                AND fd_dept_filter.department_id = ANY((SELECT filter_department_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Search filter
        AND (
            (SELECT parameter_search FROM params LIMIT 1) IS NULL
            OR LOWER((SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1)) LIKE '%' || LOWER((SELECT parameter_search FROM params LIMIT 1)) || '%'
            OR LOWER(COALESCE((SELECT d.description FROM parameter_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1), '')) LIKE '%' || LOWER((SELECT parameter_search FROM params LIMIT 1)) || '%'
        )
        -- Show selected filter
        AND (
            (SELECT parameter_show_selected FROM params LIMIT 1) = false
            OR (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) = 0
            OR p.id = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
        )
    ORDER BY name
),
all_parameters_array_base AS (
    SELECT * FROM linked_scenario_parameters
    UNION
    SELECT * FROM parameter_data_for_mapping
),
all_parameters_array AS (
    SELECT DISTINCT
        apab.id,
        apab.name,
        apab.description,
        apab.document_parameter,
        apab.persona_parameter,
        apab.scenario_parameter,
        apab.video_parameter
    FROM all_parameters_array_base apab
    WHERE
        -- Filter by selected departments
        (
            (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM field_artifact f_dept_filter
                JOIN field_departments_junction fd_dept_filter ON fd_dept_filter.field_id = f_dept_filter.id
                WHERE (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f_dept_filter.id LIMIT 1) = apab.id
                AND EXISTS (SELECT 1 FROM field_flags_junction ff_dept_filter JOIN flags_resource fl_dept_filter ON ff_dept_filter.flag_id = fl_dept_filter.id WHERE ff_dept_filter.field_id = f_dept_filter.id AND fl_dept_filter.name = 'active' AND ff_dept_filter.value = TRUE)
                AND fd_dept_filter.active = true
                AND fd_dept_filter.department_id = ANY((SELECT filter_department_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Search filter
        AND (
            (SELECT parameter_search FROM params LIMIT 1) IS NULL
            OR LOWER(apab.name) LIKE '%' || LOWER((SELECT parameter_search FROM params LIMIT 1)) || '%'
            OR LOWER(COALESCE(apab.description, '')) LIKE '%' || LOWER((SELECT parameter_search FROM params LIMIT 1)) || '%'
        )
        -- Show selected filter
        AND (
            (SELECT parameter_show_selected FROM params LIMIT 1) = false
            OR (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) = 0
            OR apab.id = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
        )
),
field_conditional_parameters_data AS (
    SELECT 
        fcp.field_id,
        ARRAY_AGG(fcp.parameter_id ORDER BY fcp.parameter_id) as conditional_parameter_ids
    FROM field_parameters_junction fcp
    WHERE fcp.active = true AND fcp.type = 'conditional'::parameter_type
    GROUP BY fcp.field_id
),
parameter_item_data AS (
    SELECT 
        f.id,
        (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        COALESCE((SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), '') as description,
        (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1),
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as parameter_name
    FROM field_artifact f
    JOIN parameter_artifact p ON p.id = (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1)
    LEFT JOIN field_departments_junction fd ON fd.field_id = f.id AND fd.active = true
    CROSS JOIN user_departments ud
    WHERE EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'persona_active' AND pf.value = true) AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'field_active' AND ff.value = true)
    GROUP BY f.id, (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), (SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1), p.id, (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1)
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(ud.dept_ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments_junction fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
        -- Filter by selected departments
        AND (
            (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM field_departments_junction fd_dept_filter
                WHERE fd_dept_filter.field_id = f.id
                AND fd_dept_filter.active = true
                AND fd_dept_filter.department_id = ANY((SELECT filter_department_ids FROM params LIMIT 1)::uuid[])
            )
            OR NOT EXISTS (SELECT 1 FROM field_departments_junction fd_no_dept WHERE fd_no_dept.field_id = f.id AND fd_no_dept.active = true)
        )
        -- Filter by selected parameters (field must belong to selected parameter)
        AND (
            (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) = 0
            OR (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
        )
        -- Filter by selected fields
        AND (
            (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) = 0
            OR f.id = ANY((SELECT filter_field_ids FROM params LIMIT 1)::uuid[])
        )
        -- Filter by selected personas (field must be linked to selected personas)
        AND (
            (SELECT array_length(filter_persona_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_persona_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM persona_fields_junction pf_persona_filter
                WHERE pf_persona_filter.field_id = f.id
                AND pf_persona_filter.active = true
                AND pf_persona_filter.persona_id = ANY((SELECT filter_persona_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Filter by selected documents (field must be linked to selected documents)
        AND (
            (SELECT array_length(filter_document_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_document_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM document_fields_junction df_doc_filter
                WHERE df_doc_filter.field_id = f.id
                AND df_doc_filter.active = true
                AND df_doc_filter.document_id = ANY((SELECT filter_document_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Per-parameter show_selected filter
        AND (
            array_length((SELECT field_show_selected_by_param FROM params LIMIT 1), 1) IS NULL
            OR NOT EXISTS (
                SELECT 1 FROM UNNEST((SELECT field_show_selected_by_param FROM params LIMIT 1)) as fp_filter
                WHERE fp_filter.parameter_id = (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) AND fp_filter.show_selected = true
            )
            OR f.id = ANY((SELECT filter_field_ids FROM params LIMIT 1)::uuid[])
        )
    ORDER BY (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1), (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1)
),
scenario_fields_data AS (
    SELECT 
        f.id as id,
        (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), '') as description,
        (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) as parameter_id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as parameter_name
    FROM scenario_fields_junction sf
    JOIN fields_resource f ON f.id = sf.field_id
    JOIN parameter_artifact p ON p.id = (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1)
    WHERE sf.scenario_id = (SELECT scenario_id FROM params) AND sf.active = true AND EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'persona_active' AND pf.value = true)
),
all_fields_array_base AS (
    SELECT 
        pi.id as field_id,
        pi.name,
        pi.description,
        pi.parameter_id,
        pi.parameter_name,
        COALESCE(fcpd.conditional_parameter_ids, ARRAY[]::uuid[]) as conditional_parameter_ids
    FROM parameter_item_data pi
    LEFT JOIN field_conditional_parameters_data fcpd ON fcpd.field_id = pi.id
    UNION
    SELECT 
        sf.id as field_id,
        sf.name,
        sf.description,
        sf.parameter_id,
        sf.parameter_name,
        ARRAY[]::uuid[] as conditional_parameter_ids
    FROM scenario_fields_data sf
    WHERE NOT EXISTS (
        SELECT 1 FROM parameter_item_data pi2 WHERE pi2.id = sf.id
    )
),
all_fields_array AS (
    SELECT DISTINCT
        afab.field_id,
        afab.name,
        afab.description,
        afab.parameter_id,
        afab.parameter_name,
        afab.conditional_parameter_ids
    FROM all_fields_array_base afab
    WHERE
        -- Filter by selected departments
        (
            (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM field_departments_junction fd_dept_filter
                WHERE fd_dept_filter.field_id = afab.field_id
                AND fd_dept_filter.active = true
                AND fd_dept_filter.department_id = ANY((SELECT filter_department_ids FROM params LIMIT 1)::uuid[])
            )
            OR NOT EXISTS (SELECT 1 FROM field_departments_junction fd_no_dept WHERE fd_no_dept.field_id = afab.field_id AND fd_no_dept.active = true)
        )
        -- Filter by selected parameters
        AND (
            (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) = 0
            OR afab.parameter_id = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
        )
        -- Filter by selected fields
        AND (
            (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) = 0
            OR afab.field_id = ANY((SELECT filter_field_ids FROM params LIMIT 1)::uuid[])
        )
        -- Filter by selected personas
        AND (
            (SELECT array_length(filter_persona_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_persona_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM persona_fields_junction pf_persona_filter
                WHERE pf_persona_filter.field_id = afab.field_id
                AND pf_persona_filter.active = true
                AND pf_persona_filter.persona_id = ANY((SELECT filter_persona_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Filter by selected documents
        AND (
            (SELECT array_length(filter_document_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_document_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM document_fields_junction df_doc_filter
                WHERE df_doc_filter.field_id = afab.field_id
                AND df_doc_filter.active = true
                AND df_doc_filter.document_id = ANY((SELECT filter_document_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Per-parameter show_selected filter
        AND (
            array_length((SELECT field_show_selected_by_param FROM params LIMIT 1), 1) IS NULL
            OR NOT EXISTS (
                SELECT 1 FROM UNNEST((SELECT field_show_selected_by_param FROM params LIMIT 1)) as fp_filter
                WHERE fp_filter.parameter_id = afab.parameter_id AND fp_filter.show_selected = true
            )
            OR afab.field_id = ANY((SELECT filter_field_ids FROM params LIMIT 1)::uuid[])
        )
),
department_persona_ids AS (
    SELECT 
        dr.id as department_id,
        COALESCE(ARRAY_AGG(p.id ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::uuid[]) as persona_ids
    FROM departments_resource dr
    JOIN department_artifact d ON d.id = dr.department_id
    CROSS JOIN user_departments ud
    LEFT JOIN personas_resource p ON EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = p.id AND f.name = 'persona_active' AND pf.value = true)
    LEFT JOIN persona_departments_junction pd ON pd.persona_id = p.id AND pd.active = true
    WHERE dr.id = ANY(ud.dept_ids)
    AND (
        pd.department_id = dr.id 
        OR NOT EXISTS (SELECT 1 FROM persona_departments_junction pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
    )
    AND (
        pd.department_id = ANY(ud.dept_ids)
        OR NOT EXISTS (SELECT 1 FROM persona_departments_junction pd3 WHERE pd3.persona_id = p.id AND pd3.active = true)
    )
    GROUP BY dr.id
),
department_document_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(doc.id ORDER BY doc.id) FILTER (WHERE doc.id IS NOT NULL), ARRAY[]::uuid[]) as document_ids
    FROM department_artifact d
    CROSS JOIN user_departments ud
    LEFT JOIN documents_resource doc ON EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = doc.id AND f.name = 'document_active' AND df.value = TRUE)
    LEFT JOIN document_departments_junction dd ON dd.document_id = doc.id AND dd.active = true
    WHERE d.id = ANY(ud.dept_ids)
    AND (dd.department_id = d.id OR NOT EXISTS (SELECT 1 FROM document_departments_junction dd2 WHERE dd2.document_id = doc.id AND dd2.active = true))
    GROUP BY d.id
),
department_parameter_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT p.id) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::uuid[]) as parameter_ids
    FROM department_artifact d
    CROSS JOIN user_departments ud
    LEFT JOIN parameters_resource p ON EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = p.id AND f.name = 'persona_active' AND pf.value = true)
    LEFT JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) = p.id AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'field_active' AND ff.value = true)
    LEFT JOIN field_departments_junction fd ON fd.field_id = f.id AND fd.active = true
    WHERE d.id = ANY(ud.dept_ids)
    AND (fd.department_id = d.id OR NOT EXISTS (SELECT 1 FROM field_departments_junction fd2 
                                                 JOIN fields_resource f2 ON f2.id = fd2.field_id 
                                                 WHERE (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f2.id LIMIT 1) = p.id AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f2.id AND f.name = 'field_active' AND ff.value = TRUE) AND fd2.active = true))
    GROUP BY d.id
),
department_field_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(f.id ORDER BY f.id) FILTER (WHERE f.id IS NOT NULL), ARRAY[]::uuid[]) as field_ids
    FROM department_artifact d
    CROSS JOIN user_departments ud
    LEFT JOIN fields_resource f ON EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'field_active' AND ff.value = true) AND (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL
    LEFT JOIN parameter_artifact p ON p.id = (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) AND EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = p.id AND f.name = 'persona_active' AND pf.value = true)
    LEFT JOIN field_departments_junction fd ON fd.field_id = f.id AND fd.active = true
    WHERE d.id = ANY(ud.dept_ids)
    AND p.id IS NOT NULL
    AND (
        fd.department_id = d.id 
        OR NOT EXISTS (SELECT 1 FROM field_departments_junction fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
    )
    AND (
        fd.department_id = ANY(ud.dept_ids)
        OR NOT EXISTS (SELECT 1 FROM field_departments_junction fd3 WHERE fd3.field_id = f.id AND fd3.active = true)
    )
    GROUP BY d.id
),
scenario_departments_array AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.department_id LIMIT 1), '') as description,
        ARRAY[]::uuid[] as persona_ids,
        ARRAY[]::uuid[] as document_ids,
        ARRAY[]::uuid[] as parameter_ids,
        ARRAY[]::uuid[] as field_ids
    FROM scenario_departments_junction sd
    JOIN departments_resource d ON d.id = sd.department_id
    WHERE sd.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sd.active = true AND EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
),
all_departments_array AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description,
        COALESCE(dpi.persona_ids, ARRAY[]::uuid[]) as persona_ids,
        COALESCE(ddi.document_ids, ARRAY[]::uuid[]) as document_ids,
        COALESCE(dparami.parameter_ids, ARRAY[]::uuid[]) as parameter_ids,
        COALESCE(dfi.field_ids, ARRAY[]::uuid[]) as field_ids
    FROM department_artifact d
    CROSS JOIN user_departments ud
    LEFT JOIN department_persona_ids dpi ON dpi.department_id = d.id
    LEFT JOIN department_document_ids ddi ON ddi.department_id = d.id
    LEFT JOIN department_parameter_ids dparami ON dparami.department_id = d.id
    LEFT JOIN department_field_ids dfi ON dfi.department_id = d.id
    WHERE d.id = ANY(ud.dept_ids)
    UNION
    SELECT * FROM scenario_departments_array
),
accessible_scenarios AS (
    SELECT DISTINCT s.id as scenario_id
    FROM scenario_artifact s
    LEFT JOIN scenario_departments_junction sd ON sd.scenario_id = s.id AND sd.active = true
    CROSS JOIN user_departments ud
    WHERE EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = true)
    AND (
        sd.department_id = ANY(ud.dept_ids)
        OR NOT EXISTS (SELECT 1 FROM scenario_departments_junction sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
    )
),
objectives_with_departments_array AS (
    SELECT
        o.objective,
        COALESCE(
            (
                SELECT ARRAY_AGG(DISTINCT dept_id ORDER BY dept_id)
                FROM (
                    SELECT DISTINCT sd.department_id as dept_id
                    FROM scenario_objectives_junction so2
                    JOIN objectives_resource o2 ON o2.id = so2.objective_id
                    JOIN accessible_scenarios acs2 ON acs2.scenario_id = so2.scenario_id
                    LEFT JOIN scenario_departments_junction sd ON sd.scenario_id = so2.scenario_id AND sd.active = true
                    WHERE o2.objective = o.objective
                        AND o2.objective IS NOT NULL 
                        AND o2.objective != ''
                        AND sd.department_id IS NOT NULL
                ) dept_list
            ),
            ARRAY[]::uuid[]
        ) as department_ids
    FROM scenario_objectives_junction so
    JOIN objectives_resource o ON o.id = so.objective_id
    JOIN accessible_scenarios acs ON acs.scenario_id = so.scenario_id
    WHERE o.objective IS NOT NULL AND o.objective != ''
    GROUP BY o.objective
),
user_departments_for_agents AS (
    SELECT department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments_junction pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
agent_artifact_tool_counts AS (
    SELECT 
        a.id as agent_id,
        COUNT(DISTINCT CASE WHEN ar.resource IS NOT NULL THEN rt.resource::text END) as matched_artifact_count,
        COUNT(DISTINCT CASE WHEN ar.resource IS NULL THEN rt.resource::text END) as extra_outside_count
    FROM agent_artifact a
    LEFT JOIN agent_tools_junction at ON at.agent_id = a.id AND at.active = true
    LEFT JOIN tools_resource tr ON tr.id = at.tool_id
    LEFT JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (
        SELECT 1 FROM tool_flags_junction tf
        JOIN flags_resource f ON tf.flag_id = f.id
        WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true
    )
    LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
    LEFT JOIN artifact_resources_relation ar ON ar.resource = rt.resource AND ar.artifact = 'scenario'::artifact_type
    GROUP BY a.id
),

expected_agent_role AS (
    SELECT 'scenario'::text as role
),
valid_agents_array AS (
    SELECT 
        a.id as agent_id,
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1),
        COALESCE((SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions_junction ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1), '') as description,
        ARRAY[COALESCE(NULL::artifact_type::text, '')] as roles
    FROM agent_artifact a
    
    
    LEFT JOIN agent_departments_junction ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN expected_agent_role ear
    WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true) 
    AND (
        NULL::artifact_type = CAST(ear.role AS artifact_type)
        OR NULL::artifact_type = CAST('scenario' AS artifact_type)
        OR NULL::artifact_type = CAST('scenario' AS artifact_type)
    )
    GROUP BY a.id, (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions_junction ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1), COALESCE(NULL::artifact_type::text, ''), ear.role
    HAVING 
        COUNT(NULL::uuid) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
-- Agent selection helper CTEs (shared across all agent selections)
scenario_department_for_agents AS (
    SELECT sd.department_id
    FROM params p
    JOIN scenario_departments_junction sd ON sd.scenario_id = p.scenario_id AND sd.active = true
    WHERE p.scenario_id IS NOT NULL
    LIMIT 1
),
profile_primary_department_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id AND pd.is_primary = TRUE AND pd.active = true
    WHERE p.scenario_id IS NULL
    LIMIT 1
),
selected_department_for_agents AS (
    SELECT 
        COALESCE(
            (SELECT department_id FROM scenario_department_for_agents),
            (SELECT department_id FROM profile_primary_department_for_agents)
        ) as department_id
),
user_departments_for_agents_scenario AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id AND pd.active = true
),
-- Department mapping data (for departments array) - must be defined before ui_flags
-- Following personas pattern: Only active departments user is linked to
department_mapping_data AS (
    SELECT
        d.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.department_id LIMIT 1), '') as description,
        COALESCE(d.generated, false) as generated
    FROM params x
    CROSS JOIN user_profile up
    JOIN departments_resource d ON (
        -- Only include departments with active flag AND user is linked to them
        EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
        AND
        EXISTS (SELECT 1 FROM profile_departments_junction pd WHERE pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true)
    )
),
-- Persona mapping data (for personas array) - following personas pattern
persona_mapping_data AS (
    SELECT 
        p.persona_id,
        p.name,
        p.description,
        p.color,
        p.icon,
        p.image_model,
        p.parameter_ids,
        p.field_ids,
        p.example,
        false as generated  -- Personas are not generated resources
    FROM valid_personas_array p
),
-- Document mapping data (for documents array)
document_mapping_data AS (
    SELECT 
        vdf.id as document_id,
        vdf.name,
        COALESCE((SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = vdf.id LIMIT 1), '') as description,
        vdf.file_path,
        vdf.mime_type,
        COALESCE((
            SELECT ARRAY_AGG(DISTINCT param.id ORDER BY param.id)
            FROM document_fields_junction df
            JOIN fields_resource f ON f.id = df.field_id
            JOIN parameter_artifact param ON param.id = (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1)
            WHERE df.document_id = vdf.id
              AND df.active = true
              AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'field_active' AND ff.value = TRUE)
              AND EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.parameter_id = param.id AND fl.name = 'parameter_active' AND pf.value = true)
        ), ARRAY[]::uuid[]) as parameter_ids,
        COALESCE((
            SELECT ARRAY_AGG(DISTINCT df.field_id ORDER BY df.field_id)
            FROM document_fields_junction df
            WHERE df.document_id = vdf.id
              AND df.active = true
              AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = df.field_id AND fl.name = 'field_active' AND ff.value = TRUE)
        ), ARRAY[]::uuid[]) as field_ids,
        NULL::uuid as parent_document_id,  -- TODO: Add parent_document_id if needed
        false as generated  -- Documents are not generated resources
    FROM valid_documents_filtered vdf
),
-- Parameter mapping data (for parameters array)
parameter_mapping_data AS (
    SELECT 
        p.id as parameter_id,
        (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM parameter_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'document_parameter' AND pf.value = TRUE) as document_parameter,
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'persona_parameter' AND pf.value = TRUE) as persona_parameter,
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'scenario_parameter' AND pf.value = TRUE) as scenario_parameter,
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'video_parameter' AND pf.value = TRUE) as video_parameter
    FROM parameter_artifact p
    WHERE EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'parameter_active' AND pf.value = true)
),
-- Field mapping data (for fields array) - following personas pattern
field_mapping_data AS (
    SELECT 
        f.id as field_id,
        (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), '') as description,
        (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) as parameter_id,
        (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) LIMIT 1) as parameter_name,
        COALESCE((
            SELECT ARRAY_AGG(fcp.parameter_id ORDER BY fcp.parameter_id)
            FROM field_parameters_junction fcp
            WHERE fcp.field_id = f.id
              AND fcp.active = true
              AND fcp.type = 'conditional'::parameter_type
        ), ARRAY[]::uuid[]) as conditional_parameter_ids,
        COALESCE(f.generated, false) as generated
    FROM fields_resource f
    WHERE EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'field_active' AND ff.value = true)
),
-- Objective mapping data (for objectives array)
objective_mapping_data AS (
    SELECT 
        o.id,
        o.objective,
        false as generated  -- Objectives are not generated resources
    FROM objectives_resource o
    WHERE o.active = true
),
-- Image mapping data (for images array)
image_mapping_data AS (
    SELECT 
        i.id,
        i.name,
        COALESCE(u.file_path, '') as file_path,
        COALESCE(u.mime_type, '') as mime_type,
        COALESCE(i.upload_id, i.id) as upload_id,
        COALESCE(i.generated, false) as generated
    FROM images_resource i
    LEFT JOIN uploads_entry u ON u.id = i.upload_id
    WHERE i.active = true
),
-- Video mapping data (for videos array)
video_mapping_data AS (
    SELECT 
        v.id,
        v.name,
        v.length_seconds,
        COALESCE(v.completed, false) as completed,
        COALESCE(u.file_path, '') as file_path,
        COALESCE(u.mime_type, '') as mime_type,
        COALESCE(v.upload_id, v.id) as upload_id,
        false as generated  -- Videos are not generated resources
    FROM videos_resource v
    LEFT JOIN uploads_entry u ON u.id = v.upload_id
    WHERE v.active = true
),
-- Question mapping data (for questions array)
question_mapping_data AS (
    SELECT 
        q.id,
        q.question_text,
        COALESCE(q.allow_multiple, false) as allow_multiple,
        false as generated  -- Questions are not generated resources
    FROM questions_resource q
    WHERE q.active = true
),
-- Template mapping data (for templates array)
template_mapping_data AS (
    SELECT 
        t.id,
        t.name,
        COALESCE(t.description, '') as description,
        t.html,
        COALESCE(t.generated, false) as generated
    FROM templates_resource t
    WHERE t.active = true
),
-- UI flags for show_{resource} logic
ui_flags AS (
    SELECT 
        -- Single-select resource flags (based on whether options exist)
        true as show_name,  -- Always show name picker
        true as show_description,  -- Always show description picker
        true as show_problem_statement,  -- Always show problem statement picker
        -- Multi-select resource flags (based on business logic)
        CASE 
            WHEN EXISTS (SELECT 1 FROM department_mapping_data LIMIT 1) THEN true
            ELSE false
        END as show_departments,
        CASE 
            WHEN EXISTS (SELECT 1 FROM field_mapping_data LIMIT 1) THEN true
            ELSE false
        END as show_fields,
        CASE 
            WHEN EXISTS (SELECT 1 FROM objective_mapping_data LIMIT 1) THEN true
            ELSE false
        END as show_objectives,
        CASE 
            WHEN EXISTS (SELECT 1 FROM image_mapping_data LIMIT 1) THEN true
            ELSE false
        END as show_images,
        CASE 
            WHEN EXISTS (SELECT 1 FROM video_mapping_data LIMIT 1) THEN true
            ELSE false
        END as show_videos,
        CASE 
            WHEN EXISTS (SELECT 1 FROM question_mapping_data LIMIT 1) THEN true
            ELSE false
        END as show_questions,
        CASE 
            WHEN EXISTS (SELECT 1 FROM template_mapping_data LIMIT 1) THEN true
            ELSE false
        END as show_templates,
        CASE 
            WHEN EXISTS (SELECT 1 FROM persona_mapping_data LIMIT 1) THEN true
            ELSE false
        END as show_personas,
        CASE 
            WHEN EXISTS (SELECT 1 FROM document_mapping_data LIMIT 1) THEN true
            ELSE false
        END as show_documents,
        CASE 
            WHEN EXISTS (SELECT 1 FROM parameter_mapping_data LIMIT 1) THEN true
            ELSE false
        END as show_parameters
    FROM params x
),
-- Department suggestions
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(sd.department_id ORDER BY sd.created_at DESC)
             FROM (
                 SELECT DISTINCT sd.department_id, MAX(sd.created_at) as created_at
                 FROM scenario_departments_junction sd
                 JOIN departments_resource d ON d.id = sd.department_id
                 CROSS JOIN draft_group_data dgd
                 WHERE sd.department_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
                   AND (
                       -- Option 1: Linked to scenarios with active=true
                       sd.active = true
                       OR
                       -- Option 2: Linked to same group with generated=true
                       (
                           sd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls_entry c
                               JOIN runs_entry r ON r.id = c.run_id
                               WHERE c.id = d.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY sd.department_id
                 ORDER BY MAX(sd.created_at) DESC
                 LIMIT 20
             ) sd),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    LIMIT 1
),
-- Agent selection CTEs for each resource (following personas pattern)
-- Agent selection for 'names' resource
name_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'scenario'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'names'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection helper function pattern (reused for all resources)
-- Agent selection for 'descriptions' resource
description_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'descriptions'::resource_type
        )
        AND ((SELECT mcp FROM params) = false OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id AND f_mcp.name = 'mcp' AND af_mcp.value = true))
    ),
    agent_department_preference AS (
        SELECT ea.agent_id,
            CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference,
            ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
-- Agent selection for 'problem_statements' resource  
problem_statement_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'problem_statements'::resource_type)
        AND ((SELECT mcp FROM params) = false OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id AND f_mcp.name = 'mcp' AND af_mcp.value = true))
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
-- Agent selection for 'departments' resource (no MCP filter)
departments_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'departments'::resource_type)
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
-- Agent selection for 'fields' resource (no MCP filter)
fields_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'fields'::resource_type)
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
-- Agent selection for 'objectives' resource (no MCP filter)
objectives_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'objectives'::resource_type)
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
-- Agent selection for 'images' resource (no MCP filter)
images_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'images'::resource_type)
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
-- Agent selection for 'videos' resource (no MCP filter)
videos_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'videos'::resource_type)
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
-- Agent selection for 'questions' resource (no MCP filter)
questions_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'questions'::resource_type)
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
-- Agent selection for 'templates' resource (no MCP filter)
templates_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'templates'::resource_type)
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
-- Agent selection for 'personas' resource (no MCP filter)
personas_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'personas'::resource_type)
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
-- Agent selection for 'documents' resource (no MCP filter)
documents_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'documents'::resource_type)
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
-- Agent selection for 'parameters' resource (no MCP filter)
parameters_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'parameters'::resource_type)
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
-- Flag agent selection CTEs (one per flag type) - all use 'scenario_flags' resource
active_flag_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'scenario_flags'::resource_type)
        AND ((SELECT mcp FROM params) = false OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id AND f_mcp.name = 'mcp' AND af_mcp.value = true))
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
objectives_enabled_flag_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'scenario_flags'::resource_type)
        AND ((SELECT mcp FROM params) = false OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id AND f_mcp.name = 'mcp' AND af_mcp.value = true))
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
images_enabled_flag_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'scenario_flags'::resource_type)
        AND ((SELECT mcp FROM params) = false OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id AND f_mcp.name = 'mcp' AND af_mcp.value = true))
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
video_enabled_flag_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'scenario_flags'::resource_type)
        AND ((SELECT mcp FROM params) = false OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id AND f_mcp.name = 'mcp' AND af_mcp.value = true))
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
questions_enabled_flag_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'scenario_flags'::resource_type)
        AND ((SELECT mcp FROM params) = false OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id AND f_mcp.name = 'mcp' AND af_mcp.value = true))
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
problem_statement_enabled_flag_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'scenario_flags'::resource_type)
        AND ((SELECT mcp FROM params) = false OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id AND f_mcp.name = 'mcp' AND af_mcp.value = true))
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
use_templates_flag_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr ON tr.id = at.tool_id JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true) JOIN resource_tools_relation rt ON rt.tool_id = t.id WHERE at.agent_id = a.id AND at.active = true AND rt.resource = 'scenario_flags'::resource_type)
        AND ((SELECT mcp FROM params) = false OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id AND f_mcp.name = 'mcp' AND af_mcp.value = true))
    ),
    agent_department_preference AS (
        SELECT ea.agent_id, CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ea.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference, ea.updated_at
        FROM eligible_agents ea CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
-- Multi-resource combination agent IDs
-- Agent selection for 'basic' multi-resource combination (names + descriptions + flags + departments)
basic_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
    ),
    agent_tool_resources AS (
        SELECT ea.agent_id, COALESCE(ARRAY_AGG(DISTINCT rt.resource::text) FILTER (WHERE rt.resource IS NOT NULL), ARRAY[]::text[]) as tool_resources, ea.updated_at
        FROM eligible_agents ea
        LEFT JOIN agent_tools_junction at ON at.agent_id = ea.agent_id AND at.active = true
        LEFT JOIN tools_resource tr ON tr.id = at.tool_id
        LEFT JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
        GROUP BY ea.agent_id, ea.updated_at
    ),
    agent_scores AS (
        SELECT atr.agent_id, atr.tool_resources,
            ARRAY_LENGTH(ARRAY(SELECT unnest(atr.tool_resources) EXCEPT SELECT unnest(ARRAY['names', 'descriptions', 'scenario_flags', 'departments']::text[])), 1) as unmatched_count,
            atr.updated_at
        FROM agent_tool_resources atr
        WHERE ARRAY['names', 'descriptions', 'scenario_flags', 'departments']::text[] <@ atr.tool_resources
        AND ((SELECT mcp FROM params) = false OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = atr.agent_id AND f_mcp.name = 'mcp' AND af_mcp.value = true))
    ),
    agent_department_preference AS (
        SELECT ascores.agent_id, ascores.unmatched_count,
            CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ascores.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference,
            ascores.updated_at
        FROM agent_scores ascores CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.unmatched_count ASC, adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
-- Agent selection for 'content' multi-resource combination (objectives + images + videos + questions)
content_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
    ),
    agent_tool_resources AS (
        SELECT ea.agent_id, COALESCE(ARRAY_AGG(DISTINCT rt.resource::text) FILTER (WHERE rt.resource IS NOT NULL), ARRAY[]::text[]) as tool_resources, ea.updated_at
        FROM eligible_agents ea
        LEFT JOIN agent_tools_junction at ON at.agent_id = ea.agent_id AND at.active = true
        LEFT JOIN tools_resource tr ON tr.id = at.tool_id
        LEFT JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
        GROUP BY ea.agent_id, ea.updated_at
    ),
    agent_scores AS (
        SELECT atr.agent_id, atr.tool_resources,
            ARRAY_LENGTH(ARRAY(SELECT unnest(atr.tool_resources) EXCEPT SELECT unnest(ARRAY['objectives', 'images', 'videos', 'questions']::text[])), 1) as unmatched_count,
            atr.updated_at
        FROM agent_tool_resources atr
        WHERE ARRAY['objectives', 'images', 'videos', 'questions']::text[] <@ atr.tool_resources
    ),
    agent_department_preference AS (
        SELECT ascores.agent_id, ascores.unmatched_count,
            CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ascores.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference,
            ascores.updated_at
        FROM agent_scores ascores CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.unmatched_count ASC, adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
-- Agent selection for 'general' - agent with ALL scenario tools
general_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a CROSS JOIN params p CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
        AND EXISTS (SELECT 1 FROM agent_tools_junction at JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = tr_rt.tool_id JOIN artifact_resources_relation ar ON ar.resource = rt.resource WHERE at.agent_id = a.id AND at.active = TRUE AND ar.artifact = 'scenario'::artifact_type)
        AND (EXISTS (SELECT 1 FROM agent_departments_junction ad JOIN user_departments_for_agents_scenario ud ON ad.department_id = ud.department_id WHERE ad.agent_id = a.id AND ad.active = true) OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
    ),
    agent_tool_resources AS (
        SELECT ea.agent_id, COALESCE(ARRAY_AGG(DISTINCT rt.resource::text) FILTER (WHERE rt.resource IS NOT NULL), ARRAY[]::text[]) as tool_resources, ea.updated_at
        FROM eligible_agents ea
        LEFT JOIN agent_tools_junction at ON at.agent_id = ea.agent_id AND at.active = true
        LEFT JOIN tools_resource tr ON tr.id = at.tool_id
        LEFT JOIN tool_artifact t ON t.id = tr.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
        GROUP BY ea.agent_id, ea.updated_at
    ),
    agent_scores AS (
        SELECT atr.agent_id, atr.tool_resources,
            ARRAY_LENGTH(ARRAY(SELECT unnest(atr.tool_resources) EXCEPT SELECT unnest(ARRAY['names', 'descriptions', 'problem_statements', 'scenario_flags', 'departments', 'personas', 'documents', 'parameters', 'fields', 'objectives', 'images', 'videos', 'questions', 'templates']::text[])), 1) as unmatched_count,
            atr.updated_at
        FROM agent_tool_resources atr
        WHERE ARRAY['names', 'descriptions', 'problem_statements', 'scenario_flags', 'departments', 'personas', 'documents', 'parameters', 'fields', 'objectives', 'images', 'videos', 'questions', 'templates']::text[] <@ atr.tool_resources
        AND ((SELECT mcp FROM params) = false OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = atr.agent_id AND f_mcp.name = 'mcp' AND af_mcp.value = true))
    ),
    agent_department_preference AS (
        SELECT ascores.agent_id, ascores.unmatched_count,
            CASE WHEN sd.department_id IS NOT NULL AND EXISTS (SELECT 1 FROM agent_departments_junction ad WHERE ad.agent_id = ascores.agent_id AND ad.department_id = sd.department_id AND ad.active = true) THEN 0 ELSE 1 END as dept_preference,
            ascores.updated_at
        FROM agent_scores ascores CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id FROM agent_department_preference adp ORDER BY adp.unmatched_count ASC, adp.dept_preference ASC, adp.updated_at DESC, adp.agent_id ASC LIMIT 1
),
-- Tools existence check CTE
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'names'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'descriptions'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as descriptions_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'problem_statements'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as problem_statements_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'fields'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as fields_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'objectives'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as objectives_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'images'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as images_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'videos'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as videos_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'questions'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as questions_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'templates'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as templates_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'personas'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as personas_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'documents'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as documents_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'parameters'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as parameters_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'scenario_flags'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as scenario_flags_has_tools
    FROM params x
),
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            -- Check if tools exist (not agents). Error only if NO tools exist for required resources.
            CASE WHEN NOT tec.names_has_tools THEN 'name' ELSE NULL END,
            CASE WHEN NOT tec.descriptions_has_tools THEN 'description' ELSE NULL END,
            CASE WHEN NOT tec.problem_statements_has_tools THEN 'problem_statement' ELSE NULL END,
            CASE WHEN NOT tec.departments_has_tools AND uf.show_departments THEN 'departments' ELSE NULL END,
            CASE WHEN NOT tec.fields_has_tools AND uf.show_fields THEN 'fields' ELSE NULL END,
            CASE WHEN NOT tec.objectives_has_tools AND uf.show_objectives THEN 'objectives' ELSE NULL END,
            CASE WHEN NOT tec.images_has_tools AND uf.show_images THEN 'images' ELSE NULL END,
            CASE WHEN NOT tec.videos_has_tools AND uf.show_videos THEN 'videos' ELSE NULL END,
            CASE WHEN NOT tec.questions_has_tools AND uf.show_questions THEN 'questions' ELSE NULL END,
            CASE WHEN NOT tec.templates_has_tools AND uf.show_templates THEN 'templates' ELSE NULL END,
            CASE WHEN NOT tec.personas_has_tools AND uf.show_personas THEN 'personas' ELSE NULL END,
            CASE WHEN NOT tec.documents_has_tools AND uf.show_documents THEN 'documents' ELSE NULL END,
            CASE WHEN NOT tec.parameters_has_tools AND uf.show_parameters THEN 'parameters' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM params x
    CROSS JOIN ui_flags uf
    CROSS JOIN tools_existence_check tec
),
permissions_data_with_tools AS (
    SELECT 
        sdd.department_ids,
        CASE 
            WHEN (SELECT scenario_id FROM params) IS NULL THEN
                -- New mode permissions
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    WHEN EXISTS (SELECT 1 FROM user_departments) THEN true
                    ELSE false
                END
            ELSE
                -- Detail mode permissions
                CASE 
                    WHEN COALESCE(ssa.active_usage_count, 0) > 0 THEN false
                    WHEN (COALESCE(array_length(sdd.department_ids, 1), 0) = 0 AND up.role != 'superadmin') THEN false
                    WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN true
                    ELSE false
                END
        END as base_can_edit,
        CASE 
            WHEN (SELECT scenario_id FROM params) IS NULL THEN
                -- New mode: always editable if can_edit is true
                NULL::text
            ELSE
                -- Detail mode: compute disabled_reason
                CASE 
                    WHEN COALESCE(ssa.active_usage_count, 0) > 0 THEN 'Scenario is currently in use and cannot be edited.'
                    WHEN (COALESCE(array_length(sdd.department_ids, 1), 0) = 0 AND up.role != 'superadmin') THEN 'You do not have access to edit this scenario.'
                    WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN NULL::text
                    ELSE 'This scenario cannot be edited. You can view the details but cannot make changes.'::text
                END
        END as base_disabled_reason
    FROM params x
    LEFT JOIN scenario_departments_data sdd ON true
    CROSS JOIN user_profile up
    LEFT JOIN scenario_simulations_agg ssa ON true
),
permissions_final AS (
    SELECT 
        pd.department_ids,
        mtc.missing_resources,
        CASE 
            WHEN array_length(mtc.missing_resources, 1) > 0 THEN false
            ELSE pd.base_can_edit
        END as can_edit,
        CASE 
            WHEN array_length(mtc.missing_resources, 1) > 0 THEN
                'No tool configured for ' || 
                array_to_string(mtc.missing_resources, ', ') || 
                '. Therefore we cannot proceed ahead.'::text
            ELSE pd.base_disabled_reason
        END as disabled_reason
    FROM permissions_data_with_tools pd
    CROSS JOIN missing_tools_check mtc
)
SELECT
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT scenario_exists FROM scenario_exists_check) as scenario_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    -- Group ID for linking resources
    dgd.group_id,
    -- Single-select resources: name
    (SELECT name_id FROM name_resource_data) as name_id,
    nrd.name_resource,
    CASE 
        WHEN NOT tec.names_has_tools THEN false
        ELSE uf.show_name
    END as show_name,
    (SELECT agent_id FROM name_agent_data) as name_agent_id,
    true as name_required,
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    COALESCE((SELECT names FROM names_suggestions_objects), ARRAY[]::types.q_get_scenario_v4_name_resource[]) as names,
    -- Single-select resources: description
    (SELECT description_id FROM description_resource_data) as description_id,
    drd.description_resource,
    CASE 
        WHEN NOT tec.descriptions_has_tools THEN false
        ELSE uf.show_description
    END as show_description,
    (SELECT agent_id FROM description_agent_data) as description_agent_id,
    false as description_required,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    COALESCE((SELECT descriptions FROM descriptions_suggestions_objects), ARRAY[]::types.q_get_scenario_v4_description_resource[]) as descriptions,
    -- Single-select resources: problem_statement (filtered by flag)
    CASE 
        WHEN sc.problem_statement_enabled THEN (SELECT problem_statement_id FROM problem_statement_resource_data)
        ELSE NULL::uuid
    END as problem_statement_id,
    CASE 
        WHEN sc.problem_statement_enabled THEN psrd.problem_statement_resource
        ELSE NULL::types.q_get_scenario_v4_problem_statement_resource
    END as problem_statement_resource,
    CASE 
        WHEN NOT tec.problem_statements_has_tools THEN false
        WHEN sc.problem_statement_enabled THEN uf.show_problem_statement
        ELSE false
    END as show_problem_statement,
    (SELECT agent_id FROM problem_statement_agent_data) as problem_statement_agent_id,
    false as problem_statement_required,
    CASE 
        WHEN sc.problem_statement_enabled THEN COALESCE((SELECT problem_statement_suggestions FROM problem_statement_suggestions_data), ARRAY[]::uuid[])
        ELSE ARRAY[]::uuid[]
    END as problem_statement_suggestions,
    CASE 
        WHEN sc.problem_statement_enabled THEN COALESCE((SELECT problem_statements FROM problem_statements_suggestions_objects), ARRAY[]::types.q_get_scenario_v4_problem_statement_resource[])
        ELSE ARRAY[]::types.q_get_scenario_v4_problem_statement_resource[]
    END as problem_statements,
    -- Single-select resources: flags (one per flag type)
    afrd.active_flag_id,
    afrd.active_flag_resource,
    CASE 
        WHEN NOT tec.scenario_flags_has_tools THEN false
        ELSE true
    END as show_active_flag,
    (SELECT agent_id FROM active_flag_agent_data) as active_flag_agent_id,
    false as active_flag_required,
    oefrd.objectives_enabled_flag_id,
    oefrd.objectives_enabled_flag_resource,
    CASE 
        WHEN NOT tec.scenario_flags_has_tools THEN false
        ELSE true
    END as show_objectives_enabled_flag,
    (SELECT agent_id FROM objectives_enabled_flag_agent_data) as objectives_enabled_flag_agent_id,
    false as objectives_enabled_flag_required,
    iefrd.images_enabled_flag_id,
    iefrd.images_enabled_flag_resource,
    CASE 
        WHEN NOT tec.scenario_flags_has_tools THEN false
        ELSE true
    END as show_images_enabled_flag,
    (SELECT agent_id FROM images_enabled_flag_agent_data) as images_enabled_flag_agent_id,
    false as images_enabled_flag_required,
    vefrd.video_enabled_flag_id,
    vefrd.video_enabled_flag_resource,
    CASE 
        WHEN NOT tec.scenario_flags_has_tools THEN false
        ELSE true
    END as show_video_enabled_flag,
    (SELECT agent_id FROM video_enabled_flag_agent_data) as video_enabled_flag_agent_id,
    false as video_enabled_flag_required,
    qefrd.questions_enabled_flag_id,
    qefrd.questions_enabled_flag_resource,
    CASE 
        WHEN NOT tec.scenario_flags_has_tools THEN false
        ELSE true
    END as show_questions_enabled_flag,
    (SELECT agent_id FROM questions_enabled_flag_agent_data) as questions_enabled_flag_agent_id,
    false as questions_enabled_flag_required,
    (SELECT problem_statement_enabled_flag_id FROM problem_statement_enabled_flag_resource_data) as problem_statement_enabled_flag_id,
    (SELECT problem_statement_enabled_flag_resource FROM problem_statement_enabled_flag_resource_data) as problem_statement_enabled_flag_resource,
    CASE 
        WHEN NOT tec.scenario_flags_has_tools THEN false
        ELSE true
    END as show_problem_statement_enabled_flag,
    (SELECT agent_id FROM problem_statement_enabled_flag_agent_data) as problem_statement_enabled_flag_agent_id,
    false as problem_statement_enabled_flag_required,
    (SELECT use_templates_flag_id FROM use_templates_flag_resource_data) as use_templates_flag_id,
    (SELECT use_templates_flag_resource FROM use_templates_flag_resource_data) as use_templates_flag_resource,
    CASE 
        WHEN NOT tec.scenario_flags_has_tools THEN false
        ELSE true
    END as show_use_templates_flag,
    (SELECT agent_id FROM use_templates_flag_agent_data) as use_templates_flag_agent_id,
    false as use_templates_flag_required,
    -- Multi-select resources: departments
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'department_ids' IS NOT NULL AND jsonb_typeof(payload->'department_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'department_ids'))::uuid[]
                ELSE NULL
            END
        FROM draft_payload_data),
        CASE 
            WHEN (SELECT scenario_id FROM params) IS NULL THEN
                ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(department_id::uuid ORDER BY created_at)
                 FROM scenario_departments_junction sd
                 WHERE sd.scenario_id = (SELECT scenario_id FROM params) AND sd.active = true),
                ARRAY[]::uuid[]
            )
        END
    ) as department_ids,
    -- Department resources (selected departments filtered by department_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_scenario_v4_department
            ORDER BY dmd.name
        )
        FROM department_mapping_data dmd
        WHERE dmd.department_id = ANY(
            COALESCE(
                (SELECT 
                    CASE 
                        WHEN payload->'department_ids' IS NOT NULL AND jsonb_typeof(payload->'department_ids') = 'array' THEN
                            ARRAY(SELECT jsonb_array_elements_text(payload->'department_ids'))::uuid[]
                        ELSE NULL
                    END
                FROM draft_payload_data),
                CASE 
                    WHEN (SELECT scenario_id FROM params) IS NULL THEN
                        ARRAY[]::uuid[]
                    ELSE COALESCE(
                        (SELECT ARRAY_AGG(department_id::uuid ORDER BY created_at)
                         FROM scenario_departments_junction sd
                         WHERE sd.scenario_id = (SELECT scenario_id FROM params) AND sd.active = true),
                        ARRAY[]::uuid[]
                    )
                END
            )
        )),
        '{}'::types.q_get_scenario_v4_department[]
    ) as department_resources,
    CASE 
        WHEN NOT tec.departments_has_tools AND uf.show_departments THEN false
        WHEN EXISTS (SELECT 1 FROM department_mapping_data LIMIT 1) THEN true
        ELSE uf.show_departments
    END as show_departments,
    (SELECT agent_id FROM departments_agent_data) as departments_agent_id,
    CASE 
        WHEN uf.show_departments THEN true
        ELSE false
    END as departments_required,
    COALESCE((SELECT department_suggestions FROM department_suggestions_data), ARRAY[]::uuid[]) as department_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_scenario_v4_department
            ORDER BY dmd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated FROM department_mapping_data) dmd),
        '{}'::types.q_get_scenario_v4_department[]
    ) as departments,
    -- Multi-select resources: fields
    COALESCE((
        SELECT ARRAY_AGG(sf.field_id ORDER BY sf.field_id)
        FROM scenario_fields_junction sf
        WHERE sf.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sf.active = true
    ), ARRAY[]::uuid[]) as field_ids,
    COALESCE((
        SELECT ARRAY_AGG(
            (fmd.field_id, fmd.name, fmd.description, fmd.parameter_id, fmd.parameter_name, fmd.conditional_parameter_ids, fmd.generated)::types.q_get_scenario_v4_field
            ORDER BY fmd.parameter_name, fmd.name
        )
        FROM field_mapping_data fmd
        WHERE fmd.field_id = ANY(
            COALESCE((
                SELECT ARRAY_AGG(sf.field_id ORDER BY sf.field_id)
                FROM scenario_fields_junction sf
                WHERE sf.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sf.active = true
            ), ARRAY[]::uuid[])
        )
    ), '{}'::types.q_get_scenario_v4_field[]) as field_resources,
    CASE 
        WHEN NOT tec.fields_has_tools AND uf.show_fields THEN false
        ELSE uf.show_fields
    END as show_fields,
    (SELECT agent_id FROM fields_agent_data) as fields_agent_id,
    CASE 
        WHEN uf.show_fields THEN true
        ELSE false
    END as fields_required,
    ARRAY[]::uuid[] as field_suggestions,
    COALESCE((
        SELECT ARRAY_AGG(
            (fmd.field_id, fmd.name, fmd.description, fmd.parameter_id, fmd.parameter_name, fmd.conditional_parameter_ids, fmd.generated)::types.q_get_scenario_v4_field
            ORDER BY fmd.parameter_name, fmd.name
        ) FROM (SELECT DISTINCT field_id, name, description, parameter_id, parameter_name, conditional_parameter_ids, generated FROM field_mapping_data) fmd),
        '{}'::types.q_get_scenario_v4_field[]
    ) as fields,
    -- Multi-select resources: objectives (populated from CTEs, filtered by flag)
    CASE 
        WHEN sc.objectives_enabled THEN COALESCE((
            SELECT ARRAY_AGG(so.objective_id ORDER BY so.idx, so.objective_id)
            FROM scenario_objectives_junction so
            WHERE so.scenario_id = (SELECT scenario_id FROM params LIMIT 1)
        ), ARRAY[]::uuid[])
        ELSE ARRAY[]::uuid[]
    END as objective_ids,
    CASE 
        WHEN sc.objectives_enabled THEN COALESCE((
            SELECT ARRAY_AGG((so.objective_id, o.objective, false)::types.q_get_scenario_v4_objective_resource ORDER BY so.idx, so.objective_id)
            FROM scenario_objectives_junction so
            JOIN objectives_resource o ON o.id = so.objective_id
            WHERE so.scenario_id = (SELECT scenario_id FROM params LIMIT 1)
        ), '{}'::types.q_get_scenario_v4_objective_resource[])
        ELSE '{}'::types.q_get_scenario_v4_objective_resource[]
    END as objective_resources,
    CASE 
        WHEN NOT tec.objectives_has_tools AND uf.show_objectives THEN false
        WHEN sc.objectives_enabled THEN uf.show_objectives
        ELSE false
    END as show_objectives,
    (SELECT agent_id FROM objectives_agent_data) as objectives_agent_id,
    CASE 
        WHEN uf.show_objectives AND sc.objectives_enabled THEN true
        ELSE false
    END as objectives_required,
    COALESCE((SELECT objective_suggestions FROM objective_suggestions_data), ARRAY[]::uuid[]) as objective_suggestions,
    CASE 
        WHEN sc.objectives_enabled THEN COALESCE((
            SELECT ARRAY_AGG(
                (omd.id, omd.objective, omd.generated)::types.q_get_scenario_v4_objective_resource
                ORDER BY CASE WHEN so2.scenario_id IS NOT NULL THEN 0 ELSE 1 END, COALESCE(so2.idx, 999999), omd.id
            )
            FROM objective_mapping_data omd
            LEFT JOIN scenario_objectives_junction so2 ON so2.objective_id = omd.id AND so2.scenario_id = (SELECT scenario_id FROM params)
            LIMIT 100
        ), '{}'::types.q_get_scenario_v4_objective_resource[])
        ELSE '{}'::types.q_get_scenario_v4_objective_resource[]
    END as objectives,
    -- Multi-select resources: images (populated from CTEs, filtered by flag)
    CASE 
        WHEN sc.images_enabled THEN COALESCE((
            SELECT ARRAY_AGG(si.image_id ORDER BY si.created_at)
            FROM scenario_images_junction si
            WHERE si.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND si.active = true
        ), ARRAY[]::uuid[])
        ELSE ARRAY[]::uuid[]
    END as image_ids,
    CASE 
        WHEN sc.images_enabled THEN COALESCE((
            SELECT ARRAY_AGG((si.image_id, i.name, u.file_path, u.mime_type, COALESCE(i.upload_id, si.image_id), false)::types.q_get_scenario_v4_image_resource ORDER BY si.created_at)
            FROM scenario_images_junction si
            JOIN images_resource i ON i.id = si.image_id
            LEFT JOIN uploads_entry u ON u.id = i.upload_id
            WHERE si.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND si.active = true
        ), '{}'::types.q_get_scenario_v4_image_resource[])
        ELSE '{}'::types.q_get_scenario_v4_image_resource[]
    END as image_resources,
    CASE 
        WHEN NOT tec.images_has_tools AND uf.show_images THEN false
        WHEN sc.images_enabled THEN uf.show_images
        ELSE false
    END as show_images,
    (SELECT agent_id FROM images_agent_data) as images_agent_id,
    CASE 
        WHEN uf.show_images AND sc.images_enabled THEN true
        ELSE false
    END as images_required,
    ARRAY[]::uuid[] as image_suggestions,
    CASE 
        WHEN sc.images_enabled THEN COALESCE((
            SELECT ARRAY_AGG(
                (imd.id, imd.name, imd.file_path, imd.mime_type, imd.upload_id, imd.generated)::types.q_get_scenario_v4_image_resource
                ORDER BY CASE WHEN si.scenario_id IS NOT NULL THEN 0 ELSE 1 END, imd.id
            )
            FROM image_mapping_data imd
            LEFT JOIN scenario_images_junction si ON si.image_id = imd.id AND si.scenario_id = (SELECT scenario_id FROM params) AND si.active = true
            WHERE (
                (SELECT image_search FROM params LIMIT 1) IS NULL
                OR LOWER(imd.name) LIKE '%' || LOWER((SELECT image_search FROM params LIMIT 1)) || '%'
            )
            LIMIT 100
        ), '{}'::types.q_get_scenario_v4_image_resource[])
        ELSE '{}'::types.q_get_scenario_v4_image_resource[]
    END as images,
    -- Multi-select resources: videos (populated from CTEs, filtered by flag)
    CASE 
        WHEN sc.video_enabled THEN COALESCE((
            SELECT ARRAY_AGG(sv.video_id ORDER BY sv.created_at)
            FROM scenario_videos_junction sv
            WHERE sv.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sv.active = true
        ), ARRAY[]::uuid[])
        ELSE ARRAY[]::uuid[]
    END as video_ids,
    CASE 
        WHEN sc.video_enabled THEN COALESCE((
            SELECT ARRAY_AGG((sv.video_id, v.name, v.length_seconds, COALESCE(v.completed, false), COALESCE(u.file_path, ''), COALESCE(u.mime_type, ''), COALESCE(v.upload_id, sv.video_id), false)::types.q_get_scenario_v4_video_resource ORDER BY sv.created_at)
            FROM scenario_videos_junction sv
            JOIN videos_resource v ON v.id = sv.video_id
            LEFT JOIN uploads_entry u ON u.id = v.upload_id
            WHERE sv.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sv.active = true
        ), '{}'::types.q_get_scenario_v4_video_resource[])
        ELSE '{}'::types.q_get_scenario_v4_video_resource[]
    END as video_resources,
    CASE 
        WHEN NOT tec.videos_has_tools AND uf.show_videos THEN false
        WHEN sc.video_enabled THEN uf.show_videos
        ELSE false
    END as show_videos,
    (SELECT agent_id FROM videos_agent_data) as videos_agent_id,
    CASE 
        WHEN uf.show_videos AND sc.video_enabled THEN true
        ELSE false
    END as videos_required,
    ARRAY[]::uuid[] as video_suggestions,
    CASE 
        WHEN sc.video_enabled THEN COALESCE((
            SELECT ARRAY_AGG(
                (vmd.id, vmd.name, vmd.length_seconds, vmd.completed, vmd.file_path, vmd.mime_type, vmd.upload_id, vmd.generated)::types.q_get_scenario_v4_video_resource
                ORDER BY CASE WHEN sv.scenario_id IS NOT NULL THEN 0 ELSE 1 END, vmd.id
            )
            FROM video_mapping_data vmd
            LEFT JOIN scenario_videos_junction sv ON sv.video_id = vmd.id AND sv.scenario_id = (SELECT scenario_id FROM params) AND sv.active = true
            WHERE (
                (SELECT video_search FROM params LIMIT 1) IS NULL
                OR LOWER(vmd.name) LIKE '%' || LOWER((SELECT video_search FROM params LIMIT 1)) || '%'
            )
            LIMIT 100
        ), '{}'::types.q_get_scenario_v4_video_resource[])
        ELSE '{}'::types.q_get_scenario_v4_video_resource[]
    END as videos,
    -- Multi-select resources: questions (populated from CTEs, filtered by flag)
    CASE 
        WHEN sc.questions_enabled THEN COALESCE((
            SELECT ARRAY_AGG(sq.question_id ORDER BY sq.created_at)
            FROM scenario_questions_junction sq
            WHERE sq.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sq.active = true
        ), ARRAY[]::uuid[])
        ELSE ARRAY[]::uuid[]
    END as question_ids,
    CASE 
        WHEN sc.questions_enabled THEN COALESCE((
            SELECT ARRAY_AGG((sq.question_id, q.question_text, COALESCE(q.allow_multiple, false), false)::types.q_get_scenario_v4_question_resource ORDER BY sq.created_at)
            FROM scenario_questions_junction sq
            JOIN questions_resource q ON q.id = sq.question_id
            WHERE sq.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sq.active = true
        ), '{}'::types.q_get_scenario_v4_question_resource[])
        ELSE '{}'::types.q_get_scenario_v4_question_resource[]
    END as question_resources,
    CASE 
        WHEN NOT tec.questions_has_tools AND uf.show_questions THEN false
        WHEN sc.questions_enabled THEN uf.show_questions
        ELSE false
    END as show_questions,
    (SELECT agent_id FROM questions_agent_data) as questions_agent_id,
    CASE 
        WHEN uf.show_questions AND sc.questions_enabled THEN true
        ELSE false
    END as questions_required,
    ARRAY[]::uuid[] as question_suggestions,
    CASE 
        WHEN sc.questions_enabled THEN COALESCE((
            SELECT ARRAY_AGG(
                (qmd.id, qmd.question_text, qmd.allow_multiple, qmd.generated)::types.q_get_scenario_v4_question_resource
                ORDER BY CASE WHEN sq.scenario_id IS NOT NULL THEN 0 ELSE 1 END, qmd.id
            )
            FROM question_mapping_data qmd
            LEFT JOIN scenario_questions_junction sq ON sq.question_id = qmd.id AND sq.scenario_id = (SELECT scenario_id FROM params) AND sq.active = true
        ), '{}'::types.q_get_scenario_v4_question_resource[])
        ELSE '{}'::types.q_get_scenario_v4_question_resource[]
    END as questions,
    -- Multi-select resources: templates
    CASE 
        WHEN sc.use_templates THEN COALESCE((
            SELECT ARRAY_AGG(st.template_id ORDER BY st.template_id)
            FROM scenario_templates_junction st
            WHERE st.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND st.active = true
        ), ARRAY[]::uuid[])
        ELSE ARRAY[]::uuid[]
    END as template_ids,
    CASE 
        WHEN sc.use_templates THEN COALESCE((
            SELECT ARRAY_AGG(
                (tmd.id, tmd.name, tmd.description, tmd.html, tmd.generated)::types.q_get_scenario_v4_template_resource
                ORDER BY tmd.name
            )
            FROM template_mapping_data tmd
            WHERE tmd.id = ANY(
                COALESCE((
                    SELECT ARRAY_AGG(st.template_id ORDER BY st.template_id)
                    FROM scenario_templates_junction st
                    WHERE st.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND st.active = true
                ), ARRAY[]::uuid[])
            )
        ), '{}'::types.q_get_scenario_v4_template_resource[])
        ELSE '{}'::types.q_get_scenario_v4_template_resource[]
    END as template_resources,
    CASE 
        WHEN NOT tec.templates_has_tools AND uf.show_templates THEN false
        WHEN sc.use_templates THEN uf.show_templates
        ELSE false
    END as show_templates,
    (SELECT agent_id FROM templates_agent_data) as templates_agent_id,
    CASE 
        WHEN uf.show_templates AND sc.use_templates THEN true
        ELSE false
    END as templates_required,
    ARRAY[]::uuid[] as template_suggestions,
    CASE 
        WHEN sc.use_templates THEN COALESCE((
            SELECT ARRAY_AGG(
                (tmd.id, tmd.name, tmd.description, tmd.html, tmd.generated)::types.q_get_scenario_v4_template_resource
                ORDER BY tmd.name
            )
            FROM (SELECT DISTINCT id, name, description, html, generated FROM template_mapping_data) tmd
            WHERE (
                (SELECT template_search FROM params LIMIT 1) IS NULL
                OR LOWER(tmd.name) LIKE '%' || LOWER((SELECT template_search FROM params LIMIT 1)) || '%'
                OR LOWER(COALESCE(tmd.description, '')) LIKE '%' || LOWER((SELECT template_search FROM params LIMIT 1)) || '%'
            )),
            '{}'::types.q_get_scenario_v4_template_resource[]
        )
        ELSE '{}'::types.q_get_scenario_v4_template_resource[]
    END as templates,
    -- Multi-select resources: personas
    COALESCE((
        SELECT ARRAY_AGG(sp.persona_id ORDER BY sp.persona_id)
        FROM scenario_personas_junction sp
        WHERE sp.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sp.active = true
    ), ARRAY[]::uuid[]) as persona_ids,
    COALESCE((
        SELECT ARRAY_AGG(
            (pmd.persona_id, pmd.name, pmd.description, pmd.color, pmd.icon, pmd.image_model, pmd.parameter_ids, pmd.field_ids, pmd.example)::types.q_get_scenario_v4_persona
            ORDER BY pmd.name
        )
        FROM persona_mapping_data pmd
        WHERE pmd.persona_id = ANY(
            COALESCE((
                SELECT ARRAY_AGG(sp.persona_id ORDER BY sp.persona_id)
                FROM scenario_personas_junction sp
                WHERE sp.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sp.active = true
            ), ARRAY[]::uuid[])
        )
    ), '{}'::types.q_get_scenario_v4_persona[]) as persona_resources,
    CASE 
        WHEN NOT tec.personas_has_tools AND uf.show_personas THEN false
        ELSE uf.show_personas
    END as show_personas,
    (SELECT agent_id FROM personas_agent_data) as personas_agent_id,
    CASE 
        WHEN uf.show_personas THEN true
        ELSE false
    END as personas_required,
    COALESCE((SELECT persona_suggestions FROM persona_suggestions_data), ARRAY[]::uuid[]) as persona_suggestions,
    COALESCE((
        SELECT ARRAY_AGG(
            (pmd.persona_id, pmd.name, pmd.description, pmd.color, pmd.icon, pmd.image_model, pmd.parameter_ids, pmd.field_ids, pmd.example)::types.q_get_scenario_v4_persona
            ORDER BY pmd.name
        ) FROM (SELECT DISTINCT persona_id, name, description, color, icon, image_model, parameter_ids, field_ids, example FROM persona_mapping_data) pmd),
        '{}'::types.q_get_scenario_v4_persona[]
    ) as personas,
    -- Multi-select resources: documents
    COALESCE((
        SELECT ARRAY_AGG(sd.document_id ORDER BY sd.document_id)
        FROM scenario_documents_junction sd
        WHERE sd.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sd.active = true
    ), ARRAY[]::uuid[]) as document_ids,
    COALESCE((
        SELECT ARRAY_AGG(
            (dmd.document_id, dmd.name, dmd.description, dmd.file_path, dmd.mime_type, dmd.parameter_ids, dmd.field_ids, dmd.parent_document_id)::types.q_get_scenario_v4_document
            ORDER BY dmd.name
        )
        FROM document_mapping_data dmd
        WHERE dmd.document_id = ANY(
            COALESCE((
                SELECT ARRAY_AGG(sd.document_id ORDER BY sd.document_id)
                FROM scenario_documents_junction sd
                WHERE sd.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sd.active = true
            ), ARRAY[]::uuid[])
        )
    ), '{}'::types.q_get_scenario_v4_document[]) as document_resources,
    CASE 
        WHEN NOT tec.documents_has_tools AND uf.show_documents THEN false
        ELSE uf.show_documents
    END as show_documents,
    (SELECT agent_id FROM documents_agent_data) as documents_agent_id,
    CASE 
        WHEN uf.show_documents THEN true
        ELSE false
    END as documents_required,
    ARRAY[]::uuid[] as document_suggestions,
    COALESCE((
        SELECT ARRAY_AGG(
            (dmd.document_id, dmd.name, dmd.description, dmd.file_path, dmd.mime_type, dmd.parameter_ids, dmd.field_ids, dmd.parent_document_id)::types.q_get_scenario_v4_document
            ORDER BY dmd.name
        ) FROM (SELECT DISTINCT document_id, name, description, file_path, mime_type, parameter_ids, field_ids, parent_document_id FROM document_mapping_data) dmd),
        '{}'::types.q_get_scenario_v4_document[]
    ) as documents,
    -- Multi-select resources: parameters
    COALESCE((
        SELECT ARRAY_AGG(DISTINCT (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = sf.field_id LIMIT 1) ORDER BY (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = sf.field_id LIMIT 1))
        FROM scenario_fields_junction sf
        WHERE sf.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sf.active = true
          AND (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = sf.field_id LIMIT 1) IS NOT NULL
    ), ARRAY[]::uuid[]) as parameter_ids,
    COALESCE((
        SELECT ARRAY_AGG(
            (pmd.parameter_id, pmd.name, pmd.description, pmd.document_parameter, pmd.persona_parameter, pmd.scenario_parameter, pmd.video_parameter)::types.q_get_scenario_v4_parameter
            ORDER BY pmd.name
        )
        FROM parameter_mapping_data pmd
        WHERE pmd.parameter_id = ANY(
            COALESCE((
                SELECT ARRAY_AGG(DISTINCT (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = sf.field_id LIMIT 1) ORDER BY (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = sf.field_id LIMIT 1))
                FROM scenario_fields_junction sf
                WHERE sf.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sf.active = true
                  AND (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = sf.field_id LIMIT 1) IS NOT NULL
            ), ARRAY[]::uuid[])
        )
    ), '{}'::types.q_get_scenario_v4_parameter[]) as parameter_resources,
    CASE 
        WHEN NOT tec.parameters_has_tools AND uf.show_parameters THEN false
        ELSE uf.show_parameters
    END as show_parameters,
    (SELECT agent_id FROM parameters_agent_data) as parameters_agent_id,
    CASE 
        WHEN uf.show_parameters THEN true
        ELSE false
    END as parameters_required,
    ARRAY[]::uuid[] as parameter_suggestions,
    COALESCE((
        SELECT ARRAY_AGG(
            (pmd.parameter_id, pmd.name, pmd.description, pmd.document_parameter, pmd.persona_parameter, pmd.scenario_parameter, pmd.video_parameter)::types.q_get_scenario_v4_parameter
            ORDER BY pmd.name
        ) FROM (SELECT DISTINCT parameter_id, name, description, document_parameter, persona_parameter, scenario_parameter, video_parameter FROM parameter_mapping_data) pmd),
        '{}'::types.q_get_scenario_v4_parameter[]
    ) as parameters,
    -- Multi-resource combination agent IDs
    (SELECT agent_id FROM basic_agent_data) as basic_agent_id,
    (SELECT agent_id FROM content_agent_data) as content_agent_id,
    (SELECT agent_id FROM general_agent_data) as general_agent_id
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
CROSS JOIN scenario_core sc
CROSS JOIN scenario_exists_check sec
CROSS JOIN draft_group_data dgd
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN problem_statement_resource_data psrd
CROSS JOIN active_flag_resource_data afrd
CROSS JOIN objectives_enabled_flag_resource_data oefrd
CROSS JOIN images_enabled_flag_resource_data iefrd
CROSS JOIN video_enabled_flag_resource_data vefrd
CROSS JOIN questions_enabled_flag_resource_data qefrd
CROSS JOIN problem_statement_enabled_flag_resource_data psefrd
CROSS JOIN use_templates_flag_resource_data utefrd
LEFT JOIN scenario_simulations_agg ssa ON true
$$;
