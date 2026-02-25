-- Create attempt entry with pre-resolved context IDs.
-- Pure creator: caller provides all IDs via training context resolver.

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
    p_practice boolean DEFAULT false,
    p_infinite_mode boolean DEFAULT false,
    p_practice_id uuid DEFAULT NULL,
    p_home_id uuid DEFAULT NULL,
    p_simulations_resource_id uuid DEFAULT NULL,
    p_profiles_resource_id uuid DEFAULT NULL,
    p_cohorts_resource_id uuid DEFAULT NULL,
    p_departments_resource_id uuid DEFAULT NULL,
    p_roles_resource_id uuid DEFAULT NULL
)
RETURNS TABLE (
    out_attempt_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_attempt_id uuid;
BEGIN
    IF p_simulations_resource_id IS NULL THEN
        RAISE EXCEPTION 'simulations_resource_id is required';
    END IF;

    IF p_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'profiles_resource_id is required';
    END IF;

    -- Create attempt entry
    INSERT INTO attempt_entry (created_at, updated_at, practice, infinite_mode)
    VALUES (NOW(), NOW(), p_practice, p_infinite_mode)
    RETURNING id INTO v_attempt_id;

    -- Insert into the appropriate parent connection table
    IF p_practice_id IS NOT NULL THEN
        INSERT INTO attempt_practice_entry (attempt_id, practice_id)
        VALUES (v_attempt_id, p_practice_id);
    ELSIF p_home_id IS NOT NULL THEN
        INSERT INTO attempt_home_entry (attempt_id, home_id)
        VALUES (v_attempt_id, p_home_id);
    END IF;

    -- Resource connections
    INSERT INTO attempt_simulations_connection (simulations_id, attempt_id, active)
    VALUES (p_simulations_resource_id, v_attempt_id, true)
    ON CONFLICT (attempt_id, simulations_id) DO NOTHING;

    -- NOTE: attempt_profiles_connection removed in migration 540
    -- Profile is now linked via profile_personas_entry on attempt_entry

    IF p_cohorts_resource_id IS NOT NULL THEN
        INSERT INTO attempt_cohorts_connection (cohorts_id, attempt_id, active)
        VALUES (p_cohorts_resource_id, v_attempt_id, true)
        ON CONFLICT (attempt_id, cohorts_id) DO NOTHING;
    END IF;

    IF p_departments_resource_id IS NOT NULL THEN
        INSERT INTO attempt_departments_connection (departments_id, attempt_id, active)
        VALUES (p_departments_resource_id, v_attempt_id, true)
        ON CONFLICT (attempt_id, departments_id) DO NOTHING;
    END IF;

    IF p_roles_resource_id IS NOT NULL THEN
        INSERT INTO attempt_roles_connection (roles_id, attempt_id, active)
        VALUES (p_roles_resource_id, v_attempt_id, true)
        ON CONFLICT (attempt_id, roles_id) DO NOTHING;
    END IF;

    -- Refresh MV so attempt is immediately visible.
    REFRESH MATERIALIZED VIEW attempt_mv;

    RETURN QUERY SELECT v_attempt_id;
END;
$$;
