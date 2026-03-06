-- Module: Student
-- Category: persona
-- Description: Student persona
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9a-77b9-a5ea-563be72ba70b', 'Represents a typical student perspective, asking questions and seeking clarification on course material and policies.', '2025-12-12T13:26:55.656189+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.examples_resource (created_at, example, id, generated, mcp) VALUES ('2025-12-12T13:26:55.656189+00:00', 'Can you explain this concept again?', '019b3be4-3253-7e95-bb4f-4c9117c53d83', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.examples_resource (created_at, example, id, generated, mcp) VALUES ('2025-12-12T13:26:55.656189+00:00', 'I''m not sure I understand the assignment requirements', '019b3be4-3253-7e9a-85f0-1df1bbd6ab23', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.examples_resource (created_at, example, id, generated, mcp) VALUES ('2025-12-12T13:26:55.656189+00:00', 'What should I focus on for the exam?', '019b3be4-3253-7e9d-817b-c5b945de7b77', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e99-7840-a4ac-852e6bcecfaf', 'Student', '2025-12-12T13:26:55.656189+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id) VALUES ('69987f1c-700b-4b5e-8a45-629a8ba345e3', '019bb25e-e5f8-7e1f-a573-7804151ff56d', true, false, '2025-12-12T13:26:55.660542+00:00', '2026-01-28T14:15:32.407116+00:00', '019bb25e-e621-7030-880f-77ce9fc3a6fd') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.personas_resource (created_at, active, generated, mcp, id, name, description, icon, color, department_ids, instructions, examples, parameter_field_ids) VALUES ('2025-12-12T13:26:55.656189+00:00', true, false, false, '019bb25e-e60c-7352-9b81-f411f56092a9', 'Student', 'Represents a typical student perspective, asking questions and seeking clarification on course material and policies.', 'GraduationCap', '#3b82f6', '{}', '', '{"Can you explain this concept again?","I''m not sure I understand the assignment requirements","What should I focus on for the exam?"}', '{69987f1c-700b-4b5e-8a45-629a8ba345e3}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- persona_artifact
INSERT INTO public.persona_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:26:55.656189+00:00', '2025-12-12T13:26:55.656189+00:00', '019b3be4-36e2-771b-bee9-36a98e9eb66b', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- persona_colors_junction
INSERT INTO public.persona_colors_junction (persona_id, colors_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-771b-bee9-36a98e9eb66b', '019b995b-52f6-7746-a592-fbc338f61f5f', '2025-12-12T13:26:55.656189+00:00', false, false, true) ON CONFLICT (persona_id, colors_id) DO NOTHING;
-- persona_descriptions_junction
INSERT INTO public.persona_descriptions_junction (persona_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-771b-bee9-36a98e9eb66b', '019b995c-8e9a-77b9-a5ea-563be72ba70b', '2025-12-12T13:26:55.656189+00:00', false, false, true) ON CONFLICT (persona_id, descriptions_id) DO NOTHING;
-- persona_examples_junction
INSERT INTO public.persona_examples_junction (created_at, examples_id, persona_id, active, generated, mcp) VALUES ('2025-12-12T13:26:55.656189+00:00', '019b3be4-3253-7e95-bb4f-4c9117c53d83', '019b3be4-36e2-771b-bee9-36a98e9eb66b', true, false, false) ON CONFLICT (persona_id, examples_id) DO NOTHING;
INSERT INTO public.persona_examples_junction (created_at, examples_id, persona_id, active, generated, mcp) VALUES ('2025-12-12T13:26:55.656189+00:00', '019b3be4-3253-7e9a-85f0-1df1bbd6ab23', '019b3be4-36e2-771b-bee9-36a98e9eb66b', true, false, false) ON CONFLICT (persona_id, examples_id) DO NOTHING;
INSERT INTO public.persona_examples_junction (created_at, examples_id, persona_id, active, generated, mcp) VALUES ('2025-12-12T13:26:55.656189+00:00', '019b3be4-3253-7e9d-817b-c5b945de7b77', '019b3be4-36e2-771b-bee9-36a98e9eb66b', true, false, false) ON CONFLICT (persona_id, examples_id) DO NOTHING;
-- persona_flags_junction
INSERT INTO public.persona_flags_junction (persona_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-771b-bee9-36a98e9eb66b', '019be334-bfc3-7998-9dcf-a00d3d137da5', '2025-12-12T13:26:55.656189+00:00', false, false, true) ON CONFLICT (persona_id, flags_id) DO NOTHING;
-- persona_icons_junction
INSERT INTO public.persona_icons_junction (persona_id, icons_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-771b-bee9-36a98e9eb66b', '019b995b-52f7-752e-b5df-c8ff97d35ae7', '2025-12-12T13:26:55.656189+00:00', false, false, true) ON CONFLICT (persona_id, icons_id) DO NOTHING;
-- persona_names_junction
INSERT INTO public.persona_names_junction (persona_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-771b-bee9-36a98e9eb66b', '019b995c-8e99-7840-a4ac-852e6bcecfaf', '2025-12-12T13:26:55.656189+00:00', false, false, true) ON CONFLICT (persona_id, names_id) DO NOTHING;
-- persona_parameter_fields_junction
INSERT INTO public.persona_parameter_fields_junction (persona_id, parameter_fields_id, active, generated, mcp, created_at) VALUES ('019b3be4-36e2-771b-bee9-36a98e9eb66b', '69987f1c-700b-4b5e-8a45-629a8ba345e3', true, false, false, '2025-12-12T13:26:55.660542+00:00') ON CONFLICT (persona_id, parameter_fields_id) DO NOTHING;
-- persona_personas_junction
INSERT INTO public.persona_personas_junction (persona_id, personas_id, active, created_at, generated, mcp) VALUES ('019b3be4-36e2-771b-bee9-36a98e9eb66b', '019bb25e-e60c-7352-9b81-f411f56092a9', true, '2025-12-12T13:26:55.656189+00:00', false, false) ON CONFLICT (persona_id, personas_id) DO NOTHING;
