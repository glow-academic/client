-- Get test by id
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_test_by_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_test_by_id_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_test_by_id_v4(
    test_id uuid
)
RETURNS TABLE (
    id uuid,
    title text,
    completed boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT id, title, completed FROM tests_entry WHERE tests_entry.id = $1
$$;
