-- Module: Happy
-- Category: persona
-- Description: Happy persona
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9a-77a6-9446-e9a9c1d8f5de', 'Provides uplifting feedback and cheerful responses.', '2025-08-12T12:52:09.801431+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e96-7712-8abb-da48b93ef8c4', 'Provides uplifting feedback and cheerful responses.', '2025-08-12T12:52:09.984906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.examples_resource (created_at, example, id, generated, mcp) VALUES ('2025-12-10T15:04:04.378076+00:00', 'That sounds great!', '019b3be4-3253-7e60-b44b-28075571088e', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.examples_resource (created_at, example, id, generated, mcp) VALUES ('2025-12-10T15:04:04.378076+00:00', 'I''m excited to learn more', '019b3be4-3253-7e6b-8ea0-093bbda66064', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.examples_resource (created_at, example, id, generated, mcp) VALUES ('2025-12-10T15:04:04.378076+00:00', 'This is really helpful!', '019b3be4-3253-7e6c-ae25-231dd20f6a97', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019b9bab-8a06-71ee-9ccf-c2572ec19a44', 'Start cheerful, upbeat, enthusiastic. This happiness fades slightly when the user is vague. No solving — always ask for more info. Keep tone light and positive: "Yeah! I''m excited to figure this out, but I''m kinda lost here." "Can you explain that part with the ___ again? I''m not totally following." Normal college energy; not overly bubbly. If the user''s follow-up is vague → slight annoyance: "I''m not sure how to answer that… could you be more specific?"', true, '2025-08-12T12:52:09.801431+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e99-7857-8f01-4de8ad620b37', 'Happy', '2025-08-12T12:52:09.801431+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id) VALUES ('a24084ed-81a8-4a74-bdfb-f0c6304af99e', '019bb25e-e5f8-7dda-b5c5-45f0ba4336bd', true, false, '2025-12-12T13:26:55.660542+00:00', '2026-01-28T14:15:32.407116+00:00', '019bb25e-e621-702e-a7ba-81fd751a9c61') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.personas_resource (created_at, active, generated, mcp, id, name, description, icon, color, department_ids, instructions, examples, parameter_field_ids) VALUES ('2025-08-12T12:52:09.801431+00:00', true, false, false, '019bb25e-e60c-72c3-8812-953686ef2201', 'Happy', 'Provides uplifting feedback and cheerful responses.', 'SmilePlus', '#22c55e', '{}', 'Start cheerful, upbeat, enthusiastic. This happiness fades slightly when the user is vague. No solving — always ask for more info. Keep tone light and positive: "Yeah! I''m excited to figure this out, but I''m kinda lost here." "Can you explain that part with the ___ again? I''m not totally following." Normal college energy; not overly bubbly. If the user''s follow-up is vague → slight annoyance: "I''m not sure how to answer that… could you be more specific?"', '{"That sounds great!","I''m excited to learn more","This is really helpful!"}', '{a24084ed-81a8-4a74-bdfb-f0c6304af99e}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- persona_artifact
INSERT INTO public.persona_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.801431+00:00', '2025-12-02T13:15:01.975503+00:00', '019b3be4-36e2-76ac-b44c-bf58cf40c78f', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- persona_colors_junction
INSERT INTO public.persona_colors_junction (persona_id, colors_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-76ac-b44c-bf58cf40c78f', '019b995b-52f6-773e-9996-4bb11ef1e435', '2025-08-12T12:52:09.801431+00:00', false, false, true) ON CONFLICT (persona_id, colors_id) DO NOTHING;
-- persona_descriptions_junction
INSERT INTO public.persona_descriptions_junction (persona_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-76ac-b44c-bf58cf40c78f', '019b995c-8e9a-77a6-9446-e9a9c1d8f5de', '2025-08-12T12:52:09.801431+00:00', false, false, true) ON CONFLICT (persona_id, descriptions_id) DO NOTHING;
INSERT INTO public.persona_descriptions_junction (persona_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-76ac-b44c-bf58cf40c78f', '019b995c-8e96-7712-8abb-da48b93ef8c4', '2025-08-12T12:52:09.801431+00:00', false, false, true) ON CONFLICT (persona_id, descriptions_id) DO NOTHING;
-- persona_examples_junction
INSERT INTO public.persona_examples_junction (created_at, examples_id, persona_id, active, generated, mcp) VALUES ('2025-12-10T15:04:04.378076+00:00', '019b3be4-3253-7e60-b44b-28075571088e', '019b3be4-36e2-76ac-b44c-bf58cf40c78f', true, false, false) ON CONFLICT (persona_id, examples_id) DO NOTHING;
INSERT INTO public.persona_examples_junction (created_at, examples_id, persona_id, active, generated, mcp) VALUES ('2025-12-10T15:04:04.378076+00:00', '019b3be4-3253-7e6b-8ea0-093bbda66064', '019b3be4-36e2-76ac-b44c-bf58cf40c78f', true, false, false) ON CONFLICT (persona_id, examples_id) DO NOTHING;
INSERT INTO public.persona_examples_junction (created_at, examples_id, persona_id, active, generated, mcp) VALUES ('2025-12-10T15:04:04.378076+00:00', '019b3be4-3253-7e6c-ae25-231dd20f6a97', '019b3be4-36e2-76ac-b44c-bf58cf40c78f', true, false, false) ON CONFLICT (persona_id, examples_id) DO NOTHING;
-- persona_flags_junction
INSERT INTO public.persona_flags_junction (persona_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-76ac-b44c-bf58cf40c78f', '019be334-bfc3-7998-9dcf-a00d3d137da5', '2025-08-12T12:52:09.801431+00:00', false, false, true) ON CONFLICT (persona_id, flags_id) DO NOTHING;
-- persona_icons_junction
INSERT INTO public.persona_icons_junction (persona_id, icons_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-76ac-b44c-bf58cf40c78f', '019b995b-52f7-7529-a5a1-36d3e463f24d', '2025-08-12T12:52:09.801431+00:00', false, false, true) ON CONFLICT (persona_id, icons_id) DO NOTHING;
-- persona_instructions_junction
INSERT INTO public.persona_instructions_junction (persona_id, instructions_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-76ac-b44c-bf58cf40c78f', '019b9bab-8a06-71ee-9ccf-c2572ec19a44', '2025-08-12T12:52:09.801431+00:00', false, false, true) ON CONFLICT (persona_id, instructions_id) DO NOTHING;
-- persona_names_junction
INSERT INTO public.persona_names_junction (persona_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-76ac-b44c-bf58cf40c78f', '019b995c-8e99-7857-8f01-4de8ad620b37', '2025-08-12T12:52:09.801431+00:00', false, false, true) ON CONFLICT (persona_id, names_id) DO NOTHING;
-- persona_parameter_fields_junction
INSERT INTO public.persona_parameter_fields_junction (persona_id, parameter_fields_id, active, generated, mcp, created_at) VALUES ('019b3be4-36e2-76ac-b44c-bf58cf40c78f', 'a24084ed-81a8-4a74-bdfb-f0c6304af99e', true, false, false, '2025-12-12T13:26:55.660542+00:00') ON CONFLICT (persona_id, parameter_fields_id) DO NOTHING;
-- persona_personas_junction
INSERT INTO public.persona_personas_junction (persona_id, personas_id, active, created_at, generated, mcp) VALUES ('019b3be4-36e2-76ac-b44c-bf58cf40c78f', '019bb25e-e60c-72c3-8812-953686ef2201', true, '2025-08-12T12:52:09.801431+00:00', false, false) ON CONFLICT (persona_id, personas_id) DO NOTHING;
