-- Get parameters list with permissions and relationships
-- Converted to function with composite types
-- 1) Drop function first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_list_parameters_v4(uuid);

-- 2) Drop types WITHOUT CASCADE (drop parameter type first since it depends on sample_item)
DROP TYPE IF EXISTS types.q_list_parameters_v4_parameter;
DROP TYPE IF EXISTS types.q_list_parameters_v4_sample_item;
DROP TYPE IF EXISTS types.q_list_parameters_v4_scenario;
DROP TYPE IF EXISTS types.q_list_parameters_v4_department;
DROP TYPE IF EXISTS types.q_list_parameters_v4_document;
DROP TYPE IF EXISTS types.q_list_parameters_v4_scenario_option;
DROP TYPE IF EXISTS types.q_list_parameters_v4_document_option;

-- 3) Recreate types
CREATE TYPE types.q_list_parameters_v4_sample_item AS (
    parameter_item_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_parameters_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    active boolean,
    updated_at timestamptz,
    department_ids text[],
    scenario_ids text[],
    document_ids text[],
    num_items int,
    sample_items types.q_list_parameters_v4_sample_item[],
    can_edit boolean,
    can_delete boolean,
    can_duplicate boolean
);

CREATE TYPE types.q_list_parameters_v4_scenario AS (
    scenario_id uuid,
    name text,
    description text,
    active boolean
);

CREATE TYPE types.q_list_parameters_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_parameters_v4_document AS (
    document_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_parameters_v4_scenario_option AS (
    value text,
    label text
);

CREATE TYPE types.q_list_parameters_v4_document_option AS (
    value text,
    label text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_parameters_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    parameters types.q_list_parameters_v4_parameter[],
    scenarios types.q_list_parameters_v4_scenario[],
    departments types.q_list_parameters_v4_department[],
    documents types.q_list_parameters_v4_document[],
    scenario_options types.q_list_parameters_v4_scenario_option[],
    document_options types.q_list_parameters_v4_document_option[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
user_profile AS (
    SELECT 
        role,
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) AND pn.type = 'full'::type_profile_names LIMIT 1),
            (SELECT n1.name || ' ' || n2.name FROM profile_names pn1 JOIN names n1 ON pn1.name_id = n1.id JOIN profile_names pn2 ON pn2.profile_id = pn1.profile_id JOIN names n2 ON pn2.name_id = n2.id WHERE pn1.profile_id = (SELECT profile_id FROM params) AND pn1.type = 'first'::type_profile_names AND pn2.type = 'last'::type_profile_names LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
    JOIN profile p ON p.id = x.profile_id
),
parameter_active_scenario_links AS (
    SELECT 
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1),
        COUNT(DISTINCT sf.scenario_id) as active_scenario_count
    FROM field f
    JOIN scenario_fields sf ON sf.field_id = f.id
    WHERE EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true) AND sf.active = true AND (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL
    GROUP BY (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)
),
parameter_all_scenario_links AS (
    SELECT 
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1),
        COUNT(DISTINCT sf.scenario_id) as total_scenario_links
    FROM field f
    JOIN scenario_fields sf ON sf.field_id = f.id
    WHERE EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true) AND (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL
    GROUP BY (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)
),
scenario_parameters_data AS (
    SELECT 
        sp.parameter_id,
        ARRAY_AGG(DISTINCT st.parent_id::text ORDER BY st.parent_id::text) as scenario_ids,
        COUNT(DISTINCT st.parent_id) as num_scenarios
    FROM scenario_parameters sp
    JOIN scenarios s ON s.id = sp.scenario_id
    JOIN scenario_tree st ON st.child_id = s.id AND st.parent_id = st.child_id
    WHERE sp.active = true AND EXISTS (SELECT 1 FROM scenario_flags sf WHERE sf.scenario_id = s.id AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
    GROUP BY sp.parameter_id
),
parameter_item_counts AS (
    SELECT 
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1),
        COUNT(*) as num_items
    FROM field f
    WHERE EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true) AND (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL
    GROUP BY (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)
),
parameter_sample_items_data AS (
    SELECT 
        f_sub.parameter_id,
        f_sub.field_id,
        f_sub.name,
        f_sub.description
    FROM (
        SELECT f.id as field_id, (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1), (SELECT n.name FROM field_names fn JOIN names n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), (SELECT d.description FROM field_descriptions fd JOIN descriptions d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1),
               ROW_NUMBER() OVER (PARTITION BY (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) ORDER BY (SELECT n.name FROM field_names fn JOIN names n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1)) as rn
        FROM field f
        WHERE EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true) AND (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL
    ) f_sub
    WHERE f_sub.rn <= 3
),
parameter_item_departments_data AS (
    SELECT 
        combined.parameter_id,
        ARRAY_AGG(DISTINCT combined.department_id::text ORDER BY combined.department_id::text) as department_ids
    FROM (
        SELECT pd.parameter_id, pd.department_id
        FROM parameter_departments pd
        WHERE pd.active = true
        UNION
        SELECT (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1), fd.department_id
        FROM field f
        JOIN field_departments fd ON fd.field_id = f.id
        WHERE EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true) AND fd.active = true AND (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL
    ) combined
    GROUP BY combined.parameter_id
),
parameter_item_departments_for_filter AS (
    SELECT DISTINCT
        combined.parameter_id,
        combined.department_id
    FROM (
        SELECT pd.parameter_id, pd.department_id
        FROM parameter_departments pd
        WHERE pd.active = true
        UNION
        SELECT (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1), fd.department_id
        FROM field f
        JOIN field_departments fd ON fd.field_id = f.id
        WHERE EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true) AND fd.active = true AND (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL
    ) combined
),
parameter_documents AS (
    SELECT 
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1),
        ARRAY_AGG(DISTINCT df.document_id::text ORDER BY df.document_id::text) as document_ids
    FROM field f
    JOIN document_fields df ON df.field_id = f.id
    WHERE EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true) AND df.active = true AND (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL
    GROUP BY (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)
),
filtered_parameters AS (
    SELECT 
        p.id,
        (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        (SELECT d.description FROM persona_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1),
        EXISTS (SELECT 1 FROM persona_flags pf WHERE pf.persona_id = p.id AND pf.type = 'active'::type_persona_flags AND pf.value = TRUE) as active,
        p.updated_at
    FROM parameter p
    LEFT JOIN parameter_item_departments_for_filter pidf ON pidf.parameter_id = p.id
    GROUP BY p.id, (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1), (SELECT d.description FROM persona_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM persona_flags pf WHERE pf.persona_id = p.id AND pf.type = 'active'::type_persona_flags AND pf.value = TRUE), p.updated_at
    HAVING 
        COUNT(pidf.parameter_id) FILTER (WHERE pidf.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (
            SELECT 1 FROM parameter_departments pd2 WHERE pd2.parameter_id = p.id AND pd2.active = true
        )
        AND NOT EXISTS (
            SELECT 1 FROM field_departments fd2 
            JOIN fields f2 ON f2.id = fd2.field_id 
            JOIN parameter_fields pf2 ON pf2.field_id = f2.id WHERE pf2.parameter_id = p.id AND EXISTS (SELECT 1 FROM field_flags ff2 WHERE ff2.field_id = f2.id AND ff2.type = 'active'::type_field_flags AND ff2.value = TRUE) AND fd2.active = true
        )
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM parameter_item_departments_data
    WHERE department_ids IS NOT NULL
    UNION
    SELECT ud.department_id FROM user_departments ud
),
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids)::uuid as scenario_id
    FROM scenario_parameters_data
    WHERE scenario_ids IS NOT NULL
),
all_document_ids AS (
    SELECT DISTINCT unnest(document_ids)::uuid as document_id
    FROM parameter_documents
    WHERE document_ids IS NOT NULL
),
scenarios_data AS (
    SELECT 
        s.id as scenario_id,
        (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1),
        COALESCE(ps.problem_statement, '') as description,
        EXISTS (SELECT 1 FROM scenario_flags sf WHERE sf.scenario_id = s.id AND sf.type = 'active'::type_scenario_flags AND sf.value = TRUE) as active
    FROM all_scenario_ids asi
    LEFT JOIN scenarios s ON s.id = asi.scenario_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    WHERE s.id IS NOT NULL
),
departments_data AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d_desc.description FROM department_descriptions dd JOIN descriptions d_desc ON d_desc.id = dd.description_id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM department d
    WHERE d.id IN (SELECT department_id FROM all_department_ids)
),
documents_data AS (
    SELECT 
        doc.id as document_id,
        (SELECT n.name FROM document_names dn JOIN names n ON dn.name_id = n.id WHERE dn.document_id = doc.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = doc.id LIMIT 1), '') as description
    FROM document doc
    WHERE doc.id IN (SELECT document_id FROM all_document_ids)
),
-- Collect scenario IDs, document IDs, and department IDs actually assigned to parameters
assigned_scenario_ids AS (
    SELECT DISTINCT unnest(spd.scenario_ids)::uuid as scenario_id
    FROM filtered_parameters fp
    LEFT JOIN scenario_parameters_data spd ON spd.parameter_id = fp.id
    WHERE spd.scenario_ids IS NOT NULL
),
assigned_document_ids AS (
    SELECT DISTINCT unnest(pd.document_ids)::uuid as document_id
    FROM filtered_parameters fp
    LEFT JOIN parameter_documents pd ON pd.parameter_id = fp.id
    WHERE pd.document_ids IS NOT NULL
),
assigned_department_ids AS (
    SELECT DISTINCT unnest(pidd.department_ids)::uuid as department_id
    FROM filtered_parameters fp
    LEFT JOIN parameter_item_departments_data pidd ON pidd.parameter_id = fp.id
    WHERE pidd.department_ids IS NOT NULL
),
-- Filter scenarios to only include those assigned to parameters AND in user's departments
scenario_ids_in_user_depts AS (
    SELECT DISTINCT sd.scenario_id::text
    FROM scenario_departments sd
    WHERE sd.scenario_id IN (SELECT scenario_id FROM assigned_scenario_ids)
    AND sd.department_id IN (SELECT department_id FROM user_departments)
    AND sd.active = true
    UNION
    SELECT DISTINCT s.id::text
    FROM scenario s
    WHERE s.id IN (SELECT scenario_id FROM assigned_scenario_ids)
    AND NOT EXISTS (
        SELECT 1 FROM scenario_departments sd2 
        WHERE sd2.scenario_id = s.id AND sd2.active = true
    )
),
-- Filter documents to only include those assigned to parameters AND in user's departments
document_ids_in_user_depts AS (
    SELECT DISTINCT dd.document_id::text
    FROM document_departments dd
    WHERE dd.document_id IN (SELECT document_id FROM assigned_document_ids)
    AND dd.department_id IN (SELECT department_id FROM user_departments)
    AND dd.active = true
    UNION
    SELECT DISTINCT d.id::text
    FROM document d
    WHERE d.id IN (SELECT document_id FROM assigned_document_ids)
    AND NOT EXISTS (
        SELECT 1 FROM document_departments dd2 
        WHERE dd2.document_id = d.id AND dd2.active = true
    )
),
-- Build scenario options with disambiguation
scenario_names_count AS (
    SELECT 
        name,
        COUNT(*) as name_count
    FROM scenarios_data
    GROUP BY name
),
scenario_options_data AS (
    SELECT 
        sd.scenario_id::text as value,
        CASE 
            WHEN snc.name_count > 1 THEN sd.name || ' (' || SUBSTRING(sd.scenario_id::text FROM LENGTH(sd.scenario_id::text) - 7) || ')'
            ELSE sd.name
        END as label
    FROM scenarios_data sd
    JOIN scenario_names_count snc ON snc.name = sd.name
    WHERE sd.scenario_id::text IN (SELECT scenario_id FROM scenario_ids_in_user_depts)
),
-- Build document options with disambiguation
document_names_count AS (
    SELECT 
        name,
        COUNT(*) as name_count
    FROM documents_data
    GROUP BY name
),
document_options_data AS (
    SELECT 
        dd.document_id::text as value,
        CASE 
            WHEN dnc.name_count > 1 THEN dd.name || ' (' || SUBSTRING(dd.document_id::text FROM LENGTH(dd.document_id::text) - 7) || ')'
            ELSE dd.name
        END as label
    FROM documents_data dd
    JOIN document_names_count dnc ON dnc.name = dd.name
    WHERE dd.document_id::text IN (SELECT document_id FROM document_ids_in_user_depts)
),
-- Filter departments to only include those assigned to parameters AND in user's departments
filtered_departments_data AS (
    SELECT 
        d.department_id,
        (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1) as name,
        COALESCE((SELECT d_desc.description FROM department_descriptions dd JOIN descriptions d_desc ON d_desc.id = dd.description_id WHERE dd.department_id = d.department_id LIMIT 1), '') as description
    FROM departments_data d
    WHERE d.department_id IN (SELECT department_id FROM assigned_department_ids)
    AND d.department_id IN (SELECT department_id FROM user_departments)
),
parameters_data AS (
    SELECT 
        fp.id as parameter_id,
        fp.name,
        fp.description,
        fp.active,
        fp.updated_at,
        COALESCE(pidd.department_ids, NULL) as department_ids,
        COALESCE(spd.scenario_ids, ARRAY[]::text[]) as scenario_ids,
        COALESCE(pd.document_ids, ARRAY[]::text[]) as document_ids,
        COALESCE(pic.num_items, 0) as num_items,
        COALESCE(
            (SELECT ARRAY_AGG((psi.field_id, psi.name, psi.description)::types.q_list_parameters_v4_sample_item ORDER BY psi.name)
             FROM parameter_sample_items_data psi
             WHERE psi.parameter_id = fp.id),
            '{}'::types.q_list_parameters_v4_sample_item[]
        ) as sample_items,
        CASE 
            WHEN COALESCE(pasl.active_scenario_count, 0) > 0 THEN false
            WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN COALESCE(pasl_all.total_scenario_links, 0) > 0 THEN false
            WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_delete,
        CASE 
            WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_duplicate
    FROM filtered_parameters fp
    CROSS JOIN user_profile up
    LEFT JOIN parameter_item_departments_data pidd ON pidd.parameter_id = fp.id
    LEFT JOIN scenario_parameters_data spd ON spd.parameter_id = fp.id
    LEFT JOIN parameter_documents pd ON pd.parameter_id = fp.id
    LEFT JOIN parameter_item_counts pic ON pic.parameter_id = fp.id
    LEFT JOIN parameter_active_scenario_links pasl ON pasl.parameter_id = fp.id
    LEFT JOIN parameter_all_scenario_links pasl_all ON pasl_all.parameter_id = fp.id
)
SELECT 
    up.actor_name::text as actor_name,
    -- Aggregate parameters separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.parameter_id, pd.name, pd.description, pd.active, pd.updated_at,
             pd.department_ids, pd.scenario_ids, pd.document_ids, pd.num_items,
             pd.sample_items, pd.can_edit, pd.can_delete, pd.can_duplicate
            )::types.q_list_parameters_v4_parameter
            ORDER BY pd.updated_at DESC NULLS LAST
        ) FROM parameters_data pd),
        '{}'::types.q_list_parameters_v4_parameter[]
    ) as parameters,
    -- Aggregate scenarios separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (sd.scenario_id, sd.name, sd.description, sd.active)::types.q_list_parameters_v4_scenario
            ORDER BY sd.name
        ) FROM scenarios_data sd),
        '{}'::types.q_list_parameters_v4_scenario[]
    ) as scenarios,
    -- Aggregate departments separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (fdd.department_id, fdd.name, fdd.description)::types.q_list_parameters_v4_department
            ORDER BY fdd.name
        ) FROM filtered_departments_data fdd),
        '{}'::types.q_list_parameters_v4_department[]
    ) as departments,
    -- Aggregate documents separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.document_id, dd.name, dd.description)::types.q_list_parameters_v4_document
            ORDER BY dd.name
        ) FROM documents_data dd),
        '{}'::types.q_list_parameters_v4_document[]
    ) as documents,
    -- Aggregate scenario options separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (sod.value, sod.label)::types.q_list_parameters_v4_scenario_option
            ORDER BY sod.label
        ) FROM scenario_options_data sod),
        '{}'::types.q_list_parameters_v4_scenario_option[]
    ) as scenario_options,
    -- Aggregate document options separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.value, dod.label)::types.q_list_parameters_v4_document_option
            ORDER BY dod.label
        ) FROM document_options_data dod),
        '{}'::types.q_list_parameters_v4_document_option[]
    ) as document_options
FROM user_profile up
$$;