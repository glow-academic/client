-- Insert debug info for a model run
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_insert_debug_info_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_insert_debug_info_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
-- Creates debug_info record and links to run via run_debug_info junction table
CREATE OR REPLACE FUNCTION api_insert_debug_info_v4(
    run_id_param uuid,
    content_param text
)
RETURNS TABLE (
    run_id uuid,
    content text,
    created_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    debug_info_id_val uuid;
    debug_info_created_at timestamptz;
BEGIN
    -- Create debug_info record
    INSERT INTO debug_info_resource (content, created_at)
    VALUES (content_param, NOW())
    RETURNING id, created_at INTO debug_info_id_val, debug_info_created_at;
    
    -- Link to run via junction table
    INSERT INTO run_debug_info (run_id, debug_info_id, created_at)
    VALUES (run_id_param, debug_info_id_val, NOW())
    ON CONFLICT (run_id, debug_info_id) DO NOTHING;
    
    -- Return result
    RETURN QUERY SELECT run_id_param, content_param, debug_info_created_at;
END;
$$;