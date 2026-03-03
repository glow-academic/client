-- Indexes for materialized view: attempt_highlight_mv
--

CREATE UNIQUE INDEX attempt_highlight_mv_pk
    ON attempt_highlight_mv (highlight_id);

CREATE INDEX attempt_highlight_mv_strength_id_idx
    ON attempt_highlight_mv (strength_id);

CREATE INDEX attempt_highlight_mv_strength_idx_idx
    ON attempt_highlight_mv (strength_id, idx);
