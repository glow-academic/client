CREATE TYPE feedback_type AS ENUM ('feature', 'bug', 'question', 'other');

CREATE TABLE app_logs (
  id               SERIAL PRIMARY KEY,
  event            TEXT NOT NULL DEFAULT 'default.event',         -- e.g., "simulation.start", "mutation.update.failed"
  level            TEXT NOT NULL DEFAULT 'info',                  -- "debug" | "info" | "warn" | "error"
  message          TEXT NOT NULL DEFAULT 'Default Message',       -- human-readable message (NOT NULL)
  correlation_id   TEXT NOT NULL DEFAULT 'default.correlation',   -- request/session/flow correlation (NOT NULL)
  actor            JSONB NOT NULL DEFAULT '{"userId":null,"profileId":null}'::jsonb,        -- { userId?, profileId? } (NOT NULL)
  subject          JSONB NOT NULL DEFAULT '{"entityType":null,"entityId":null}'::jsonb,     -- { entityType?, entityId? } (NOT NULL)
  context          JSONB NOT NULL DEFAULT '{"route":null,"component":null,"function":null}'::jsonb, -- { route?, component?, function?, ... } (NOT NULL)
  error            JSONB NOT NULL DEFAULT '{"name":null,"message":null,"stack":null,"code":null}'::jsonb, -- { name?, message?, stack?, code? } (NOT NULL)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  -- metrics column removed (was 100% NULL, never used)
);

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

-- ============================================================================
-- PROMPTS INFRASTRUCTURE
-- ============================================================================

-- Prompts table (shared system resource for agents and personas)
CREATE TABLE prompts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  system_prompt TEXT     NOT NULL
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