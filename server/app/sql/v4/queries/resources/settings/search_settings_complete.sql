-- Search settings resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of settings resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_settings_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_settings_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_settings_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    agent_ids uuid[] DEFAULT ARRAY[]::uuid[],
    provider_key_ids uuid[] DEFAULT ARRAY[]::uuid[],
    auth_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    department boolean DEFAULT false,
    setting boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_settings_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            q.settings_id,
            q.created_at,
            q.active,
            q.name,
            q.description,
            NULL,  -- primary_color
            NULL,  -- accent
            NULL,  -- background
            NULL,  -- surface
            NULL,  -- success
            NULL,  -- warning
            NULL,  -- error
            NULL,  -- sidebar_background
            NULL,  -- sidebar_primary
            NULL,  -- chart1
            NULL,  -- chart2
            NULL,  -- chart3
            NULL,  -- chart4
            NULL,  -- chart5
            false, -- guest_login_enabled
            NULL,  -- success_threshold
            NULL,  -- warning_threshold
            NULL,  -- danger_threshold
            ARRAY[]::text[],  -- auth_ids
            ARRAY[]::types.q_get_settings_v4_auth[],  -- auths
            q.provider_key_ids
        )::types.q_get_settings_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_settings_v4_item[]
) as items
FROM (
    SELECT
        r.id::text AS settings_id,
        r.created_at,
        r.active,
        COALESCE(r.name, '') AS name,
        COALESCE(r.description, '') AS description,
        COALESCE(r.provider_key_ids, ARRAY[]::uuid[]) AS provider_key_ids
    FROM settings_resource r
    WHERE r.active = true
      AND (search IS NULL OR search = '' OR LOWER(r.name) LIKE '%' || LOWER(search) || '%' OR LOWER(COALESCE(r.description, '')) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (r.id = ANY(exclude_ids)))
      AND (COALESCE(array_length(department_ids, 1), 0) = 0 OR r.department_ids && department_ids)
      AND (
        COALESCE(array_length(agent_ids, 1), 0) = 0
        OR EXISTS (
            SELECT 1
            FROM setting_systems_junction ssj
            JOIN systems_resource sr ON sr.id = ssj.systems_id
            WHERE ssj.setting_id = r.id
              AND ssj.active = true
              AND sr.active = true
              AND sr.agent_ids && agent_ids
        )
      )
      AND (COALESCE(array_length(provider_key_ids, 1), 0) = 0 OR r.provider_key_ids && provider_key_ids)
      AND (COALESCE(array_length(auth_ids, 1), 0) = 0 OR r.auth_ids && auth_ids)
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT department OR EXISTS (SELECT 1 FROM department_settings_junction j WHERE j.settings_id = r.id AND j.active = true))
      AND (NOT setting OR EXISTS (SELECT 1 FROM setting_settings_junction j WHERE j.settings_id = r.id AND j.active = true))
    ORDER BY r.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
