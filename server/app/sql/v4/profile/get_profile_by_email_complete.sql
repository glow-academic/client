-- Get profile by email
-- Converted to function
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
        WHERE proname = 'api_get_profile_by_email_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_profile_by_email_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_get_profile_by_email_v4(
    email text,
    profile_id uuid DEFAULT NULL
)
RETURNS TABLE (
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
    primary_department_id uuid,
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT email AS email,
           profile_id AS profile_id
),
actor_name_computed AS (
    -- Compute actor_name from profile_id if provided (for audit logging)
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params) IS NOT NULL THEN
                (SELECT first_name || ' ' || last_name 
                 FROM profiles 
                 WHERE id = (SELECT profile_id FROM params))
            ELSE NULL
        END as actor_name
),
target_profile AS (
    SELECT 
        p.id,
        p.first_name,
        p.last_name,
        ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
        p.role,
        p.active,
        prl.requests_per_day as req_per_day,
        p.last_login,
        pa.last_active,
        p.created_at,
        p.updated_at,
        pd.department_id as primary_department_id
    FROM profiles p
    JOIN profile_emails pe_match ON pe_match.profile_id = p.id AND pe_match.email = (SELECT email FROM params) AND pe_match.active = true
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE AND pd.active = true
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN LATERAL (
        SELECT last_active 
        FROM profile_activity 
        WHERE profile_id = p.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) pa ON true
    GROUP BY p.id, p.first_name, p.last_name, p.role, p.active, 
             prl.requests_per_day, p.last_login, pa.last_active, 
             p.created_at, p.updated_at, pd.department_id
)
SELECT 
    tp.id as profile_id,
    tp.first_name,
    tp.last_name,
    COALESCE(tp.emails, ARRAY[]::text[]) as emails,
    tp.primary_email,
    tp.role,
    tp.active,
    tp.req_per_day,
    tp.last_login,
    tp.last_active,
    tp.created_at,
    tp.updated_at,
    tp.primary_department_id,
    anc.actor_name
FROM target_profile tp
CROSS JOIN actor_name_computed anc
LIMIT 1
$$;