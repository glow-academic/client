-- Get videos for a scenario
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_scenario_videos_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_videos_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_scenario_videos_v4(
    scenario_id uuid
)
RETURNS TABLE (
    video_id uuid,
    active boolean
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    sv.video_id,
    sv.active
FROM scenario_videos sv
WHERE sv.scenario_id = scenario_id
  AND sv.active = true
$$;