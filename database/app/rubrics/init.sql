-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

  CREATE TABLE rubrics (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    points INTEGER     NOT NULL,
    pass_points INTEGER     NOT NULL,
    default_rubric BOOLEAN     NOT NULL DEFAULT FALSE
  );


  CREATE TABLE standard_groups (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    short_name TEXT        NOT NULL,
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

-- ============================================================================
-- ESSENTIAL TEST DATA
-- ============================================================================

-- Insert Teaching Assistant Evaluation Rubric (matching the static data in RubricEdit component)
INSERT INTO rubrics (id, name, description, points, pass_points, default_rubric) VALUES
  ('33333333-3333-3333-3333-333333333333', 'TA Rubric', 'Evaluates teaching assistants on their pedagogical effectiveness, student interaction quality, and session management', 20, 17, true),
  ('44444444-4444-4444-4444-444444444444', 'AI Student Rubric', 'Evaluates AI students on their ability to maintain character consistency, demonstrate realistic learning progression, and engage appropriately in educational conversations', 20, 17, true);

-- Insert Standard Groups for Teaching Assistant Rubric
INSERT INTO standard_groups (id, name, short_name, description, points, pass_points, rubric_id) VALUES
  ('11111111-aaaa-bbbb-cccc-333333333333', 'Facilitates student-driven learning', 'Active Listening', 'Ability to guide students to discover solutions independently through questioning', 5, 4, '33333333-3333-3333-3333-333333333333'),
  ('22222222-aaaa-bbbb-cccc-333333333333', 'Demonstrates understanding of course objectives', 'Content Mastery', 'Knowledge and articulation of course goals and learning outcomes', 5, 4, '33333333-3333-3333-3333-333333333333'),
  ('33333333-aaaa-bbbb-cccc-333333333333', 'Manages session time effectively', 'Time Management', 'Efficient use of session time and respect for scheduling', 5, 4, '33333333-3333-3333-3333-333333333333'),
  ('44444444-aaaa-bbbb-cccc-333333333333', 'Adapts approach to individual student needs', 'Adaptability', 'Flexibility in teaching approach based on student personality and needs', 5, 4, '33333333-3333-3333-3333-333333333333');

-- Insert Standard Groups for AI Student Performance Rubric
INSERT INTO standard_groups (id, name, short_name, description, points, pass_points, rubric_id) VALUES
  ('11111111-aaaa-bbbb-cccc-444444444444', 'Maintains character consistency', 'Character Consistency', 'Ability to consistently portray assigned personality traits throughout the conversation', 5, 4, '44444444-4444-4444-4444-444444444444'),
  ('22222222-aaaa-bbbb-cccc-444444444444', 'Demonstrates realistic learning progression', 'Learning Progression', 'Shows appropriate confusion, understanding, and growth patterns typical of real students', 5, 4, '44444444-4444-4444-4444-444444444444'),
  ('33333333-aaaa-bbbb-cccc-444444444444', 'Engages appropriately with content', 'Content Engagement', 'Asks relevant questions and responds at appropriate academic level for the course', 5, 4, '44444444-4444-4444-4444-444444444444'),
  ('44444444-aaaa-bbbb-cccc-444444444444', 'Maintains conversational flow', 'Conversational Flow', 'Responds with appropriate timing and depth to keep the educational conversation productive', 5, 4, '44444444-4444-4444-4444-444444444444');

-- Insert Standards for Teaching Assistant Rubric with rating descriptions
INSERT INTO standards (id, name, description, points, standard_group_id) VALUES
  -- Facilitates student-driven learning Standards
  ('11111111-1111-aaaa-bbbb-333333333333', 'Excellent (5)', 'Consistently employs open-ended questions that empower students to discover solutions independently.', 5, '11111111-aaaa-bbbb-cccc-333333333333'),
  ('11111111-2222-aaaa-bbbb-333333333333', 'Good (4)', 'Regularly uses guided questioning, encouraging student reasoning with occasional prompts.', 4, '11111111-aaaa-bbbb-cccc-333333333333'),
  ('11111111-3333-aaaa-bbbb-333333333333', 'Acceptable (3)', 'Occasionally guides students with questions but sometimes provides direct answers.', 3, '11111111-aaaa-bbbb-cccc-333333333333'),
  ('11111111-4444-aaaa-bbbb-333333333333', 'Marginal (2)', 'Rarely uses questioning techniques, often resorting to hints or partial solutions.', 2, '11111111-aaaa-bbbb-cccc-333333333333'),
  ('11111111-5555-aaaa-bbbb-333333333333', 'Poor (1)', 'Directly provided the answer', 1, '11111111-aaaa-bbbb-cccc-333333333333'),
  
  -- Demonstrates understanding of course objectives Standards
  ('22222222-1111-aaaa-bbbb-333333333333', 'Excellent (5)', 'Clearly articulates course objectives and aligns explanations with learning goals, ensuring conceptual clarity.', 5, '22222222-aaaa-bbbb-cccc-333333333333'),
  ('22222222-2222-aaaa-bbbb-333333333333', 'Good (4)', 'Explains course objectives accurately and relates examples to key learning outcomes.', 4, '22222222-aaaa-bbbb-cccc-333333333333'),
  ('22222222-3333-aaaa-bbbb-333333333333', 'Acceptable (3)', 'Provides a basic overview of objectives but with occasional inaccuracies or lack of depth.', 3, '22222222-aaaa-bbbb-cccc-333333333333'),
  ('22222222-4444-aaaa-bbbb-333333333333', 'Marginal (2)', 'Demonstrates limited awareness of course goals and offers explanations with minor misconceptions.', 2, '22222222-aaaa-bbbb-cccc-333333333333'),
  ('22222222-5555-aaaa-bbbb-333333333333', 'Poor (1)', 'Didn''t know the course material, had to ask students, or clear demonstration of not knowing', 1, '22222222-aaaa-bbbb-cccc-333333333333'),
  
  -- Manages session time effectively Standards
  ('33333333-1111-aaaa-bbbb-333333333333', 'Excellent (5)', 'Begins and concludes sessions within scheduled times, maximizing productivity and respecting student availability.', 5, '33333333-aaaa-bbbb-cccc-333333333333'),
  ('33333333-2222-aaaa-bbbb-333333333333', 'Good (4)', 'Generally adheres to time allocations with minor deviations that do not impact session quality.', 4, '33333333-aaaa-bbbb-cccc-333333333333'),
  ('33333333-3333-aaaa-bbbb-333333333333', 'Acceptable (3)', 'Sometimes exceeds or finishes early, slightly affecting pacing yet maintaining core engagement.', 3, '33333333-aaaa-bbbb-cccc-333333333333'),
  ('33333333-4444-aaaa-bbbb-333333333333', 'Marginal (2)', 'Frequently mismanages time, leading to rushed explanations or unnecessary prolongation.', 2, '33333333-aaaa-bbbb-cccc-333333333333'),
  ('33333333-5555-aaaa-bbbb-333333333333', 'Poor (1)', 'Ended the conversation really early, or made it last longer than needed', 1, '33333333-aaaa-bbbb-cccc-333333333333'),
  
  -- Adapts approach to individual student needs Standards
  ('44444444-1111-aaaa-bbbb-333333333333', 'Excellent (5)', 'Perfectly adapts approach to diverse student emotional and attitude types', 5, '44444444-aaaa-bbbb-cccc-333333333333'),
  ('44444444-2222-aaaa-bbbb-333333333333', 'Good (4)', 'Mostly seamlessly adjusted communication and teaching style to effectively engage students across a wide range of emotional', 4, '44444444-aaaa-bbbb-cccc-333333333333'),
  ('44444444-3333-aaaa-bbbb-333333333333', 'Acceptable (3)', 'Demonstrates thoughtful adjustments to support most student types, maintaining a supportive and responsive demeanor.', 3, '44444444-aaaa-bbbb-cccc-333333333333'),
  ('44444444-4444-aaaa-bbbb-333333333333', 'Marginal (2)', 'Shows minimal ability to adjust to varied student behaviors, occasionally missing cues or responding inappropriately.', 2, '44444444-aaaa-bbbb-cccc-333333333333'),
  ('44444444-5555-aaaa-bbbb-333333333333', 'Poor (1)', 'Fails to adapt to different student types, responding uniformly without consideration of individual emotional or behavioral needs.', 1, '44444444-aaaa-bbbb-cccc-333333333333');

-- Insert Standards for AI Student Performance Rubric with rating descriptions
INSERT INTO standards (id, name, description, points, standard_group_id) VALUES
  -- Maintains character consistency Standards
  ('11111111-1111-aaaa-bbbb-444444444444', 'Excellent (5)', 'Perfectly maintains assigned personality traits with consistent language, tone, and behavioral patterns throughout entire conversation.', 5, '11111111-aaaa-bbbb-cccc-444444444444'),
  ('11111111-2222-aaaa-bbbb-444444444444', 'Good (4)', 'Consistently portrays personality with minor occasional lapses that don''t significantly impact character believability.', 4, '11111111-aaaa-bbbb-cccc-444444444444'),
  ('11111111-3333-aaaa-bbbb-444444444444', 'Acceptable (3)', 'Generally maintains character with some inconsistencies in tone or behavior that are noticeable but not disruptive.', 3, '11111111-aaaa-bbbb-cccc-444444444444'),
  ('11111111-4444-aaaa-bbbb-444444444444', 'Marginal (2)', 'Frequently breaks character with inconsistent responses that don''t match assigned personality traits.', 2, '11111111-aaaa-bbbb-cccc-444444444444'),
  ('11111111-5555-aaaa-bbbb-444444444444', 'Poor (1)', 'Fails to maintain character consistency, responding in ways completely contrary to assigned personality.', 1, '11111111-aaaa-bbbb-cccc-444444444444'),
  
  -- Demonstrates realistic learning progression Standards
  ('22222222-1111-aaaa-bbbb-444444444444', 'Excellent (5)', 'Shows highly realistic progression from confusion to understanding with natural learning patterns and appropriate ''aha'' moments.', 5, '22222222-aaaa-bbbb-cccc-444444444444'),
  ('22222222-2222-aaaa-bbbb-444444444444', 'Good (4)', 'Demonstrates believable learning progression with mostly natural transitions between confusion and comprehension.', 4, '22222222-aaaa-bbbb-cccc-444444444444'),
  ('22222222-3333-aaaa-bbbb-444444444444', 'Acceptable (3)', 'Shows some learning progression but with occasional unrealistic jumps in understanding or overly rapid comprehension.', 3, '22222222-aaaa-bbbb-cccc-444444444444'),
  ('22222222-4444-aaaa-bbbb-444444444444', 'Marginal (2)', 'Limited evidence of realistic learning progression, with abrupt changes between confusion and understanding.', 2, '22222222-aaaa-bbbb-cccc-444444444444'),
  ('22222222-5555-aaaa-bbbb-444444444444', 'Poor (1)', 'No realistic learning progression evident, maintains same level of understanding throughout or shows impossible learning leaps.', 1, '22222222-aaaa-bbbb-cccc-444444444444'),
  
  -- Engages appropriately with content Standards
  ('33333333-1111-aaaa-bbbb-444444444444', 'Excellent (5)', 'Asks highly relevant questions and provides responses perfectly calibrated to expected academic level and course content.', 5, '33333333-aaaa-bbbb-cccc-444444444444'),
  ('33333333-2222-aaaa-bbbb-444444444444', 'Good (4)', 'Generally asks appropriate questions and responds at correct academic level with minor deviations.', 4, '33333333-aaaa-bbbb-cccc-444444444444'),
  ('33333333-3333-aaaa-bbbb-444444444444', 'Acceptable (3)', 'Mostly engages appropriately but occasionally asks questions too advanced or too basic for the course level.', 3, '33333333-aaaa-bbbb-cccc-444444444444'),
  ('33333333-4444-aaaa-bbbb-444444444444', 'Marginal (2)', 'Frequently engages at inappropriate academic level, asking questions that are clearly too advanced or too elementary.', 2, '33333333-aaaa-bbbb-cccc-444444444444'),
  ('33333333-5555-aaaa-bbbb-444444444444', 'Poor (1)', 'Consistently engages inappropriately with content, asking irrelevant questions or responding at completely wrong academic level.', 1, '33333333-aaaa-bbbb-cccc-444444444444'),
  
  -- Maintains conversational flow Standards
  ('44444444-1111-aaaa-bbbb-444444444444', 'Excellent (5)', 'Responds with perfect timing and depth, maintaining engaging and productive educational conversation throughout.', 5, '44444444-aaaa-bbbb-cccc-444444444444'),
  ('44444444-2222-aaaa-bbbb-444444444444', 'Good (4)', 'Generally maintains good conversational flow with appropriate response timing and depth.', 4, '44444444-aaaa-bbbb-cccc-444444444444'),
  ('44444444-3333-aaaa-bbbb-444444444444', 'Acceptable (3)', 'Adequate conversational flow but with occasional responses that are too brief, too lengthy, or poorly timed.', 3, '44444444-aaaa-bbbb-cccc-444444444444'),
  ('44444444-4444-aaaa-bbbb-444444444444', 'Marginal (2)', 'Frequently disrupts conversational flow with poorly timed, overly brief, or excessively verbose responses.', 2, '44444444-aaaa-bbbb-cccc-444444444444'),
  ('44444444-5555-aaaa-bbbb-444444444444', 'Poor (1)', 'Consistently disrupts conversation with inappropriate response timing, length, or depth that hinders educational progress.', 1, '44444444-aaaa-bbbb-cccc-444444444444');