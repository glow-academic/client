-- Get evals list with status derivation from eval_runs junction table
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_list_evals_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_evals_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_list_evals_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_list_evals_v3_eval AS (
    eval_id uuid,
    name text,
    description text,
    agent_id uuid,
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

CREATE TYPE types.q_list_evals_v3_rubric AS (
    rubric_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

CREATE TYPE types.q_list_evals_v3_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_evals_v3_agent AS (
    agent_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_evals_v3_standard_group AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

CREATE TYPE types.q_list_evals_v3_standard AS (
    standard_id uuid,
    name text,
    description text,
    points int
);

CREATE TYPE types.q_list_evals_v3_rubric_standard_group AS (
    rubric_id uuid,
    standard_group_id uuid,
    standard_ids uuid[]
);

CREATE TYPE types.q_list_evals_v3_option AS (
    value text,
    label text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_evals_v3(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    evals types.q_list_evals_v3_eval[],
    rubrics types.q_list_evals_v3_rubric[],
    departments types.q_list_evals_v3_department[],
    agents types.q_list_evals_v3_agent[],
    standard_groups types.q_list_evals_v3_standard_group[],
    standards types.q_list_evals_v3_standard[],
    rubric_standard_groups types.q_list_evals_v3_rubric_standard_group[],
    rubric_options types.q_list_evals_v3_option[],
    department_options types.q_list_evals_v3_option[],
    agent_options types.q_list_evals_v3_option[]
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
    JOIN profile_departments ON profile_departments.profile_id = x.profile_id AND profile_departments.active = true
),
user_profile AS (
    SELECT 
        role,
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
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
        e.agent_id,
        e.use_groups,
        e.dynamic,
        e.created_at,
        e.updated_at,
        -- Get first rubric from junction table for display (from runs or groups based on use_groups)
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
        COALESCE(rdd.department_ids, ARRAY[]::text[]) as department_ids
    FROM eval_data ed
    LEFT JOIN rubric_departments_data rdd ON rdd.rubric_id = ed.rubric_id
),
filtered_evals AS (
    SELECT 
        ed.*,
        edept.department_ids
    FROM eval_data ed
    LEFT JOIN eval_departments edept ON edept.eval_id = ed.eval_id
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
            OR up.role IN ('admin', 'superadmin')
        )
),
evals_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (fe.eval_id, fe.name, fe.description, fe.agent_id, fe.use_groups,
             fe.rubric_id, fe.rubric_name, fe.rubric_description, fe.total_runs, fe.completed_runs,
             fe.pending_runs, fe.status, fe.created_at, fe.updated_at,
             fe.department_ids,
             CASE WHEN (SELECT role FROM user_profile) IN ('admin', 'instructional', 'superadmin') THEN true ELSE false END,
             CASE WHEN (SELECT role FROM user_profile) IN ('admin', 'instructional', 'superadmin') THEN true ELSE false END
            )::types.q_list_evals_v3_eval
            ORDER BY fe.updated_at DESC NULLS LAST
        ) as evals_array
    FROM filtered_evals fe
),
all_rubric_ids AS (
    SELECT DISTINCT rga.rubric_id 
    FROM filtered_evals fe
    LEFT JOIN eval_runs_rubric_grade_agents errga ON errga.eval_id = fe.eval_id AND fe.use_groups = false
    LEFT JOIN eval_groups_rubric_grade_agents egga ON egga.eval_id = fe.eval_id AND fe.use_groups = true
    JOIN rubric_grade_agents rga ON rga.id = COALESCE(errga.rubric_grade_agent_id, egga.rubric_grade_agent_id)
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids) as department_id
    FROM eval_departments
    WHERE department_ids IS NOT NULL AND array_length(department_ids, 1) > 0
),
all_agent_ids AS (
    SELECT DISTINCT agent_id
    FROM filtered_evals
    WHERE agent_id IS NOT NULL
),
all_standard_group_ids AS (
    SELECT DISTINCT rsg.standard_group_id
    FROM rubric_standard_groups rsg
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
      AND rsg.active = true
),
all_standard_ids AS (
    SELECT DISTINCT st.id as standard_id
    FROM standards st
    WHERE st.standard_group_id IN (
        SELECT standard_group_id FROM all_standard_group_ids
    )
)
SELECT 
    up.actor_name::text as actor_name,
    -- Evals array
    COALESCE(ea.evals_array, '{}'::types.q_list_evals_v3_eval[]) as evals,
    -- Rubrics array
    COALESCE(
        (SELECT ARRAY_AGG((r.id, r.name, COALESCE(r.description, ''), r.points, r.pass_points)::types.q_list_evals_v3_rubric)
         FROM all_rubric_ids ari
         JOIN rubrics r ON r.id = ari.rubric_id),
        '{}'::types.q_list_evals_v3_rubric[]
    ) as rubrics,
    -- Departments array
    COALESCE(
        (SELECT ARRAY_AGG((d.id, d.title, COALESCE(d.description, ''))::types.q_list_evals_v3_department)
         FROM all_department_ids adi
         JOIN departments d ON d.id::text = adi.department_id
         WHERE d.active = true),
        '{}'::types.q_list_evals_v3_department[]
    ) as departments,
    -- Agents array
    COALESCE(
        (SELECT ARRAY_AGG((a.id, a.name, COALESCE(a.description, ''))::types.q_list_evals_v3_agent)
         FROM all_agent_ids aai
         JOIN agents a ON a.id = aai.agent_id
         WHERE a.active = true),
        '{}'::types.q_list_evals_v3_agent[]
    ) as agents,
    -- Standard groups array
    COALESCE(
        (SELECT ARRAY_AGG((sg.id, sg.name, sg.description, sg.points, sg.pass_points)::types.q_list_evals_v3_standard_group)
         FROM all_standard_group_ids asgi
         JOIN standard_groups sg ON sg.id = asgi.standard_group_id),
        '{}'::types.q_list_evals_v3_standard_group[]
    ) as standard_groups,
    -- Standards array
    COALESCE(
        (SELECT ARRAY_AGG((st.id, st.name, st.description, st.points)::types.q_list_evals_v3_standard)
         FROM all_standard_ids asi
         JOIN standards st ON st.id = asi.standard_id),
        '{}'::types.q_list_evals_v3_standard[]
    ) as standards,
    -- Rubric standard groups array (mapping structure)
    COALESCE(
        (SELECT ARRAY_AGG(
            (rsg.rubric_id, rsg.standard_group_id,
             COALESCE(
                 (SELECT ARRAY_AGG(st.id)
                  FROM standards st
                  WHERE st.standard_group_id = rsg.standard_group_id),
                 ARRAY[]::uuid[]
             )
            )::types.q_list_evals_v3_rubric_standard_group
         )
         FROM all_standard_group_ids asgi
         JOIN rubric_standard_groups rsg ON rsg.standard_group_id = asgi.standard_group_id AND rsg.active = true),
        '{}'::types.q_list_evals_v3_rubric_standard_group[]
    ) as rubric_standard_groups,
    -- Rubric options array
    COALESCE(
        (SELECT ARRAY_AGG((r.id::text, r.name)::types.q_list_evals_v3_option)
         FROM all_rubric_ids ari
         JOIN rubrics r ON r.id = ari.rubric_id),
        '{}'::types.q_list_evals_v3_option[]
    ) as rubric_options,
    -- Department options array (only departments assigned to evals)
    COALESCE(
        (SELECT ARRAY_AGG((d.id::text, d.title)::types.q_list_evals_v3_option)
         FROM all_department_ids adi
         JOIN departments d ON d.id::text = adi.department_id
         WHERE d.active = true),
        '{}'::types.q_list_evals_v3_option[]
    ) as department_options,
    -- Agent options array (only agents assigned to evals)
    COALESCE(
        (SELECT ARRAY_AGG((a.id::text, a.name)::types.q_list_evals_v3_option)
         FROM all_agent_ids aai
         JOIN agents a ON a.id = aai.agent_id
         WHERE a.active = true),
        '{}'::types.q_list_evals_v3_option[]
    ) as agent_options
FROM user_profile up
CROSS JOIN evals_aggregated ea
$$;

COMMIT;

