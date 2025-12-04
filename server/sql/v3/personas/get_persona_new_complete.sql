-- Get default persona detail for creation
-- Parameters: $1 = profile_id (uuid or "guest-profile-id")

WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN settings_departments sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $1::uuid AND sdg.active = true
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
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
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
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = rpi.resolved_profile_id AND d.active = true
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
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
primary_department_id AS (
    SELECT department_id::text
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.is_primary = TRUE
    LIMIT 1
)
SELECT 
    p.*,
    vd.dept_mapping,
    vd.dept_ids as valid_department_ids,
    COALESCE(va.agent_mapping, '{}'::jsonb) as agent_mapping,
    COALESCE(va.agent_ids, ARRAY[]::text[]) as valid_agent_ids,
    u.usage_count,
    pr.user_role,
    pdi.department_id as primary_department_id
FROM persona_data p
CROSS JOIN valid_depts vd
CROSS JOIN valid_agents va
CROSS JOIN usage_data u
CROSS JOIN profile_data pr
LEFT JOIN primary_department_id pdi ON true
