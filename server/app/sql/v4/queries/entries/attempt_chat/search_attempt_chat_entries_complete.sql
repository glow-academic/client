-- Search attempt_chat entries from attempt_chat_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_attempt_chat_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_attempt_chat_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_attempt_chat_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0,
    attempt_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    training_department_id uuid DEFAULT NULL,
    profile_id uuid DEFAULT NULL,
    cohort_id uuid DEFAULT NULL,
    department_id uuid DEFAULT NULL,
    simulation_id uuid DEFAULT NULL,
    scenario_id uuid DEFAULT NULL,
    user_persona_id uuid DEFAULT NULL,
    rubric_id uuid DEFAULT NULL
) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(row_data) AS items
    FROM (
        SELECT jsonb_build_object(
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
        ) AS row_data
        FROM attempt_chat_mv m
        WHERE true
          AND (attempt_id IS NULL OR m.attempt_id = attempt_id)
          AND (group_id IS NULL OR m.group_id = group_id)
          AND (training_department_id IS NULL OR m.training_department_id = training_department_id)
          AND (profile_id IS NULL OR m.profile_id = profile_id)
          AND (cohort_id IS NULL OR m.cohort_id = cohort_id)
          AND (department_id IS NULL OR m.department_id = department_id)
          AND (simulation_id IS NULL OR m.simulation_id = simulation_id)
          AND (scenario_id IS NULL OR m.scenario_id = scenario_id)
          AND (user_persona_id IS NULL OR m.user_persona_id = user_persona_id)
          AND (rubric_id IS NULL OR m.rubric_id = rubric_id)
        ORDER BY m.chat_created_at DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
