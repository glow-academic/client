-- Create cohort with departments, profiles, and simulations in single query (DHH style)
-- Parameters: $1=title, $2=description, $3=active, $4=department_ids (text[]), 
--             $5=profile_ids (text[]), $6=simulation_ids (text[]), $7=profile_id (uuid or "guest-profile-id")
-- Returns: id, actor_name

WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $7::uuid AND sdg.active = true
             LIMIT 1),
            -- Fallback to default (active) settings guest profile
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $7::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $7::text IS NULL OR $7::text = '' THEN NULL::uuid
            ELSE $7::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        rpi.resolved_profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
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

