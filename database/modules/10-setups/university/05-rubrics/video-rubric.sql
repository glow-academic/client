-- Module: Video Rubric
-- Category: rubric
-- Description: Video Rubric rubric
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c2085-4b93-7ec6-9d28-4dd2f4692880', 'Rubric for grading video-based assessments', '2026-02-02T22:42:12.482262+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c2085-4b8f-70e2-8ec7-06fea85fd1cb', 'Video Rubric', '2026-02-02T22:42:12.482262+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.rubrics_resource (created_at, active, generated, mcp, id, name, description, department_ids, total_points, pass_points, simulation_rubric, video_rubric) VALUES ('2026-02-02T22:42:12.482262+00:00', true, false, false, '019c2085-4b8d-7300-9b2e-e6dd2ec12031', 'Video Rubric', 'Rubric for grading video-based assessments', '{}', 10, 8, false, true) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- rubric_artifact
INSERT INTO public.rubric_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-02T22:42:12.481884+00:00', '2026-02-02T22:42:12.481884+00:00', '019c2085-4b81-7fa7-854c-569e173a5898', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- rubric_descriptions_junction
INSERT INTO public.rubric_descriptions_junction (rubric_id, description_id, created_at, generated, mcp, active) VALUES ('019c2085-4b81-7fa7-854c-569e173a5898', '019c2085-4b93-7ec6-9d28-4dd2f4692880', '2026-02-02T22:42:12.482262+00:00', false, false, true) ON CONFLICT (rubric_id, description_id) DO NOTHING;
-- rubric_flags_junction
INSERT INTO public.rubric_flags_junction (rubric_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c2085-4b81-7fa7-854c-569e173a5898', '019c2085-4b7c-7a5b-9b83-731223104ac7', true, '2026-02-02T22:42:12.482262+00:00', false, false, true) ON CONFLICT (rubric_id, flag_id) DO NOTHING;
-- rubric_names_junction
INSERT INTO public.rubric_names_junction (rubric_id, name_id, created_at, generated, mcp, active) VALUES ('019c2085-4b81-7fa7-854c-569e173a5898', '019c2085-4b8f-70e2-8ec7-06fea85fd1cb', '2026-02-02T22:42:12.482262+00:00', false, false, true) ON CONFLICT (rubric_id, name_id) DO NOTHING;
-- rubric_rubrics_junction
INSERT INTO public.rubric_rubrics_junction (rubric_id, rubrics_id, active, created_at, generated, mcp) VALUES ('019c2085-4b81-7fa7-854c-569e173a5898', '019c2085-4b8d-7300-9b2e-e6dd2ec12031', true, '2026-02-02T22:42:12.482262+00:00', false, false) ON CONFLICT (rubric_id, rubrics_id) DO NOTHING;
