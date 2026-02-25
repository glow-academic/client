-- Create a skipped chat with copied grades/feedbacks from a previous attempt

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_use_previous_attempt_grades_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_use_previous_attempt_grades_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_use_previous_attempt_grades_v4(
    p_attempt_id uuid,
    p_scenario_id uuid,
    p_previous_chat_id uuid
)
RETURNS TABLE (
    skipped_chat_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_skipped_chat_id uuid;
BEGIN
    -- Create a chat entry for the skipped scenario
    INSERT INTO attempt_chat_entry (active)
    VALUES (true)
    RETURNING id INTO v_skipped_chat_id;

    -- Bridge: link chat to attempt
    INSERT INTO attempt_chat_bridge_entry (attempt_id, attempt_chat_id)
    VALUES (p_attempt_id, v_skipped_chat_id);

    IF v_skipped_chat_id IS NULL THEN
        RETURN;
    END IF;

    -- Link scenario to the skipped chat
    INSERT INTO attempt_chat_scenarios_connection
        (chat_id, scenarios_id, active)
    VALUES (v_skipped_chat_id, p_scenario_id, true)
    ON CONFLICT DO NOTHING;

    -- Mark as completed
    INSERT INTO attempt_completion_entry (chat_id)
    VALUES (v_skipped_chat_id)
    ON CONFLICT (chat_id) DO NOTHING;

    -- Copy grade from previous chat
    INSERT INTO attempt_grade_entry (
        chat_id, run_id, rubric_grade_agent_id, rubric_id,
        score, passed, time_taken, total_points, pass_points,
        generated, active
    )
    SELECT v_skipped_chat_id, g.run_id, g.rubric_grade_agent_id, g.rubric_id,
           g.score, g.passed, g.time_taken, g.total_points, g.pass_points,
           g.generated, true
    FROM attempt_grade_entry g
    WHERE g.chat_id = p_previous_chat_id AND g.active = true
    ORDER BY g.created_at DESC
    LIMIT 1;

    -- Copy feedbacks from previous chat
    INSERT INTO attempt_feedback_entry (
        chat_id, standard_id, total, feedback, active
    )
    SELECT v_skipped_chat_id, f.standard_id, f.total, f.feedback, true
    FROM attempt_feedback_entry f
    WHERE f.chat_id = p_previous_chat_id AND f.active = true;

    RETURN QUERY SELECT v_skipped_chat_id;
END;
$$;
