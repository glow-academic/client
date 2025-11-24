-- Create simulation with departments, time limit, scenarios, and videos in a single transaction
-- Parameters: $1=title, $2=description, $3=active, $4=practice_simulation, $5=rubric_id, $6=department_ids (nullable text array), $7=time_limit (nullable int), $8=scenario_ids (text array), $9=scenario_active_flags (bool array), $10=video_ids (text array), $11=video_active_flags (bool array), $12=scenario_hints_enabled (bool array), $13=scenario_objectives_enabled (bool array), $14=scenario_input_guardrail_enabled (bool array), $15=scenario_output_guardrail_enabled (bool array), $16=scenario_image_input_enabled (bool array), $17=scenario_rubric_ids (text array, nullable), $18=video_objectives_enabled (bool array)
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
scenarios_data AS (
    -- Prepare scenarios with their active flags and switch flags
    SELECT 
        scenario_id,
        active_flag,
        hints_enabled,
        objectives_enabled,
        input_guardrail_enabled,
        output_guardrail_enabled,
        image_input_enabled,
        rubric_id,
        row_num
    FROM (
        SELECT 
            scenario_id,
            active_flag,
            COALESCE(hints_enabled, false) as hints_enabled,
            COALESCE(objectives_enabled, true) as objectives_enabled,
            COALESCE(input_guardrail_enabled, false) as input_guardrail_enabled,
            COALESCE(output_guardrail_enabled, false) as output_guardrail_enabled,
            COALESCE(image_input_enabled, false) as image_input_enabled,
            rubric_id,
            ROW_NUMBER() OVER () as row_num
        FROM UNNEST(
            $8::text[], 
            $9::bool[], 
            COALESCE($12::bool[], ARRAY[]::bool[]),
            COALESCE($13::bool[], ARRAY[]::bool[]),
            COALESCE($14::bool[], ARRAY[]::bool[]),
            COALESCE($15::bool[], ARRAY[]::bool[]),
            COALESCE($16::bool[], ARRAY[]::bool[]),
            COALESCE($17::text[], ARRAY[]::text[])
        ) AS t(scenario_id, active_flag, hints_enabled, objectives_enabled, input_guardrail_enabled, output_guardrail_enabled, image_input_enabled, rubric_id)
    ) sub
),
scenarios_with_order AS (
    -- Sort scenarios: active first, then inactive, maintaining original order within each group
    SELECT 
        scenario_id,
        active_flag,
        hints_enabled,
        objectives_enabled,
        input_guardrail_enabled,
        output_guardrail_enabled,
        image_input_enabled,
        rubric_id,
        ROW_NUMBER() OVER (
            ORDER BY active_flag DESC, row_num
        ) as position
    FROM scenarios_data
    WHERE COALESCE(array_length($8::text[], 1), 0) > 0
),
replace_time_limits AS (
    -- Delete existing scenario time limits for this simulation
    DELETE FROM scenario_time_limits 
    WHERE simulation_id IN (SELECT simulation_id FROM new_simulation)
),
active_scenario_count AS (
    -- Count active scenarios for time limit splitting
    SELECT 
        ns.simulation_id,
        COUNT(*) FILTER (WHERE swo.active_flag = true) as active_count
    FROM new_simulation ns
    CROSS JOIN scenarios_with_order swo
    WHERE COALESCE(array_length($8::text[], 1), 0) > 0
    GROUP BY ns.simulation_id
),
link_time_limits AS (
    -- Link time limits to scenarios (split evenly across active scenarios) if provided
    INSERT INTO scenario_time_limits (simulation_id, scenario_id, time_limit_seconds, active, created_at, updated_at)
    SELECT 
        ns.simulation_id::uuid,
        swo.scenario_id::uuid,
        ($7::int / NULLIF(asc_count.active_count, 0))::int,
        true,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN scenarios_with_order swo
    CROSS JOIN active_scenario_count asc_count
    WHERE $7::int IS NOT NULL 
      AND swo.active_flag = true
      AND COALESCE(array_length($8::text[], 1), 0) > 0
      AND asc_count.simulation_id = ns.simulation_id
),
scenario_count AS (
    -- Count scenarios to determine starting position for videos
    SELECT COALESCE(MAX(position), 0) as max_position
    FROM scenarios_with_order
),
videos_data AS (
    -- Prepare videos with their active flags and objectives_enabled
    SELECT 
        video_id,
        active_flag,
        objectives_enabled,
        row_num
    FROM (
        SELECT 
            video_id,
            active_flag,
            COALESCE(objectives_enabled, true) as objectives_enabled,
            ROW_NUMBER() OVER () as row_num
        FROM UNNEST(
            $10::text[], 
            $11::bool[],
            COALESCE($18::bool[], ARRAY[]::bool[])
        ) AS t(video_id, active_flag, objectives_enabled)
    ) sub
),
videos_with_order AS (
    -- Sort videos: active first, then inactive, maintaining original order within each group
    -- Position continues from scenarios
    SELECT 
        vd.video_id,
        vd.active_flag,
        vd.objectives_enabled,
        sc.max_position + ROW_NUMBER() OVER (
            ORDER BY vd.active_flag DESC, vd.row_num
        ) as position
    FROM videos_data vd
    CROSS JOIN scenario_count sc
    WHERE COALESCE(array_length($10::text[], 1), 0) > 0
),
link_scenarios AS (
    -- Link scenarios with proper ordering (active first, then inactive) and switch flags
    INSERT INTO simulation_scenarios (simulation_id, scenario_id, active, position, hints_enabled, objectives_enabled, input_guardrail_enabled, output_guardrail_enabled, image_input_enabled, rubric_id, created_at, updated_at)
    SELECT 
        ns.simulation_id::uuid,
        swo.scenario_id::uuid,
        swo.active_flag,
        swo.position,
        swo.hints_enabled,
        swo.objectives_enabled,
        swo.input_guardrail_enabled,
        swo.output_guardrail_enabled,
        swo.image_input_enabled,
        CASE WHEN swo.rubric_id = '' OR swo.rubric_id IS NULL THEN NULL ELSE swo.rubric_id::uuid END,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN scenarios_with_order swo
),
link_videos AS (
    -- Link videos with proper ordering (active first, then inactive), continuing position from scenarios
    INSERT INTO simulation_videos (simulation_id, video_id, active, position, objectives_enabled, created_at, updated_at)
    SELECT 
        ns.simulation_id::uuid,
        vwo.video_id::uuid,
        vwo.active_flag,
        vwo.position,
        vwo.objectives_enabled,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN videos_with_order vwo
)
SELECT simulation_id FROM new_simulation

