-- Create test record
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_evals_create_test_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_evals_create_test_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_evals_create_test_v4(
    title text,
    group_id uuid,
    trace_id text
)
RETURNS TABLE (
    test_id text
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO tests (title, group_id, completed, trace_id, created_at, updated_at)
    VALUES ($1, $2, false, $3, NOW(), NOW())
    RETURNING id::text as test_id
$$;
