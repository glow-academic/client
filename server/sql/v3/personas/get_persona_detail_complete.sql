-- Get persona detail with agents, departments, and access control
-- Parameters: $1 = persona_id (uuid), $2 = profile_id (uuid or "guest-profile-id")

WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $2::uuid AND sdg.active = true
             LIMIT 1),
            -- Fallback to default (active) settings guest profile
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT role FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
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
                JOIN resolve_profile_id rpi ON true
                WHERE pd.persona_id = p.id 
                AND pd.active = true 
                AND pd.department_id IN (SELECT department_id FROM profile_departments pd2 WHERE pd2.profile_id = rpi.resolved_profile_id AND pd2.active = true)
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
text_agent_data AS (
    SELECT 
        pta.agent_id::text as text_agent_id
    FROM persona_text_agents pta
    WHERE pta.persona_id = $1 AND pta.active = true
    LIMIT 1
),
voice_agent_data AS (
    SELECT 
        pva.agent_id::text as voice_agent_id
    FROM persona_voice_agents pva
    WHERE pva.persona_id = $1 AND pva.active = true
    LIMIT 1
),
persona_data AS (
    SELECT 
        p.name,
        p.description,
        p.active,
        p.color,
        p.icon,
        p.instructions,
        COALESCE(tad.text_agent_id, NULL)::text as text_agent_id,
        COALESCE(vad.voice_agent_id, NULL)::text as voice_agent_id,
        COALESCE(pdd.department_ids, NULL) as department_ids
    FROM personas p
    LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
    LEFT JOIN text_agent_data tad ON true
    LEFT JOIN voice_agent_data vad ON true
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
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = rpi.resolved_profile_id AND d.active = true
),
user_departments AS (
    SELECT department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
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
    WHERE sp.persona_id = $1 AND sp.active = true
),
profile_data AS (
    SELECT role as user_role 
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
linked_parameters AS (
    -- Get parameters linked to this persona via parameter_personas junction table
    SELECT DISTINCT
        p.id as parameter_id,
        p.name as parameter_name,
        p.description as parameter_description,
    FROM parameter_personas pp
    JOIN parameters p ON p.id = pp.parameter_id
    WHERE pp.persona_id = $1
    AND pp.active = true
    AND p.active = true
),
parameter_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            lp.parameter_id::text,
            jsonb_build_object(
                'name', lp.parameter_name,
                'description', lp.parameter_description,
                'document_parameter', false,
                'persona_parameter', true
            )
        ),
        '{}'::jsonb
    ) as parameter_mapping,
    array_agg(lp.parameter_id::text ORDER BY lp.parameter_name) as parameter_ids
    FROM linked_parameters lp
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
    FROM linked_parameters lp
    JOIN parameter_fields pf ON pf.parameter_id = lp.parameter_id AND pf.active = true
    JOIN fields f ON f.id = pf.field_id AND f.active = true
    JOIN parameters p ON p.id = pf.parameter_id
    WHERE p.active = true
),
persona_field_ids AS (
    -- Get field IDs already assigned to this persona (if persona_fields table exists)
    -- Note: persona_fields table may not exist, so we return empty array for now
    -- When the table exists, this can be updated to query from it
    SELECT ARRAY[]::text[] as field_ids
)
SELECT 
    p.*,
    vd.dept_mapping,
    vd.dept_ids as valid_department_ids,
    COALESCE(va.agent_mapping, '{}'::jsonb) as agent_mapping,
    COALESCE(va.agent_ids, ARRAY[]::text[]) as valid_agent_ids,
    u.usage_count,
    pr.user_role,
    COALESCE(pmd.parameter_mapping, '{}'::jsonb) as parameter_mapping,
    COALESCE(pmd.parameter_ids, ARRAY[]::text[]) as linked_parameter_ids,
    COALESCE(fmd.field_mapping, '{}'::jsonb) as field_mapping,
    COALESCE(fmd.parameter_item_ids, ARRAY[]::text[]) as valid_parameter_item_ids,
    COALESCE(pfi.field_ids, ARRAY[]::text[]) as parameter_field_ids
FROM persona_data p
CROSS JOIN valid_depts vd
CROSS JOIN valid_agents va
CROSS JOIN usage_data u
CROSS JOIN profile_data pr
CROSS JOIN parameter_mapping_data pmd
CROSS JOIN field_mapping_data fmd
CROSS JOIN persona_field_ids pfi
