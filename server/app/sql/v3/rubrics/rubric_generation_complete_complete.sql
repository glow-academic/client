-- Rubric generation complete event handler
-- No-op function (no database operations) - just returns success
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_rubric_generation_complete_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_rubric_generation_complete_v3(%s)', r.sig);
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
        WHERE typname LIKE 'i_rubric_generation_complete_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function (no types needed for this simple function)
CREATE OR REPLACE FUNCTION socket_rubric_generation_complete_v3(
    profile_id uuid,
    rubric_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    message text DEFAULT 'Rubric generation completed'
)
RETURNS TABLE (
    success boolean,
    message text,
    trace_id text
)
LANGUAGE sql
VOLATILE
AS $$
-- No-op: Just returns success (no database operations)
-- trace_id comes from groups table, not parameter
SELECT 
    true as success,
    COALESCE(message, 'Rubric generation completed') as message,
    (SELECT trace_id FROM groups WHERE id = group_id LIMIT 1) as trace_id
$$;

COMMIT;

