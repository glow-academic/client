-- Update simulation with departments, scenarios, and videos in a single transaction
-- Parameters: $1=simulationId, $2=title, $3=description, $4=active, $5=practice_simulation, $6=department_ids (nullable text array), $7=scenario_ids (text array), $8=scenario_active_flags (bool array), $9=video_ids (text array), $10=video_active_flags (bool array), $11=scenario_hints_enabled (bool array), $12=scenario_input_guardrail_enabled (bool array), $13=scenario_output_guardrail_enabled (bool array), $14=scenario_rubric_ids (text array, nullable), $15=scenario_time_limit_seconds (int array, nullable), $16=scenario_audio_enabled (bool array), $17=scenario_text_enabled (bool array), $18=scenario_show_problem_statement (bool array), $19=scenario_show_objectives (bool array), $20=scenario_show_image (bool array), $21=video_show_problem_statement (bool array), $22=video_show_objectives (bool array), $23=video_show_image (bool array), $24=scenario_hint_agent_ids (text array, nullable), $25=scenario_input_guardrail_agent_ids (text array, nullable), $26=scenario_output_guardrail_agent_ids (text array, nullable), $27=scenario_grade_agent_ids (text array array, nullable - array of arrays, one per scenario)
-- Note: scenario_ids/scenario_active_flags and video_ids/video_active_flags must be same length and order within each type
-- Positions are unified: scenarios get positions 1..N, videos get positions N+1..M
-- Note: rubric_id and time_limit are now per-scenario, not simulation-level
WITH update_simulation AS (
    UPDATE simulations SET
        title = $2,
        description = $3,
        active = $4,
        practice_simulation = $5,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as simulation_id
),
replace_time_limits AS (
    -- Delete existing scenario time limits for this simulation
    DELETE FROM scenario_time_limits WHERE simulation_id = $1::uuid
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
    FROM UNNEST($6::text[]) as dept_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
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
    -- Prepare scenarios with their active flags, switch flags, rubric_id, time_limit_seconds, and agent_ids
    SELECT 
        scenario_id,
        active_flag,
        hints_enabled,
        input_guardrail_enabled,
        output_guardrail_enabled,
        audio_enabled,
        text_enabled,
        show_problem_statement,
        show_objectives,
        show_image,
        rubric_id,
        time_limit_seconds,
        hint_agent_id,
        input_guardrail_agent_id,
        output_guardrail_agent_id,
        row_num
    FROM (
        SELECT 
            scenario_id,
            active_flag,
            COALESCE(hints_enabled, false) as hints_enabled,
            COALESCE(input_guardrail_enabled, false) as input_guardrail_enabled,
            COALESCE(output_guardrail_enabled, false) as output_guardrail_enabled,
            COALESCE(audio_enabled, false) as audio_enabled,
            COALESCE(text_enabled, true) as text_enabled,
            COALESCE(show_problem_statement, true) as show_problem_statement,
            COALESCE(show_objectives, true) as show_objectives,
            COALESCE(show_image, true) as show_image,
            rubric_id,
            time_limit_seconds,
            hint_agent_id,
            input_guardrail_agent_id,
            output_guardrail_agent_id,
            ROW_NUMBER() OVER () as row_num
        FROM UNNEST(
            $7::text[], 
            $8::bool[], 
            COALESCE($11::bool[], ARRAY[]::bool[]),
            COALESCE($12::bool[], ARRAY[]::bool[]),
            COALESCE($13::bool[], ARRAY[]::bool[]),
            COALESCE($16::bool[], ARRAY[]::bool[]),
            COALESCE($17::bool[], ARRAY[]::bool[]),
            COALESCE($18::bool[], ARRAY[]::bool[]),
            COALESCE($19::bool[], ARRAY[]::bool[]),
            COALESCE($20::bool[], ARRAY[]::bool[]),
            COALESCE($14::text[], ARRAY[]::text[]),
            COALESCE($15::int[], ARRAY[]::int[]),
            COALESCE($24::text[], ARRAY[]::text[]),
            COALESCE($25::text[], ARRAY[]::text[]),
            COALESCE($26::text[], ARRAY[]::text[])
        ) AS t(scenario_id, active_flag, hints_enabled, input_guardrail_enabled, output_guardrail_enabled, audio_enabled, text_enabled, show_problem_statement, show_objectives, show_image, rubric_id, time_limit_seconds, hint_agent_id, input_guardrail_agent_id, output_guardrail_agent_id)
    ) sub
),
scenarios_with_order AS (
    -- Sort scenarios: active first, then inactive, maintaining original order within each group
    SELECT 
        scenario_id,
        active_flag,
        hints_enabled,
        input_guardrail_enabled,
        output_guardrail_enabled,
        audio_enabled,
        text_enabled,
        show_problem_statement,
        show_objectives,
        show_image,
        rubric_id,
        time_limit_seconds,
        hint_agent_id,
        input_guardrail_agent_id,
        output_guardrail_agent_id,
        ROW_NUMBER() OVER (
            ORDER BY active_flag DESC, row_num
        ) as position
    FROM scenarios_data
    WHERE COALESCE(array_length($7::text[], 1), 0) > 0
),
link_time_limits AS (
    -- Link per-scenario time limits to scenarios if provided
    INSERT INTO scenario_time_limits (simulation_id, scenario_id, time_limit_seconds, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        swo.scenario_id::uuid,
        swo.time_limit_seconds,
        true,
        NOW(),
        NOW()
    FROM scenarios_with_order swo
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
    -- Prepare videos with their active flags and show fields
    SELECT 
        video_id,
        active_flag,
        show_problem_statement,
        show_objectives,
        show_image,
        row_num
    FROM (
        SELECT 
            video_id,
            active_flag,
            COALESCE(show_problem_statement, true) as show_problem_statement,
            COALESCE(show_objectives, true) as show_objectives,
            COALESCE(show_image, true) as show_image,
            ROW_NUMBER() OVER () as row_num
        FROM UNNEST(
            $9::text[], 
            $10::bool[], 
            COALESCE($21::bool[], ARRAY[]::bool[]),
            COALESCE($22::bool[], ARRAY[]::bool[]),
            COALESCE($23::bool[], ARRAY[]::bool[])
        ) AS t(video_id, active_flag, show_problem_statement, show_objectives, show_image)
    ) sub
),
videos_with_order AS (
    -- Sort videos: active first, then inactive, maintaining original order within each group
    -- Position continues from scenarios
    SELECT 
        vd.video_id,
        vd.active_flag,
        vd.show_problem_statement,
        vd.show_objectives,
        vd.show_image,
        sc.max_position + ROW_NUMBER() OVER (
            ORDER BY vd.active_flag DESC, vd.row_num
        ) as position
    FROM videos_data vd
    CROSS JOIN scenario_count sc
    WHERE COALESCE(array_length($9::text[], 1), 0) > 0
),
link_scenarios AS (
    -- Insert new scenarios with proper ordering (active first, then inactive) and switch flags
    INSERT INTO simulation_scenarios (simulation_id, scenario_id, active, position, hints_enabled, input_guardrail_enabled, output_guardrail_enabled, audio_enabled, text_enabled, show_problem_statement, show_objectives, show_image, rubric_id, hint_agent_id, input_guardrail_agent_id, output_guardrail_agent_id, created_at, updated_at)
    SELECT 
        $1::uuid,
        swo.scenario_id::uuid,
        swo.active_flag,
        swo.position,
        swo.hints_enabled,
        swo.input_guardrail_enabled,
        swo.output_guardrail_enabled,
        swo.audio_enabled,
        swo.text_enabled,
        swo.show_problem_statement,
        swo.show_objectives,
        swo.show_image,
        CASE WHEN swo.rubric_id = '' OR swo.rubric_id IS NULL THEN NULL ELSE swo.rubric_id::uuid END,
        COALESCE(swo.hint_agent_id::uuid, (SELECT id FROM agents WHERE role = 'hint' AND active = true LIMIT 1)),
        COALESCE(swo.input_guardrail_agent_id::uuid, (SELECT id FROM agents WHERE role = 'input_guardrail' AND active = true LIMIT 1)),
        COALESCE(swo.output_guardrail_agent_id::uuid, (SELECT id FROM agents WHERE role = 'output_guardrail' AND active = true LIMIT 1)),
        NOW(),
        NOW()
    FROM scenarios_with_order swo
),
replace_grade_agents AS (
    -- Delete all existing grade agent links for scenarios in this simulation
    DELETE FROM simulation_scenarios_grade_agents 
    WHERE simulation_id = $1::uuid
    AND scenario_id = ANY($7::uuid[])
),
link_grade_agents AS (
    -- Insert grade agent links if provided
    -- $27 is array of arrays: one array per scenario, each containing grade agent IDs
    INSERT INTO simulation_scenarios_grade_agents (simulation_id, scenario_id, agent_id, created_at, updated_at)
    SELECT 
        $1::uuid,
        scenario_id::uuid,
        agent_id::uuid,
        NOW(),
        NOW()
    FROM (
        SELECT 
            scenario_id,
            unnest(grade_agent_ids) as agent_id
        FROM UNNEST($7::text[], $27::text[][]) AS t(scenario_id, grade_agent_ids)
        WHERE grade_agent_ids IS NOT NULL AND array_length(grade_agent_ids, 1) > 0
    ) grade_data
    WHERE COALESCE(array_length($7::text[], 1), 0) > 0
      AND $27::text[][] IS NOT NULL
),
link_videos AS (
    -- Insert new videos with proper ordering (active first, then inactive), continuing position from scenarios
    INSERT INTO simulation_videos (simulation_id, video_id, active, position, show_problem_statement, show_objectives, show_image, created_at, updated_at)
    SELECT 
        $1::uuid,
        vwo.video_id::uuid,
        vwo.active_flag,
        vwo.position,
        vwo.show_problem_statement,
        vwo.show_objectives,
        vwo.show_image,
        NOW(),
        NOW()
    FROM videos_with_order vwo
)
SELECT simulation_id FROM update_simulation

