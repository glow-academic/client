-- View: view_simulation_messages_entry
-- Wrapper for simulation_messages_entry joined with messages_entry base table.
-- After migration 364: simulation_messages_entry only has (id, chat_id, timestamps)
-- and joins to messages_entry for (run_id, role, completed, audio, generated, mcp, active).
-- Uses DROP/CREATE for clean replacement.

DROP VIEW IF EXISTS view_simulation_messages_entry CASCADE;

CREATE VIEW view_simulation_messages_entry AS
SELECT
    sm.id,
    sm.chat_id,
    m.run_id,
    sm.created_at,
    sm.updated_at,
    m.role,
    m.completed,
    m.audio,
    m.generated,
    m.mcp,
    m.active
FROM simulation_messages_entry sm
JOIN messages_entry m ON m.id = sm.id;
