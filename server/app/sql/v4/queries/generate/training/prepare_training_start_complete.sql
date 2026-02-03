-- Prepare training start - creates attempt + chat entries
-- Does NOT create a run - that happens on first message

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_training_start_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_training_start_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_prepare_training_start_v4(
    p_profile_id uuid,
    p_simulation_id uuid,
    p_scenario_id uuid DEFAULT NULL
)
RETURNS TABLE (
    attempt_id uuid,
    chat_id uuid,
    scenario_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_attempt_id uuid;
    v_chat_id uuid;
    v_scenario_artifact_id uuid;
    v_profiles_resource_id uuid;
    v_scenarios_resource_id uuid;
BEGIN
    -- Look up profiles_resource ID from profile_artifact ID
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = p_profile_id
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'Profile resource not found for profile_id %', p_profile_id;
    END IF;

    -- Get first scenario if not specified
    IF p_scenario_id IS NULL THEN
        SELECT sc.id INTO v_scenario_artifact_id
        FROM simulation_scenarios_junction ss
        JOIN scenario_artifact sc ON sc.id = ss.scenario_id
        LEFT JOIN simulation_scenario_positions_junction ssp ON ssp.simulation_id = ss.simulation_id
        LEFT JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id
        WHERE ss.simulation_id = p_simulation_id
          AND ss.active = true
        ORDER BY COALESCE(spr.value, 999999) ASC
        LIMIT 1;
    ELSE
        v_scenario_artifact_id := p_scenario_id;
    END IF;

    -- Look up scenarios_resource ID from scenario_artifact ID
    IF v_scenario_artifact_id IS NOT NULL THEN
        SELECT ssj.scenarios_id INTO v_scenarios_resource_id
        FROM scenario_scenarios_junction ssj
        WHERE ssj.scenario_id = v_scenario_artifact_id
        LIMIT 1;
    END IF;

    -- Create attempt entry
    INSERT INTO simulation_attempts_entry (created_at, updated_at, practice)
    VALUES (NOW(), NOW(), false)
    RETURNING id INTO v_attempt_id;

    -- Link attempt to simulation (p_simulation_id is already a simulations_resource ID)
    INSERT INTO simulation_attempts_simulations_connection (simulations_id, attempt_id, active)
    VALUES (p_simulation_id, v_attempt_id, true);

    -- Link attempt to profile (using resource ID)
    INSERT INTO simulation_attempts_profiles_connection (profiles_id, attempt_id, active)
    VALUES (v_profiles_resource_id, v_attempt_id, true);

    -- Create chat entry (chat has attempt_id directly)
    INSERT INTO simulation_chats_entry (attempt_id, created_at, updated_at, title, completed)
    VALUES (v_attempt_id, NOW(), NOW(), 'Chat', false)
    RETURNING id INTO v_chat_id;

    -- Link chat to scenario if we have one (using resource ID)
    IF v_scenarios_resource_id IS NOT NULL THEN
        INSERT INTO simulation_chats_scenarios_connection (scenarios_id, chat_id, active)
        VALUES (v_scenarios_resource_id, v_chat_id, true);
    END IF;

    RETURN QUERY SELECT v_attempt_id, v_chat_id, v_scenario_artifact_id;
END;
$$;
