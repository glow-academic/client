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
-- Gets feedback totals for a grade via grade_feedbacks junction table
CREATE OR REPLACE FUNCTION socket_get_feedback_totals_for_grade_v4(
    grade_id_param uuid
)
RETURNS TABLE (
    total integer
)
LANGUAGE sql
STABLE
AS $$
    SELECT f.total
    FROM feedbacks_resource f
    JOIN grade_feedbacks gf ON gf.feedback_id = f.id
    WHERE gf.grade_id = grade_id_param
$$;