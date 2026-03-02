-- Create messages entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_messages_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_messages_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_messages_entry_v4(
    run_id uuid,
    role message_type,
    chat_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
) RETURNS TABLE (id uuid, created_at timestamptz)
LANGUAGE plpgsql AS $$
DECLARE
    v_id uuid;
    v_created_at timestamptz;
BEGIN
    v_created_at := NOW();

    INSERT INTO messages_entry (run_id, role, created_at, updated_at, mcp, generated)
    VALUES (api_create_messages_entry_v4.run_id, api_create_messages_entry_v4.role, v_created_at, v_created_at, api_create_messages_entry_v4.mcp, true)
    RETURNING messages_entry.id INTO v_id;

    -- If chat_id provided, also create attempt_message_entry link
    IF api_create_messages_entry_v4.chat_id IS NOT NULL THEN
        INSERT INTO attempt_message_entry (id, chat_id)
        VALUES (v_id, api_create_messages_entry_v4.chat_id);
    END IF;

    RETURN QUERY SELECT v_id, v_created_at;
END; $$;
