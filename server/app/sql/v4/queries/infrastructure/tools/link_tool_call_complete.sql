-- Link tool to call in tool_calls_junction
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'infra_link_tool_call_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infra_link_tool_call_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create function
CREATE OR REPLACE FUNCTION infra_link_tool_call_v4(
    p_tool_id uuid,
    p_call_id uuid
)
RETURNS TABLE (
    success boolean
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO tool_calls_junction (tool_id, call_id)
    VALUES (p_tool_id, p_call_id)
    ON CONFLICT DO NOTHING;

    SELECT true as success;
$$;
