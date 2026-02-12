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

-- Create function - query profiles_resource directly (emails denormalized)
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
        COALESCE(p.emails, ARRAY[]::text[]) AS emails,
        p.primary_email
    FROM profiles_resource p
    WHERE p.active = true
      AND (search IS NULL OR search = '' OR LOWER(p.name) LIKE '%' || LOWER(search) || '%' OR LOWER(COALESCE(p.description, '')) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (p.id = ANY(exclude_ids)))
    ORDER BY p.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
