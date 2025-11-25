-- Create simulation with departments, scenarios, and videos in a single transaction
-- Parameters: $1=title, $2=description, $3=active, $4=practice_simulation, $5=department_ids (nullable text array), $6=scenario_ids (text array), $7=scenario_active_flags (bool array), $8=video_ids (text array), $9=video_active_flags (bool array), $10=scenario_hints_enabled (bool array), $11=scenario_objectives_enabled (bool array), $12=scenario_input_guardrail_enabled (bool array), $13=scenario_output_guardrail_enabled (bool array), $14=scenario_image_input_enabled (bool array), $15=scenario_rubric_ids (text array, nullable), $16=scenario_time_limit_seconds (int array, nullable), $17=video_objectives_enabled (bool array), $18=scenario_audio_enabled (bool array), $19=scenario_text_enabled (bool array), $20=scenario_show_scenario (bool array), $21=video_show_scenario (bool array)
-- Note: scenario_ids/scenario_active_flags and video_ids/video_active_flags must be same length and order within each type
-- Positions are unified: scenarios get positions 1..N, videos get positions N+1..M
-- Note: rubric_id and time_limit are now per-scenario, not simulation-level
WITH new_simulation AS (
    INSERT INTO simulations (
        title,
        description,
        active,
        practice_simulation,
        created_at,
        updated_at
    )
    VALUES ($1, $2, $3, $4, NOW(), NOW())
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
    CROSS JOIN UNNEST($5::text[]) as dept_id
    WHERE COALESCE(array_length($5::text[], 1), 0) > 0
    ON CONFLICT (simulation_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
scenarios_data AS (
    -- Prepare scenarios with their active flags, switch flags, rubric_id, and time_limit_seconds
    SELECT 
        scenario_id,
        active_flag,
        hints_enabled,
        objectives_enabled,
        input_guardrail_enabled,
        output_guardrail_enabled,
        image_input_enabled,
        audio_enabled,
        text_enabled,
        show_scenario,
        rubric_id,
        time_limit_seconds,
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
            COALESCE(audio_enabled, false) as audio_enabled,
            COALESCE(text_enabled, true) as text_enabled,
            COALESCE(show_scenario, true) as show_scenario,
            rubric_id,
            time_limit_seconds,
            ROW_NUMBER() OVER () as row_num
        FROM UNNEST(
            $6::text[], 
            $7::bool[], 
            COALESCE($10::bool[], ARRAY[]::bool[]),
            COALESCE($11::bool[], ARRAY[]::bool[]),
            COALESCE($12::bool[], ARRAY[]::bool[]),
            COALESCE($13::bool[], ARRAY[]::bool[]),
            COALESCE($14::bool[], ARRAY[]::bool[]),
            COALESCE($18::bool[], ARRAY[]::bool[]),
            COALESCE($19::bool[], ARRAY[]::bool[]),
            COALESCE($20::bool[], ARRAY[]::bool[]),
            COALESCE($15::text[], ARRAY[]::text[]),
            COALESCE($16::int[], ARRAY[]::int[])
        ) AS t(scenario_id, active_flag, hints_enabled, objectives_enabled, input_guardrail_enabled, output_guardrail_enabled, image_input_enabled, audio_enabled, text_enabled, show_scenario, rubric_id, time_limit_seconds)
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
        audio_enabled,
        text_enabled,
        show_scenario,
        rubric_id,
        time_limit_seconds,
        ROW_NUMBER() OVER (
            ORDER BY active_flag DESC, row_num
        ) as position
    FROM scenarios_data
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
),
replace_time_limits AS (
    -- Delete existing scenario time limits for this simulation (should be empty for new simulation, but included for consistency)
    DELETE FROM scenario_time_limits 
    WHERE simulation_id IN (SELECT simulation_id FROM new_simulation)
),
link_time_limits AS (
    -- Link per-scenario time limits to scenarios if provided
    INSERT INTO scenario_time_limits (simulation_id, scenario_id, time_limit_seconds, active, created_at, updated_at)
    SELECT 
        ns.simulation_id::uuid,
        swo.scenario_id::uuid,
        swo.time_limit_seconds,
        true,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN scenarios_with_order swo
    WHERE swo.time_limit_seconds IS NOT NULL 
      AND swo.time_limit_seconds > 0
      AND swo.active_flag = true
),
scenario_count AS (
    -- Count scenarios to determine starting position for videos
    SELECT COALESCE(MAX(position), 0) as max_position
    FROM scenarios_with_order
),
videos_data AS (
    -- Prepare videos with their active flags, objectives_enabled, and show_scenario
    SELECT 
        video_id,
        active_flag,
        objectives_enabled,
        show_scenario,
        row_num
    FROM (
        SELECT 
            video_id,
            active_flag,
            COALESCE(objectives_enabled, true) as objectives_enabled,
            COALESCE(show_scenario, true) as show_scenario,
            ROW_NUMBER() OVER () as row_num
        FROM UNNEST(
            $8::text[], 
            $9::bool[], 
            COALESCE($17::bool[], ARRAY[]::bool[]),
            COALESCE($21::bool[], ARRAY[]::bool[])
        ) AS t(video_id, active_flag, objectives_enabled, show_scenario)
    ) sub
),
videos_with_order AS (
    -- Sort videos: active first, then inactive, maintaining original order within each group
    -- Position continues from scenarios
    SELECT 
        vd.video_id,
        vd.active_flag,
        vd.objectives_enabled,
        vd.show_scenario,
        sc.max_position + ROW_NUMBER() OVER (
            ORDER BY vd.active_flag DESC, vd.row_num
        ) as position
    FROM videos_data vd
    CROSS JOIN scenario_count sc
    WHERE COALESCE(array_length($8::text[], 1), 0) > 0
),
link_scenarios AS (
    -- Link scenarios with proper ordering (active first, then inactive) and switch flags
    INSERT INTO simulation_scenarios (simulation_id, scenario_id, active, position, hints_enabled, objectives_enabled, input_guardrail_enabled, output_guardrail_enabled, image_input_enabled, audio_enabled, text_enabled, show_scenario, rubric_id, created_at, updated_at)
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
        swo.audio_enabled,
        swo.text_enabled,
        swo.show_scenario,
        CASE WHEN swo.rubric_id = '' OR swo.rubric_id IS NULL THEN NULL ELSE swo.rubric_id::uuid END,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN scenarios_with_order swo
),
link_videos AS (
    -- Link videos with proper ordering (active first, then inactive), continuing position from scenarios
    INSERT INTO simulation_videos (simulation_id, video_id, active, position, objectives_enabled, show_scenario, created_at, updated_at)
    SELECT 
        ns.simulation_id::uuid,
        vwo.video_id::uuid,
        vwo.active_flag,
        vwo.position,
        vwo.objectives_enabled,
        vwo.show_scenario,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN videos_with_order vwo
)
SELECT simulation_id FROM new_simulation

