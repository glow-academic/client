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
-- Creates view_debug_info_entry record with run_id directly (no junction table)
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
    INSERT INTO debug_info_entry (content, run_id, created_at)
    VALUES (content, run_id, NOW());
    SELECT true as success;
$$;