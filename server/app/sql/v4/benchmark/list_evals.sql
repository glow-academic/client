-- List evals with status derivation from eval_runs junction table
-- Parameters: $1 = profile_id (uuid)
-- Returns: evals with derived status, rubric mapping, department mapping

WITH resolve_profile_id AS (
    -- Resolve profile ID from parameter
    SELECT 
        CASE 
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
    WHERE rpi.resolved_profile_id IS NOT NULL
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
eval_agents_data AS (
    SELECT 
        ea.eval_id,
        ARRAY_AGG(ea.agent_id::text ORDER BY ea.created_at) as agent_ids
    FROM eval_agents ea
    WHERE ea.eval_id IN (SELECT eval_id FROM eval_data)
    GROUP BY ea.eval_id
),
all_agent_ids AS (
    SELECT DISTINCT ea.agent_id::uuid as agent_id
    FROM eval_agents ea
    WHERE ea.eval_id IN (SELECT eval_id FROM eval_data)
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
),
-- Standard groups/standards for rubrics (similar to practice_overview.sql)
standard_groups_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            sg.id::text,
            jsonb_build_object(
                'name', sg.name,
                'description', sg.description,
                'points', sg.points,
                'passPoints', sg.pass_points
            )
        ) FILTER (WHERE sg.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM rubric_standard_groups rsg
    JOIN standard_groups sg ON sg.id = rsg.standard_group_id
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
      AND rsg.active = true
),
standards_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            st.id::text,
            jsonb_build_object(
                'name', st.name,
                'description', st.description,
                'points', st.points
            )
        ) FILTER (WHERE st.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM standards st
    WHERE st.standard_group_id IN (
        SELECT rsg.standard_group_id FROM rubric_standard_groups rsg
        WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
          AND rsg.active = true
    )
),
-- Map rubric_id to standard_group_ids with standard_ids per group
rubric_standard_groups_data AS (
    SELECT 
        rsg.rubric_id::text,
        jsonb_object_agg(
            rsg.standard_group_id::text,
            COALESCE(
                (SELECT jsonb_agg(st.id::text ORDER BY st.id)
                 FROM standards st
                 WHERE st.standard_group_id = rsg.standard_group_id),
                '[]'::jsonb
            )
        ) FILTER (WHERE rsg.standard_group_id IS NOT NULL) as standard_group_ids_map
    FROM rubric_standard_groups rsg
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
      AND rsg.active = true
    GROUP BY rsg.rubric_id
),
rubric_standard_groups_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            rubric_id,
            standard_group_ids_map
        ),
        '{}'::jsonb
    ) as mapping
    FROM rubric_standard_groups_data
)
SELECT 
    ed.eval_id,
    ed.name,
    ed.description,
    ed.rubric_id::text,
    COALESCE(ead.agent_ids, ARRAY[]::text[]) as agent_ids,
    ed.dynamic,
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
    sgm.mapping as standard_groups_mapping,
    sm.mapping as standards_mapping,
    rsgm.mapping as rubric_standard_groups_mapping,
    CASE 
        WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END as can_delete,
    ap.actor_name
FROM eval_data ed
LEFT JOIN eval_agents_data ead ON ead.eval_id = ed.eval_id
LEFT JOIN eval_departments edept ON edept.eval_id = ed.eval_id
CROSS JOIN user_profile up
CROSS JOIN actor_profile ap
CROSS JOIN rubric_mapping_data rm
CROSS JOIN department_mapping_data dm
CROSS JOIN agent_mapping_data am
CROSS JOIN standard_groups_mapping_data sgm
CROSS JOIN standards_mapping_data sm
CROSS JOIN rubric_standard_groups_mapping rsgm
WHERE 
    -- Filter by department access (if rubric has departments, user must have access)
    (
        edept.department_ids IS NULL 
        OR array_length(edept.department_ids, 1) IS NULL
        OR EXISTS (
            SELECT 1 FROM user_departments ud
            WHERE ud.department_id::text = ANY(edept.department_ids)
        )
        OR up.role IN ('admin'::profile_role, 'superadmin'::profile_role)
    )
ORDER BY ed.updated_at DESC NULLS LAST

