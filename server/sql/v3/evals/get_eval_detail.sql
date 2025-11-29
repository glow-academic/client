-- Get eval detail with status breakdown and model_runs list
-- Parameters: $1 = eval_id (uuid), $2 = profile_id (uuid or "guest-profile-id")
-- Returns: eval details with status breakdown and model_runs

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
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
        emr.eval_id,
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE emr.completed = true) as completed_runs,
        COUNT(*) FILTER (WHERE emr.completed = false) as pending_runs
    FROM eval_model_runs emr
    WHERE emr.eval_id = $1
    GROUP BY emr.eval_id
),
model_runs_list AS (
    SELECT 
        emr.model_run_id::text,
        emr.completed,
        emr.created_at as assigned_at,
        emr.updated_at as status_updated_at,
        mr.created_at as model_run_created_at,
        -- Get model info
        mrm.model_id::text as model_id,
        m.name as model_name,
        -- Get agent/persona info
        mra.agent_id::text as agent_id,
        a.name as agent_name,
        mrper.persona_id::text as persona_id,
        per.name as persona_name,
        -- Get profile info
        mrp.profile_id::text as profile_id,
        p.first_name || ' ' || p.last_name as profile_name,
        -- Check if grade exists
        CASE WHEN eg.id IS NOT NULL THEN true ELSE false END as has_grade,
        eg.score as grade_score,
        eg.passed as grade_passed,
        eg.created_at as grade_created_at
    FROM eval_model_runs emr
    JOIN model_runs mr ON mr.id = emr.model_run_id
    LEFT JOIN model_run_models mrm ON mrm.model_run_id = mr.id AND mrm.active = true
    LEFT JOIN models m ON m.id = mrm.model_id
    LEFT JOIN model_run_agents mra ON mra.model_run_id = mr.id AND mra.active = true
    LEFT JOIN agents a ON a.id = mra.agent_id
    LEFT JOIN model_run_personas mrper ON mrper.model_run_id = mr.id AND mrper.active = true
    LEFT JOIN personas per ON per.id = mrper.persona_id
    LEFT JOIN model_run_profiles mrp ON mrp.model_run_id = mr.id AND mrp.active = true
    LEFT JOIN profiles p ON p.id = mrp.profile_id
    LEFT JOIN eval_grades eg ON eg.model_run_id = emr.model_run_id AND eg.eval_id = emr.eval_id
    WHERE emr.eval_id = $1
    ORDER BY emr.created_at DESC
),
model_runs_json AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'model_run_id', model_run_id,
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
    ) as model_runs
    FROM model_runs_list
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
)
SELECT 
    ed.eval_id::text,
    ed.name,
    ed.description,
    ed.rubric_id::text,
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
    mrl.model_runs,
    dm.mapping as department_mapping,
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
CROSS JOIN model_runs_json mrl
CROSS JOIN user_profile up
CROSS JOIN department_mapping_data dm
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

