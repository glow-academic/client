-- Search provider_keys resources
-- Parameters: search, limit_count, offset_count, exclude_ids
-- Returns: items (array of provider_keys resources)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_provider_keys_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_provider_keys_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_search_provider_keys_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    provider_ids uuid[] DEFAULT ARRAY[]::uuid[],
    key_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    setting boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_provider_keys_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            q.id,
            q.provider_id,
            q.key_id,
            q.provider_name,
            q.key_name,
            q.key_description,
            q.active,
            q.generated
        )::types.q_get_provider_keys_v4_item
        ORDER BY q.provider_name, q.key_name
    ),
    ARRAY[]::types.q_get_provider_keys_v4_item[]
) AS items
FROM (
    SELECT
        pkr.id,
        pkr.provider_id,
        pkr.key_id,
        COALESCE(pr.name, '') AS provider_name,
        COALESCE(kr.name, '') AS key_name,
        COALESCE(kr.description, '') AS key_description,
        COALESCE(pkr.active, true) AS active,
        COALESCE(pkr.generated, false) AS generated
    FROM provider_keys_resource pkr
    LEFT JOIN providers_resource pr ON pr.id = pkr.provider_id
    LEFT JOIN keys_resource kr ON kr.id = pkr.key_id
    WHERE pkr.active = true
      AND (
        search IS NULL
        OR search = ''
        OR LOWER(COALESCE(pr.name, '')) LIKE '%' || LOWER(search) || '%'
        OR LOWER(COALESCE(kr.name, '')) LIKE '%' || LOWER(search) || '%'
        OR LOWER(COALESCE(kr.description, '')) LIKE '%' || LOWER(search) || '%'
      )
      AND (exclude_ids IS NULL OR NOT (pkr.id = ANY(exclude_ids)))
      AND (COALESCE(array_length(provider_ids, 1), 0) = 0 OR pkr.provider_id = ANY(provider_ids))
      AND (COALESCE(array_length(key_ids, 1), 0) = 0 OR pkr.key_id = ANY(key_ids))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT setting OR EXISTS (SELECT 1 FROM setting_provider_keys_junction j WHERE j.provider_key_id = pkr.id AND j.active = true))
    ORDER BY COALESCE(pr.name, ''), COALESCE(kr.name, '')
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
