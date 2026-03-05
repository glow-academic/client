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
    name text,
    emails text[],
    primary_email text,
    role text,
    active boolean,
    req_per_day integer,
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
                COALESCE(
                    (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) LIMIT 1),
                    ''
                )
            ELSE NULL
        END as actor_name
),
target_profile AS (
    SELECT 
        p.id,
        (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1) as name,
        ARRAY_AGG(e.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT e2.email FROM profile_emails_junction pe2 JOIN emails_resource e2 ON pe2.email_id = e2.id WHERE pe2.profile_id = p.id AND pe2.is_primary = true AND pe2.active = true LIMIT 1) as primary_email,
        (SELECT r.role FROM profile_roles_junction pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as role,
        EXISTS (SELECT 1 FROM profile_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'profile_active' AND f.value = TRUE) as active,
        rl.requests_per_day as req_per_day,
        p.created_at,
        p.updated_at,
        pd.department_id as primary_department_id
    FROM profile_artifact p
    JOIN profile_emails_junction pe_match ON pe_match.profile_id = p.id AND pe_match.active = true
    JOIN emails_resource e_match ON pe_match.email_id = e_match.id AND e_match.email = (SELECT email FROM params)
    LEFT JOIN profile_emails_junction pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN emails_resource e ON pe.email_id = e.id
    LEFT JOIN profile_departments_junction pd ON p.id = pd.profile_id AND pd.is_primary = TRUE AND pd.active = true
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    GROUP BY p.id, (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM profile_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'profile_active' AND f.value = TRUE),
             rl.requests_per_day,
             p.created_at, p.updated_at, pd.department_id
)
SELECT 
    tp.id as profile_id,
    tp.name,
    COALESCE(tp.emails, ARRAY[]::text[]) as emails,
    tp.primary_email,
    tp.role,
    tp.active,
    tp.req_per_day,
    tp.created_at,
    tp.updated_at,
    tp.primary_department_id,
    anc.actor_name
FROM target_profile tp
CROSS JOIN actor_name_computed anc
LIMIT 1
$$;
