-- UUIDv7 support is built into PostgreSQL 18+ (no extension needed)

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

  CREATE TABLE rubrics (
    id         UUID        PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    points INTEGER     NOT NULL,
    pass_points INTEGER     NOT NULL,
    agent_role agent_role,
    active BOOLEAN     NOT NULL DEFAULT TRUE
  );

  -- Rubric → Departments junction table (BCNF normalization)
  -- No records = available to all departments (cross-department)
  CREATE TABLE rubric_departments (
    rubric_id     UUID NOT NULL REFERENCES rubrics(id)      ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id)  ON DELETE CASCADE,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (rubric_id, department_id)
  );

  CREATE INDEX ON rubric_departments (rubric_id);
  CREATE INDEX ON rubric_departments (department_id);

  -- Rubric → Groups junction table (BCNF normalization)
  CREATE TABLE rubric_groups (
    rubric_id UUID NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (rubric_id, group_id)
  );

  CREATE INDEX ON rubric_groups (rubric_id);
  CREATE INDEX ON rubric_groups (group_id);
  CREATE UNIQUE INDEX rubric_groups_one_per_rubric ON rubric_groups(rubric_id);

  CREATE TABLE standard_groups (
    id         UUID        PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    short_name TEXT        NOT NULL,
    description TEXT        NOT NULL,
    points INTEGER     NOT NULL,
    pass_points INTEGER     NOT NULL,
    position INT        NOT NULL DEFAULT 1,
    active BOOLEAN     NOT NULL DEFAULT TRUE,
    rubric_id   UUID        NOT NULL REFERENCES rubrics(id)  ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX standard_groups_position_uniq ON standard_groups(rubric_id, position);

  CREATE TABLE standards (
    id         UUID        PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    points INTEGER     NOT NULL,
    standard_group_id   UUID        NOT NULL REFERENCES standard_groups(id)  ON DELETE CASCADE
  );