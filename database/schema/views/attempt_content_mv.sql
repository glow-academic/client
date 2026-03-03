-- Materialized View: attempt_content_mv
-- Grain: One row per content entry per message
--
-- Purpose: Flat content entries for simulation messages
-- Section: SIMULATION (lean MV)
--
-- Dependencies: attempt_content_entry, attempt_message_entry,
--               messages_entry, attempt_chat_entry, attempt_chat_bridge_entry (bridge), attempt_entry

CREATE MATERIALIZED VIEW attempt_content_mv AS
SELECT
    sce.id AS content_id,
    sce.message_id,
    sce.content,
    sce.persona_id AS persona_entry_id,
    (ROW_NUMBER() OVER (PARTITION BY sce.message_id ORDER BY sce.created_at) - 1)::int AS idx,
    sce.created_at
FROM attempt_content_entry sce
JOIN attempt_message_entry sm ON sm.id = sce.message_id
JOIN messages_entry m ON m.id = sm.id
JOIN attempt_chat_entry c ON c.id = sm.chat_id
JOIN attempt_chat_bridge_entry ac ON ac.attempt_chat_id = c.id
JOIN attempt_entry a ON a.id = ac.attempt_id
LEFT JOIN LATERAL (
    SELECT archived FROM attempt_archive_entry
    WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) sa_archive ON true
WHERE sce.active = TRUE
  AND m.active = TRUE
  AND c.active = TRUE
  AND a.active = TRUE
  AND COALESCE(sa_archive.archived, FALSE) = FALSE
WITH NO DATA;
