CREATE TABLE app_logs (
  id           SERIAL PRIMARY KEY,
  level        TEXT NOT NULL,          -- "info" | "error" | …
  message      TEXT,
  context      JSONB,                  -- extra metadata / stack traces
  created_at   TIMESTAMPTZ DEFAULT now()
);