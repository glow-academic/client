-- Module: Professor
-- Category: persona
-- Description: Professor persona
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9a-77c1-93fc-2fc0c34fdaea', 'Represents a faculty member perspective, providing guidance on academic policies and course expectations.', '2025-12-12T13:26:55.656189+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.examples_resource (created_at, example, id, generated, mcp) VALUES ('2025-12-12T13:26:55.656189+00:00', 'Let me clarify the course policy on this matter', '019b3be4-3253-7ea6-a9ac-2137b6e60935', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.examples_resource (created_at, example, id, generated, mcp) VALUES ('2025-12-12T13:26:55.656189+00:00', 'Based on the syllabus, here''s what you need to know', '019b3be4-3253-7eac-90a0-3eaacea881a7', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.examples_resource (created_at, example, id, generated, mcp) VALUES ('2025-12-12T13:26:55.656189+00:00', 'I want to ensure you understand the academic integrity expectations', '019b3be4-3253-7eb2-8354-f5ab4ece83e0', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e99-785d-90b3-859b0847de01', 'Professor', '2025-12-12T13:26:55.656189+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id) VALUES ('c9ae0f45-6868-4e79-8fc7-e862c087ea4b', '019bb25e-e5f8-7e15-a5dc-909687146e61', true, false, '2025-12-12T13:26:55.660542+00:00', '2026-01-28T14:15:32.407116+00:00', '019bb25e-e621-7030-880f-77ce9fc3a6fd') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.personas_resource (created_at, active, generated, mcp, id, name, description, icon, color, department_ids, instructions, examples) VALUES ('2025-12-12T13:26:55.656189+00:00', true, false, false, '019bb25e-e60c-7356-93ee-b176f32f08cf', 'Professor', 'Represents a faculty member perspective, providing guidance on academic policies and course expectations.', 'User', '#8b5cf6', '{}', '', '{"Let me clarify the course policy on this matter","Based on the syllabus, here's what you need to know","I want to ensure you understand the academic integrity expectations"}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- persona_artifact
INSERT INTO public.persona_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:26:55.656189+00:00', '2025-12-12T13:26:55.656189+00:00', '019b3be4-36e2-7727-99bb-d0ac0a635b57', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- persona_colors_junction
INSERT INTO public.persona_colors_junction (persona_id, color_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-7727-99bb-d0ac0a635b57', '019b995b-52f6-7750-8e0d-a4a37ff9ad13', '2025-12-12T13:26:55.656189+00:00', false, false, true) ON CONFLICT (persona_id, color_id) DO NOTHING;
-- persona_descriptions_junction
INSERT INTO public.persona_descriptions_junction (persona_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-7727-99bb-d0ac0a635b57', '019b995c-8e9a-77c1-93fc-2fc0c34fdaea', '2025-12-12T13:26:55.656189+00:00', false, false, true) ON CONFLICT (persona_id, description_id) DO NOTHING;
-- persona_examples_junction
INSERT INTO public.persona_examples_junction (idx, created_at, example_id, persona_id, active, generated, mcp) VALUES (0, '2025-12-12T13:26:55.656189+00:00', '019b3be4-3253-7ea6-a9ac-2137b6e60935', '019b3be4-36e2-7727-99bb-d0ac0a635b57', true, false, false) ON CONFLICT (persona_id, example_id) DO NOTHING;
INSERT INTO public.persona_examples_junction (idx, created_at, example_id, persona_id, active, generated, mcp) VALUES (1, '2025-12-12T13:26:55.656189+00:00', '019b3be4-3253-7eac-90a0-3eaacea881a7', '019b3be4-36e2-7727-99bb-d0ac0a635b57', true, false, false) ON CONFLICT (persona_id, example_id) DO NOTHING;
INSERT INTO public.persona_examples_junction (idx, created_at, example_id, persona_id, active, generated, mcp) VALUES (2, '2025-12-12T13:26:55.656189+00:00', '019b3be4-3253-7eb2-8354-f5ab4ece83e0', '019b3be4-36e2-7727-99bb-d0ac0a635b57', true, false, false) ON CONFLICT (persona_id, example_id) DO NOTHING;
-- persona_flags_junction
INSERT INTO public.persona_flags_junction (persona_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-7727-99bb-d0ac0a635b57', '019be334-bfc3-7998-9dcf-a00d3d137da5', true, '2025-12-12T13:26:55.656189+00:00', false, false, true) ON CONFLICT (persona_id, flag_id) DO NOTHING;
-- persona_icons_junction
INSERT INTO public.persona_icons_junction (persona_id, icon_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-7727-99bb-d0ac0a635b57', '019b995b-52f7-7525-b425-73423c427909', '2025-12-12T13:26:55.656189+00:00', false, false, true) ON CONFLICT (persona_id, icon_id) DO NOTHING;
-- persona_names_junction
INSERT INTO public.persona_names_junction (persona_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-7727-99bb-d0ac0a635b57', '019b995c-8e99-785d-90b3-859b0847de01', '2025-12-12T13:26:55.656189+00:00', false, false, true) ON CONFLICT (persona_id, name_id) DO NOTHING;
-- persona_parameter_fields_junction
INSERT INTO public.persona_parameter_fields_junction (persona_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-36e2-7727-99bb-d0ac0a635b57', 'c9ae0f45-6868-4e79-8fc7-e862c087ea4b', true, false, false, '2025-12-12T13:26:55.660542+00:00') ON CONFLICT (persona_id, parameter_field_id) DO NOTHING;
-- persona_personas_junction
INSERT INTO public.persona_personas_junction (persona_id, personas_id, active, created_at, generated, mcp) VALUES ('019b3be4-36e2-7727-99bb-d0ac0a635b57', '019bb25e-e60c-7356-93ee-b176f32f08cf', true, '2025-12-12T13:26:55.656189+00:00', false, false) ON CONFLICT (persona_id, personas_id) DO NOTHING;
