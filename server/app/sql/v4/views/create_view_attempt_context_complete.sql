-- View: view_attempt_context
-- Layer 2 Domain Aggregate View: Attempt with chat, profile, simulation context.
-- Joins attempts with their related entities via the new entry→resource connection tables.
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_attempt_context AS
WITH
-- Unified attempt→profile connections
all_attempt_profiles AS (
    SELECT attempt_id, profiles_id FROM general_attempts_profiles_connection
    UNION ALL
    SELECT attempt_id, profiles_id FROM practice_attempts_profiles_connection
),
-- Unified attempt→simulation connections
all_attempt_simulations AS (
    SELECT attempt_id, simulations_id FROM general_attempts_simulations_connection
    UNION ALL
    SELECT attempt_id, simulations_id FROM practice_attempts_simulations_connection
),
-- Unified chat→scenario connections
all_chat_scenarios AS (
    SELECT chat_id, scenarios_id FROM general_chats_scenarios_connection
    UNION ALL
    SELECT chat_id, scenarios_id FROM practice_chats_scenarios_connection
)
SELECT
    a.id AS attempt_id,
    a.created_at AS attempt_created_at,
    a.archived AS is_archived,
    a.infinite_mode,
    c.id AS chat_id,
    c.completed AS chat_completed,
    c.created_at AS chat_created_at,
    -- Get profile_id from profiles_resource via connection
    ppj.profile_id,
    -- Get simulation_id from simulations_resource via connection
    ssj.simulation_id,
    -- Get scenario_id from scenarios_resource via connection
    scj.scenario_id
FROM view_attempts a
JOIN view_chats c ON c.attempt_id = a.id
-- Profile: attempt → profiles_resource → profile_artifact
LEFT JOIN all_attempt_profiles aap ON aap.attempt_id = a.id
LEFT JOIN profile_profiles_junction ppj ON ppj.profiles_id = aap.profiles_id
-- Simulation: attempt → simulations_resource → simulation_artifact
LEFT JOIN all_attempt_simulations aas ON aas.attempt_id = a.id
LEFT JOIN simulation_simulations_junction ssj ON ssj.simulations_id = aas.simulations_id
-- Scenario: chat → scenarios_resource → scenario_artifact
LEFT JOIN all_chat_scenarios acs ON acs.chat_id = c.id
LEFT JOIN scenario_scenarios_junction scj ON scj.scenarios_id = acs.scenarios_id;
