WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
user_profile AS (
    SELECT 
        role,
        (SELECT department_id FROM profile_departments WHERE profile_id = $1 AND active = true LIMIT 1) as primary_department_id
    FROM profiles WHERE id = $1
),
department_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.title,
                'description', COALESCE(d.description, '')
            )
        ) FILTER (WHERE d.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM user_departments)
),
department_ids_array AS (
    SELECT ARRAY_AGG(department_id::text ORDER BY department_id) as department_ids
    FROM user_departments
),
-- Problem statements (shared between scenarios only - videos now use outlines)
problem_statement_data AS (
    SELECT DISTINCT
        ps.id,
        ps.problem_statement,
        ps.created_at,
        ps.updated_at
    FROM problem_statements ps
    LEFT JOIN scenario_problem_statements sps ON sps.problem_statement_id = ps.id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = sps.scenario_id AND sd.active = true
    CROSS JOIN user_profile up
    WHERE (
        up.role = 'superadmin'
        OR sd.department_id IN (SELECT department_id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = sps.scenario_id AND sd2.active = true)
    )
),
problem_statement_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            ps.id::text,
            jsonb_build_object(
                'problem_statement', ps.problem_statement,
                'created_at', ps.created_at::text,
                'updated_at', ps.updated_at::text
            )
        ) FILTER (WHERE ps.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM problem_statement_data ps
),
-- Policies
policy_data AS (
    SELECT DISTINCT
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.file_path,
        p.mime_type
    FROM policies p
    LEFT JOIN policy_departments pd ON pd.policy_id = p.id AND pd.active = true
    CROSS JOIN user_profile up
    WHERE p.active = true
        AND (
            up.role = 'superadmin'
            OR pd.department_id IN (SELECT department_id FROM user_departments)
            OR NOT EXISTS (SELECT 1 FROM policy_departments pd2 WHERE pd2.policy_id = p.id AND pd2.active = true)
        )
),
policy_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name,
                'description', p.description,
                'extension', SUBSTRING(p.file_path FROM '\.([^\.]+)$'),
                'filePath', p.file_path,
                'mimeType', p.mime_type
            )
        ) FILTER (WHERE p.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM policy_data p
),
valid_policy_ids_data AS (
    SELECT ARRAY_AGG(id::text ORDER BY id) as policy_ids
    FROM policy_data
),
-- Objectives (shared between scenarios only - videos now use outlines)
objectives_data AS (
    SELECT DISTINCT
        o.id,
        o.objective
    FROM objectives o
    LEFT JOIN scenario_objectives so ON so.objective_id = o.id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = so.scenario_id AND sd.active = true
    CROSS JOIN user_profile up
    WHERE (
        up.role = 'superadmin'
        OR sd.department_id IN (SELECT department_id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = so.scenario_id AND sd2.active = true)
    )
),
objectives_history_data AS (
    SELECT ARRAY_AGG(o.objective ORDER BY o.id) as objectives_history
    FROM objectives_data o
)
SELECT 
    COALESCE((SELECT department_ids FROM department_ids_array), ARRAY[]::text[]) as department_ids,
    COALESCE((SELECT mapping FROM department_mapping_data), '{}'::jsonb) as department_mapping,
    COALESCE((SELECT mapping FROM problem_statement_mapping_data), '{}'::jsonb) as problem_statement_mapping,
    COALESCE((SELECT mapping FROM policy_mapping_data), '{}'::jsonb) as policy_mapping,
    COALESCE((SELECT policy_ids FROM valid_policy_ids_data), ARRAY[]::text[]) as valid_policy_ids,
    COALESCE((SELECT objectives_history FROM objectives_history_data), ARRAY[]::text[]) as objectives_history,
    (SELECT role FROM user_profile) as user_role,
    (SELECT primary_department_id::text FROM user_profile) as primary_department_id

