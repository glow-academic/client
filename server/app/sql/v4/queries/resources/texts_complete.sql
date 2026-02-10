-- Create texts resource
-- Creates texts_entry (with content_hash dedup), texts_resource, texts_texts_connection
-- Parameters: agent_id (uuid), group_id (uuid), content (text), mcp (boolean)
-- Returns: texts_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_texts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_texts_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_texts_v4(agent_id uuid,
    group_id uuid,
    content text,
    mcp boolean DEFAULT false)
RETURNS TABLE (
    texts_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_texts_id uuid;
    v_text_entry_id uuid;
    v_call_id uuid;
    v_tool_id uuid;
    v_template_id uuid;
    v_arguments_raw text;
    v_args_jsonb jsonb := '{}'::jsonb;
    v_run_id uuid;
    v_content_hash text;
BEGIN
    -- Lookup tool_id from agent_tools_junction + resource_tools_relation
    SELECT t.id, t.id as template_id
    INTO v_tool_id, v_template_id
    FROM agent_tools_junction at
    JOIN tools_resource tr ON tr.id = at.tool_id
    JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    JOIN tool_artifact t ON t.id = ttj.tool_id
    JOIN resource_tools_relation rt ON rt.tool_id = t.id
    WHERE at.agent_id = api_create_texts_v4.agent_id
      AND rt.resource = 'texts'::resource_type
      AND at.active = true
      AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    LIMIT 1;

    -- Raise error if agent doesn't have tool for resource
    IF v_tool_id IS NULL THEN
        RAISE EXCEPTION 'Agent % does not have tool for resource texts', agent_id;
    END IF;

    -- Validate agent has mcp flag when mcp=true
    IF mcp = true AND agent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM agent_flags_junction
            WHERE agent_id = api_create_texts_v4.agent_id
              AND value = true
        ) THEN
            RAISE EXCEPTION 'Agent % does not have MCP flag enabled', agent_id;
        END IF;
    END IF;

    -- Get or create texts_entry (dedup by content hash)
    v_content_hash := md5(content);

    SELECT te.id INTO v_text_entry_id
    FROM texts_entry te
    WHERE md5(te.content) = v_content_hash
    LIMIT 1;

    IF v_text_entry_id IS NULL THEN
        INSERT INTO texts_entry (id, content, active, generated, mcp, created_at, updated_at)
        VALUES (uuidv7(), content, true, false, mcp, NOW(), NOW())
        RETURNING id INTO v_text_entry_id;
    END IF;

    -- Build arguments_raw directly from params
    v_arguments_raw := v_args_jsonb::text;

    -- Create call record
    v_call_id := uuidv7();
    INSERT INTO calls_entry (
        id, external_call_id, template_id, arguments_raw, completed, created_at, updated_at
    )
    VALUES (
        v_call_id,
        'texts_' || v_call_id::text,
        v_template_id,
        v_arguments_raw,
        true,
        NOW(),
        NOW()
    );

    -- Link tool to call
    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES (v_tool_id, v_call_id);

    -- Create texts_resource
    v_texts_id := uuidv7();
    INSERT INTO texts_resource (id, active, generated, mcp, created_at)
    VALUES (v_texts_id, true, false, mcp, NOW());

    -- Link texts_resource to texts_entry
    INSERT INTO texts_texts_connection (texts_id, text_id, active, created_at, updated_at)
    VALUES (v_texts_id, v_text_entry_id, true, NOW(), NOW());

    -- Create run record
    v_run_id := uuidv7();
    INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
    VALUES (v_run_id, 0, 0, 0, api_create_texts_v4.group_id, NOW(), NOW());

    -- Link call to run
    UPDATE calls_entry SET run_id = v_run_id WHERE id = v_call_id;

    RETURN QUERY SELECT v_texts_id;
END;
$$;
