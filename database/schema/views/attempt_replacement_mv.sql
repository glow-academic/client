-- Materialized View: attempt_replacement_mv
-- Grain: One row per replacement entry per improvement
--
-- Filter: active = TRUE with parent chain filters
-- Purpose: Flat denormalized replacements for parallel fetching
-- Dependencies: Only uses _entry tables

CREATE MATERIALIZED VIEW attempt_replacement_mv AS
SELECT
    r.id AS replacement_id,
    r.improvement_id,
    r.section,
    r.replace AS replace_text,
    r.idx,
    r.created_at
FROM attempt_replacement_entry r
JOIN attempt_improvement_entry i ON i.id = r.improvement_id
JOIN attempt_message_entry sm ON sm.id = i.message_id
JOIN messages_entry m ON m.id = sm.id
JOIN attempt_chat_entry c ON c.id = sm.chat_id
JOIN attempt_chat_bridge_entry ac ON ac.attempt_chat_id = c.id
JOIN attempt_entry a ON a.id = ac.attempt_id
LEFT JOIN LATERAL (
    SELECT archived FROM attempt_archive_entry
    WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) sa_archive ON true
WHERE r.active = TRUE
  AND i.active = TRUE
  AND m.active = TRUE
  AND c.active = TRUE
  AND a.active = TRUE
  AND COALESCE(sa_archive.archived, FALSE) = FALSE
WITH NO DATA;
