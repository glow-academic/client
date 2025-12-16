-- Get persona detail with agents, departments, and access control
-- Parameters: $1 = persona_id (uuid), $2 = profile_id (uuid)

WITH user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
persona_departments_data AS (
    SELECT 
        pd.persona_id,
        ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
    FROM persona_departments pd
    WHERE pd.persona_id = $1 AND pd.active = true
    GROUP BY pd.persona_id
),
persona_department_access_check AS (
    SELECT 
        p.id as persona_id,
        CASE 
            WHEN up.role = 'superadmin' THEN true
            WHEN EXISTS (
                SELECT 1 FROM persona_departments pd 
                WHERE pd.persona_id = p.id 
                AND pd.active = true 
                AND pd.department_id IN (SELECT department_id FROM profile_departments pd2 WHERE pd2.profile_id = $2::uuid AND pd2.active = true)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM persona_departments pd3 
                WHERE pd3.persona_id = p.id 
                AND pd3.active = true
            ) THEN true  -- Cross-department resource
            ELSE false
        END as has_access
    FROM personas p
    CROSS JOIN user_profile up
    WHERE p.id = $1
),
persona_data AS (
    SELECT 
        p.name,
        p.description,
        p.active,
        p.color,
        p.icon,
        p.instructions,
        NULL::text as text_agent_id,
        NULL::text as voice_agent_id,
        COALESCE(pdd.department_ids, NULL) as department_ids
    FROM personas p
    LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
    INNER JOIN persona_department_access_check pdac ON pdac.persona_id = p.id AND pdac.has_access = true
    WHERE p.id = $1
),
valid_depts AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                d.id::text,
                jsonb_build_object(
                    'name', d.title,
                    'description', COALESCE(d.description, '')
                )
            ),
            '{}'::jsonb
        ) as dept_mapping,
        array_agg(d.id::text ORDER BY d.title) as dept_ids
    FROM departments d
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = $2::uuid AND d.active = true
),
user_departments AS (
    SELECT department_id
    FROM profile_departments pd
    WHERE pd.profile_id = $2::uuid AND pd.active = true
),
valid_agents AS (
    -- Return empty mapping since personas no longer have agents
    SELECT 
        '{}'::jsonb as agent_mapping,
        ARRAY[]::text[] as agent_ids
),
usage_data AS (
    SELECT COUNT(*) as usage_count
    FROM scenario_personas sp
    WHERE sp.persona_id = $1 AND sp.active = true
),
profile_data AS (
    SELECT 
        up.role as user_role,
        up.actor_name
    FROM user_profile up
),
parameter_mapping_data AS (
    -- Note: parameter_personas junction table removed - parameters no longer directly linked to personas
    -- Return empty mapping since we can't determine which parameters are linked
    SELECT 
        '{}'::jsonb as parameter_mapping,
        ARRAY[]::text[] as parameter_ids
),
field_mapping_data AS (
    -- Note: Since parameters are no longer linked to personas, return empty field mapping
    -- Fields can still be linked to personas via persona_fields junction table
    SELECT 
        '{}'::jsonb as field_mapping,
        ARRAY[]::text[] as parameter_item_ids
),
persona_field_ids AS (
    -- Get field IDs already assigned to this persona (if persona_fields table exists)
    -- Note: persona_fields table may not exist, so we return empty array for now
    -- When the table exists, this can be updated to query from it
    SELECT ARRAY[]::text[] as field_ids
),
persona_examples_data AS (
    SELECT 
        COALESCE(ARRAY_AGG(e.id::text ORDER BY pe.idx), ARRAY[]::text[]) as example_ids,
        COALESCE(jsonb_object_agg(
            e.id::text,
            jsonb_build_object('name', e.example, 'description', e.example)
        ) FILTER (WHERE e.example IS NOT NULL), '{}'::jsonb) as example_mapping
    FROM persona_examples pe
    JOIN examples e ON e.id = pe.example_id
    WHERE pe.persona_id = $1
),
accessible_personas AS (
    -- Get personas accessible to the user (for examples history)
    SELECT DISTINCT p.id as persona_id
    FROM personas p
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    CROSS JOIN user_profile up
    WHERE (
        up.role = 'superadmin'
        OR pd.department_id IN (SELECT department_id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
    )
),
examples_with_departments AS (
    -- Get examples with their department associations for history
    SELECT 
        e.example,
        COALESCE(
            ARRAY_AGG(DISTINCT pd.department_id::text) FILTER (
                WHERE pd.department_id IS NOT NULL
            ),
            ARRAY[]::text[]
        ) as department_ids
    FROM persona_examples pe
    JOIN examples e ON e.id = pe.example_id
    JOIN accessible_personas ap ON ap.persona_id = pe.persona_id
    LEFT JOIN persona_departments pd ON pd.persona_id = pe.persona_id AND pd.active = true
    WHERE e.example IS NOT NULL AND e.example != ''
    GROUP BY e.example
),
examples_history_data AS (
    SELECT COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'example', example,
                    'department_ids', department_ids
                )
            )
            FROM (
                SELECT example, department_ids
                FROM examples_with_departments
                ORDER BY example
            ) sorted
        ),
        '[]'::jsonb
    ) as examples_history
)
SELECT 
    p.*,
    vd.dept_mapping,
    vd.dept_ids as valid_department_ids,
    COALESCE(va.agent_mapping, '{}'::jsonb) as agent_mapping,
    COALESCE(va.agent_ids, ARRAY[]::text[]) as valid_agent_ids,
    u.usage_count,
    pr.user_role,
    pr.actor_name,
    COALESCE(pmd.parameter_mapping, '{}'::jsonb) as parameter_mapping,
    COALESCE(pmd.parameter_ids, ARRAY[]::text[]) as linked_parameter_ids,
    COALESCE(fmd.field_mapping, '{}'::jsonb) as field_mapping,
    COALESCE(fmd.parameter_item_ids, ARRAY[]::text[]) as valid_parameter_item_ids,
    COALESCE(pfi.field_ids, ARRAY[]::text[]) as parameter_field_ids,
    COALESCE(ped.example_ids, ARRAY[]::text[]) as example_ids,
    COALESCE(ped.example_mapping, '{}'::jsonb) as example_mapping,
    COALESCE(ehd.examples_history, '[]'::jsonb) as examples_history
FROM persona_data p
CROSS JOIN valid_depts vd
CROSS JOIN valid_agents va
CROSS JOIN usage_data u
CROSS JOIN profile_data pr
CROSS JOIN parameter_mapping_data pmd
CROSS JOIN field_mapping_data fmd
CROSS JOIN persona_field_ids pfi
CROSS JOIN persona_examples_data ped
CROSS JOIN examples_history_data ehd
