-- UUIDv7 support is built into PostgreSQL 18+ (no extension needed)

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE option_type AS ENUM ('discrete', 'freeform');

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE quizzes (
  id         UUID         PRIMARY KEY DEFAULT uuidv7(),
  created_at TIMESTAMPTZ  NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL           DEFAULT NOW(),
  title      TEXT         NOT NULL,
  video_id   UUID         NOT NULL REFERENCES videos(id)  ON DELETE CASCADE,
  completed  BOOLEAN      NOT NULL           DEFAULT FALSE
);

-- Simulation attempts ↔ Quizzes junction table (BCNF normalization - replaces quizzes.attempt_id)
CREATE TABLE attempt_quizzes (
  attempt_id UUID NOT NULL REFERENCES simulation_attempts(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (attempt_id, quiz_id)
);

CREATE INDEX ON attempt_quizzes (attempt_id);
CREATE INDEX ON attempt_quizzes (quiz_id);
CREATE INDEX ON attempt_quizzes (attempt_id, quiz_id);

-- Standalone questions table (reusable across videos)
CREATE TABLE questions (
  id           UUID        PRIMARY KEY DEFAULT uuidv7(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  question_text TEXT NOT NULL,
  allow_multiple BOOLEAN NOT NULL DEFAULT FALSE,
  active        BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX ON questions (active);

-- Standalone options table (reusable across questions)
CREATE TABLE options (
  id           UUID        PRIMARY KEY DEFAULT uuidv7(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  option_text  TEXT NOT NULL,
  type         option_type NOT NULL,
  active       BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX ON options (active);

-- Video ↔ Questions junction table (BCNF normalization)
-- Links videos to questions
-- Allows questions to be reused across multiple videos
CREATE TABLE video_questions (
  video_id     UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, question_id)
);

CREATE INDEX ON video_questions (video_id);
CREATE INDEX ON video_questions (question_id);
CREATE INDEX ON video_questions (video_id, active);

-- Question times junction table (BCNF normalization)
-- Stores times when a question can appear in a video
-- Allows multiple time windows for the same question in the same video
CREATE TABLE question_times (
  video_id     UUID NOT NULL,
  question_id  UUID NOT NULL,
  time         INTEGER NOT NULL, -- seconds into video when question can appear
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, question_id, time),
  FOREIGN KEY (video_id, question_id) REFERENCES video_questions(video_id, question_id) ON DELETE CASCADE
);

CREATE INDEX ON question_times (video_id, question_id);
CREATE INDEX ON question_times (video_id, question_id, active);

-- Question ↔ Options junction table (BCNF normalization)
-- Links questions to options (all options for a question, correct and incorrect)
-- Allows options to be reused across multiple questions
CREATE TABLE question_options (
  question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_id    UUID NOT NULL REFERENCES options(id) ON DELETE RESTRICT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, option_id)
);

CREATE INDEX ON question_options (question_id);
CREATE INDEX ON question_options (option_id);

-- Question ↔ Options junction table for correct answers (BCNF normalization)
-- Links questions to options that are correct answers
-- Many-to-many: a question can have multiple correct options, an option can be correct for multiple questions
CREATE TABLE question_answers (
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_id   UUID NOT NULL REFERENCES options(id) ON DELETE RESTRICT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, option_id)
);

CREATE INDEX ON question_answers (question_id);
CREATE INDEX ON question_answers (option_id);

-- Quiz responses table (analogous to simulation_messages)
-- Records quiz attempt responses: which option was selected for which question
-- Simple structure: question_id and option_id (both NOT NULL)
-- Can evaluate correctness afterward by checking question_answers junction table
CREATE TABLE quiz_responses (
  id         UUID        PRIMARY KEY DEFAULT uuidv7(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  quiz_id    UUID        NOT NULL REFERENCES quizzes(id)  ON DELETE CASCADE,
  question_id UUID       NOT NULL REFERENCES questions(id)  ON DELETE RESTRICT,
  option_id  UUID        NOT NULL REFERENCES options(id)  ON DELETE RESTRICT,
  completed  BOOLEAN     NOT NULL           DEFAULT FALSE
);

CREATE INDEX ON quiz_responses (quiz_id);
CREATE INDEX ON quiz_responses (question_id);
CREATE INDEX ON quiz_responses (option_id);

