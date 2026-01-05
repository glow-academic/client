-- Create message feedback strength record
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
        WHERE proname = 'socket_create_message_feedback_strength_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_create_message_feedback_strength_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_create_message_feedback_strength_v4(
    grade_id uuid,
    message_id uuid,
    name text,
    description text
)
RETURNS TABLE (
    id text
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO message_feedback_strengths 
    (grade_id, message_id, name, description, created_at)
    VALUES (grade_id, message_id, name, description, NOW())
    RETURNING id::text
$$;

