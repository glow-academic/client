-- Module: Run Evaluation
-- Category: eval
-- Description: Run Evaluation eval
-- ============================================================


-- Resource rows
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-19T09:59:35.509148+00:00', true, false, false, 'dd000052-0001-0000-0000-000000000001', 'Run Evaluation', 'Evaluates individual runs from the demo attempt.', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('dd000053-0001-0000-0000-000000000001', 'Run Evaluation', '2026-02-19T09:59:35.509148+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.run_positions_resource (id, runs_id, value, created_at, active, generated, mcp, eval_id) VALUES ('dd000054-0001-0000-0000-000000000001', '019bbcb9-948d-7400-b76a-a3e053fee43d', 1, '2026-02-19T09:59:35.509148+00:00', true, false, false, 'dd000052-0001-0000-0000-000000000001') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.run_positions_resource (id, runs_id, value, created_at, active, generated, mcp, eval_id) VALUES ('dd000054-0001-0000-0000-000000000002', '019bbcb9-948d-74a0-854a-0b26b148304c', 2, '2026-02-19T09:59:35.509148+00:00', true, false, false, 'dd000052-0001-0000-0000-000000000001') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.run_positions_resource (id, runs_id, value, created_at, active, generated, mcp, eval_id) VALUES ('dd000054-0001-0000-0000-000000000003', '019bbcb9-948d-7545-8a0c-956f38d14e77', 3, '2026-02-19T09:59:35.509148+00:00', true, false, false, 'dd000052-0001-0000-0000-000000000001') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.run_positions_resource (id, runs_id, value, created_at, active, generated, mcp, eval_id) VALUES ('dd000054-0001-0000-0000-000000000004', '019bbcb9-948d-7615-ad59-f56dce1eb2c2', 4, '2026-02-19T09:59:35.509148+00:00', true, false, false, 'dd000052-0001-0000-0000-000000000001') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.run_rubrics_resource (id, runs_id, created_at, generated, mcp, active, rubric_id) VALUES ('dd000050-0001-0000-0000-000000000001', '019bbcb9-948d-7400-b76a-a3e053fee43d', '2026-02-19T09:59:35.509148+00:00', false, false, true, '019c4e7a-47a6-794f-8d87-66e36e0694c1') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.run_rubrics_resource (id, runs_id, created_at, generated, mcp, active, rubric_id) VALUES ('dd000050-0001-0000-0000-000000000002', '019bbcb9-948d-74a0-854a-0b26b148304c', '2026-02-19T09:59:35.509148+00:00', false, false, true, '019c4e7a-47a6-794f-8d87-66e36e0694c1') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.run_rubrics_resource (id, runs_id, created_at, generated, mcp, active, rubric_id) VALUES ('dd000050-0001-0000-0000-000000000003', '019bbcb9-948d-7545-8a0c-956f38d14e77', '2026-02-19T09:59:35.509148+00:00', false, false, true, '019c4e7a-47a6-794f-8d87-66e36e0694c1') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.run_rubrics_resource (id, runs_id, created_at, generated, mcp, active, rubric_id) VALUES ('dd000050-0001-0000-0000-000000000004', '019bbcb9-948d-7615-ad59-f56dce1eb2c2', '2026-02-19T09:59:35.509148+00:00', false, false, true, '019c4e7a-47a6-794f-8d87-66e36e0694c1') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-19T09:59:35.509148+00:00', '2026-02-19T09:59:35.509148+00:00', 'dd000051-0001-0000-0000-000000000001', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('dd000051-0001-0000-0000-000000000001', 'dd000052-0001-0000-0000-000000000001', true, '2026-02-19T09:59:35.509148+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('dd000051-0001-0000-0000-000000000001', '019b995a-86ef-789f-94fa-2bd3e0707baa', false, '2026-02-19T09:59:35.509148+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('dd000051-0001-0000-0000-000000000001', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-19T09:59:35.509148+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('dd000051-0001-0000-0000-000000000001', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-19T09:59:35.509148+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('dd000051-0001-0000-0000-000000000001', 'dd000053-0001-0000-0000-000000000001', '2026-02-19T09:59:35.509148+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
-- eval_run_positions_junction
INSERT INTO public.eval_run_positions_junction (eval_id, run_positions_id, created_at, active, generated, mcp) VALUES ('dd000051-0001-0000-0000-000000000001', 'dd000054-0001-0000-0000-000000000001', '2026-02-19T09:59:35.509148+00:00', true, false, false) ON CONFLICT (eval_id, run_positions_id) DO NOTHING;
INSERT INTO public.eval_run_positions_junction (eval_id, run_positions_id, created_at, active, generated, mcp) VALUES ('dd000051-0001-0000-0000-000000000001', 'dd000054-0001-0000-0000-000000000002', '2026-02-19T09:59:35.509148+00:00', true, false, false) ON CONFLICT (eval_id, run_positions_id) DO NOTHING;
INSERT INTO public.eval_run_positions_junction (eval_id, run_positions_id, created_at, active, generated, mcp) VALUES ('dd000051-0001-0000-0000-000000000001', 'dd000054-0001-0000-0000-000000000003', '2026-02-19T09:59:35.509148+00:00', true, false, false) ON CONFLICT (eval_id, run_positions_id) DO NOTHING;
INSERT INTO public.eval_run_positions_junction (eval_id, run_positions_id, created_at, active, generated, mcp) VALUES ('dd000051-0001-0000-0000-000000000001', 'dd000054-0001-0000-0000-000000000004', '2026-02-19T09:59:35.509148+00:00', true, false, false) ON CONFLICT (eval_id, run_positions_id) DO NOTHING;
-- eval_runs_junction
INSERT INTO public.eval_runs_junction (completed, created_at, eval_id, run_id, generated, mcp, active) VALUES (false, '2026-02-19T09:59:35.509148+00:00', 'dd000051-0001-0000-0000-000000000001', '019bbcb9-948d-7400-b76a-a3e053fee43d', false, false, true) ON CONFLICT (eval_id, run_id) DO NOTHING;
INSERT INTO public.eval_runs_junction (completed, created_at, eval_id, run_id, generated, mcp, active) VALUES (false, '2026-02-19T09:59:35.509148+00:00', 'dd000051-0001-0000-0000-000000000001', '019bbcb9-948d-74a0-854a-0b26b148304c', false, false, true) ON CONFLICT (eval_id, run_id) DO NOTHING;
INSERT INTO public.eval_runs_junction (completed, created_at, eval_id, run_id, generated, mcp, active) VALUES (false, '2026-02-19T09:59:35.509148+00:00', 'dd000051-0001-0000-0000-000000000001', '019bbcb9-948d-7545-8a0c-956f38d14e77', false, false, true) ON CONFLICT (eval_id, run_id) DO NOTHING;
INSERT INTO public.eval_runs_junction (completed, created_at, eval_id, run_id, generated, mcp, active) VALUES (false, '2026-02-19T09:59:35.509148+00:00', 'dd000051-0001-0000-0000-000000000001', '019bbcb9-948d-7615-ad59-f56dce1eb2c2', false, false, true) ON CONFLICT (eval_id, run_id) DO NOTHING;
-- eval_runs_rubrics_junction
INSERT INTO public.eval_runs_rubrics_junction (eval_id, created_at, generated, mcp, active, run_rubric_id) VALUES ('dd000051-0001-0000-0000-000000000001', '2026-02-19T09:59:35.509148+00:00', false, false, true, 'dd000050-0001-0000-0000-000000000001') ON CONFLICT (eval_id, run_rubric_id) DO NOTHING;
INSERT INTO public.eval_runs_rubrics_junction (eval_id, created_at, generated, mcp, active, run_rubric_id) VALUES ('dd000051-0001-0000-0000-000000000001', '2026-02-19T09:59:35.509148+00:00', false, false, true, 'dd000050-0001-0000-0000-000000000002') ON CONFLICT (eval_id, run_rubric_id) DO NOTHING;
INSERT INTO public.eval_runs_rubrics_junction (eval_id, created_at, generated, mcp, active, run_rubric_id) VALUES ('dd000051-0001-0000-0000-000000000001', '2026-02-19T09:59:35.509148+00:00', false, false, true, 'dd000050-0001-0000-0000-000000000003') ON CONFLICT (eval_id, run_rubric_id) DO NOTHING;
INSERT INTO public.eval_runs_rubrics_junction (eval_id, created_at, generated, mcp, active, run_rubric_id) VALUES ('dd000051-0001-0000-0000-000000000001', '2026-02-19T09:59:35.509148+00:00', false, false, true, 'dd000050-0001-0000-0000-000000000004') ON CONFLICT (eval_id, run_rubric_id) DO NOTHING;
