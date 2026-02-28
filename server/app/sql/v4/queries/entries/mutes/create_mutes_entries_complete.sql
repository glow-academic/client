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
    VALUES ('Mute conversation ' || api_create_mutes_entry_v4.conversation_id || ': muted=' || api_create_mutes_entry_v4.muted, true, api_create_mutes_entry_v4.mcp)
    ON CONFLICT (content_hash) DO UPDATE SET id = texts_entry.id
    RETURNING texts_entry.id INTO v_text_id;

    -- 2. Create call record
    v_call_id := uuidv7();
    INSERT INTO calls_entry (id, run_id, external_call_id)
    VALUES (v_call_id, api_create_mutes_entry_v4.run_id, 'mutes_' || v_call_id::text);

    -- 3. Create entry
    INSERT INTO mutes_entry (call_id, conversation_id, muted, mcp)
    VALUES (v_call_id, api_create_mutes_entry_v4.conversation_id, api_create_mutes_entry_v4.muted, api_create_mutes_entry_v4.mcp)
    RETURNING mutes_entry.id INTO v_entry_id;

    -- 4. Create message
    INSERT INTO messages_entry (run_id, call_id, role, text_id, generated, mcp)
    VALUES (api_create_mutes_entry_v4.run_id, v_call_id, 'assistant', v_text_id, true, api_create_mutes_entry_v4.mcp)
    RETURNING messages_entry.id INTO v_message_id;

    RETURN QUERY SELECT v_entry_id, v_call_id, v_message_id;
END; $$;
