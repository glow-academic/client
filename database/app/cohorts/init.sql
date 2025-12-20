-- UUIDv7 support is built into PostgreSQL 18+ (no extension needed)

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE cohorts (
  id         UUID        PRIMARY KEY DEFAULT uuidv7(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  title      TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT 'No description provided',
  active      BOOLEAN     NOT NULL           DEFAULT TRUE
);

-- Cohort → Profiles junction table (BCNF normalization)
CREATE TABLE cohort_profiles (
  cohort_id  UUID NOT NULL REFERENCES cohorts(id)    ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cohort_id, profile_id)
);

CREATE INDEX ON cohort_profiles (profile_id);
CREATE INDEX ON cohort_profiles (cohort_id);

-- Cohort → Simulations junction table (BCNF normalization)
CREATE TABLE cohort_simulations (
  cohort_id    UUID NOT NULL REFERENCES cohorts(id)      ON DELETE CASCADE,
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cohort_id, simulation_id)
);

CREATE INDEX ON cohort_simulations (simulation_id);
CREATE INDEX ON cohort_simulations (cohort_id);

-- Cohort → Departments junction table (BCNF normalization)
-- No records = available to all departments (cross-department)
CREATE TABLE cohort_departments (
  cohort_id     UUID NOT NULL REFERENCES cohorts(id)      ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id)  ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cohort_id, department_id)
);

CREATE INDEX ON cohort_departments (cohort_id);
CREATE INDEX ON cohort_departments (department_id);