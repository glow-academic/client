-- Get entry_type by tool_id from bindings
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'infra_get_entry_type_by_tool_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infra_get_entry_type_by_tool_id_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create function
CREATE OR REPLACE FUNCTION infra_get_entry_type_by_tool_id_v4(
    tool_id uuid
)
RETURNS TABLE (
    entry_type text
)
LANGUAGE sql
STABLE
AS $$
    SELECT br.entry::text as entry_type
    FROM tool_bindings_junction tbj
    JOIN bindings_resource br ON br.id = tbj.binding_id AND br.active = true
    WHERE tbj.tool_id = $1
      AND tbj.active = true
      AND br.creatable = true
    LIMIT 1;
$$;
