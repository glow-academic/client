-- Create cohort with departments, profiles, and simulations in single query (DHH style)
-- Parameters: $1=title, $2=description, $3=active, $4=department_ids (text[]), 
--             $5=profile_ids (text[]), $6=simulation_ids (text[]), $7=profile_id (uuid, required)
-- Returns: id, actor_name
-- profile_id is always a UUID (required in request body)
actor_profile AS (
    SELECT 
        $7::uuid as resolved_profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $7::uuid
),
new_cohort AS (
    -- Create cohort
    INSERT INTO cohorts (
        title,
        description,
        active
    )
    VALUES ($1, $2, $3)
    RETURNING id
),
link_departments AS (
    -- Link departments if provided (array may be empty)
    INSERT INTO cohort_departments (cohort_id, department_id, active, created_at, updated_at)
    SELECT 
        nc.id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_cohort nc
    CROSS JOIN UNNEST($4::text[]) as dept_id
    WHERE COALESCE(array_length($4::text[], 1), 0) > 0
    ON CONFLICT (cohort_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_profiles AS (
    -- Link profiles if provided (array may be empty)
    INSERT INTO cohort_profiles (cohort_id, profile_id, active)
    SELECT 
        nc.id,
        profile_id::uuid,
        true
    FROM new_cohort nc
    CROSS JOIN UNNEST($5::text[]) as profile_id
    WHERE COALESCE(array_length($5::text[], 1), 0) > 0
    ON CONFLICT (cohort_id, profile_id) DO UPDATE SET
        active = true
),
simulations_with_order AS (
    -- Prepare simulations with position based on array order
    SELECT 
        simulation_id::uuid,
        ROW_NUMBER() OVER () as position
    FROM UNNEST($6::text[]) as simulation_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
),
link_simulations AS (
    -- Link simulations with position if provided (array may be empty)
    INSERT INTO cohort_simulations (cohort_id, simulation_id, active, position)
    SELECT 
        nc.id,
        swo.simulation_id,
        true,
        swo.position
    FROM new_cohort nc
    CROSS JOIN simulations_with_order swo
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
)
-- Return cohort ID and actor name
SELECT 
    nc.id,
    ap.actor_name
FROM new_cohort nc
CROSS JOIN actor_profile ap

