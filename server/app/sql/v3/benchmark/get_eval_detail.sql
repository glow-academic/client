-- Get eval detail with status breakdown and runs list
-- Parameters: $1 = eval_id (uuid), $2 = profile_id (uuid)
-- Returns: eval details with status breakdown and runs

WITH resolve_profile_id AS (
    -- Resolve profile ID from parameter
    SELECT 
        CASE 
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
        -- Get first rubric from junction table (runs or groups based on use_groups)
        (SELECT rga.rubric_id 
         FROM (
             SELECT errga.rubric_grade_agent_id, errga.created_at
             FROM eval_runs_rubric_grade_agents errga
             WHERE errga.eval_id = e.id AND e.use_groups = false
             UNION ALL
             SELECT egga.rubric_grade_agent_id, egga.created_at
             FROM eval_groups_rubric_grade_agents egga
             WHERE egga.eval_id = e.id AND e.use_groups = true
         ) combined
         JOIN rubric_grade_agents rga ON rga.id = combined.rubric_grade_agent_id
         ORDER BY combined.created_at 
         LIMIT 1) as rubric_id,
        e.eval_agent_id::text,
        e.active,
        e.dynamic,
        e.created_at,
        e.updated_at,
        (SELECT r.name 
         FROM (
             SELECT errga.rubric_grade_agent_id, errga.created_at
             FROM eval_runs_rubric_grade_agents errga
             WHERE errga.eval_id = e.id AND e.use_groups = false
             UNION ALL
             SELECT egga.rubric_grade_agent_id, egga.created_at
             FROM eval_groups_rubric_grade_agents egga
             WHERE egga.eval_id = e.id AND e.use_groups = true
         ) combined
         JOIN rubric_grade_agents rga ON rga.id = combined.rubric_grade_agent_id
         JOIN rubrics r ON r.id = rga.rubric_id
         ORDER BY combined.created_at 
         LIMIT 1) as rubric_name,
        (SELECT r.description 
         FROM (
             SELECT errga.rubric_grade_agent_id, errga.created_at
             FROM eval_runs_rubric_grade_agents errga
             WHERE errga.eval_id = e.id AND e.use_groups = false
             UNION ALL
             SELECT egga.rubric_grade_agent_id, egga.created_at
             FROM eval_groups_rubric_grade_agents egga
             WHERE egga.eval_id = e.id AND e.use_groups = true
         ) combined
         JOIN rubric_grade_agents rga ON rga.id = combined.rubric_grade_agent_id
         JOIN rubrics r ON r.id = rga.rubric_id
         ORDER BY combined.created_at 
         LIMIT 1) as rubric_description,
        (SELECT r.points 
         FROM (
             SELECT errga.rubric_grade_agent_id, errga.created_at
             FROM eval_runs_rubric_grade_agents errga
             WHERE errga.eval_id = e.id AND e.use_groups = false
             UNION ALL
             SELECT egga.rubric_grade_agent_id, egga.created_at
             FROM eval_groups_rubric_grade_agents egga
             WHERE egga.eval_id = e.id AND e.use_groups = true
         ) combined
         JOIN rubric_grade_agents rga ON rga.id = combined.rubric_grade_agent_id
         JOIN rubrics r ON r.id = rga.rubric_id
         ORDER BY combined.created_at 
         LIMIT 1) as rubric_points,
        (SELECT r.pass_points 
         FROM (
             SELECT errga.rubric_grade_agent_id, errga.created_at
             FROM eval_runs_rubric_grade_agents errga
             WHERE errga.eval_id = e.id AND e.use_groups = false
             UNION ALL
             SELECT egga.rubric_grade_agent_id, egga.created_at
             FROM eval_groups_rubric_grade_agents egga
             WHERE egga.eval_id = e.id AND e.use_groups = true
         ) combined
         JOIN rubric_grade_agents rga ON rga.id = combined.rubric_grade_agent_id
         JOIN rubrics r ON r.id = rga.rubric_id
         ORDER BY combined.created_at 
         LIMIT 1) as rubric_pass_points
    FROM evals e
    WHERE e.id = $1
),
eval_departments_data AS (
    SELECT 
        ed.eval_id,
        ARRAY_AGG(ed.department_id::text ORDER BY ed.created_at) as department_ids
    FROM eval_departments ed
    WHERE ed.eval_id = $1 AND ed.active = true
    GROUP BY ed.eval_id
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
        r.created_at as model_run_created_at,
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
    LEFT JOIN grades g ON g.run_id = er.run_id 
        AND EXISTS (
            SELECT 1 FROM test_runs tr
            JOIN tests t ON t.id = tr.test_id
            JOIN attempt_tests at ON at.test_id = t.id
            JOIN eval_attempts ea ON ea.id = at.attempt_id
            WHERE tr.run_id = g.run_id AND ea.eval_id = er.eval_id
        )
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
    SELECT 
        role,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
eval_department_mapping_data AS (
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
    FROM eval_departments_data edd
    LEFT JOIN departments d ON d.id::text = ANY(edd.department_ids)
    WHERE d.active = true
),
valid_departments_for_eval AS (
    SELECT DISTINCT d.id, d.title as name, COALESCE(d.description, '') as description
    FROM departments d
    JOIN profile_departments pd ON pd.department_id = d.id
    WHERE pd.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id) AND d.active = true
),
valid_dept_ids AS (
    SELECT ARRAY_AGG(id::text) as ids FROM valid_departments_for_eval
),
all_department_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.name,
                'description', d.description
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM valid_departments_for_eval d
),
user_departments_for_agents_eval AS (
    SELECT department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
valid_agents_for_eval AS (
    -- Get all active agents (for agent_id picker - agents being evaluated)
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
    GROUP BY a.id
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents_eval)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
user_departments_for_agents AS (
    SELECT department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
valid_agents AS (
    -- Get agents with role 'grade'
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
    AND a.role = 'grade'
    GROUP BY a.id
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
user_department_ids_for_rubrics AS (
    SELECT ARRAY_AGG(id) as ids
    FROM departments d
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id) AND d.active = true
),
eval_agents_data AS (
    SELECT 
        ea.eval_id,
        ARRAY_AGG(ea.agent_id::text ORDER BY ea.created_at) as agent_ids
    FROM eval_agents ea
    WHERE ea.eval_id = $1
    GROUP BY ea.eval_id
),
valid_rubrics_data AS (
    SELECT DISTINCT
        r.id,
        r.name,
        COALESCE(r.description, '') as description
    FROM rubrics r
    LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
    CROSS JOIN user_department_ids_for_rubrics udi
    WHERE r.active = true
      AND (
          rd.department_id = ANY(udi.ids)
          OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
      )
    -- Also include the current eval's rubric (for edit mode - ensures selected item is available)
    UNION
    SELECT DISTINCT
        r2.id,
        r2.name,
        COALESCE(r2.description, '') as description
    FROM eval_data ed
    JOIN rubrics r2 ON r2.id = ed.rubric_id
    WHERE r2.active = true
),
rubric_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            vr.id::text,
            jsonb_build_object(
                'name', vr.name,
                'description', vr.description
            )
        ),
        '{}'::jsonb
    ) as rubric_mapping,
    COALESCE(ARRAY_AGG(vr.id::text), ARRAY[]::text[]) as rubric_ids
    FROM valid_rubrics_data vr
)
SELECT 
    ed.eval_id::text,
    ed.name,
    ed.description,
    ed.rubric_id::text,
    COALESCE(ead.agent_ids, ARRAY[]::text[]) as agent_ids,
    ed.eval_agent_id,
    ed.active,
    ed.dynamic,
    ed.rubric_name,
    ed.rubric_description,
    ed.rubric_points,
    ed.rubric_pass_points,
    ed.created_at,
    ed.updated_at,
    COALESCE(edd.department_ids, NULL) as department_ids,
    COALESCE(ess.total_runs, 0) as total_runs,
    COALESCE(ess.completed_runs, 0) as completed_runs,
    COALESCE(ess.pending_runs, 0) as pending_runs,
    CASE 
        WHEN ess.total_runs IS NULL OR ess.total_runs = 0 THEN 'pending'
        WHEN ess.pending_runs > 0 THEN 'running'
        WHEN ess.completed_runs = ess.total_runs THEN 'completed'
        ELSE 'pending'
    END as status,
    rj.runs as model_runs,
    COALESCE(edm.mapping, adm.mapping, '{}'::jsonb) as department_mapping,
    COALESCE((SELECT ids FROM valid_dept_ids), ARRAY[]::text[]) as valid_department_ids,
    COALESCE(va.agent_mapping, '{}'::jsonb) as eval_agent_mapping,
    COALESCE(va.agent_ids, ARRAY[]::text[]) as valid_eval_agent_ids,
    COALESCE(vae.agent_mapping, '{}'::jsonb) as agent_mapping,
    COALESCE(vae.agent_ids, ARRAY[]::text[]) as valid_agent_ids,
    COALESCE((SELECT rubric_mapping FROM rubric_mapping_data), '{}'::jsonb) as rubric_mapping,
    COALESCE((SELECT rubric_ids FROM rubric_mapping_data), ARRAY[]::text[]) as valid_rubric_ids,
    CASE 
        WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END as can_delete,
    up.actor_name
FROM eval_data ed
LEFT JOIN eval_agents_data ead ON ead.eval_id = ed.eval_id
LEFT JOIN eval_departments_data edd ON edd.eval_id = ed.eval_id
LEFT JOIN eval_status_summary ess ON ess.eval_id = ed.eval_id
CROSS JOIN runs_json rj
CROSS JOIN user_profile up
CROSS JOIN eval_department_mapping_data edm
CROSS JOIN all_department_mapping_data adm
CROSS JOIN valid_agents va
CROSS JOIN valid_agents_for_eval vae
CROSS JOIN rubric_mapping_data
WHERE 
    -- Filter by department access (if eval has departments, user must have access)
    (
        edd.department_ids IS NULL 
        OR array_length(edd.department_ids, 1) IS NULL
        OR EXISTS (
            SELECT 1 FROM user_departments ud
            WHERE ud.department_id::text = ANY(edd.department_ids)
        )
        OR up.role IN ('admin'::profile_role, 'superadmin'::profile_role)
    )

