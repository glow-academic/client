-- Create provider_keys resource
-- SIMPLIFIED: Optional tool_id for tracking
-- Get or create operation from provider + key pair
-- Parameters: provider_id (uuid), key_id (uuid), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: provider_keys_id (uuid)

-- Drop function if exists (handles signature variations)
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
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    provider_keys_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_provider_keys_id uuid;
    v_run_id uuid;
    v_call_id uuid;
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
    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, api_create_provider_keys_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
        VALUES (v_call_id, 'provider_keys_' || v_call_id::text, v_run_id, true, NOW(), NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_provider_keys_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO provider_keys_calls_connection (provider_keys_id, call_id)
        VALUES (v_provider_keys_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_provider_keys_id;
END;
$$;
