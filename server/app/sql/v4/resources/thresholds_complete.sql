-- Create thresholds resource
-- Always INSERT operation (preserves all information)
-- Parameters: value numeric
-- Returns: threshold_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_thresholds_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_thresholds_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_thresholds_v4(
    value numeric
)
RETURNS TABLE (
    threshold_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_threshold_id uuid;
BEGIN
    -- INSERT into thresholds table (always insert, never update)
    INSERT INTO thresholds(value, active)
    VALUES (value, true)
    RETURNING id INTO v_threshold_id;

    RETURN QUERY SELECT v_threshold_id;
END;
$$;