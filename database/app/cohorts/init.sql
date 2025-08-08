-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE cohorts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  title      TEXT        NOT NULL,
  description TEXT        NULL,
  active      BOOLEAN     NOT NULL           DEFAULT TRUE,
  profile_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], 
  default_cohort BOOLEAN     NOT NULL           DEFAULT FALSE,
  simulation_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[]
);