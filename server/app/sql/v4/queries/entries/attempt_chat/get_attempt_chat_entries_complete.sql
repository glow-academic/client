-- Get attempt_chat entries by IDs from attempt_chat_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_attempt_chat_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_attempt_chat_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_attempt_chat_entries_v4(
    ids uuid[]
) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(
        jsonb_build_object(
            'chat_id', m.chat_id,
            'attempt_id', m.attempt_id,
            'group_id', m.group_id,
            'training_department_id', m.training_department_id,
            'profile_id', m.profile_id,
            'cohort_id', m.cohort_id,
            'department_id', m.department_id,
            'simulation_id', m.simulation_id,
            'scenario_id', m.scenario_id,
            'user_persona_id', m.user_persona_id,
            'rubric_id', m.rubric_id,
            'grade_score', m.grade_score,
            'grade_total_points', m.grade_total_points,
            'grade_pass_points', m.grade_pass_points,
            'grade_passed', m.grade_passed,
            'grade_time_taken', m.grade_time_taken,
            'completed', m.completed,
            'attempt_number', m.attempt_number,
            'chat_created_at', m.chat_created_at,
            'attempt_date', m.attempt_date,
            'attempt_type', m.attempt_type,
            'is_archived', m.is_archived,
            'infinite_mode', m.infinite_mode
        )
    ) AS items
    FROM attempt_chat_mv m
    WHERE m.chat_id = ANY(ids);
END;
$$;
