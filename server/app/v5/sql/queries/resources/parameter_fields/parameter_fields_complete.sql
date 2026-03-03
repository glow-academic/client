-- Create parameter_fields resource
-- SIMPLIFIED: No agent_id required, optional tool_id for tracking
-- Get or create operation (returns existing ID if parameter_id + field_id already exists and is active)
-- Parameters: parameter_id (uuid), field_id (uuid), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: parameter_fields_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_parameter_fields_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_parameter_fields_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_parameter_fields_v4(
    parameter_id uuid,
    field_id uuid,
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    parameter_fields_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_parameter_fields_id uuid;
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Check if parameter_fields already exists (match on parameter_id + field_id + active)
    SELECT r.id INTO v_parameter_fields_id
    FROM parameter_fields_resource r
    WHERE r.parameter_id = api_create_parameter_fields_v4.parameter_id
      AND r.field_id = api_create_parameter_fields_v4.field_id
      AND r.active = true
    LIMIT 1;

    IF v_parameter_fields_id IS NOT NULL THEN
        RETURN QUERY SELECT v_parameter_fields_id;
        RETURN;
    END IF;

    -- INSERT INTO parameter_fields_resource table
    INSERT INTO parameter_fields_resource(parameter_id, field_id, active, generated)
    VALUES (api_create_parameter_fields_v4.parameter_id, api_create_parameter_fields_v4.field_id, true, false)
    RETURNING id INTO v_parameter_fields_id;
    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, api_create_parameter_fields_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
        VALUES (v_call_id, 'parameter_fields_' || v_call_id::text, v_run_id, NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_parameter_fields_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO parameter_fields_calls_connection (parameter_fields_id, call_id)
        VALUES (v_parameter_fields_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_parameter_fields_id;
END;
$$;
