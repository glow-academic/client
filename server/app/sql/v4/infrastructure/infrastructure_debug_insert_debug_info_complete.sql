-- Insert debug info for a model run
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Drop function if exists (handle signature changes)
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS infra_insert_debug_info_v4(uuid, text);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create function
-- Creates debug_info record and links to run via run_debug_info junction table
CREATE OR REPLACE FUNCTION infra_insert_debug_info_v4(
    run_id uuid,
    content text
)
RETURNS TABLE (
    success boolean
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    debug_info_id_val uuid;
BEGIN
    -- Create debug_info record
    INSERT INTO debug_info_resource (content, created_at)
    VALUES (content, NOW())
    RETURNING id INTO debug_info_id_val;
    
    -- Link to run via junction table
    INSERT INTO run_debug_info (run_id, debug_info_id, created_at)
    VALUES (run_id, debug_info_id_val, NOW())
    ON CONFLICT (run_id, debug_info_id) DO NOTHING;
    
    RETURN QUERY SELECT true as success;
END;
$$;