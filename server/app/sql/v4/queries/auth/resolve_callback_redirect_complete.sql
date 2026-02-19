-- Resolve redirect path for post-login callback
-- Lightweight query: only fetches role
-- Parameters: p_profile_id (uuid)
-- Returns: role, redirect_path (always /home now that routes are removed)

-- Drop function if exists (handle signature changes)
DO $$
BEGIN
    DROP FUNCTION IF EXISTS api_resolve_callback_redirect_v4(uuid);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_resolve_callback_redirect_v4(
    p_profile_id uuid
)
RETURNS TABLE (
    role text,
    redirect_path text
)
LANGUAGE sql
STABLE
AS $$
    WITH profile_role AS (
        SELECT r.role::text as role
        FROM profile_roles_junction pr
        JOIN roles_resource r ON pr.role_id = r.id
        WHERE pr.profile_id = p_profile_id
        LIMIT 1
    )
    SELECT
        (SELECT role FROM profile_role) as role,
        '/home'::text as redirect_path
    WHERE p_profile_id IS NOT NULL
$$;
