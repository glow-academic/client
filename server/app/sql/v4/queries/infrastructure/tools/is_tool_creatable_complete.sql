-- Check if a tool is creatable (creates new resources) or a link tool (lookups existing)
-- Returns true for create_* tools, false for link_* tools
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'infrastructure_tools_is_creatable_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_tools_is_creatable_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create function
CREATE OR REPLACE FUNCTION infrastructure_tools_is_creatable_v4(
    p_tool_id uuid
)
RETURNS TABLE (
    is_creatable boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        (
            SELECT tf.value
            FROM tool_flags_junction tf
            JOIN flags_resource f ON f.id = tf.flag_id
            WHERE tf.tool_id = p_tool_id
              AND f.name = 'tool_creatable'
        ),
        true  -- Default to true (creatable) if flag not set
    ) as is_creatable;
$$;
