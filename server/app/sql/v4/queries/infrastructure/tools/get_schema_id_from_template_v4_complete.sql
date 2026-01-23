-- Get schema_id from template_id via args_outputs_resource.args_id
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
-- Note: schema_templates table has been dropped - linking now via args_outputs_resource.args_id
CREATE OR REPLACE FUNCTION infrastructure_tools_get_schema_id_from_template_v4(
    template_id uuid
)
RETURNS TABLE (
    schema_id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT args_id as schema_id
    FROM args_outputs_resource
    WHERE args_outputs_resource.id = $1
      AND args_outputs_resource.active = true
    LIMIT 1
$$;
