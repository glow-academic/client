-- Indexes for materialized view: attempt_improvement_mv
--

CREATE UNIQUE INDEX attempt_improvement_mv_pk
    ON attempt_improvement_mv (improvement_id);

CREATE INDEX attempt_improvement_mv_message_id_idx
    ON attempt_improvement_mv (message_id);

CREATE INDEX attempt_improvement_mv_message_created_at_idx
    ON attempt_improvement_mv (message_id, created_at);
