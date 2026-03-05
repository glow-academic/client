-- Module: CS 182
-- Category: field
-- Description: CS 182 field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-783f-977f-44945e77235e', 'Logic and proofs; sets, functions, relations, sequences and summations; number representations; counting; fundamentals of the analysis of algorithms; graphs and trees; proof techniques; recursion; Boolean logic; finite state machines; pushdown automata; computability and undecidability.', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.017187+00:00', true, false, false, '019bb25e-e5f8-7cdd-b4b0-cf61647ab5ac', 'CS 182', 'Logic and proofs; sets, functions, relations, sequences and summations; number representations; counting; fundamentals of the analysis of algorithms; graphs and trees; proof techniques; recursion; Boolean logic; finite state machines; pushdown automata; computability and undecidability.', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a6d-b2cf-d9fea99a0bc7', 'CS 182', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 07:52:10.017187-05', '2025-08-12 07:52:10.017187-05', '019b3be4-3255-7d99-95a0-da8a9a4bb732', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_departments_junction
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d99-95a0-da8a9a4bb732', '019b995c-8e9e-783f-977f-44945e77235e', '2025-08-12 07:52:10.017187-05', false, false, true) ON CONFLICT (field_id, descriptions_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7d99-95a0-da8a9a4bb732', '019bb25e-e5f8-7cdd-b4b0-cf61647ab5ac', true, '2025-08-12 07:52:10.017187-05', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d99-95a0-da8a9a4bb732', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-08-12 07:52:10.017187-05', false, false, true) ON CONFLICT (field_id, flags_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d99-95a0-da8a9a4bb732', '019b995c-8e9b-7a6d-b2cf-d9fea99a0bc7', '2025-08-12 07:52:10.017187-05', false, false, true) ON CONFLICT (field_id, names_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c04-8324-b7909cc1366e', '019b3be4-3255-7d99-95a0-da8a9a4bb732', '019bb25e-e5f8-7cdd-b4b0-cf61647ab5ac', true, '2025-08-12 07:52:10.017187-05', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;
