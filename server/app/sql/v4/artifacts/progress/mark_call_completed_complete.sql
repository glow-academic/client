-- Mark call as completed
-- Updates calls table to set completed = true for a given external_call_id

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
    UPDATE calls
    SET completed = true, updated_at = NOW()
    WHERE calls.external_call_id = mark_call_completed_v4.external_call_id;
    
    RETURN QUERY SELECT true as updated;
END;
$$;
