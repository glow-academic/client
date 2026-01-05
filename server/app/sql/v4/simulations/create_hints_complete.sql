-- Create simulation hints for a message
-- Converted to PostgreSQL function pattern with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_create_hints_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_create_hints_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_create_hints_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.i_create_hints_v4_hint_result AS (
    simulation_message_id uuid,
    idx int,
    hint text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION socket_create_hints_v4(
    message_id uuid,
    hint_texts text[]
)
RETURNS TABLE (
    hints types.i_create_hints_v4_hint_result[]
)
LANGUAGE sql
VOLATILE
AS $$
WITH hint_texts_array AS (
    SELECT 
        t.hint_text,
        t.idx
    FROM unnest(hint_texts) WITH ORDINALITY AS t(hint_text, idx)
    WHERE trim(t.hint_text) != ''
),
hints_with_next_idx AS (
    SELECT 
        hta.hint_text,
        hta.idx as original_idx,
        COALESCE(
            (SELECT MAX(mh.idx) FROM message_hints mh WHERE mh.message_id = message_id),
            -1
        ) + ROW_NUMBER() OVER (ORDER BY hta.idx) as next_idx
    FROM hint_texts_array hta
),
inserted_hint_entities AS (
    INSERT INTO hints (hint, created_at, updated_at)
    SELECT DISTINCT
        hwni.hint_text,
        NOW(),
        NOW()
    FROM hints_with_next_idx hwni
    ON CONFLICT DO NOTHING
    RETURNING id, hint
),
inserted_hints AS (
    INSERT INTO message_hints (message_id, hint_id, idx, created_at, updated_at)
    SELECT 
        message_id,
        ihe.id,
        hwni.next_idx,
        NOW(),
        NOW()
    FROM hints_with_next_idx hwni
    JOIN inserted_hint_entities ihe ON ihe.hint = hwni.hint_text
    RETURNING message_id, idx, (SELECT hint FROM hints WHERE id = hint_id) as hint
)
SELECT 
    COALESCE(
        ARRAY_AGG(
            (message_id, idx, hint)::types.i_create_hints_v4_hint_result
            ORDER BY idx
        ),
        '{}'::types.i_create_hints_v4_hint_result[]
    ) as hints
FROM inserted_hints
$$;