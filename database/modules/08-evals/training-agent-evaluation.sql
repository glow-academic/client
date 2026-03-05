-- Module: Training Agent Evaluation
-- Category: eval
-- Description: Training Agent Evaluation eval
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('cc000033-0000-0000-0000-000000000033', 'Evaluation of training agent performance', '2026-02-11T20:37:27.875564+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:37:27.875564+00:00', true, false, false, 'cc000031-0000-0000-0000-000000000031', 'Training Agent Evaluation', 'Evaluation of training agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('cc000032-0000-0000-0000-000000000032', 'Training Agent Evaluation', '2026-02-11T20:37:27.875564+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:37:27.875564+00:00', '2026-02-11T20:37:27.875564+00:00', 'cc000003-0000-0000-0000-000000000003', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, descriptions_id, created_at, generated, mcp, active) VALUES ('cc000003-0000-0000-0000-000000000003', 'cc000033-0000-0000-0000-000000000033', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, descriptions_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('cc000003-0000-0000-0000-000000000003', 'cc000031-0000-0000-0000-000000000031', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flags_id, created_at, generated, mcp, active) VALUES ('cc000003-0000-0000-0000-000000000003', '019b995a-86ef-789f-94fa-2bd3e0707baa', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, flags_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flags_id, created_at, generated, mcp, active) VALUES ('cc000003-0000-0000-0000-000000000003', '019b995a-86ef-7879-89ed-3eadac3e0b84', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, flags_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flags_id, created_at, generated, mcp, active) VALUES ('cc000003-0000-0000-0000-000000000003', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, flags_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, names_id, created_at, generated, mcp, active) VALUES ('cc000003-0000-0000-0000-000000000003', 'cc000032-0000-0000-0000-000000000032', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, names_id) DO NOTHING;
