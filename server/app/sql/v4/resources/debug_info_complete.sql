-- Create debug_info resource
-- Always INSERT operation (preserves all information)
-- Parameters: content text
-- Returns: debug_info_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_debug_info_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_debug_info_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_debug_info_v4(
    content text
)
RETURNS TABLE (
    debug_info_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_debug_info_id uuid;
BEGIN
    -- INSERT into debug_info table (always insert, never update)
    INSERT INTO debug_info(content, active)
    VALUES (content, true)
    RETURNING id INTO v_debug_info_id;

    RETURN QUERY SELECT v_debug_info_id;
END;
$$;