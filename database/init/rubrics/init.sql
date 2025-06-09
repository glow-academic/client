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