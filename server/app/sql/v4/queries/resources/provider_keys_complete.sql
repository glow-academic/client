-- Create provider_keys resource from provider + key pair
-- Parameters: provider_id (uuid), key_id (uuid), mcp (boolean)
-- Returns: provider_keys_id (uuid)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_provider_keys_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_provider_keys_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_provider_keys_v4(
    provider_id uuid,
    key_id uuid,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    provider_keys_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_provider_keys_id uuid;
    v_key text;
    v_name text;
    v_description text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM providers_resource p WHERE p.id = api_create_provider_keys_v4.provider_id) THEN
        RAISE EXCEPTION 'Provider resource not found: %', api_create_provider_keys_v4.provider_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM keys_resource k WHERE k.id = api_create_provider_keys_v4.key_id) THEN
        RAISE EXCEPTION 'Key resource not found: %', api_create_provider_keys_v4.key_id;
    END IF;

    SELECT
        COALESCE(k.key, ''),
        COALESCE(k.name, ''),
        COALESCE(k.description, '')
    INTO v_key, v_name, v_description
    FROM keys_resource k
    WHERE k.id = api_create_provider_keys_v4.key_id
    LIMIT 1;

    SELECT pkr.id
    INTO v_provider_keys_id
    FROM provider_keys_resource pkr
    WHERE pkr.provider_id = api_create_provider_keys_v4.provider_id
      AND pkr.key_id = api_create_provider_keys_v4.key_id
    ORDER BY pkr.created_at DESC
    LIMIT 1;

    IF v_provider_keys_id IS NOT NULL THEN
        UPDATE provider_keys_resource
        SET
            active = true,
            mcp = api_create_provider_keys_v4.mcp,
            key = v_key,
            name = v_name,
            description = v_description
        WHERE id = v_provider_keys_id;

        RETURN QUERY SELECT v_provider_keys_id;
        RETURN;
    END IF;

    INSERT INTO provider_keys_resource (
        provider_id,
        key_id,
        active,
        generated,
        mcp,
        key,
        name,
        description
    )
    VALUES (
        api_create_provider_keys_v4.provider_id,
        api_create_provider_keys_v4.key_id,
        true,
        false,
        api_create_provider_keys_v4.mcp,
        v_key,
        v_name,
        v_description
    )
    RETURNING id INTO v_provider_keys_id;

    RETURN QUERY SELECT v_provider_keys_id;
END;
$$;
