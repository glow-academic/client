-- Insert debug info for a model run
-- Converted to PostgreSQL function

BEGIN;

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_insert_debug_info_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_insert_debug_info_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_insert_debug_info_v4(
    run_id uuid,
    content text
)
RETURNS TABLE (
    run_id uuid,
    content text,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
INSERT INTO debug_info (run_id, content, created_at)
VALUES (api_insert_debug_info_v4.run_id, api_insert_debug_info_v4.content, NOW())
RETURNING run_id, content, created_at
$$;

COMMIT;

