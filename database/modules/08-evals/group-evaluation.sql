-- Module: Group Evaluation
-- Category: eval
-- Description: Group Evaluation eval
-- ============================================================


-- Resource rows
INSERT INTO public.evals_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2026-02-19T09:59:35.509148+00:00', true, false, false, 'dd000052-0002-0000-0000-000000000001', 'Group Evaluation', 'Evaluates the chat group from the demo attempt.', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.group_positions_resource (id, groups_id, value, created_at, active, generated, mcp, eval_id) VALUES ('dd000054-0002-0000-0000-000000000001', '019bbcb9-9b4f-75c1-8a46-5f147455b8ee', 1, '2026-02-19T09:59:35.509148+00:00', true, false, false, 'dd000052-0002-0000-0000-000000000001') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.group_rubrics_resource (id, groups_id, created_at, generated, mcp, active, rubric_id) VALUES ('dd000050-0002-0000-0000-000000000001', '019bbcb9-9b4f-75c1-8a46-5f147455b8ee', '2026-02-19T09:59:35.509148+00:00', false, false, true, '019c4e7a-47a6-794f-8d87-66e36e0694c1') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('dd000053-0002-0000-0000-000000000001', 'Group Evaluation', '2026-02-19T09:59:35.509148+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- eval_artifact
INSERT INTO public.eval_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-19T09:59:35.509148+00:00', '2026-02-19T09:59:35.509148+00:00', 'dd000051-0002-0000-0000-000000000001', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- eval_evals_junction
INSERT INTO public.eval_evals_junction (eval_id, evals_id, active, created_at, generated, mcp) VALUES ('dd000051-0002-0000-0000-000000000001', 'dd000052-0002-0000-0000-000000000001', true, '2026-02-19T09:59:35.509148+00:00', false, false) ON CONFLICT (eval_id, evals_id) DO NOTHING;
-- eval_flags_junction
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('dd000051-0002-0000-0000-000000000001', '019b995a-86ef-789f-94fa-2bd3e0707baa', true, '2026-02-19T09:59:35.509148+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('dd000051-0002-0000-0000-000000000001', '019b995a-86ef-7879-89ed-3eadac3e0b84', false, '2026-02-19T09:59:35.509148+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
INSERT INTO public.eval_flags_junction (eval_id, flag_id, value, created_at, generated, mcp, active) VALUES ('dd000051-0002-0000-0000-000000000001', '019be334-bfc4-7c9d-b9f9-19eb0fc849ec', true, '2026-02-19T09:59:35.509148+00:00', false, false, true) ON CONFLICT (eval_id, flag_id) DO NOTHING;
-- eval_group_positions_junction
INSERT INTO public.eval_group_positions_junction (eval_id, group_positions_id, created_at, active, generated, mcp) VALUES ('dd000051-0002-0000-0000-000000000001', 'dd000054-0002-0000-0000-000000000001', '2026-02-19T09:59:35.509148+00:00', true, false, false) ON CONFLICT (eval_id, group_positions_id) DO NOTHING;
-- eval_groups_junction
INSERT INTO public.eval_groups_junction (eval_id, group_id, created_at, generated, mcp, active) VALUES ('dd000051-0002-0000-0000-000000000001', '019bbcb9-9b4f-75c1-8a46-5f147455b8ee', '2026-02-19T09:59:35.509148+00:00', false, false, true) ON CONFLICT (eval_id, group_id) DO NOTHING;
-- eval_groups_rubrics_junction
INSERT INTO public.eval_groups_rubrics_junction (eval_id, created_at, generated, mcp, active, group_rubric_id) VALUES ('dd000051-0002-0000-0000-000000000001', '2026-02-19T09:59:35.509148+00:00', false, false, true, 'dd000050-0002-0000-0000-000000000001') ON CONFLICT (eval_id, group_rubric_id) DO NOTHING;
-- eval_names_junction
INSERT INTO public.eval_names_junction (eval_id, name_id, created_at, generated, mcp, active) VALUES ('dd000051-0002-0000-0000-000000000001', 'dd000053-0002-0000-0000-000000000001', '2026-02-19T09:59:35.509148+00:00', false, false, true) ON CONFLICT (eval_id, name_id) DO NOTHING;
