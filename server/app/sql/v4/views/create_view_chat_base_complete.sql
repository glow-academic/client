-- View: view_chat_base_complete
-- Layer 1 Base View: Unified chats with all primary connections.
-- Combines general_chats_entry + practice_chats_entry with connections
-- to scenarios and personas.
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_chat_base_complete AS
-- General chats with all connections
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
    'general'::text AS chat_type,
    -- Scenario connection
    csc.scenarios_id AS scenario_resource_id,
    -- Persona connection
    cpc.personas_id AS persona_resource_id
FROM general_chats_entry c
-- Required connections
JOIN general_chats_scenarios_connection csc ON csc.chat_id = c.id
-- Optional connections
LEFT JOIN general_chats_personas_connection cpc ON cpc.chat_id = c.id
WHERE c.active = true

UNION ALL

-- Practice chats with connections
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
    'practice'::text AS chat_type,
    -- Scenario connection
    csc.scenarios_id AS scenario_resource_id,
    -- Persona connection
    cpc.personas_id AS persona_resource_id
FROM practice_chats_entry c
-- Required connections
JOIN practice_chats_scenarios_connection csc ON csc.chat_id = c.id
-- Optional connections
LEFT JOIN practice_chats_personas_connection cpc ON cpc.chat_id = c.id
WHERE c.active = true;
