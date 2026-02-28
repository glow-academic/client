-- Create test_grade entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_test_grade_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_test_grade_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_test_grade_entry_v4(
    run_id uuid,
    invocation_id uuid,
    passed bool DEFAULT false,
    score int DEFAULT 0,
    time_taken int DEFAULT NULL,
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
    VALUES ('Graded test: passed=' || api_create_test_grade_entry_v4.passed || ', score=' || api_create_test_grade_entry_v4.score, true, api_create_test_grade_entry_v4.mcp)
    ON CONFLICT (content_hash) DO UPDATE SET id = texts_entry.id
    RETURNING texts_entry.id INTO v_text_id;

    -- 2. Create call record
    v_call_id := uuidv7();
    INSERT INTO calls_entry (id, run_id, external_call_id, completed)
    VALUES (v_call_id, api_create_test_grade_entry_v4.run_id, 'test_grade_' || v_call_id::text, true);

    -- 3. Create entry
    INSERT INTO test_grade_entry (call_id, invocation_id, passed, score, time_taken, mcp)
    VALUES (v_call_id, api_create_test_grade_entry_v4.invocation_id, api_create_test_grade_entry_v4.passed, api_create_test_grade_entry_v4.score, api_create_test_grade_entry_v4.time_taken, api_create_test_grade_entry_v4.mcp)
    RETURNING test_grade_entry.id INTO v_entry_id;

    -- 4. Create message
    INSERT INTO messages_entry (run_id, call_id, role, text_id, generated, mcp)
    VALUES (api_create_test_grade_entry_v4.run_id, v_call_id, 'assistant', v_text_id, true, api_create_test_grade_entry_v4.mcp)
    RETURNING messages_entry.id INTO v_message_id;

    RETURN QUERY SELECT v_entry_id, v_call_id, v_message_id;
END; $$;
