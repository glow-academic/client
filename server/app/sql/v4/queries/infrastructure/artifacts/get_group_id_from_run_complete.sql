-- Get group_id from run_id via runs_entry.group_id
-- Used by artifacts generate.py and progress.py
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'infrastructure_artifacts_get_group_id_from_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_artifacts_get_group_id_from_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_artifacts_get_group_id_from_run_v4(
    run_id uuid
)
RETURNS TABLE (
    group_id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT group_id FROM runs_entry WHERE runs_entry.id = $1 LIMIT 1
$$;
