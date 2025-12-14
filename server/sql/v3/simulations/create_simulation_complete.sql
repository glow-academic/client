-- Create simulation with departments and scenarios in a single transaction
-- Parameters: $1=title, $2=description, $3=active, $4=practice_simulation, $5=department_ids (nullable text array), $6=scenario_ids (text array), $7=scenario_active_flags (bool array), $8=scenario_hints_enabled (bool array), $9=scenario_rubric_ids (text array, nullable), $10=scenario_time_limit_seconds (int array, nullable), $11=scenario_audio_enabled (bool array), $12=scenario_text_enabled (bool array), $13=simulation_text_agent_id (text), $14=simulation_voice_agent_id (text, nullable)
-- Note: scenario_ids/scenario_active_flags must be same length and order
-- Note: rubric_id and time_limit are now per-scenario, not simulation-level
WITH new_simulation AS (
    INSERT INTO simulations (
        title,
        description,
        active,
        practice_simulation,
        simulation_text_agent_id,
        simulation_voice_agent_id,
        created_at,
        updated_at
    )
    VALUES ($1, $2, $3, $4, $13::uuid, NULLIF($14, '')::uuid, NOW(), NOW())
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
            $6::text[], 
            $7::bool[], 
            COALESCE($8::bool[], ARRAY[]::bool[]),
            COALESCE($11::bool[], ARRAY[]::bool[]),
            COALESCE($12::bool[], ARRAY[]::bool[]),
            COALESCE($9::text[], ARRAY[]::text[]),
            COALESCE($10::int[], ARRAY[]::int[])
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
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
),
replace_time_limits AS (
    -- Delete existing scenario time limits for this simulation (should be empty for new simulation, but included for consistency)
    DELETE FROM scenario_time_limits 
    WHERE simulation_id IN (SELECT simulation_id::uuid FROM new_simulation)
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
link_scenarios AS (
    -- Link scenarios with proper ordering (active first, then inactive) and switch flags
    INSERT INTO simulation_scenarios (simulation_id, scenario_id, active, position, hints_enabled, audio_enabled, text_enabled, rubric_id, created_at, updated_at)
    SELECT 
        ns.simulation_id::uuid,
        swo.scenario_id::uuid,
        swo.active_flag,
        swo.position,
        swo.hints_enabled,
        swo.audio_enabled,
        swo.text_enabled,
        CASE WHEN swo.rubric_id = '' OR swo.rubric_id IS NULL THEN NULL ELSE swo.rubric_id::uuid END,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN scenarios_with_order swo
)
SELECT simulation_id FROM new_simulation

