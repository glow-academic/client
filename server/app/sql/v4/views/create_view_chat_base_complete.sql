-- View: view_chat_base_complete
-- Layer 1 Base View: Unified chats with all primary connections.
-- Uses simulation_* entry and connection tables.
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_chat_base_complete AS
SELECT
    c.id,
    c.created_at,
    c.updated_at,
    c.title,
    c.completed,
    c.generated,
    c.mcp,
    c.active,
    c.attempt_id,
    CASE
        WHEN a.practice IS TRUE THEN 'practice'::text
        ELSE 'general'::text
    END AS chat_type,
    -- Scenario connection
    csc.scenarios_id AS scenario_resource_id,
    -- Persona connection
    cpc.personas_id AS persona_resource_id
FROM simulation_chats_entry c
JOIN simulation_attempts_entry a ON a.id = c.attempt_id
-- Required connections
JOIN simulation_chats_scenarios_connection csc ON csc.chat_id = c.id
-- Optional connections
LEFT JOIN simulation_chats_personas_connection cpc ON cpc.chat_id = c.id
WHERE c.active = true;
