-- Create profile if not exists (INSERT only, no update on conflict)
-- For use by auth flows - never modifies existing profiles
-- Uses safe drop/recreate pattern: drop function first, then recreate
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_profile_if_not_exists_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_profile_if_not_exists_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_create_profile_if_not_exists_v4(
    name text,
    email text,  -- Single primary email for auth flows
    role text DEFAULT 'guest'
)
RETURNS TABLE (
    profile_id uuid,
    created boolean,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        gen_random_uuid() AS profile_id_new,
        name AS name,
        email AS email,
        COALESCE(role, 'guest') AS role
),
-- Check if profile already exists by email
existing_profile AS (
    SELECT pe.profile_id as id
    FROM profile_emails_junction pe
    JOIN emails_resource e ON pe.email_id = e.id
    WHERE e.email = (SELECT email FROM params)
      AND pe.active = true
    LIMIT 1
),
-- If profile exists, return it without modifications
existing_result AS (
    SELECT
        ep.id as profile_id,
        false as created,
        (SELECT n.name
         FROM profile_names_junction pn
         JOIN names_resource n ON pn.name_id = n.id
         WHERE pn.profile_id = ep.id
         LIMIT 1) as actor_name
    FROM existing_profile ep
    WHERE ep.id IS NOT NULL
),
-- Only proceed with creation if profile doesn't exist
new_group AS (
    INSERT INTO groups_entry (id, created_at, updated_at)
    SELECT uuidv7(), NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM existing_profile)
    RETURNING id
),
placeholder_call_id AS (
    SELECT id FROM calls_entry LIMIT 1
),
-- Insert name in names table (only if creating)
name_resource AS (
    INSERT INTO names_resource (name, created_at, call_id)
    SELECT (SELECT name FROM params), NOW(), (SELECT id FROM placeholder_call_id)
    WHERE NOT EXISTS (SELECT 1 FROM existing_profile)
      AND (SELECT name FROM params) IS NOT NULL
      AND (SELECT name FROM params) != ''
    ON CONFLICT (name) DO NOTHING
    RETURNING id as name_id, name
),
-- Get name_id (either from insert or existing)
name_id_lookup AS (
    SELECT COALESCE(
        (SELECT name_id FROM name_resource),
        (SELECT id FROM names_resource WHERE name = (SELECT name FROM params))
    ) as name_id
),
-- Insert profile (only if creating)
profile_insert AS (
    INSERT INTO profile_artifact (id, group_id, updated_at)
    SELECT
        (SELECT profile_id_new FROM params),
        (SELECT id FROM new_group),
        NOW()
    WHERE NOT EXISTS (SELECT 1 FROM existing_profile)
      AND EXISTS (SELECT 1 FROM new_group)
    RETURNING id, true as created
),
-- Insert role (only if creating)
role_resource AS (
    INSERT INTO roles_resource (role, created_at, active, generated, mcp, call_id)
    SELECT (SELECT role FROM params)::profile_type, NOW(), true, false, false, (SELECT id FROM placeholder_call_id)
    WHERE EXISTS (SELECT 1 FROM profile_insert)
    ON CONFLICT (role) DO NOTHING
    RETURNING id as role_id
),
role_id_lookup AS (
    SELECT COALESCE(
        (SELECT role_id FROM role_resource),
        (SELECT id FROM roles_resource WHERE role = (SELECT role FROM params)::profile_type)
    ) as role_id
),
profile_type_insert AS (
    INSERT INTO profile_roles_junction (profile_id, role_id, created_at, generated, mcp)
    SELECT pi.id, rl.role_id, NOW(), false, false
    FROM profile_insert pi
    CROSS JOIN role_id_lookup rl
    WHERE rl.role_id IS NOT NULL
    ON CONFLICT (profile_id, role_id) DO NOTHING
    RETURNING profile_id
),
-- Link profile to name (only if creating)
link_profile_name AS (
    INSERT INTO profile_names_junction (profile_id, name_id, created_at)
    SELECT pi.id, nl.name_id, NOW()
    FROM profile_insert pi
    CROSS JOIN name_id_lookup nl
    WHERE nl.name_id IS NOT NULL
    ON CONFLICT (profile_id) DO NOTHING
),
-- Set profile active flag (only if creating)
set_profile_active AS (
    INSERT INTO profile_flags_junction (profile_id, flag_id, value, created_at)
    SELECT pi.id, f.id, true, NOW()
    FROM profile_insert pi
    CROSS JOIN flags_resource f
    WHERE f.name = 'profile_active'
    ON CONFLICT (profile_id, flag_id) DO NOTHING
),
-- Insert email resource (only if creating)
email_resource AS (
    INSERT INTO emails_resource (email, call_id, created_at)
    SELECT (SELECT email FROM params), (SELECT id FROM placeholder_call_id), NOW()
    WHERE EXISTS (SELECT 1 FROM profile_insert)
    ON CONFLICT (email) DO NOTHING
    RETURNING id as email_id, email
),
email_id_lookup AS (
    SELECT COALESCE(
        (SELECT email_id FROM email_resource),
        (SELECT id FROM emails_resource WHERE email = (SELECT email FROM params))
    ) as email_id
),
-- Link email to profile (only if creating)
email_insert AS (
    INSERT INTO profile_emails_junction (profile_id, email, email_id, is_primary, active)
    SELECT pi.id, (SELECT email FROM params), el.email_id, true, true
    FROM profile_insert pi
    CROSS JOIN email_id_lookup el
    WHERE el.email_id IS NOT NULL
    ON CONFLICT (profile_id, email_id) DO NOTHING
),
-- Return result from new profile creation
new_result AS (
    SELECT
        pi.id as profile_id,
        pi.created,
        (SELECT name FROM params)::text as actor_name
    FROM profile_insert pi
)
-- Return existing profile if found, otherwise new profile
SELECT profile_id, created, actor_name FROM existing_result
UNION ALL
SELECT profile_id, created, actor_name FROM new_result
WHERE NOT EXISTS (SELECT 1 FROM existing_result)
LIMIT 1
$$;
