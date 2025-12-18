-- Update simulation with departments, scenarios, and videos in a single transaction
-- Parameters: $1=simulationId, $2=title, $3=description, $4=active, $5=practice_simulation, $6=department_ids (nullable text array), $7=scenario_ids (text array), $8=scenario_active_flags (bool array), $9=video_ids (text array), $10=video_active_flags (bool array), $11=scenario_hints_enabled (bool array), $12=scenario_rubric_ids (text array, nullable), $13=scenario_time_limit_seconds (int array, nullable), $14=scenario_audio_enabled (bool array), $15=scenario_text_enabled (bool array), $19=video_show_problem_statement (bool array), $20=video_show_objectives (bool array), $21=video_show_image (bool array), $22=hint_agent_id (text, nullable), $23=grade_text_agent_id (text, nullable), $24=grade_voice_agent_id (text, nullable), $25=simulation_text_agent_id (text, nullable), $26=simulation_voice_agent_id (text, nullable), $27=profile_id (uuid)
-- Note: scenario_ids/scenario_active_flags and video_ids/video_active_flags must be same length and order within each type
-- Positions are unified: scenarios get positions 1..N, videos get positions N+1..M
-- Note: rubric_id and time_limit are now per-scenario, not simulation-level
WITH actor_profile AS (
    SELECT 
        $27::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $27::uuid
),
update_simulation AS (
    UPDATE simulations SET
        title = $2,
        description = $3,
        active = $4,
        practice_simulation = $5,
        hint_agent_id = COALESCE($22::uuid, hint_agent_id),
        grade_text_agent_id = COALESCE($23::uuid, grade_text_agent_id),
        grade_voice_agent_id = $24::uuid,
        simulation_text_agent_id = COALESCE($25::uuid, simulation_text_agent_id),
        simulation_voice_agent_id = $26::uuid,
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
    -- Prepare scenarios with their active flags, switch flags, rubric_id, time_limit_seconds
    SELECT 
        scenario_id,
        active_flag,
        hints_enabled,
        audio_enabled,
        text_enabled,
        rubric_id,
        time_limit_seconds,
        row_num
    FROM (
        SELECT 
            scenario_id,
            active_flag,
            COALESCE(hints_enabled, false) as hints_enabled,
            COALESCE(audio_enabled, false) as audio_enabled,
            COALESCE(text_enabled, true) as text_enabled,
            rubric_id,
            time_limit_seconds,
            ROW_NUMBER() OVER () as row_num
        FROM UNNEST(
            $7::text[], 
            $8::bool[], 
            COALESCE($11::bool[], ARRAY[]::bool[]),
            COALESCE($14::bool[], ARRAY[]::bool[]),
            COALESCE($15::bool[], ARRAY[]::bool[]),
            COALESCE($12::text[], ARRAY[]::text[]),
            COALESCE($13::int[], ARRAY[]::int[])
        ) AS t(scenario_id, active_flag, hints_enabled, audio_enabled, text_enabled, rubric_id, time_limit_seconds)
    ) sub
),
scenarios_with_order AS (
    -- Sort scenarios: active first, then inactive, maintaining original order within each group
    SELECT 
        scenario_id,
        active_flag,
        hints_enabled,
        audio_enabled,
        text_enabled,
        rubric_id,
        time_limit_seconds,
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
            COALESCE($19::bool[], ARRAY[]::bool[]),
            COALESCE($20::bool[], ARRAY[]::bool[]),
            COALESCE($21::bool[], ARRAY[]::bool[])
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
    INSERT INTO simulation_scenarios (simulation_id, scenario_id, active, position, hints_enabled, audio_enabled, text_enabled, rubric_id, created_at, updated_at)
    SELECT 
        $1::uuid,
        swo.scenario_id::uuid,
        swo.active_flag,
        swo.position,
        swo.hints_enabled,
        swo.audio_enabled,
        swo.text_enabled,
        CASE WHEN swo.rubric_id = '' OR swo.rubric_id IS NULL THEN NULL ELSE swo.rubric_id::uuid END,
        NOW(),
        NOW()
    FROM scenarios_with_order swo
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
    ON CONFLICT (simulation_id, video_id) DO UPDATE SET
        active = EXCLUDED.active,
        position = EXCLUDED.position,
        show_problem_statement = EXCLUDED.show_problem_statement,
        show_objectives = EXCLUDED.show_objectives,
        show_image = EXCLUDED.show_image,
        updated_at = NOW()
)
SELECT 
    us.simulation_id,
    ap.actor_name
FROM update_simulation us
CROSS JOIN actor_profile ap

