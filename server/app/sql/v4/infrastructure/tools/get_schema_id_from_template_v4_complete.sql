-- Get schema_id from template_id via schema_templates
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_tools_get_schema_id_from_template_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_tools_get_schema_id_from_template_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_tools_get_schema_id_from_template_v4(
    template_id uuid
)
RETURNS TABLE (
    schema_id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT schema_id
    FROM schema_templates
    WHERE schema_templates.template_id = $1
    LIMIT 1
$$;
