-- Update grade record with final values
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
        WHERE proname = 'socket_update_grade_final_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_update_grade_final_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_update_grade_final_v3(
    grade_id_param uuid,
    description_param text,
    passed_param boolean,
    score_param integer
)
RETURNS TABLE (
    id text
)
LANGUAGE sql
VOLATILE
AS $$
    UPDATE grades 
    SET description = description_param,
        passed = passed_param,
        score = score_param
    WHERE id = grade_id_param
    RETURNING id::text
$$;

COMMIT;

