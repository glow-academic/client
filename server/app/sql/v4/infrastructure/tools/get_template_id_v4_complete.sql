-- Get template_id FROM tool_artifact
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_tools_get_template_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_tools_get_template_id_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_tools_get_template_id_v4(
    tool_id uuid
)
RETURNS TABLE (
    template_id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT tt.template_id
    FROM tool_templates tt
    WHERE tt.tool_id = $1
    LIMIT 1
$$;
