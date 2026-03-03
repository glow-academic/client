-- Prepare test grade: mutations only (run/agent/grade creation)
-- All data fetching is now done in Python from pre-fetched resources
-- group_id and invocation_id are resolved in Python and passed directly
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_test_grade_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_test_grade_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function (mutations only)
CREATE OR REPLACE FUNCTION socket_prepare_test_grade_v4(
    p_profile_id uuid,
    p_group_id uuid,
    p_invocation_id uuid,
    p_run_id uuid,
    p_rubric_id uuid DEFAULT NULL,
    p_agents_resource_id uuid DEFAULT NULL,
    p_models_resource_id uuid DEFAULT NULL,
    p_providers_resource_id uuid DEFAULT NULL
)
RETURNS TABLE (
    grade_run_id uuid,
    grade_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_grade_run_id uuid;
    v_grade_id uuid;
BEGIN
    -- Create run for grading LLM generation
    INSERT INTO runs_entry (group_id)
    VALUES (p_group_id)
    RETURNING id INTO v_grade_run_id;

    -- Link run to selected agent resource
    IF p_agents_resource_id IS NOT NULL THEN
        INSERT INTO runs_agents_connection (run_id, agents_id, created_at, active, generated, mcp)
        VALUES (v_grade_run_id, p_agents_resource_id, NOW(), true, false, false)
        ON CONFLICT (run_id, agents_id) DO NOTHING;
    END IF;

    -- Link run to profile
    INSERT INTO profiles_runs_connection (profiles_id, run_id)
    SELECT ppj.profiles_id, v_grade_run_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = p_profile_id
    LIMIT 1;

    -- Create benchmark grade entry
    INSERT INTO test_grade_entry (
        invocation_id, run_id, rubric_grade_agent_id,
        created_at, updated_at, score, passed
    )
    VALUES (
        p_invocation_id, p_run_id, p_agents_resource_id,
        NOW(), NOW(), 0, false
    )
    RETURNING id INTO v_grade_id;

    -- Link grade to rubric if provided
    IF p_rubric_id IS NOT NULL THEN
        INSERT INTO test_grade_rubrics_connection (grade_id, rubrics_id)
        VALUES (v_grade_id, p_rubric_id);
    END IF;

    RETURN QUERY SELECT v_grade_run_id, v_grade_id;
END;
$$;
