-- ============================================================================
-- Query: resolve_test_invocation
-- Purpose: Create test_invocation_entry from invocation_entry, create bridge
-- Section: GENERATE/TEST
--
-- Given a test_id and invocation_entry_id:
-- 1. Create test_invocation_entry
-- 2. TODO: Copy connections from invocation_entry
-- 3. Create test_invocation_bridge_entry (test_invocation ↔ invocation)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_resolve_test_invocation_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_resolve_test_invocation_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_resolve_test_invocation_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_resolve_test_invocation_v4_result AS (
    test_invocation_id uuid
);

CREATE OR REPLACE FUNCTION socket_resolve_test_invocation_v4(
    p_test_id uuid,
    p_invocation_entry_id uuid
)
RETURNS TABLE (
    items types.q_resolve_test_invocation_v4_result[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_test_invocation_id uuid;
BEGIN
    -- Step 1: Create test_invocation_entry
    INSERT INTO test_invocation_entry (test_id, title, generated, mcp, created_at, updated_at)
    VALUES (p_test_id, '', false, false, NOW(), NOW())
    RETURNING id INTO v_test_invocation_id;

    IF v_test_invocation_id IS NULL THEN
        RAISE EXCEPTION 'Failed to create test_invocation_entry for test %', p_test_id;
    END IF;

    -- Step 2: TODO — copy connections from invocation_entry to test_invocation_entry
    -- (runs, groups, departments, etc.)

    -- Step 3: Create bridge (test_invocation ↔ invocation)
    INSERT INTO test_invocation_bridge_entry (test_invocation_id, invocation_id, created_at, active)
    VALUES (v_test_invocation_id, p_invocation_entry_id, NOW(), true)
    ON CONFLICT DO NOTHING;

    RETURN QUERY
    SELECT ARRAY[
        ROW(v_test_invocation_id)::types.q_resolve_test_invocation_v4_result
    ];
END;
$$;
