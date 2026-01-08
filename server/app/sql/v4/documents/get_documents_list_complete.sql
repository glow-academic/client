-- Get documents list with permissions and mappings
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
        WHERE proname = 'api_list_documents_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_documents_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_list_documents_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_list_documents_v4_document AS (
    document_id uuid,
    name text,
    updated_at timestamptz,
    upload_id uuid,
    active boolean,
    extension text,
    department_ids text[],
    scenario_ids uuid[],
    field_ids uuid[],
    valid_field_ids text[],
    active_scenario_count int,
    total_scenario_links int,
    can_edit boolean,
    can_delete boolean
);

CREATE TYPE types.q_list_documents_v4_scenario AS (
    scenario_id uuid,
    name text,
    description text,
    active boolean
);

CREATE TYPE types.q_list_documents_v4_field AS (
    field_id uuid,
    name text,
    description text,
    parameter_id uuid,
    parameter_name text
);

CREATE TYPE types.q_list_documents_v4_department AS (
    department_id uuid,
    name text,
    description text,
    parameter_ids text[],
    field_ids text[]
);

CREATE TYPE types.q_list_documents_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean
);

CREATE TYPE types.q_list_documents_v4_scenario_option AS (
    value text,  -- UUID as text for frontend compatibility
    label text
);

CREATE TYPE types.q_list_documents_v4_department_option AS (
    value text,  -- UUID as text for frontend compatibility
    label text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_documents_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    documents types.q_list_documents_v4_document[],
    scenarios types.q_list_documents_v4_scenario[],
    fields types.q_list_documents_v4_field[],
    departments types.q_list_documents_v4_department[],
    parameters types.q_list_documents_v4_parameter[],
    scenario_options types.q_list_documents_v4_scenario_option[],
    department_options types.q_list_documents_v4_department_option[],
    valid_department_ids text[],
    document_type_options text[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments ON profile_departments.profile_id = x.profile_id AND profile_departments.active = true
),
document_active_scenario_links AS (
    SELECT 
        sd.document_id,
        COUNT(*) as active_scenario_count
    FROM scenario_documents sd
    WHERE sd.active = true
    GROUP BY sd.document_id
),
document_all_scenario_links AS (
    SELECT 
        sd.document_id,
        COUNT(*) as total_scenario_links
    FROM scenario_documents sd
    GROUP BY sd.document_id
),
document_scenarios AS (
    SELECT 
        sd.document_id,
        ARRAY_AGG(DISTINCT st.parent_id) as scenario_ids
    FROM scenario_documents sd
    JOIN scenario_tree st ON st.child_id = sd.scenario_id AND st.parent_id = st.child_id
    WHERE sd.active = true
    GROUP BY sd.document_id
),
document_fields_cte AS (
    SELECT 
        df.document_id,
        ARRAY_AGG(df.field_id) as field_ids
    FROM document_fields df
    WHERE df.active = true
    GROUP BY df.document_id
),
document_departments_data AS (
    SELECT 
        dd.document_id,
        ARRAY_AGG(dd.department_id::text ORDER BY dd.created_at) as department_ids
    FROM document_departments dd
    WHERE dd.active = true
    GROUP BY dd.document_id
),
document_data AS (
    SELECT 
        d.id as document_id,
        (SELECT n.name FROM document_names dn JOIN names n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1),
        d.updated_at,
        du.upload_id,
        EXISTS (SELECT 1 FROM document_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.document_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_document_flags AND df.value = TRUE) as active,
        CASE 
            WHEN u.file_path IS NOT NULL THEN SUBSTRING(u.file_path FROM '\\.([^\\.]+)$')
            ELSE NULL
        END as extension,
        COALESCE(ddd.department_ids, NULL) as department_ids,
        COALESCE(ds.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
        COALESCE(dfc.field_ids, ARRAY[]::uuid[]) as field_ids,
        COALESCE(dasl.active_scenario_count, 0) as active_scenario_count,
        COALESCE(dasl_all.total_scenario_links, 0) as total_scenario_links
    FROM documents d
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    LEFT JOIN document_departments_data ddd ON ddd.document_id = d.id
    LEFT JOIN document_scenarios ds ON ds.document_id = d.id
    LEFT JOIN document_fields_cte dfc ON dfc.document_id = d.id
    LEFT JOIN document_active_scenario_links dasl ON dasl.document_id = d.id
    LEFT JOIN document_all_scenario_links dasl_all ON dasl_all.document_id = d.id
    GROUP BY d.id, (SELECT n.name FROM document_names dn JOIN names n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1), d.updated_at, du.upload_id, u.file_path, EXISTS (SELECT 1 FROM document_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.document_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_document_flags AND df.value = TRUE), 
             ddd.department_ids, ds.scenario_ids, dfc.field_ids, dasl.active_scenario_count, dasl_all.total_scenario_links
    HAVING 
        COUNT(dd.document_id) FILTER (WHERE dd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
),
user_profile AS (
    SELECT 
        role,
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM document_data
),
scenario_data AS (
    SELECT 
        s.id as scenario_id,
        (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1),
        COALESCE(ps.problem_statement, '') as description,
        EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = TRUE) as active
    FROM all_scenario_ids asi
    LEFT JOIN scenarios s ON s.id = asi.scenario_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    LEFT JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
    WHERE s.id IS NOT NULL AND st.parent_id IS NOT NULL
),
field_data AS (
    SELECT
        f.id as field_id,
        (SELECT n.name FROM field_names fn JOIN names n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        (SELECT d.description FROM field_descriptions fd JOIN descriptions d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1),
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1),
        (SELECT n.name FROM parameter_names pn JOIN names n ON pn.name_id = n.id WHERE pn.parameter_id = (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) LIMIT 1) as parameter_name
    FROM fields f
    LEFT JOIN parameter_fields pf_link ON pf_link.field_id = f.id
    LEFT JOIN parameters p ON p.id = pf_link.parameter_id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags fl ON paf.flag_id = fl.id WHERE paf.parameter_id = p.id AND fl.name = 'active' AND paf.type = 'active'::type_parameter_flags AND paf.value = TRUE) AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'active' AND ff.type = 'active'::type_field_flags AND ff.value = TRUE) AND pf_link.parameter_id IS NOT NULL
    GROUP BY f.id, (SELECT n.name FROM field_names fn JOIN names n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), (SELECT d.description FROM field_descriptions fd JOIN descriptions d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1), (SELECT n.name FROM parameter_names pn JOIN names n ON pn.name_id = n.id WHERE pn.parameter_id = (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) LIMIT 1)
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
),
department_parameter_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT p.id::text) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as parameter_ids
    FROM departments d
    LEFT JOIN parameters p ON EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags fl ON paf.flag_id = fl.id WHERE paf.parameter_id = p.id AND fl.name = 'active' AND paf.type = 'active'::type_parameter_flags AND paf.value = TRUE)
    LEFT JOIN parameter_fields pf_link ON pf_link.parameter_id = p.id
    LEFT JOIN fields f_pf ON f_pf.id = pf_link.field_id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags fl ON ff.flag_id = fl.id WHERE ff.field_id = f_pf.id AND fl.name = 'active' AND ff.type = 'active'::type_field_flags AND ff.value = TRUE)
    LEFT JOIN field_departments fd ON fd.field_id = f_pf.id AND fd.active = true
    WHERE d.id IN (SELECT department_id FROM user_departments)
    AND (fd.department_id = d.id OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                                                 JOIN parameter_fields pf2 ON pf2.field_id = fd2.field_id 
                                                 WHERE pf2.parameter_id = p.id AND EXISTS (SELECT 1 FROM field_flags ff2 JOIN flags fl ON ff2.flag_id = fl.id WHERE ff2.field_id = pf2.field_id AND fl.name = 'active' AND ff2.type = 'active'::type_field_flags AND ff2.value = TRUE) AND fd2.active = true))
    GROUP BY d.id
),
cross_department_items AS (
    -- Fields with no department restrictions (available to all)
    SELECT DISTINCT f.id
    FROM fields f
    JOIN parameters p ON p.id = (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) AND EXISTS (SELECT 1 FROM persona_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_persona_flags AND pf.value = true)
    WHERE NOT EXISTS (
        SELECT 1 FROM field_departments fd 
        WHERE fd.field_id = f.id 
        AND fd.active = true
    )
),
department_field_ids AS (
    SELECT 
        d.id as department_id,
        COALESCE(ARRAY_AGG(f.id::text ORDER BY f.id) FILTER (WHERE f.id IS NOT NULL), ARRAY[]::text[]) as field_ids
    FROM departments d
    LEFT JOIN (
        -- Fields assigned to this specific department
        SELECT DISTINCT fd.department_id, f.id
        FROM field_departments fd
        JOIN fields f ON f.id = fd.field_id
        JOIN parameters p ON p.id = (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) AND EXISTS (SELECT 1 FROM persona_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_persona_flags AND pf.value = true)
        WHERE fd.active = true
        UNION
        -- Cross-department fields (available to all user departments)
        SELECT DISTINCT ud.department_id, cdi.id
        FROM user_departments ud
        CROSS JOIN cross_department_items cdi
    ) f_dept ON f_dept.department_id = d.id
    LEFT JOIN fields f ON f.id = f_dept.id
    WHERE d.id IN (SELECT department_id FROM user_departments)
    GROUP BY d.id
),
department_data AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description,
        COALESCE(dparami.parameter_ids, ARRAY[]::text[]) as parameter_ids,
        COALESCE(dparamitems.field_ids, ARRAY[]::text[]) as field_ids
    FROM departments d
    LEFT JOIN department_parameter_ids dparami ON dparami.department_id = d.id
    LEFT JOIN department_field_ids dparamitems ON dparamitems.department_id = d.id
    WHERE d.id IN (SELECT department_id FROM user_departments)
),
parameter_data AS (
    SELECT DISTINCT 
        p.id as parameter_id,
        (SELECT n.name FROM parameter_names pn JOIN names n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM parameter_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags fl ON paf.flag_id = fl.id WHERE paf.parameter_id = p.id AND fl.name = 'document_parameter' AND paf.type = 'document_parameter'::type_parameter_flags AND paf.value = TRUE) as document_parameter,
        EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags fl ON paf.flag_id = fl.id WHERE paf.parameter_id = p.id AND fl.name = 'persona_parameter' AND paf.type = 'persona_parameter'::type_parameter_flags AND paf.value = TRUE) as persona_parameter,
        CASE WHEN EXISTS (SELECT 1 FROM scenario_parameters sp WHERE sp.parameter_id = p.id AND sp.active = true) THEN true ELSE false END as scenario_parameter,
        EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags fl ON paf.flag_id = fl.id WHERE paf.parameter_id = p.id AND fl.name = 'video_parameter' AND paf.type = 'video_parameter'::type_parameter_flags AND paf.value = TRUE) as video_parameter
    FROM parameters p
    JOIN fields f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = p.id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'active' AND ff.type = 'active'::type_field_flags AND ff.value = true)
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags fl ON paf.flag_id = fl.id WHERE paf.parameter_id = p.id AND fl.name = 'active' AND paf.type = 'active'::type_parameter_flags AND paf.value = TRUE)
    GROUP BY p.id, (SELECT n.name FROM parameter_names pn JOIN names n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1), (SELECT d.description FROM parameter_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1)
    HAVING 
        COUNT(fd.field_id) FILTER (WHERE fd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                      JOIN parameter_fields pf2 ON pf2.field_id = fd2.field_id
                      WHERE pf2.parameter_id = p.id AND EXISTS (SELECT 1 FROM field_flags ff2 JOIN flags fl ON ff2.flag_id = fl.id WHERE ff2.field_id = pf2.field_id AND fl.name = 'active' AND ff2.type = 'active'::type_field_flags AND ff2.value = TRUE) AND fd2.active = true)
    ORDER BY (SELECT n.name FROM parameter_names pn JOIN names n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1)
),
document_valid_fields AS (
    SELECT 
        dd.document_id,
        COALESCE(
            ARRAY_AGG(DISTINCT f.id::text ORDER BY f.id::text) FILTER (WHERE f.id IS NOT NULL),
            ARRAY[]::text[]
        ) as valid_field_ids
    FROM document_data dd
    LEFT JOIN fields f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) IN (SELECT p.id FROM parameters p WHERE EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags fl ON paf.flag_id = fl.id WHERE paf.parameter_id = p.id AND fl.name = 'active' AND paf.type = 'active'::type_parameter_flags AND paf.value = TRUE)) AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'active' AND ff.type = 'active'::type_field_flags AND ff.value = true)
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE (
        -- If document has no departments, include only cross-department fields
        (dd.department_ids IS NULL OR array_length(dd.department_ids, 1) = 0)
        AND NOT EXISTS (
            SELECT 1 FROM field_departments fd2 
            WHERE fd2.field_id = f.id 
            AND fd2.active = true
        )
    ) OR (
        -- If document has departments, include fields from those departments OR cross-department fields
        dd.department_ids IS NOT NULL 
        AND array_length(dd.department_ids, 1) > 0
        AND (
            fd.department_id = ANY(SELECT unnest(dd.department_ids)::uuid)
            OR NOT EXISTS (
                SELECT 1 FROM field_departments fd2 
                WHERE fd2.field_id = f.id 
                AND fd2.active = true
            )
        )
    )
    GROUP BY dd.document_id
),
scenario_options_data AS (
    SELECT 
        sd.scenario_id,
        sd.name,
        CASE 
            WHEN (SELECT COUNT(*) FROM scenario_data sd2 WHERE sd2.name = sd.name) > 1 
            THEN sd.name || ' (' || SUBSTRING(sd.scenario_id::text FROM LENGTH(sd.scenario_id::text) - 7) || ')'
            ELSE sd.name
        END as label
    FROM scenario_data sd
),
department_options_data AS (
    SELECT 
        dd.department_id,
        dd.name as label
    FROM department_data dd
)
SELECT 
    up.actor_name::text as actor_name,
    -- Aggregate documents separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.document_id, dd.name, dd.updated_at, dd.upload_id, dd.active, dd.extension,
             COALESCE(dd.department_ids, ARRAY[]::text[]), dd.scenario_ids, dd.field_ids,
             COALESCE(dvf.valid_field_ids, ARRAY[]::text[]), dd.active_scenario_count, dd.total_scenario_links,
             CASE 
                 WHEN dd.active_scenario_count > 0 THEN false
                 WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
                 ELSE false
             END,
             CASE 
                 WHEN dd.total_scenario_links > 0 THEN false
                 WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
                 ELSE false
             END
            )::types.q_list_documents_v4_document
            ORDER BY dd.updated_at DESC
        ) FROM document_data dd
        LEFT JOIN document_valid_fields dvf ON dvf.document_id = dd.document_id),
        '{}'::types.q_list_documents_v4_document[]
    ) as documents,
    -- Aggregate scenarios separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (sd.scenario_id, sd.name, sd.description, sd.active)::types.q_list_documents_v4_scenario
            ORDER BY sd.name
        ) FROM scenario_data sd),
        '{}'::types.q_list_documents_v4_scenario[]
    ) as scenarios,
    -- Aggregate fields separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (fd.field_id, fd.name, fd.description, fd.parameter_id, fd.parameter_name)::types.q_list_documents_v4_field
            ORDER BY fd.name
        ) FROM field_data fd),
        '{}'::types.q_list_documents_v4_field[]
    ) as fields,
    -- Aggregate departments separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd2.department_id, dd2.name, dd2.description, dd2.parameter_ids, dd2.field_ids)::types.q_list_documents_v4_department
            ORDER BY dd2.name
        ) FROM department_data dd2),
        '{}'::types.q_list_documents_v4_department[]
    ) as departments,
    -- Aggregate parameters separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.parameter_id, pd.name, pd.description, pd.document_parameter, pd.persona_parameter, pd.scenario_parameter, pd.video_parameter)::types.q_list_documents_v4_parameter
            ORDER BY pd.name
        ) FROM parameter_data pd),
        '{}'::types.q_list_documents_v4_parameter[]
    ) as parameters,
    -- Scenario options (composite type array)
    COALESCE(
        (SELECT ARRAY_AGG(
            (sod.scenario_id::text, sod.label)::types.q_list_documents_v4_scenario_option
            ORDER BY sod.label
        ) FROM scenario_options_data sod),
        '{}'::types.q_list_documents_v4_scenario_option[]
    ) as scenario_options,
    -- Department options (composite type array)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.department_id::text, dod.label)::types.q_list_documents_v4_department_option
            ORDER BY dod.label
        ) FROM department_options_data dod),
        '{}'::types.q_list_documents_v4_department_option[]
    ) as department_options,
    -- Valid department IDs
    COALESCE(
        (SELECT ARRAY_AGG(dd2.department_id::text ORDER BY dd2.department_id::text) FROM department_data dd2),
        ARRAY[]::text[]
    ) as valid_department_ids,
    -- Document type options (hardcoded)
    ARRAY['homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus']::text[] as document_type_options
FROM user_profile up
$$;