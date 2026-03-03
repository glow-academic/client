-- Indexes for materialized view: health_mv
--

CREATE UNIQUE INDEX health_mv_pk
    ON health_mv (date_hour, service);

CREATE INDEX health_mv_date_hour_idx
    ON health_mv (date_hour DESC);

CREATE INDEX health_mv_service_idx
    ON health_mv (service);

CREATE INDEX health_mv_service_date_idx
    ON health_mv (service, date_hour DESC);
