-- Resolve training attempt context: all IDs needed to create an attempt.
-- Pre-resolves profile resource, role, department, practice/home, simulation, cohort.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'get_training_attempt_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS get_training_attempt_context_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_training_attempt_context_v4(
    p_profile_id uuid,
    p_training_entry_id uuid
) RETURNS TABLE(
    training_entry_id uuid,
    is_practice boolean,
    practice_id uuid,
    home_id uuid,
    simulations_resource_id uuid,
    profiles_resource_id uuid,
    cohorts_resource_id uuid,
    departments_resource_id uuid,
    roles_resource_id uuid
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_practice_id uuid;
    v_home_id uuid;
    v_is_practice boolean := false;
    v_simulations_resource_id uuid;
    v_profiles_resource_id uuid;
    v_cohorts_resource_id uuid;
    v_departments_resource_id uuid;
    v_roles_resource_id uuid;
BEGIN
    -- Resolve profile resource
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = p_profile_id
      AND ppj.active = true
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'Profile resource not found for profile_id %', p_profile_id;
    END IF;

    -- Resolve optional role
    SELECT prj.role_id INTO v_roles_resource_id
    FROM profile_roles_junction prj
    WHERE prj.profile_id = p_profile_id
      AND prj.active = true
    LIMIT 1;

    -- Resolve primary department
    SELECT pdj.department_id INTO v_departments_resource_id
    FROM profile_departments_junction pdj
    WHERE pdj.profile_id = p_profile_id
      AND pdj.active = true
      AND pdj.is_primary = true
    LIMIT 1;

    -- Determine practice vs home
    SELECT pte.practice_id INTO v_practice_id
    FROM practice_training_entry pte
    WHERE pte.training_id = p_training_entry_id AND pte.active = true
    LIMIT 1;

    IF v_practice_id IS NOT NULL THEN
        v_is_practice := true;
        SELECT psc.simulations_id INTO v_simulations_resource_id
        FROM practice_simulations_connection psc
        WHERE psc.practice_id = v_practice_id AND psc.active = true
        LIMIT 1;
        SELECT pcc.cohorts_id INTO v_cohorts_resource_id
        FROM practice_cohorts_connection pcc
        WHERE pcc.practice_id = v_practice_id AND pcc.active = true
        LIMIT 1;
    ELSE
        SELECT hte.home_id INTO v_home_id
        FROM home_training_entry hte
        WHERE hte.training_id = p_training_entry_id AND hte.active = true
        LIMIT 1;

        IF v_home_id IS NOT NULL THEN
            v_is_practice := false;
            SELECT hsc.simulations_id INTO v_simulations_resource_id
            FROM home_simulations_connection hsc
            WHERE hsc.home_id = v_home_id AND hsc.active = true
            LIMIT 1;
            SELECT hcc.cohorts_id INTO v_cohorts_resource_id
            FROM home_cohorts_connection hcc
            WHERE hcc.home_id = v_home_id AND hcc.active = true
            LIMIT 1;
        END IF;
    END IF;

    RETURN QUERY SELECT
        p_training_entry_id,
        v_is_practice,
        v_practice_id,
        v_home_id,
        v_simulations_resource_id,
        v_profiles_resource_id,
        v_cohorts_resource_id,
        v_departments_resource_id,
        v_roles_resource_id;
END;
$$;
