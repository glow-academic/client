-- Create role_routes resource
-- SIMPLIFIED: No agent_id required, optional tool_id for tracking
-- Get or create operation (returns existing ID if role_id + route_id already exists)
-- Parameters: role_id (uuid), route_id (uuid), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: role_routes_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_role_routes_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_role_routes_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_role_routes_v4(
    role_id uuid,
    route_id uuid,
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    role_routes_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_role_routes_id uuid;
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Validate role exists
    IF NOT EXISTS (SELECT 1 FROM roles_resource WHERE id = api_create_role_routes_v4.role_id) THEN
        RAISE EXCEPTION 'Role % does not exist', api_create_role_routes_v4.role_id;
    END IF;

    -- Validate route exists
    IF NOT EXISTS (SELECT 1 FROM routes_resource WHERE id = api_create_role_routes_v4.route_id) THEN
        RAISE EXCEPTION 'Route % does not exist', api_create_role_routes_v4.route_id;
    END IF;

    -- Check if role_routes already exists (match on role_id + route_id)
    SELECT r.id INTO v_role_routes_id
    FROM role_routes_resource r
    WHERE r.role_id = api_create_role_routes_v4.role_id
      AND r.route_id = api_create_role_routes_v4.route_id
    LIMIT 1;

    IF v_role_routes_id IS NOT NULL THEN
        RETURN QUERY SELECT v_role_routes_id;
        RETURN;
    END IF;

    -- INSERT INTO role_routes_resource
    INSERT INTO role_routes_resource (
        role_id,
        route_id,
        active,
        generated,
        mcp,
        created_at
    )
    VALUES (
        api_create_role_routes_v4.role_id,
        api_create_role_routes_v4.route_id,
        true,
        true,
        mcp,
        NOW()
    )
    ON CONFLICT (role_id, route_id)
    DO UPDATE SET
        active = true,
        generated = EXCLUDED.generated,
        mcp = EXCLUDED.mcp,
        updated_at = NOW()
    RETURNING id INTO v_role_routes_id;
    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
        VALUES (v_run_id, 0, 0, 0, api_create_role_routes_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
        VALUES (v_call_id, 'role_routes_' || v_call_id::text, v_run_id, true, NOW(), NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_role_routes_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO role_routes_calls_connection (role_routes_id, call_id)
        VALUES (v_role_routes_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_role_routes_id;
END;
$$;
