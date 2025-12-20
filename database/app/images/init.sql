-- UUIDv7 support is built into PostgreSQL 18+ (no extension needed)

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE images (
  id         UUID        PRIMARY KEY DEFAULT uuidv7(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  completed  BOOLEAN     NOT NULL DEFAULT FALSE,
  active     BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX ON images (name);
CREATE INDEX ON images (created_at);
CREATE INDEX ON images (active);

-- Image → Uploads junction table (BCNF normalization)
-- Allows version history of image uploads
CREATE TABLE image_uploads (
    image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (image_id, upload_id)
);

CREATE INDEX ON image_uploads (image_id);
CREATE INDEX ON image_uploads (upload_id);
CREATE INDEX ON image_uploads (image_id, active);

