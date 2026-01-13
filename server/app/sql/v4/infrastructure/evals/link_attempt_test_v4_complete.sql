-- Link test to attempt
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_evals_link_attempt_test_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_evals_link_attempt_test_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_evals_link_attempt_test_v4(
    attempt_id uuid,
    test_id uuid
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO attempt_tests (attempt_id, test_id, created_at, updated_at)
    VALUES ($1, $2, NOW(), NOW())
    ON CONFLICT (attempt_id, test_id) DO NOTHING
$$;
