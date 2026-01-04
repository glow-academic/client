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
CREATE OR REPLACE FUNCTION infra_insert_debug_info_v4(
    run_id uuid,
    content text
)
RETURNS TABLE (
    success boolean
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO debug_info (run_id, content, created_at)
    VALUES (run_id, content, NOW());
    SELECT true as success;
$$;