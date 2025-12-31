-- Find the standard that matches the score for a standard group
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
        WHERE proname = 'socket_find_standard_by_group_and_score_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_find_standard_by_group_and_score_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_find_standard_by_group_and_score_v4(
    standard_group_id_param uuid,
    score_param integer
)
RETURNS TABLE (
    id text
)
LANGUAGE sql
STABLE
AS $$
    SELECT id::text
    FROM standards
    WHERE standard_group_id = standard_group_id_param
      AND points = score_param
    ORDER BY points DESC
    LIMIT 1
$$;

COMMIT;

