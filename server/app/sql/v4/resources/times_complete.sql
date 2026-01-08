-- Create times resource
-- Always INSERT operation (preserves all information)
-- Parameters: time_taken numeric
-- Returns: time_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_times_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_times_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_times_v4(
    time_taken numeric
)
RETURNS TABLE (
    time_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_time_id uuid;
BEGIN
    -- INSERT into times table (always insert, never update)
    INSERT INTO times(time_taken, active)
    VALUES (time_taken, true)
    RETURNING id INTO v_time_id;

    RETURN QUERY SELECT v_time_id;
END;
$$;