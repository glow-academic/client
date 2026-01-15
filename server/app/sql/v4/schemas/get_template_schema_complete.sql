-- Get schema for a template via args_outputs_resource.args_id
-- Returns schema_id (args_resource.id) for a given template_id (args_outputs_resource.id)
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
-- Note: schema_templates table has been dropped - linking now via args_outputs_resource.args_id
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
    ao.args_id as schema_id
FROM args_outputs_resource ao
WHERE ao.id = template_id
  AND ao.active = true
LIMIT 1
$$;

