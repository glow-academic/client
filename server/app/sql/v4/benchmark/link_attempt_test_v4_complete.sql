-- Link test to attempt
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_link_attempt_test_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_link_attempt_test_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_link_attempt_test_v4(
    attempt_id uuid,
    test_id uuid
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    UPDATE tests
    SET attempt_id = $1
    WHERE id = $2
$$;
