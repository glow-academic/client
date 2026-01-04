-- Get feedback totals for a grade
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
        WHERE proname = 'socket_get_feedback_totals_for_grade_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_feedback_totals_for_grade_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_feedback_totals_for_grade_v4(
    grade_id_param uuid
)
RETURNS TABLE (
    total integer
)
LANGUAGE sql
STABLE
AS $$
    SELECT total
    FROM feedbacks
    WHERE grade_id = grade_id_param
$$;