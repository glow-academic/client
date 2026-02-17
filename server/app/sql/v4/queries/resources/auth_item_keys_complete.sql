-- Create auth_item_keys resource
-- SIMPLIFIED: Optional tool_id for tracking
-- Get or create operation from auth + item + key tuple
-- Parameters: auth_id (uuid), item_id (uuid), key_id (uuid), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: auth_item_keys_id (uuid)

-- Drop function if exists (handles signature variations)
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
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    auth_item_keys_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_auth_item_keys_id uuid;
    v_run_id uuid;
    v_call_id uuid;
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
    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, 0, 0, 0, api_create_auth_item_keys_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
        VALUES (v_call_id, 'auth_item_keys_' || v_call_id::text, v_run_id, true, NOW(), NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_auth_item_keys_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO auth_item_keys_calls_connection (auth_item_keys_id, call_id)
        VALUES (v_auth_item_keys_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_auth_item_keys_id;
END;
$$;
