-- Update cohort with department, profile, and simulation relationships in single query (DHH style)
-- Parameters: $1=cohort_id (uuid), $2=title, $3=description, $4=active, $5=department_ids (text[]),
--             $6=profile_ids (text[]), $7=simulation_ids (text[])
-- Returns: id, title

WITH cohort_update AS (
    -- Update cohort
    UPDATE cohorts SET
        title = $2,
        description = $3,
        active = $4,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id, title
),
delete_departments AS (
    -- Delete existing department relationships
    DELETE FROM cohort_departments
    WHERE cohort_id = $1::uuid
),
link_departments AS (
    -- Link new departments if provided
    INSERT INTO cohort_departments (cohort_id, department_id, active, created_at, updated_at)
    SELECT 
        cu.id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM cohort_update cu
    CROSS JOIN UNNEST($5::text[]) as dept_id
    WHERE COALESCE(array_length($5::text[], 1), 0) > 0
    ON CONFLICT (cohort_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
deactivate_profiles AS (
    -- Deactivate existing profile relationships not in the new list
    UPDATE cohort_profiles
    SET active = false, updated_at = NOW()
    WHERE cohort_id = $1::uuid
      AND COALESCE(array_length($6::text[], 1), 0) > 0
      AND profile_id NOT IN (
          SELECT profile_id::uuid
          FROM UNNEST($6::text[]) as profile_id
      )
),
link_profiles AS (
    -- Link new profiles if provided
    INSERT INTO cohort_profiles (cohort_id, profile_id, active)
    SELECT 
        cu.id,
        profile_id::uuid,
        true
    FROM cohort_update cu
    CROSS JOIN UNNEST($6::text[]) as profile_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
    ON CONFLICT (cohort_id, profile_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
deactivate_simulations AS (
    -- Deactivate existing simulation relationships not in the new list
    UPDATE cohort_simulations
    SET active = false, updated_at = NOW()
    WHERE cohort_id = $1::uuid
      AND COALESCE(array_length($7::text[], 1), 0) > 0
      AND simulation_id NOT IN (
          SELECT simulation_id::uuid
          FROM UNNEST($7::text[]) as simulation_id
      )
),
link_simulations AS (
    -- Link new simulations if provided
    INSERT INTO cohort_simulations (cohort_id, simulation_id, active)
    SELECT 
        cu.id,
        simulation_id::uuid,
        true
    FROM cohort_update cu
    CROSS JOIN UNNEST($7::text[]) as simulation_id
    WHERE COALESCE(array_length($7::text[], 1), 0) > 0
    ON CONFLICT (cohort_id, simulation_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
-- Return updated cohort info
SELECT id, title FROM cohort_update

