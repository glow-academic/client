-- Authorize emulation endpoint - check if emulation is authorized
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_authorize_emulation_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_authorize_emulation_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_authorize_emulation_v4(
    requester_profile_id uuid,
    target_profile_id uuid
)
RETURNS TABLE (
    allowed boolean,
    reason text,
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        requester_profile_id AS requester_profile_id,
        target_profile_id AS target_profile_id
),
self_emulation_check AS (
    -- Check if trying to emulate self (always allowed)
    SELECT 
        CASE 
            WHEN (SELECT requester_profile_id FROM params) = (SELECT target_profile_id FROM params) THEN true
            ELSE false
        END as is_self_emulation
),
requester_role AS (
    -- Get requester's role for permission check
    SELECT (SELECT r.role FROM profile_roles pr_j 
            JOIN roles_resource r ON pr_j.role_id = r.id 
            WHERE pr_j.profile_id = p.id 
            LIMIT 1) as role
    FROM profile_artifact p
    WHERE p.id = (SELECT requester_profile_id FROM params)
),
simulatable_profiles AS (
    -- Get simulatable profiles for the requester based on role hierarchy
    SELECT 
        p.id
    FROM profile_artifact p
    CROSS JOIN requester_role rr
    WHERE p.id != (SELECT requester_profile_id FROM params)
      AND CASE 
        WHEN rr.role = 'superadmin'::profile_role THEN true
        WHEN rr.role = 'admin'::profile_role THEN (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role)
        WHEN rr.role = 'instructional'::profile_role THEN (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) IN ('member'::profile_role, 'guest'::profile_role)
        ELSE false
      END
),
target_in_simulatable AS (
    -- Check if target is in simulatable list
    SELECT EXISTS(
        SELECT 1 
        FROM simulatable_profiles sp
        WHERE sp.id = (SELECT target_profile_id FROM params)
    ) as is_simulatable
),
actor_name_computed AS (
    -- Compute actor_name from requester profile
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM profile_artifact p
    WHERE p.id = (SELECT requester_profile_id FROM params)
)
SELECT 
    CASE 
        WHEN (SELECT is_self_emulation FROM self_emulation_check) THEN true
        WHEN (SELECT is_simulatable FROM target_in_simulatable) THEN true
        ELSE false
    END as allowed,
    CASE 
        WHEN (SELECT is_self_emulation FROM self_emulation_check) THEN NULL::text
        WHEN (SELECT is_simulatable FROM target_in_simulatable) THEN NULL::text
        ELSE 'You do not have permission to emulate this profile'
    END as reason,
    (SELECT actor_name FROM actor_name_computed) as actor_name
$$;