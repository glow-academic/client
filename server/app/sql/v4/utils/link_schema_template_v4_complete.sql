-- DEPRECATED: Link template to schema
-- This function is deprecated - schema_templates table has been dropped
-- Linking now happens via args_outputs_resource.args_id when creating args_outputs_resource
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'utils_link_schema_template_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS utils_link_schema_template_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function as no-op (deprecated)
-- Note: schema_templates table has been dropped
-- Linking now happens via args_outputs_resource.args_id when creating args_outputs_resource entries
CREATE OR REPLACE FUNCTION utils_link_schema_template_v4(
    schema_id uuid,
    template_id uuid
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    -- DEPRECATED: This function no longer links schemas to templates
    -- schema_templates table has been dropped
    -- Linking now happens via args_outputs_resource.args_id when creating args_outputs_resource entries
    SELECT NULL::void
$$;
