-- Get parameters list with permissions and relationships
-- Converted to function with composite types

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_list_parameters_v3(uuid);

-- 2) Drop types WITHOUT CASCADE (drop parameter type first since it depends on sample_item)
DROP TYPE IF EXISTS types.q_list_parameters_v3_parameter;
DROP TYPE IF EXISTS types.q_list_parameters_v3_sample_item;
DROP TYPE IF EXISTS types.q_list_parameters_v3_scenario;
DROP TYPE IF EXISTS types.q_list_parameters_v3_department;
DROP TYPE IF EXISTS types.q_list_parameters_v3_document;
DROP TYPE IF EXISTS types.q_list_parameters_v3_scenario_option;
DROP TYPE IF EXISTS types.q_list_parameters_v3_document_option;

-- 3) Recreate types
CREATE TYPE types.q_list_parameters_v3_sample_item AS (
    parameter_item_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_parameters_v3_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    active boolean,
    updated_at timestamptz,
    department_ids text[],
    scenario_ids text[],
    document_ids text[],
    num_items int,
    sample_items types.q_list_parameters_v3_sample_item[],
    can_edit boolean,
    can_delete boolean,
    can_duplicate boolean
);

CREATE TYPE types.q_list_parameters_v3_scenario AS (
    scenario_id uuid,
    name text,
    description text,
    active boolean
);

CREATE TYPE types.q_list_parameters_v3_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_parameters_v3_document AS (
    document_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_parameters_v3_scenario_option AS (
    value text,
    label text
);

CREATE TYPE types.q_list_parameters_v3_document_option AS (
    value text,
    label text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_parameters_v3(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    parameters types.q_list_parameters_v3_parameter[],
    scenarios types.q_list_parameters_v3_scenario[],
    departments types.q_list_parameters_v3_department[],
    documents types.q_list_parameters_v3_document[],
    scenario_options types.q_list_parameters_v3_scenario_option[],
    document_options types.q_list_parameters_v3_document_option[]
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
        first_name || ' ' || last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
parameter_active_scenario_links AS (
    SELECT 
        fp.parameter_id,
        COUNT(DISTINCT sf.scenario_id) as active_scenario_count
    FROM parameter_fields fp
    JOIN scenario_fields sf ON sf.field_id = fp.field_id
    WHERE fp.active = true AND sf.active = true
    GROUP BY fp.parameter_id
),
parameter_all_scenario_links AS (
    SELECT 
        fp.parameter_id,
        COUNT(DISTINCT sf.scenario_id) as total_scenario_links
    FROM parameter_fields fp
    JOIN scenario_fields sf ON sf.field_id = fp.field_id
    WHERE fp.active = true
    GROUP BY fp.parameter_id
),
scenario_parameters_data AS (
    SELECT 
        sp.parameter_id,
        ARRAY_AGG(DISTINCT st.parent_id::text ORDER BY st.parent_id::text) as scenario_ids,
        COUNT(DISTINCT st.parent_id) as num_scenarios
    FROM scenario_parameters sp
    JOIN scenarios s ON s.id = sp.scenario_id
    JOIN scenario_tree st ON st.child_id = s.id AND st.parent_id = st.child_id
    WHERE sp.active = true AND s.active = true
    GROUP BY sp.parameter_id
),
parameter_item_counts AS (
    SELECT 
        fp.parameter_id,
        COUNT(*) as num_items
    FROM parameter_fields fp
    WHERE fp.active = true
    GROUP BY fp.parameter_id
),
parameter_sample_items_data AS (
    SELECT 
        fp_sub.parameter_id,
        fp_sub.field_id,
        fp_sub.name,
        fp_sub.description
    FROM (
        SELECT f.id as field_id, fp.parameter_id, f.name, f.description,
               ROW_NUMBER() OVER (PARTITION BY fp.parameter_id ORDER BY f.name) as rn
        FROM parameter_fields fp
        JOIN fields f ON f.id = fp.field_id
        WHERE fp.active = true
    ) fp_sub
    WHERE fp_sub.rn <= 3
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
        SELECT fp.parameter_id, fd.department_id
        FROM parameter_fields fp
        JOIN field_departments fd ON fd.field_id = fp.field_id
        WHERE fp.active = true AND fd.active = true
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
        SELECT fp.parameter_id, fd.department_id
        FROM parameter_fields fp
        JOIN field_departments fd ON fd.field_id = fp.field_id
        WHERE fp.active = true AND fd.active = true
    ) combined
),
parameter_documents AS (
    SELECT 
        fp.parameter_id,
        ARRAY_AGG(DISTINCT df.document_id::text ORDER BY df.document_id::text) as document_ids
    FROM parameter_fields fp
    JOIN document_fields df ON df.field_id = fp.field_id
    WHERE fp.active = true AND df.active = true
    GROUP BY fp.parameter_id
),
filtered_parameters AS (
    SELECT 
        p.id,
        p.name,
        p.description,
        p.active,
        p.updated_at
    FROM parameters p
    LEFT JOIN parameter_item_departments_for_filter pidf ON pidf.parameter_id = p.id
    GROUP BY p.id, p.name, p.description, p.active, p.updated_at
    HAVING 
        COUNT(pidf.parameter_id) FILTER (WHERE pidf.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (
            SELECT 1 FROM parameter_departments pd2 WHERE pd2.parameter_id = p.id AND pd2.active = true
        )
        AND NOT EXISTS (
            SELECT 1 FROM field_departments fd2 
            JOIN parameter_fields fp2 ON fp2.field_id = fd2.field_id 
            WHERE fp2.parameter_id = p.id AND fp2.active = true AND fd2.active = true
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
        s.name,
        COALESCE(ps.problem_statement, '') as description,
        s.active
    FROM all_scenario_ids asi
    LEFT JOIN scenarios s ON s.id = asi.scenario_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    WHERE s.id IS NOT NULL
),
departments_data AS (
    SELECT 
        d.id as department_id,
        d.title as name,
        COALESCE(d.description, '') as description
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM all_department_ids)
),
documents_data AS (
    SELECT 
        doc.id as document_id,
        doc.name,
        COALESCE(doc.description, '') as description
    FROM documents doc
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
    FROM scenarios s
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
    FROM documents d
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
        d.name,
        d.description
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
            (SELECT ARRAY_AGG((psi.field_id, psi.name, psi.description)::types.q_list_parameters_v3_sample_item ORDER BY psi.name)
             FROM parameter_sample_items_data psi
             WHERE psi.parameter_id = fp.id),
            '{}'::types.q_list_parameters_v3_sample_item[]
        ) as sample_items,
        CASE 
            WHEN COALESCE(pasl.active_scenario_count, 0) > 0 THEN false
            WHEN up.role IN (profile_role.admin, profile_role.superadmin) THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN COALESCE(pasl_all.total_scenario_links, 0) > 0 THEN false
            WHEN up.role IN (profile_role.admin, profile_role.superadmin) THEN true
            ELSE false
        END as can_delete,
        CASE 
            WHEN up.role IN (profile_role.admin, profile_role.superadmin) THEN true
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
            )::types.q_list_parameters_v3_parameter
            ORDER BY pd.updated_at DESC NULLS LAST
        ) FROM parameters_data pd),
        '{}'::types.q_list_parameters_v3_parameter[]
    ) as parameters,
    -- Aggregate scenarios separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (sd.scenario_id, sd.name, sd.description, sd.active)::types.q_list_parameters_v3_scenario
            ORDER BY sd.name
        ) FROM scenarios_data sd),
        '{}'::types.q_list_parameters_v3_scenario[]
    ) as scenarios,
    -- Aggregate departments separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (fdd.department_id, fdd.name, fdd.description)::types.q_list_parameters_v3_department
            ORDER BY fdd.name
        ) FROM filtered_departments_data fdd),
        '{}'::types.q_list_parameters_v3_department[]
    ) as departments,
    -- Aggregate documents separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.document_id, dd.name, dd.description)::types.q_list_parameters_v3_document
            ORDER BY dd.name
        ) FROM documents_data dd),
        '{}'::types.q_list_parameters_v3_document[]
    ) as documents,
    -- Aggregate scenario options separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (sod.value, sod.label)::types.q_list_parameters_v3_scenario_option
            ORDER BY sod.label
        ) FROM scenario_options_data sod),
        '{}'::types.q_list_parameters_v3_scenario_option[]
    ) as scenario_options,
    -- Aggregate document options separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.value, dod.label)::types.q_list_parameters_v3_document_option
            ORDER BY dod.label
        ) FROM document_options_data dod),
        '{}'::types.q_list_parameters_v3_document_option[]
    ) as document_options
FROM user_profile up
$$;

COMMIT;

