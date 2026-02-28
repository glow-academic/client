-- Get call record by external_call_id
-- Returns call id, tool_id, template_id, and arguments_raw

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_call_by_external_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_call_by_external_id_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_call_by_external_id_v4(
    external_call_id text
)
RETURNS TABLE (
    id uuid,
    tool_id uuid,
    arguments_raw text
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        c.id,
        tcj.tools_id,
        cce.arguments_raw
    FROM calls_entry c
    JOIN tools_calls_connection tcj ON tcj.call_id = c.id
    LEFT JOIN calls_completion_entry cce ON cce.call_id = c.id
    WHERE c.external_call_id = external_call_id
    LIMIT 1;
$$;
