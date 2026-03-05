-- Module: Benchmark Agent Evaluation
-- Category: eval
-- Description: Benchmark Agent Evaluation eval
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('cc000043-0000-0000-0000-000000000043', 'Evaluation of benchmark agent performance', '2026-02-11T20:37:27.875564+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-11T20:37:27.875564+00:00', true, false, false, 'cc000041-0000-0000-0000-000000000041', 'Benchmark Agent Evaluation', 'Evaluation of benchmark agent performance', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('cc000042-0000-0000-0000-000000000042', 'Benchmark Agent Evaluation', '2026-02-11T20:37:27.875564+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:37:27.875564+00:00', '2026-02-11T20:37:27.875564+00:00', 'cc000004-0000-0000-0000-000000000004', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- eval_descriptions_junction
INSERT INTO public.eval_descriptions_junction (eval_id, description_id, created_at, generated, mcp, active) VALUES ('cc000004-0000-0000-0000-000000000004', 'cc000043-0000-0000-0000-000000000043', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, description_id) DO NOTHING;
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('cc000004-0000-0000-0000-000000000004', 'cc000041-0000-0000-0000-000000000041', '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, created_at, generated, mcp, active) VALUES ('cc000004-0000-0000-0000-000000000004', '019b995a-86ef-789f-94fa-2bd3e0707baa', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, created_at, generated, mcp, active) VALUES ('cc000004-0000-0000-0000-000000000004', '019b995a-86ef-7879-89ed-3eadac3e0b84', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, created_at, generated, mcp, active) VALUES ('cc000004-0000-0000-0000-000000000004', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('cc000004-0000-0000-0000-000000000004', 'cc000042-0000-0000-0000-000000000042', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
