-- Materialized View: attempt_hint_mv
-- Grain: One row per hint entry per message
--
-- Filter: active = TRUE with parent chain filters
-- Purpose: Flat denormalized hints for parallel fetching
-- Dependencies: Only uses _entry tables

CREATE MATERIALIZED VIEW attempt_hint_mv AS
SELECT
    h.id AS hint_id,
    h.message_id,
    h.hint,
    (ROW_NUMBER() OVER (PARTITION BY h.message_id ORDER BY h.created_at) - 1)::int AS idx,
    h.created_at
FROM attempt_hint_entry h
JOIN attempt_message_entry sm ON sm.id = h.message_id
JOIN messages_entry m ON m.id = sm.id
JOIN attempt_chat_entry c ON c.id = sm.chat_id
JOIN attempt_chat_bridge_entry ac ON ac.attempt_chat_id = c.id
JOIN attempt_entry a ON a.id = ac.attempt_id
LEFT JOIN LATERAL (
    SELECT archived FROM attempt_archive_entry
    WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) sa_archive ON true
WHERE h.active = TRUE
  AND m.active = TRUE
  AND c.active = TRUE
  AND a.active = TRUE
  AND COALESCE(sa_archive.archived, FALSE) = FALSE
WITH NO DATA;
