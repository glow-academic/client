-- Create texts resource
-- SIMPLIFIED: No agent_id required, optional tool_id for tracking
-- Creates texts_entry, links upload via text_uploads_entry, creates texts_resource + texts_texts_connection
-- Parameters: upload_id (uuid), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
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

CREATE OR REPLACE FUNCTION api_create_texts_v4(
    upload_id uuid,
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    texts_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_texts_id uuid;
    v_run_id uuid;
    v_call_id uuid;
    v_text_entry_id uuid;
BEGIN
    -- Get or create texts_entry (dedup by upload_id via junction)
    SELECT tue.text_id INTO v_text_entry_id
    FROM text_uploads_entry tue
    WHERE tue.upload_id = api_create_texts_v4.upload_id AND tue.active = true
    LIMIT 1;

    IF v_text_entry_id IS NULL THEN
        INSERT INTO texts_entry (id, active, generated, mcp, created_at, updated_at)
        VALUES (uuidv7(), true, false, mcp, NOW(), NOW())
        RETURNING id INTO v_text_entry_id;

        -- Link upload to text entry
        INSERT INTO text_uploads_entry (text_id, upload_id)
        VALUES (v_text_entry_id, api_create_texts_v4.upload_id);
    END IF;

    -- Create texts_resource
    v_texts_id := uuidv7();
    INSERT INTO texts_resource (id, active, generated, mcp, created_at)
    VALUES (v_texts_id, true, false, mcp, NOW());

    -- Link texts_resource to texts_entry
    INSERT INTO texts_texts_connection (texts_id, text_id, active, created_at, updated_at)
    VALUES (v_texts_id, v_text_entry_id, true, NOW(), NOW());
    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, api_create_texts_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
        VALUES (v_call_id, 'texts_' || v_call_id::text, v_run_id, NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_texts_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO texts_calls_connection (texts_id, call_id)
        VALUES (v_texts_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_texts_id;
END;
$$;
