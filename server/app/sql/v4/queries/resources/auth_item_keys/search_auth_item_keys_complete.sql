-- Search auth_item_keys resources
-- Parameters: search, limit_count, offset_count, exclude_ids
-- Returns: items (array of auth_item_keys resources)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_auth_item_keys_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_auth_item_keys_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_search_auth_item_keys_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    setting boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_auth_item_keys_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            q.id,
            q.auth_id,
            q.item_id,
            q.key_id,
            q.auth_name,
            q.key_name,
            q.key_description,
            q.active,
            q.generated
        )::types.q_get_auth_item_keys_v4_item
        ORDER BY q.auth_name, q.key_name
    ),
    ARRAY[]::types.q_get_auth_item_keys_v4_item[]
) AS items
FROM (
    SELECT
        akr.id,
        akr.auth_id,
        akr.item_id,
        akr.key_id,
        COALESCE(ar.name, '') AS auth_name,
        COALESCE(kr.name, '') AS key_name,
        COALESCE(kr.description, '') AS key_description,
        COALESCE(akr.active, true) AS active,
        COALESCE(akr.generated, false) AS generated
    FROM auth_item_keys_resource akr
    LEFT JOIN auths_resource ar ON ar.id = akr.auth_id
    LEFT JOIN keys_resource kr ON kr.id = akr.key_id
    WHERE akr.active = true
      AND (
        search IS NULL
        OR search = ''
        OR LOWER(COALESCE(ar.name, '')) LIKE '%' || LOWER(search) || '%'
        OR LOWER(COALESCE(kr.name, '')) LIKE '%' || LOWER(search) || '%'
        OR LOWER(COALESCE(kr.description, '')) LIKE '%' || LOWER(search) || '%'
      )
      AND (exclude_ids IS NULL OR NOT (akr.id = ANY(exclude_ids)))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT setting OR EXISTS (SELECT 1 FROM setting_auth_item_keys_junction j WHERE j.auth_item_keys_id = akr.id AND j.active = true))
    ORDER BY COALESCE(ar.name, ''), COALESCE(kr.name, '')
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
