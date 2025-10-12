CREATE TYPE feedback_type AS ENUM ('feature', 'bug', 'question', 'other');

CREATE TABLE app_logs (
  id               SERIAL PRIMARY KEY,
  event            TEXT NOT NULL DEFAULT 'default.event',         -- e.g., "simulation.start", "mutation.update.failed"
  level            TEXT NOT NULL DEFAULT 'info',                  -- "debug" | "info" | "warn" | "error"
  message          TEXT DEFAULT 'Default Message',                -- optional human-readable message
  correlation_id   TEXT DEFAULT 'default.correlation',            -- request/session/flow correlation
  actor            JSONB DEFAULT '{"userId":null,"profileId":null}'::jsonb,        -- { userId?, profileId? }
  subject          JSONB DEFAULT '{"entityType":null,"entityId":null}'::jsonb,     -- { entityType?, entityId? }
  metrics          JSONB DEFAULT '{"durationMs":null,"size":null,"count":null}'::jsonb, -- { durationMs?, size?, count? }
  context          JSONB DEFAULT '{"route":null,"component":null,"function":null}'::jsonb, -- { route?, component?, function?, ... }
  error            JSONB DEFAULT '{"name":null,"message":null,"stack":null,"code":null}'::jsonb, -- { name?, message?, stack?, code? }
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE app_feedback (
  id           SERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT now(),
  type         feedback_type NOT NULL,
  message      TEXT
);

-- App feedback ↔ Profiles junction table (BCNF normalization - replaces app_feedback.profile_id)
CREATE TABLE app_feedback_profiles (
  app_feedback_id INT  NOT NULL REFERENCES app_feedback(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES profiles(id)     ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'author',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_feedback_id, profile_id, role)
);

CREATE INDEX ON app_feedback_profiles (profile_id);
CREATE INDEX ON app_feedback_profiles (app_feedback_id);