-- Create a single feedback record
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
        WHERE proname = 'socket_create_feedback_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_create_feedback_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_create_feedback_v4(
    grade_id uuid,
    standard_id uuid,
    total integer,
    feedback text
)
RETURNS TABLE (
    id text
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO feedbacks 
    (grade_id, standard_id, total, feedback, created_at)
    VALUES (grade_id, standard_id, total, feedback, NOW())
    RETURNING id::text
$$;

COMMIT;

