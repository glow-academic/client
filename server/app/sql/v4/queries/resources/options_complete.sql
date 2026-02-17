-- Create options resource
-- SIMPLIFIED: No agent_id required, optional tool_id for tracking
-- Get or create operation (returns existing ID if option_text + is_correct + question_id already exists)
-- Parameters: option_text (text), is_correct (boolean), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional), question_id (uuid, optional)
-- Returns: option_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_options_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_options_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_options_v4(
    option_text text,
    is_correct boolean,
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL,
    question_id uuid DEFAULT NULL
)
RETURNS TABLE (
    option_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_option_id uuid;
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Check if options already exists (match on option_text + is_correct + question_id)
    SELECT r.id INTO v_option_id
    FROM options_resource r
    WHERE r.option_text = api_create_options_v4.option_text
      AND r.is_correct = api_create_options_v4.is_correct
      AND (r.question_id IS NOT DISTINCT FROM api_create_options_v4.question_id)
    LIMIT 1;

    IF v_option_id IS NOT NULL THEN
        RETURN QUERY SELECT v_option_id;
        RETURN;
    END IF;

    -- INSERT INTO options_resource table
    INSERT INTO options_resource(option_text, is_correct, active, mcp, question_id)
    VALUES (option_text, is_correct, true, mcp, question_id)
    RETURNING id INTO v_option_id;
    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, 0, 0, 0, api_create_options_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
        VALUES (v_call_id, 'options_' || v_call_id::text, v_run_id, true, NOW(), NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_options_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO options_calls_connection (options_id, call_id)
        VALUES (v_option_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_option_id;
END;
$$;
