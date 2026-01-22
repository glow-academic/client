-- Search simulatable profiles query
-- Converted to function with composite types
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
        WHERE proname = 'api_search_simulatable_profiles_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_simulatable_profiles_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_search_simulatable_profiles_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_search_simulatable_profiles_v4_profile AS (
    profile_id uuid,
    name text,
    emails text[],
    primary_email text,
    role text,
    active boolean,
    req_per_day integer,
    last_login timestamptz,
    last_active timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    primary_department_id uuid
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_search_simulatable_profiles_v4(
    profile_id uuid,
    limit_count integer,
    query text
)
RETURNS TABLE (
    actor_name text,
    profiles types.q_search_simulatable_profiles_v4_profile[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        limit_count AS limit_count,
        query AS query
),
requester_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), 'System') as actor_name
    FROM profile_artifact p
    WHERE p.id = (SELECT profile_id FROM params)
),
requester_role AS (
    SELECT (SELECT r.role FROM profile_roles pr_j 
            JOIN roles_resource r ON pr_j.role_id = r.id 
            WHERE pr_j.profile_id = (SELECT profile_id FROM params) 
            LIMIT 1) as role
),
simulatable_data AS (
    SELECT 
        p.id,
        (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1) as name,
        ARRAY_AGG(e.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT e2.email FROM profile_emails pe2 JOIN emails_resource e2 ON pe2.email_id = e2.id WHERE pe2.profile_id = p.id AND pe2.is_primary = true AND pe2.active = true LIMIT 1) as primary_email,
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as role,
        EXISTS (SELECT 1 FROM profile_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'profile_active' AND pf.value = TRUE) as active,
        COALESCE(rl.requests_per_day, 0) as req_per_day,
        (SELECT le.last_login FROM logins_entry le WHERE le.profile_id = p.id ORDER BY le.created_at DESC LIMIT 1) as last_login,
        pa.last_active,
        p.created_at,
        p.updated_at,
        pd.department_id as primary_department_id
    FROM profile_artifact p
    CROSS JOIN requester_role rr
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN emails_resource e ON pe.email_id = e.id
    LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    LEFT JOIN LATERAL (
        SELECT last_active 
        FROM activity_entry 
        WHERE profile_id = p.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) pa ON true
    WHERE p.id != (SELECT profile_id FROM params)
      AND CASE 
        WHEN rr.role = 'superadmin'::profile_role THEN true
        WHEN rr.role = 'admin'::profile_role THEN (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role)
        WHEN rr.role = 'instructional'::profile_role THEN (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) IN ('member'::profile_role, 'guest'::profile_role)
        ELSE false
      END
      AND ((SELECT query FROM params) IS NULL OR (SELECT query FROM params) = '' OR ((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1) ILIKE '%' || (SELECT query FROM params) || '%' OR EXISTS (SELECT 1 FROM profile_emails pe_search JOIN emails_resource e_search ON pe_search.email_id = e_search.id WHERE pe_search.profile_id = p.id AND pe_search.active = true AND e_search.email ILIKE '%' || (SELECT query FROM params) || '%') OR (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1)::text ILIKE '%' || (SELECT query FROM params) || '%'))
    GROUP BY p.id, (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM profile_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'profile_active' AND pf.value = TRUE), 
             rl.requests_per_day, (SELECT le.last_login FROM logins_entry le WHERE le.profile_id = p.id ORDER BY le.created_at DESC LIMIT 1), pa.last_active, 
             p.created_at, p.updated_at, pd.department_id
    ORDER BY (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1)
    LIMIT (SELECT limit_count FROM params)
)
SELECT 
    (SELECT actor_name FROM requester_profile)::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (sp.id, sp.name, COALESCE(sp.emails, ARRAY[]::text[]), sp.primary_email, sp.role, sp.active, sp.req_per_day, sp.last_login, sp.last_active, sp.created_at, sp.updated_at, sp.primary_department_id)::types.q_search_simulatable_profiles_v4_profile
            ORDER BY sp.name NULLS LAST
        ),
        '{}'::types.q_search_simulatable_profiles_v4_profile[]
    ) as profiles
FROM simulatable_data sp
$$;
