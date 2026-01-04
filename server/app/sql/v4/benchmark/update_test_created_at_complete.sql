-- Update test created_at timestamp
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_update_test_created_at_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_test_created_at_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_update_test_created_at_v4(
    created_at timestamptz,
    test_id uuid
)
RETURNS TABLE (
    test_id text
)
LANGUAGE sql
VOLATILE
AS $$
UPDATE tests SET created_at = created_at, updated_at = NOW()
WHERE id = test_id
RETURNING id::text as test_id
$$;