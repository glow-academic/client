-- Create test_archive entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_test_archive_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_test_archive_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_test_archive_entry_v4(
    run_id uuid,
    test_id uuid,
    archived bool DEFAULT false,
    tool_id uuid DEFAULT NULL,
    upload_id uuid DEFAULT NULL,
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
    INSERT INTO texts_entry (upload_id, generated, mcp)
    VALUES (api_create_test_archive_entry_v4.upload_id, true, api_create_test_archive_entry_v4.mcp)
    ON CONFLICT (upload_id) DO UPDATE SET id = texts_entry.id
    RETURNING texts_entry.id INTO v_text_id;

    -- 2. Create call record
    v_call_id := uuidv7();
    INSERT INTO calls_entry (id, run_id, external_call_id)
    VALUES (v_call_id, api_create_test_archive_entry_v4.run_id, 'test_archive_' || v_call_id::text);

    -- 3. Link tool to call
    IF api_create_test_archive_entry_v4.tool_id IS NOT NULL THEN
        INSERT INTO tools_calls_connection (tools_id, call_id)
        VALUES (api_create_test_archive_entry_v4.tool_id, v_call_id);
    END IF;

    -- 4. Create entry
    INSERT INTO test_archive_entry (call_id, test_id, archived, mcp)
    VALUES (v_call_id, api_create_test_archive_entry_v4.test_id, api_create_test_archive_entry_v4.archived, api_create_test_archive_entry_v4.mcp)
    RETURNING test_archive_entry.id INTO v_entry_id;

    -- 5. Create message
    INSERT INTO messages_entry (run_id, call_id, role, text_id, generated, mcp)
    VALUES (api_create_test_archive_entry_v4.run_id, v_call_id, 'assistant', v_text_id, true, api_create_test_archive_entry_v4.mcp)
    RETURNING messages_entry.id INTO v_message_id;

    RETURN QUERY SELECT v_entry_id, v_call_id, v_message_id;
END; $$;
