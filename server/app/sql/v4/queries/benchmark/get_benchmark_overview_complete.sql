-- Get benchmark overview with evals list (no attempts - use history endpoint)
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_benchmark_overview_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_benchmark_overview_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_benchmark_overview_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_benchmark_overview_v4_eval AS (
    eval_id uuid,
    name text,
    description text,
    rubric_id uuid,
    agent_ids text[],
    dynamic boolean,
    rubric_name text,
    rubric_description text,
    total_runs bigint,
    completed_runs bigint,
    pending_runs bigint,
    status text,
    created_at timestamptz,
    updated_at timestamptz,
    department_ids text[],
    can_edit boolean,
    can_delete boolean
);

CREATE TYPE types.q_get_benchmark_overview_v4_rubric AS (
    rubric_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

CREATE TYPE types.q_get_benchmark_overview_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_benchmark_overview_v4_agent AS (
    agent_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_benchmark_overview_v4_standard_group AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

CREATE TYPE types.q_get_benchmark_overview_v4_standard AS (
    standard_id uuid,
    name text,
    description text,
    points int
);

CREATE TYPE types.q_get_benchmark_overview_v4_rubric_standard_group AS (
    rubric_id uuid,
    standard_group_id uuid,
    standard_ids uuid[]
);

CREATE TYPE types.q_get_benchmark_overview_v4_rubric_option AS (
    value text,
    label text
);

CREATE TYPE types.q_get_benchmark_overview_v4_department_option AS (
    value text,
    label text
);

CREATE TYPE types.q_get_benchmark_overview_v4_agent_option AS (
    value text,
    label text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_benchmark_overview_v4(
    profile_id uuid,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    eval_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    actor_name text,
    evals types.q_get_benchmark_overview_v4_eval[],
    rubrics types.q_get_benchmark_overview_v4_rubric[],
    departments types.q_get_benchmark_overview_v4_department[],
    agents types.q_get_benchmark_overview_v4_agent[],
    standard_groups types.q_get_benchmark_overview_v4_standard_group[],
    standards types.q_get_benchmark_overview_v4_standard[],
    rubric_standard_groups_junction types.q_get_benchmark_overview_v4_rubric_standard_group[],
    rubric_options types.q_get_benchmark_overview_v4_rubric_option[],
    department_options types.q_get_benchmark_overview_v4_department_option[],
    agent_options types.q_get_benchmark_overview_v4_agent_option[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(NULLIF(eval_ids, ARRAY[]::uuid[]), NULL::uuid[]) AS eval_ids
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params)::text IS NULL OR (SELECT profile_id FROM params)::text = '' THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM resolve_profile_id rpi
    JOIN profile_artifact p ON p.id = rpi.resolved_profile_id
    WHERE rpi.resolved_profile_id IS NOT NULL
),
user_departments AS (
    SELECT department_id
    FROM profile_departments_junction
    WHERE profile_id = (SELECT resolved_profile_id FROM resolve_profile_id) AND active = true
),
user_profile AS (
    SELECT role, COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
),
eval_status_summary AS (
    SELECT 
        er.eval_id,
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE er.completed = true) as completed_runs,
        COUNT(*) FILTER (WHERE er.completed = false) as pending_runs
    FROM eval_runs_junction er
    GROUP BY er.eval_id
),
eval_data AS (
    SELECT 
        e.id as eval_id,
        (SELECT n.name FROM eval_names_junction en JOIN names_resource n ON en.name_id = n.id WHERE en.eval_id = e.id LIMIT 1),
        (SELECT d.description FROM eval_descriptions_junction ed JOIN descriptions_resource d ON ed.description_id = d.id WHERE ed.eval_id = e.id LIMIT 1),
        -- Get first rubric from junction table (runs_entry or groups_entry based on use_groups)
        (SELECT combined.rubric_id 
         FROM (
             SELECT rr.rubric_id, err.created_at
             FROM eval_runs_rubrics_junction err
             JOIN run_rubrics_resource rr ON rr.id = err.run_rubric_id
             WHERE err.eval_id = e.id AND EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = 'groups_entry' AND ef.value = false)
             UNION ALL
             SELECT gr.rubric_id, egr.created_at
             FROM eval_groups_rubrics_junction egr
             JOIN group_rubrics_resource gr ON gr.id = egr.group_rubric_id
             WHERE egr.eval_id = e.id AND EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = 'groups_entry' AND ef.value = true)
         ) combined
         ORDER BY combined.created_at 
         LIMIT 1) as rubric_id,
        EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = 'dynamic' AND ef.value = TRUE) as dynamic,
        e.created_at,
        e.updated_at,
        (SELECT (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1) 
         FROM (
             SELECT rr.rubric_id, err.created_at
             FROM eval_runs_rubrics_junction err
             JOIN run_rubrics_resource rr ON rr.id = err.run_rubric_id
             WHERE err.eval_id = e.id AND EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = 'groups_entry' AND ef.value = false)
             UNION ALL
             SELECT gr.rubric_id, egr.created_at
             FROM eval_groups_rubrics_junction egr
             JOIN group_rubrics_resource gr ON gr.id = egr.group_rubric_id
             WHERE egr.eval_id = e.id AND EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = 'groups_entry' AND ef.value = true)
         ) combined
         JOIN rubrics_resource r ON r.id = combined.rubric_id
         ORDER BY combined.created_at 
         LIMIT 1) as rubric_name,
        (SELECT (SELECT d.description FROM rubric_descriptions_junction rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1) 
         FROM (
             SELECT rr.rubric_id, err.created_at
             FROM eval_runs_rubrics_junction err
             JOIN run_rubrics_resource rr ON rr.id = err.run_rubric_id
             WHERE err.eval_id = e.id AND EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = 'groups_entry' AND ef.value = false)
             UNION ALL
             SELECT gr.rubric_id, egr.created_at
             FROM eval_groups_rubrics_junction egr
             JOIN group_rubrics_resource gr ON gr.id = egr.group_rubric_id
             WHERE egr.eval_id = e.id AND EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = 'groups_entry' AND ef.value = true)
         ) combined
         JOIN rubrics_resource r ON r.id = combined.rubric_id
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
    FROM eval_artifact e
    LEFT JOIN eval_status_summary ess ON ess.eval_id = e.id
),
rubric_departments_data AS (
    SELECT 
        rd.rubric_id,
        ARRAY_AGG(rd.department_id::text ORDER BY rd.created_at) as department_ids
    FROM rubric_departments_junction rd
    WHERE rd.active = true
    GROUP BY rd.rubric_id
),
eval_departments_junction AS (
    SELECT 
        ed.eval_id,
        rdd.department_ids
    FROM eval_data ed
    LEFT JOIN rubric_departments_data rdd ON rdd.rubric_id = ed.rubric_id
),
filtered_evals AS (
    SELECT 
        ed.*,
        edept.department_ids,
        CASE 
            WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN true
            ELSE false
        END as can_delete
    FROM eval_data ed
    LEFT JOIN eval_departments_junction edept ON edept.eval_id = ed.eval_id
    CROSS JOIN user_profile up
    CROSS JOIN params p
    WHERE 
        -- Filter by eval_ids if provided
        (p.eval_ids IS NULL OR p.eval_ids = ARRAY[]::uuid[] OR ed.eval_id = ANY(p.eval_ids))
        -- Filter by department_ids if provided (like practice overview)
        AND (
            cardinality(p.department_ids) = 0
            OR edept.department_ids IS NULL 
            OR array_length(edept.department_ids, 1) IS NULL
            OR EXISTS (
                SELECT 1 FROM unnest(p.department_ids) dept_id
                WHERE dept_id::text = ANY(edept.department_ids)
            )
        )
        -- Filter by department access (if rubric has departments, user must have access)
        AND (
            edept.department_ids IS NULL 
            OR array_length(edept.department_ids, 1) IS NULL
            OR EXISTS (
                SELECT 1 FROM user_departments ud
                WHERE ud.department_id::text = ANY(edept.department_ids)
            )
            OR up.role IN ('admin'::profile_type, 'superadmin'::profile_type)
        )
),
all_rubric_ids AS (
    SELECT DISTINCT rubric_id FROM filtered_evals
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids) as department_id
    FROM eval_departments_junction
    WHERE department_ids IS NOT NULL
),
all_agent_ids AS (
    SELECT DISTINCT ea.agent_id::uuid as agent_id
    FROM filtered_evals fe
    JOIN eval_agents_junction ea ON ea.eval_id = fe.eval_id
),
eval_agents_aggregated AS (
    SELECT 
        ea.eval_id,
        ARRAY_AGG(ea.agent_id::text ORDER BY ea.created_at) as agent_ids
    FROM eval_agents_junction ea
    WHERE ea.eval_id IN (SELECT eval_id FROM filtered_evals)
    GROUP BY ea.eval_id
),
-- Build composite type arrays for evals
evals_array AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (fe.eval_id, fe.name, fe.description, fe.rubric_id, COALESCE(eaa.agent_ids, ARRAY[]::text[]), fe.dynamic,
             fe.rubric_name, fe.rubric_description, fe.total_runs, fe.completed_runs, fe.pending_runs,
             fe.status, fe.created_at, fe.updated_at,
             COALESCE(fe.department_ids, ARRAY[]::text[]),
             fe.can_edit, fe.can_delete
            )::types.q_get_benchmark_overview_v4_eval
            ORDER BY fe.updated_at DESC NULLS LAST
        ),
        '{}'::types.q_get_benchmark_overview_v4_eval[]
    ) as evals
    FROM filtered_evals fe
    LEFT JOIN eval_agents_aggregated eaa ON eaa.eval_id = fe.eval_id
),
-- Build composite type arrays for rubrics
rubrics_array AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (r.id, (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1), COALESCE((SELECT d.description FROM rubric_descriptions_junction rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1), ''), (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON p.id = rp.point_id WHERE rp.rubric_id = r.id AND rp.type = 'total'::point_type LIMIT 1), (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON p.id = rp.point_id WHERE rp.rubric_id = r.id AND rp.type = 'pass'::point_type LIMIT 1)
            )::types.q_get_benchmark_overview_v4_rubric
            ORDER BY (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1)
        ),
        '{}'::types.q_get_benchmark_overview_v4_rubric[]
    ) as rubrics
    FROM all_rubric_ids ari
    LEFT JOIN rubrics_resource r ON r.id = ari.rubric_id
    WHERE r.id IS NOT NULL
),
-- Build composite type arrays for departments
departments_array AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (d.id, (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1), COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '')
            )::types.q_get_benchmark_overview_v4_department
            ORDER BY (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1)
        ),
        '{}'::types.q_get_benchmark_overview_v4_department[]
    ) as departments
    FROM all_department_ids adi
    LEFT JOIN departments_resource d ON d.id::text = adi.department_id
    WHERE EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true) AND d.id IS NOT NULL
),
-- Build composite type arrays for agents
agents_array AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (a.id, (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), COALESCE((SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions_junction ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1), '')
            )::types.q_get_benchmark_overview_v4_agent
            ORDER BY (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1)
        ),
        '{}'::types.q_get_benchmark_overview_v4_agent[]
    ) as agents
    FROM all_agent_ids aai
    LEFT JOIN agents_resource a ON a.id = aai.agent_id
    WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true) AND a.id IS NOT NULL
),
-- Build composite type arrays for standard groups_entry
standard_groups_array AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (sg.id, sg.name, sg.description, sg.points, sg.pass_points
            )::types.q_get_benchmark_overview_v4_standard_group
            ORDER BY sg.name
        ),
        '{}'::types.q_get_benchmark_overview_v4_standard_group[]
    ) as standard_groups
    FROM rubric_standard_groups_junction rsg
    JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
      AND rsg.active = true
),
-- Build composite type arrays for standards
standards_array AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (st.id, st.name, st.description, st.points
            )::types.q_get_benchmark_overview_v4_standard
            ORDER BY st.name
        ),
        '{}'::types.q_get_benchmark_overview_v4_standard[]
    ) as standards
    FROM standards_resource st
    WHERE st.standard_group_id IN (
        SELECT rsg.standard_group_id FROM rubric_standard_groups_junction rsg
        WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
          AND rsg.active = true
    )
),
-- Build standard_ids per standard_group first
standard_group_standards AS (
    SELECT 
        rsg.standard_group_id,
        rsg.rubric_id,
        COALESCE(
            ARRAY_AGG(st.id ORDER BY st.id) FILTER (WHERE st.id IS NOT NULL),
            ARRAY[]::uuid[]
        ) as standard_ids
    FROM rubric_standard_groups_junction rsg
    JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id
    LEFT JOIN standards_resource st ON st.standard_group_id = sg.id
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
      AND rsg.active = true
    GROUP BY rsg.standard_group_id, rsg.rubric_id
),
-- Build composite type arrays for rubric-standard group relationships
rubric_standard_groups_array AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (sgs.rubric_id, sgs.standard_group_id, sgs.standard_ids
            )::types.q_get_benchmark_overview_v4_rubric_standard_group
            ORDER BY sgs.rubric_id, sgs.standard_group_id
        ),
        '{}'::types.q_get_benchmark_overview_v4_rubric_standard_group[]
    ) as rubric_standard_groups_junction
    FROM standard_group_standards sgs
),
-- Build options arrays (for facets)
rubric_options_array AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (r.id::text, (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1)
            )::types.q_get_benchmark_overview_v4_rubric_option
            ORDER BY (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1)
        ),
        '{}'::types.q_get_benchmark_overview_v4_rubric_option[]
    ) as rubric_options
    FROM all_rubric_ids ari
    LEFT JOIN rubrics_resource r ON r.id = ari.rubric_id
    WHERE r.id IS NOT NULL
),
-- Collect all department IDs actually assigned to evals
assigned_department_ids AS (
    SELECT DISTINCT unnest(department_ids) as department_id
    FROM filtered_evals
    WHERE department_ids IS NOT NULL
),
department_options_array AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (d.id::text, (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1)
            )::types.q_get_benchmark_overview_v4_department_option
            ORDER BY (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1)
        ),
        '{}'::types.q_get_benchmark_overview_v4_department_option[]
    ) as department_options
    FROM assigned_department_ids adi
    LEFT JOIN departments_resource d ON d.id::text = adi.department_id
    WHERE EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true) AND d.id IS NOT NULL
),
-- Collect all agent IDs actually assigned to evals
assigned_agent_ids AS (
    SELECT DISTINCT ea.agent_id::uuid as agent_id
    FROM filtered_evals fe
    JOIN eval_agents_junction ea ON ea.eval_id = fe.eval_id
),
agent_options_array AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (a.id::text, (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1)
            )::types.q_get_benchmark_overview_v4_agent_option
            ORDER BY (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1)
        ),
        '{}'::types.q_get_benchmark_overview_v4_agent_option[]
    ) as agent_options
    FROM assigned_agent_ids aai
    LEFT JOIN agents_resource a ON a.id = aai.agent_id
    WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true) AND a.id IS NOT NULL
)
SELECT 
    (SELECT actor_name FROM actor_profile LIMIT 1)::text as actor_name,
    (SELECT evals FROM evals_array) as evals,
    (SELECT rubrics FROM rubrics_array) as rubrics,
    (SELECT departments FROM departments_array) as departments,
    (SELECT agents FROM agents_array) as agents,
    (SELECT standard_groups FROM standard_groups_array) as standard_groups,
    (SELECT standards FROM standards_array) as standards,
    (SELECT rubric_standard_groups_junction FROM rubric_standard_groups_array) as rubric_standard_groups_junction,
    (SELECT rubric_options FROM rubric_options_array) as rubric_options,
    (SELECT department_options FROM department_options_array) as department_options,
    (SELECT agent_options FROM agent_options_array) as agent_options
FROM params p
$$;
