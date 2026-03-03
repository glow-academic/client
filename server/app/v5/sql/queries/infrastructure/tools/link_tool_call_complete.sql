-- Link tool to call in tools_calls_connection
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
    tool_id uuid,
    call_id uuid
)
RETURNS TABLE (
    success boolean
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO tools_calls_connection (tools_id, call_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING;

    SELECT true as success;
$$;
