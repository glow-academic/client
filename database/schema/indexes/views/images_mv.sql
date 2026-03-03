-- Indexes for materialized view: images_mv
--

CREATE UNIQUE INDEX images_mv_pk
    ON images_mv (image_id);

CREATE INDEX images_mv_uploads_id_idx
    ON images_mv (uploads_id);

CREATE INDEX images_mv_created_at_idx
    ON images_mv (created_at DESC);
