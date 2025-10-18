-- For Auth.js - JWT-only authentication (no database adapter)
-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE profile_role AS ENUM ('superadmin', 'admin', 'instructional', 'ta', 'guest');

CREATE TABLE profiles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_name TEXT        NOT NULL,
  last_name  TEXT        NOT NULL,
  alias      TEXT        NOT NULL,
  viewed_intro BOOLEAN   NOT NULL DEFAULT FALSE,
  viewed_chat BOOLEAN   NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role       profile_role NOT NULL DEFAULT 'guest',
  default_profile BOOLEAN   NOT NULL DEFAULT FALSE,
  active     BOOLEAN     NOT NULL DEFAULT FALSE,
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW() -- NOT NULL, defaults to NOW()
  -- req_per_day moved to profile_request_limits junction table
);

-- Add unique constraint to alias (derived from email)
CREATE UNIQUE INDEX profiles_alias_unique ON profiles(alias);

-- Profile ↔ Department M:N relationship (BCNF normalization)
CREATE TABLE profile_departments (
  profile_id    UUID NOT NULL REFERENCES profiles(id)    ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, department_id)
);

CREATE INDEX ON profile_departments (department_id);
CREATE INDEX ON profile_departments (profile_id, is_primary);

-- Enforce max one primary department per profile
CREATE UNIQUE INDEX profile_departments_one_primary_per_profile
  ON profile_departments (profile_id)
  WHERE is_primary;

-- Profile request limits junction table (BCNF normalization)
-- Absence of record means unlimited requests
CREATE TABLE profile_request_limits (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requests_per_day INTEGER NOT NULL CHECK (requests_per_day > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id)
);

CREATE INDEX ON profile_request_limits (profile_id);