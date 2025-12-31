-- Insert activity record for WebSocket events (profile_id can be NULL)
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then recreate

BEGIN;

-- Drop function if exists (handle signature changes)
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS infra_insert_activity_websocket_v3(text, text, uuid, boolean);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION infra_insert_activity_websocket_v3(
    message text,
    endpoint text,
    profile_id uuid,
    error boolean
)
RETURNS TABLE (
    success boolean
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO activity (message, endpoint, profile_id, error, created_at)
    VALUES (message, endpoint, profile_id, error, now());
    SELECT true as success;
$$;

COMMIT;

