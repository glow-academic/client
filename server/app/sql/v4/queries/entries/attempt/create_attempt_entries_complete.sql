-- Create attempt entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_attempt_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_attempt_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_attempt_entry_v4(
    run_id uuid,
    infinite_mode boolean DEFAULT false,
    num_chats integer DEFAULT 1,
    user_persona_id uuid DEFAULT NULL,
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
    INSERT INTO texts_entry (content, generated, mcp)
    VALUES ('Created attempt: infinite_mode=' || api_create_attempt_entry_v4.infinite_mode || ', num_chats=' || api_create_attempt_entry_v4.num_chats, true, api_create_attempt_entry_v4.mcp)
    ON CONFLICT (content_hash) DO UPDATE SET id = texts_entry.id
    RETURNING texts_entry.id INTO v_text_id;

    -- 2. Create call record
    v_call_id := uuidv7();
    INSERT INTO calls_entry (id, run_id, external_call_id, completed)
    VALUES (v_call_id, api_create_attempt_entry_v4.run_id, 'attempt_' || v_call_id::text, true);

    -- 3. Create entry
    INSERT INTO attempt_entry (call_id, infinite_mode, num_chats, user_persona_id, mcp)
    VALUES (v_call_id, api_create_attempt_entry_v4.infinite_mode, api_create_attempt_entry_v4.num_chats, api_create_attempt_entry_v4.user_persona_id, api_create_attempt_entry_v4.mcp)
    RETURNING attempt_entry.id INTO v_entry_id;

    -- 4. Create message
    INSERT INTO messages_entry (run_id, call_id, role, text_id, generated, mcp)
    VALUES (api_create_attempt_entry_v4.run_id, v_call_id, 'assistant', v_text_id, true, api_create_attempt_entry_v4.mcp)
    RETURNING messages_entry.id INTO v_message_id;

    RETURN QUERY SELECT v_entry_id, v_call_id, v_message_id;
END; $$;
