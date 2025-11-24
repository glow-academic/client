-- Update simulation with departments, time limit, scenarios, and videos in a single transaction
-- Parameters: $1=simulationId, $2=title, $3=description, $4=active, $5=practice_simulation, $6=rubric_id, $7=department_ids (nullable text array), $8=time_limit (nullable int), $9=scenario_ids (text array), $10=scenario_active_flags (bool array), $11=video_ids (text array), $12=video_active_flags (bool array)
-- Note: scenario_ids/scenario_active_flags and video_ids/video_active_flags must be same length and order within each type
-- Positions are unified: scenarios get positions 1..N, videos get positions N+1..M
WITH update_simulation AS (
    UPDATE simulations SET
        title = $2,
        description = $3,
        active = $4,
        practice_simulation = $5,
        rubric_id = $6::uuid,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as simulation_id
),
replace_time_limit AS (
    -- Delete existing time limit
    DELETE FROM simulation_time_limits WHERE simulation_id = $1::uuid
),
link_time_limit AS (
    -- Insert new time limit if provided
    INSERT INTO simulation_time_limits (simulation_id, time_limit_seconds, active, created_at, updated_at)
    SELECT $1::uuid, $8::int, true, NOW(), NOW()
    WHERE $8::int IS NOT NULL
),
replace_departments AS (
    -- Deactivate all existing department links
    UPDATE simulation_departments 
    SET active = false, updated_at = NOW()
    WHERE simulation_id = $1::uuid AND active = true
),
link_departments AS (
    -- Insert new department links if provided (array is never NULL, but may be empty)
    INSERT INTO simulation_departments (simulation_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($7::text[]) as dept_id
    WHERE COALESCE(array_length($7::text[], 1), 0) > 0
    ON CONFLICT (simulation_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_scenarios AS (
    -- Delete all existing scenario links
    DELETE FROM simulation_scenarios WHERE simulation_id = $1::uuid
),
replace_videos AS (
    -- Delete all existing video links
    DELETE FROM simulation_videos WHERE simulation_id = $1::uuid
),
scenarios_data AS (
    -- Prepare scenarios with their active flags
    SELECT 
        scenario_id,
        active_flag,
        row_num
    FROM (
        SELECT 
            scenario_id,
            active_flag,
            ROW_NUMBER() OVER () as row_num
        FROM UNNEST($9::text[], $10::bool[]) AS t(scenario_id, active_flag)
    ) sub
),
scenarios_with_order AS (
    -- Sort scenarios: active first, then inactive, maintaining original order within each group
    SELECT 
        scenario_id,
        active_flag,
        ROW_NUMBER() OVER (
            ORDER BY active_flag DESC, row_num
        ) as position
    FROM scenarios_data
    WHERE COALESCE(array_length($9::text[], 1), 0) > 0
),
scenario_count AS (
    -- Count scenarios to determine starting position for videos
    SELECT COALESCE(MAX(position), 0) as max_position
    FROM scenarios_with_order
),
videos_data AS (
    -- Prepare videos with their active flags
    SELECT 
        video_id,
        active_flag,
        row_num
    FROM (
        SELECT 
            video_id,
            active_flag,
            ROW_NUMBER() OVER () as row_num
        FROM UNNEST($11::text[], $12::bool[]) AS t(video_id, active_flag)
    ) sub
),
videos_with_order AS (
    -- Sort videos: active first, then inactive, maintaining original order within each group
    -- Position continues from scenarios
    SELECT 
        vd.video_id,
        vd.active_flag,
        sc.max_position + ROW_NUMBER() OVER (
            ORDER BY vd.active_flag DESC, vd.row_num
        ) as position
    FROM videos_data vd
    CROSS JOIN scenario_count sc
    WHERE COALESCE(array_length($11::text[], 1), 0) > 0
),
link_scenarios AS (
    -- Insert new scenarios with proper ordering (active first, then inactive)
    INSERT INTO simulation_scenarios (simulation_id, scenario_id, active, position, created_at, updated_at)
    SELECT 
        $1::uuid,
        swo.scenario_id::uuid,
        swo.active_flag,
        swo.position,
        NOW(),
        NOW()
    FROM scenarios_with_order swo
),
link_videos AS (
    -- Insert new videos with proper ordering (active first, then inactive), continuing position from scenarios
    INSERT INTO simulation_videos (simulation_id, video_id, active, position, created_at, updated_at)
    SELECT 
        $1::uuid,
        vwo.video_id::uuid,
        vwo.active_flag,
        vwo.position,
        NOW(),
        NOW()
    FROM videos_with_order vwo
)
SELECT simulation_id FROM update_simulation

