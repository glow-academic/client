-- Indexes for materialized view: attempt_hint_mv
--

CREATE UNIQUE INDEX attempt_hint_mv_pk
    ON attempt_hint_mv (hint_id);

CREATE INDEX attempt_hint_mv_message_id_idx
    ON attempt_hint_mv (message_id);

CREATE INDEX attempt_hint_mv_message_idx_idx
    ON attempt_hint_mv (message_id, idx);
