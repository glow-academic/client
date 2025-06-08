-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE rubrics (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    points INTEGER     NOT NULL,
    pass_points INTEGER     NOT NULL
  );


  CREATE TABLE standard_groups (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    points INTEGER     NOT NULL,
    pass_points INTEGER     NOT NULL,
    rubric_id   UUID        NOT NULL REFERENCES rubrics(id)  ON DELETE CASCADE
  );

  CREATE TABLE standards (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    points INTEGER     NOT NULL,
    standard_group_id   UUID        NOT NULL REFERENCES standard_groups(id)  ON DELETE CASCADE
  );


CREATE TABLE rubric_grades (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    passed     BOOLEAN     NOT NULL,
    score      INTEGER     NOT NULL,
    time_taken INTEGER     NOT NULL, -- in seconds
    rubric_id   UUID        NOT NULL REFERENCES rubrics(id)  ON DELETE CASCADE
  );

  CREATE TABLE standard_grades (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    standard_id   UUID        NOT NULL REFERENCES standards(id)  ON DELETE CASCADE,
    rubric_grade_id   UUID        NOT NULL REFERENCES rubric_grades(id)  ON DELETE CASCADE,
    total INTEGER     NOT NULL,
    feedback TEXT
  );


-- ============================================================================
-- ESSENTIAL TEST DATA
-- ============================================================================

-- Insert sample rubrics
INSERT INTO rubrics (id, name, description, points, pass_points) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Basic Programming Rubric', 'Evaluates fundamental programming concepts and problem-solving skills', 100, 70),
  ('22222222-2222-2222-2222-222222222222', 'Advanced Algorithms Rubric', 'Assesses understanding of complex algorithms and data structures', 100, 75),
  ('33333333-3333-3333-3333-333333333333', 'Mathematical Proofs Rubric', 'Evaluates mathematical reasoning and proof construction skills', 100, 80);

-- Insert standard groups
INSERT INTO standard_groups (id, name, description, points, pass_points, rubric_id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-111111111111', 'Problem Understanding', 'Demonstrates clear understanding of the problem requirements', 25, 18, '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-111111111111', 'Solution Design', 'Shows effective approach to solving the problem', 25, 18, '11111111-1111-1111-1111-111111111111'),
  ('cccccccc-cccc-cccc-cccc-111111111111', 'Implementation Quality', 'Code is clean, efficient, and follows best practices', 25, 18, '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-dddd-dddd-dddd-111111111111', 'Communication Skills', 'Explains concepts clearly and responds appropriately', 25, 18, '11111111-1111-1111-1111-111111111111');

-- Insert standards
INSERT INTO standards (id, name, description, points, standard_group_id) VALUES
  ('11111111-aaaa-bbbb-cccc-111111111111', 'Identifies Key Requirements', 'Student correctly identifies the main requirements of the problem', 10, 'aaaaaaaa-aaaa-aaaa-aaaa-111111111111'),
  ('22222222-aaaa-bbbb-cccc-111111111111', 'Recognizes Edge Cases', 'Student considers and addresses potential edge cases', 15, 'aaaaaaaa-aaaa-aaaa-aaaa-111111111111'),
  ('33333333-aaaa-bbbb-cccc-111111111111', 'Chooses Appropriate Algorithm', 'Student selects an efficient algorithm for the problem', 15, 'bbbbbbbb-bbbb-bbbb-bbbb-111111111111'),
  ('44444444-aaaa-bbbb-cccc-111111111111', 'Designs Clear Structure', 'Solution has a logical and well-organized structure', 10, 'bbbbbbbb-bbbb-bbbb-bbbb-111111111111');