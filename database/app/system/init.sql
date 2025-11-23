CREATE TYPE feedback_type AS ENUM ('feature', 'bug', 'question', 'other');

-- Application logs table (Chris Date: No Nulls, BCNF)
-- Profile relationship moved to app_logs_profiles junction table
CREATE TABLE app_logs (
  id          bigserial PRIMARY KEY,
  ts          timestamptz NOT NULL DEFAULT now(),
  level       text NOT NULL,                    -- 'debug' | 'info' | 'warn' | 'error'
  logger_name text NOT NULL,                    -- logger/component name (e.g., "app.api.v3.profile.detail")
  message     text NOT NULL,                    -- log message
  extra       jsonb                             -- additional context data (can be NULL)
);

CREATE INDEX ON app_logs (ts);
CREATE INDEX ON app_logs (level);

-- Application metrics table (snapshot-based metrics tracking)
CREATE TABLE app_metrics (
  ts              timestamptz PRIMARY KEY,     -- snapshot time rounded to minute
  requests_total  bigint NOT NULL,             -- cumulative requests so far
  errors_total    bigint NOT NULL,             -- cumulative errors
  avg_latency_ms  double precision NOT NULL,  -- average latency in milliseconds
  cpu_percent     double precision NOT NULL,  -- CPU usage percentage
  memory_bytes    bigint NOT NULL              -- memory usage in bytes
);

CREATE INDEX ON app_metrics (ts);

CREATE TABLE app_feedback (
  id           SERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  type         feedback_type NOT NULL,
  message      TEXT NOT NULL DEFAULT 'No message provided'
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

-- App logs ↔ Profiles junction table (BCNF normalization - replaces app_logs.profile_id)
CREATE TABLE app_logs_profiles (
  app_log_id  bigint NOT NULL REFERENCES app_logs(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_log_id, profile_id)
);

CREATE INDEX ON app_logs_profiles (profile_id);
CREATE INDEX ON app_logs_profiles (app_log_id);

-- ============================================================================
-- PROMPTS INFRASTRUCTURE
-- ============================================================================

-- Prompts table (shared system resource for agents and personas)
CREATE TABLE prompts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT       NOT NULL,
  system_prompt TEXT     NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX ON prompts (created_at);

-- Prompt → Departments binary relationship table
-- Tracks which prompts are available to departments
-- No records = available to all departments (cross-department)
CREATE TABLE prompt_departments (
  prompt_id     UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (prompt_id, department_id)
);

CREATE INDEX ON prompt_departments (prompt_id);
CREATE INDEX ON prompt_departments (department_id);
CREATE INDEX ON prompt_departments (active);