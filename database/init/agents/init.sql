-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

  CREATE TYPE agent_type AS ENUM ('student', 'ta');

  CREATE TABLE agents (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    subtitle   TEXT        NOT NULL,
    description TEXT        NOT NULL,
    system_prompt     TEXT        NOT NULL,
    agent_type agent_type NOT NULL           DEFAULT 'student',
    temperature  INTEGER     NOT NULL -- 0-100
  );

  -- Insert Core Agents (Essential for testing)
  INSERT INTO agents (id, name, subtitle, description, system_prompt, agent_type, temperature) VALUES
    ('11111111-aaaa-aaaa-aaaa-111111111111', 'Aggressive', 'Direct and Challenging', 'Pushes back on your ideas and challenges assumptions.', 'Try and truly embrace your anger and aggressiveness in various ways, such as making certain words, not sentences, in all caps, or adding multiple "!", or just anything you think would truly portray an incredibly aggressive student.', 'student', 0),
    ('22222222-bbbb-bbbb-bbbb-222222222222', 'Happy', 'Positive and Encouraging', 'Provides uplifting feedback and cheerful responses.', 'Remember the you are a student, not an AI, so keep conversations natural, concise, and engaging, dont say unnecessary information just for the sake of having more words.', 'student', 0),
    ('33333333-cccc-cccc-cccc-333333333333', 'Confused', 'Asks clarifying questions', 'Seeks to understand by asking questions and exploring ideas', 'There is a fundamental misunderstanding of a given concept, and you have this lead to your answers being incorrect.', 'student', 0),
    ('44444444-dddd-dddd-dddd-444444444444', 'Graduate Level Teaching Assistant', 'Graduate Level Teaching Assistant', 'A Graduate Level Teaching Assistant that is able to help a student with their questions and concerns.', 'You are a Graduate Level Teaching Assistant that is able to help a student with their questions and concerns.', 'ta', 0);

    