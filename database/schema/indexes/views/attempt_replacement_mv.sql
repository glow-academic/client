-- Indexes for materialized view: attempt_replacement_mv
--

CREATE UNIQUE INDEX attempt_replacement_mv_pk
    ON attempt_replacement_mv (replacement_id);

CREATE INDEX attempt_replacement_mv_improvement_id_idx
    ON attempt_replacement_mv (improvement_id);

CREATE INDEX attempt_replacement_mv_improvement_idx_idx
    ON attempt_replacement_mv (improvement_id, idx);
