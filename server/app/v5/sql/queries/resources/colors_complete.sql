-- Create colors resource
-- SIMPLIFIED: No agent_id required, optional tool_id for tracking
-- Get or create operation (returns existing ID if hex_code already exists)
-- Parameters: name (text), description (text), hex_code (text), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: color_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_colors_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_colors_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_colors_v4(
    name text DEFAULT NULL,
    description text DEFAULT NULL,
    hex_code text DEFAULT NULL,
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    color_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_color_id uuid;
    v_call_id uuid;
    v_run_id uuid;
BEGIN
    -- Check if color already exists (match on hex_code)
    IF hex_code IS NOT NULL THEN
        SELECT cr.id INTO v_color_id
        FROM colors_resource cr
        WHERE cr.hex_code = api_create_colors_v4.hex_code
        LIMIT 1;

        IF v_color_id IS NOT NULL THEN
            RETURN QUERY SELECT v_color_id;
            RETURN;
        END IF;
    END IF;

    -- INSERT INTO colors_resource table
    INSERT INTO colors_resource(name, description, hex_code, active, mcp, generated)
    VALUES (
        api_create_colors_v4.name,
        api_create_colors_v4.description,
        api_create_colors_v4.hex_code,
        true,
        api_create_colors_v4.mcp,
        api_create_colors_v4.mcp
    )
    RETURNING id INTO v_color_id;

    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, api_create_colors_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
        VALUES (v_call_id, 'colors_' || v_call_id::text, v_run_id, NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_colors_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO colors_calls_connection (colors_id, call_id)
        VALUES (v_color_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_color_id;
END;
$$;
