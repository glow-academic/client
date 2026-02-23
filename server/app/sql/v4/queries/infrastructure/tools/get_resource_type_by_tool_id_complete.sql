-- Get resource_type by tool_id
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'infra_get_resource_type_by_tool_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infra_get_resource_type_by_tool_id_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create function
CREATE OR REPLACE FUNCTION infra_get_resource_type_by_tool_id_v4(
    tool_id uuid
)
RETURNS TABLE (
    resource_type text
)
LANGUAGE sql
STABLE
AS $$
    -- $1 is a tools_resource.id — read resource directly (denormalized from domains)
    SELECT tr.resource as resource_type
    FROM tools_resource tr
    WHERE tr.id = $1
      AND tr.active = true
      AND tr.resource IS NOT NULL
    LIMIT 1;
$$;
