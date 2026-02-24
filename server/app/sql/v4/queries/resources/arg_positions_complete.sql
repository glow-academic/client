-- Create/update arg_positions resource
-- SIMPLIFIED: Optional tool_id for tracking
-- Parameters: args_id (uuid), value (integer), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_arg_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_arg_positions_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_arg_positions_v4(
    args_id uuid,
    value integer,
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_resource_id uuid;
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Validate args_id exists
    IF NOT EXISTS (SELECT 1 FROM args_resource WHERE id = api_create_arg_positions_v4.args_id) THEN
        RAISE EXCEPTION 'Arg % does not exist', api_create_arg_positions_v4.args_id;
    END IF;

    -- Check if arg_position already exists for this args_id
    SELECT ap.id
    INTO v_resource_id
    FROM arg_positions_resource ap
    WHERE ap.args_id = api_create_arg_positions_v4.args_id
      AND ap.active = true
    LIMIT 1;

    IF v_resource_id IS NULL THEN
        -- Create new arg_positions resource
        INSERT INTO arg_positions_resource (id, args_id, value, active, generated, mcp, created_at)
        VALUES (uuidv7(), api_create_arg_positions_v4.args_id, api_create_arg_positions_v4.value, true, true, mcp, NOW())
        RETURNING arg_positions_resource.id INTO v_resource_id;
    ELSE
        -- Update existing arg_positions resource
        UPDATE arg_positions_resource
        SET value = api_create_arg_positions_v4.value,
            active = true,
            generated = true,
            mcp = api_create_arg_positions_v4.mcp
        WHERE arg_positions_resource.id = v_resource_id;
    END IF;
    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, api_create_arg_positions_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
        VALUES (v_call_id, 'arg_positions_' || v_call_id::text, v_run_id, true, NOW(), NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_arg_positions_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO arg_positions_calls_connection (arg_positions_id, call_id)
        VALUES (v_resource_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_resource_id;
END;
$$;
