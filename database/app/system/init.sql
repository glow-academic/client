CREATE TYPE feedback_type AS ENUM ('feature', 'bug', 'question', 'other');

-- Activity table (Chris Date: No Nulls, BCNF)
-- Simple activity logging with semantic audit events
CREATE TABLE activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  message     text NOT NULL,                    -- fully rendered activity message (no placeholders)
  endpoint    text NOT NULL,                    -- route path
  profile_id  UUID NOT NULL REFERENCES profiles(id)
);

CREATE INDEX ON activity (created_at);
CREATE INDEX ON activity (profile_id);
CREATE INDEX ON activity (endpoint);

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

-- Service health table (Chris Date: No Nulls, BCNF)
-- Tracks health check results for system services
CREATE TABLE service_health (
  ts          timestamptz NOT NULL,              -- snapshot time rounded to minute
  service     text        NOT NULL,              -- service name ('database', 'redis', 'keycloak', 'websocket', 'tus')
  ok          boolean     NOT NULL,              -- check passed
  latency_ms  double precision NOT NULL,        -- latency in milliseconds
  error       text        NOT NULL DEFAULT '',   -- error message (empty string = no error)
  PRIMARY KEY (ts, service)
);

CREATE INDEX ON service_health (service, ts);

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

-- ============================================================================
-- SETTINGS TABLE
-- ============================================================================

-- Settings table (read/delete only - snapshot-based configuration)
-- Read/delete only: no UPDATEs, only INSERTs and DELETEs
-- Only one active settings row allowed (enforced via UNIQUE INDEX)
-- Following Chris Date principles: BCNF, No Nulls
CREATE TABLE settings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active          BOOLEAN     NOT NULL,
  name            TEXT        NOT NULL,
  description     TEXT        NOT NULL,
  -- Theme primitives (user-editable high-level theme configuration)
  primary_color   TEXT        NOT NULL,   -- Main brand/action color
  accent          TEXT        NOT NULL,   -- Secondary brand color
  background      TEXT        NOT NULL,   -- Page background
  surface         TEXT        NOT NULL,   -- Cards/panels
  success         TEXT        NOT NULL,   -- Success status color
  warning         TEXT        NOT NULL,   -- Warning status color
  error           TEXT        NOT NULL,   -- Error status color
  sidebar_background TEXT     NOT NULL,   -- Sidebar background
  sidebar_primary TEXT        NOT NULL,   -- Sidebar primary color
  chart1          TEXT        NOT NULL,   -- Chart color 1
  chart2          TEXT        NOT NULL,   -- Chart color 2
  chart3          TEXT        NOT NULL,   -- Chart color 3
  chart4          TEXT        NOT NULL,   -- Chart color 4
  chart5          TEXT        NOT NULL,  -- Chart color 5
  -- Authentication and analytics settings
  guest_login_enabled BOOLEAN NOT NULL DEFAULT TRUE,  -- Enable guest login button
  success_threshold INTEGER NOT NULL DEFAULT 85,       -- Success threshold for analytics (0-100)
  warning_threshold INTEGER NOT NULL DEFAULT 80,       -- Warning threshold for analytics (0-100)
  danger_threshold INTEGER NOT NULL DEFAULT 70         -- Danger threshold for analytics (0-100)
);

CREATE INDEX ON settings (created_at);
CREATE INDEX ON settings (active);

-- Note: Multiple active settings are allowed (one per department + one global)
-- The unique constraint settings_one_active was removed in migration 86

-- Settings → Departments binary relationship table
-- Tracks which settings are available to departments
-- No records = available to all departments (cross-department)
CREATE TABLE department_settings (
  settings_id   UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (settings_id, department_id)
);

CREATE INDEX ON department_settings (settings_id);
CREATE INDEX ON department_settings (department_id);
CREATE INDEX ON department_settings (active);

-- Settings → Default Guest Profile (with history support)
-- Links settings to default guest profile
-- Only one active per settings (enforced via unique index)
CREATE TABLE settings_default_guest (
  settings_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (settings_id, profile_id)
);

CREATE INDEX ON settings_default_guest (settings_id);
CREATE INDEX ON settings_default_guest (profile_id);
CREATE INDEX ON settings_default_guest (active);

-- Enforce only one active default guest per settings
CREATE UNIQUE INDEX settings_default_guest_one_active
  ON settings_default_guest(settings_id) WHERE active = true;

-- Settings → Default Superadmin Profile (with history support)
-- Links settings to default superadmin profile
-- Only one active per settings (enforced via unique index)
CREATE TABLE settings_default_account (
  settings_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (settings_id, profile_id)
);

CREATE INDEX ON settings_default_account (settings_id);
CREATE INDEX ON settings_default_account (profile_id);
CREATE INDEX ON settings_default_account (active);

-- Enforce only one active default account per settings
CREATE UNIQUE INDEX settings_default_account_one_active
  ON settings_default_account(settings_id) WHERE active = true;

-- Settings → Default Department (with history support)
-- Links settings to default department for theme determination
-- Only one active per settings (enforced via unique index)
CREATE TABLE settings_default_department (
  settings_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (settings_id, department_id)
);

CREATE INDEX ON settings_default_department (settings_id);
CREATE INDEX ON settings_default_department (department_id);
CREATE INDEX ON settings_default_department (active);

-- Enforce only one active default department per settings
CREATE UNIQUE INDEX settings_default_department_one_active
  ON settings_default_department(settings_id) WHERE active = true;

-- ============================================================================
-- SETTINGS ↔ AUTH JUNCTION TABLE
-- ============================================================================

-- Settings → Auth binary relationship table
-- Tracks which auth providers are available to settings
-- No records = available to all settings (cross-settings)
CREATE TABLE setting_auths (
  settings_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
  auth_id     UUID NOT NULL REFERENCES auth(id) ON DELETE CASCADE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (settings_id, auth_id)
);

CREATE INDEX ON setting_auths (settings_id);
CREATE INDEX ON setting_auths (auth_id);
CREATE INDEX ON setting_auths (active);

-- ============================================================================
-- SETTINGS ↔ PROVIDERS JUNCTION TABLE
-- ============================================================================

-- Settings → Providers binary relationship table
-- Tracks which providers are available to settings
-- No records = available to all settings (cross-settings)
CREATE TABLE setting_providers (
  settings_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (settings_id, provider_id)
);

CREATE INDEX ON setting_providers (settings_id);
CREATE INDEX ON setting_providers (provider_id);
CREATE INDEX ON setting_providers (active);

-- ============================================================================
-- SETTINGS ↔ PROVIDERS ↔ KEYS TERNARY JUNCTION TABLE
-- ============================================================================

-- Settings → Providers → Keys ternary relationship table
-- Tracks which keys are used with which providers for a given settings
-- No records = no keys configured for that provider in that settings
CREATE TABLE setting_provider_keys (
  settings_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  key_id      UUID NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (settings_id, provider_id, key_id)
);

CREATE INDEX ON setting_provider_keys (settings_id);
CREATE INDEX ON setting_provider_keys (provider_id);
CREATE INDEX ON setting_provider_keys (key_id);
CREATE INDEX ON setting_provider_keys (active);

-- ============================================================================
-- SETTINGS ↔ AUTH ↔ KEYS/VALUES TERNARY JUNCTION TABLES
-- ============================================================================

-- Settings → Auth → Keys ternary relationship table (for encrypted auth_items)
-- Tracks which keys are used with which auth items for a given settings
-- No records = no keys configured for that auth item in that settings
CREATE TABLE setting_auth_keys (
  settings_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
  auth_id     UUID NOT NULL REFERENCES auth(id) ON DELETE CASCADE,
  auth_item_id UUID NOT NULL REFERENCES auth_items(id) ON DELETE CASCADE,
  key_id      UUID NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (settings_id, auth_id, auth_item_id, key_id)
);

CREATE INDEX ON setting_auth_keys (settings_id);
CREATE INDEX ON setting_auth_keys (auth_id);
CREATE INDEX ON setting_auth_keys (auth_item_id);
CREATE INDEX ON setting_auth_keys (key_id);
CREATE INDEX ON setting_auth_keys (active);

-- Settings → Auth → Values ternary relationship table (for non-encrypted auth_items)
-- Tracks which values are used with which auth items for a given settings
-- No records = no values configured for that auth item in that settings
CREATE TABLE setting_auth_values (
  settings_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
  auth_id     UUID NOT NULL REFERENCES auth(id) ON DELETE CASCADE,
  auth_item_id UUID NOT NULL REFERENCES auth_items(id) ON DELETE CASCADE,
  value       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (settings_id, auth_id, auth_item_id)
);

CREATE INDEX ON setting_auth_values (settings_id);
CREATE INDEX ON setting_auth_values (auth_id);
CREATE INDEX ON setting_auth_values (auth_item_id);

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to validate rate limits and raise exception if exceeded
-- This allows SQL queries to validate rate limits atomically
CREATE OR REPLACE FUNCTION validate_rate_limit(
    p_req_per_day INTEGER,
    p_runs_today_count BIGINT
) RETURNS BOOLEAN AS $$
BEGIN
    IF p_req_per_day IS NOT NULL AND p_runs_today_count >= p_req_per_day THEN
        RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: Daily request limit of % reached. Please try again tomorrow.', p_req_per_day;
    END IF;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;