-- Get evals list with status derivation from eval_runs_junction junction table
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
        WHERE proname = 'api_list_evals_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_evals_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_list_evals_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_list_evals_v4_eval AS (
    eval_id uuid,
    name text,
    description text,
    agent_ids text[],
    use_groups boolean,
    rubric_id uuid,
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

CREATE TYPE types.q_list_evals_v4_rubric AS (
    rubric_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

CREATE TYPE types.q_list_evals_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_evals_v4_agent AS (
    agent_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_evals_v4_standard_group AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

CREATE TYPE types.q_list_evals_v4_standard AS (
    standard_id uuid,
    name text,
    description text,
    points int
);

CREATE TYPE types.q_list_evals_v4_rubric_standard_group AS (
    rubric_id uuid,
    standard_group_id uuid,
    standard_ids uuid[]
);

CREATE TYPE types.q_list_evals_v4_option AS (
    value text,
    label text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_evals_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    evals types.q_list_evals_v4_eval[],
    rubrics types.q_list_evals_v4_rubric[],
    departments types.q_list_evals_v4_department[],
    agents types.q_list_evals_v4_agent[],
    standard_groups types.q_list_evals_v4_standard_group[],
    standards types.q_list_evals_v4_standard[],
    rubric_standard_groups_junction types.q_list_evals_v4_rubric_standard_group[],
    rubric_options types.q_list_evals_v4_option[],
    department_options types.q_list_evals_v4_option[],
    agent_options types.q_list_evals_v4_option[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments_junction ON profile_departments_junction.profile_id = x.profile_id AND profile_departments_junction.active = true
),
user_profile AS (
    SELECT role, COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
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
        EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = '' AND ef.value = TRUE) as use_groups,
        EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = 'dynamic' AND ef.value = TRUE),
        e.created_at,
        e.updated_at,
        -- Get first rubric from direct rubric links (FROM view_runs_entry or view_groups_entry based on use_groups)
        (SELECT combined.rubric_id 
         FROM (
             SELECT rr.rubric_id, err.created_at
             FROM eval_runs_rubrics_junction err
             JOIN run_rubrics_resource rr ON rr.id = err.run_rubric_id
             WHERE err.eval_id = e.id AND EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = '' AND ef.value = false)
             UNION ALL
             SELECT gr.rubric_id, egr.created_at
             FROM eval_groups_rubrics_junction egr
             JOIN group_rubrics_resource gr ON gr.id = egr.group_rubric_id
             WHERE egr.eval_id = e.id AND EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = '' AND ef.value = true)
         ) combined
         ORDER BY combined.created_at 
         LIMIT 1) as rubric_id,
        (SELECT (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1) 
         FROM (
             SELECT rr.rubric_id, err.created_at
             FROM eval_runs_rubrics_junction err
             JOIN run_rubrics_resource rr ON rr.id = err.run_rubric_id
             WHERE err.eval_id = e.id AND EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = '' AND ef.value = false)
             UNION ALL
             SELECT gr.rubric_id, egr.created_at
             FROM eval_groups_rubrics_junction egr
             JOIN group_rubrics_resource gr ON gr.id = egr.group_rubric_id
             WHERE egr.eval_id = e.id AND EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = '' AND ef.value = true)
         ) combined
         JOIN rubrics_resource r ON r.id = combined.rubric_id
         ORDER BY combined.created_at 
         LIMIT 1) as rubric_name,
        (SELECT (SELECT d.description FROM rubric_descriptions_junction rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1) 
         FROM (
             SELECT rr.rubric_id, err.created_at
             FROM eval_runs_rubrics_junction err
             JOIN run_rubrics_resource rr ON rr.id = err.run_rubric_id
             WHERE err.eval_id = e.id AND EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = '' AND ef.value = false)
             UNION ALL
             SELECT gr.rubric_id, egr.created_at
             FROM eval_groups_rubrics_junction egr
             JOIN group_rubrics_resource gr ON gr.id = egr.group_rubric_id
             WHERE egr.eval_id = e.id AND EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = '' AND ef.value = true)
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
        COALESCE(rdd.department_ids, ARRAY[]::text[]) as department_ids
    FROM eval_data ed
    LEFT JOIN rubric_departments_data rdd ON rdd.rubric_id = ed.rubric_id
),
filtered_evals AS (
    SELECT 
        ed.*,
        edept.department_ids
    FROM eval_data ed
    LEFT JOIN eval_departments_junction edept ON edept.eval_id = ed.eval_id
    CROSS JOIN user_profile up
    WHERE 
        -- Filter by department access (if rubric has departments, user must have access)
        (
            edept.department_ids IS NULL 
            OR array_length(edept.department_ids, 1) IS NULL
            OR EXISTS (
                SELECT 1 FROM user_departments ud
                WHERE ud.department_id::text = ANY(edept.department_ids)
            )
            OR up.role IN ('admin'::profile_type, 'superadmin'::profile_type)
        )
),
eval_agents_aggregated AS (
    SELECT 
        ea.eval_id,
        ARRAY_AGG(ea.agent_id::text ORDER BY ea.created_at) as agent_ids
    FROM eval_agents_junction ea
    WHERE ea.eval_id IN (SELECT eval_id FROM filtered_evals)
    GROUP BY ea.eval_id
),
evals_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (fe.eval_id, fe.name, fe.description, COALESCE(eaa.agent_ids, ARRAY[]::text[]), fe.use_groups,
             fe.rubric_id, fe.rubric_name, fe.rubric_description, fe.total_runs, fe.completed_runs,
             fe.pending_runs, fe.status, fe.created_at, fe.updated_at,
             fe.department_ids,
             CASE WHEN (SELECT role FROM user_profile) IN ('admin', 'instructional', 'superadmin') THEN true ELSE false END,
             CASE WHEN (SELECT role FROM user_profile) IN ('admin', 'instructional', 'superadmin') THEN true ELSE false END
            )::types.q_list_evals_v4_eval
            ORDER BY fe.updated_at DESC NULLS LAST
        ) as evals_array
    FROM filtered_evals fe
    LEFT JOIN eval_agents_aggregated eaa ON eaa.eval_id = fe.eval_id
),
all_rubric_ids AS (
    SELECT DISTINCT COALESCE(rr.rubric_id, gr.rubric_id) as rubric_id
    FROM filtered_evals fe
    LEFT JOIN eval_runs_rubrics_junction err ON err.eval_id = fe.eval_id AND fe.use_groups = false
    LEFT JOIN run_rubrics_resource rr ON rr.id = err.run_rubric_id
    LEFT JOIN eval_groups_rubrics_junction egr ON egr.eval_id = fe.eval_id AND fe.use_groups = true
    LEFT JOIN group_rubrics_resource gr ON gr.id = egr.group_rubric_id
    WHERE COALESCE(rr.rubric_id, gr.rubric_id) IS NOT NULL
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids) as department_id
    FROM eval_departments_junction
    WHERE department_ids IS NOT NULL AND array_length(department_ids, 1) > 0
),
all_agent_ids AS (
    SELECT DISTINCT agent_id
    FROM eval_agents_junction ea
    JOIN filtered_evals fe ON fe.eval_id = ea.eval_id
    WHERE agent_id IS NOT NULL
),
all_standard_group_ids AS (
    SELECT DISTINCT rsg.standard_group_id
    FROM rubric_standard_groups_junction rsg
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
      AND rsg.active = true
),
all_standard_ids AS (
    SELECT DISTINCT st.id as standard_id
    FROM standards_resource st
    WHERE st.standard_group_id IN (
        SELECT standard_group_id FROM all_standard_group_ids
    )
)
SELECT 
    up.actor_name::text as actor_name,
    -- Evals array
    COALESCE(ea.evals_array, '{}'::types.q_list_evals_v4_eval[]) as evals,
    -- Rubrics array
    COALESCE(
        (SELECT ARRAY_AGG((r.id, (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1), COALESCE((SELECT d.description FROM rubric_descriptions_junction rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1), ''), (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'total'::point_type LIMIT 1), (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'pass'::point_type LIMIT 1))::types.q_list_evals_v4_rubric)
         FROM all_rubric_ids ari
         JOIN rubrics_resource r ON r.id = ari.rubric_id),
        '{}'::types.q_list_evals_v4_rubric[]
    ) as rubrics,
    -- Departments array
    COALESCE(
        (SELECT ARRAY_AGG((d.id, (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1), COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), ''))::types.q_list_evals_v4_department)
         FROM all_department_ids adi
         JOIN departments_resource d ON d.id::text = adi.department_id
         WHERE EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)),
        '{}'::types.q_list_evals_v4_department[]
    ) as departments,
    -- Agents array
    COALESCE(
        (SELECT ARRAY_AGG((a.id, (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), COALESCE((SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions_junction ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE NULL::uuid = a.id LIMIT 1), ''))::types.q_list_evals_v4_agent)
         FROM all_agent_ids aai
         JOIN agents_resource a ON a.id = aai.agent_id
         WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)),
        '{}'::types.q_list_evals_v4_agent[]
    ) as agents,
    -- Standard view_groups_entry array
    COALESCE(
        (SELECT ARRAY_AGG((sg.id, sg.name, sg.description, sg.points, sg.pass_points)::types.q_list_evals_v4_standard_group)
         FROM all_standard_group_ids asgi
         JOIN standard_groups_resource sg ON sg.id = asgi.standard_group_id),
        '{}'::types.q_list_evals_v4_standard_group[]
    ) as standard_groups,
    -- Standards array
    COALESCE(
        (SELECT ARRAY_AGG((st.id, st.name, st.description, st.points)::types.q_list_evals_v4_standard)
         FROM all_standard_ids asi
         JOIN standards_resource st ON st.id = asi.standard_id),
        '{}'::types.q_list_evals_v4_standard[]
    ) as standards,
    -- Rubric standard view_groups_entry array (mapping structure)
    COALESCE(
        (SELECT ARRAY_AGG(
            (rsg.rubric_id, rsg.standard_group_id,
             COALESCE(
                 (SELECT ARRAY_AGG(st.id)
                  FROM standards_resource st
                  WHERE st.standard_group_id = rsg.standard_group_id),
                 ARRAY[]::uuid[]
             )
            )::types.q_list_evals_v4_rubric_standard_group
         )
         FROM all_standard_group_ids asgi
         JOIN rubric_standard_groups_junction rsg ON rsg.standard_group_id = asgi.standard_group_id AND rsg.active = true),
        '{}'::types.q_list_evals_v4_rubric_standard_group[]
    ) as rubric_standard_groups_junction,
    -- Rubric options array
    COALESCE(
        (SELECT ARRAY_AGG((r.id::text, (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1))::types.q_list_evals_v4_option)
         FROM all_rubric_ids ari
         JOIN rubrics_resource r ON r.id = ari.rubric_id),
        '{}'::types.q_list_evals_v4_option[]
    ) as rubric_options,
    -- Department options array (only departments assigned to evals)
    COALESCE(
        (SELECT ARRAY_AGG((d.id::text, (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1))::types.q_list_evals_v4_option)
         FROM all_department_ids adi
         JOIN departments_resource d ON d.id::text = adi.department_id
         WHERE EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)),
        '{}'::types.q_list_evals_v4_option[]
    ) as department_options,
    -- Agent options array (only agents assigned to evals)
    COALESCE(
        (SELECT ARRAY_AGG((a.id::text, (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1))::types.q_list_evals_v4_option)
         FROM all_agent_ids aai
         JOIN agents_resource a ON a.id = aai.agent_id
         WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)),
        '{}'::types.q_list_evals_v4_option[]
    ) as agent_options
FROM user_profile up
CROSS JOIN evals_aggregated ea
$$;