-- Create auth_item_keys resource from auth + item + key tuple
-- Parameters: auth_id (uuid), item_id (uuid), key_id (uuid), mcp (boolean)
-- Returns: auth_item_keys_id (uuid)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_auth_item_keys_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_auth_item_keys_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_auth_item_keys_v4(
    auth_id uuid,
    item_id uuid,
    key_id uuid,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    auth_item_keys_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_auth_item_keys_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auths_resource a WHERE a.id = api_create_auth_item_keys_v4.auth_id) THEN
        RAISE EXCEPTION 'Auth resource not found: %', api_create_auth_item_keys_v4.auth_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM items_resource i WHERE i.id = api_create_auth_item_keys_v4.item_id) THEN
        RAISE EXCEPTION 'Item resource not found: %', api_create_auth_item_keys_v4.item_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM keys_resource k WHERE k.id = api_create_auth_item_keys_v4.key_id) THEN
        RAISE EXCEPTION 'Key resource not found: %', api_create_auth_item_keys_v4.key_id;
    END IF;

    SELECT akr.id
    INTO v_auth_item_keys_id
    FROM auth_item_keys_resource akr
    WHERE akr.auth_id = api_create_auth_item_keys_v4.auth_id
      AND akr.item_id = api_create_auth_item_keys_v4.item_id
      AND akr.key_id = api_create_auth_item_keys_v4.key_id
    ORDER BY akr.created_at DESC
    LIMIT 1;

    IF v_auth_item_keys_id IS NOT NULL THEN
        UPDATE auth_item_keys_resource
        SET
            active = true,
            mcp = api_create_auth_item_keys_v4.mcp,
            updated_at = NOW()
        WHERE id = v_auth_item_keys_id;

        RETURN QUERY SELECT v_auth_item_keys_id;
        RETURN;
    END IF;

    INSERT INTO auth_item_keys_resource (
        auth_id,
        item_id,
        key_id,
        active,
        generated,
        mcp
    )
    VALUES (
        api_create_auth_item_keys_v4.auth_id,
        api_create_auth_item_keys_v4.item_id,
        api_create_auth_item_keys_v4.key_id,
        true,
        false,
        api_create_auth_item_keys_v4.mcp
    )
    RETURNING id INTO v_auth_item_keys_id;

    RETURN QUERY SELECT v_auth_item_keys_id;
END;
$$;
