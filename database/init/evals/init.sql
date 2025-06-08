-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE eval_type AS ENUM ('student', 'ta'); -- this means we run the eval on this agent throughout the conversation

CREATE TABLE evals (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    class_id   UUID        NULL REFERENCES classes(id)  ON DELETE CASCADE, -- can be null if the eval is global
    base_agent_id UUID        NOT NULL REFERENCES agents(id)  ON DELETE CASCADE, -- the agent that will be used as the base for the eval
    scenario_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- what tests will be run over
    agent_ids UUID[]        NOT NULL DEFAULT ARRAY[]::UUID[], -- permutations of agents to run over
    eval_type eval_type NOT NULL           DEFAULT 'student',
    max_turns INTEGER     NOT NULL,
    num_parallel_runs INTEGER     NOT NULL, -- has a maximum of the length of scenario_ids
    rubric_ids   UUID[]        NOT NULL DEFAULT ARRAY[]::UUID[], -- rubrics to use for the eval
  );


CREATE TABLE eval_runs (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    class_id   UUID        NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    eval_id   UUID        NOT NULL REFERENCES evals(id)  ON DELETE CASCADE,
    query_agent_id UUID        NOT NULL REFERENCES agents(id)  ON DELETE CASCADE, -- the agent that will be used to query the eval
    response_agent_id UUID        NOT NULL REFERENCES agents(id)  ON DELETE CASCADE, -- the agent that will be used to respond to the eval
    scenario_id UUID        NOT NULL REFERENCES scenarios(id)  ON DELETE CASCADE, -- the scenario that will be used for the eval
    rubric_id UUID        NOT NULL REFERENCES rubrics(id)  ON DELETE CASCADE, -- the rubric that will be used for the eval
  );

  CREATE TABLE eval_chats (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ  NOT NULL           DEFAULT NOW(),
    completed_at TIMESTAMPTZ  NULL,
    title      TEXT         NOT NULL,
    eval_run_id UUID         NOT NULL REFERENCES eval_runs(id)  ON DELETE CASCADE,
  );

  CREATE TABLE eval_messages (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    chat_id    UUID        NOT NULL REFERENCES eval_chats(id)  ON DELETE CASCADE,
    query      TEXT        NOT NULL,
    response   TEXT        NOT NULL,
    completed  BOOLEAN     NOT NULL           DEFAULT FALSE
  );
