-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- INSERT DOCUMENTS FOR TRAINING SCENARIOS
-- ============================================================================

CREATE TYPE document_type AS ENUM ('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus');

CREATE TABLE documents (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    file_path  TEXT        NOT NULL,
    mime_type  TEXT        NOT NULL,
    type       document_type   NOT NULL           DEFAULT 'homework',
    classified BOOLEAN     NOT NULL           DEFAULT FALSE,
    file_id    TEXT        NULL,
    active BOOLEAN     NOT NULL DEFAULT TRUE,
    tags TEXT[]        NOT NULL DEFAULT '{}' -- tags to associate and search each document
);

-- Insert Documents for Training Scenarios
INSERT INTO documents (id, name, file_path, mime_type, type, classified, file_id) VALUES
  ('d0c11111-2222-3333-4444-444444444444', 'CS180 Project - Methods and Classes', 'd0c11111-2222-3333-4444-444444444444.txt', 'text/plain', 'project', false, 'doc-1'), -- Document: CS180 Project assignment (Methods and Classes)
  ('d0c22222-3333-4444-5555-555555555555', 'CS180 Homework - Interfaces and Inheritance', 'd0c22222-3333-4444-5555-555555555555.txt', 'text/plain', 'homework', false, 'doc-2'), -- Document: CS180 Homework (Interfaces and Inheritance)
  ('d0c33333-4444-5555-6666-666666666666', 'CS180 Lab - Polymorphism and Dynamic Data Structures', 'd0c33333-4444-5555-6666-666666666666.txt', 'text/plain', 'lab', false, 'doc-3'), -- Document: CS180 Lab (Polymorphism, Dynamic Data Structures)
  ('d0c44444-5555-6666-7777-777777777777', 'CS182 Homework - Proof Techniques including Mathematical Induction', 'd0c44444-5555-6666-7777-777777777777.txt', 'text/plain', 'homework', false, 'doc-4'), -- Document: CS182 Homework (Proof Techniques including Mathematical Induction)
  ('d0c55555-6666-7777-8888-888888888888', 'CS182 Lecture - Basic Logic', 'd0c55555-6666-7777-8888-888888888888.txt', 'text/plain', 'lecture', false, 'doc-5'), -- Document: CS182 Lecture (Basic Logic)
  ('d0c66666-7777-8888-9999-999999999999', 'CS182 Lecture - The Language of Mathematics', 'd0c66666-7777-8888-9999-999999999999.txt', 'text/plain', 'lecture', false, 'doc-6'), -- Document: CS182 Lecture (The Language of Mathematics)
  ('d0c77777-8888-9999-aaaa-aaaaaaaaaaaa', 'CS251 Midterm Topics - Runtime Expressions and Asymptotic Runtime Analysis', 'd0c77777-8888-9999-aaaa-aaaaaaaaaaaa.txt', 'text/plain', 'midterm', false, 'doc-7'), -- Document: CS251 Midterm topics (Runtime Expressions, Asymptotic Runtime Analysis)
  ('d0c88888-9999-aaaa-bbbb-bbbbbbbbbbbb', 'CS251 Midterm Topics - Arrays and Linked Lists', 'd0c88888-9999-aaaa-bbbb-bbbbbbbbbbbb.txt', 'text/plain', 'midterm', false, 'doc-8'), -- Document: CS251 Midterm topics (Arrays and Linked Lists)
  ('d0c99999-aaaa-bbbb-cccc-cccccccccccc', 'CS251 Midterm Topics - Binary Trees', 'd0c99999-aaaa-bbbb-cccc-cccccccccccc.txt', 'text/plain', 'midterm', false, 'doc-9'), -- Document: CS251 Midterm topics (Binary Trees)
  ('d0c10000-aaaa-bbbb-cccc-dddddddddddd', 'CS381 Assignment - Techniques for analyzing time and space requirements', 'd0c10000-aaaa-bbbb-cccc-dddddddddddd.txt', 'text/plain', 'homework', false, 'doc-10'), -- Document: CS381 Assignment (Techniques for analyzing time and space requirements)
  ('d0c11111-bbbb-cccc-dddd-eeeeeeeeeeee', 'CS381 Topic - Brief introduction to intractable NP-hard problems', 'd0c11111-bbbb-cccc-dddd-eeeeeeeeeeee.txt', 'text/plain', 'lecture', false, 'doc-11'), -- Document: CS381 Topic (Brief introduction to intractable NP-hard problems)
  ('d0c12222-cccc-dddd-eeee-ffffffffffff', 'CS381 Topic - Application of techniques to graph problems', 'd0c12222-cccc-dddd-eeee-ffffffffffff.txt', 'text/plain', 'lecture', false, 'doc-12'), -- Document: CS381 Topic (Application of techniques to graph problems)
  ('d0c13333-dddd-eeee-ffff-000000000000', 'Networking Course Project Specification', 'd0c13333-dddd-eeee-ffff-000000000000.txt', 'text/plain', 'project', false, 'doc-13'), -- Document: Networking course project specification
  ('d0c14444-eeee-ffff-0000-111111111111', 'Socket Programming Lab Assignment', 'd0c14444-eeee-ffff-0000-111111111111.txt', 'text/plain', 'lab', false, 'doc-14'), -- Document: Socket programming lab assignment
  ('d0c15555-ffff-0000-1111-222222222222', 'Network Security Homework Assignment', 'd0c15555-ffff-0000-1111-222222222222.txt', 'text/plain', 'homework', false, 'doc-15'), -- Document: Network security homework assignment
  ('d0c16666-0000-1111-2222-333333333333', 'ML Project Specification - Neural Networks', 'd0c16666-0000-1111-2222-333333333333.txt', 'text/plain', 'project', false, 'doc-16'), -- Document: ML project specification (neural networks)
  ('d0c17777-1111-2222-3333-444444444444', 'ML Homework - Feature Engineering and Preprocessing', 'd0c17777-1111-2222-3333-444444444444.txt', 'text/plain', 'homework', false, 'doc-17'), -- Document: ML homework (feature engineering and preprocessing)
  ('d0c18888-2222-3333-4444-555555555555', 'ML Assignment - Model Evaluation and Metrics', 'd0c18888-2222-3333-4444-555555555555.txt', 'text/plain', 'homework', false, 'doc-18'); -- Document: ML assignment (model evaluation and metrics)
