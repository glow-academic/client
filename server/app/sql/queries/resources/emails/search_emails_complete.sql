-- Search emails resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of email resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_emails_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_emails_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_emails_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    profile boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_emails_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.email, q.generated)::types.q_get_emails_v4_item
        ORDER BY q.email
    ),
    ARRAY[]::types.q_get_emails_v4_item[]
) as items
FROM (
    SELECT e.id, e.email, COALESCE(e.generated, false) AS generated
    FROM emails_resource e
    WHERE e.email IS NOT NULL
      AND e.email != ''
      AND e.active = true
      -- Search filter
      AND (search IS NULL OR search = '' OR LOWER(e.email) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (e.id = ANY(exclude_ids)))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT profile OR EXISTS (SELECT 1 FROM profile_emails_junction j WHERE j.emails_id = e.id AND j.active = true))
    ORDER BY e.email
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
