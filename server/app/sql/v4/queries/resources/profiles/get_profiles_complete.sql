-- Get profiles resources by IDs (batch)
-- Simple data fetching
-- Parameters: p_ids (uuid[])
-- Returns: items (array of profile resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_profiles_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_profiles_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_profiles_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for profile item
CREATE TYPE types.q_get_profiles_v4_item AS (
    profile_id uuid,
    name text,
    description text,
    emails text[],
    primary_email text
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_profiles_v4(
    p_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_profiles_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH profile_emails AS (
    -- Bridge: profiles_resource.id -> profile_profiles_junction -> profile_artifact.id -> profile_emails_junction -> emails_resource
    SELECT
        ppj.profiles_id as resource_id,
        ARRAY_AGG(e.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE e.email IS NOT NULL) as emails,
        (SELECT e2.email
         FROM profile_emails_junction pe2
         JOIN emails_resource e2 ON pe2.email_id = e2.id
         WHERE pe2.profile_id = ppj.profile_id
           AND pe2.is_primary = true
           AND pe2.active = true
         LIMIT 1) as primary_email
    FROM profile_profiles_junction ppj
    JOIN profile_emails_junction pe ON pe.profile_id = ppj.profile_id AND pe.active = true
    JOIN emails_resource e ON pe.email_id = e.id
    WHERE ppj.profiles_id = ANY(p_ids)
      AND ppj.active = true
    GROUP BY ppj.profiles_id, ppj.profile_id
)
SELECT COALESCE(
    ARRAY_AGG(
        (
            p.id,
            p.name,
            COALESCE(p.description, ''),
            COALESCE(pem.emails, ARRAY[]::text[]),
            pem.primary_email
        )::types.q_get_profiles_v4_item
        ORDER BY array_position(p_ids, p.id)
    ),
    ARRAY[]::types.q_get_profiles_v4_item[]
) as items
FROM profiles_resource p
LEFT JOIN profile_emails AS pem ON pem.resource_id = p.id
WHERE p.id = ANY(p_ids)
  AND p.active = true;
$$;
