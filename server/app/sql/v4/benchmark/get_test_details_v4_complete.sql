-- Get test details (id and group_id) by attempt_id
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_test_details_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_test_details_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_test_details_v4(
    attempt_id uuid
)
RETURNS TABLE (
    test_id text,
    group_id text
)
LANGUAGE sql
STABLE
AS $$
    SELECT t.id::text as test_id, t.group_id::text as group_id
    FROM tests_entry t
    WHERE t.attempt_id = $1
      AND t.completed = false
    ORDER BY t.created_at DESC
    LIMIT 1
$$;
