-- Create a single feedback record
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_create_feedback_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_create_feedback_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
-- Creates feedback record and links to grade via grade_feedbacks junction table
CREATE OR REPLACE FUNCTION socket_create_feedback_v4(
    grade_id uuid,
    standard_id uuid,
    total integer,
    feedback text
)
RETURNS TABLE (
    id text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    feedback_id_val uuid;
BEGIN
    -- Create feedback record
    INSERT INTO feedbacks 
    (standard_id, total, feedback, created_at)
    VALUES (standard_id, total, feedback, NOW())
    RETURNING id INTO feedback_id_val;
    
    -- Link to grade via junction table
    INSERT INTO grade_feedbacks (grade_id, feedback_id, created_at)
    VALUES (grade_id, feedback_id_val, NOW())
    ON CONFLICT (grade_id, feedback_id) DO NOTHING;
    
    -- Return feedback id
    RETURN QUERY SELECT feedback_id_val::text;
END;
$$;