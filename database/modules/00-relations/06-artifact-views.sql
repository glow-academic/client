-- Module: artifact-views
-- Category: relations
-- Description: artifact-views relation data
-- ============================================================

-- Table: artifact_view_relation
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('home', 'attempt', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('home', 'attempt_chat', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('home', 'attempt_message', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('home', 'simulation_overview', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('home', 'simulation_history', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('practice', 'attempt', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('practice', 'attempt_chat', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('practice', 'attempt_message', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('practice', 'simulation_overview', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('practice', 'simulation_history', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('benchmark', 'benchmark_attempts', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('benchmark', 'benchmark_chats', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('benchmark', 'benchmark_messages', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('benchmark', 'benchmark_overview', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('benchmark', 'benchmark_history', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('leaderboard', 'simulation_overview', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('dashboard', 'simulation_overview', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('dashboard', 'simulation_history', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('reports', 'attempt', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('reports', 'attempt_chat', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('reports', 'attempt_message', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('reports', 'simulation_overview', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('reports', 'simulation_history', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('attempt', 'attempt', '2026-02-01T14:24:58.338895+00:00', '2026-02-01T14:24:58.338895+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('attempt', 'attempt_chat', '2026-02-01T14:24:58.338895+00:00', '2026-02-01T14:24:58.338895+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('attempt', 'attempt_message', '2026-02-01T14:24:58.338895+00:00', '2026-02-01T14:24:58.338895+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('test', 'benchmark_attempts', '2026-02-01T14:24:58.338895+00:00', '2026-02-01T14:24:58.338895+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('test', 'benchmark_chats', '2026-02-01T14:24:58.338895+00:00', '2026-02-01T14:24:58.338895+00:00') ON CONFLICT (artifact, view) DO NOTHING;
INSERT INTO public.artifact_view_relation (artifact, view, created_at, updated_at) VALUES ('test', 'benchmark_messages', '2026-02-01T14:24:58.338895+00:00', '2026-02-01T14:24:58.338895+00:00') ON CONFLICT (artifact, view) DO NOTHING;
