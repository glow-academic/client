-- Create mutes entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_mutes_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_mutes_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_mutes_entry_v4(
    run_id uuid,
    conversation_id uuid,
    muted bool DEFAULT false,
    tool_id uuid DEFAULT NULL,
    upload_id uuid DEFAULT NULL,
    session_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
) RETURNS TABLE (id uuid, call_id uuid, message_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
    v_entry_id uuid;
    v_call_id uuid;
    v_text_id uuid;
    v_message_id uuid;
BEGIN
    -- 1. Create text record
    INSERT INTO texts_entry (session_id, generated, mcp)
    VALUES (api_create_mutes_entry_v4.session_id, true, api_create_mutes_entry_v4.mcp)
    RETURNING texts_entry.id INTO v_text_id;

    -- Link upload to text entry
    IF api_create_mutes_entry_v4.upload_id IS NOT NULL THEN
        INSERT INTO text_uploads_entry (text_id, upload_id)
        VALUES (v_text_id, api_create_mutes_entry_v4.upload_id);
    END IF;

    -- 2. Create call record
    v_call_id := uuidv7();
    INSERT INTO calls_entry (id, run_id, external_call_id)
    VALUES (v_call_id, api_create_mutes_entry_v4.run_id, 'mutes_' || v_call_id::text);

    -- 3. Link tool to call
    IF api_create_mutes_entry_v4.tool_id IS NOT NULL THEN
        INSERT INTO tools_calls_connection (tools_id, call_id)
        VALUES (api_create_mutes_entry_v4.tool_id, v_call_id);
    END IF;

    -- 4. Create entry
    INSERT INTO mutes_entry (call_id, conversation_id, muted, mcp)
    VALUES (v_call_id, api_create_mutes_entry_v4.conversation_id, api_create_mutes_entry_v4.muted, api_create_mutes_entry_v4.mcp)
    RETURNING mutes_entry.id INTO v_entry_id;

    -- 5. Create message
    INSERT INTO messages_entry (run_id, role, generated, mcp)
    VALUES (api_create_mutes_entry_v4.run_id, 'assistant', true, api_create_mutes_entry_v4.mcp)
    RETURNING messages_entry.id INTO v_message_id;

    -- Link upload to message
    IF api_create_mutes_entry_v4.upload_id IS NOT NULL THEN
        INSERT INTO message_uploads_entry (message_id, upload_id)
        VALUES (v_message_id, api_create_mutes_entry_v4.upload_id);
    END IF;

    RETURN QUERY SELECT v_entry_id, v_call_id, v_message_id;
END; $$;
