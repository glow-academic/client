-- Materialized View: attempt_strength_mv
-- Grain: One row per strength entry per message
--
-- Purpose: Flat strength entries for simulation messages
-- Section: SIMULATION (lean MV)
--
-- Dependencies: attempt_strength_entry, attempt_message_entry,
--               messages_entry, attempt_chat_entry, attempt_chat_bridge_entry (bridge), attempt_entry

CREATE MATERIALIZED VIEW attempt_strength_mv AS
SELECT
    s.id AS strength_id,
    s.message_id,
    s.grade_id,
    s.name,
    s.description,
    s.created_at
FROM attempt_strength_entry s
JOIN attempt_message_entry sm ON sm.id = s.message_id
JOIN messages_entry m ON m.id = sm.id
JOIN attempt_chat_entry c ON c.id = sm.chat_id
JOIN attempt_chat_bridge_entry ac ON ac.attempt_chat_id = c.id
JOIN attempt_entry a ON a.id = ac.attempt_id
LEFT JOIN LATERAL (
    SELECT archived FROM attempt_archive_entry
    WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) sa_archive ON true
WHERE s.active = TRUE
  AND m.active = TRUE
  AND c.active = TRUE
  AND a.active = TRUE
  AND COALESCE(sa_archive.archived, FALSE) = FALSE
WITH NO DATA;
