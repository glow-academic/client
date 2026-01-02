-- Link a video to a scenario
-- Converted to PostgreSQL function
-- Note: Only one video can be active per scenario (enforced by unique partial index)

BEGIN;

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_link_video_to_scenario_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_link_video_to_scenario_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_link_video_to_scenario_v4(
    scenario_id uuid,
    video_id uuid,
    active boolean
)
RETURNS TABLE (
    video_id text
)
LANGUAGE sql
VOLATILE
AS $$
WITH link_video AS (
    UPDATE scenario_videos
    SET active = false, updated_at = NOW()
    WHERE scenario_id = api_link_video_to_scenario_v4.scenario_id AND active = true
),
insert_video AS (
    INSERT INTO scenario_videos (scenario_id, video_id, active, created_at, updated_at)
    VALUES (scenario_id, video_id, active, NOW(), NOW())
    ON CONFLICT (scenario_id, video_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
    RETURNING video_id::text
)
SELECT video_id FROM insert_video
$$;

COMMIT;

