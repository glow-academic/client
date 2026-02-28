-- Create attempt_content entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_attempt_content_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_attempt_content_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_attempt_content_entry_v4(
    run_id uuid,
    message_id uuid,
    content text DEFAULT '',
    persona_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
) RETURNS TABLE (entry_id uuid, entry_call_id uuid, entry_message_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
    v_entry_id uuid;
    v_call_id uuid;
    v_text_id uuid;
    v_message_id uuid;
BEGIN
    -- 1. Create text record
    INSERT INTO texts_entry (content, generated, mcp)
    VALUES ('Generated content for message ' || api_create_attempt_content_entry_v4.message_id, true, api_create_attempt_content_entry_v4.mcp)
    ON CONFLICT (content_hash) DO UPDATE SET id = texts_entry.id
    RETURNING texts_entry.id INTO v_text_id;

    -- 2. Create call record
    v_call_id := uuidv7();
    INSERT INTO calls_entry (id, run_id, external_call_id, completed)
    VALUES (v_call_id, api_create_attempt_content_entry_v4.run_id, 'attempt_content_' || v_call_id::text, true);

    -- 3. Create entry
    INSERT INTO attempt_content_entry (call_id, message_id, content, persona_id, mcp)
    VALUES (v_call_id, api_create_attempt_content_entry_v4.message_id, api_create_attempt_content_entry_v4.content, api_create_attempt_content_entry_v4.persona_id, api_create_attempt_content_entry_v4.mcp)
    RETURNING attempt_content_entry.id INTO v_entry_id;

    -- 4. Create message
    INSERT INTO messages_entry (run_id, call_id, role, text_id, generated, mcp)
    VALUES (api_create_attempt_content_entry_v4.run_id, v_call_id, 'assistant', v_text_id, true, api_create_attempt_content_entry_v4.mcp)
    RETURNING messages_entry.id INTO v_message_id;

    RETURN QUERY SELECT v_entry_id, v_call_id, v_message_id;
END; $$;
