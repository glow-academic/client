-- Create feedbacks resource
-- Always INSERT operation (preserves all information)
-- Parameters: total numeric, feedback text, standard_id uuid
-- Returns: feedback_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_feedbacks_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_feedbacks_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_feedbacks_v4(
    total numeric, feedback text, standard_id uuid
)
RETURNS TABLE (
    feedback_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_feedback_id uuid;
BEGIN
    -- INSERT into feedbacks table (always insert, never update)
    INSERT INTO feedbacks(total, feedback, standard_id, active)
    VALUES (total, feedback, standard_id, true)
    RETURNING id INTO v_feedback_id;

    RETURN QUERY SELECT v_feedback_id;
END;
$$;