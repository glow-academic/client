-- Duplicate cohort with relationships in single query (DHH style)
-- Parameters: $1=original_cohort_id (uuid)
-- Returns: id, title, description

WITH original_cohort AS (
    -- Get original cohort data
    SELECT 
        id,
        title,
        description
    FROM cohorts
    WHERE id = $1::uuid
),
new_cohort AS (
    -- Create duplicate cohort
    INSERT INTO cohorts (
        title,
        description,
        active
    )
    SELECT 
        oc.title || ' Copy',
        oc.description,
        false
    FROM original_cohort oc
    RETURNING id, title, description
),
copy_profiles AS (
    -- Copy profile relationships
    INSERT INTO cohort_profiles (cohort_id, profile_id, active)
    SELECT 
        nc.id,
        cp.profile_id,
        cp.active
    FROM new_cohort nc
    CROSS JOIN original_cohort oc
    JOIN cohort_profiles cp ON cp.cohort_id = oc.id
),
copy_simulations AS (
    -- Copy simulation relationships
    INSERT INTO cohort_simulations (cohort_id, simulation_id, active)
    SELECT 
        nc.id,
        cs.simulation_id,
        cs.active
    FROM new_cohort nc
    CROSS JOIN original_cohort oc
    JOIN cohort_simulations cs ON cs.cohort_id = oc.id
)
-- Return new cohort info
SELECT 
    nc.id,
    oc.title as original_title,
    nc.title,
    nc.description
FROM new_cohort nc
CROSS JOIN original_cohort oc
LIMIT 1

