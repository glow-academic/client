-- Complete an attempt grade: update tokens and score/passed

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_complete_attempt_grade_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_complete_attempt_grade_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_complete_attempt_grade_v4(
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
    -- Insert token usage (append-only)
    IF p_input_tokens IS NOT NULL OR p_output_tokens IS NOT NULL THEN
        INSERT INTO tokens_entry (run_id, input_tokens, output_tokens)
        VALUES (p_run_id, COALESCE(p_input_tokens, 0), COALESCE(p_output_tokens, 0));
    END IF;

    -- Update grade score and passed (only if values provided)
    IF p_score IS NOT NULL OR p_passed IS NOT NULL THEN
        UPDATE attempt_grade_entry
        SET score = COALESCE(p_score, score),
            passed = COALESCE(p_passed, passed),
            updated_at = NOW()
        WHERE id = p_grade_id;
    END IF;
END;
$$;
