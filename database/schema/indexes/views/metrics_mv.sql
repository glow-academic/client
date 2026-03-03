-- Indexes for materialized view: metrics_mv
--

CREATE UNIQUE INDEX metrics_mv_pk
    ON metrics_mv (date_hour);

CREATE INDEX metrics_mv_date_hour_desc_idx
    ON metrics_mv (date_hour DESC);
