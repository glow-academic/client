-- Save question timestamps for scenario questions linked to videos
-- Converted to PostgreSQL function
-- Note: Uses JSONB - may need refactoring per STANDARDS.md
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_save_question_timestamps_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_question_timestamps_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_save_question_timestamps_v4(
    scenario_id uuid,
    video_id uuid,
    question_timestamps jsonb
)
RETURNS TABLE (
    inserted_count integer
)
LANGUAGE sql
VOLATILE
AS $$
WITH deactivate_timestamps AS (
    UPDATE scenario_question_times
    SET active = false, updated_at = NOW()
    WHERE scenario_id = api_save_question_timestamps_v4.scenario_id 
      AND video_id = api_save_question_timestamps_v4.video_id
),
insert_timestamps AS (
    INSERT INTO scenario_question_times (scenario_id, question_id, video_id, time, active, created_at, updated_at)
    SELECT 
        scenario_id,
        (q_entry.key)::uuid,
        video_id,
        time_val::integer,
        true,
        NOW(),
        NOW()
    FROM jsonb_each(COALESCE(question_timestamps, '{}'::jsonb)) as q_entry
    CROSS JOIN jsonb_array_elements_text(q_entry.value) as time_val
    WHERE question_timestamps IS NOT NULL
    AND jsonb_typeof(question_timestamps) = 'object'
    ON CONFLICT (scenario_id, question_id, video_id, time) DO UPDATE SET
        active = true,
        updated_at = NOW()
    RETURNING 1
)
SELECT COUNT(*)::int as inserted_count FROM insert_timestamps
$$;