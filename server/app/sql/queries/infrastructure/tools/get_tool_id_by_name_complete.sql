-- Get tool_id by tool name
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'infra_get_tool_id_by_name_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infra_get_tool_id_by_name_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create function
CREATE OR REPLACE FUNCTION infra_get_tool_id_by_name_v4(
    tool_name text
)
RETURNS TABLE (
    tool_id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT tt.tools_id as tool_id
    FROM tool_artifact t
    JOIN tool_names_junction tn ON tn.tool_id = t.id
    JOIN names_resource n ON n.id = tn.name_id
    JOIN tool_tools_junction tt ON tt.tool_id = t.id
    WHERE n.name = tool_name
      AND EXISTS (
          SELECT 1
          FROM tool_flags_junction tf
          JOIN flags_resource f ON f.id = tf.flag_id
          WHERE tf.tool_id = t.id
            AND f.name = 'tool_active'
            AND f.value = true
      )
    LIMIT 1;
$$;
