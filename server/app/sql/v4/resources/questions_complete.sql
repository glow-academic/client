-- Create questions resource
-- Always INSERT operation (preserves all information)
-- Parameters: question_text text, allow_multiple boolean, time_value integer
-- Returns: question_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_questions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_questions_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_questions_v4(
    question_text text, allow_multiple boolean, time_value integer
)
RETURNS TABLE (
    question_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_question_id uuid;
BEGIN
    -- INSERT into questions table (always insert, never update)
    INSERT INTO questions(question_text, allow_multiple, time, active)
    VALUES (question_text, allow_multiple, time_value, true)
    RETURNING id INTO v_question_id;

    RETURN QUERY SELECT v_question_id;
END;
$$;