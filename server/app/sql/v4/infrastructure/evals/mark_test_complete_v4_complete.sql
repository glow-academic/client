-- Mark test as completed
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_evals_mark_test_complete_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_evals_mark_test_complete_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_evals_mark_test_complete_v4(
    test_id uuid
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    UPDATE tests SET completed = true, updated_at = NOW()
    WHERE tests.id = $1
$$;
