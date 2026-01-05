-- Get scenario new endpoint data
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_scenario_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_new_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_scenario_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_scenario_new_v4_field_param_filter AS (
    parameter_id uuid,
    show_selected boolean
);

CREATE TYPE types.q_get_scenario_new_v4_department AS (
    department_id uuid,
    name text,
    description text,
    persona_ids uuid[],
    document_ids uuid[],
    parameter_ids uuid[],
    field_ids uuid[]
);

CREATE TYPE types.q_get_scenario_new_v4_persona AS (
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

CREATE TYPE types.q_get_scenario_new_v4_document AS (
    document_id uuid,
    name text,
    description text,
    file_path text,
    mime_type text,
    parameter_ids uuid[],
    field_ids uuid[],
    parent_document_id uuid
);

CREATE TYPE types.q_get_scenario_new_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean,
    numerical boolean
);

CREATE TYPE types.q_get_scenario_new_v4_field AS (
    field_id uuid,
    name text,
    description text,
    parameter_id uuid,
    parameter_name text,
    conditional_parameter_ids uuid[]
);

CREATE TYPE types.q_get_scenario_new_v4_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

CREATE TYPE types.q_get_scenario_new_v4_objective AS (
    objective_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_scenario_new_v4_problem_statement AS (
    problem_statement_id uuid,
    name text,
    problem_statement text,
    created_at timestamptz,
    updated_at timestamptz
);

CREATE TYPE types.q_get_scenario_new_v4_scenario_image AS (
    upload_id uuid,
    name text,
    file_path text,
    mime_type text,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
);

CREATE TYPE types.q_get_scenario_new_v4_scenario_video AS (
    id uuid,
    name text,
    length_seconds integer,
    completed boolean,
    active boolean,
    image_enabled boolean,
    file_path text,
    mime_type text,
    upload_id uuid
);

CREATE TYPE types.q_get_scenario_new_v4_question_option AS (
    id uuid,
    option_text text,
    type text,
    is_correct boolean
);

CREATE TYPE types.q_get_scenario_new_v4_question AS (
    id uuid,
    question_text text,
    allow_multiple boolean,
    active boolean,
    options types.q_get_scenario_new_v4_question_option[],
    times integer[]
);

CREATE TYPE types.q_get_scenario_new_v4_objective_with_departments AS (
    objective text,
    department_ids uuid[]
);

CREATE TYPE types.q_get_scenario_new_v4_document_detail AS (
    document_id uuid,
    name text,
    updated_at timestamptz,
    extension text,
    scenario_ids uuid[],
    can_edit boolean,
    can_delete boolean,
    active boolean,
    department_ids uuid[],
    file_path text,
    mime_type text,
    upload_id uuid,
    field_ids uuid[],
    is_template boolean,
    parent_document_id uuid
);

CREATE TYPE types.q_get_scenario_new_v4_parameter_detail AS (
    param_id uuid,
    selected_items uuid[],
    valid_items uuid[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_scenario_new_v4(
    profile_id uuid,
    use_image boolean DEFAULT NULL,
    use_objectives boolean DEFAULT NULL,
    document_ids uuid[] DEFAULT NULL,
    problem_statement_ids uuid[] DEFAULT NULL,
    template_document_ids uuid[] DEFAULT NULL,
    objective_ids uuid[] DEFAULT NULL,
    image_ids uuid[] DEFAULT NULL,
    use_video boolean DEFAULT NULL,
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
    -- Show selected filters
    persona_show_selected boolean DEFAULT NULL,
    document_show_selected boolean DEFAULT NULL,
    parameter_show_selected boolean DEFAULT NULL,
    field_show_selected_by_param types.q_get_scenario_new_v4_field_param_filter[] DEFAULT ARRAY[]::types.q_get_scenario_new_v4_field_param_filter[],
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    actor_name text,
    user_role text,
    department_ids text[],
    valid_persona_ids text[],
    valid_document_ids text[],
    valid_parameter_ids text[],
    valid_field_ids text[],
    primary_department_id text,
    scenario_agent_id text,
    image_agent_id text,
    video_agent_id text,
    valid_agent_ids text[],
    selected_template_document_ids text[],
    video_enabled boolean,
    questions_enabled boolean,
    persona_range_min integer,
    persona_range_max integer,
    document_range_min integer,
    document_range_max integer,
    parameter_range_min integer,
    parameter_range_max integer,
    question_ids text[],
    departments types.q_get_scenario_new_v4_department[],
    personas types.q_get_scenario_new_v4_persona[],
    documents types.q_get_scenario_new_v4_document[],
    parameters types.q_get_scenario_new_v4_parameter[],
    fields types.q_get_scenario_new_v4_field[],
    agents types.q_get_scenario_new_v4_agent[],
    objectives types.q_get_scenario_new_v4_objective[],
    problem_statements types.q_get_scenario_new_v4_problem_statement[],
    scenario_images types.q_get_scenario_new_v4_scenario_image[],
    scenario_videos types.q_get_scenario_new_v4_scenario_video[],
    questions types.q_get_scenario_new_v4_question[],
    objectives_history types.q_get_scenario_new_v4_objective_with_departments[],
    document_details types.q_get_scenario_new_v4_document_detail[],
    parameters_detail types.q_get_scenario_new_v4_parameter_detail[],
    draft_version int,
    draft_field_show_selected jsonb,
    draft_field_ranges jsonb,
    draft_randomize_parameter_items jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        COALESCE(use_image, false) AS use_image,
        COALESCE(use_objectives, false) AS use_objectives,
        COALESCE(document_ids, ARRAY[]::uuid[]) AS document_ids,
        COALESCE(problem_statement_ids, ARRAY[]::uuid[]) AS problem_statement_ids,
        COALESCE(template_document_ids, ARRAY[]::uuid[]) AS template_document_ids,
        COALESCE(objective_ids, ARRAY[]::uuid[]) AS objective_ids,
        COALESCE(image_ids, ARRAY[]::uuid[]) AS image_ids,
        COALESCE(use_video, false) AS use_video,
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
        -- Show selected filters
        COALESCE(persona_show_selected, false) AS persona_show_selected,
        COALESCE(document_show_selected, false) AS document_show_selected,
        COALESCE(parameter_show_selected, false) AS parameter_show_selected,
        COALESCE(field_show_selected_by_param, ARRAY[]::types.q_get_scenario_new_v4_field_param_filter[]) AS field_show_selected_by_param,
        draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        d.payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    AND d.resource_type = 'scenarios'::draft_resource_type
    LIMIT 1
),
params_single AS (
    SELECT * FROM params LIMIT 1
),
extracted_params AS (
    SELECT 
        ps.document_ids::uuid[] as document_ids,
        ps.problem_statement_ids::uuid[] as problem_statement_ids,
        ps.template_document_ids::uuid[] as template_document_ids,
        ps.objective_ids::uuid[] as objective_ids,
        ps.image_ids::uuid[] as image_ids,
        ps.use_video::boolean as use_video,
        ps.profile_id::uuid as profile_id
    FROM params_single ps
),
user_profile AS (
    SELECT 
        first_name || ' ' || last_name as actor_name,
        role as user_role
    FROM profiles WHERE id = (SELECT profile_id FROM extracted_params)
),
user_departments AS (
    SELECT DISTINCT d.id
    FROM departments d
    JOIN profile_departments pd ON pd.department_id = d.id
    CROSS JOIN params p
    WHERE pd.profile_id = p.profile_id AND pd.active = true AND d.active = true
),
department_persona_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(p.id ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::uuid[]) as persona_ids
    FROM departments d
    INNER JOIN user_departments ud ON d.id = ud.id
    LEFT JOIN personas p ON p.active = true
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    WHERE (
        pd.department_id = d.id 
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
    )
    GROUP BY d.id
),
department_document_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(doc.id ORDER BY doc.id) FILTER (WHERE doc.id IS NOT NULL), ARRAY[]::uuid[]) as document_ids
    FROM departments d
    INNER JOIN user_departments ud ON d.id = ud.id
    LEFT JOIN documents doc ON doc.active = true
    LEFT JOIN document_departments dd ON dd.document_id = doc.id AND dd.active = true
    WHERE (dd.department_id = d.id OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = doc.id AND dd2.active = true))
    GROUP BY d.id
),
department_parameter_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT p.id) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::uuid[]) as parameter_ids
    FROM departments d
    INNER JOIN user_departments ud ON d.id = ud.id
    LEFT JOIN parameters p ON p.active = true
    LEFT JOIN parameter_fields pf ON pf.parameter_id = p.id AND pf.active = true
    LEFT JOIN field_departments fd ON fd.field_id = pf.field_id AND fd.active = true
    WHERE (fd.department_id = d.id OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                                                 JOIN parameter_fields pf2 ON pf2.field_id = fd2.field_id 
                                                 WHERE pf2.parameter_id = p.id AND pf2.active = true AND fd2.active = true))
    GROUP BY d.id
),
department_field_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(f.id ORDER BY f.id) FILTER (WHERE f.id IS NOT NULL), ARRAY[]::uuid[]) as field_ids
    FROM departments d
    INNER JOIN user_departments ud ON d.id = ud.id
    LEFT JOIN fields f ON true
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE (
        fd.department_id = d.id 
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
    )
    GROUP BY d.id
),
all_departments_array AS (
    SELECT 
        d.id as department_id,
        d.title as name,
        COALESCE(d.description, '') as description,
        COALESCE(dpi.persona_ids, ARRAY[]::uuid[]) as persona_ids,
        COALESCE(ddi.document_ids, ARRAY[]::uuid[]) as document_ids,
        COALESCE(dparami.parameter_ids, ARRAY[]::uuid[]) as parameter_ids,
        COALESCE(dfi.field_ids, ARRAY[]::uuid[]) as field_ids
    FROM departments d
    INNER JOIN user_departments ud ON d.id = ud.id
    LEFT JOIN department_persona_ids dpi ON dpi.department_id = d.id
    LEFT JOIN department_document_ids ddi ON ddi.department_id = d.id
    LEFT JOIN department_parameter_ids dparami ON dparami.department_id = d.id
    LEFT JOIN department_field_ids dfi ON dfi.department_id = d.id
),
persona_data AS (
    SELECT 
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.color,
        p.icon,
        false as image_model
    FROM personas p
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.color, p.icon
    HAVING 
        (
            COUNT(pd.persona_id) FILTER (WHERE pd.department_id IN (SELECT id FROM user_departments)) > 0
            OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
        )
        AND (
            CASE 
                WHEN (SELECT use_video FROM extracted_params) = true THEN
                    EXISTS (
                        SELECT 1 
                        FROM persona_fields pf
                        JOIN parameter_fields pfield ON pfield.field_id = pf.field_id
                        JOIN parameters param ON param.id = pfield.parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND pfield.active = true
                        AND param.active = true
                        AND param.video_parameter = true
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM persona_fields pf
                        JOIN field_conditional_parameters fcp ON fcp.field_id = pf.field_id
                        JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND fcp.active = true
                        AND cp.video_parameter = true
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM persona_fields pf
                        JOIN parameter_fields pfield ON pfield.field_id = pf.field_id
                        JOIN parameters param ON param.id = pfield.parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND pfield.active = true
                        AND param.active = true
                        AND param.video_parameter = false
                        AND param.scenario_parameter = false
                    )
                ELSE
                    EXISTS (
                        SELECT 1 
                        FROM persona_fields pf
                        JOIN parameter_fields pfield ON pfield.field_id = pf.field_id
                        JOIN parameters param ON param.id = pfield.parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND pfield.active = true
                        AND param.active = true
                        AND param.scenario_parameter = true
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM persona_fields pf
                        JOIN field_conditional_parameters fcp ON fcp.field_id = pf.field_id
                        JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND fcp.active = true
                        AND cp.scenario_parameter = true
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM persona_fields pf
                        JOIN parameter_fields pfield ON pfield.field_id = pf.field_id
                        JOIN parameters param ON param.id = pfield.parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND pfield.active = true
                        AND param.active = true
                        AND param.video_parameter = false
                        AND param.scenario_parameter = false
                    )
            END
        )
        -- Filter by selected departments
        AND (
            (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM persona_departments pd_filter
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
                SELECT 1 FROM persona_fields pf_filter
                JOIN parameter_fields pfield_filter ON pfield_filter.field_id = pf_filter.field_id
                WHERE pf_filter.persona_id = p.id
                AND pf_filter.active = true
                AND pfield_filter.active = true
                AND pfield_filter.parameter_id = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Filter by selected fields (persona must have selected fields)
        AND (
            (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM persona_fields pf_field_filter
                WHERE pf_field_filter.persona_id = p.id
                AND pf_field_filter.active = true
                AND pf_field_filter.field_id = ANY((SELECT filter_field_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Search filter
        AND (
            (SELECT persona_search FROM params LIMIT 1) IS NULL
            OR LOWER(p.name) LIKE '%' || LOWER((SELECT persona_search FROM params LIMIT 1)) || '%'
            OR LOWER(COALESCE(p.description, '')) LIKE '%' || LOWER((SELECT persona_search FROM params LIMIT 1)) || '%'
        )
        -- Show selected filter
        AND (
            (SELECT persona_show_selected FROM params LIMIT 1) = false
            OR (SELECT array_length(filter_persona_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_persona_ids, 1) FROM params LIMIT 1) = 0
            OR p.id = ANY((SELECT filter_persona_ids FROM params LIMIT 1)::uuid[])
        )
    ORDER BY p.name
),
persona_parameter_relationships AS (
    SELECT DISTINCT
        p.id as persona_id,
        param.id as parameter_id
    FROM persona_data p
    CROSS JOIN parameters param
    WHERE param.active = true
    AND param.persona_parameter = true
    AND (
        EXISTS (
            SELECT 1 FROM persona_fields pf
            JOIN parameter_fields pfield ON pfield.field_id = pf.field_id
            WHERE pf.persona_id = p.id
            AND pfield.parameter_id = param.id
            AND pf.active = true
            AND pfield.active = true
        )
    )
),
persona_fields_data AS (
    SELECT 
        pf.persona_id,
        ARRAY_AGG(pf.field_id ORDER BY pf.field_id) as field_ids
    FROM persona_fields pf
    WHERE pf.active = true
    GROUP BY pf.persona_id
),
persona_examples_data AS (
    SELECT DISTINCT ON (pe.persona_id)
        pe.persona_id,
        e.example
    FROM persona_examples pe
    JOIN examples e ON e.id = pe.example_id
    WHERE pe.persona_id IN (SELECT id FROM persona_data)
    ORDER BY pe.persona_id, pe.idx
),
all_personas_array AS (
    SELECT 
        p.id as persona_id,
        p.name,
        p.description,
        p.color,
        p.icon,
        p.image_model,
        COALESCE((
            SELECT ARRAY_AGG(ppr.parameter_id ORDER BY ppr.parameter_id)
            FROM persona_parameter_relationships ppr
            WHERE ppr.persona_id = p.id
        ), ARRAY[]::uuid[]) as parameter_ids,
        COALESCE(pfd.field_ids, ARRAY[]::uuid[]) as field_ids,
        ped.example
    FROM persona_data p
    LEFT JOIN persona_fields_data pfd ON pfd.persona_id = p.id
    LEFT JOIN persona_examples_data ped ON ped.persona_id = p.id
),
document_data_base AS (
    SELECT 
        d.id,
        d.name,
        ''::text as description
    FROM documents d
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    WHERE d.active = true
    GROUP BY d.id, d.name
    HAVING 
        (
            COUNT(dd.document_id) FILTER (WHERE dd.department_id IN (SELECT id FROM user_departments)) > 0
            OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
        )
        AND (
            CASE 
                WHEN (SELECT use_video FROM extracted_params) = true THEN
                    EXISTS (
                        SELECT 1 
                        FROM document_fields df
                        JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                        JOIN parameters param ON param.id = pfield.parameter_id
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND pfield.active = true
                        AND param.active = true
                        AND param.video_parameter = true
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM document_fields df
                        JOIN field_conditional_parameters fcp ON fcp.field_id = df.field_id
                        JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND fcp.active = true
                        AND cp.video_parameter = true
                    )
                ELSE
                    EXISTS (
                        SELECT 1 
                        FROM document_fields df
                        JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                        JOIN parameters param ON param.id = pfield.parameter_id
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND pfield.active = true
                        AND param.active = true
                        AND param.scenario_parameter = true
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM document_fields df
                        JOIN field_conditional_parameters fcp ON fcp.field_id = df.field_id
                        JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND fcp.active = true
                        AND cp.scenario_parameter = true
                    )
                    OR EXISTS (
                        SELECT 1 
                        FROM document_fields df
                        JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                        JOIN parameters param ON param.id = pfield.parameter_id
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND pfield.active = true
                        AND param.active = true
                        AND param.video_parameter = false
                        AND param.scenario_parameter = false
                    )
            END
        )
    UNION
    SELECT DISTINCT
        d.id,
        d.name,
        ''::text as description
    FROM documents d
    WHERE d.active = true
    AND (SELECT document_ids FROM extracted_params LIMIT 1) IS NOT NULL
    AND array_length((SELECT document_ids FROM extracted_params LIMIT 1), 1) > 0
            AND d.id IN (SELECT unnest((SELECT document_ids FROM extracted_params LIMIT 1)::uuid[]))
    AND (
        CASE 
            WHEN (SELECT use_video FROM params LIMIT 1) = true THEN
                EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                    JOIN parameters param ON param.id = pfield.parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND pfield.active = true
                    AND param.active = true
                    AND param.video_parameter = true
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN field_conditional_parameters fcp ON fcp.field_id = df.field_id
                    JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND fcp.active = true
                    AND cp.video_parameter = true
                )
            ELSE
                EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                    JOIN parameters param ON param.id = pfield.parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND pfield.active = true
                    AND param.active = true
                    AND param.scenario_parameter = true
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN field_conditional_parameters fcp ON fcp.field_id = df.field_id
                    JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND fcp.active = true
                    AND cp.scenario_parameter = true
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                    JOIN parameters param ON param.id = pfield.parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND pfield.active = true
                    AND param.active = true
                    AND param.video_parameter = false
                    AND param.scenario_parameter = false
                )
        END
    )
    UNION
    SELECT DISTINCT
        d.id,
        d.name,
        ''::text as description
    FROM documents d
    WHERE d.active = true
    AND (SELECT template_document_ids FROM extracted_params LIMIT 1) IS NOT NULL
    AND array_length((SELECT template_document_ids FROM extracted_params LIMIT 1), 1) > 0
    AND d.id IN (SELECT unnest((SELECT template_document_ids FROM extracted_params LIMIT 1)::uuid[]))
    AND (
        CASE 
            WHEN (SELECT use_video FROM params LIMIT 1) = true THEN
                EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                    JOIN parameters param ON param.id = pfield.parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND pfield.active = true
                    AND param.active = true
                    AND param.video_parameter = true
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN field_conditional_parameters fcp ON fcp.field_id = df.field_id
                    JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND fcp.active = true
                    AND cp.video_parameter = true
                )
            ELSE
                EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                    JOIN parameters param ON param.id = pfield.parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND pfield.active = true
                    AND param.active = true
                    AND param.scenario_parameter = true
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN field_conditional_parameters fcp ON fcp.field_id = df.field_id
                    JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND fcp.active = true
                    AND cp.scenario_parameter = true
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN parameter_fields pfield ON pfield.field_id = df.field_id
                    JOIN parameters param ON param.id = pfield.parameter_id
                    WHERE df.document_id = d.id
                    AND df.active = true
                    AND pfield.active = true
                    AND param.active = true
                    AND param.video_parameter = false
                    AND param.scenario_parameter = false
                )
        END
    )
),
document_data AS (
    SELECT DISTINCT
        ddb.id,
        ddb.name,
        ddb.description
    FROM document_data_base ddb
    WHERE
        -- Filter by selected departments
        (
            (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM document_departments dd_filter
                WHERE dd_filter.document_id = ddb.id
                AND dd_filter.active = true
                AND dd_filter.department_id = ANY((SELECT filter_department_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Filter by selected parameters (document must have fields from selected parameters)
        AND (
            (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM document_fields df_filter
                JOIN parameter_fields pfield_filter ON pfield_filter.field_id = df_filter.field_id
                WHERE df_filter.document_id = ddb.id
                AND df_filter.active = true
                AND pfield_filter.active = true
                AND pfield_filter.parameter_id = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Filter by selected fields (document must have selected fields)
        AND (
            (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM document_fields df_field_filter
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
    ORDER BY ddb.name
),
document_parameter_relationships AS (
    SELECT DISTINCT
        d.id as document_id,
        param.id as parameter_id
    FROM document_data d
    CROSS JOIN parameters param
    WHERE param.active = true
    AND param.document_parameter = true
    AND (
        EXISTS (
            SELECT 1 FROM document_fields df
            JOIN parameter_fields pfield ON pfield.field_id = df.field_id
            WHERE df.document_id = d.id
            AND pfield.parameter_id = param.id
            AND df.active = true
            AND pfield.active = true
        )
    )
),
document_fields_data AS (
    SELECT 
        df.document_id,
        ARRAY_AGG(df.field_id ORDER BY df.field_id) as field_ids
    FROM document_fields df
    WHERE df.active = true
    GROUP BY df.document_id
),
document_tree_data AS (
    SELECT DISTINCT ON (dt.child_id)
        dt.child_id as document_id,
        dt.parent_id
    FROM document_tree dt
    WHERE dt.active = true
    ORDER BY dt.child_id, dt.created_at DESC
),
all_documents_array AS (
    SELECT 
        d.id as document_id,
        d.name,
        d.description,
        COALESCE(u.file_path, template_u.file_path) as file_path,
        COALESCE(u.mime_type, template_u.mime_type) as mime_type,
        COALESCE((
            SELECT ARRAY_AGG(dpr.parameter_id ORDER BY dpr.parameter_id)
            FROM document_parameter_relationships dpr
            WHERE dpr.document_id = d.id
        ), ARRAY[]::uuid[]) as parameter_ids,
        COALESCE(dfd.field_ids, ARRAY[]::uuid[]) as field_ids,
        dtd.parent_id as parent_document_id
    FROM document_data d
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    LEFT JOIN document_templates dt ON dt.document_id = d.id AND dt.active = true
    LEFT JOIN html h ON h.id = dt.html_id
    LEFT JOIN html_uploads hu ON hu.html_id = h.id AND hu.active = true
    LEFT JOIN uploads template_u ON template_u.id = hu.upload_id
    LEFT JOIN document_fields_data dfd ON dfd.document_id = d.id
    LEFT JOIN document_tree_data dtd ON dtd.document_id = d.id
),
available_scenario_parameters AS (
    SELECT DISTINCT
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.document_parameter,
        p.persona_parameter,
        p.scenario_parameter,
        p.video_parameter,
        false as numerical
    FROM parameters p
    WHERE p.active = true
    AND p.scenario_parameter = true
    AND (
        EXISTS (
            SELECT 1 FROM parameter_fields pf
            JOIN fields f ON f.id = pf.field_id
            LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
            WHERE pf.parameter_id = p.id
            AND pf.active = true
            AND f.active = true
            AND (
                fd.department_id IN (SELECT id FROM user_departments)
                OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
            )
        )
    )
),
parameter_data AS (
    SELECT DISTINCT 
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.document_parameter,
        p.persona_parameter
    FROM parameters p
    JOIN parameter_fields pf ON pf.parameter_id = p.id AND pf.active = true
    LEFT JOIN field_departments fd ON fd.field_id = pf.field_id AND fd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.document_parameter, p.persona_parameter
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id IN (SELECT id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN parameter_fields pf2 ON pf2.field_id = fd2.field_id 
                      WHERE pf2.parameter_id = p.id AND pf2.active = true)
        -- Filter by selected departments
        AND (
            (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM parameter_fields pf_dept_filter
                JOIN field_departments fd_dept_filter ON fd_dept_filter.field_id = pf_dept_filter.field_id
                WHERE pf_dept_filter.parameter_id = p.id
                AND pf_dept_filter.active = true
                AND fd_dept_filter.active = true
                AND fd_dept_filter.department_id = ANY((SELECT filter_department_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Search filter
        AND (
            (SELECT parameter_search FROM params LIMIT 1) IS NULL
            OR LOWER(p.name) LIKE '%' || LOWER((SELECT parameter_search FROM params LIMIT 1)) || '%'
            OR LOWER(COALESCE(p.description, '')) LIKE '%' || LOWER((SELECT parameter_search FROM params LIMIT 1)) || '%'
        )
        -- Show selected filter
        AND (
            (SELECT parameter_show_selected FROM params LIMIT 1) = false
            OR (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) = 0
            OR p.id = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
        )
    ORDER BY p.name
),
all_parameters_array AS (
    SELECT 
        p.id as parameter_id,
        p.name,
        p.description,
        p.document_parameter,
        p.persona_parameter,
        p.scenario_parameter,
        p.video_parameter,
        p.numerical
    FROM available_scenario_parameters p
),
parameter_item_data AS (
    SELECT 
        f.id,
        f.name,
        COALESCE(f.description, '') as description,
        pf.parameter_id,
        p.name as parameter_name
    FROM fields f
    JOIN parameter_fields pf ON pf.field_id = f.id AND pf.active = true
    JOIN parameters p ON p.id = pf.parameter_id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE p.active = true AND f.active = true
    GROUP BY f.id, f.name, f.description, pf.parameter_id, p.id, p.name
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id IN (SELECT id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
        -- Filter by selected departments
        AND (
            (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM field_departments fd_dept_filter
                WHERE fd_dept_filter.field_id = f.id
                AND fd_dept_filter.active = true
                AND fd_dept_filter.department_id = ANY((SELECT filter_department_ids FROM params LIMIT 1)::uuid[])
            )
            OR NOT EXISTS (SELECT 1 FROM field_departments fd_no_dept WHERE fd_no_dept.field_id = f.id AND fd_no_dept.active = true)
        )
        -- Filter by selected parameters (field must belong to selected parameter)
        AND (
            (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_parameter_ids, 1) FROM params LIMIT 1) = 0
            OR pf.parameter_id = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
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
                SELECT 1 FROM persona_fields pf_persona_filter
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
                SELECT 1 FROM document_fields df_doc_filter
                WHERE df_doc_filter.field_id = f.id
                AND df_doc_filter.active = true
                AND df_doc_filter.document_id = ANY((SELECT filter_document_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Per-parameter show_selected filter (check if field_show_selected_by_param has this parameter set to true)
        AND (
            array_length((SELECT field_show_selected_by_param FROM params LIMIT 1), 1) IS NULL
            OR NOT EXISTS (
                SELECT 1 FROM UNNEST((SELECT field_show_selected_by_param FROM params LIMIT 1)) as fp_filter
                WHERE fp_filter.parameter_id = pf.parameter_id AND fp_filter.show_selected = true
            )
            OR f.id = ANY((SELECT filter_field_ids FROM params LIMIT 1)::uuid[])
        )
    ORDER BY p.name, f.name
),
field_conditional_parameters_data AS (
    SELECT 
        fcp.field_id,
        ARRAY_AGG(fcp.conditional_parameter_id ORDER BY fcp.conditional_parameter_id) as conditional_parameter_ids
    FROM field_conditional_parameters fcp
    WHERE fcp.active = true
    GROUP BY fcp.field_id
),
all_fields_array AS (
    SELECT 
        pi.id as field_id,
        pi.name,
        pi.description,
        pi.parameter_id,
        pi.parameter_name,
        COALESCE(fcpd.conditional_parameter_ids, ARRAY[]::uuid[]) as conditional_parameter_ids
    FROM parameter_item_data pi
    LEFT JOIN field_conditional_parameters_data fcpd ON fcpd.field_id = pi.id
),
all_parameters_detail_array AS (
    SELECT 
        pd.id as param_id,
        ARRAY[]::uuid[] as selected_items,
        COALESCE((
            SELECT ARRAY_AGG(f.id ORDER BY f.id)
            FROM fields f
            JOIN parameter_fields pf ON pf.field_id = f.id AND pf.active = true
            WHERE pf.parameter_id = pd.id AND f.active = true
        ), ARRAY[]::uuid[]) as valid_items
    FROM parameter_data pd
),
primary_department_id AS (
    SELECT department_id::text
    FROM profile_departments
    WHERE profile_id = (SELECT profile_id FROM extracted_params LIMIT 1) AND is_primary = TRUE
    LIMIT 1
),
first_user_department AS (
    SELECT ud.id
    FROM user_departments ud
    ORDER BY ud.id
    LIMIT 1
),
resolved_department_for_agents AS (
    SELECT COALESCE(
        (SELECT pd.department_id FROM profile_departments pd WHERE pd.profile_id = (SELECT profile_id FROM extracted_params LIMIT 1) AND pd.is_primary = TRUE LIMIT 1),
        (SELECT id FROM first_user_department)
    ) as department_id
),
expected_agent_role AS (
    SELECT 'scenario'::agent_role as role
),
default_scenario_agent AS (
    SELECT a.id::text as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN resolved_department_for_agents rdfa
    CROSS JOIN expected_agent_role ear
    WHERE a.role = ear.role
    AND a.active = true
    AND (
        ad.department_id = rdfa.department_id
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        CASE WHEN ad.department_id = rdfa.department_id THEN 0 ELSE 1 END
    LIMIT 1
),
default_image_agent AS (
    SELECT a.id::text as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN resolved_department_for_agents rdfa
    WHERE a.role = 'image'
    AND a.active = true
    AND (
        ad.department_id = rdfa.department_id
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        CASE WHEN ad.department_id = rdfa.department_id THEN 0 ELSE 1 END
    LIMIT 1
),
default_video_agent AS (
    SELECT a.id::text as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN resolved_department_for_agents rdfa
    WHERE a.role = 'video'
    AND a.active = true
    AND (
        ad.department_id = rdfa.department_id
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        CASE WHEN ad.department_id = rdfa.department_id THEN 0 ELSE 1 END
    LIMIT 1
),
agent_filtered AS (
    SELECT a.id, a.name, a.description, a.role
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN expected_agent_role ear
    WHERE a.active = true 
    AND (
        a.role = ear.role
        OR a.role = 'image'
        OR a.role = 'video'
    )
    GROUP BY a.id, a.name, a.description, a.role, ear.role
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
all_agents_array AS (
    SELECT 
        af.id as agent_id,
        af.name,
        COALESCE(af.description, '') as description,
        ARRAY[af.role::text] as roles
    FROM agent_filtered af
),
accessible_scenarios_default AS (
    SELECT DISTINCT s.id as scenario_id
    FROM scenarios s
    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
    WHERE s.active = true
    AND (
        sd.department_id IN (SELECT id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
    )
),
objectives_with_departments_default AS (
    SELECT
        o.objective,
        COALESCE((
            SELECT ARRAY_AGG(DISTINCT dept_id ORDER BY dept_id)
            FROM (
                SELECT DISTINCT sd.department_id as dept_id
                FROM scenario_objectives so2
                JOIN objectives o2 ON o2.id = so2.objective_id
                JOIN accessible_scenarios_default acs2 ON acs2.scenario_id = so2.scenario_id
                LEFT JOIN scenario_departments sd ON sd.scenario_id = so2.scenario_id AND sd.active = true
                WHERE o2.objective = o.objective
                    AND o2.objective IS NOT NULL 
                    AND o2.objective != ''
                    AND sd.department_id IS NOT NULL
            ) dept_list
        ), ARRAY[]::uuid[]) as department_ids
    FROM scenario_objectives so
    JOIN objectives o ON o.id = so.objective_id
    JOIN accessible_scenarios_default acs ON acs.scenario_id = so.scenario_id
    WHERE o.objective IS NOT NULL AND o.objective != ''
    GROUP BY o.objective
),
all_objectives_array AS (
    SELECT 
        o.id as objective_id,
        o.objective as name,
        o.objective as description
    FROM objectives o
    LEFT JOIN objective_departments od_dept ON od_dept.objective_id = o.id AND od_dept.active = true
    WHERE (
        ((SELECT objective_ids FROM extracted_params LIMIT 1) IS NOT NULL AND array_length((SELECT objective_ids FROM extracted_params LIMIT 1), 1) > 0 AND o.id = ANY((SELECT objective_ids FROM extracted_params LIMIT 1)::uuid[]))
        OR ((SELECT objective_ids FROM extracted_params LIMIT 1) IS NULL OR array_length((SELECT objective_ids FROM extracted_params LIMIT 1), 1) = 0)
    )
    AND (
        od_dept.department_id IN (SELECT id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM objective_departments od2 WHERE od2.objective_id = o.id AND od2.active = true)
    )
),
all_problem_statements_array AS (
    SELECT 
        ps.id as problem_statement_id,
        ps.name,
        ps.problem_statement,
        ps.created_at,
        ps.updated_at
    FROM problem_statements ps
    LEFT JOIN problem_statement_departments psd_dept ON psd_dept.problem_statement_id = ps.id AND psd_dept.active = true
    WHERE (
        psd_dept.department_id IN (SELECT id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM problem_statement_departments psd2 WHERE psd2.problem_statement_id = ps.id AND psd2.active = true)
    )
    AND (
        ((SELECT problem_statement_ids FROM extracted_params LIMIT 1) IS NULL OR array_length((SELECT problem_statement_ids FROM extracted_params LIMIT 1), 1) = 0)
        OR ps.id IN (SELECT unnest((SELECT problem_statement_ids FROM extracted_params LIMIT 1)::uuid[]))
    )
),
all_scenario_images_array AS (
    SELECT 
        COALESCE(iu.upload_id, i.id) as upload_id,
        i.name,
        u.file_path,
        u.mime_type,
        i.active,
        i.created_at,
        i.updated_at
    FROM images i
    LEFT JOIN image_uploads iu ON iu.image_id = i.id AND iu.active = true
    LEFT JOIN uploads u ON u.id = iu.upload_id
    LEFT JOIN image_departments id_dept ON id_dept.image_id = i.id AND id_dept.active = true
    WHERE i.active = true
    AND (
        id_dept.department_id IN (SELECT id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM image_departments id2 WHERE id2.image_id = i.id AND id2.active = true)
    )
    ORDER BY i.created_at DESC
),
all_scenario_videos_array AS (
    SELECT 
        v.id,
        v.name,
        v.length_seconds,
        v.completed,
        v.active,
        v.image_enabled,
        u.file_path,
        u.mime_type,
        u.id as upload_id
    FROM videos v
    LEFT JOIN video_uploads vu ON vu.video_id = v.id AND vu.active = true
    LEFT JOIN uploads u ON u.id = vu.upload_id
    LEFT JOIN video_departments vd_dept ON vd_dept.video_id = v.id AND vd_dept.active = true
    WHERE v.active = true
    AND (
        vd_dept.department_id IN (SELECT id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM video_departments vd2 WHERE vd2.video_id = v.id AND vd2.active = true)
    )
    ORDER BY v.created_at DESC
),
all_document_details_array AS (
    SELECT 
        d.id as document_id,
        d.name,
        d.updated_at,
        CASE 
            WHEN u.file_path IS NOT NULL THEN SUBSTRING(u.file_path FROM '\\.([^\\.]+)$')
            WHEN template_u.file_path IS NOT NULL THEN SUBSTRING(template_u.file_path FROM '\\.([^\\.]+)$')
            ELSE NULL 
        END as extension,
        ARRAY[]::uuid[] as scenario_ids,
        true as can_edit,
        true as can_delete,
        d.active,
        COALESCE((
            SELECT ARRAY_AGG(DISTINCT dd.department_id)
            FROM document_departments dd
            WHERE dd.document_id = d.id AND dd.active = true
        ), ARRAY[]::uuid[]) as department_ids,
        COALESCE(u.file_path, template_u.file_path) as file_path,
        COALESCE(u.mime_type, template_u.mime_type) as mime_type,
        COALESCE(u.id, template_u.id) as upload_id,
        dt.html_id as html_id,
        COALESCE((
            SELECT ARRAY_AGG(df.field_id)
            FROM document_fields df
            WHERE df.document_id = d.id AND df.active = true
        ), ARRAY[]::uuid[]) as field_ids,
        CASE 
            WHEN d.template = true THEN true
            WHEN EXISTS(
                SELECT 1 FROM document_templates dt2 
                WHERE dt2.document_id = d.id AND dt2.active = true
            ) THEN true
            ELSE false
        END as is_template,
        dtd.parent_id as parent_document_id
    FROM documents d
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    LEFT JOIN document_templates dt ON dt.document_id = d.id AND dt.active = true
    LEFT JOIN html h ON h.id = dt.html_id
    LEFT JOIN html_uploads hu ON hu.html_id = h.id AND hu.active = true
    LEFT JOIN uploads template_u ON template_u.id = hu.upload_id
    LEFT JOIN document_tree_data dtd ON dtd.document_id = d.id
    WHERE (
        d.id IN (SELECT id FROM document_data)
        OR (
            (SELECT document_ids FROM params_single) IS NOT NULL
            AND array_length((SELECT document_ids FROM params_single), 1) > 0
            AND d.id IN (SELECT unnest((SELECT document_ids FROM params_single)::uuid[]))
        )
        OR (
            (SELECT document_ids FROM params_single) IS NOT NULL
            AND array_length((SELECT document_ids FROM params_single), 1) > 0
            AND EXISTS (
                SELECT 1 FROM document_tree dtree
                WHERE dtree.child_id = d.id
                AND dtree.parent_id IN (SELECT unnest((SELECT document_ids FROM params_single)::uuid[]))
                AND dtree.active = true
            )
        )
    )
    AND d.active = true
    ORDER BY d.name
)
SELECT 
    up.actor_name::text as actor_name,
    up.user_role::text as user_role,
    COALESCE(
        (SELECT ARRAY_AGG(id::text ORDER BY id) FROM user_departments),
        ARRAY[]::text[]
    ) as department_ids,
    COALESCE(
        (SELECT ARRAY_AGG(id::text) FROM persona_data),
        ARRAY[]::text[]
    ) as valid_persona_ids,
    COALESCE(
        (SELECT ARRAY_AGG(id::text) FROM document_data),
        ARRAY[]::text[]
    ) as valid_document_ids,
    COALESCE(
        (SELECT ARRAY_AGG(parameter_id::text ORDER BY name) FROM all_parameters_array),
        ARRAY[]::text[]
    ) as valid_parameter_ids,
    COALESCE(
        (SELECT ARRAY_AGG(field_id::text ORDER BY parameter_name, name) FROM all_fields_array),
        ARRAY[]::text[]
    ) as valid_field_ids,
    (SELECT department_id FROM primary_department_id) as primary_department_id,
    COALESCE((SELECT agent_id FROM default_scenario_agent), '') as scenario_agent_id,
    COALESCE((SELECT agent_id FROM default_image_agent), '') as image_agent_id,
    COALESCE((SELECT agent_id FROM default_video_agent), '') as video_agent_id,
    COALESCE((SELECT ARRAY_AGG(agent_id::text ORDER BY name) FROM all_agents_array), ARRAY[]::text[]) as valid_agent_ids,
    COALESCE(
        (SELECT ARRAY_AGG(d.id::text)
         FROM documents d
         WHERE d.active = true
         AND (SELECT template_document_ids FROM extracted_params) IS NOT NULL
         AND array_length((SELECT template_document_ids FROM extracted_params), 1) > 0
         AND d.id IN (SELECT unnest((SELECT template_document_ids FROM extracted_params LIMIT 1)::uuid[]))
         AND d.id IN (SELECT id FROM document_data)),
        ARRAY[]::text[]
    ) as selected_template_document_ids,
    false as video_enabled,
    false as questions_enabled,
    1 as persona_range_min,
    3 as persona_range_max,
    0 as document_range_min,
    3 as document_range_max,
    0 as parameter_range_min,
    3 as parameter_range_max,
    ARRAY[]::text[] as question_ids,
    -- Arrays of composite types (aggregated from subqueries)
    COALESCE(
        (SELECT ARRAY_AGG((ada.department_id, ada.name, ada.description, ada.persona_ids, ada.document_ids, ada.parameter_ids, ada.field_ids)::types.q_get_scenario_new_v4_department ORDER BY ada.name) FROM all_departments_array ada),
        '{}'::types.q_get_scenario_new_v4_department[]
    ) as departments,
    COALESCE(
        (SELECT ARRAY_AGG((apa.persona_id, apa.name, apa.description, apa.color, apa.icon, apa.image_model, apa.parameter_ids, apa.field_ids, apa.example)::types.q_get_scenario_new_v4_persona ORDER BY apa.name) FROM all_personas_array apa),
        '{}'::types.q_get_scenario_new_v4_persona[]
    ) as personas,
    COALESCE(
        (SELECT ARRAY_AGG((ada2.document_id, ada2.name, ada2.description, ada2.file_path, ada2.mime_type, ada2.parameter_ids, ada2.field_ids, ada2.parent_document_id)::types.q_get_scenario_new_v4_document ORDER BY ada2.name) FROM all_documents_array ada2),
        '{}'::types.q_get_scenario_new_v4_document[]
    ) as documents,
    COALESCE(
        (SELECT ARRAY_AGG((aparam.parameter_id, aparam.name, aparam.description, aparam.document_parameter, aparam.persona_parameter, aparam.scenario_parameter, aparam.video_parameter, aparam.numerical)::types.q_get_scenario_new_v4_parameter ORDER BY aparam.name) FROM all_parameters_array aparam),
        '{}'::types.q_get_scenario_new_v4_parameter[]
    ) as parameters,
    COALESCE(
        (SELECT ARRAY_AGG((afa.field_id, afa.name, afa.description, afa.parameter_id, afa.parameter_name, afa.conditional_parameter_ids)::types.q_get_scenario_new_v4_field ORDER BY afa.parameter_name, afa.name) FROM all_fields_array afa),
        '{}'::types.q_get_scenario_new_v4_field[]
    ) as fields,
    COALESCE(
        (SELECT ARRAY_AGG((aag.agent_id, aag.name, aag.description, aag.roles)::types.q_get_scenario_new_v4_agent ORDER BY aag.name) FROM all_agents_array aag),
        '{}'::types.q_get_scenario_new_v4_agent[]
    ) as agents,
    COALESCE(
        (SELECT ARRAY_AGG((aoa.objective_id, aoa.name, aoa.description)::types.q_get_scenario_new_v4_objective ORDER BY aoa.name) FROM all_objectives_array aoa),
        '{}'::types.q_get_scenario_new_v4_objective[]
    ) as objectives,
    COALESCE(
        (SELECT ARRAY_AGG((aps.problem_statement_id, aps.name, aps.problem_statement, aps.created_at, aps.updated_at)::types.q_get_scenario_new_v4_problem_statement ORDER BY aps.name) FROM all_problem_statements_array aps),
        '{}'::types.q_get_scenario_new_v4_problem_statement[]
    ) as problem_statements,
    COALESCE(
        (SELECT ARRAY_AGG((asi.upload_id, asi.name, asi.file_path, asi.mime_type, asi.active, asi.created_at, asi.updated_at)::types.q_get_scenario_new_v4_scenario_image ORDER BY asi.created_at DESC) FROM all_scenario_images_array asi),
        '{}'::types.q_get_scenario_new_v4_scenario_image[]
    ) as scenario_images,
    COALESCE(
        (SELECT ARRAY_AGG((asv.id, asv.name, asv.length_seconds, asv.completed, asv.active, asv.image_enabled, asv.file_path, asv.mime_type, asv.upload_id)::types.q_get_scenario_new_v4_scenario_video ORDER BY asv.id) FROM all_scenario_videos_array asv),
        '{}'::types.q_get_scenario_new_v4_scenario_video[]
    ) as scenario_videos,
    COALESCE(
        ARRAY[]::types.q_get_scenario_new_v4_question[],
        '{}'::types.q_get_scenario_new_v4_question[]
    ) as questions,
    COALESCE(
        (SELECT ARRAY_AGG((owd.objective, owd.department_ids)::types.q_get_scenario_new_v4_objective_with_departments ORDER BY owd.objective) FROM objectives_with_departments_default owd),
        '{}'::types.q_get_scenario_new_v4_objective_with_departments[]
    ) as objectives_history,
    COALESCE(
        (SELECT ARRAY_AGG((add.document_id, add.name, add.updated_at, add.extension, add.scenario_ids, add.can_edit, add.can_delete, add.active, add.department_ids, add.file_path, add.mime_type, add.upload_id, add.field_ids, add.is_template, add.parent_document_id)::types.q_get_scenario_new_v4_document_detail ORDER BY add.name) FROM all_document_details_array add),
        '{}'::types.q_get_scenario_new_v4_document_detail[]
    ) as document_details,
    COALESCE(
        (SELECT ARRAY_AGG((apd.param_id, apd.selected_items, apd.valid_items)::types.q_get_scenario_new_v4_parameter_detail ORDER BY apd.param_id) FROM all_parameters_detail_array apd),
        '{}'::types.q_get_scenario_new_v4_parameter_detail[]
    ) as parameters_detail,
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version,
    -- Extract nested objects from draft payload if available
    COALESCE(
        (SELECT payload->'fieldShowSelected' FROM draft_payload_data),
        (SELECT payload->'field_show_selected' FROM draft_payload_data),
        '{}'::jsonb
    ) as draft_field_show_selected,
    COALESCE(
        (SELECT payload->'fieldRanges' FROM draft_payload_data),
        (SELECT payload->'field_ranges' FROM draft_payload_data),
        '{}'::jsonb
    ) as draft_field_ranges,
    COALESCE(
        (SELECT payload->'randomizeParameterItems' FROM draft_payload_data),
        (SELECT payload->'randomize_parameter_items' FROM draft_payload_data),
        '{}'::jsonb
    ) as draft_randomize_parameter_items
FROM user_profile up
$$;