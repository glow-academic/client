CREATE TYPE feedback_type AS ENUM ('feature', 'bug', 'question', 'other');

CREATE TABLE app_logs (
  id           SERIAL PRIMARY KEY,
  level        TEXT NOT NULL,          -- "info" | "error" | …
  message      TEXT,
  context      JSONB,                  -- extra metadata / stack traces
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE app_feedback (
  id           SERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT now(),
  profile_id   UUID REFERENCES profiles(id) ON DELETE CASCADE DEFAULT NULL,
  type         feedback_type NOT NULL,
  message      TEXT
);