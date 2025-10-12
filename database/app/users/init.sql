-- For Auth.js - Updated to match NextAuth Drizzle adapter requirements
-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE verification_token
(
  identifier TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL,
 
  PRIMARY KEY (identifier, token)
);
 
CREATE TABLE accounts
(
  id SERIAL,
  "userId" INTEGER NOT NULL,
  type VARCHAR(255) NOT NULL,
  provider VARCHAR(255) NOT NULL,
  "providerAccountId" VARCHAR(255) NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  id_token TEXT,
  scope TEXT,
  session_state TEXT,
  token_type TEXT,
 
  PRIMARY KEY (id)
);
 
CREATE TABLE sessions
(
  id SERIAL,
  "userId" INTEGER NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  "sessionToken" VARCHAR(255) NOT NULL,
 
  PRIMARY KEY (id)
);
 
CREATE TABLE users
(
  id SERIAL,
  name VARCHAR(255),
  email VARCHAR(255),
  "emailVerified" TIMESTAMPTZ,
  image TEXT,
 
  PRIMARY KEY (id)
);

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
  last_active TIMESTAMPTZ,
  req_per_day INTEGER     NULL DEFAULT NULL -- model requests per day, null means unlimited
);

-- User ↔ Profiles junction table (BCNF normalization - replaces profiles.user_id)
CREATE TABLE user_profiles (
  user_id     INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, profile_id)
);

CREATE UNIQUE INDEX user_profiles_one_primary_per_user
  ON user_profiles(user_id) WHERE is_primary;

CREATE INDEX ON user_profiles (profile_id);
CREATE INDEX ON user_profiles (user_id, is_primary);

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