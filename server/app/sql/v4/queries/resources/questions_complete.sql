-- Create questions resource
-- SIMPLIFIED: No agent_id required, optional tool_id for tracking
-- Get or create operation (returns existing ID if question_text already exists)
-- Parameters: question_text (text), allow_multiple (boolean), time_value (integer), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: question_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_questions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_questions_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_questions_v4(
    question_text text,
    allow_multiple boolean,
    time_value integer,
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    question_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_question_id uuid;
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Check if questions already exists (match on question_text)
    SELECT r.id INTO v_question_id
    FROM questions_resource r
    WHERE r.question_text = api_create_questions_v4.question_text
    LIMIT 1;

    IF v_question_id IS NOT NULL THEN
        RETURN QUERY SELECT v_question_id;
        RETURN;
    END IF;

    -- INSERT INTO questions_resource table
    INSERT INTO questions_resource(question_text, allow_multiple, time, active, mcp)
    VALUES (question_text, allow_multiple, time_value, true, mcp)
    RETURNING id INTO v_question_id;
    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, api_create_questions_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
        VALUES (v_call_id, 'questions_' || v_call_id::text, v_run_id, true, NOW(), NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_questions_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO questions_calls_connection (questions_id, call_id)
        VALUES (v_question_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_question_id;
END;
$$;
