-- Get auth_keys resources by IDs
-- Parameters: ids (uuid[])
-- Returns: items (array of auth_keys resources)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_auth_keys_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_auth_keys_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_auth_keys_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_auth_keys_v4_item AS (
    id uuid,
    auth_id uuid,
    key_id uuid,
    auth_name text,
    key_name text,
    key_description text,
    active boolean,
    generated boolean
);

CREATE OR REPLACE FUNCTION api_get_auth_keys_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_auth_keys_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            akr.id,
            akr.auth_id,
            akr.key_id,
            COALESCE(ar.name, ''),
            COALESCE(kr.name, ''),
            COALESCE(kr.description, ''),
            COALESCE(akr.active, true),
            COALESCE(akr.generated, false)
        )::types.q_get_auth_keys_v4_item
        ORDER BY array_position(ids, akr.id)
    ),
    ARRAY[]::types.q_get_auth_keys_v4_item[]
) AS items
FROM auth_keys_resource akr
LEFT JOIN auths_resource ar ON ar.id = akr.auth_id
LEFT JOIN keys_resource kr ON kr.id = akr.key_id
WHERE akr.id = ANY(ids)
  AND akr.active = true;
$$;
