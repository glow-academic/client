-- Create message feedback with replaces and highlights
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate

BEGIN;

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_create_message_feedback_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_create_message_feedback_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_create_message_feedback_v3(
    grade_id uuid,
    message_id uuid,
    name text,
    description text,
    type message_feedback_type
)
RETURNS TABLE (
    id text
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO message_feedbacks 
    (grade_id, message_id, name, description, type, created_at)
    VALUES (grade_id, message_id, name, description, type, NOW())
    RETURNING id::text
$$;

COMMIT;
