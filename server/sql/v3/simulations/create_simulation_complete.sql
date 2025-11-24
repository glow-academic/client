-- Create simulation with departments, time limit, scenarios, and videos in a single transaction
-- Parameters: $1=title, $2=description, $3=active, $4=practice_simulation, $5=rubric_id, $6=department_ids (nullable text array), $7=time_limit (nullable int), $8=scenario_ids (text array), $9=scenario_active_flags (bool array), $10=video_ids (text array), $11=video_active_flags (bool array)
-- Note: scenario_ids/scenario_active_flags and video_ids/video_active_flags must be same length and order within each type
-- Positions are unified: scenarios get positions 1..N, videos get positions N+1..M
WITH new_simulation AS (
    INSERT INTO simulations (
        title,
        description,
        active,
        practice_simulation,
        rubric_id,
        created_at,
        updated_at
    )
    VALUES ($1, $2, $3, $4, $5::uuid, NOW(), NOW())
    RETURNING id::text as simulation_id
),
link_departments AS (
    -- Link departments if provided (array is never NULL, but may be empty)
    INSERT INTO simulation_departments (simulation_id, department_id, active, created_at, updated_at)
    SELECT 
        ns.simulation_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN UNNEST($6::text[]) as dept_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
    ON CONFLICT (simulation_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_time_limit AS (
    -- Link time limit if provided
    INSERT INTO simulation_time_limits (simulation_id, time_limit_seconds, active, created_at, updated_at)
    SELECT ns.simulation_id::uuid, $7::int, true, NOW(), NOW()
    FROM new_simulation ns
    WHERE $7::int IS NOT NULL
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
        FROM UNNEST($8::text[], $9::bool[]) AS t(scenario_id, active_flag)
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
    WHERE COALESCE(array_length($8::text[], 1), 0) > 0
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
        FROM UNNEST($10::text[], $11::bool[]) AS t(video_id, active_flag)
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
    WHERE COALESCE(array_length($10::text[], 1), 0) > 0
),
link_scenarios AS (
    -- Link scenarios with proper ordering (active first, then inactive)
    INSERT INTO simulation_scenarios (simulation_id, scenario_id, active, position, created_at, updated_at)
    SELECT 
        ns.simulation_id::uuid,
        swo.scenario_id::uuid,
        swo.active_flag,
        swo.position,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN scenarios_with_order swo
),
link_videos AS (
    -- Link videos with proper ordering (active first, then inactive), continuing position from scenarios
    INSERT INTO simulation_videos (simulation_id, video_id, active, position, created_at, updated_at)
    SELECT 
        ns.simulation_id::uuid,
        vwo.video_id::uuid,
        vwo.active_flag,
        vwo.position,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN videos_with_order vwo
)
SELECT simulation_id FROM new_simulation

