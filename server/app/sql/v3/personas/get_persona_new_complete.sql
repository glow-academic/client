-- Get default persona detail for creation
-- Parameters: $1 = profile_id (uuid)

WITH user_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $1::uuid
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM profile_departments pd
    WHERE pd.profile_id = $1::uuid
),
default_persona AS (
    SELECT p.id
    FROM personas p
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    WHERE p.active = true
    GROUP BY p.id
    HAVING 
        -- Include if has matching department link OR has no department links at all (cross-dept)
        COUNT(pd.persona_id) FILTER (WHERE pd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
    ORDER BY p.created_at DESC
    LIMIT 1
),
persona_departments_data AS (
    SELECT 
        pd.persona_id,
        ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
    FROM persona_departments pd
    JOIN default_persona dp ON pd.persona_id = dp.id
    WHERE pd.active = true
    GROUP BY pd.persona_id
),
persona_data AS (
    SELECT 
        p.name,
        p.description,
        p.active,
        p.color,
        p.icon,
        p.instructions,
        COALESCE(pdd.department_ids, NULL) as department_ids
    FROM personas p
    JOIN default_persona dp ON p.id = dp.id
    LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
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
    WHERE pd.profile_id = $1::uuid AND d.active = true
),
valid_agents AS (
    -- Get agents with roles simulation-text or simulation-voice
    -- Filter by department access: include if has matching department link OR has no department links at all (cross-dept)
    SELECT 
        COALESCE(
            jsonb_object_agg(
                a.id::text,
                jsonb_build_object(
                    'name', a.name,
                    'description', COALESCE(a.description, ''),
                    'roles', ARRAY[a.role::text]
                )
            ),
            '{}'::jsonb
        ) as agent_mapping,
        array_agg(a.id::text ORDER BY a.name) as agent_ids
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE a.active = true 
    AND a.role IN ('simulation-text', 'simulation-voice')
    GROUP BY a.id
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
usage_data AS (
    SELECT COUNT(*) as usage_count
    FROM scenario_personas sp
    JOIN default_persona dp ON sp.persona_id = dp.id
    WHERE sp.active = true
),
profile_data AS (
    SELECT role as user_role 
    FROM profiles p
    WHERE p.id = $1::uuid
),
primary_department_id AS (
    SELECT department_id::text
    FROM profile_departments pd
    WHERE pd.profile_id = $1::uuid AND pd.is_primary = TRUE
    LIMIT 1
),
available_parameters AS (
    -- Get all parameters that could be linked to personas
    -- Note: parameter_personas junction table removed - show all active parameters with persona_parameter flag
    SELECT DISTINCT
        p.id as parameter_id,
        p.name as parameter_name,
        p.description as parameter_description
    FROM parameters p
    WHERE p.active = true
    AND p.persona_parameter = true
),
parameter_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            ap.parameter_id::text,
            jsonb_build_object(
                'name', ap.parameter_name,
                'description', ap.parameter_description,
                'document_parameter', false,
                'persona_parameter', true
            )
        ),
        '{}'::jsonb
    ) as parameter_mapping,
    array_agg(ap.parameter_id::text ORDER BY ap.parameter_name) as parameter_ids
    FROM available_parameters ap
),
field_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            f.id::text,
            jsonb_build_object(
                'name', f.name,
                'description', COALESCE(f.description, ''),
                'parameter_id', pf.parameter_id::text,
                'parameter_name', p.name
            )
        ),
        '{}'::jsonb
    ) as field_mapping,
    array_agg(f.id::text ORDER BY f.name) as parameter_item_ids
    FROM available_parameters ap
    JOIN parameter_fields pf ON pf.parameter_id = ap.parameter_id AND pf.active = true
    JOIN fields f ON f.id = pf.field_id AND f.active = true
    JOIN parameters p ON p.id = pf.parameter_id
    WHERE p.active = true
)
SELECT 
    p.*,
    vd.dept_mapping,
    vd.dept_ids as valid_department_ids,
    COALESCE(va.agent_mapping, '{}'::jsonb) as agent_mapping,
    COALESCE(va.agent_ids, ARRAY[]::text[]) as valid_agent_ids,
    u.usage_count,
    pr.user_role,
    pdi.department_id as primary_department_id,
    COALESCE(pmd.parameter_mapping, '{}'::jsonb) as parameter_mapping,
    COALESCE(pmd.parameter_ids, ARRAY[]::text[]) as valid_parameter_ids,
    COALESCE(fmd.field_mapping, '{}'::jsonb) as field_mapping,
    COALESCE(fmd.parameter_item_ids, ARRAY[]::text[]) as valid_parameter_item_ids,
    up.actor_name
FROM persona_data p
CROSS JOIN valid_depts vd
CROSS JOIN valid_agents va
CROSS JOIN usage_data u
CROSS JOIN profile_data pr
LEFT JOIN primary_department_id pdi ON true
CROSS JOIN parameter_mapping_data pmd
CROSS JOIN field_mapping_data fmd
CROSS JOIN user_profile up
