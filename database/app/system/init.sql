CREATE TYPE feedback_type AS ENUM ('feature', 'bug', 'question', 'other');

CREATE TABLE app_logs (
  id               SERIAL PRIMARY KEY,
  event            TEXT NOT NULL,         -- e.g., "simulation.start", "mutation.update.failed"
  level            TEXT NOT NULL,         -- "debug" | "info" | "warn" | "error"
  message          TEXT,                  -- optional human-readable message
  correlation_id   TEXT,                  -- request/session/flow correlation
  actor            JSONB,                 -- { userId?, profileId? }
  subject          JSONB,                 -- { entityType?, entityId? }
  metrics          JSONB,                 -- { durationMs?, size?, count? }
  context          JSONB,                 -- { route?, component?, function?, ... }
  error            JSONB,                 -- { name?, message?, stack?, code? }
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE app_feedback (
  id           SERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT now(),
  profile_id   UUID REFERENCES profiles(id) ON DELETE CASCADE DEFAULT NULL,
  type         feedback_type NOT NULL,
  message      TEXT
);