-- Create args_outputs resource
-- SIMPLIFIED: No agent_id required, optional tool_id for tracking
-- Get or create operation (returns existing ID if args_id/name already exists)
-- Parameters: args_id (uuid), name (text), template (text), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_args_outputs_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_args_outputs_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_args_outputs_v4(
    args_id uuid,
    name text,
    template text DEFAULT '',
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
    IF NOT EXISTS (SELECT 1 FROM args_resource WHERE id = api_create_args_outputs_v4.args_id) THEN
        RAISE EXCEPTION 'Args resource % does not exist', args_id;
    END IF;

    -- Check if args_outputs already exists for args_id/name
    SELECT aor.id INTO v_resource_id
    FROM args_outputs_resource aor
    WHERE aor.args_id = api_create_args_outputs_v4.args_id
      AND aor.name = api_create_args_outputs_v4.name
    LIMIT 1;

    IF v_resource_id IS NOT NULL THEN
        RETURN QUERY SELECT v_resource_id;
        RETURN;
    END IF;

    -- INSERT INTO args_outputs_resource table
    INSERT INTO args_outputs_resource(
        args_id, name, template,
        active, generated, mcp, created_at
    )
    VALUES (
        api_create_args_outputs_v4.args_id,
        api_create_args_outputs_v4.name,
        api_create_args_outputs_v4.template,
        true,
        true,
        mcp,
        NOW()
    )
    RETURNING id INTO v_resource_id;
    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, api_create_args_outputs_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
        VALUES (v_call_id, 'args_outputs_' || v_call_id::text, v_run_id, NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_args_outputs_v4.tool_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_resource_id;
END;
$$;
