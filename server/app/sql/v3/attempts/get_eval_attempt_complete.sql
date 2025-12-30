-- Get eval attempt full details with runs and status
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
        WHERE proname = 'api_get_eval_attempt_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_eval_attempt_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_eval_attempt_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_eval_attempt_v3_run AS (
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

CREATE TYPE types.q_get_eval_attempt_v3_attempt AS (
    id uuid,
    created_at timestamptz,
    eval_id uuid,
    archived boolean,
    infinite_mode boolean
);

CREATE TYPE types.q_get_eval_attempt_v3_eval AS (
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

CREATE TYPE types.q_get_eval_attempt_v3_status_summary AS (
    not_started int,
    in_progress int,
    completed int,
    total int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_eval_attempt_v3(
    attempt_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    attempt_exists boolean,
    actor_name text,
    attempt types.q_get_eval_attempt_v3_attempt,
    eval types.q_get_eval_attempt_v3_eval,
    runs types.q_get_eval_attempt_v3_run[],
    status_summary types.q_get_eval_attempt_v3_status_summary
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
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
attempt_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM eval_attempts WHERE id = (SELECT attempt_id FROM params)
    )::boolean as attempt_exists
),
attempt_data AS (
    SELECT 
        ea.id,
        ea.created_at,
        ea.eval_id,
        ea.archived,
        ea.infinite_mode
    FROM params x
    JOIN eval_attempts ea ON ea.id = x.attempt_id
),
-- Get eval agents for system prompt (use first agent)
eval_agents_data AS (
    SELECT 
        ea.eval_id,
        ARRAY_AGG(ea.agent_id::text ORDER BY ea.created_at) as agent_ids,
        (ARRAY_AGG(ea.agent_id ORDER BY ea.created_at))[1] as first_agent_id
    FROM attempt_data ad
    JOIN eval_agents ea ON ea.eval_id = ad.eval_id
    GROUP BY ea.eval_id
),
-- Get system prompt from eval's first agent (default active prompt)
agent_system_prompt AS (
    SELECT 
        COALESCE(pr.system_prompt, '') as system_prompt
    FROM attempt_data ad
    LEFT JOIN eval_agents_data ead ON ead.eval_id = ad.eval_id
    LEFT JOIN agent_prompts ap ON ap.agent_id = ead.first_agent_id AND ap.active = true
    LEFT JOIN prompts pr ON pr.id = ap.prompt_id
    LIMIT 1
),
eval_info AS (
    SELECT 
        e.id as eval_id,
        e.name as eval_name,
        e.description as eval_description,
        COALESCE(ead.agent_ids, ARRAY[]::text[]) as agent_ids,
        e.dynamic,
        -- Get first rubric and eval_agent from junction table
        -- Get first rubric from runs (when use_groups = false) or groups (when use_groups = true)
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
        (SELECT rga.grade_text_agent_id 
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
         LIMIT 1) as eval_agent_id
    FROM attempt_data ad
    JOIN evals e ON e.id = ad.eval_id
    LEFT JOIN eval_agents_data ead ON ead.eval_id = e.id
),
-- Get all runs for this eval (from eval_runs)
eval_runs_data AS (
    SELECT 
        er.run_id,
        er.completed as eval_run_completed,
        er.created_at as eval_run_assigned_at,
        er.updated_at as eval_run_updated_at
    FROM attempt_data ad
    JOIN eval_runs er ON er.eval_id = ad.eval_id
),
-- Get tests linked to this attempt via attempt_tests
attempt_tests_data AS (
    SELECT 
        at.test_id,
        at.attempt_id,
        t.run_id as test_run_id,
        t.completed as test_completed,
        t.title as test_title,
        t.created_at as test_created_at,
        t.updated_at as test_updated_at
    FROM attempt_data ad
    JOIN attempt_tests at ON at.attempt_id = ad.id
    JOIN tests t ON t.id = at.test_id
),
-- Map tests to original runs using trace_id
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
    JOIN tests t ON t.id = atd.test_id
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
        -- Model info
        rm.model_id,
        m.name as model_name,
        -- Agent/persona info
        r.agent_id,
        a.name as agent_name,
        rper.persona_id,
        per.name as persona_name,
        -- Profile info
        rp.profile_id,
        p.first_name || ' ' || p.last_name as profile_name,
        -- Grade info (from eval_agent's run, not original run)
        -- Grade is on the eval_agent run (test.run_id), not original run
        (
            SELECT g.score
            FROM grades g
            JOIN test_runs tr ON tr.run_id = g.run_id
            JOIN tests t ON t.id = tr.test_id
            WHERE t.id = rws.test_id
            LIMIT 1
        ) as grade_score,
        (
            SELECT g.passed
            FROM grades g
            JOIN test_runs tr ON tr.run_id = g.run_id
            JOIN tests t ON t.id = tr.test_id
            WHERE t.id = rws.test_id
            LIMIT 1
        ) as grade_passed,
        (
            SELECT g.created_at
            FROM grades g
            JOIN test_runs tr ON tr.run_id = g.run_id
            JOIN tests t ON t.id = tr.test_id
            WHERE t.id = rws.test_id
            LIMIT 1
        ) as grade_created_at
    FROM runs_with_status rws
    JOIN runs r ON r.id = rws.run_id
    LEFT JOIN run_models rm ON rm.run_id = r.id AND rm.active = true
    LEFT JOIN models m ON m.id = rm.model_id
    LEFT JOIN agents a ON a.id = r.agent_id
    LEFT JOIN run_personas rper ON rper.run_id = r.id AND rper.active = true
    LEFT JOIN personas per ON per.id = rper.persona_id
    LEFT JOIN run_profiles rp ON rp.run_id = r.id AND rp.active = true
    LEFT JOIN profiles p ON p.id = rp.profile_id
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
                (rwd.run_id, rwd.status, rwd.test_id, rwd.eval_run_completed, rwd.eval_run_assigned_at, rwd.eval_run_updated_at, rwd.run_created_at, rwd.model_id, rwd.model_name, rwd.agent_id, rwd.agent_name, rwd.persona_id, rwd.persona_name, rwd.profile_id, rwd.profile_name, rwd.grade_score, rwd.grade_passed, rwd.grade_created_at)::types.q_get_eval_attempt_v3_run
                ORDER BY rwd.eval_run_assigned_at DESC
            ),
            '{}'::types.q_get_eval_attempt_v3_run[]
        ) as runs
    FROM runs_with_details rwd
)
SELECT 
    aec.attempt_exists,
    ap.actor_name,
    (ad.id, ad.created_at, ad.eval_id, ad.archived, ad.infinite_mode)::types.q_get_eval_attempt_v3_attempt as attempt,
    (ei.eval_id, ei.eval_name, ei.eval_description, ei.agent_ids, ei.dynamic, ei.rubric_id, ei.rubric_name, ei.rubric_description, ei.eval_agent_id, COALESCE(asp.system_prompt, ''))::types.q_get_eval_attempt_v3_eval as eval,
    COALESCE(ra.runs, '{}'::types.q_get_eval_attempt_v3_run[]) as runs,
    (ss.not_started, ss.in_progress, ss.completed, ss.total)::types.q_get_eval_attempt_v3_status_summary as status_summary
FROM attempt_exists_check aec
CROSS JOIN attempt_data ad
CROSS JOIN eval_info ei
CROSS JOIN status_summary ss
CROSS JOIN actor_profile ap
CROSS JOIN agent_system_prompt asp
CROSS JOIN runs_aggregated ra
$$;

COMMIT;
