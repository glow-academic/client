-- Insert audit record (profile_id can be NULL)
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Drop function if exists (handle signature changes)
DO $$
BEGIN
    DROP FUNCTION IF EXISTS infra_insert_activity_v4(text, text, uuid, boolean);
    DROP FUNCTION IF EXISTS infra_insert_activity_v4(text, text, uuid, boolean, uuid);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION infra_insert_activity_v4(
    message text,
    endpoint text,
    profile_id uuid,
    error boolean,
    session_id uuid DEFAULT NULL
)
RETURNS TABLE (
    success boolean
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_audit AS (
        INSERT INTO audits_entry (message, endpoint, error, session_id, created_at)
        VALUES (message, endpoint, error, session_id, now())
        RETURNING id
    ),
    link_profile AS (
        INSERT INTO profiles_audits_connection (profiles_id, audit_id)
        SELECT profile_id, na.id
        FROM new_audit na
        WHERE profile_id IS NOT NULL
    )
    SELECT true as success;
$$;
