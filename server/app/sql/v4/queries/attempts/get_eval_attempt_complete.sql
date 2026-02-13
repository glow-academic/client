-- Get eval attempt full details with view_runs_entry and status
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
        WHERE proname = 'api_get_eval_attempt_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_eval_attempt_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_eval_attempt_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_eval_attempt_v4_run AS (
    run_id uuid,
    status text,
    test_id uuid,
    eval_run_completed boolean,
    eval_run_assigned_at timestamptz,
    eval_run_updated_at timestamptz,
    run_created_at timestamptz,
    model_id uuid,
    model_name text,
    agent_id uuid,
    agent_name text,
    persona_id uuid,
    persona_name text,
    profile_id uuid,
    profile_name text,
    grade_score int,
    grade_passed boolean,
    grade_created_at timestamptz
);

CREATE TYPE types.q_get_eval_attempt_v4_attempt AS (
    id uuid,
    created_at timestamptz,
    eval_id uuid,
    archived boolean,
    infinite_mode boolean
);

CREATE TYPE types.q_get_eval_attempt_v4_eval AS (
    eval_id uuid,
    name text,
    description text,
    agent_ids text[],
    dynamic boolean,
    rubric_id uuid,
    rubric_name text,
    rubric_description text,
    eval_agent_id uuid,
    system_prompt text
);

CREATE TYPE types.q_get_eval_attempt_v4_status_summary AS (
    not_started int,
    in_progress int,
    completed int,
    total int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_eval_attempt_v4(
    attempt_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    attempt_exists boolean,
    actor_name text,
    attempt types.q_get_eval_attempt_v4_attempt,
    eval types.q_get_eval_attempt_v4_eval,
    runs_entry types.q_get_eval_attempt_v4_run[],
    status_summary types.q_get_eval_attempt_v4_status_summary
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        attempt_id AS attempt_id,
        profile_id AS profile_id
),
actor_profile AS (
    SELECT
        p.id as profile_id,
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
attempt_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM view_benchmark_tests_entry WHERE id = (SELECT attempt_id FROM params)
    )::boolean as attempt_exists
),
attempt_data AS (
    SELECT
        ea.id,
        ea.created_at,
        eaj.evals_id as eval_id,
        ea.archived,
        ea.infinite_mode
    FROM params x
    JOIN view_benchmark_tests_entry ea ON ea.id = x.attempt_id
    JOIN benchmark_tests_evals_connection eaj ON eaj.attempt_id = ea.id
),
eval_system_prompt AS (
    SELECT ''::text as system_prompt
),
eval_info AS (
    SELECT 
        e.id as eval_id,
        (SELECT n.name FROM eval_names_junction en JOIN names_resource n ON en.name_id = n.id WHERE en.eval_id = e.id LIMIT 1) as eval_name,
        (SELECT d.description FROM eval_descriptions_junction ed JOIN descriptions_resource d ON ed.description_id = d.id WHERE ed.eval_id = e.id LIMIT 1) as eval_description,
        ARRAY[]::text[] as agent_ids,
        EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = 'dynamic' AND ef.value = true) AS dynamic,
        -- Get first rubric from direct rubric links
        -- Get first rubric FROM view_runs_entry (when use_groups = false) or view_groups_entry (when use_groups = true)
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
        -- eval_agent_id no longer available (was grade_agent_id from rubric_grade_agents)
        NULL::uuid as eval_agent_id
    FROM attempt_data ad
    JOIN evals_resource e ON e.id = ad.eval_id
),
-- Get all view_runs_entry for this eval (from eval_runs_junction)
eval_runs_data AS (
    SELECT 
        er.run_id,
        er.completed as eval_run_completed,
        er.created_at as eval_run_assigned_at,
        er.created_at as eval_run_updated_at
    FROM attempt_data ad
    JOIN eval_runs_junction er ON er.eval_id = ad.eval_id
),
-- Get view_tests_entry linked to this attempt via view_tests_entry.attempt_id
attempt_tests_data AS (
    SELECT
        t.id as test_id,
        t.attempt_id,
        t.group_id as test_group_id,
        t.completed as test_completed,
        t.title as test_title,
        t.created_at as test_created_at,
        t.updated_at as test_updated_at
    FROM attempt_data ad
    JOIN view_tests_entry t ON t.attempt_id = ad.id
),
-- Map view_tests_entry to original view_runs_entry using trace_id
-- trace_id format: "eval_{attempt_id}_{original_run_id}"
tests_to_runs AS (
    SELECT
        atd.test_id,
        atd.test_completed,
        atd.test_title,
        atd.test_created_at,
        atd.test_updated_at,
        -- Extract original run_id from trace_id (format: eval_{attempt_id}_{run_id})
        -- Keep as text for comparison, cast to uuid only when valid
        CASE
            WHEN t.trace_id LIKE 'eval_%_%' AND SPLIT_PART(t.trace_id, '_', 3) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
                SPLIT_PART(t.trace_id, '_', 3)::uuid
            ELSE NULL::uuid
        END as original_run_id
    FROM attempt_tests_data atd
    JOIN view_tests_entry t ON t.id = atd.test_id
    CROSS JOIN attempt_data ad
    WHERE t.trace_id LIKE 'eval_%_%'
      AND SPLIT_PART(t.trace_id, '_', 2) = ad.id::text
),
runs_with_status AS (
    SELECT 
        erd.run_id,
        erd.eval_run_completed,
        erd.eval_run_assigned_at,
        erd.eval_run_updated_at,
        -- Check if test exists for this run
        CASE 
            WHEN EXISTS (
                SELECT 1 
                FROM tests_to_runs ttr
                WHERE ttr.original_run_id = erd.run_id
            ) THEN
                -- Test exists, check if completed
                CASE 
                    WHEN EXISTS (
                        SELECT 1 
                        FROM tests_to_runs ttr2
                        WHERE ttr2.original_run_id = erd.run_id
                          AND ttr2.test_completed = true
                    ) THEN 'completed'
                    ELSE 'in_progress'
                END
            ELSE 'not_started'
        END as status,
        -- Get test_id if exists
        (
            SELECT ttr3.test_id
            FROM tests_to_runs ttr3
            WHERE ttr3.original_run_id = erd.run_id
            LIMIT 1
        ) as test_id
    FROM eval_runs_data erd
),
-- Get run details (model, agent, persona, profile, grade)
runs_with_details AS (
    SELECT
        rws.run_id,
        rws.status,
        rws.test_id,
        rws.eval_run_completed,
        rws.eval_run_assigned_at,
        rws.eval_run_updated_at,
        -- Run details
        r.created_at as run_created_at,
        -- Model info (via agent_models_junction)
        (SELECT am.model_id FROM agent_models_junction am WHERE am.agent_id = cac.agents_id AND am.active = true LIMIT 1) as model_id,
        (SELECT n.name FROM model_names_junction mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = (SELECT am.model_id FROM agent_models_junction am WHERE am.agent_id = cac.agents_id AND am.active = true LIMIT 1) LIMIT 1) as model_name,
        -- Agent/persona info
        cac.agents_id AS agent_id,
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        NULL::uuid as persona_id,
        NULL::text as persona_name,
        -- Profile info
        prj.profiles_id,
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as profile_name,
        -- Grade info (from eval_agent's run, not original run)
        -- Grade is on the eval_agent run via view_tests_entry.group_id -> view_runs_entry.group_id -> view_grades_entry.run_id
        (
            SELECT g.score
            FROM view_grades_entry g
            JOIN view_runs_entry gr ON gr.id = g.run_id
            JOIN view_groups_entry grp ON grp.id = gr.group_id
            JOIN view_tests_entry t ON t.group_id = grp.id
            WHERE t.id = rws.test_id
            LIMIT 1
        ) as grade_score,
        (
            SELECT g.passed
            FROM view_grades_entry g
            JOIN view_runs_entry gr ON gr.id = g.run_id
            JOIN view_groups_entry grp ON grp.id = gr.group_id
            JOIN view_tests_entry t ON t.group_id = grp.id
            WHERE t.id = rws.test_id
            LIMIT 1
        ) as grade_passed,
        (
            SELECT g.created_at
            FROM view_grades_entry g
            JOIN view_runs_entry gr ON gr.id = g.run_id
            JOIN view_groups_entry grp ON grp.id = gr.group_id
            JOIN view_tests_entry t ON t.group_id = grp.id
            WHERE t.id = rws.test_id
            LIMIT 1
        ) as grade_created_at
    FROM runs_with_status rws
    JOIN view_runs_entry r ON r.id = rws.run_id
    LEFT JOIN config_entry ce ON ce.run_id = r.id
    LEFT JOIN config_agents_connection cac ON cac.config_id = ce.id AND cac.active = TRUE
    LEFT JOIN agents_resource a ON a.id = cac.agents_id
    LEFT JOIN profiles_runs_connection prj ON prj.run_id = r.id
    LEFT JOIN profile_artifact p ON p.id = prj.profiles_id
    ORDER BY rws.eval_run_assigned_at DESC
),
-- Calculate status summary
status_summary AS (
    SELECT 
        COUNT(*) FILTER (WHERE status = 'not_started')::int as not_started,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
        COUNT(*)::int as total
    FROM runs_with_status
),
runs_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (rwd.run_id, rwd.status, rwd.test_id, rwd.eval_run_completed, rwd.eval_run_assigned_at, rwd.eval_run_updated_at, rwd.run_created_at, rwd.model_id, rwd.model_name, rwd.agent_id, rwd.agent_name, rwd.persona_id, rwd.persona_name, rwd.profiles_id, rwd.profile_name, rwd.grade_score, rwd.grade_passed, rwd.grade_created_at)::types.q_get_eval_attempt_v4_run
                ORDER BY rwd.eval_run_assigned_at DESC
            ),
            '{}'::types.q_get_eval_attempt_v4_run[]
        ) as runs_entry
    FROM runs_with_details rwd
)
SELECT 
    aec.attempt_exists,
    ap.actor_name,
    (ad.id, ad.created_at, ad.eval_id, ad.archived, ad.infinite_mode)::types.q_get_eval_attempt_v4_attempt as attempt,
    (ei.eval_id, ei.eval_name, ei.eval_description, ei.agent_ids, ei.dynamic, ei.rubric_id, ei.rubric_name, ei.rubric_description, ei.eval_agent_id, COALESCE(esp.system_prompt, ''))::types.q_get_eval_attempt_v4_eval as eval,
    COALESCE(ra.runs_entry, '{}'::types.q_get_eval_attempt_v4_run[]) as runs_entry,
    (ss.not_started, ss.in_progress, ss.completed, ss.total)::types.q_get_eval_attempt_v4_status_summary as status_summary
FROM attempt_exists_check aec
CROSS JOIN attempt_data ad
CROSS JOIN eval_info ei
CROSS JOIN status_summary ss
CROSS JOIN actor_profile ap
CROSS JOIN eval_system_prompt esp
CROSS JOIN runs_aggregated ra
$$;
