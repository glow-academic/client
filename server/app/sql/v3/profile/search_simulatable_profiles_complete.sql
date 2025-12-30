-- Search simulatable profiles query
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_search_simulatable_profiles_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_simulatable_profiles_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_search_simulatable_profiles_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_search_simulatable_profiles_v3_profile AS (
    profile_id uuid,
    first_name text,
    last_name text,
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
CREATE OR REPLACE FUNCTION api_search_simulatable_profiles_v3(
    profile_id uuid,
    limit_count integer,
    query text
)
RETURNS TABLE (
    actor_name text,
    profiles types.q_search_simulatable_profiles_v3_profile[]
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
        role,
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM profiles p
    WHERE p.id = (SELECT profile_id FROM params)
),
requester_role AS (
    SELECT role FROM requester_profile
),
simulatable_data AS (
    SELECT 
        p.id,
        p.first_name,
        p.last_name,
        ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
        p.role,
        p.active,
        COALESCE(prl.requests_per_day, 0) as req_per_day,
        p.last_login,
        pa.last_active,
        p.created_at,
        p.updated_at,
        pd.department_id as primary_department_id
    FROM profiles p
    CROSS JOIN requester_role rr
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN LATERAL (
        SELECT last_active 
        FROM profile_activity 
        WHERE profile_id = p.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) pa ON true
    WHERE p.id != (SELECT profile_id FROM params)
      AND CASE 
        WHEN rr.role = profile_role.superadmin THEN true
        WHEN rr.role = profile_role.admin THEN p.role IN (profile_role.instructional, profile_role.member, profile_role.guest)
        WHEN rr.role = profile_role.instructional THEN p.role IN (profile_role.member, profile_role.guest)
        ELSE false
      END
      AND ((SELECT query FROM params) IS NULL OR (SELECT query FROM params) = '' OR (p.first_name ILIKE '%' || (SELECT query FROM params) || '%' OR p.last_name ILIKE '%' || (SELECT query FROM params) || '%' OR EXISTS (SELECT 1 FROM profile_emails pe WHERE pe.profile_id = p.id AND pe.active = true AND pe.email ILIKE '%' || (SELECT query FROM params) || '%') OR p.role::text ILIKE '%' || (SELECT query FROM params) || '%' OR (p.first_name || ' ' || p.last_name) ILIKE '%' || (SELECT query FROM params) || '%'))
    GROUP BY p.id, p.first_name, p.last_name, p.role, p.active, 
             prl.requests_per_day, p.last_login, pa.last_active, 
             p.created_at, p.updated_at, pd.department_id
    ORDER BY p.first_name, p.last_name
    LIMIT (SELECT limit_count FROM params)
)
SELECT 
    (SELECT actor_name FROM requester_profile)::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (sp.id, sp.first_name, sp.last_name, COALESCE(sp.emails, ARRAY[]::text[]), sp.primary_email, sp.role, sp.active, sp.req_per_day, sp.last_login, sp.last_active, sp.created_at, sp.updated_at, sp.primary_department_id)::types.q_search_simulatable_profiles_v3_profile
            ORDER BY sp.first_name, sp.last_name
        ),
        '{}'::types.q_search_simulatable_profiles_v3_profile[]
    ) as profiles
FROM simulatable_data sp
$$;

COMMIT;
