-- Search profiles resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of profiles resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_profiles_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_profiles_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_profiles_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_profiles_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH profile_emails AS (
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
    WHERE ppj.active = true
    GROUP BY ppj.profiles_id, ppj.profile_id
)
SELECT COALESCE(
    ARRAY_AGG(
        (q.profile_id, q.name, q.description, q.emails, q.primary_email)::types.q_get_profiles_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_profiles_v4_item[]
) as items
FROM (
    SELECT
        p.id AS profile_id,
        p.name,
        COALESCE(p.description, '') AS description,
        COALESCE(pem.emails, ARRAY[]::text[]) AS emails,
        pem.primary_email
    FROM profiles_resource p
    LEFT JOIN profile_emails AS pem ON pem.resource_id = p.id
    WHERE p.active = true
      AND (search IS NULL OR search = '' OR LOWER(p.name) LIKE '%' || LOWER(search) || '%' OR LOWER(COALESCE(p.description, '')) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (p.id = ANY(exclude_ids)))
    ORDER BY p.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
