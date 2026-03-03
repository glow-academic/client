-- Indexes for materialized view: texts_mv
--

CREATE UNIQUE INDEX texts_mv_pk
    ON texts_mv (texts_id, text_id);

CREATE INDEX texts_mv_texts_id_idx
    ON texts_mv (texts_id);

CREATE INDEX texts_mv_text_id_idx
    ON texts_mv (text_id);

CREATE INDEX texts_mv_uploads_id_idx
    ON texts_mv (uploads_id);

CREATE INDEX texts_mv_created_at_idx
    ON texts_mv (created_at DESC);
