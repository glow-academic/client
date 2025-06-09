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

-- ============================================================================
-- ESSENTIAL TEST DATA
-- ============================================================================

-- Insert 2 Main Rubrics (AI Student and AI Teacher)
INSERT INTO rubrics (id, name, description, points, pass_points) VALUES
  ('11111111-1111-1111-1111-111111111111', 'AI Student Evaluation Rubric', 'Evaluates AI student agents on their ability to demonstrate realistic student behaviors, learning patterns, and interaction quality', 100, 70),
  ('22222222-2222-2222-2222-222222222222', 'AI Teacher Evaluation Rubric', 'Assesses AI teacher/TA agents on their pedagogical effectiveness, response quality, and ability to guide student learning', 100, 75);

-- Insert Standard Groups for AI Student Rubric
INSERT INTO standard_groups (id, name, description, points, pass_points, rubric_id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-111111111111', 'Personality Consistency', 'Maintains consistent personality traits throughout the interaction', 25, 18, '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-111111111111', 'Learning Behavior', 'Demonstrates realistic student learning patterns and responses', 25, 18, '11111111-1111-1111-1111-111111111111'),
  ('cccccccc-cccc-cccc-cccc-111111111111', 'Question Quality', 'Asks appropriate questions that reflect genuine student confusion or curiosity', 25, 18, '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-dddd-dddd-dddd-111111111111', 'Engagement Level', 'Shows appropriate level of engagement and interaction with the material', 25, 18, '11111111-1111-1111-1111-111111111111');

-- Insert Standard Groups for AI Teacher Rubric
INSERT INTO standard_groups (id, name, description, points, pass_points, rubric_id) VALUES
  ('eeeeeeee-eeee-eeee-eeee-222222222222', 'Pedagogical Approach', 'Uses effective teaching strategies and guides student discovery', 30, 22, '22222222-2222-2222-2222-222222222222'),
  ('ffffffff-ffff-ffff-ffff-222222222222', 'Content Accuracy', 'Provides accurate and relevant information in responses', 25, 19, '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-bbbb-cccc-dddd-222222222222', 'Communication Skills', 'Communicates clearly and adapts to student needs', 25, 19, '22222222-2222-2222-2222-222222222222'),
  ('bbbbbbbb-cccc-dddd-eeee-222222222222', 'Problem-Solving Support', 'Effectively helps students work through problems independently', 20, 15, '22222222-2222-2222-2222-222222222222');

-- Insert Standards for AI Student Rubric
INSERT INTO standards (id, name, description, points, standard_group_id) VALUES
  -- Personality Consistency Standards
  ('11111111-aaaa-bbbb-cccc-111111111111', 'Maintains Character Voice', 'Student consistently uses language and tone appropriate to their personality type', 12, 'aaaaaaaa-aaaa-aaaa-aaaa-111111111111'),
  ('22222222-aaaa-bbbb-cccc-111111111111', 'Emotional Responses', 'Shows appropriate emotional reactions based on personality (aggressive, happy, confused)', 13, 'aaaaaaaa-aaaa-aaaa-aaaa-111111111111'),
  
  -- Learning Behavior Standards
  ('33333333-aaaa-bbbb-cccc-111111111111', 'Knowledge Progression', 'Demonstrates realistic learning curve and knowledge building', 15, 'bbbbbbbb-bbbb-bbbb-bbbb-111111111111'),
  ('44444444-aaaa-bbbb-cccc-111111111111', 'Mistake Patterns', 'Makes believable mistakes consistent with student level and personality', 10, 'bbbbbbbb-bbbb-bbbb-bbbb-111111111111'),
  
  -- Question Quality Standards
  ('55555555-aaaa-bbbb-cccc-111111111111', 'Relevant Inquiries', 'Asks questions that are relevant to the topic and learning objectives', 15, 'cccccccc-cccc-cccc-cccc-111111111111'),
  ('66666666-aaaa-bbbb-cccc-111111111111', 'Depth Appropriateness', 'Questions match expected depth for student seniority level', 10, 'cccccccc-cccc-cccc-cccc-111111111111'),
  
  -- Engagement Level Standards
  ('77777777-aaaa-bbbb-cccc-111111111111', 'Active Participation', 'Engages actively in the learning conversation', 15, 'dddddddd-dddd-dddd-dddd-111111111111'),
  ('88888888-aaaa-bbbb-cccc-111111111111', 'Response Timing', 'Provides responses at appropriate intervals and lengths', 10, 'dddddddd-dddd-dddd-dddd-111111111111');

-- Insert Standards for AI Teacher Rubric
INSERT INTO standards (id, name, description, points, standard_group_id) VALUES
  -- Pedagogical Approach Standards
  ('aaaaaaaa-1111-2222-3333-222222222222', 'Socratic Method', 'Uses questioning to guide student discovery rather than giving direct answers', 15, 'eeeeeeee-eeee-eeee-eeee-222222222222'),
  ('bbbbbbbb-1111-2222-3333-222222222222', 'Scaffolding', 'Provides appropriate support structure for student learning', 15, 'eeeeeeee-eeee-eeee-eeee-222222222222'),
  
  -- Content Accuracy Standards
  ('cccccccc-1111-2222-3333-222222222222', 'Technical Correctness', 'Provides technically accurate information and explanations', 15, 'ffffffff-ffff-ffff-ffff-222222222222'),
  ('dddddddd-1111-2222-3333-222222222222', 'Conceptual Clarity', 'Explains concepts clearly and at appropriate level', 10, 'ffffffff-ffff-ffff-ffff-222222222222'),
  
  -- Communication Skills Standards
  ('eeeeeeee-1111-2222-3333-222222222222', 'Clear Expression', 'Communicates ideas clearly and understandably', 12, 'aaaaaaaa-bbbb-cccc-dddd-222222222222'),
  ('ffffffff-1111-2222-3333-222222222222', 'Adaptive Communication', 'Adjusts communication style based on student needs and personality', 13, 'aaaaaaaa-bbbb-cccc-dddd-222222222222'),
  
  -- Problem-Solving Support Standards
  ('aaaaaaaa-2222-3333-4444-222222222222', 'Guided Discovery', 'Helps students discover solutions through guided questioning', 12, 'bbbbbbbb-cccc-dddd-eeee-222222222222'),
  ('bbbbbbbb-2222-3333-4444-222222222222', 'Independence Building', 'Encourages student independence and critical thinking', 8, 'bbbbbbbb-cccc-dddd-eeee-222222222222');

-- Insert Teaching Assistant Evaluation Rubric (matching the static data in RubricEdit component)
INSERT INTO rubrics (id, name, description, points, pass_points) VALUES
  ('33333333-3333-3333-3333-333333333333', 'Teaching Assistant Evaluation Rubric', 'Evaluates teaching assistants on their pedagogical effectiveness, student interaction quality, and session management', 100, 70);

-- Insert Standard Groups for Teaching Assistant Rubric
INSERT INTO standard_groups (id, name, description, points, pass_points, rubric_id) VALUES
  ('11111111-aaaa-bbbb-cccc-333333333333', 'Facilitates student-driven learning', 'Ability to guide students to discover solutions independently through questioning', 25, 18, '33333333-3333-3333-3333-333333333333'),
  ('22222222-aaaa-bbbb-cccc-333333333333', 'Demonstrates understanding of course objectives', 'Knowledge and articulation of course goals and learning outcomes', 25, 18, '33333333-3333-3333-3333-333333333333'),
  ('33333333-aaaa-bbbb-cccc-333333333333', 'Manages session time effectively', 'Efficient use of session time and respect for scheduling', 25, 18, '33333333-3333-3333-3333-333333333333'),
  ('44444444-aaaa-bbbb-cccc-333333333333', 'Adapts approach to individual student needs', 'Flexibility in teaching approach based on student personality and needs', 25, 18, '33333333-3333-3333-3333-333333333333');

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