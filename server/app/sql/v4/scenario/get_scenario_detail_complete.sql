-- Get scenario detail with departments, problem statements, and access control
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- Parameters: scenario_id (uuid), profile_id (uuid), use_image (bool, nullable), use_objectives (bool, nullable), 
--            document_ids (uuid[], nullable), problem_statement_ids (uuid[], nullable), 
--            template_document_ids (uuid[], nullable), use_video (bool, nullable, for video parameter filtering)
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_scenario_detail_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_detail_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_scenario_detail_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_scenario_detail_v4_field_param_filter AS (
    parameter_id uuid,
    show_selected boolean
);

CREATE TYPE types.q_get_scenario_detail_v4_persona AS (
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

CREATE TYPE types.q_get_scenario_detail_v4_document AS (
    document_id uuid,
    name text,
    description text,
    file_path text,
    mime_type text,
    parameter_ids uuid[],
    field_ids uuid[],
    parent_document_id uuid
);

CREATE TYPE types.q_get_scenario_detail_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean
);

CREATE TYPE types.q_get_scenario_detail_v4_field AS (
    field_id uuid,
    name text,
    description text,
    parameter_id uuid,
    parameter_name text,
    conditional_parameter_ids uuid[]
);

CREATE TYPE types.q_get_scenario_detail_v4_department AS (
    department_id uuid,
    name text,
    description text,
    persona_ids uuid[],
    document_ids uuid[],
    parameter_ids uuid[],
    field_ids uuid[]
);

CREATE TYPE types.q_get_scenario_detail_v4_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

CREATE TYPE types.q_get_scenario_detail_v4_simulation AS (
    simulation_id uuid,
    name text,
    description text,
    time_limit bigint,
    department_ids uuid[]
);

CREATE TYPE types.q_get_scenario_detail_v4_objective AS (
    objective_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_scenario_detail_v4_problem_statement AS (
    problem_statement_id uuid,
    name text,
    problem_statement text,
    created_at timestamptz,
    updated_at timestamptz
);

CREATE TYPE types.q_get_scenario_detail_v4_scenario_image AS (
    upload_id uuid,
    name text,
    file_path text,
    mime_type text,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
);

CREATE TYPE types.q_get_scenario_detail_v4_scenario_video AS (
    id uuid,
    name text,
    length_seconds integer,
    completed boolean,
    active boolean,
    file_path text,
    mime_type text,
    upload_id uuid
);

CREATE TYPE types.q_get_scenario_detail_v4_question_option AS (
    id uuid,
    option_text text,
    is_correct boolean
);

CREATE TYPE types.q_get_scenario_detail_v4_question AS (
    id uuid,
    question_text text,
    allow_multiple boolean,
    active boolean,
    options types.q_get_scenario_detail_v4_question_option[],
    times integer[]
);

CREATE TYPE types.q_get_scenario_detail_v4_objective_with_departments AS (
    objective text,
    department_ids uuid[]
);

CREATE TYPE types.q_get_scenario_detail_v4_document_detail AS (
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

CREATE TYPE types.q_get_scenario_detail_v4_parameter_detail AS (
    parameter_id uuid,
    field_ids uuid[],
    valid_field_ids uuid[]
);

CREATE TYPE types.q_get_scenario_detail_v4_field_range AS (
    parameter_id uuid,
    min_count integer,
    max_count integer
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_scenario_detail_v4(
    scenario_id uuid,
    profile_id uuid,
    use_image boolean DEFAULT NULL,
    use_objectives boolean DEFAULT NULL,
    document_ids uuid[] DEFAULT NULL,
    problem_statement_ids uuid[] DEFAULT NULL,
    template_document_ids uuid[] DEFAULT NULL,
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
    field_show_selected_by_param types.q_get_scenario_detail_v4_field_param_filter[] DEFAULT ARRAY[]::types.q_get_scenario_detail_v4_field_param_filter[],
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    scenario_exists boolean,
    scenario_id uuid,
    name text,
    description text,
    problem_statement text,
    problem_statement_id text,
    active boolean,
    generated boolean,
    department_ids text[],
    parent_scenario_id uuid,
    hints_enabled boolean,
    objectives_enabled boolean,
    image_input_enabled boolean,
    persona_ids text[],
    document_ids text[],
    objective_ids text[],
    simulation_ids text[],
    valid_persona_ids text[],
    valid_document_ids text[],
    valid_department_ids uuid[],
    active_usage_count bigint,
    user_role text,
    actor_name text,
    parameter_ids text[],
    valid_parameter_ids text[],
    valid_field_ids text[],
    question_ids text[],
    persona_range_min integer,
    persona_range_max integer,
    document_range_min integer,
    document_range_max integer,
    parameter_range_min integer,
    parameter_range_max integer,
    video_enabled boolean,
    questions_enabled boolean,
    problem_statement_enabled boolean,
    scenario_agent_id text,
    image_agent_id text,
    video_agent_id text,
    valid_agent_ids text[],
    can_edit boolean,
    can_duplicate boolean,
    can_delete boolean,
    field_ranges types.q_get_scenario_detail_v4_field_range[],
    personas types.q_get_scenario_detail_v4_persona[],
    documents types.q_get_scenario_detail_v4_document[],
    parameters types.q_get_scenario_detail_v4_parameter[],
    fields types.q_get_scenario_detail_v4_field[],
    departments types.q_get_scenario_detail_v4_department[],
    agents types.q_get_scenario_detail_v4_agent[],
    simulations types.q_get_scenario_detail_v4_simulation[],
    objectives types.q_get_scenario_detail_v4_objective[],
    problem_statements types.q_get_scenario_detail_v4_problem_statement[],
    scenario_images types.q_get_scenario_detail_v4_scenario_image[],
    scenario_videos types.q_get_scenario_detail_v4_scenario_video[],
    questions types.q_get_scenario_detail_v4_question[],
    objectives_history types.q_get_scenario_detail_v4_objective_with_departments[],
    document_details types.q_get_scenario_detail_v4_document_detail[],
    parameters_detail types.q_get_scenario_detail_v4_parameter_detail[],
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
        scenario_id AS scenario_id,
        profile_id AS profile_id,
        COALESCE(use_image, false) AS use_image,
        COALESCE(use_objectives, false) AS use_objectives,
        COALESCE(document_ids, ARRAY[]::uuid[]) AS document_ids,
        COALESCE(problem_statement_ids, ARRAY[]::uuid[]) AS problem_statement_ids,
        COALESCE(template_document_ids, ARRAY[]::uuid[]) AS template_document_ids,
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
        COALESCE(field_show_selected_by_param, ARRAY[]::types.q_get_scenario_detail_v4_field_param_filter[]) AS field_show_selected_by_param,
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
scenario_exists_check AS (
    -- Check if scenario exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM scenarios WHERE id = (SELECT scenario_id FROM params LIMIT 1)
    )::boolean as scenario_exists
),
resolve_profile_id AS (
    -- Resolve profile ID from parameter
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params)::text IS NULL OR (SELECT profile_id FROM params)::text = '' THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)::uuid
        END as resolved_profile_id
),
-- profile_id is always a UUID (required in request body)
user_profile AS (
    SELECT 
        role,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM profiles p
    WHERE p.id = (SELECT profile_id FROM params LIMIT 1)
),
user_departments AS (
    SELECT ARRAY_AGG(DISTINCT pd.department_id) as dept_ids
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    JOIN departments d ON d.id = pd.department_id
    WHERE pd.active = true AND d.active = true
),
user_departments_rows AS (
    SELECT DISTINCT pd.department_id as id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    JOIN departments d ON d.id = pd.department_id
    WHERE pd.active = true AND d.active = true
),
scenario_departments_data AS (
    SELECT 
        sd.scenario_id,
        ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
    FROM scenario_departments sd
    WHERE sd.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sd.active = true
    GROUP BY sd.scenario_id
),
scenario_active_problem_statement AS (
    SELECT 
        sps.scenario_id,
        ps.id::text as problem_statement_id,
        ps.name,
        ps.problem_statement,
        ps.created_at as problem_statement_created_at,
        ps.updated_at as problem_statement_updated_at
    FROM scenario_problem_statements sps
    JOIN problem_statements ps ON ps.id = sps.problem_statement_id
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
        ps.updated_at as problem_statement_updated_at
    FROM scenario_problem_statements sps
    JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    WHERE sps.scenario_id = (SELECT scenario_id FROM params)
),
problem_statements_array AS (
    -- Problem statements from scenario (sorted first)
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
        ps.updated_at,
        1 as sort_order
    FROM problem_statements ps
    LEFT JOIN problem_statement_departments psd_dept ON psd_dept.problem_statement_id = ps.id AND psd_dept.active = true
    WHERE (
        psd_dept.department_id IN (SELECT id FROM user_departments_rows)
        OR NOT EXISTS (SELECT 1 FROM problem_statement_departments psd2 WHERE psd2.problem_statement_id = ps.id AND psd2.active = true)
    )
    AND NOT EXISTS (
        SELECT 1
        FROM scenario_all_problem_statements saps
        WHERE saps.problem_statement_id_uuid = ps.id
    )
),
scenario_department_access_check AS (
    SELECT 
        s.id as scenario_id,
        CASE 
            WHEN up.role = 'superadmin'::profile_role THEN true
            WHEN EXISTS (
                SELECT 1 FROM scenario_departments sd 
                WHERE sd.scenario_id = s.id 
                AND sd.active = true 
                AND sd.department_id IN (SELECT department_id FROM resolve_profile_id rpi JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id WHERE pd.active = true)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM scenario_departments sd2 
                WHERE sd2.scenario_id = s.id 
                AND sd2.active = true
            ) THEN true  -- Cross-department resource
            ELSE false
        END as has_access
    FROM scenarios s
    CROSS JOIN user_profile up
    WHERE s.id = (SELECT scenario_id FROM params LIMIT 1)
),
scenario_core AS (
    SELECT 
        s.id,
        s.name,
        s.description,
        COALESCE(saps.problem_statement, '') as problem_statement,
        COALESCE(saps.problem_statement_id, NULL) as problem_statement_id,
        s.active,
        s.generated,
        st.parent_id as parent_scenario_id,
        COALESCE(sdd.department_ids, NULL) as department_ids,
        s.objectives_enabled,
        s.images_enabled,
        s.video_enabled,
        s.questions_enabled,
        s.problem_statement_enabled,
        s.scenario_agent_id::text,
        s.image_agent_id::text,
        s.video_agent_id::text
    FROM scenarios s
    LEFT JOIN scenario_tree st ON st.child_id = s.id AND st.parent_id != st.parent_id
    LEFT JOIN scenario_active_problem_statement saps ON saps.scenario_id = s.id
    LEFT JOIN scenario_departments_data sdd ON sdd.scenario_id = s.id
    WHERE s.id = (SELECT scenario_id FROM params LIMIT 1)
      AND EXISTS (SELECT 1 FROM scenario_department_access_check sdac WHERE sdac.scenario_id = s.id AND sdac.has_access = true)
),
scenario_simulation_attributes AS (
    SELECT DISTINCT ON (ss.scenario_id)
        ss.scenario_id,
        ss.hints_enabled
    FROM simulation_scenarios ss
    WHERE ss.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND ss.active = true
    ORDER BY ss.scenario_id, ss.position
    LIMIT 1
),
scenario_personas_agg AS (
    SELECT ARRAY_AGG(persona_id::text ORDER BY persona_id) as persona_ids
    FROM scenario_personas
    WHERE scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND active = true
),
scenario_documents_agg AS (
    SELECT ARRAY_AGG(document_id::text ORDER BY document_id) as document_ids
    FROM scenario_documents
    WHERE scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND active = true
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
    FROM videos v
    LEFT JOIN video_uploads vu ON vu.video_id = v.id AND vu.active = true
    LEFT JOIN uploads u ON u.id = vu.upload_id
    LEFT JOIN video_departments vd_dept ON vd_dept.video_id = v.id AND vd_dept.active = true
    LEFT JOIN scenario_videos sv ON sv.video_id = v.id AND sv.scenario_id = (SELECT scenario_id FROM params) AND sv.active = true
    WHERE v.active = true
    AND (
        vd_dept.department_id IN (SELECT id FROM user_departments_rows)
        OR NOT EXISTS (SELECT 1 FROM video_departments vd2 WHERE vd2.video_id = v.id AND vd2.active = true)
    )
),
scenario_questions_array AS (
    SELECT 
        q.id,
        q.question_text,
        q.allow_multiple,
        COALESCE(sq.active, q.active) as active,
        CASE WHEN sq.scenario_id IS NOT NULL THEN 0 ELSE 1 END as sort_order,
        q.created_at
    FROM questions q
    LEFT JOIN question_departments qd_dept ON qd_dept.question_id = q.id AND qd_dept.active = true
    LEFT JOIN scenario_questions sq ON sq.question_id = q.id AND sq.scenario_id = (SELECT scenario_id FROM params) AND sq.active = true
    WHERE q.active = true
    AND (
        qd_dept.department_id IN (SELECT id FROM user_departments_rows)
        OR NOT EXISTS (SELECT 1 FROM question_departments qd2 WHERE qd2.question_id = q.id AND qd2.active = true)
    )
),
question_options_array AS (
    SELECT 
        q.id as question_id,
        opt.id,
        opt.option_text,
        EXISTS(
            SELECT 1 FROM answers a 
            WHERE a.question_id = q.id AND a.option_id = opt.id AND a.active = true
        ) as is_correct
    FROM scenario_questions_array q
    JOIN scenario_options so ON so.scenario_id = (SELECT scenario_id FROM params) AND so.active = true
    JOIN options opt ON opt.id = so.option_id AND opt.active = true
    WHERE EXISTS (
        -- Option is linked to this question via answers
        SELECT 1 FROM answers a2 
        WHERE a2.question_id = q.id AND a2.option_id = opt.id AND a2.active = true
    )
),
question_times_array AS (
    SELECT 
        q.id as question_id,
        q.time
    FROM scenario_questions sq
    JOIN questions q ON q.id = sq.question_id
    WHERE sq.scenario_id = (SELECT scenario_id FROM params) 
    AND sq.active = true
    AND q.active = true
),
scenario_images_array AS (
    SELECT 
        COALESCE(iu.upload_id, i.id) as upload_id,
        i.name,
        u.file_path,
        u.mime_type,
        i.active,
        i.created_at,
        i.updated_at,
        CASE WHEN si.scenario_id IS NOT NULL THEN 0 ELSE 1 END as sort_order
    FROM images i
    LEFT JOIN image_uploads iu ON iu.image_id = i.id AND iu.active = true
    LEFT JOIN uploads u ON u.id = iu.upload_id
    LEFT JOIN image_departments id_dept ON id_dept.image_id = i.id AND id_dept.active = true
    LEFT JOIN scenario_images si ON si.image_id = i.id AND si.scenario_id = (SELECT scenario_id FROM params) AND si.active = true
    WHERE i.active = true
    AND (
        id_dept.department_id IN (SELECT id FROM user_departments_rows)
        OR NOT EXISTS (SELECT 1 FROM image_departments id2 WHERE id2.image_id = i.id AND id2.active = true)
    )
),
scenario_objectives_array AS (
    SELECT 
        o.id as objective_id,
        o.objective as name,
        o.objective as description,
        CASE WHEN so.scenario_id IS NOT NULL THEN 0 ELSE 1 END as sort_order,
        COALESCE(so.idx, 999999) as idx,
        o.created_at
    FROM objectives o
    LEFT JOIN objective_departments od_dept ON od_dept.objective_id = o.id AND od_dept.active = true
    LEFT JOIN scenario_objectives so ON so.objective_id = o.id AND so.scenario_id = (SELECT scenario_id FROM params)
    WHERE (
        od_dept.department_id IN (SELECT id FROM user_departments_rows)
        OR NOT EXISTS (SELECT 1 FROM objective_departments od2 WHERE od2.objective_id = o.id AND od2.active = true)
    )
),
scenario_simulations_agg AS (
    SELECT 
        COALESCE(ARRAY_AGG(DISTINCT simulation_id::text), ARRAY[]::text[]) as simulation_ids,
        COUNT(DISTINCT CASE WHEN s.active THEN simulation_id END) as active_usage_count
    FROM simulation_scenarios ss
    JOIN simulations s ON s.id = ss.simulation_id
    WHERE ss.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND ss.active = true
),
all_parameters_data AS (
    SELECT 
        p.id as param_id,
        COALESCE((
            SELECT ARRAY_AGG(sf2.field_id ORDER BY sf2.field_id)
            FROM scenario_fields sf2
            JOIN fields f2 ON f2.id = sf2.field_id AND f2.active = true
            WHERE sf2.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND f2.parameter_id = p.id::uuid AND sf2.active = true
        ), ARRAY[]::uuid[]) as selected_items,
        COALESCE((
            SELECT ARRAY_AGG(id ORDER BY id)
            FROM (
                SELECT f3.id
                FROM fields f3
                LEFT JOIN field_departments fd3 ON fd3.field_id = f3.id AND fd3.active = true
                CROSS JOIN user_departments ud3
                WHERE f3.active = true AND f3.parameter_id IS NOT NULL
                  AND f3.parameter_id = p.id::uuid
                GROUP BY f3.id
                HAVING 
                    COUNT(fd3.field_id) FILTER (WHERE fd3.department_id = ANY(ud3.dept_ids)) > 0
                    OR NOT EXISTS (SELECT 1 FROM field_departments fd4 WHERE fd4.field_id = f3.id AND fd4.active = true)
                UNION
                SELECT sf2.field_id as id
                FROM scenario_fields sf2
                JOIN fields f2 ON f2.id = sf2.field_id AND f2.active = true
                WHERE sf2.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND f2.parameter_id = p.id::uuid AND sf2.active = true
            ) combined_items
        ), ARRAY[]::uuid[]) as valid_items
    FROM parameters p
    JOIN fields f ON f.parameter_id = p.id AND f.active = true
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    GROUP BY p.id
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(ud.dept_ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN fields f2 ON f2.id = fd2.field_id 
                      WHERE f2.parameter_id = p.id AND f2.active = true AND fd2.active = true)
),
valid_personas_filtered AS (
    SELECT DISTINCT
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.color,
        p.icon,
        false as image_model  -- No longer checking via persona agents
    FROM personas p
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.color, p.icon
    HAVING 
        (
            COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY(ud.dept_ids)) > 0
            OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
        )
        AND (
            CASE 
                WHEN (SELECT use_video FROM params) = true THEN
                    -- Include video_parameter OR general parameters
                    EXISTS (
                        SELECT 1 
                        FROM persona_fields pf
                        JOIN fields f_pfield ON f_pfield.id = pf.field_id
                        JOIN parameters param ON param.id = f_pfield.parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND f_pfield.active = true
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
                        JOIN fields f_pfield ON f_pfield.id = pf.field_id
                        JOIN parameters param ON param.id = f_pfield.parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND f_pfield.active = true
                        AND param.active = true
                        AND param.video_parameter = false
                        AND param.scenario_parameter = false
                    )
                ELSE
                    -- Include scenario_parameter OR general parameters
                    EXISTS (
                        SELECT 1 
                        FROM persona_fields pf
                        JOIN fields f_pfield ON f_pfield.id = pf.field_id
                        JOIN parameters param ON param.id = f_pfield.parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND f_pfield.active = true
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
                        JOIN fields f_pfield ON f_pfield.id = pf.field_id
                        JOIN parameters param ON param.id = f_pfield.parameter_id
                        WHERE pf.persona_id = p.id
                        AND pf.active = true
                        AND f_pfield.active = true
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
                JOIN fields f_pfield_filter ON f_pfield_filter.id = pf_filter.field_id
                WHERE pf_filter.persona_id = p.id
                AND pf_filter.active = true
                AND f_pfield_filter.active = true
                AND f_pfield_filter.parameter_id = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
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
),
persona_data_base AS (
    SELECT 
        p.id,
        p.name,
        p.description,
        p.color,
        p.icon,
        p.image_model
    FROM valid_personas_filtered p
    UNION
    SELECT DISTINCT
        p2.id,
        p2.name,
        COALESCE(p2.description, '') as description,
        p2.color,
        p2.icon,
        false as image_model  -- No longer checking via persona agents
    FROM scenario_personas_agg spa
    CROSS JOIN LATERAL unnest(spa.persona_ids) as persona_id
    JOIN personas p2 ON p2.id = persona_id::uuid
    WHERE p2.active = true
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
                SELECT 1 FROM persona_departments pd_filter
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
                SELECT 1 FROM persona_fields pf_filter
                JOIN fields f_pfield_filter ON f_pfield_filter.id = pf_filter.field_id
                WHERE pf_filter.persona_id = pdb.id
                AND pf_filter.active = true
                AND f_pfield_filter.active = true
                AND f_pfield_filter.parameter_id = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Filter by selected fields
        AND (
            (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM persona_fields pf_field_filter
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
-- Persona parameter relationships: via fields (persona_fields → fields.parameter_id) and persona_parameter flag
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
            JOIN fields f_pfield ON f_pfield.id = pf.field_id
            WHERE pf.persona_id = p.id
            AND f_pfield.parameter_id = param.id
            AND pf.active = true
            AND f_pfield.active = true
        )
    )
),
persona_fields_agg AS (
    SELECT 
        pf.persona_id,
        ARRAY_AGG(pf.field_id ORDER BY pf.field_id) as field_ids
    FROM persona_fields pf
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
    FROM persona_examples pe
    JOIN examples e ON e.id = pe.example_id
    WHERE pe.persona_id IN (SELECT id FROM persona_data)
    ORDER BY pe.persona_id, pe.idx
),
valid_personas_array AS (
    SELECT 
        p.id as persona_id,
        p.name,
        p.description,
        p.color,
        p.icon,
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
        d.name,
        ''::text as description,
        u.file_path,
        u.mime_type
    FROM documents d
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    CROSS JOIN user_departments ud
    WHERE d.active = true
    GROUP BY d.id, d.name, u.file_path, u.mime_type
    HAVING 
        (
            COUNT(dd.document_id) FILTER (WHERE dd.department_id = ANY(ud.dept_ids)) > 0
            OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
        )
        AND (
            CASE 
                WHEN (SELECT use_video FROM params) = true THEN
                    EXISTS (
                        SELECT 1 
                        FROM document_fields df
                        JOIN fields f_pfield ON f_pfield.id = df.field_id
                        JOIN parameters param ON param.id = f_pfield.parameter_id
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND f_pfield.active = true
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
                        JOIN fields f_pfield ON f_pfield.id = df.field_id
                        JOIN parameters param ON param.id = f_pfield.parameter_id
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND f_pfield.active = true
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
                        JOIN fields f_pfield ON f_pfield.id = df.field_id
                        JOIN parameters param ON param.id = f_pfield.parameter_id
                        WHERE df.document_id = d.id
                        AND df.active = true
                        AND f_pfield.active = true
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
                SELECT 1 FROM document_departments dd_filter
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
                SELECT 1 FROM document_fields df_filter
                JOIN fields f_pfield_filter ON f_pfield_filter.id = df_filter.field_id
                WHERE df_filter.document_id = d.id
                AND df_filter.active = true
                AND f_pfield_filter.active = true
                AND f_pfield_filter.parameter_id = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Filter by selected fields (document must have selected fields)
        AND (
            (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_field_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM document_fields df_field_filter
                WHERE df_field_filter.document_id = d.id
                AND df_field_filter.active = true
                AND df_field_filter.field_id = ANY((SELECT filter_field_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Search filter
        AND (
            (SELECT document_search FROM params LIMIT 1) IS NULL
            OR LOWER(d.name) LIKE '%' || LOWER((SELECT document_search FROM params LIMIT 1)) || '%'
            OR LOWER(COALESCE(d.description, '')) LIKE '%' || LOWER((SELECT document_search FROM params LIMIT 1)) || '%'
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
        d.name,
        d.description,
        d.file_path,
        d.mime_type
    FROM valid_documents_filtered d
    UNION
    SELECT DISTINCT
        d2.id,
        d2.name,
        ''::text as description,
        u2.file_path,
        u2.mime_type
    FROM scenario_documents_agg sda
    CROSS JOIN LATERAL unnest(sda.document_ids) as doc_id
    JOIN documents d2 ON d2.id = doc_id::uuid
    LEFT JOIN document_uploads du2 ON du2.document_id = d2.id AND du2.active = true
    LEFT JOIN uploads u2 ON u2.id = du2.upload_id
    WHERE d2.active = true
    UNION
    SELECT DISTINCT
        d3.id,
        d3.name,
        ''::text as description,
        u3.file_path,
        u3.mime_type
    FROM documents d3
    LEFT JOIN document_uploads du3 ON du3.document_id = d3.id AND du3.active = true
    LEFT JOIN uploads u3 ON u3.id = du3.upload_id
    WHERE d3.active = true
    AND (SELECT document_ids FROM params LIMIT 1) IS NOT NULL
    AND array_length((SELECT document_ids FROM params LIMIT 1), 1) > 0
    AND d3.id = ANY((SELECT document_ids FROM params LIMIT 1)::uuid[])
    AND (
        CASE 
            WHEN (SELECT use_video FROM params) = true THEN
                EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN fields f_pfield ON f_pfield.id = df.field_id
                    JOIN parameters param ON param.id = f_pfield.parameter_id
                    WHERE df.document_id = d3.id
                    AND df.active = true
                    AND f_pfield.active = true
                    AND param.active = true
                    AND param.video_parameter = true
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN field_conditional_parameters fcp ON fcp.field_id = df.field_id
                    JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                    WHERE df.document_id = d3.id
                    AND df.active = true
                    AND fcp.active = true
                    AND cp.video_parameter = true
                )
            ELSE
                EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN fields f_pfield ON f_pfield.id = df.field_id
                    JOIN parameters param ON param.id = f_pfield.parameter_id
                    WHERE df.document_id = d3.id
                    AND df.active = true
                    AND f_pfield.active = true
                    AND param.active = true
                    AND param.scenario_parameter = true
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN field_conditional_parameters fcp ON fcp.field_id = df.field_id
                    JOIN parameters cp ON cp.id = fcp.conditional_parameter_id
                    WHERE df.document_id = d3.id
                    AND df.active = true
                    AND fcp.active = true
                    AND cp.scenario_parameter = true
                )
                OR EXISTS (
                    SELECT 1 
                    FROM document_fields df
                    JOIN fields f_pfield ON f_pfield.id = df.field_id
                    JOIN parameters param ON param.id = f_pfield.parameter_id
                    WHERE df.document_id = d3.id
                    AND df.active = true
                    AND f_pfield.active = true
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
                SELECT 1 FROM document_departments dd_filter
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
                SELECT 1 FROM document_fields df_filter
                JOIN fields f_pfield_filter ON f_pfield_filter.id = df_filter.field_id
                WHERE df_filter.document_id = ddb.id
                AND df_filter.active = true
                AND f_pfield_filter.active = true
                AND f_pfield_filter.parameter_id = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
            )
        )
        -- Filter by selected fields
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
            JOIN fields f_pfield ON f_pfield.id = df.field_id
            WHERE df.document_id = d.id
            AND f_pfield.parameter_id = param.id
            AND df.active = true
            AND f_pfield.active = true
        )
    )
),
document_fields_agg AS (
    SELECT 
        df.document_id,
        ARRAY_AGG(df.field_id ORDER BY df.field_id) as field_ids
    FROM document_fields df
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
    SELECT DISTINCT ON (dt.child_id)
        dt.child_id as document_id,
        dt.parent_id
    FROM document_tree dt
    WHERE dt.child_id IN (SELECT id FROM document_data) AND dt.active = true
),
valid_documents_array AS (
    SELECT 
        d.id as document_id,
        d.name,
        d.description,
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
        d.name,
        ''::text as description,
        u.file_path,
        u.mime_type,
        ARRAY[]::uuid[] as parameter_ids,
        ARRAY[]::uuid[] as field_ids,
        NULL::uuid as parent_document_id
    FROM scenario_documents sd
    JOIN documents d ON d.id = sd.document_id
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    WHERE sd.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sd.active = true AND d.active = true
),
all_documents_array AS (
    SELECT * FROM valid_documents_array
    UNION
    SELECT * FROM scenario_documents_array
),
document_details_array AS (
    SELECT 
        dd.id as document_id,
        d.name,
        d.updated_at,
        CASE WHEN dd.file_path IS NOT NULL THEN SUBSTRING(dd.file_path FROM '\\.([^\\.]+)$') ELSE NULL END as extension,
        COALESCE((
            SELECT ARRAY_AGG(sd2.scenario_id ORDER BY sd2.scenario_id)
            FROM scenario_documents sd2
            WHERE sd2.document_id = dd.id AND sd2.active = true
        ), ARRAY[]::uuid[]) as scenario_ids,
        true as can_edit,
        true as can_delete,
        d.active,
        COALESCE((
            SELECT ARRAY_AGG(dd2.department_id ORDER BY dd2.department_id)
            FROM document_departments dd2
            WHERE dd2.document_id = dd.id AND dd2.active = true
        ), NULL::uuid[]) as department_ids,
        dd.file_path,
        dd.mime_type,
        (SELECT du.upload_id FROM document_uploads du WHERE du.document_id = dd.id AND du.active = true ORDER BY du.created_at DESC LIMIT 1) as upload_id,
        COALESCE((
            SELECT ARRAY_AGG(df.field_id ORDER BY df.field_id)
            FROM document_fields df
            WHERE df.document_id = dd.id AND df.active = true
        ), ARRAY[]::uuid[]) as field_ids,
        CASE 
            WHEN d.template = true THEN true
            WHEN EXISTS(
                SELECT 1 FROM document_templates dt2 
                WHERE dt2.document_id = dd.id AND dt2.active = true
            ) THEN true
            ELSE false
        END as is_template,
        (SELECT dt.parent_id FROM document_tree dt WHERE dt.child_id = dd.id AND dt.active = true LIMIT 1) as parent_document_id
    FROM document_data dd
    JOIN documents d ON d.id = dd.id
),
simulation_data AS (
    SELECT 
        s.id as simulation_id,
        s.title as name,
        COALESCE(s.description, '') as description,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
            0
        ) as time_limit,
        COALESCE((
            SELECT ARRAY_AGG(sd.department_id ORDER BY sd.created_at)
            FROM simulation_departments sd
            WHERE sd.simulation_id = s.id AND sd.active = true
        ), NULL::uuid[]) as department_ids
    FROM simulations s
    WHERE s.id = ANY(
        COALESCE((SELECT ARRAY_AGG(sim_id::uuid) FROM (SELECT unnest(simulation_ids) as sim_id FROM scenario_simulations_agg) t), ARRAY[]::uuid[])
    )
),
linked_scenario_parameters AS (
    SELECT DISTINCT
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.document_parameter,
        p.persona_parameter,
        p.scenario_parameter,
        p.video_parameter
    FROM scenario_parameters sp
    JOIN parameters p ON p.id = sp.parameter_id
    WHERE sp.scenario_id = (SELECT scenario_id FROM params)
    AND sp.active = true
    AND p.active = true
),
parameter_data_for_mapping AS (
    SELECT DISTINCT 
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.document_parameter,
        p.persona_parameter,
        p.scenario_parameter,
        p.video_parameter
    FROM parameters p
    JOIN fields f ON f.parameter_id = p.id AND f.active = true
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    AND p.scenario_parameter = true
    GROUP BY p.id, p.name, p.description, p.document_parameter, p.persona_parameter, p.scenario_parameter, p.video_parameter
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(ud.dept_ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN fields f2 ON f2.id = fd2.field_id 
                      WHERE f2.parameter_id = p.id AND f2.active = true)
        -- Filter by selected departments
        AND (
            (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) IS NULL
            OR (SELECT array_length(filter_department_ids, 1) FROM params LIMIT 1) = 0
            OR EXISTS (
                SELECT 1 FROM fields f_dept_filter
                JOIN field_departments fd_dept_filter ON fd_dept_filter.field_id = f_dept_filter.id
                WHERE f_dept_filter.parameter_id = p.id
                AND f_dept_filter.active = true
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
                SELECT 1 FROM fields f_dept_filter
                JOIN field_departments fd_dept_filter ON fd_dept_filter.field_id = f_dept_filter.id
                WHERE f_dept_filter.parameter_id = apab.id
                AND f_dept_filter.active = true
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
        ARRAY_AGG(fcp.conditional_parameter_id ORDER BY fcp.conditional_parameter_id) as conditional_parameter_ids
    FROM field_conditional_parameters fcp
    WHERE fcp.active = true
    GROUP BY fcp.field_id
),
parameter_item_data AS (
    SELECT 
        f.id,
        f.name,
        COALESCE(f.description, '') as description,
        f.parameter_id,
        p.name as parameter_name
    FROM fields f
    JOIN parameters p ON p.id = f.parameter_id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true AND f.active = true
    GROUP BY f.id, f.name, f.description, f.parameter_id, p.id, p.name
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY(ud.dept_ids)) > 0
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
            OR f.parameter_id = ANY((SELECT filter_parameter_ids FROM params LIMIT 1)::uuid[])
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
        -- Per-parameter show_selected filter
        AND (
            array_length((SELECT field_show_selected_by_param FROM params LIMIT 1), 1) IS NULL
            OR NOT EXISTS (
                SELECT 1 FROM UNNEST((SELECT field_show_selected_by_param FROM params LIMIT 1)) as fp_filter
                WHERE fp_filter.parameter_id = f.parameter_id AND fp_filter.show_selected = true
            )
            OR f.id = ANY((SELECT filter_field_ids FROM params LIMIT 1)::uuid[])
        )
    ORDER BY p.name, f.name
),
scenario_fields_data AS (
    SELECT 
        f.id,
        f.name,
        COALESCE(f.description, '') as description,
        f.parameter_id,
        p.name as parameter_name
    FROM scenario_fields sf
    JOIN fields f ON f.id = sf.field_id
    JOIN parameters p ON p.id = f.parameter_id
    WHERE sf.scenario_id = (SELECT scenario_id FROM params) AND sf.active = true AND p.active = true
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
                SELECT 1 FROM field_departments fd_dept_filter
                WHERE fd_dept_filter.field_id = afab.field_id
                AND fd_dept_filter.active = true
                AND fd_dept_filter.department_id = ANY((SELECT filter_department_ids FROM params LIMIT 1)::uuid[])
            )
            OR NOT EXISTS (SELECT 1 FROM field_departments fd_no_dept WHERE fd_no_dept.field_id = afab.field_id AND fd_no_dept.active = true)
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
                SELECT 1 FROM persona_fields pf_persona_filter
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
                SELECT 1 FROM document_fields df_doc_filter
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
        d.id as department_id,
        COALESCE(ARRAY_AGG(p.id ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::uuid[]) as persona_ids
    FROM departments d
    CROSS JOIN user_departments ud
    LEFT JOIN personas p ON p.active = true
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    WHERE d.id = ANY(ud.dept_ids)
    AND (
        pd.department_id = d.id 
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
    )
    AND (
        pd.department_id = ANY(ud.dept_ids)
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd3 WHERE pd3.persona_id = p.id AND pd3.active = true)
    )
    GROUP BY d.id
),
department_document_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(doc.id ORDER BY doc.id) FILTER (WHERE doc.id IS NOT NULL), ARRAY[]::uuid[]) as document_ids
    FROM departments d
    CROSS JOIN user_departments ud
    LEFT JOIN documents doc ON doc.active = true
    LEFT JOIN document_departments dd ON dd.document_id = doc.id AND dd.active = true
    WHERE d.id = ANY(ud.dept_ids)
    AND (dd.department_id = d.id OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = doc.id AND dd2.active = true))
    GROUP BY d.id
),
department_parameter_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT p.id) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::uuid[]) as parameter_ids
    FROM departments d
    CROSS JOIN user_departments ud
    LEFT JOIN parameters p ON p.active = true
    LEFT JOIN fields f ON f.parameter_id = p.id AND f.active = true
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE d.id = ANY(ud.dept_ids)
    AND (fd.department_id = d.id OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                                                 JOIN fields f2 ON f2.id = fd2.field_id 
                                                 WHERE f2.parameter_id = p.id AND f2.active = true AND fd2.active = true))
    GROUP BY d.id
),
department_field_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(f.id ORDER BY f.id) FILTER (WHERE f.id IS NOT NULL), ARRAY[]::uuid[]) as field_ids
    FROM departments d
    CROSS JOIN user_departments ud
    LEFT JOIN fields f ON f.active = true AND f.parameter_id IS NOT NULL
    LEFT JOIN parameters p ON p.id = f.parameter_id AND p.active = true
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE d.id = ANY(ud.dept_ids)
    AND p.id IS NOT NULL
    AND (
        fd.department_id = d.id 
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
    )
    AND (
        fd.department_id = ANY(ud.dept_ids)
        OR NOT EXISTS (SELECT 1 FROM field_departments fd3 WHERE fd3.field_id = f.id AND fd3.active = true)
    )
    GROUP BY d.id
),
scenario_departments_array AS (
    SELECT 
        d.id as department_id,
        d.title as name,
        COALESCE(d.description, '') as description,
        ARRAY[]::uuid[] as persona_ids,
        ARRAY[]::uuid[] as document_ids,
        ARRAY[]::uuid[] as parameter_ids,
        ARRAY[]::uuid[] as field_ids
    FROM scenario_departments sd
    JOIN departments d ON d.id = sd.department_id
    WHERE sd.scenario_id = (SELECT scenario_id FROM params LIMIT 1) AND sd.active = true AND d.active = true
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
    FROM scenarios s
    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
    CROSS JOIN user_departments ud
    WHERE s.active = true
    AND (
        sd.department_id = ANY(ud.dept_ids)
        OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
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
                    FROM scenario_objectives so2
                    JOIN objectives o2 ON o2.id = so2.objective_id
                    JOIN accessible_scenarios acs2 ON acs2.scenario_id = so2.scenario_id
                    LEFT JOIN scenario_departments sd ON sd.scenario_id = so2.scenario_id AND sd.active = true
                    WHERE o2.objective = o.objective
                        AND o2.objective IS NOT NULL 
                        AND o2.objective != ''
                        AND sd.department_id IS NOT NULL
                ) dept_list
            ),
            ARRAY[]::uuid[]
        ) as department_ids
    FROM scenario_objectives so
    JOIN objectives o ON o.id = so.objective_id
    JOIN accessible_scenarios acs ON acs.scenario_id = so.scenario_id
    WHERE o.objective IS NOT NULL AND o.objective != ''
    GROUP BY o.objective
),
user_departments_for_agents AS (
    SELECT department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
expected_agent_role AS (
    SELECT 'scenario'::text as role
),
scenario_persona_ranges_data AS (
    SELECT 
        COALESCE(spr.min_count, 1) as persona_min,
        COALESCE(spr.max_count, 3) as persona_max
    FROM scenario_core sc
    LEFT JOIN scenario_persona_ranges spr ON spr.scenario_id = sc.id
),
scenario_document_ranges_data AS (
    SELECT 
        COALESCE(sdr.min_count, 0) as document_min,
        COALESCE(sdr.max_count, 3) as document_max
    FROM scenario_core sc
    LEFT JOIN scenario_document_ranges sdr ON sdr.scenario_id = sc.id
),
scenario_parameter_ranges_data AS (
    SELECT 
        COALESCE(spr.min_count, 0) as parameter_min,
        COALESCE(spr.max_count, 3) as parameter_max
    FROM scenario_core sc
    LEFT JOIN scenario_parameter_ranges spr ON spr.scenario_id = sc.id
),
scenario_field_ranges_data AS (
    SELECT 
        sc.id as scenario_id,
        COALESCE(
            ARRAY_AGG((sfr.parameter_id, sfr.min_count, sfr.max_count)::types.q_get_scenario_detail_v4_field_range ORDER BY sfr.parameter_id),
            ARRAY[]::types.q_get_scenario_detail_v4_field_range[]
        ) as field_ranges
    FROM scenario_core sc
    LEFT JOIN scenario_field_ranges sfr ON sfr.scenario_id = sc.id
    GROUP BY sc.id
),
valid_agents_array AS (
    SELECT 
        a.id as agent_id,
        a.name,
        COALESCE(a.description, '') as description,
        ARRAY[COALESCE(aa.role, '')] as roles
    FROM agents a
    JOIN artifact_agents aa ON aa.agent_id = a.id AND aa.artifact_instance_id IS NULL
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN expected_agent_role ear
    WHERE a.active = true 
    AND (
        aa.role = ear.role
        OR aa.role = 'scenario'
        OR aa.role = 'image'
    )
    GROUP BY a.id, a.name, a.description, COALESCE(aa.role, ''), ear.role
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
)
SELECT 
    (SELECT scenario_exists FROM scenario_exists_check) as scenario_exists,
    sc.id as scenario_id,
    -- Merge draft payload over existing scenario data if draft_id provided
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        sc.name
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        sc.description
    ) as description,
    COALESCE(
        (SELECT payload->>'problem_statement' FROM draft_payload_data),
        sc.problem_statement
    ) as problem_statement,
    sc.problem_statement_id,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        sc.active
    ) as active,
    sc.generated,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'department_ids' IS NOT NULL AND jsonb_typeof(payload->'department_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'department_ids'))
                ELSE NULL
            END
        FROM draft_payload_data),
        sc.department_ids
    ) as department_ids,
    sc.parent_scenario_id,
    COALESCE(ssa_attr.hints_enabled, false) as hints_enabled,
    COALESCE(
        (SELECT (payload->>'use_objectives')::boolean FROM draft_payload_data),
        sc.objectives_enabled
    ) as objectives_enabled,
    COALESCE(
        (SELECT (payload->>'use_image')::boolean FROM draft_payload_data),
        sc.images_enabled
    ) as image_input_enabled,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'persona_ids' IS NOT NULL AND jsonb_typeof(payload->'persona_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'persona_ids'))
                ELSE NULL
            END
        FROM draft_payload_data),
        COALESCE(spa.persona_ids, ARRAY[]::text[])
    ) as persona_ids,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'document_ids' IS NOT NULL AND jsonb_typeof(payload->'document_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'document_ids'))
                ELSE NULL
            END
        FROM draft_payload_data),
        COALESCE(sd.document_ids, ARRAY[]::text[])
    ) as document_ids,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'objective_ids' IS NOT NULL AND jsonb_typeof(payload->'objective_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'objective_ids'))
                ELSE NULL
            END
        FROM draft_payload_data),
        COALESCE((
            SELECT ARRAY_AGG(objective_id::text ORDER BY sort_order, idx, created_at DESC)
            FROM scenario_objectives_array
        ), ARRAY[]::text[])
    ) as objective_ids,
    COALESCE(ssa.simulation_ids, ARRAY[]::text[]) as simulation_ids,
    COALESCE((
        SELECT ARRAY_AGG(persona_id::text ORDER BY name)
        FROM valid_personas_array
    ), ARRAY[]::text[]) as valid_persona_ids,
    COALESCE((
        SELECT ARRAY_AGG(document_id::text ORDER BY name)
        FROM all_documents_array
    ), ARRAY[]::text[]) as valid_document_ids,
    (SELECT dept_ids FROM user_departments) as valid_department_ids,
    COALESCE(ssa.active_usage_count, 0) as active_usage_count,
    up.role as user_role,
    up.actor_name,
    COALESCE((
        SELECT ARRAY_AGG(id::text ORDER BY name)
        FROM all_parameters_array
    ), ARRAY[]::text[]) as parameter_ids,
    COALESCE((
        SELECT ARRAY_AGG(id::text ORDER BY name)
        FROM all_parameters_array
    ), ARRAY[]::text[]) as valid_parameter_ids,
    COALESCE((
        SELECT ARRAY_AGG(field_id::text ORDER BY parameter_name, name)
        FROM all_fields_array
    ), ARRAY[]::text[]) as valid_field_ids,
    COALESCE((
        SELECT ARRAY_AGG(id::text ORDER BY sort_order, created_at DESC)
        FROM scenario_questions_array
    ), ARRAY[]::text[]) as question_ids,
    COALESCE((SELECT persona_min FROM scenario_persona_ranges_data), 1) as persona_range_min,
    COALESCE((SELECT persona_max FROM scenario_persona_ranges_data), 3) as persona_range_max,
    COALESCE((SELECT document_min FROM scenario_document_ranges_data), 0) as document_range_min,
    COALESCE((SELECT document_max FROM scenario_document_ranges_data), 3) as document_range_max,
    COALESCE((SELECT parameter_min FROM scenario_parameter_ranges_data), 0) as parameter_range_min,
    COALESCE((SELECT parameter_max FROM scenario_parameter_ranges_data), 3) as parameter_range_max,
    sc.video_enabled,
    sc.questions_enabled,
    sc.problem_statement_enabled,
    sc.scenario_agent_id,
    sc.image_agent_id,
    sc.video_agent_id,
    COALESCE((
        SELECT ARRAY_AGG(agent_id::text ORDER BY name)
        FROM valid_agents_array
    ), ARRAY[]::text[]) as valid_agent_ids,
    -- Computed permissions
    CASE 
        WHEN COALESCE(ssa.active_usage_count, 0) > 0 THEN false
        WHEN sc.generated = true THEN false
        WHEN (COALESCE(sc.department_ids, ARRAY[]::text[]) = ARRAY[]::text[] AND up.role != 'superadmin') THEN false
        ELSE true
    END as can_edit,
    true as can_duplicate,
    CASE 
        WHEN COALESCE(ssa.active_usage_count, 0) > 0 THEN false
        WHEN sc.generated = true THEN false
        WHEN (COALESCE(sc.department_ids, ARRAY[]::text[]) = ARRAY[]::text[] AND up.role != 'superadmin') THEN false
        WHEN up.role != 'superadmin' THEN false
        ELSE true
    END as can_delete,
    COALESCE(sfrd.field_ranges, ARRAY[]::types.q_get_scenario_detail_v4_field_range[]) as field_ranges,
    -- Arrays of composite types (built from subqueries)
    COALESCE((
        SELECT ARRAY_AGG(ROW(vpa.persona_id, vpa.name, vpa.description, vpa.color, vpa.icon, vpa.image_model, vpa.parameter_ids, vpa.field_ids, vpa.example)::types.q_get_scenario_detail_v4_persona ORDER BY vpa.name)
        FROM valid_personas_array vpa
    ), '{}'::types.q_get_scenario_detail_v4_persona[]) as personas,
    COALESCE((
        SELECT ARRAY_AGG((ada.document_id, ada.name, ada.description, ada.file_path, ada.mime_type, ada.parameter_ids, ada.field_ids, ada.parent_document_id)::types.q_get_scenario_detail_v4_document ORDER BY ada.name)
        FROM all_documents_array ada
    ), '{}'::types.q_get_scenario_detail_v4_document[]) as documents,
    COALESCE((
        SELECT ARRAY_AGG(ROW(apa.id, apa.name, apa.description, apa.document_parameter, apa.persona_parameter, apa.scenario_parameter, apa.video_parameter)::types.q_get_scenario_detail_v4_parameter ORDER BY apa.name)
        FROM all_parameters_array apa
    ), '{}'::types.q_get_scenario_detail_v4_parameter[]) as parameters,
    COALESCE((
        SELECT ARRAY_AGG((afa.field_id, afa.name, afa.description, afa.parameter_id, afa.parameter_name, afa.conditional_parameter_ids)::types.q_get_scenario_detail_v4_field ORDER BY afa.parameter_name, afa.name)
        FROM all_fields_array afa
    ), '{}'::types.q_get_scenario_detail_v4_field[]) as fields,
    COALESCE((
        SELECT ARRAY_AGG((ada2.department_id, ada2.name, ada2.description, ada2.persona_ids, ada2.document_ids, ada2.parameter_ids, ada2.field_ids)::types.q_get_scenario_detail_v4_department ORDER BY ada2.name)
        FROM all_departments_array ada2
    ), '{}'::types.q_get_scenario_detail_v4_department[]) as departments,
    COALESCE((
        SELECT ARRAY_AGG((vaa.agent_id, vaa.name, vaa.description, vaa.roles)::types.q_get_scenario_detail_v4_agent ORDER BY vaa.name)
        FROM valid_agents_array vaa
    ), '{}'::types.q_get_scenario_detail_v4_agent[]) as agents,
    COALESCE((
        SELECT ARRAY_AGG((sda.simulation_id, sda.name, sda.description, sda.time_limit, sda.department_ids)::types.q_get_scenario_detail_v4_simulation ORDER BY sda.name)
        FROM simulation_data sda
    ), '{}'::types.q_get_scenario_detail_v4_simulation[]) as simulations,
    COALESCE((
        SELECT ARRAY_AGG((soa.objective_id, soa.name, soa.description)::types.q_get_scenario_detail_v4_objective ORDER BY soa.sort_order, soa.idx, soa.created_at DESC)
        FROM scenario_objectives_array soa
    ), '{}'::types.q_get_scenario_detail_v4_objective[]) as objectives,
    COALESCE((
        SELECT ARRAY_AGG((psa.problem_statement_id, psa.name, psa.problem_statement, psa.created_at, psa.updated_at)::types.q_get_scenario_detail_v4_problem_statement ORDER BY psa.sort_order, psa.problem_statement_id)
        FROM problem_statements_array psa
    ), '{}'::types.q_get_scenario_detail_v4_problem_statement[]) as problem_statements,
    COALESCE((
        SELECT ARRAY_AGG((sia.upload_id, sia.name, sia.file_path, sia.mime_type, sia.active, sia.created_at, sia.updated_at)::types.q_get_scenario_detail_v4_scenario_image ORDER BY sia.sort_order, sia.created_at DESC)
        FROM scenario_images_array sia
    ), '{}'::types.q_get_scenario_detail_v4_scenario_image[]) as scenario_images,
    COALESCE((
        SELECT ARRAY_AGG((sva.id, sva.name, sva.length_seconds, sva.completed, sva.active, sva.file_path, sva.mime_type, sva.upload_id)::types.q_get_scenario_detail_v4_scenario_video ORDER BY sva.sort_order, sva.created_at DESC)
        FROM scenario_videos_array sva
    ), '{}'::types.q_get_scenario_detail_v4_scenario_video[]) as scenario_videos,
    COALESCE((
        SELECT ARRAY_AGG(
            ROW(
                sqa.id,
                sqa.question_text,
                sqa.allow_multiple,
                sqa.active,
                COALESCE((
                    SELECT ARRAY_AGG(ROW(qoa.id, qoa.option_text, qoa.is_correct)::types.q_get_scenario_detail_v4_question_option ORDER BY qoa.id)
                    FROM question_options_array qoa
                    WHERE qoa.question_id = sqa.id
                ), '{}'::types.q_get_scenario_detail_v4_question_option[]),
                COALESCE((
                    SELECT ARRAY_AGG(qta.time ORDER BY qta.time)
                    FROM question_times_array qta
                    WHERE qta.question_id = sqa.id
                ), ARRAY[]::integer[])
            )::types.q_get_scenario_detail_v4_question
            ORDER BY sqa.sort_order, sqa.created_at DESC
        )
        FROM scenario_questions_array sqa
    ), '{}'::types.q_get_scenario_detail_v4_question[]) as questions,
    COALESCE((
        SELECT ARRAY_AGG((owda.objective, owda.department_ids)::types.q_get_scenario_detail_v4_objective_with_departments ORDER BY owda.objective)
        FROM objectives_with_departments_array owda
    ), '{}'::types.q_get_scenario_detail_v4_objective_with_departments[]) as objectives_history,
    COALESCE((
        SELECT ARRAY_AGG((dda.document_id, dda.name, dda.updated_at, dda.extension, dda.scenario_ids, dda.can_edit, dda.can_delete, dda.active, dda.department_ids, dda.file_path, dda.mime_type, dda.upload_id, dda.field_ids, dda.is_template, dda.parent_document_id)::types.q_get_scenario_detail_v4_document_detail ORDER BY dda.name)
        FROM document_details_array dda
    ), '{}'::types.q_get_scenario_detail_v4_document_detail[]) as document_details,
    COALESCE((
        SELECT ARRAY_AGG((apd.param_id, apd.selected_items, apd.valid_items)::types.q_get_scenario_detail_v4_parameter_detail ORDER BY apd.param_id)
        FROM all_parameters_data apd
    ), '{}'::types.q_get_scenario_detail_v4_parameter_detail[]) as parameters_detail,
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
FROM scenario_core sc
CROSS JOIN user_profile up
LEFT JOIN scenario_simulation_attributes ssa_attr ON ssa_attr.scenario_id = sc.id
LEFT JOIN scenario_personas_agg spa ON true
LEFT JOIN scenario_documents_agg sd ON true
LEFT JOIN scenario_simulations_agg ssa ON true
LEFT JOIN scenario_field_ranges_data sfrd ON sfrd.scenario_id = sc.id
$$;