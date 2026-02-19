-- Create attempt entry only (no chat).
-- Subset of prepare_training_start - creates structural attempt row
-- for the new "lobby" flow where chat is created later via WS.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'create_attempt_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS create_attempt_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION create_attempt_v4(
    p_profile_id uuid,
    p_training_entry_id uuid,
    p_infinite_mode boolean DEFAULT false
)
RETURNS TABLE (
    out_attempt_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_attempt_id uuid;
    v_practice_id uuid;
    v_home_id uuid;
    v_simulations_resource_id uuid;
    v_simulation_artifact_id uuid;
    v_cohorts_resource_id uuid;
    v_is_practice boolean := false;

    v_profiles_resource_id uuid;
    v_roles_resource_id uuid;
    v_department_id uuid;
BEGIN
    -- Resolve profile resource and optional role.
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = p_profile_id
      AND ppj.active = true
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'Profile resource not found for profile_id %', p_profile_id;
    END IF;

    SELECT prj.role_id INTO v_roles_resource_id
    FROM profile_roles_junction prj
    WHERE prj.profile_id = p_profile_id
      AND prj.active = true
    LIMIT 1;

    -- Resolve primary department for the profile.
    SELECT pdj.department_id INTO v_department_id
    FROM profile_departments_junction pdj
    WHERE pdj.profile_id = p_profile_id
      AND pdj.active = true
      AND pdj.is_primary = true
    LIMIT 1;

    -- Determine practice vs home via entry tables, resolve simulation + cohort.
    SELECT pte.practice_id INTO v_practice_id
    FROM practice_training_entry pte
    WHERE pte.training_id = p_training_entry_id AND pte.active = true
    LIMIT 1;

    IF v_practice_id IS NOT NULL THEN
        v_is_practice := true;
        -- Simulation from practice_simulations_connection
        SELECT psc.simulations_id INTO v_simulations_resource_id
        FROM practice_simulations_connection psc
        WHERE psc.practice_id = v_practice_id AND psc.active = true
        LIMIT 1;
        -- Cohort from practice_cohorts_connection
        SELECT pcc.cohorts_id INTO v_cohorts_resource_id
        FROM practice_cohorts_connection pcc
        WHERE pcc.practice_id = v_practice_id AND pcc.active = true
        LIMIT 1;
    ELSE
        -- Check home_training_entry
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

    -- Resolve simulation artifact
    SELECT ssj.simulation_id INTO v_simulation_artifact_id
    FROM simulation_simulations_junction ssj
    WHERE ssj.simulations_id = v_simulations_resource_id AND ssj.active = true
    LIMIT 1;

    IF v_simulations_resource_id IS NULL OR v_simulation_artifact_id IS NULL THEN
        RAISE EXCEPTION 'Simulation scope not found for training entry %', p_training_entry_id;
    END IF;

    -- Create attempt entry (no chat - that happens later via WS).
    INSERT INTO attempt_entry (created_at, updated_at, practice, infinite_mode)
    VALUES (NOW(), NOW(), v_is_practice, p_infinite_mode)
    RETURNING id INTO v_attempt_id;

    -- Insert into the appropriate connection table
    IF v_practice_id IS NOT NULL THEN
        INSERT INTO attempt_practice_entry (attempt_id, practice_id)
        VALUES (v_attempt_id, v_practice_id);
    ELSIF v_home_id IS NOT NULL THEN
        INSERT INTO attempt_home_entry (attempt_id, home_id)
        VALUES (v_attempt_id, v_home_id);
    END IF;

    INSERT INTO attempt_simulations_connection (simulations_id, attempt_id, active)
    VALUES (v_simulations_resource_id, v_attempt_id, true)
    ON CONFLICT (attempt_id, simulations_id) DO NOTHING;

    INSERT INTO attempt_profiles_connection (profiles_id, attempt_id, active)
    VALUES (v_profiles_resource_id, v_attempt_id, true)
    ON CONFLICT (attempt_id, profiles_id) DO NOTHING;

    IF v_cohorts_resource_id IS NOT NULL THEN
        INSERT INTO attempt_cohorts_connection (cohorts_id, attempt_id, active)
        VALUES (v_cohorts_resource_id, v_attempt_id, true)
        ON CONFLICT (attempt_id, cohorts_id) DO NOTHING;
    END IF;

    IF v_department_id IS NOT NULL THEN
        INSERT INTO attempt_departments_connection (departments_id, attempt_id, active)
        VALUES (v_department_id, v_attempt_id, true)
        ON CONFLICT (attempt_id, departments_id) DO NOTHING;
    END IF;

    IF v_roles_resource_id IS NOT NULL THEN
        INSERT INTO attempt_roles_connection (roles_id, attempt_id, active)
        VALUES (v_roles_resource_id, v_attempt_id, true)
        ON CONFLICT (attempt_id, roles_id) DO NOTHING;
    END IF;

    -- Refresh MV so attempt is immediately visible.
    REFRESH MATERIALIZED VIEW attempt_mv;

    RETURN QUERY SELECT v_attempt_id;
END;
$$;
