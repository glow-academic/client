-- Create simulation with departments, time limit, and scenarios in a single transaction
-- Parameters: $1=title, $2=description, $3=active, $4=practice_simulation, $5=rubric_id, $6=department_ids (nullable text array), $7=time_limit (nullable int), $8=scenario_ids (text array), $9=scenario_active_flags (bool array)
-- Note: scenario_ids and scenario_active_flags must be same length and order
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
    SELECT ns.simulation_id::uuid, $7, true, NOW(), NOW()
    FROM new_simulation ns
    WHERE $7 IS NOT NULL
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
)
SELECT simulation_id FROM new_simulation

