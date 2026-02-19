-- Module: Provider Agent Evaluation
-- Category: eval
-- Description: Provider Agent Evaluation eval
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4e7a-4794-73c3-ab81-531c892e0306', 'Evaluation of provider agent performance', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:52:42.499349+00:00', true, false, false, '019c4e7a-4794-73b1-917d-fcc0287078ad', 'Provider Agent Evaluation', 'Evaluation of provider agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4e7a-4794-7952-9557-2299865f98ab', 'Provider Agent Evaluation', '2026-02-11T20:52:42.499349+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', '019c4e7a-4794-739c-8361-b0401227847c', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('019c4e7a-4794-739c-8361-b0401227847c', '019c4e7a-4794-73c3-ab81-531c892e0306', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('019c4e7a-4794-739c-8361-b0401227847c', '019c4e7a-4794-73b1-917d-fcc0287078ad', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-4794-739c-8361-b0401227847c', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-4794-739c-8361-b0401227847c', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4e7a-4794-739c-8361-b0401227847c', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', false, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('019c4e7a-4794-739c-8361-b0401227847c', '019c4e7a-4794-7952-9557-2299865f98ab', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
