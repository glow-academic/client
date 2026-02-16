-- Resolve redirect path for post-login callback
-- Lightweight query: only fetches role + first available route
-- Parameters: p_profile_id (uuid)
-- Returns: role, redirect_path (first non-parameterized available route)

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
    ),
    first_route AS (
        SELECT rr.route::text as route
        FROM profile_routes_junction pr
        JOIN routes_resource rr ON rr.id = pr.route_id
        WHERE pr.profile_id = p_profile_id
          AND pr.active = true
          AND rr.route::text NOT LIKE '%[%'
        ORDER BY rr.route
        LIMIT 1
    )
    SELECT
        (SELECT role FROM profile_role) as role,
        COALESCE((SELECT route FROM first_route), '/home'::text) as redirect_path
    WHERE p_profile_id IS NOT NULL
$$;
