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
    default_rubric BOOLEAN     NOT NULL DEFAULT FALSE,
    active BOOLEAN     NOT NULL DEFAULT TRUE
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

-- Insert new rubric
INSERT INTO rubrics (id, name, description, points, pass_points, default_rubric, active) VALUES
('33333333-3333-3333-3333-333333333333', 'TA Rubric', 'Evaluates teaching assistants on their pedagogical effectiveness, student interaction quality, and session management.', 25, 21, true, true);

-- Insert Standard Groups for Teaching Assistant Rubric
INSERT INTO standard_groups (id, name, short_name, description, points, pass_points, rubric_id) VALUES
  ('11111111-aaaa-bbbb-cccc-333333333333', 'Facilitates student-driven learning', 'Active Listening', 'Ability to guide students to discover solutions independently through questioning.', 5, 4, '33333333-3333-3333-3333-333333333333'),
  ('22222222-aaaa-bbbb-cccc-333333333333', 'Demonstrates understanding of course objectives', 'Content Mastery', 'Knowledge and articulation of course goals and learning outcomes.', 5, 5, '33333333-3333-3333-3333-333333333333'),
  ('33333333-aaaa-bbbb-cccc-333333333333', 'Manages session time effectively', 'Time Management', 'Efficient use of session time and respect for scheduling.', 5, 4, '33333333-3333-3333-3333-333333333333'),
  ('44444444-aaaa-bbbb-cccc-333333333333', 'Adapts approach to individual student needs', 'Adaptability', 'Flexibility in teaching approach based on student personality and needs.', 5, 4, '33333333-3333-3333-3333-333333333333'),
  ('55555555-aaaa-bbbb-cccc-333333333333', 'Interpersonal communication and professionalism', 'Communication', 'Flexibility in teaching approach based on student personality and needs.', 5, 4, '33333333-3333-3333-3333-333333333333');


-- Insert Standards for Teaching Assistant Rubric with rating descriptions
INSERT INTO standards (id, name, description, points, standard_group_id) VALUES
  -- Facilitates student-driven learning Standards
  ('11111111-1111-aaaa-bbbb-333333333333', 'Excellent', 'Consistently employs open-ended questions that empower students to discover solutions independently.', 5, '11111111-aaaa-bbbb-cccc-333333333333'),
  ('11111111-2222-aaaa-bbbb-333333333333', 'Good', 'Regularly uses guided questioning, encouraging student reasoning with occasional prompts.', 4, '11111111-aaaa-bbbb-cccc-333333333333'),
  ('11111111-3333-aaaa-bbbb-333333333333', 'Acceptable', 'Occasionally guides students with questions but sometimes provides direct answers.', 3, '11111111-aaaa-bbbb-cccc-333333333333'),
  ('11111111-4444-aaaa-bbbb-333333333333', 'Marginal', 'Rarely uses questioning techniques, often resorting to hints or partial solutions.', 2, '11111111-aaaa-bbbb-cccc-333333333333'),
  ('11111111-5555-aaaa-bbbb-333333333333', 'Poor', 'Directly provided the answer.', 1, '11111111-aaaa-bbbb-cccc-333333333333'),
  
  -- Demonstrates understanding of course objectives Standards
  ('22222222-1111-aaaa-bbbb-333333333333', 'Excellent', 'States course objectives clearly; explains in clear, bite‑sized steps; uses analogies/visuals to clarify when needed; consistently checks understanding.', 5, '22222222-aaaa-bbbb-cccc-333333333333'),
  ('22222222-2222-aaaa-bbbb-333333333333', 'Good', 'Explains course objectives accurately and relates examples to key learning outcomes. Generally provides step-by-step reasoning and occasionally checks for student comprehension.', 4, '22222222-aaaa-bbbb-cccc-333333333333'),
  ('22222222-3333-aaaa-bbbb-333333333333', 'Acceptable', 'Provides a basic overview of objectives but with occasional inaccuracies or lack of depth. Some explanations may feel rushed or cognitively dense.', 3, '22222222-aaaa-bbbb-cccc-333333333333'),
  ('22222222-4444-aaaa-bbbb-333333333333', 'Marginal', 'Demonstrates limited awareness of course goals and offers explanations with minor errors. Explanations frequently rushed, dense, or skip logical steps; seldom checks comprehension.', 2, '22222222-aaaa-bbbb-cccc-333333333333'),
  ('22222222-5555-aaaa-bbbb-333333333333', 'Poor', 'Misstates or omits objectives; dumps information or skips logic, confusing students; no comprehension checks and may rely on students for content.', 1, '22222222-aaaa-bbbb-cccc-333333333333'),

  -- Manages session time effectively Standards
  ('33333333-1111-aaaa-bbbb-333333333333', 'Excellent', 'Begins and concludes sessions within scheduled times, maximizing productivity and respecting student availability.', 5, '33333333-aaaa-bbbb-cccc-333333333333'),
  ('33333333-2222-aaaa-bbbb-333333333333', 'Good', 'Generally adheres to time allocations with minor deviations that do not impact session quality.', 4, '33333333-aaaa-bbbb-cccc-333333333333'),
  ('33333333-3333-aaaa-bbbb-333333333333', 'Acceptable', 'Sometimes exceeds or finishes early, slightly affecting pacing yet maintaining core engagement.', 3, '33333333-aaaa-bbbb-cccc-333333333333'),
  ('33333333-4444-aaaa-bbbb-333333333333', 'Marginal', 'Frequently mismanages time, leading to rushed explanations or unnecessary prolongation.', 2, '33333333-aaaa-bbbb-cccc-333333333333'),
  ('33333333-5555-aaaa-bbbb-333333333333', 'Poor', 'Ended the conversation really early, or made it last longer than needed.', 1, '33333333-aaaa-bbbb-cccc-333333333333'),

  -- Adapts approach to individual student needs Standards
  ('44444444-1111-aaaa-bbbb-333333333333', 'Excellent', 'Perfectly adapts approach to diverse student emotional and attitude types.', 5, '44444444-aaaa-bbbb-cccc-333333333333'),
  ('44444444-2222-aaaa-bbbb-333333333333', 'Good', 'Mostly seamlessly adjusted communication and teaching style to effectively engage students across a wide range of emotions.', 4, '44444444-aaaa-bbbb-cccc-333333333333'),
  ('44444444-3333-aaaa-bbbb-333333333333', 'Acceptable', 'Demonstrates thoughtful adjustments to support most student types, maintaining a supportive and responsive demeanor.', 3, '44444444-aaaa-bbbb-cccc-333333333333'),
  ('44444444-4444-aaaa-bbbb-333333333333', 'Marginal', 'Shows minimal ability to adjust to varied student behaviors, occasionally missing cues or responding inappropriately.', 2, '44444444-aaaa-bbbb-cccc-333333333333'),
  ('44444444-5555-aaaa-bbbb-333333333333', 'Poor', 'Fails to adapt to different student types, responding uniformly without consideration of individual emotional or behavioral needs.', 1, '44444444-aaaa-bbbb-cccc-333333333333'),

  -- Interpersonal communication and professionalism Standards
  ('55555555-1111-aaaa-bbbb-333333333333', 'Excellent', 'Consistently communicates with clarity and professionalism. Follows up when needed and maintains respectful boundaries in all interactions.', 5, '55555555-aaaa-bbbb-cccc-333333333333'),
  ('55555555-2222-aaaa-bbbb-333333333333', 'Good', 'Communicates respectfully and clearly with minor lapses in tone or timing. Upholds professional standards.', 4, '55555555-aaaa-bbbb-cccc-333333333333'),
  ('55555555-3333-aaaa-bbbb-333333333333', 'Acceptable', 'Communication is mostly appropriate but may occasionally be abrupt, or overly casual.', 3, '55555555-aaaa-bbbb-cccc-333333333333'),
  ('55555555-4444-aaaa-bbbb-333333333333', 'Marginal', 'Shows limited awareness of tone or affect. May interrupt, dismiss student concerns, or respond in ways that feel cold or reactive.', 2, '55555555-aaaa-bbbb-cccc-333333333333'),
  ('55555555-5555-aaaa-bbbb-333333333333', 'Poor', 'Demonstrates inappropriate or unprofessional behavior (e.g., sarcastic tone, dismissive responses, or failure to maintain respectful interaction).', 1, '55555555-aaaa-bbbb-cccc-333333333333');