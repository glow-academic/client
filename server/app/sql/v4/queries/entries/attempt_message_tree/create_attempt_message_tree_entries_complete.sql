-- Create attempt_message_tree entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_attempt_message_tree_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_attempt_message_tree_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_attempt_message_tree_entry_v4(
    parent_id uuid,
    child_id uuid,
    mcp boolean DEFAULT false
) RETURNS TABLE (id uuid)
LANGUAGE plpgsql AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO attempt_message_tree_entry (parent_id, child_id, mcp, generated)
    VALUES (api_create_attempt_message_tree_entry_v4.parent_id, api_create_attempt_message_tree_entry_v4.child_id, api_create_attempt_message_tree_entry_v4.mcp, true)
    ON CONFLICT (parent_id, child_id) DO NOTHING
    RETURNING attempt_message_tree_entry.id INTO v_id;

    IF v_id IS NOT NULL THEN
        RETURN QUERY SELECT v_id;
    END IF;
END; $$;
