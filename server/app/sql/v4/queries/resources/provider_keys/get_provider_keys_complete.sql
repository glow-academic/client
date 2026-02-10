-- Get provider_keys resources by IDs
-- Parameters: ids (uuid[])
-- Returns: items (array of provider_keys resources)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_provider_keys_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_provider_keys_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_provider_keys_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_provider_keys_v4_item AS (
    id uuid,
    provider_id uuid,
    key_id uuid,
    provider_name text,
    key_name text,
    key_description text,
    active boolean,
    generated boolean
);

CREATE OR REPLACE FUNCTION api_get_provider_keys_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
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
            pkr.id,
            pkr.provider_id,
            pkr.key_id,
            COALESCE(pr.name, ''),
            COALESCE(kr.name, ''),
            COALESCE(kr.description, ''),
            COALESCE(pkr.active, true),
            COALESCE(pkr.generated, false)
        )::types.q_get_provider_keys_v4_item
        ORDER BY array_position(ids, pkr.id)
    ),
    ARRAY[]::types.q_get_provider_keys_v4_item[]
) AS items
FROM provider_keys_resource pkr
LEFT JOIN providers_resource pr ON pr.id = pkr.provider_id
LEFT JOIN keys_resource kr ON kr.id = pkr.key_id
WHERE pkr.id = ANY(ids)
  AND pkr.active = true;
$$;
