-- Save question timestamps for scenario questions linked to videos
-- Parameters: $1 = scenario_id (uuid), $2 = video_id (uuid), $3 = question_timestamps (jsonb)
-- question_timestamps structure: {"question_id": [time1, time2, ...]}
-- Deactivates existing timestamps and inserts new ones
DO $$
BEGIN
    -- Deactivate existing timestamps for this scenario/video combination
    UPDATE scenario_question_times
    SET active = false, updated_at = NOW()
    WHERE scenario_id = $1::uuid AND video_id = $2::uuid;

    -- Insert new timestamps
    INSERT INTO scenario_question_times (scenario_id, question_id, video_id, time, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        (q_entry.key)::uuid,
        $2::uuid,
        time_val::integer,
        true,
        NOW(),
        NOW()
    FROM jsonb_each(COALESCE($3::jsonb, '{}'::jsonb)) as q_entry
    CROSS JOIN jsonb_array_elements_text(q_entry.value) as time_val
    WHERE $3::jsonb IS NOT NULL
    AND jsonb_typeof($3::jsonb) = 'object'
    ON CONFLICT (scenario_id, question_id, video_id, time) DO UPDATE SET
        active = true,
        updated_at = NOW();
END $$;
SELECT COUNT(*)::int as inserted_count FROM scenario_question_times WHERE scenario_id = $1::uuid AND video_id = $2::uuid AND active = true;

