-- Indexes for materialized view: attempt_strength_mv
--

CREATE UNIQUE INDEX attempt_strength_mv_pk
    ON attempt_strength_mv (strength_id);

CREATE INDEX attempt_strength_mv_message_id_idx
    ON attempt_strength_mv (message_id);

CREATE INDEX attempt_strength_mv_message_created_idx
    ON attempt_strength_mv (message_id, created_at);
