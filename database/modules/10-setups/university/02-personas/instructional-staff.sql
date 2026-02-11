-- Module: Instructional Staff
-- Category: persona
-- Description: Instructional Staff persona
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9a-77b2-86c1-a4a56d23f8b1', 'Represents teaching assistants and instructional support staff, helping students navigate course logistics and policies.', '2025-12-12T13:26:55.656189+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.examples_resource (created_at, example, id, generated, mcp) VALUES ('2025-12-12T13:26:55.656189+00:00', 'I can help you understand how to submit your assignment', '019b3be4-3253-7eb7-8261-0fe697a817a2', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.examples_resource (created_at, example, id, generated, mcp) VALUES ('2025-12-12T13:26:55.656189+00:00', 'Let me walk you through the grading policy', '019b3be4-3253-7eb8-9539-4b59144276f0', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.examples_resource (created_at, example, id, generated, mcp) VALUES ('2025-12-12T13:26:55.656189+00:00', 'Here''s what you need to know about office hours', '019b3be4-3253-7ebf-996b-91356ae8f539', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e99-783a-be61-470f68be3981', 'Instructional Staff', '2025-12-12T13:26:55.656189+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id) VALUES ('9e885f85-7798-4777-8214-600f32621b98', '019bb25e-e5f8-7e19-848b-6a558d93d931', true, false, '2025-12-12T13:26:55.660542+00:00', '2026-01-28T14:15:32.407116+00:00', '019bb25e-e621-7030-880f-77ce9fc3a6fd') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.personas_resource (created_at, active, generated, mcp, id, name, description, icon, color, department_ids, instructions, examples) VALUES ('2025-12-12T13:26:55.656189+00:00', true, false, false, '019bb25e-e60c-7359-9409-c72170bf358e', 'Instructional Staff', 'Represents teaching assistants and instructional support staff, helping students navigate course logistics and policies.', 'Users', '#10b981', '{}', '', '{"I can help you understand how to submit your assignment","Let me walk you through the grading policy","Here's what you need to know about office hours"}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- persona_artifact
INSERT INTO public.persona_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:26:55.656189+00:00', '2025-12-12T13:26:55.656189+00:00', '019b3be4-36e2-772b-bdb9-1f088978f564', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- persona_colors_junction
INSERT INTO public.persona_colors_junction (persona_id, color_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-772b-bdb9-1f088978f564', '019b995b-52f6-7754-9d33-d3e56f2063e0', '2025-12-12T13:26:55.656189+00:00', false, false, true) ON CONFLICT (persona_id, color_id) DO NOTHING;
-- persona_descriptions_junction
INSERT INTO public.persona_descriptions_junction (persona_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-772b-bdb9-1f088978f564', '019b995c-8e9a-77b2-86c1-a4a56d23f8b1', '2025-12-12T13:26:55.656189+00:00', false, false, true) ON CONFLICT (persona_id, description_id) DO NOTHING;
-- persona_examples_junction
INSERT INTO public.persona_examples_junction (idx, created_at, example_id, persona_id, active, generated, mcp) VALUES (0, '2025-12-12T13:26:55.656189+00:00', '019b3be4-3253-7eb7-8261-0fe697a817a2', '019b3be4-36e2-772b-bdb9-1f088978f564', true, false, false) ON CONFLICT (persona_id, example_id) DO NOTHING;
INSERT INTO public.persona_examples_junction (idx, created_at, example_id, persona_id, active, generated, mcp) VALUES (1, '2025-12-12T13:26:55.656189+00:00', '019b3be4-3253-7eb8-9539-4b59144276f0', '019b3be4-36e2-772b-bdb9-1f088978f564', true, false, false) ON CONFLICT (persona_id, example_id) DO NOTHING;
INSERT INTO public.persona_examples_junction (idx, created_at, example_id, persona_id, active, generated, mcp) VALUES (2, '2025-12-12T13:26:55.656189+00:00', '019b3be4-3253-7ebf-996b-91356ae8f539', '019b3be4-36e2-772b-bdb9-1f088978f564', true, false, false) ON CONFLICT (persona_id, example_id) DO NOTHING;
-- persona_flags_junction
INSERT INTO public.persona_flags_junction (persona_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-772b-bdb9-1f088978f564', '019be334-bfc3-7998-9dcf-a00d3d137da5', true, '2025-12-12T13:26:55.656189+00:00', false, false, true) ON CONFLICT (persona_id, flag_id) DO NOTHING;
-- persona_icons_junction
INSERT INTO public.persona_icons_junction (persona_id, icon_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-772b-bdb9-1f088978f564', '019b995b-52f7-7514-a656-c0ab11c51261', '2025-12-12T13:26:55.656189+00:00', false, false, true) ON CONFLICT (persona_id, icon_id) DO NOTHING;
-- persona_names_junction
INSERT INTO public.persona_names_junction (persona_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-772b-bdb9-1f088978f564', '019b995c-8e99-783a-be61-470f68be3981', '2025-12-12T13:26:55.656189+00:00', false, false, true) ON CONFLICT (persona_id, name_id) DO NOTHING;
-- persona_parameter_fields_junction
INSERT INTO public.persona_parameter_fields_junction (persona_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-36e2-772b-bdb9-1f088978f564', '9e885f85-7798-4777-8214-600f32621b98', true, false, false, '2025-12-12T13:26:55.660542+00:00') ON CONFLICT (persona_id, parameter_field_id) DO NOTHING;
-- persona_personas_junction
INSERT INTO public.persona_personas_junction (persona_id, personas_id, active, created_at, generated, mcp) VALUES ('019b3be4-36e2-772b-bdb9-1f088978f564', '019bb25e-e60c-7359-9409-c72170bf358e', true, '2025-12-12T13:26:55.656189+00:00', false, false) ON CONFLICT (persona_id, personas_id) DO NOTHING;
