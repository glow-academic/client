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
    v_training_id uuid;
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

    -- Resolve training scope from training_entry.
    SELECT
        tb.training_id,
        t.simulations_id,
        t.cohorts_id,
        t.practice,
        (
            SELECT ssj.simulation_id
            FROM simulation_simulations_junction ssj
            WHERE ssj.simulations_id = t.simulations_id
              AND ssj.active = true
            LIMIT 1
        )
    INTO
        v_training_id,
        v_simulations_resource_id,
        v_cohorts_resource_id,
        v_is_practice,
        v_simulation_artifact_id
    FROM training_entry tb
    JOIN training_entry t
      ON t.id = tb.training_id
     AND t.active = true
    WHERE tb.id = p_training_entry_id
      AND tb.active = true
    LIMIT 1;

    IF v_training_id IS NULL THEN
        RAISE EXCEPTION 'Training bundle not found or inactive: %', p_training_entry_id;
    END IF;

    IF v_simulations_resource_id IS NULL OR v_simulation_artifact_id IS NULL THEN
        RAISE EXCEPTION 'Simulation scope not found for training bundle %', p_training_entry_id;
    END IF;

    -- Create attempt entry (no chat - that happens later via WS).
    INSERT INTO attempt_entry (created_at, updated_at, practice, infinite_mode, training_id)
    VALUES (NOW(), NOW(), v_is_practice, p_infinite_mode, v_training_id)
    RETURNING id INTO v_attempt_id;

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
    REFRESH MATERIALIZED VIEW mv_attempt_list;

    RETURN QUERY SELECT v_attempt_id;
END;
$$;
