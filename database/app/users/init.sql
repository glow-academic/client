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
  user_id    INTEGER     NULL REFERENCES users(id) ON DELETE CASCADE,
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