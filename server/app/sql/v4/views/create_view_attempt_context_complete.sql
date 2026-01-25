-- View: view_attempt_context
-- Layer 2 Domain Aggregate View: Attempt with chat, profile, simulation context.
-- Joins attempts with their related entities via junction tables.
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_attempt_context AS
SELECT
    a.id AS attempt_id,
    a.created_at AS attempt_created_at,
    a.archived AS is_archived,
    a.infinite_mode,
    c.id AS chat_id,
    c.completed AS chat_completed,
    c.created_at AS chat_created_at,
    pa.profile_id,
    sa.simulation_id,
    sca.scenario_id
FROM view_attempts a
JOIN view_chats c ON c.attempt_id = a.id
LEFT JOIN profile_attempts_junction pa ON pa.attempt_id = a.id AND pa.active = true
LEFT JOIN simulation_attempts_junction sa ON sa.attempt_id = a.id AND sa.active = true
LEFT JOIN scenario_chats_junction sca ON sca.chat_id = c.id AND sca.active = true;
