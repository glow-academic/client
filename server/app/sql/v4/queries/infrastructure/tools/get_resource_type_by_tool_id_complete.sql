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
    SELECT dr.resource::text as resource_type
    FROM tool_domains_junction tdj
    JOIN domains_resource dr ON dr.id = tdj.domain_id AND dr.active = true
    WHERE tdj.tool_id = $1
      AND tdj.active = true
    LIMIT 1;
$$;
