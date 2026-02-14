-- Complete a test grade: update tokens and score/passed on benchmark_grades_entry

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_complete_test_grade_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_complete_test_grade_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_complete_test_grade_v4(
    p_grade_id uuid,
    p_run_id uuid,
    p_score integer DEFAULT NULL,
    p_passed boolean DEFAULT NULL,
    p_input_tokens integer DEFAULT NULL,
    p_output_tokens integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
    -- Update token usage on the run
    IF p_run_id IS NOT NULL THEN
        UPDATE runs_entry
        SET input_tokens = COALESCE(p_input_tokens, input_tokens),
            output_tokens = COALESCE(p_output_tokens, output_tokens),
            updated_at = NOW()
        WHERE id = p_run_id;
    END IF;

    -- Update grade score and passed (only if values provided)
    IF p_grade_id IS NOT NULL AND (p_score IS NOT NULL OR p_passed IS NOT NULL) THEN
        UPDATE benchmark_grades_entry
        SET score = COALESCE(p_score, score),
            passed = COALESCE(p_passed, passed),
            updated_at = NOW()
        WHERE id = p_grade_id;
    END IF;
END;
$$;
