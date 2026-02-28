-- Mark call as completed
-- Inserts into calls_completion_entry for the call matching the given external_call_id

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_mark_call_completed_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_mark_call_completed_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_mark_call_completed_v4(
    external_call_id text
)
RETURNS TABLE (
    updated boolean
)
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
    INSERT INTO calls_completion_entry (call_id)
    SELECT c.id
    FROM calls_entry c
    WHERE c.external_call_id = api_mark_call_completed_v4.external_call_id
    ON CONFLICT (call_id) DO NOTHING;

    RETURN QUERY SELECT true as updated;
END;
$$;
