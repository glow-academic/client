-- List evals with status derivation from eval_runs junction table
-- Parameters: $1 = profile_id (uuid or "guest-profile-id")
-- Returns: evals with derived status, rubric mapping, department mapping

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
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = (SELECT resolved_profile_id FROM resolve_profile_id) AND active = true
),
eval_status_summary AS (
    SELECT 
        er.eval_id,
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE er.completed = true) as completed_runs,
        COUNT(*) FILTER (WHERE er.completed = false) as pending_runs
    FROM eval_runs er
    GROUP BY er.eval_id
),
eval_data AS (
    SELECT 
        e.id as eval_id,
        e.name,
        e.description,
        e.rubric_id,
        e.agent_id,
        e.created_at,
        e.updated_at,
        r.name as rubric_name,
        r.description as rubric_description,
        COALESCE(ess.total_runs, 0) as total_runs,
        COALESCE(ess.completed_runs, 0) as completed_runs,
        COALESCE(ess.pending_runs, 0) as pending_runs,
        CASE 
            WHEN ess.total_runs IS NULL OR ess.total_runs = 0 THEN 'pending'
            WHEN ess.pending_runs > 0 THEN 'running'
            WHEN ess.completed_runs = ess.total_runs THEN 'completed'
            ELSE 'pending'
        END as status
    FROM evals e
    JOIN rubrics r ON r.id = e.rubric_id
    LEFT JOIN eval_status_summary ess ON ess.eval_id = e.id
),
rubric_departments_data AS (
    SELECT 
        rd.rubric_id,
        ARRAY_AGG(rd.department_id::text ORDER BY rd.created_at) as department_ids
    FROM rubric_departments rd
    WHERE rd.active = true
    GROUP BY rd.rubric_id
),
eval_departments AS (
    SELECT 
        ed.eval_id,
        rdd.department_ids
    FROM eval_data ed
    LEFT JOIN rubric_departments_data rdd ON rdd.rubric_id = ed.rubric_id
),
user_profile AS (
    SELECT role FROM profiles WHERE id = (SELECT resolved_profile_id FROM resolve_profile_id)
),
all_rubric_ids AS (
    SELECT DISTINCT rubric_id FROM eval_data
),
rubric_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            r.id::text,
            jsonb_build_object(
                'name', r.name,
                'description', COALESCE(r.description, ''),
                'points', r.points,
                'pass_points', r.pass_points
            )
        ) FILTER (WHERE r.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM all_rubric_ids ari
    LEFT JOIN rubrics r ON r.id = ari.rubric_id
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids) as department_id
    FROM eval_departments
    WHERE department_ids IS NOT NULL
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
    FROM all_department_ids adi
    LEFT JOIN departments d ON d.id::text = adi.department_id
    WHERE d.active = true
),
all_agent_ids AS (
    SELECT DISTINCT agent_id::uuid as agent_id
    FROM eval_data
    WHERE agent_id IS NOT NULL
),
agent_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            a.id::text,
            jsonb_build_object(
                'name', a.name,
                'description', COALESCE(a.description, '')
            )
        ) FILTER (WHERE a.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM all_agent_ids aai
    LEFT JOIN agents a ON a.id = aai.agent_id
    WHERE a.active = true
)
SELECT 
    ed.eval_id,
    ed.name,
    ed.description,
    ed.rubric_id::text,
    ed.agent_id::text,
    ed.rubric_name,
    ed.rubric_description,
    ed.total_runs,
    ed.completed_runs,
    ed.pending_runs,
    ed.status,
    ed.created_at,
    ed.updated_at,
    edept.department_ids,
    rm.mapping as rubric_mapping,
    dm.mapping as department_mapping,
    am.mapping as agent_mapping,
    CASE 
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_delete
FROM eval_data ed
LEFT JOIN eval_departments edept ON edept.eval_id = ed.eval_id
CROSS JOIN user_profile up
CROSS JOIN rubric_mapping_data rm
CROSS JOIN department_mapping_data dm
CROSS JOIN agent_mapping_data am
WHERE 
    -- Filter by department access (if rubric has departments, user must have access)
    (
        edept.department_ids IS NULL 
        OR array_length(edept.department_ids, 1) IS NULL
        OR EXISTS (
            SELECT 1 FROM user_departments ud
            WHERE ud.department_id::text = ANY(edept.department_ids)
        )
        OR up.role IN ('admin', 'superadmin')
    )
ORDER BY ed.updated_at DESC NULLS LAST

