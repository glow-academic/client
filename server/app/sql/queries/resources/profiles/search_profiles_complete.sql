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
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[],
    role_ids uuid[] DEFAULT ARRAY[]::uuid[],
    role text DEFAULT NULL,
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    profile boolean DEFAULT false,
    setting boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_profiles_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.profile_id, q.name, q.description, q.emails, q.primary_email, q.requests_per_day)::types.q_get_profiles_v4_item
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
        p.primary_email,
        p.requests_per_day
    FROM profiles_resource p
    WHERE p.active = true
      AND (search IS NULL OR search = '' OR LOWER(p.name) LIKE '%' || LOWER(search) || '%' OR LOWER(COALESCE(p.description, '')) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (p.id = ANY(exclude_ids)))
      AND (COALESCE(array_length(department_ids, 1), 0) = 0 OR p.department_ids && department_ids)
      AND (COALESCE(array_length(cohort_ids, 1), 0) = 0 OR EXISTS (
          SELECT 1 FROM cohorts_resource cr WHERE p.id = ANY(cr.profile_ids) AND cr.id = ANY(cohort_ids)
      ))
      AND (COALESCE(array_length(role_ids, 1), 0) = 0 OR p.role_id = ANY(role_ids))
      AND (api_search_profiles_v4.role IS NULL OR p.role::text = api_search_profiles_v4.role)
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT profile OR EXISTS (SELECT 1 FROM profile_profiles_junction j WHERE j.profiles_id = p.id AND j.active = true))
      AND (NOT setting OR EXISTS (SELECT 1 FROM setting_profiles_junction j WHERE j.profiles_id = p.id AND j.active = true))
    ORDER BY p.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
