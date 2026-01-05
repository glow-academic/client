-- Get schema for a template via template_schemas junction
-- Returns schema_id for a given template_id
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_template_schema_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_template_schema_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_template_schema_v4(
    template_id uuid
)
RETURNS TABLE (
    schema_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT
    ts.schema_id
FROM template_schemas ts
WHERE ts.template_id = template_id
LIMIT 1
$$;

