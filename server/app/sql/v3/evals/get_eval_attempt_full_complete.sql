-- Get eval attempt full details with runs and status
-- Parameters: $1 = attempt_id (uuid), $2 = profile_id (uuid)
-- Returns: attempt details, eval info, runs list with status (not_started, in_progress, completed), actor_name

WITH actor_profile AS (
    SELECT
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
attempt_data AS (
    SELECT 
        ea.id as attempt_id,
        ea.created_at as attempt_created_at,
        ea.eval_id,
        ea.archived,
        ea.conversation_mode,
        ea.conversation_agent_id,
        ea.conversation_max_turns
    FROM eval_attempts ea
    WHERE ea.id = $1::uuid
),
-- Get conversation agent name
conversation_agent_info AS (
    SELECT 
        a.id::text as agent_id,
        a.name as agent_name
    FROM attempt_data ad
    LEFT JOIN agents a ON a.id = ad.conversation_agent_id
),
-- Get system prompt from eval's agent_id (default active prompt)
agent_system_prompt AS (
    SELECT 
        COALESCE(pr.system_prompt, '') as system_prompt
    FROM attempt_data ad
    JOIN evals e ON e.id = ad.eval_id
    LEFT JOIN agent_prompts ap ON ap.agent_id = e.agent_id AND ap.active = true
    LEFT JOIN prompts pr ON pr.id = ap.prompt_id
    LIMIT 1
),
eval_info AS (
    SELECT 
        e.id as eval_id,
        e.name as eval_name,
        e.description as eval_description,
        e.rubric_id::text,
        e.agent_id::text,
        e.eval_agent_id::text,
        e.dynamic,
        r.name as rubric_name,
        r.description as rubric_description
    FROM attempt_data ad
    JOIN evals e ON e.id = ad.eval_id
    JOIN rubrics r ON r.id = e.rubric_id
),
-- Get all runs for this eval (from eval_runs)
eval_runs_data AS (
    SELECT 
        er.run_id::text,
        er.completed as eval_run_completed,
        er.created_at as eval_run_assigned_at,
        er.updated_at as eval_run_updated_at
    FROM attempt_data ad
    JOIN eval_runs er ON er.eval_id = ad.eval_id
),
-- Get tests linked to this attempt via attempt_tests
attempt_tests_data AS (
    SELECT 
        at.test_id::text,
        at.attempt_id::text,
        t.run_id::text as test_run_id,
        t.completed as test_completed,
        t.title as test_title,
        t.created_at as test_created_at,
        t.updated_at as test_updated_at
    FROM attempt_data ad
    JOIN attempt_tests at ON at.attempt_id = ad.attempt_id
    JOIN tests t ON t.id = at.test_id
),
-- Map tests to original runs using trace_id
-- trace_id format: "eval_{attempt_id}_{original_run_id}"
-- So we can extract original_run_id from trace_id: SPLIT_PART(trace_id, '_', 3)
-- Also verify attempt_id matches (SPLIT_PART(trace_id, '_', 2))
tests_to_runs AS (
    SELECT 
        atd.test_id,
        atd.test_completed,
        atd.test_title,
        atd.test_created_at,
        atd.test_updated_at,
        -- Extract original run_id from trace_id (format: eval_{attempt_id}_{run_id})
        SPLIT_PART(t.trace_id, '_', 3) as original_run_id
    FROM attempt_tests_data atd
    JOIN tests t ON t.id::text = atd.test_id
    CROSS JOIN attempt_data ad
    WHERE t.trace_id LIKE 'eval_%_%'
      AND SPLIT_PART(t.trace_id, '_', 2) = ad.attempt_id::text
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
        rm.model_id::text as model_id,
        m.name as model_name,
        -- Agent/persona info
        r.agent_id::text as agent_id,
        a.name as agent_name,
        rper.persona_id::text as persona_id,
        per.name as persona_name,
        -- Profile info
        rp.profile_id::text as profile_id,
        p.first_name || ' ' || p.last_name as profile_name,
        -- Grade info (from eval_agent's run, not original run)
        -- Grade is on the eval_agent run (test.run_id), not original run
        (
            SELECT g.score
            FROM grades g
            JOIN test_runs tr ON tr.run_id = g.run_id
            JOIN tests t ON t.id = tr.test_id
            WHERE t.id::text = rws.test_id
            LIMIT 1
        ) as grade_score,
        (
            SELECT g.passed
            FROM grades g
            JOIN test_runs tr ON tr.run_id = g.run_id
            JOIN tests t ON t.id = tr.test_id
            WHERE t.id::text = rws.test_id
            LIMIT 1
        ) as grade_passed,
        (
            SELECT g.created_at
            FROM grades g
            JOIN test_runs tr ON tr.run_id = g.run_id
            JOIN tests t ON t.id = tr.test_id
            WHERE t.id::text = rws.test_id
            LIMIT 1
        ) as grade_created_at
    FROM runs_with_status rws
    JOIN runs r ON r.id::text = rws.run_id
    LEFT JOIN run_models rm ON rm.run_id = r.id AND rm.active = true
    LEFT JOIN models m ON m.id = rm.model_id
    LEFT JOIN agents a ON a.id = r.agent_id
    LEFT JOIN run_personas rper ON rper.run_id = r.id AND rper.active = true
    LEFT JOIN personas per ON per.id = rper.persona_id
    LEFT JOIN run_profiles rp ON rp.run_id = r.id AND rp.active = true
    LEFT JOIN profiles p ON p.id = rp.profile_id
    ORDER BY rws.eval_run_assigned_at DESC
),
runs_json AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'run_id', run_id,
                'status', status,
                'test_id', test_id,
                'eval_run_completed', eval_run_completed,
                'eval_run_assigned_at', eval_run_assigned_at,
                'eval_run_updated_at', eval_run_updated_at,
                'run_created_at', run_created_at,
                'model_id', model_id,
                'model_name', model_name,
                'agent_id', agent_id,
                'agent_name', agent_name,
                'persona_id', persona_id,
                'persona_name', persona_name,
                'profile_id', profile_id,
                'profile_name', profile_name,
                'grade_score', grade_score,
                'grade_passed', grade_passed,
                'grade_created_at', grade_created_at
            ) ORDER BY eval_run_assigned_at DESC
        ),
        '[]'::jsonb
    ) as runs
    FROM runs_with_details
),
-- Calculate status summary
status_summary AS (
    SELECT 
        COUNT(*) FILTER (WHERE status = 'not_started') as not_started_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) as total_runs
    FROM runs_with_status
)
SELECT 
    jsonb_build_object(
        'id', ad.attempt_id::text,
        'created_at', ad.attempt_created_at,
        'eval_id', ad.eval_id::text,
        'archived', ad.archived,
        'conversation_mode', ad.conversation_mode,
        'conversation_agent_id', ad.conversation_agent_id::text,
        'conversation_max_turns', ad.conversation_max_turns
    ) as attempt,
    jsonb_build_object(
        'eval_id', ei.eval_id::text,
        'name', ei.eval_name,
        'description', ei.eval_description,
        'rubric_id', ei.rubric_id,
        'agent_id', ei.agent_id,
        'eval_agent_id', ei.eval_agent_id,
        'dynamic', ei.dynamic,
        'rubric_name', ei.rubric_name,
        'rubric_description', ei.rubric_description,
        'system_prompt', COALESCE(asp.system_prompt, ''),
        'conversation_agent_name', cai.agent_name
    ) as eval,
    rj.runs,
    jsonb_build_object(
        'not_started', COALESCE(ss.not_started_count, 0),
        'in_progress', COALESCE(ss.in_progress_count, 0),
        'completed', COALESCE(ss.completed_count, 0),
        'total', COALESCE(ss.total_runs, 0)
    ) as status_summary,
    ap.actor_name
FROM attempt_data ad
CROSS JOIN eval_info ei
CROSS JOIN runs_json rj
CROSS JOIN status_summary ss
CROSS JOIN actor_profile ap
CROSS JOIN agent_system_prompt asp
LEFT JOIN conversation_agent_info cai ON cai.agent_id = ad.conversation_agent_id::text

