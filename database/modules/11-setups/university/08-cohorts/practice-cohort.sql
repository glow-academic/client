-- Module: Practice Cohort
-- Category: cohort
-- Description: Practice Cohort cohort
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c524c-1bb3-79a6-bb44-8bf1f52a7ac8', 'Practice Cohort', '2026-02-12T14:40:45.489534+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.simulation_positions_resource (id, value, created_at, generated, mcp, simulation_id) VALUES ('019bb25e-e630-7001-8000-000000000001', 1, '2026-02-03T02:23:35.540414+00:00', false, false, '019bb25e-e62c-78a4-a556-64cb01be3d92') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.simulation_positions_resource (id, value, created_at, generated, mcp, simulation_id) VALUES ('019bb25e-e630-7003-8000-000000000003', 3, '2026-02-03T02:23:35.540414+00:00', false, false, '019bb25e-e62c-7899-81e2-c49cae2dbc50') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.simulation_positions_resource (id, value, created_at, generated, mcp, simulation_id) VALUES ('019bb25e-e630-7005-8000-000000000005', 5, '2026-02-03T02:23:35.540414+00:00', false, false, '019bb25e-e62c-78b0-9cc1-39f25f8db3ef') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.simulation_positions_resource (id, value, created_at, generated, mcp, simulation_id) VALUES ('019bb25e-e630-7006-8000-000000000006', 6, '2026-02-03T02:23:35.540414+00:00', false, false, '019bb25e-e62c-7894-b18e-ddd3518cec67') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- cohort_artifact
INSERT INTO public.cohort_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-03T02:23:35.540414+00:00', '2026-02-03T02:23:35.540414+00:00', '019b3be4-3243-7690-8000-000000000001', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- cohort_cohorts_junction
-- cohort_flags_junction
INSERT INTO public.cohort_flags_junction (cohort_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3243-7690-8000-000000000001', '019be334-bfc4-71d1-90f5-23e5037bca21', true, '2026-02-15T20:20:32.255370+00:00', false, false, true) ON CONFLICT (cohort_id, flag_id) DO NOTHING;
-- cohort_names_junction
INSERT INTO public.cohort_names_junction (cohort_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3243-7690-8000-000000000001', '019c524c-1bb3-79a6-bb44-8bf1f52a7ac8', '2026-02-12T14:40:45.489534+00:00', false, false, true) ON CONFLICT (cohort_id, name_id) DO NOTHING;
-- cohort_simulation_positions_junction
INSERT INTO public.cohort_simulation_positions_junction (cohort_id, simulation_position_id, active, created_at, generated, mcp) VALUES ('019b3be4-3243-7690-8000-000000000001', '019bb25e-e630-7001-8000-000000000001', true, '2026-02-03T02:23:35.540414+00:00', false, false) ON CONFLICT (cohort_id, simulation_position_id) DO NOTHING;
INSERT INTO public.cohort_simulation_positions_junction (cohort_id, simulation_position_id, active, created_at, generated, mcp) VALUES ('019b3be4-3243-7690-8000-000000000001', '019bb25e-e630-7003-8000-000000000003', true, '2026-02-03T02:23:35.540414+00:00', false, false) ON CONFLICT (cohort_id, simulation_position_id) DO NOTHING;
INSERT INTO public.cohort_simulation_positions_junction (cohort_id, simulation_position_id, active, created_at, generated, mcp) VALUES ('019b3be4-3243-7690-8000-000000000001', '019bb25e-e630-7005-8000-000000000005', true, '2026-02-03T02:23:35.540414+00:00', false, false) ON CONFLICT (cohort_id, simulation_position_id) DO NOTHING;
INSERT INTO public.cohort_simulation_positions_junction (cohort_id, simulation_position_id, active, created_at, generated, mcp) VALUES ('019b3be4-3243-7690-8000-000000000001', '019bb25e-e630-7006-8000-000000000006', true, '2026-02-03T02:23:35.540414+00:00', false, false) ON CONFLICT (cohort_id, simulation_position_id) DO NOTHING;
