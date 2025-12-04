-- Get eval detail with status breakdown and runs list
-- Parameters: $1 = eval_id (uuid), $2 = profile_id (uuid or "guest-profile-id")
-- Returns: eval details with status breakdown and runs

WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN settings_departments sd ON sd.settings_id = s.id AND sd.active = true
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
user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = (SELECT resolved_profile_id FROM resolve_profile_id) AND active = true
),
eval_data AS (
    SELECT 
        e.id as eval_id,
        e.name,
        e.description,
        e.rubric_id,
        e.eval_agent_id::text,
        e.created_at,
        e.updated_at,
        r.name as rubric_name,
        r.description as rubric_description,
        r.points as rubric_points,
        r.pass_points as rubric_pass_points
    FROM evals e
    JOIN rubrics r ON r.id = e.rubric_id
    WHERE e.id = $1
),
rubric_departments_data AS (
    SELECT 
        rd.rubric_id,
        ARRAY_AGG(rd.department_id::text ORDER BY rd.created_at) as department_ids
    FROM rubric_departments rd
    WHERE rd.rubric_id = (SELECT rubric_id FROM eval_data) AND rd.active = true
    GROUP BY rd.rubric_id
),
eval_status_summary AS (
    SELECT 
        er.eval_id,
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE er.completed = true) as completed_runs,
        COUNT(*) FILTER (WHERE er.completed = false) as pending_runs
    FROM eval_runs er
    WHERE er.eval_id = $1
    GROUP BY er.eval_id
),
runs_list AS (
    SELECT 
        er.run_id::text,
        er.completed,
        er.created_at as assigned_at,
        er.updated_at as status_updated_at,
        r.created_at as run_created_at,
        -- Get model info
        rm.model_id::text as model_id,
        m.name as model_name,
        -- Get agent/persona info
        r.agent_id::text as agent_id,
        a.name as agent_name,
        rper.persona_id::text as persona_id,
        per.name as persona_name,
        -- Get profile info
        rp.profile_id::text as profile_id,
        p.first_name || ' ' || p.last_name as profile_name,
        -- Check if grade exists
        CASE WHEN g.id IS NOT NULL THEN true ELSE false END as has_grade,
        g.score as grade_score,
        g.passed as grade_passed,
        g.created_at as grade_created_at
    FROM eval_runs er
    JOIN runs r ON r.id = er.run_id
    LEFT JOIN run_models rm ON rm.run_id = r.id AND rm.active = true
    LEFT JOIN models m ON m.id = rm.model_id
    LEFT JOIN agents a ON a.id = r.agent_id
    LEFT JOIN run_personas rper ON rper.run_id = r.id AND rper.active = true
    LEFT JOIN personas per ON per.id = rper.persona_id
    LEFT JOIN run_profiles rp ON rp.run_id = r.id AND rp.active = true
    LEFT JOIN profiles p ON p.id = rp.profile_id
    LEFT JOIN grades g ON g.run_id = er.run_id AND g.eval_id = er.eval_id AND g.eval = true
    WHERE er.eval_id = $1
    ORDER BY er.created_at DESC
),
runs_json AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'run_id', run_id,
                'completed', completed,
                'assigned_at', assigned_at,
                'status_updated_at', status_updated_at,
                'model_run_created_at', model_run_created_at,
                'model_id', model_id,
                'model_name', model_name,
                'agent_id', agent_id,
                'agent_name', agent_name,
                'persona_id', persona_id,
                'persona_name', persona_name,
                'profile_id', profile_id,
                'profile_name', profile_name,
                'has_grade', has_grade,
                'grade_score', grade_score,
                'grade_passed', grade_passed,
                'grade_created_at', grade_created_at
            ) ORDER BY assigned_at DESC
        ),
        '[]'::jsonb
    ) as runs
    FROM runs_list
),
user_profile AS (
    SELECT role FROM profiles WHERE id = (SELECT resolved_profile_id FROM resolve_profile_id)
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
    FROM rubric_departments_data rdd
    LEFT JOIN departments d ON d.id::text = ANY(rdd.department_ids)
    WHERE d.active = true
),
user_departments_for_agents AS (
    SELECT department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
valid_agents AS (
    -- Get agents with role 'eval'
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
    AND a.role = 'eval'
    GROUP BY a.id
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
)
SELECT 
    ed.eval_id::text,
    ed.name,
    ed.description,
    ed.rubric_id::text,
    ed.eval_agent_id,
    ed.rubric_name,
    ed.rubric_description,
    ed.rubric_points,
    ed.rubric_pass_points,
    ed.created_at,
    ed.updated_at,
    COALESCE(rdd.department_ids, NULL) as department_ids,
    COALESCE(ess.total_runs, 0) as total_runs,
    COALESCE(ess.completed_runs, 0) as completed_runs,
    COALESCE(ess.pending_runs, 0) as pending_runs,
    CASE 
        WHEN ess.total_runs IS NULL OR ess.total_runs = 0 THEN 'pending'
        WHEN ess.pending_runs > 0 THEN 'running'
        WHEN ess.completed_runs = ess.total_runs THEN 'completed'
        ELSE 'pending'
    END as status,
    rj.runs,
    dm.mapping as department_mapping,
    COALESCE(va.agent_mapping, '{}'::jsonb) as agent_mapping,
    COALESCE(va.agent_ids, ARRAY[]::text[]) as valid_agent_ids,
    CASE 
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_delete
FROM eval_data ed
LEFT JOIN rubric_departments_data rdd ON rdd.rubric_id = ed.rubric_id
LEFT JOIN eval_status_summary ess ON ess.eval_id = ed.eval_id
CROSS JOIN runs_json rj
CROSS JOIN user_profile up
CROSS JOIN department_mapping_data dm
CROSS JOIN valid_agents va
WHERE 
    -- Filter by department access (if rubric has departments, user must have access)
    (
        rdd.department_ids IS NULL 
        OR array_length(rdd.department_ids, 1) IS NULL
        OR EXISTS (
            SELECT 1 FROM user_departments ud
            WHERE ud.department_id::text = ANY(rdd.department_ids)
        )
        OR up.role IN ('admin', 'superadmin')
    )

