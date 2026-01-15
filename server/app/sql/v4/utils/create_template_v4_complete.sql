-- DEPRECATED: Create template record
-- This function is deprecated - templates_resource table has been dropped
-- Use api_create_args_outputs_v4 instead to create args_outputs_resource entries
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'utils_create_template_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS utils_create_template_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function as no-op (deprecated)
-- Note: templates_resource table has been dropped in favor of args_outputs_resource
-- This function is kept for backward compatibility but does nothing
CREATE OR REPLACE FUNCTION utils_create_template_v4(
    template_id uuid,
    name text
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    -- DEPRECATED: This function no longer creates templates
    -- templates_resource table has been dropped
    -- Use api_create_args_outputs_v4 instead to create args_outputs_resource entries
    SELECT NULL::void
$$;
